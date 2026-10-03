import { NextResponse } from "next/server";
import { clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { stripEmoji } from "@/lib/helper";

/**
 * The recap of a tutoring call, sent to the other person as a message.
 *
 * Cost: when ANTHROPIC_API_KEY is set this calls claude-opus-4-8 ($5 in, $25
 * out per million tokens), else gpt-4o-mini on OPENAI_API_KEY, else it writes
 * a local extractive recap. With the caps below one AI recap is at most about
 * 5,500 tokens in and 600 out, roughly 4 cents on Opus 4.8. A call ends with
 * one recap, so each network gets 10 AI recaps per 10 minutes; past that the
 * local recap answers instead, with no error. Groq is deliberately not used:
 * call transcripts were never sent to it, and that is a decision for a person.
 */
const aiRecapsByIp = makeRateLimiter(10, 10 * 60 * 1000);

const MAX_TRANSCRIPT = 12000;
const MAX_NOTES = 4000;
const MAX_NAME = 80;

interface SummaryRequest {
  transcript: string;
  notes?: string;
  studentName?: string;
  tutorName?: string;
  durationMinutes?: number;
}

function systemPrompt(): string {
  return `You summarize a live Algebra 1 tutoring video call for a middle/high-school student on AlgeBridge.
Write a warm, encouraging recap the student can read afterward. Use plain text (no markdown symbols).
Structure it as:
1. A one-sentence overview of what the session covered.
2. "What we worked on:", 2-4 short bullet-style lines (use "- ").
3. "Remember:", 1-3 key takeaways or tips.
4. "Next steps:", 1-3 concrete things to practice.
Keep it under ~200 words. Be specific to what was actually discussed. If the transcript is sparse, keep it short and honest.
No emoji. Never use an em dash; use a comma, a period, or a hyphen.`;
}

function userPrompt(req: SummaryRequest): string {
  const parts = [
    `Student: ${req.studentName || "the student"}`,
    `Tutor: ${req.tutorName || "the tutor"}`,
  ];
  if (req.durationMinutes) parts.push(`Call length: ~${req.durationMinutes} minutes`);
  parts.push(`\nCall transcript:\n${req.transcript || "(no speech was transcribed)"}`);
  if (req.notes?.trim()) parts.push(`\nStudent's notebook during the call:\n${req.notes}`);
  return parts.join("\n");
}

async function callAnthropic(apiKey: string, req: SummaryRequest): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 600,
      system: systemPrompt(),
      messages: [{ role: "user", content: userPrompt(req) }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("Anthropic request failed");
  const data = await res.json();
  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new Error("Empty Anthropic response");
  return text;
}

async function callOpenAI(apiKey: string, req: SummaryRequest): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userPrompt(req) },
      ],
      max_tokens: 500,
      temperature: 0.5,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("OpenAI request failed");
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty OpenAI response");
  return text;
}

/** Extractive fallback when no LLM key is configured. */
function localSummary(req: SummaryRequest): string {
  const student = req.studentName || "You";
  const tutor = req.tutorName || "your tutor";
  const lines = (req.transcript || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Pull out algebra-ish keywords actually spoken, for a "topics" line.
  const KEYWORDS = [
    "equation", "slope", "intercept", "graph", "fraction", "exponent",
    "inequality", "factor", "quadratic", "variable", "coordinate", "ratio",
    "proportion", "distribute", "isolate", "substitute", "negative", "solve",
  ];
  const said = req.transcript.toLowerCase();
  const topics = KEYWORDS.filter((k) => said.includes(k));

  const out: string[] = [];
  out.push(
    `Recap of your tutoring call with ${tutor}${req.durationMinutes ? ` (~${req.durationMinutes} min)` : ""}.`
  );
  out.push("");
  out.push("What we worked on:");
  if (topics.length > 0) {
    out.push(`- Topics that came up: ${topics.slice(0, 6).join(", ")}.`);
  }
  if (lines.length > 0) {
    out.push(`- ${lines.length} things were said during the call.`);
    const highlight = lines.find((l) => l.length > 25) ?? lines[0];
    out.push(`- For example: "${highlight.slice(0, 140)}"`);
  } else {
    out.push("- No speech was transcribed, but you met with your tutor.");
  }
  if (req.notes?.trim()) {
    out.push(`- You took notes during the call (saved in your Notebook).`);
  }
  out.push("");
  out.push("Next steps:");
  out.push("- Re-do a couple of practice problems on today's topic.");
  out.push("- Message your tutor if anything still feels fuzzy.");
  out.push("");
  out.push(`Great work showing up and putting in the effort, ${student}!`);
  return out.join("\n");
}

/** House style for text that is sent on to another person. */
function tidy(text: string): string {
  return stripEmoji(text.replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/,\s*,/g, ",")).trim();
}

/** Only the fields this route reads, each with the type it expects and a size cap. */
function cleanRequest(raw: unknown): SummaryRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.transcript !== "string") return null;
  const name = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_NAME) : undefined);
  const minutes = typeof r.durationMinutes === "number" && Number.isFinite(r.durationMinutes) ? r.durationMinutes : undefined;
  return {
    transcript: r.transcript.slice(0, MAX_TRANSCRIPT),
    notes: typeof r.notes === "string" ? r.notes.slice(0, MAX_NOTES) : undefined,
    studentName: name(r.studentName),
    tutorName: name(r.tutorName),
    durationMinutes: minutes !== undefined && minutes > 0 && minutes <= 600 ? Math.round(minutes) : undefined,
  };
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = cleanRequest(raw);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Past the budget the local recap answers, so the call still ends with one.
  if ((anthropicKey || openaiKey) && aiRecapsByIp(clientKey(request))) {
    try {
      let text: string | null = null;
      if (anthropicKey) text = await callAnthropic(anthropicKey, body);
      else if (openaiKey) text = await callOpenAI(openaiKey, body);
      if (text) return NextResponse.json({ summary: tidy(text), source: "ai" as const });
    } catch {
      // fall through to local extractive summary
    }
  }

  return NextResponse.json({ summary: tidy(localSummary(body)), source: "local" as const });
}
