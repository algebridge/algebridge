import { NextResponse } from "next/server";
import { aiConfigured, callJson, clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { modelSignalsCrisis } from "@/lib/helper";
import {
  ASK_SYSTEM,
  CHECK_NUDGE,
  CHECK_NUDGE_DONE,
  CHECK_SYSTEM,
  CONCEPT_SYSTEM,
  DEFAULT_RETRY_AFTER,
  DONE_REPLY,
  HINT_SYSTEM,
  MESSAGES,
  RATE_LIMITS,
  SOLVER_SYSTEM,
  askGate,
  askUser,
  busyMessage,
  checkAnswer,
  checkUser,
  cleanReply,
  conceptUser,
  deterministicConcept,
  deterministicHint,
  ensureQuestion,
  findLeak,
  gateReplyFor,
  guessKind,
  hashProblem,
  hintUser,
  levelFor,
  limitSentences,
  makeSolution,
  makeTally,
  oneQuestion,
  parseSolverOutput,
  providerRetryAfter,
  readReply,
  seal,
  solverUser,
  unseal,
  validateRequest,
  verifySolution,
  type HintResponse,
  type LeakContext,
  type Solution,
  type SolverOutput,
  type Source,
} from "@/lib/extension-hints";

/**
 * The AlgeBridge Hints endpoint, called by the Chrome extension.
 *
 *   1. Validate. An "ask" (or a typed answer to check) that sounds like the
 *      student is in danger gets the fixed crisis reply here, before any
 *      limit, so it is never a 429.
 *      Then rate limit.
 *   2. An "ask" that wants the answer (in English, Spanish, French, German,
 *      Portuguese or Italian), wants what a step produces, offers an answer
 *      to be judged, or tries to change the rules gets a fixed reply here.
 *      The model never sees it.
 *   3. Solve once per problem. The solution travels back to the client sealed
 *      (AES-256-GCM), so the answer never crosses the wire in a form anyone
 *      can read, and later calls for the same problem skip the solver.
 *   4. Reply by action, and pass every model reply through findLeak. A leak
 *      gets one stricter retry, then a deterministic hint instead.
 *
 * Problem text is never logged or stored.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const allowIp = makeRateLimiter(RATE_LIMITS.ip, RATE_LIMITS.windowMs);
const allowInstall = makeRateLimiter(RATE_LIMITS.install, RATE_LIMITS.windowMs);

/*
 * Check my answer is an oracle by design: it says whether a guess is right.
 * Two limits keep it from being a cheap one. Per problem and install: 8 checks
 * per 10 minutes, which an honest student rarely reaches. Per problem and IP:
 * 30, because the install id is chosen by the client and a fresh one resets
 * the first limit. After 3 wrong tries the reply also points back to the hints.
 *
 * The honest limits of this: a scripted attacker on a shared IP (a school, a
 * proxy) or with many IPs is slowed, not stopped, and the limiters live in one
 * server instance. Substituting a guess into the equation by hand gives the
 * same information as a verdict, so the verdict itself is accepted as part of
 * the feature. What it never gives is the answer: a wrong check names the
 * slip, not the value.
 */
const allowCheck = makeRateLimiter(RATE_LIMITS.checks, RATE_LIMITS.windowMs);
const allowCheckIp = makeRateLimiter(RATE_LIMITS.checksPerIp, RATE_LIMITS.windowMs);
const wrongTries = makeTally(RATE_LIMITS.windowMs);

const SOLVER_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const TUTOR_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];

/** Everything has to fit inside maxDuration, with room to answer. */
const BUDGET_MS = 27_000;

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const base: Record<string, string> = { Vary: "Origin", "Cache-Control": "no-store" };
  if (!origin.startsWith("chrome-extension://")) return base;
  return {
    ...base,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

/** Resolves to null when the time runs out. The losing request is left to finish on its own. */
async function within<T>(work: Promise<T>, ms: number): Promise<T | null> {
  if (ms <= 0) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type Clock = () => number;

/**
 * Notes on what happened, sent as a header on the dev server only: which
 * provider answered, why a reply fell back. Never the problem, never the
 * answer. `skips` holds why each model was passed over ("429, retry in
 * 140000 ms"), in every environment, so a 503 can say how long to wait.
 */
type Trace = string[] & { skips?: string[] };
const TRACE_HEADER = "X-AlgeBridge-Trace";
const tracing = () => process.env.NODE_ENV === "development";

function noteSkip(trace: Trace, skips: string[], model: string, why: string): void {
  skips.push(`${model.replace(/^openai\//, "")}:${why}`);
  (trace.skips ??= []).push(why);
}

/** One solver call: the parsed output, "unreadable" when the reply made no sense, "slow" when time ran out, or null when no provider answered. */
async function solve(
  problem: string,
  effort: "medium" | "high",
  retry: boolean,
  budget: number,
  trace: Trace
): Promise<SolverOutput | "unreadable" | "slow" | null> {
  const t0 = Date.now();
  const skips: string[] = [];
  const r = await within(
    callJson({
      system: SOLVER_SYSTEM,
      user: solverUser(problem, retry),
      groqModels: SOLVER_MODELS,
      maxTokens: effort === "high" ? 4000 : 2500,
      temperature: 0.2,
      timeoutMs: Math.max(1000, budget),
      reasoningEffort: effort,
      // A busy minute on the free tier clears in seconds: worth a short wait when a student is waiting on the first hint.
      retryWithinMs: Math.min(6_000, Math.max(0, budget - 6_000)),
      onSkip: (model, why) => noteSkip(trace, skips, model, why),
    }),
    budget
  );
  const ms = Date.now() - t0;
  if (!r) {
    const slow = ms >= budget - 50 || skips.some((x) => /Timeout|Abort/.test(x));
    trace.push(`solve-${effort}:${slow ? "slow" : "none"}:${ms}ms${skips.length ? `[${skips.join(",")}]` : ""}`);
    return slow ? "slow" : null;
  }
  const out = parseSolverOutput(r.text, problem);
  trace.push(`solve-${effort}:${r.provider}:${ms}ms${out ? "" : ":unreadable"}`);
  return out ?? "unreadable";
}

/** Solves, checks the answer against the problem, and re-solves once with more effort when the check fails. */
async function solveAndVerify(problem: string, left: Clock, trace: Trace): Promise<Solution | "not-algebra" | "slow" | null> {
  let first = await solve(problem, "medium", false, Math.min(15_000, left() - 7_000), trace);
  if (first === "unreadable" && left() > 12_000) first = await solve(problem, "high", true, Math.min(12_000, left() - 5_000), trace);
  if (first === "slow") return "slow";
  if (!first || first === "unreadable") return null;
  if (!first.algebra) return "not-algebra";

  let out = first;
  let status = verifySolution(problem, out);
  trace.push(`verify:${status}`);
  if (status === "fail" && left() > 12_000) {
    const again = await solve(problem, "high", true, Math.min(12_000, left() - 5_000), trace);
    if (again && again !== "unreadable" && again !== "slow" && again.algebra) {
      out = again;
      status = verifySolution(problem, again);
      trace.push(`verify:${status}`);
    }
  }
  return makeSolution(problem, out, status === "pass" ? true : status === "fail" ? false : null);
}

async function modelReply(system: string, user: string, budget: number, trace: Trace): Promise<string | null> {
  const t0 = Date.now();
  const skips: string[] = [];
  const r = await within(
    callJson({
      system,
      user,
      groqModels: TUTOR_MODELS,
      maxTokens: 900,
      temperature: 0.5,
      timeoutMs: Math.max(1000, budget),
      reasoningEffort: "low",
      retryWithinMs: Math.min(2_500, Math.max(0, budget - 3_000)),
      onSkip: (model, why) => noteSkip(trace, skips, model, why),
    }),
    budget
  );
  trace.push(`reply:${r ? r.provider : "none"}:${Date.now() - t0}ms${skips.length ? `[${skips.join(",")}]` : ""}`);
  return readReply(r?.text);
}

/**
 * A model reply that passed the leak filter, or the deterministic fallback.
 * One stricter retry after a leak; a provider that gives nothing goes straight
 * to the fallback.
 */
async function guardedReply(
  build: (strict: boolean) => { system: string; user: string },
  ctx: LeakContext,
  question: string | null,
  fallback: () => string,
  left: Clock,
  trace: Trace
): Promise<{ reply: string; source: Source; crisis?: boolean }> {
  if (!aiConfigured() || left() < 3_000) {
    trace.push("fallback:no-time");
    return { reply: fallback(), source: "local" };
  }
  for (const strict of [false, true]) {
    if (strict && left() < 3_500) break;
    const { system, user } = build(strict);
    const raw = await modelReply(system, user, Math.min(8_000, left() - 1_000), trace);
    if (raw === null) break;
    // The model-side crisis net (ASK_SYSTEM): a question the patterns missed,
    // in another language say, comes back as the one word CRISIS.
    if (modelSignalsCrisis(raw)) {
      trace.push("model:crisis");
      return { reply: "", source: "ai", crisis: true };
    }
    // Hints and answers to questions: 1 to 3 sentences ending with a question. Concepts and nudges: up to 4.
    let text = cleanReply(raw);
    if (text && question) text = oneQuestion(limitSentences(/\?\s*$/.test(text) ? text : ensureQuestion(cleanReply(raw, 2), question), 3));
    const leak = text ? findLeak(text, ctx) : "empty";
    if (!leak) return { reply: text, source: "ai" };
    trace.push(`leak:${leak}`);
  }
  trace.push("fallback");
  return { reply: fallback(), source: "local" };
}

export async function POST(request: Request) {
  const started = Date.now();
  const left: Clock = () => BUDGET_MS - (Date.now() - started);
  const trace: Trace = [];
  const send = (body: unknown, status = 200) => {
    const headers: Record<string, string> = cors(request);
    if (tracing() && trace.length) headers[TRACE_HEADER] = trace.join(" ").slice(0, 900);
    return NextResponse.json(body, { status, headers });
  };
  const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
    send({ error, message, ...extra }, status);
  // No provider answered: a short message and an honest wait, the provider's own when it gave one.
  const busy = () => {
    const wait = providerRetryAfter(trace.skips ?? []) ?? DEFAULT_RETRY_AFTER;
    return fail(503, "no-model", busyMessage(wait), { retryAfter: wait });
  };
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail(400, "bad-request", MESSAGES.badRequest);
    }
    const valid = validateRequest(body);
    if (!valid.ok) return fail(400, "bad-request", valid.message);
    const req = valid.req;

    // A student who may be in danger: the fixed reply (a trusted adult, 988,
    // the Crisis Text Line, 911), before any limit and with no model. The
    // words are not logged or kept. A question is read by askGate; an answer
    // typed into Check my answer is read too, since a student in trouble may
    // type it wherever there is a box.
    const typed = req.action === "ask" ? req.question ?? "" : req.action === "check" ? req.answer ?? "" : "";
    if ((req.action === "ask" && askGate(typed, req.problem) === "crisis") || (req.action === "check" && askGate(typed, "") === "crisis")) {
      trace.push("gate:crisis");
      const known = unseal(req.sealed, req.problem);
      const kind = known?.kind ?? guessKind(req.problem);
      const out: HintResponse = {
        reply: gateReplyFor("crisis"),
        sealed: known ? (req.sealed as string) : "",
        step: -1,
        steps: known?.steps.length ?? 0,
        done: known ? req.hints.length >= known.steps.length : false,
        kind,
        level: known?.level ?? levelFor(kind, req.problem),
        source: "gate",
        crisis: true,
      };
      return send(out);
    }

    // Vercel sets x-vercel-forwarded-for itself and overwrites any client-sent X-Forwarded-For
    // (https://vercel.com/docs/headers/request-headers), so on production this key cannot be forged.
    // A local dev server trusts the header, which is fine for development.
    const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || clientKey(request);
    if (!allowIp(ip) || !allowInstall(req.install)) {
      return fail(429, "rate", MESSAGES.rate, { retryAfter: 60 });
    }

    let sol = unseal(req.sealed, req.problem);
    let sealed = sol ? (req.sealed as string) : "";
    const hintsShown = req.hints.length;

    // The answer gate. Nothing past this line runs for a question that wants
    // the answer or a step's result, offers an answer to be judged, or tries
    // to change the rules.
    const gate = req.action === "ask" ? askGate(req.question ?? "", req.problem) : null;
    if (gate) {
      trace.push(`gate:${gate}`);
      const kind = sol?.kind ?? guessKind(req.problem);
      const out: HintResponse = {
        reply: gateReplyFor(gate),
        sealed,
        step: -1,
        steps: sol?.steps.length ?? 0,
        done: sol ? hintsShown >= sol.steps.length : false,
        kind,
        level: sol?.level ?? levelFor(kind, req.problem),
        source: "gate",
      };
      return send(out);
    }

    const problemHash = hashProblem(req.problem);
    if (req.action === "check" && (!allowCheck(`${problemHash}:${req.install}`) || !allowCheckIp(`${problemHash}:${ip}`))) {
      return fail(429, "rate", MESSAGES.checkRate, { retryAfter: 300 });
    }

    const model = aiConfigured();
    if (!sol) {
      if (!model) return busy();
      const solved = await solveAndVerify(req.problem, left, trace);
      if (solved === "not-algebra") return fail(422, "not-algebra", MESSAGES.notAlgebra);
      // Out of time: still a 503 for the client, with words that say so, well inside its 30 second wait.
      if (solved === "slow") return fail(503, "no-model", MESSAGES.slow, { retryAfter: 5 });
      if (!solved) return busy();
      sol = solved;
      sealed = seal(sol);
    } else if (req.action === "ask" && !model) {
      return busy();
    }

    const solution = sol;
    const total = solution.steps.length;
    const base = { sealed, steps: total, kind: solution.kind, level: solution.level };
    const reply = (r: string, extra: Partial<HintResponse> & { source: Source }): HintResponse => ({
      // Deterministic check replies run to a note, a fix and the advice; nothing gets cut.
      reply: cleanReply(r, 8),
      step: -1,
      done: hintsShown >= total,
      ...base,
      ...extra,
    });

    switch (req.action) {
      case "first":
      case "next": {
        const i = req.action === "first" ? 0 : hintsShown;
        const shown = req.action === "first" ? [] : req.hints;
        if (i >= total) return send(reply(DONE_REPLY, { source: "local", done: true }));
        const ctx: LeakContext = { problem: req.problem, solution, step: i, shown, mode: "hint" };
        const r = await guardedReply(
          (strict) => ({ system: HINT_SYSTEM, user: hintUser(req.problem, solution, i, shown, strict) }),
          ctx,
          "What do you get?",
          () => deterministicHint(ctx, solution.kind),
          left,
          trace
        );
        return send(reply(r.reply, { source: r.source, step: i, done: i + 1 >= total }));
      }

      case "concept": {
        const ctx: LeakContext = { problem: req.problem, solution, step: hintsShown, shown: req.hints, mode: "concept" };
        const r = await guardedReply(
          (strict) => ({ system: CONCEPT_SYSTEM, user: conceptUser(req.problem, solution, req.hints, strict) }),
          ctx,
          null,
          () => deterministicConcept(ctx, solution),
          left,
          trace
        );
        return send(reply(r.reply, { source: r.source }));
      }

      case "check": {
        const answer = req.answer as string;
        const result = checkAnswer(req.problem, solution, answer);
        if (result.verdict === "correct") {
          return send(reply(result.reply, { source: "local", verdict: "correct" }));
        }
        // Mode "check": no step's result may appear, earlier steps included, and no number the student has not seen.
        const ctx: LeakContext = { problem: req.problem, solution, step: 0, shown: req.hints, allow: [answer], mode: "check" };
        let text = result.reply;
        let source: Source = "local";
        if (result.verdict === "incorrect" && result.needsNudge && model && left() > 4_000) {
          const r = await guardedReply(
            (strict) => ({ system: CHECK_SYSTEM, user: checkUser(req.problem, solution, answer, strict) }),
            ctx,
            null,
            () => "",
            left,
            trace
          );
          if (r.source === "ai" && r.reply) {
            text = `${r.reply.replace(/[.!?]*$/, ".")} ${result.advice}`;
            source = "ai";
          }
        }
        if (findLeak(text, ctx)) {
          text = `That answer needs another look. ${result.advice}`;
          source = "local";
        }
        // Three wrong tries on one problem: still answered, and pointed back to the hints.
        const key = `${problemHash}:${req.install}`;
        const wrong = result.verdict === "incorrect" ? wrongTries.add(key) : wrongTries.count(key);
        if (wrong >= RATE_LIMITS.wrongBeforeNudge) text = `${text} ${hintsShown < total ? CHECK_NUDGE : CHECK_NUDGE_DONE}`;
        return send(reply(text, { source, verdict: result.verdict }));
      }

      case "ask": {
        const ctx: LeakContext = { problem: req.problem, solution, step: hintsShown, shown: req.hints, mode: "ask", echo: [req.question ?? ""] };
        const r = await guardedReply(
          (strict) => ({ system: ASK_SYSTEM, user: askUser(req.problem, solution, req.hints, req.question ?? "", strict) }),
          ctx,
          "What would you try next?",
          () => (hintsShown < total ? deterministicHint(ctx, solution.kind) : DONE_REPLY),
          left,
          trace
        );
        // The same fixed reply and flag as the code gate above.
        if (r.crisis) return send({ ...reply(gateReplyFor("crisis"), { source: "gate", crisis: true }), reply: gateReplyFor("crisis") });
        return send(reply(r.reply, { source: r.source }));
      }
    }
    return fail(400, "bad-request", MESSAGES.badRequest);
  } catch {
    // No detail is logged: the request carries a student's problem text.
    return fail(503, "no-model", busyMessage(DEFAULT_RETRY_AFTER), { retryAfter: DEFAULT_RETRY_AFTER });
  }
}
