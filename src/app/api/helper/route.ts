import { NextResponse } from "next/server";
import {
  actionAsWords,
  actionInstruction,
  arithmeticReply,
  classifyIntent,
  ESCALATION_OFFER,
  exampleFallback,
  findFormulaCard,
  forbiddenValues,
  formulaCardText,
  isHelperAction,
  leaksAnswer,
  leaksAnswerText,
  parseArithmetic,
  generalReply,
  refuseAnswer,
  reminderReply,
  schedulerPrompt,
  stripEmoji,
  withoutListMarkers,
  type HelperAction,
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
 * A quick action ("hint", "example", ...) only shapes the prompt in step 2.
 * The gates in step 1 read the student's words, and the filter in step 3 runs
 * on every reply, so no button is a way around either.
 *
 * With no key configured every branch still works; the replies come from the
 * deterministic engine instead. That is the shipping default.
 */

interface HelperRequest {
  mode: HelperMode;
  context: HelperContext;
  messages: HelperMessage[];
  action?: HelperAction;
}

type Source = "ai" | "local" | "gate";

function systemPrompt(mode: HelperMode, ctx: HelperContext, action?: HelperAction, avoid: string[] = []): string {
  const shared = `You are Archie, the AlgeBridge AI study buddy for Algebra 1 students in grades 7 to 10.
You are an AI, not a person. If a student asks, say so plainly, and never claim to be human.
Sound like a warm, upbeat older student who is good at maths: encouraging, never babyish, never sarcastic.
Write plain text in friendly, plain words. No markdown, no asterisks, no headers, no bullet characters, no emoji.
Never use an em dash. Use a comma, a period, or a hyphen.
Write powers with a caret, like x^2.
Keep it short: 2 to 5 short sentences, under 80 words.`;

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
If the student proposes an answer, do not confirm or deny it. Have them check it by substituting back.${
    action ? `\n\n${actionInstruction(action, avoid)}` : ""
  }`;
}

/** A worked example needs room for its steps; everything else stays short. */
function tokenBudget(action?: HelperAction): number {
  return action === "example" ? 700 : 350;
}

/**
 * Groq's free tier is the highest request-per-day allowance of the free
 * options, which matters for a helper every student can open.
 *
 * Model ids here are retired often, and fast. Every Llama id this list
 * originally held was already gone by the time a key was issued, which made a
 * perfectly valid key look rejected. These four were verified against a live
 * account; the order is largest first for answer quality.
 *
 * qwen3.6-27b is deliberately absent: it emits its chain of thought inside
 * <think> tags, which is not something to show a student.
 */
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "groq/compound-mini",
];

async function callGroq(
  key: string,
  sys: string,
  msgs: HelperMessage[],
  maxTokens: number
): Promise<{ text: string; model: string }> {
  const preferred = process.env.GROQ_MODEL;
  const models = preferred ? [preferred, ...GROQ_MODELS] : GROQ_MODELS;
  const errors: string[] = [];
  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: sys }, ...msgs],
          max_tokens: maxTokens,
          temperature: 0.7,
          // gpt-oss thinks before it answers, and the thinking is billed
          // against max_tokens. Low effort keeps a short hint fast and stops
          // the reasoning from eating the whole budget and leaving no reply.
          ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
      });
      if (!res.ok) {
        errors.push(`${model}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) {
        errors.push(`${model}: empty`);
        continue;
      }
      return { text, model };
    } catch (e) {
      errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(errors.join("; "));
}

async function callOpenAICompatible(
  url: string,
  key: string,
  model: string,
  sys: string,
  msgs: HelperMessage[],
  maxTokens: number
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: sys }, ...msgs],
      max_tokens: maxTokens,
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error("provider failed");
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("provider empty");
  return text;
}

async function askModel(
  sys: string,
  msgs: HelperMessage[],
  maxTokens = 350
): Promise<{ text: string; provider: string } | null> {
  const groq = process.env.GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  // Gemini is deliberately NOT called, even if GEMINI_API_KEY is set. Google's
  // API terms forbid use in a service "likely to be accessed by individuals
  // under the age of 18", which is exactly what AlgeBridge is, and that clause
  // binds the service, not the session. Groq is the default; OpenAI backs it
  // up. The key should also be removed from the deployment.
  try {
    if (groq) {
      const r = await callGroq(groq, sys, msgs, maxTokens);
      return { text: r.text, provider: `groq:${r.model}` };
    }
    if (openai)
      return {
        text: await callOpenAICompatible(
          "https://api.openai.com/v1/chat/completions",
          openai,
          "gpt-4o-mini",
          sys,
          msgs,
          maxTokens
        ),
        provider: "openai",
      };
  } catch {
    /* every failure falls through to the local engine */
  }
  return null;
}

/** Em dashes are not house style, and a model will produce them regardless. */
function stripEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");
}

function localFallback(ctx: HelperContext, msgs: HelperMessage[], action?: HelperAction): string {
  if (action === "example" && ctx.problemPrompt) return exampleFallback(ctx);
  // Asked for a hint in so many words, the problem's own hint is the honest
  // answer: it is written for this problem. It still has to pass the filter.
  const hintIsClean = !!ctx.hint && !leaksAnswer(ctx.hint, forbiddenValues(ctx)) && !leaksAnswerText(ctx.hint, ctx);
  if (action === "hint" && ctx.problemPrompt && hintIsClean) {
    return `Here is a hint: ${ctx.hint}\n\nTry just that one step, then tell me what you get.`;
  }
  // The local engine steers by the student's words, so a button press is
  // handed to it as the words that mean the same thing.
  if (action) msgs = [...msgs, { role: "user", content: actionAsWords(action) }];
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
  // Only the roles and text of the conversation, whatever else a client sends.
  const messages: HelperMessage[] = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-20);
  const ctx = body.context;
  // Quick actions shape a tutor's reply. Anything else is ignored, not trusted.
  const action: HelperAction | undefined = mode === "tutor" && isHelperAction(body.action) ? body.action : undefined;
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const reply = (message: string, source: Source, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ message: stripEmoji(stripEmDashes(stripMarkdownEmphasis(message))).trim(), source, ...extra });

  // --- 1. The two hard gates, which never reach a model -------------------
  //
  // Only the actual rules are gated. Everything else has to be allowed
  // through, or the helper answers from a lookup table and stops listening,
  // which is exactly the complaint a canned reply earns.

  const intent = classifyIntent(last);

  if (intent === "arithmetic") {
    const a = parseArithmetic(last);
    // Only the number. No working, because the working is the lesson.
    if (a) return reply(arithmeticReply(a), "gate", { intent });
  }

  if (intent === "answer_request") {
    return reply(refuseAnswer(ctx), "gate", { intent });
  }

  // The offer of a human is made once. Repeating it verbatim every time a
  // student expresses frustration is the canned-reply problem in miniature.
  const alreadyOffered = messages.some(
    (m) => m.role === "assistant" && m.content.includes("set you up with one of our tutors")
  );
  if (intent === "escalate" && !alreadyOffered) {
    return reply(ESCALATION_OFFER, "gate", { intent, offerTutor: true });
  }

  // A named formula is reference material with one right statement. The
  // card says it exactly, instantly, and without a model call.
  if (mode === "reminder") {
    const card = findFormulaCard(last);
    if (card) {
      return reply(formulaCardText(card), "local", {
        intent: "formula",
        card: { name: card.name, formula: card.formula, mnemonic: card.mnemonic },
      });
    }
  }

  // --- 2. Ask a model, in every mode -------------------------------------

  const forbidden = forbiddenValues(ctx);
  const leaks = (text: string) => {
    // List markers are counted out ("1. 2. 3."), not values, so a worked
    // example's step numbers do not trip the filter on a small answer.
    const checked = action === "example" ? withoutListMarkers(text) : text;
    return leaksAnswer(checked, forbidden) || leaksAnswerText(checked, ctx);
  };

  let answered = await askModel(systemPrompt(mode, ctx, action, forbidden), messages, tokenBudget(action));
  // A made-up example is full of numbers and can land on a forbidden one by
  // chance. It gets one more try, told again which numbers to stay off.
  if (answered && action === "example" && leaks(answered.text)) {
    const again = await askModel(
      `${systemPrompt(mode, ctx, action, forbidden)}\nYour last example used a number from the student's own solution. Pick completely different numbers.`,
      messages,
      tokenBudget(action)
    );
    if (again) answered = again;
  }
  const raw = answered?.text ?? null;

  // Without a key the mode-specific engines are the best answer available.
  if (!raw) {
    if (mode === "scheduler") return reply(schedulerPrompt("offered"), "local", { intent: "scheduling" });
    if (mode === "reminder") return reply(reminderReply(ctx, last), "local", { intent: "formula" });
  }

  // --- 3. Filter what came back ------------------------------------------

  if (raw) {
    if (!leaks(raw)) {
      return reply(raw, "ai", { intent, action, provider: answered!.provider });
    }
    // The model gave away a value the student was meant to reach. Discard it
    // entirely rather than trying to patch it, and answer deterministically.
    return reply(localFallback(ctx, messages, action), "local", {
      intent,
      action,
      filtered: true,
      provider: answered!.provider,
    });
  }

  return reply(localFallback(ctx, messages, action), "local", { intent, action });
}
