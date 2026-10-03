import { NextResponse } from "next/server";
import {
  actionAsWords,
  actionInstruction,
  arithmeticIsStep,
  arithmeticReply,
  arithmeticStepReply,
  classifyIntent,
  CRISIS_REPLY,
  detectCrisisInTurns,
  ESCALATION_OFFER,
  exampleFallback,
  findFormulaCard,
  forbiddenValues,
  formulaCardText,
  isHelperAction,
  isOffTopicRequest,
  modelSignalsCrisis,
  OFF_TOPIC_REPLY,
  parseArithmetic,
  generalReply,
  refuseAnswer,
  reminderReply,
  replyLeaks,
  schedulerPrompt,
  stripEmoji,
  withoutCrisisTurns,
  withoutListMarkers,
  type HelperAction,
  type HelperContext,
  type HelperMessage,
  type HelperMode,
} from "@/lib/helper";
import { buildLocalChatReply, stripMarkdownEmphasis } from "@/lib/tutor";
import { clientKey, helperGroqModels, makeRateLimiter, sessionKey } from "@/lib/ai-provider";
import { archiePersonaPrompt, cleanFirstName } from "@/lib/archie-persona";
import { sanitizeTopics, type InterestTopic } from "@/lib/interests";

/**
 * The helper endpoint.
 *
 * Order matters and is the whole design:
 *
 *   0. A message that sounds like the student is in danger gets a fixed reply
 *      that sends them to people (CRISIS_REPLY), before anything else and
 *      whatever the rate limit says. It never reaches a model.
 *   1. Classify the request. An ask for the answer, a calculation that is a
 *      step of the problem on screen, or an ask to escalate, is answered here
 *      and the model is never called. Nothing a model returns can breach a
 *      rule it was never consulted about.
 *   2. Only then, if a key exists and the caller is inside its budget, ask a
 *      model for a hint.
 *   3. Filter the reply. If it contains a value the student was meant to
 *      derive, throw it away and fall back to the local engine.
 *
 * Who Archie is (lib/archie-persona.ts) only shapes the prompt in step 2: the
 * gates in step 1 and the filter in step 3 do not read it, so a warmer voice
 * cannot loosen either.
 *
 * A quick action ("hint", "example", ...) only shapes the prompt in step 2.
 * The gates in step 1 read the student's words, and the filter in step 3 runs
 * on every reply, so no button is a way around either.
 *
 * With no key configured every branch still works; the replies come from the
 * deterministic engine instead. That is the shipping default.
 */

interface HelperRequest {
  mode?: unknown;
  context?: unknown;
  messages?: unknown;
  action?: unknown;
  /** Optional per-tab key, see sessionKey. */
  session?: unknown;
  /** The student's first name, for Archie to use now and then. Cleaned, or dropped. */
  firstName?: unknown;
  /** The labels of the interests they picked. Cleaned like any topic, at most 6. */
  interests?: unknown;
}

/** What the prompt may know about the student: a first name and up to six interests. */
interface StudentForPrompt {
  firstName?: string | null;
  interests?: InterestTopic[];
}

type Source = "ai" | "local" | "gate";

// --- Limits ------------------------------------------------------------------
//
// Sized for a classroom behind one school IP, not for one student. Past the
// model budget the helper keeps answering from the deterministic engine, so a
// student never sees an error for asking too much; only a flood far past any
// classroom gets a 429. Per instance on serverless, which is enough to stop a
// script using this as a free model proxy. The spending cap itself belongs in
// the provider's own limits.

const WINDOW_MS = 10 * 60 * 1000;
const modelBudgetByIp = makeRateLimiter(300, WINDOW_MS);
const modelBudgetBySession = makeRateLimiter(120, WINDOW_MS);
const floodCapByIp = makeRateLimiter(1200, WINDOW_MS);

/** What the client may send, field by field. Longer text is cut, other types dropped. */
const CONTEXT_LIMITS: Record<keyof HelperContext, number> = {
  skillTitle: 160,
  keyIdea: 600,
  problemPrompt: 1500,
  hint: 600,
  explanation: 3000,
  answer: 200,
};
const MAX_MESSAGES = 20;

/** Words that make a message a request for work, which is what the off-topic redirect is for. */
const ASKS_FOR_WORK =
  /\b(?:help|do|write|type|finish|make|answer|solve|explain|check|fix|edit|proofread|summarize|translate|can you|could you|will you|would you|please|pls|plz|how do|how to|what is|whats)\b/;
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_CHARS = 8000;

function cleanContext(raw: unknown): HelperContext {
  const out: HelperContext = {};
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of Object.keys(CONTEXT_LIMITS) as (keyof HelperContext)[]) {
    const v = key === "answer" && typeof src[key] === "number" && Number.isFinite(src[key]) ? String(src[key]) : src[key];
    if (typeof v === "string" && v.trim()) out[key] = v.slice(0, CONTEXT_LIMITS[key]);
  }
  return out;
}

/** Only roles and text, the newest turns first in line for the budget. */
function cleanMessages(raw: unknown[]): HelperMessage[] {
  const all = raw
    .filter(
      (m): m is HelperMessage =>
        !!m &&
        typeof m === "object" &&
        ((m as HelperMessage).role === "user" || (m as HelperMessage).role === "assistant") &&
        typeof (m as HelperMessage).content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_MESSAGES);
  const kept: HelperMessage[] = [];
  let total = 0;
  for (let i = all.length - 1; i >= 0; i -= 1) {
    total += all[i].content.length;
    if (total > MAX_HISTORY_CHARS && kept.length) break;
    kept.unshift(all[i]);
  }
  return kept;
}

/**
 * Only a real first name and topics that pass the same check as any interest.
 * Anything else a client sends here is dropped, not trusted.
 */
function cleanStudent(body: HelperRequest): StudentForPrompt {
  const firstName = typeof body.firstName === "string" ? cleanFirstName(body.firstName.slice(0, 40)) : null;
  const labels = Array.isArray(body.interests)
    ? body.interests.filter((l): l is string => typeof l === "string").slice(0, 6)
    : [];
  return { firstName, interests: sanitizeTopics(labels.map((label) => ({ label, details: "" }))).slice(0, 6) };
}

/** The house format, after the persona: what the panel can show. */
const FORMAT = `Format: plain text only. No markdown, no asterisks, no headers, no bullet characters, no emoji.
Never use an em dash. Use a comma, a period, or a hyphen.
Write powers with a caret, like x^2.`;

function systemPrompt(
  mode: HelperMode,
  ctx: HelperContext,
  action?: HelperAction,
  avoid: string[] = [],
  student: StudentForPrompt = {}
): string {
  // Formulas and booking have one job each: the same Archie, without the chat.
  if (mode === "reminder") {
    return `${archiePersonaPrompt(student, { lite: true })}
${FORMAT}
You help a student recall a formula. State the formula, then give one concrete way to remember it.
Do not solve any problem for them.`;
  }
  if (mode === "scheduler") {
    return `${archiePersonaPrompt(student, { lite: true })}
${FORMAT}
You are arranging a session with a human tutor. Ask one short question at a time.
Do not teach math here and do not answer any math question.`;
  }
  return `${archiePersonaPrompt(student)}
${FORMAT}
Skill: ${ctx.skillTitle ?? "Algebra 1"}
Key idea: ${ctx.keyIdea ?? "n/a"}
Current problem: ${ctx.problemPrompt ?? "n/a"}
Hint available: ${ctx.hint ?? "n/a"}
Worked solution, for your context only and never to be revealed: ${ctx.explanation ?? "n/a"}

Absolute rule: never state the final answer, and never state an intermediate value the student is working toward.
Numbers already in the problem, in the key idea, and standard unit facts (12 inches in a foot, 60 minutes in an hour) are fine to say.
When they ask for math help, guide with one small next step and end with a question.
If the message is small talk, answer it in one or two friendly sentences and offer to get back to the math. Give a math step only when asked.
If they ask for a fun fact or a joke, keep it short and clean, and only share math facts you are sure are true.
If the student proposes an answer, do not confirm or deny it. Have them check it themselves: substitute it back into an equation, or convert it back to the starting unit on a conversion.
If the student asks for help with something that is not math, say kindly that you help with Algebra 1 and ask what math they are working on.
If the student sounds frustrated, say so in a few kind words before the next step.${
    action
      ? `\n\n${actionInstruction(action, avoid)}${
          action === "example" ? "\nFor this worked example, its own format and length replace the 1 to 4 sentence rule." : ""
        }`
      : ""
  }`;
}

/** A worked example needs room for its steps; everything else stays short. */
function tokenBudget(action?: HelperAction): number {
  return action === "example" ? 700 : 350;
}

/**
 * Groq's free tier is the highest request-per-day allowance of the free
 * options, which matters for a helper every student can open. The model
 * list lives in ai-provider.ts, shared with the status probe.
 */
async function callGroq(
  key: string,
  sys: string,
  msgs: HelperMessage[],
  maxTokens: number
): Promise<{ text: string; model: string }> {
  const errors: string[] = [];
  for (const model of helperGroqModels()) {
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

/**
 * gpt-oss now and then runs on past its reply and writes the next few turns
 * of the conversation as well, glued on with no space: "What do you get when
 * you do that?Got it! What's your next move?Nice work adding 5!...". Its own
 * reply ends at the first such join, so the rest is dropped. The leak filter
 * has already read the whole text by then, so nothing it would catch is lost.
 */
function firstTurnOnly(text: string): string {
  const join = /[a-z0-9)][.!?](?=[A-Z][a-z])/.exec(text);
  return join ? text.slice(0, join.index + 2) : text;
}

/**
 * Em dashes are not house style, and a model will produce them regardless.
 * A dash between two terms of math is a minus sign, though, not a pause:
 * "4x – 5 = 23" used to come out as "4x, 5 = 23".
 */
function stripEmDashes(text: string): string {
  return text
    .replace(/(\b(?:\d+(?:\.\d+)?[a-z]?|[a-z])\b\)?|\))\s*[—–]\s*(?=\(?(?:\d|[a-z]\b))/gi, "$1 - ")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",");
}

function localFallback(ctx: HelperContext, msgs: HelperMessage[], action?: HelperAction): string {
  if (action === "example" && ctx.problemPrompt) return exampleFallback(ctx);
  // Asked for a hint in so many words, the problem's own hint is the honest
  // answer: it is written for this problem. It still has to pass the filter.
  const hintIsClean = !!ctx.hint && !replyLeaks(ctx.hint, ctx);
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
  if (!body?.context || typeof body.context !== "object" || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mode: HelperMode = body.mode === "reminder" || body.mode === "scheduler" ? body.mode : "tutor";
  // Only the roles and text of the conversation, and only the context fields
  // the helper reads, each capped, whatever else a client sends.
  const messages = cleanMessages(body.messages);
  const ctx = cleanContext(body.context);
  // Quick actions shape a tutor's reply. Anything else is ignored, not trusted.
  const action: HelperAction | undefined = mode === "tutor" && isHelperAction(body.action) ? body.action : undefined;
  const userTurns = messages.filter((m) => m.role === "user");
  const last = userTurns[userTurns.length - 1]?.content ?? "";
  const previousUserTurn = userTurns.length > 1 ? userTurns[userTurns.length - 2].content : null;

  const reply = (message: string, source: Source, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ message: stripEmoji(stripEmDashes(stripMarkdownEmphasis(message))).trim(), source, ...extra });

  // --- 0. A student in danger ----------------------------------------------
  //
  // Checked first, in every mode, and before any limit: this reply must never
  // be a 429. Fixed text, so it cannot be wrong the way a model was, and the
  // flag lets the panel show it as more than a chat bubble. The last message
  // is read on its own and joined to the one before it, so a disclosure
  // split in two ("i want to", then "die") is caught too.
  const crisis = detectCrisisInTurns(previousUserTurn, last);
  if (crisis) {
    return reply(CRISIS_REPLY, "gate", { intent: "crisis", crisis: true, kind: crisis });
  }

  const ip = clientKey(request);
  if (!floodCapByIp(ip)) {
    return NextResponse.json(
      { error: "Too many requests", message: "Lots of questions at once from this network. Give it a minute, then try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // --- 1. The hard gates, which never reach a model -----------------------
  //
  // Only the actual rules are gated. Everything else has to be allowed
  // through, or the helper answers from a lookup table and stops listening,
  // which is exactly the complaint a canned reply earns.

  const intent = classifyIntent(last);

  if (intent === "arithmetic") {
    const a = parseArithmetic(last);
    // A step of the problem on screen stays the student's: "5280 x 6" on
    // "Convert 6 miles to feet" is the graded answer, not a side sum.
    if (a && arithmeticIsStep(a, ctx)) return reply(arithmeticStepReply(a), "gate", { intent, refused: true });
    // Otherwise only the number. No working, because the working is the lesson.
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

  // An essay or another subject's homework gets a kind redirect, not a bare
  // "I can't help with that" from a model. Only a request for that work,
  // though: "my art class was fun today" is small talk, and goes through.
  if (mode !== "scheduler" && isOffTopicRequest(last) && ASKS_FOR_WORK.test(last.toLowerCase().replace(/['’]/g, ""))) {
    return reply(OFF_TOPIC_REPLY, "gate", { intent: "off_topic" });
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

  // --- 2. Ask a model, in every mode, within budget ----------------------

  const forbidden = forbiddenValues(ctx);
  const leaks = (text: string) => {
    // List markers are counted out ("1. 2. 3."), not values, so a worked
    // example's step numbers do not trip the filter on a small answer.
    const checked = action === "example" ? withoutListMarkers(text) : text;
    return replyLeaks(checked, ctx, forbidden);
  };

  // A crisis turn earlier in the thread is not passed on to the model.
  const forModel = withoutCrisisTurns(messages);
  const session = sessionKey(request, body.session);
  const withinBudget = modelBudgetByIp(ip) && (!session || modelBudgetBySession(session));
  const student = cleanStudent(body);

  let answered = withinBudget
    ? await askModel(systemPrompt(mode, ctx, action, forbidden, student), forModel, tokenBudget(action))
    : null;
  // A made-up example is full of numbers and can land on a forbidden one by
  // chance. It gets one more try, told again which numbers to stay off.
  if (answered && action === "example" && leaks(answered.text)) {
    const again = await askModel(
      `${systemPrompt(mode, ctx, action, forbidden, student)}\nYour last example used a number from the student's own solution. Pick completely different numbers.`,
      forModel,
      tokenBudget(action)
    );
    if (again) answered = again;
  }
  const raw = answered?.text ?? null;
  const limited = withinBudget ? {} : { limited: true };

  // The model-side crisis net (CRISIS_MODEL_RULE in the persona's hard
  // limits): a disclosure the phrase list missed, in another language say,
  // comes back as the one word CRISIS, and gets the same fixed help.
  if (raw && modelSignalsCrisis(raw)) {
    return reply(CRISIS_REPLY, "gate", { intent: "crisis", crisis: true, kind: "model", provider: answered!.provider });
  }

  // Without a key the mode-specific engines are the best answer available.
  if (!raw) {
    if (mode === "scheduler") return reply(schedulerPrompt("offered"), "local", { intent: "scheduling", ...limited });
    if (mode === "reminder") return reply(reminderReply(ctx, last), "local", { intent: "formula", ...limited });
  }

  // --- 3. Filter what came back ------------------------------------------

  if (raw) {
    if (!leaks(raw)) {
      return reply(firstTurnOnly(raw), "ai", { intent, action, provider: answered!.provider });
    }
    // The model gave away a value the student was meant to reach. Discard it
    // entirely rather than trying to patch it, and answer deterministically.
    return reply(localFallback(ctx, forModel, action), "local", {
      intent,
      action,
      filtered: true,
      provider: answered!.provider,
    });
  }

  return reply(localFallback(ctx, forModel, action), "local", { intent, action, ...limited });
}
