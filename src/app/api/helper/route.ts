import { NextResponse } from "next/server";
import {
  arithmeticReply,
  classifyIntent,
  ESCALATION_OFFER,
  forbiddenValues,
  leaksAnswer,
  parseArithmetic,
  generalReply,
  refuseAnswer,
  reminderReply,
  schedulerPrompt,
  type HelperContext,
  type HelperMessage,
  type HelperMode,
} from "@/lib/helper";
import { buildLocalChatReply, stripMarkdownEmphasis } from "@/lib/tutor";

/**
 * The helper endpoint.
 *
 * Order matters and is the whole design:
 *
 *   1. Classify the request. An ask for the answer, or an ask to escalate, is
 *      answered here and the model is never called. Nothing a model returns
 *      can breach a rule it was never consulted about.
 *   2. Only then, if a key exists, ask a model for a hint.
 *   3. Filter the reply. If it contains a value the student was meant to
 *      derive, throw it away and fall back to the local engine.
 *
 * With no key configured every branch still works; the replies come from the
 * deterministic engine instead. That is the shipping default.
 */

interface HelperRequest {
  mode: HelperMode;
  context: HelperContext;
  messages: HelperMessage[];
}

type Source = "ai" | "local" | "gate";

function systemPrompt(mode: HelperMode, ctx: HelperContext): string {
  const shared = `You are the AlgeBridge study helper for Algebra 1 students in grades 7 to 10.
Write plain text. No markdown, no asterisks, no headers, no bullet characters.
Never use an em dash. Use a comma, a period, or a hyphen.
Keep it to 2 to 4 sentences.`;

  if (mode === "reminder") {
    return `${shared}
You help a student recall a formula. State the formula, then give one concrete way to remember it.
Do not solve any problem for them.`;
  }
  if (mode === "scheduler") {
    return `${shared}
You are arranging a session with a human tutor. Ask one short question at a time.
Do not teach maths here and do not answer any maths question.`;
  }
  return `${shared}
Skill: ${ctx.skillTitle ?? "Algebra 1"}
Key idea: ${ctx.keyIdea ?? "n/a"}
Current problem: ${ctx.problemPrompt ?? "n/a"}
Hint available: ${ctx.hint ?? "n/a"}
Worked solution, for your context only and never to be revealed: ${ctx.explanation ?? "n/a"}

Absolute rule: never state the final answer, and never state an intermediate value the student is working towards.
Guide with one small next step and end with a question.
If the student proposes an answer, do not confirm or deny it. Have them check it by substituting back.`;
}

async function callGemini(key: string, sys: string, msgs: HelperMessage[]): Promise<string> {
  // Google's free tier is the most generous of the keyless-to-cheap options
  // and needs no card, which is why it is tried first.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: msgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 300, temperature: 0.6 },
      }),
    }
  );
  if (!res.ok) throw new Error("gemini failed");
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("gemini empty");
  return text;
}

async function callGroq(key: string, sys: string, msgs: HelperMessage[]): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: sys }, ...msgs],
      max_tokens: 300,
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error("groq failed");
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("groq empty");
  return text;
}

async function callOpenAICompatible(
  url: string,
  key: string,
  model: string,
  sys: string,
  msgs: HelperMessage[]
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, ...msgs],
      max_tokens: 300,
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error("provider failed");
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("provider empty");
  return text;
}

async function askModel(sys: string, msgs: HelperMessage[]): Promise<string | null> {
  const gemini = process.env.GEMINI_API_KEY;
  const groq = process.env.GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  try {
    if (gemini) return await callGemini(gemini, sys, msgs);
    if (groq) return await callGroq(groq, sys, msgs);
    if (openai)
      return await callOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        openai,
        "gpt-4o-mini",
        sys,
        msgs
      );
  } catch {
    /* every failure falls through to the local engine */
  }
  return null;
}

/** Em dashes are not house style, and a model will produce them regardless. */
function stripEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");
}

function localFallback(ctx: HelperContext, msgs: HelperMessage[]): string {
  // Without a problem to work on there is nothing for the skill engine to
  // quote, and its templates leave empty slots.
  if (!ctx.problemPrompt) {
    const last = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    return generalReply(last);
  }
  return buildLocalChatReply(
    {
      skillTitle: ctx.skillTitle ?? "this skill",
      keyIdea: ctx.keyIdea ?? "",
      learningGoal: "",
      problemPrompt: ctx.problemPrompt ?? "",
      hint: ctx.hint ?? "",
      explanation: ctx.explanation ?? "",
    },
    msgs.map((m) => ({ role: m.role, content: m.content }))
  );
}

export async function POST(request: Request) {
  let body: HelperRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body?.context || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mode: HelperMode = body.mode === "reminder" || body.mode === "scheduler" ? body.mode : "tutor";
  const messages = body.messages.slice(-20);
  const ctx = body.context;
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const reply = (message: string, source: Source, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ message: stripEmDashes(stripMarkdownEmphasis(message)), source, ...extra });

  // --- 1. Gates that never reach a model ---------------------------------

  const intent = classifyIntent(last);

  if (intent === "arithmetic") {
    const a = parseArithmetic(last);
    // Only the number. No working, because the working is the lesson.
    if (a) return reply(arithmeticReply(a), "gate", { intent });
  }

  if (intent === "answer_request") {
    return reply(refuseAnswer(ctx), "gate", { intent });
  }

  if (intent === "escalate") {
    return reply(ESCALATION_OFFER, "gate", { intent, offerTutor: true });
  }

  if (mode === "scheduler") {
    return reply(schedulerPrompt("offered"), "gate", { intent: "scheduling" });
  }

  if (mode === "reminder") {
    return reply(reminderReply(ctx, last), "gate", { intent: "formula" });
  }

  // --- 2. Ask a model, if one is configured ------------------------------

  const raw = await askModel(systemPrompt(mode, ctx), messages);

  // --- 3. Filter what came back ------------------------------------------

  if (raw) {
    const forbidden = forbiddenValues(ctx);
    if (!leaksAnswer(raw, forbidden)) return reply(raw, "ai", { intent });
    // The model gave away a value the student was meant to reach. Discard it
    // entirely rather than trying to patch it, and answer deterministically.
    return reply(localFallback(ctx, messages), "local", { intent, filtered: true });
  }

  return reply(localFallback(ctx, messages), "local", { intent });
}
