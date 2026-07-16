import { NextResponse } from "next/server";

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
2. "What we worked on:" — 2-4 short bullet-style lines (use "- ").
3. "Remember:" — 1-3 key takeaways or tips.
4. "Next steps:" — 1-3 concrete things to practice.
Keep it under ~200 words. Be specific to what was actually discussed. If the transcript is sparse, keep it short and honest.`;
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
  out.push(`Great work showing up and putting in the effort, ${student}! 💪`);
  return out.join("\n");
}

export async function POST(request: Request) {
  let body: SummaryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof body?.transcript !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // Cap sizes so a client can't send an unbounded prompt.
  body.transcript = body.transcript.slice(0, 12000);
  if (body.notes) body.notes = body.notes.slice(0, 4000);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  try {
    let raw: string | null = null;
    if (anthropicKey) raw = await callAnthropic(anthropicKey, body);
    else if (openaiKey) raw = await callOpenAI(openaiKey, body);
    if (raw) return NextResponse.json({ summary: raw, source: "ai" as const });
  } catch {
    // fall through to local extractive summary
  }

  return NextResponse.json({ summary: localSummary(body), source: "local" as const });
}
