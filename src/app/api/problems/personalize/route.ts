import { NextResponse } from "next/server";
import { units } from "@/data/curriculum";
import { generateProblemBank } from "@/data/skill-problem-generators";
import { aiConfigured, clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { INTEREST_OPTIONS, sanitizeTopics, type InterestTopic } from "@/lib/interests";
import { canPersonalize, type PersonalizableProblem } from "@/lib/personalize";
import { personalizeProblems } from "@/lib/story-pipeline";
import { storeSize } from "@/lib/story-store";

/**
 * Turns a few of a student's practice problems into stories about their
 * interests. The work is in src/lib/story-pipeline.ts: stored templates
 * first, the AI only for shapes it has never written.
 *
 * The client sends the skill, the seed its problem bank was generated from,
 * and which problems it wants. It never sends problem text or answers: the
 * bank is regenerated here from the same seed, so the only problems this
 * route will ever rewrite are ones the app itself generated, checked against
 * an answer key the client cannot touch.
 */

// Room for a later request to wait out the free tier's per-minute limit.
// Nobody watches those; they are fetched ahead of the student.
export const maxDuration = 60;

// Keyed by IP, and a whole school reaches us from one IP, so this is set for
// a building full of students, not one kid. At 40 per 10 minutes a single
// class locked itself out. It only stops a runaway script; the real spending
// cap belongs in Groq's Spend Limits.
const allow = makeRateLimiter(1500, 10 * 60 * 1000);

const skills = new Set(units.flatMap((u) => u.skills).map((s) => s.id));

export async function POST(request: Request) {
  let body: { skillId?: unknown; seed?: unknown; ids?: unknown; topics?: unknown; offset?: unknown; seen?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const skillId = typeof body.skillId === "string" ? body.skillId : "";
  const seed = Number(body.seed);
  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.filter((id): id is string => typeof id === "string"))).slice(0, 8)
    : [];
  // Tapped options get today's details, not the ones saved with the student's
  // profile, so improving an option's facts improves every student's problems.
  const topics = sanitizeTopics(body.topics).map((t) => {
    const option = INTEREST_OPTIONS.find((o) => o.label === t.label);
    return option ? { label: t.label, details: option.details } : t;
  });
  const offset = Number.isInteger(body.offset) ? Math.max(0, Number(body.offset)) : 0;
  // Templates this student already saw this session, so none repeats.
  const seen = Array.isArray(body.seen)
    ? body.seen.filter((id): id is string => typeof id === "string" && /^[0-9a-f]{12}$/.test(id)).slice(-60)
    : [];

  if (!skills.has(skillId) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !ids.length) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!topics.length || !aiConfigured()) {
    return NextResponse.json({ problems: [], source: "none" });
  }
  if (!allow(clientKey(request))) {
    return NextResponse.json({ problems: [], source: "rate-limited" });
  }

  const { problems, stats } = await personalizeProblems({ skillId, seed, ids, topics, firstBatch: offset === 0, seen });
  return NextResponse.json({ problems, source: problems.length ? "ai" : "none", stats });
}

/**
 * Is personalization working? Runs one real request on a fixed sample and
 * reports what came from the template library, what was newly written, and
 * why anything was rejected. Cached briefly, since a cold run spends quota.
 */
let lastCheck: { at: number; body: Record<string, unknown> } | null = null;

export async function GET() {
  if (lastCheck && Date.now() - lastCheck.at < 5 * 60 * 1000) return NextResponse.json(lastCheck.body);
  if (!aiConfigured()) {
    return NextResponse.json({
      working: false,
      library: storeSize(),
      verdict: "No model key is set, so every student sees the original problems.",
    });
  }

  const skillId = "two-step-equations";
  const seed = 20260918;
  const skill = units.flatMap((u) => u.skills).find((s) => s.id === skillId)!;
  const sample = generateProblemBank(skillId, skill.problems, seed)
    .filter((p) => canPersonalize(p as PersonalizableProblem))
    .slice(0, 3);
  const topics: InterestTopic[] = ["basketball", "minecraft"].map((id) => {
    const o = INTEREST_OPTIONS.find((x) => x.id === id)!;
    return { label: o.label, details: o.details };
  });
  const { problems, stats } = await personalizeProblems({
    skillId,
    seed,
    ids: sample.map((p) => p.id),
    topics,
    firstBatch: false,
  });

  const body = {
    working: problems.length > 0,
    library: storeSize(),
    stats: { ...stats, drafts: undefined },
    samples: problems.map((p) => ({
      original: sample.find((s) => s.id === p.id)?.prompt,
      story: p.prompt,
      topic: p.topic,
    })),
    verdict: problems.length
      ? `${problems.length} of ${stats.asked} sample problems came back as stories (${stats.fromLibrary} from the template library).`
      : "A key is set but nothing came back. `stats.rejected` says which check stopped it; `no-writer` or `no-judge` means every model was out of quota.",
  };
  lastCheck = { at: Date.now(), body };
  return NextResponse.json(body);
}
