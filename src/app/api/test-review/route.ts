import { NextResponse } from "next/server";
import { aiConfigured, callJson, clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { parseModelJson } from "@/lib/personalize";
import { detectCrisis, CRISIS_REPLY } from "@/lib/helper";
import { allUnits } from "@/data/curriculum";
import { callerOf } from "@/lib/server-auth";
import { checkAnswer, lineForQuestion, looksMisread, skillsToPractice, type QuestionStatus, type ReviewedQuestion } from "@/lib/test-review";

/**
 * Reads a student's graded test and explains it: what went wrong on each
 * question, why the score landed where it did, and which AlgeBridge skills
 * the mistakes belong to. The practice itself is not written here: the page
 * opens the real practice panel on those skills, with the course's own
 * checked problem generators, so the answers are right and the work counts.
 *
 * Only text reaches this route. The student checks the transcript before
 * sending, and the prompt asks for math only, so nothing personal is echoed
 * back. Nothing is stored: the review goes back to the browser and that is
 * the only copy.
 */

export const maxDuration = 90;

const byAccount = makeRateLimiter(10, 10 * 60 * 1000);
const byAddress = makeRateLimiter(120, 10 * 60 * 1000);
// Groq's free tier allows 8K tokens a minute per model, counting the reply
// budget. Prompt (~1.9K) + test (up to ~2K) + reply (2.5K) stays under it,
// so the large model answers instead of quietly falling back to the small one.
const MAX_TEXT = 6000;

const SKILLS = allUnits().flatMap((u) => u.skills.map((s) => ({ id: s.id, unitId: u.id, title: s.title })));
const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

const SYSTEM = `You are a patient math teacher looking over a student's graded test (ages 12 to 16, Algebra 1 or 2).
The test text was read from a photo, so expect broken symbols (x2 may mean x^2, S may mean 5). Read it charitably, but never blame the student for a reading error.
If an answer or problem looks garbled (stray symbols like = = or #, a missing sign that a teacher's mark contradicts, an answer that makes no sense as handwriting, or [unreadable]), use status "unclear", give your best reading of the problem, and put in "mistake" what looks misread (e.g. "This may say -4, not 4"). Only call something "wrong" when the student's work clearly says it.

Work every question yourself before judging. Never trust a mark on the page over your own work, but use the teacher's marks (X, check, points) when present.

Return ONLY JSON:
{
 "subject": "short topic of the test",
 "score": "the score as written on the test, or null",
 "summary": "2 to 3 sentences on why the student got this score: the pattern behind the lost points, and what they clearly understand",
 "questions": [
   {"number": "1", "problem": "the problem, cleaned up", "studentAnswer": "what they wrote, or null",
    "status": "correct" | "wrong" | "partial" | "unclear",
    "correctAnswer": "the right answer",
    "mistake": "for wrong/partial: the exact step where it went wrong, in one sentence. null when correct",
    "fix": "the right way through that step, as short steps separated by → (for example: 2(x - 3) = 10 → 2x - 6 = 10 → 2x = 16 → x = 8). null when correct",
    "skill": "the one skill id from the list this question practices, or null"}
 ],
 "strengths": ["up to 3 short things they did well"],
 "skills": [{"id": "skill id from the list", "why": "one sentence: which mistake this fixes"}]
}
Rules: "skills" holds up to 3 ids, only from the list, only for questions that were wrong or partial (empty if everything was correct). Plain text math (x^2, sqrt(), fractions as a/b). Talk to the student as "you". Be kind and direct, no flattery. Never mention or repeat a person's name.

Skill list (id: title):
${SKILLS.map((s) => `${s.id}: ${s.title}`).join("\n")}`;

const str = (v: unknown, max = 600): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const STATUSES = new Set<QuestionStatus>(["correct", "wrong", "partial", "unclear"]);

export async function POST(request: Request) {
  const caller = await callerOf(request);
  if (!caller.ok) return NextResponse.json({ error: caller.error }, { status: caller.status });

  let body: { text?: unknown; score?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const text = str(body.text, MAX_TEXT);
  if (!text || text.length < 10) {
    return NextResponse.json({ error: "There is not enough test text to review yet." }, { status: 400 });
  }
  if (detectCrisis(text)) return NextResponse.json({ crisis: true, message: CRISIS_REPLY });
  if (!aiConfigured()) return NextResponse.json({ error: "Test review needs the AI service, which is not set up here." }, { status: 503 });
  const who = caller.id ?? clientKey(request);
  if (!byAddress(clientKey(request)) || !byAccount(who)) {
    return NextResponse.json({ error: "That is a lot of reviews in a row. Try again in a few minutes." }, { status: 429 });
  }

  const score = str(body.score, 40);
  const result = await callJson({
    system: SYSTEM,
    user: `${score ? `Score the student says they got: ${score}\n\n` : ""}Test text:\n"""\n${text}\n"""`,
    groqModels: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    maxTokens: 2500,
    temperature: 0.2,
    timeoutMs: 45000,
    // A second review in the same minute waits for the large model.
    retryWithinMs: 30000,
    reasoningEffort: "medium",
  });
  const parsed = result ? parseModelJson(result.text) : null;
  if (!parsed) {
    return NextResponse.json(
      { error: result ? "The review came back incomplete. Try again, or review a long test in two parts." : "The review service is busy right now. Try again in a minute." },
      { status: 502 }
    );
  }

  const questions: ReviewedQuestion[] = (Array.isArray(parsed.questions) ? parsed.questions : [])
    .slice(0, 40)
    .map((q: Record<string, unknown>): ReviewedQuestion => ({
      number: str(q?.number, 10) ?? "",
      problem: str(q?.problem) ?? "",
      studentAnswer: str(q?.studentAnswer, 200),
      status: STATUSES.has(q?.status as QuestionStatus) ? (q.status as QuestionStatus) : "unclear",
      correctAnswer: str(q?.correctAnswer, 200),
      mistake: str(q?.mistake),
      fix: str(q?.fix, 800),
      skill: SKILL_BY_ID.has(String(q?.skill)) ? String(q?.skill) : null,
    }))
    .filter((q) => q.problem)
    .map((q) => {
      // A garbled line is the photo reader's mistake, not the student's.
      const raw = lineForQuestion(text, q.number);
      if (raw && looksMisread(raw) && (q.status === "wrong" || q.status === "partial")) {
        return { ...q, status: "unclear" as const, mistake: `The photo text reads "${raw.trim().slice(0, 120)}", which looks garbled.` };
      }
      // A right answer code can check is checked. When the model's own answer
      // fails, its verdict on that question is not shown as a verdict.
      if (q.correctAnswer && q.status !== "unclear" && checkAnswer(q.problem, q.correctAnswer) === false) {
        return { ...q, status: "unclear" as const, mistake: "AlgeBridge could not confirm the right answer for this one, so it is not graded here." };
      }
      return q;
    });

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No math questions were found in that text. Try a clearer photo, or type the questions and your answers in." },
      { status: 422 }
    );
  }

  const seen = new Set<string>();
  const skills = (Array.isArray(parsed.skills) ? parsed.skills : [])
    .flatMap((s: Record<string, unknown>) => {
      const skill = SKILL_BY_ID.get(String(s?.id));
      if (!skill || seen.has(skill.id)) return [];
      seen.add(skill.id);
      return [{ ...skill, why: str(s?.why, 300) ?? "" }];
    })
    .slice(0, 3);

  const practice = skillsToPractice(questions, skills.map((s: { id: string }) => s.id))
    .map((id) => SKILL_BY_ID.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return NextResponse.json({
    subject: str(parsed.subject, 120),
    score: str(parsed.score, 40) ?? score,
    summary: str(parsed.summary, 1200),
    strengths: (Array.isArray(parsed.strengths) ? parsed.strengths : []).map((s: unknown) => str(s, 200)).filter(Boolean).slice(0, 3),
    questions,
    skills,
    practice,
    provider: result?.provider,
  });
}
