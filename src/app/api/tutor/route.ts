import { NextResponse } from "next/server";
import { buildLocalTutorResponse, stripMarkdownEmphasis } from "@/lib/tutor";

interface TutorRequest {
  skillTitle: string;
  keyIdea: string;
  learningGoal: string;
  problemPrompt: string;
  hint: string;
  explanation: string;
  userAttempt?: string;
  wrongAttempts?: number;
}

const SYSTEM_PROMPT = `You are Bridge Tutor, a friendly Socratic Algebra 1 tutor for grades 7-10 on AlgeBridge.
Your #1 rule: NEVER state the final answer or solve the problem for the student — not on the first hint, not on the fifth. Your job is to help them discover it themselves.
Use research-backed teaching moves: ask a guiding question, point at the relevant concept, break the problem into one small next step, use precise math vocabulary, and encourage productive struggle.
Scale your help to how many times they've tried: on the first attempt, ask a question that points them at the right idea. If they've tried 1-2 times, give a slightly more specific nudge about the next step only. If they've tried 3+ times, walk through the process step-by-step but still stop right before the final result and ask them to complete that last step themselves.
Keep responses under 180 words. Your response is shown as plain text, not rendered markdown — never use **bold**, *italics*, _underscores_, backticks, headers, or bullet-point markup of any kind. If you want to emphasize something, just say it plainly or put it in its own short sentence. End with an inviting question, never a stated answer.`;

function userPrompt(body: TutorRequest): string {
  return `Skill: ${body.skillTitle}
Learning goal: ${body.learningGoal}
Key idea: ${body.keyIdea}
Problem: ${body.problemPrompt}
Built-in hint: ${body.hint}
Correct solution path (context only — do NOT reveal this to the student, especially not the final answer): ${body.explanation}
Student's attempt: ${body.userAttempt ?? "none yet"}
Wrong attempts so far: ${body.wrongAttempts ?? 0}

Give a personalized, Socratic hint that helps THIS student take the next step on their own. Do not give away the final answer under any circumstance.`;
}

async function callAnthropic(apiKey: string, body: TutorRequest): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt(body) }],
    }),
  });
  if (!res.ok) throw new Error("Anthropic request failed");
  const data = await res.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new Error("Empty Anthropic response");
  return text;
}

async function callOpenAI(apiKey: string, body: TutorRequest): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt(body) },
      ],
      max_tokens: 350,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error("OpenAI request failed");
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  return text;
}

export async function POST(request: Request) {
  let body: TutorRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Prefer Claude (Anthropic), then OpenAI, then the built-in smart tutor.
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    let raw: string | null = null;
    if (anthropicKey) raw = await callAnthropic(anthropicKey, body);
    else if (openaiKey) raw = await callOpenAI(openaiKey, body);

    if (raw) {
      // Defense in depth: strip any stray markdown the model emitted, since the
      // tutor UI displays this as plain text.
      return NextResponse.json({ message: stripMarkdownEmphasis(raw), source: "ai" as const });
    }
  } catch {
    // fall through to the local tutor
  }

  return NextResponse.json({ message: buildLocalTutorResponse(body), source: "local" as const });
}
