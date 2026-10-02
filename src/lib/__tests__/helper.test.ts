import { registerHooks } from "node:module";
import {
  classifyIntent, parseArithmetic, arithmeticReply, forbiddenValues,
  leaksAnswer, advanceScheduler, isYes, isNo,
  isHelperAction, actionInstruction, actionAsWords, findFormulaCard, reminderReply,
  withoutListMarkers, stripEmoji, HELPER_ACTIONS, BOOKING_INTRO, FORMULA_CARDS,
} from "../helper.ts";

// The work check and the route import app code by "@/..." and without file
// extensions, the way Next resolves it. alias.mjs teaches node the same; it
// has to be loaded before those modules are, so they are imported below.
await import("./alias.mjs");
// "next/server" has no exports map, so plain ESM resolution needs the file name.
registerHooks({
  resolve(spec, ctx, next) {
    return next(spec === "next/server" ? "next/server.js" : spec, ctx);
  },
});

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; } else { fail++; console.log("  FAIL:", name, extra); }
};

// --- the student must never be handed the answer -------------------------
for (const q of [
  "what's the answer", "just tell me the answer", "give me the answer",
  "solve it for me", "do this for me", "what does x equal",
  "please show me the solution", "answer this",
]) ok(`refuses: "${q}"`, classifyIntent(q) === "answer_request", `-> ${classifyIntent(q)}`);

// --- the arithmetic exception, and only that ------------------------------
for (const [q, expected] of [
  ["what is 4728 / 12", "4728 / 12 = 394"],
  ["347 x 89", "347 x 89 = 30883"],
  ["1024 divided by 32", "1024 / 32 = 32"],
  ["what's 96 times 45", "96 x 45 = 4320"],
] as const) {
  const a = parseArithmetic(q);
  ok(`computes: "${q}"`, !!a && arithmeticReply(a) === expected, `-> ${a ? arithmeticReply(a) : "null"}`);
}

// times tables and non-arithmetic stay teaching moments
for (const q of ["what is 7 x 8", "12 times 12", "solve 2x + 3 = 11", "what is 5 + 9",
                 "what is x / 4", "144 / 12"])
  ok(`does not compute: "${q}"`, parseArithmetic(q) === null, `-> ${JSON.stringify(parseArithmetic(q))}`);

// --- the post-filter catches a model that leaks --------------------------
const ctx = { problemPrompt: "Solve 3x + 6 = 27", explanation: "Subtract 6 to get 3x = 21, then divide by 3 so x = 7." };
const forbidden = forbiddenValues(ctx);
ok("forbidden excludes numbers already in the problem", !forbidden.includes("3") && !forbidden.includes("6") && !forbidden.includes("27"), JSON.stringify(forbidden));
ok("forbidden includes the solution", forbidden.includes("7") && forbidden.includes("21"), JSON.stringify(forbidden));
ok("blocks a leaking reply", leaksAnswer("Nice work, x = 7 is right.", forbidden));
ok("blocks the intermediate too", leaksAnswer("So you get 3x = 21.", forbidden));
ok("allows a clean reply", !leaksAnswer("Undo the +6 first. What do both sides become?", forbidden));
ok("does not trip on a substring", !leaksAnswer("Try problem 70 next.", forbidden), "70 must not match 7");

// decimal boundaries must survive the fix
ok("does not trip inside a decimal", !leaksAnswer("about 3.21 units", forbidden), "3.21 must not match 21");
ok("still blocks a bare decimal answer", leaksAnswer("you get 7, done", forbidden));
ok("blocks at end of string", leaksAnswer("the value is 21", forbidden));

// --- the booking conversation --------------------------------------------
ok("yes", isYes("yeah") && isYes("Sure") && !isYes("nope"));
ok("no", isNo("no thanks") && isNo("nah") && !isNo("yes"));
let s = advanceScheduler({ step: "offered" }, "yes");
ok("offered -> awaiting_time", s.step === "awaiting_time");
s = advanceScheduler(s, "Tuesday after 4");
ok("captures the time", s.step === "awaiting_tutor" && s.freeText === "Tuesday after 4", JSON.stringify(s));
s = advanceScheduler(s, "Zachary");
ok("captures the tutor", s.step === "done" && s.tutorName === "Zachary", JSON.stringify(s));
const anyone = advanceScheduler({ step: "awaiting_tutor" }, "anyone");
ok("anyone leaves it unassigned", anyone.step === "done" && anyone.tutorName === undefined, JSON.stringify(anyone));
ok("declining stops it", advanceScheduler({ step: "offered" }, "no thanks").step === "declined");

// --- escalation ----------------------------------------------------------
for (const q of ["i still don't get it", "can i talk to a person", "i need a tutor",
                 "this isn't helping", "i'm completely lost", "i need more help"])
  ok(`escalates: "${q}"`, classifyIntent(q) === "escalate", `-> ${classifyIntent(q)}`);

// --- quick actions ---------------------------------------------------------
ok("every action is recognised", HELPER_ACTIONS.every((a) => isHelperAction(a)));
for (const bad of ["answer", "solve", "", null, 3, "HINT"])
  ok(`rejects action ${JSON.stringify(bad)}`, !isHelperAction(bad));
for (const a of HELPER_ACTIONS) {
  const text = actionInstruction(a, ["7", "21"]);
  ok(`action ${a} has an instruction`, text.length > 40);
  ok(`action ${a} has no em dash`, !/—/.test(text));
  ok(`action ${a} speaks to the local engine`, actionAsWords(a).length > 3);
}
ok("example names the numbers to stay off", actionInstruction("example", ["7", "21"]).includes("7, 21"));
ok("example asks for a new problem worked fully", /NEW problem/.test(actionInstruction("example")) && /numbered/.test(actionInstruction("example")));
ok("another way asks for a different explanation", /differently/.test(actionInstruction("another-way")));
ok("chip labels are not answer requests",
  ["Give me a hint", "What's the first step?", "Explain the key idea", "Show a similar example",
   "Explain it another way", "Next step", "How do I start a problem?", "Can you explain a topic?"]
    .every((q) => classifyIntent(q) !== "answer_request" && classifyIntent(q) !== "escalate"));

// --- list markers and the leak filter --------------------------------------
const example = "Here is a similar one: 4x + 2 = 18.\n1. Subtract 2 from both sides.\n2. Divide both sides by 4.\n3. So x = 4.\nNow try the same steps on yours.";
ok("list markers come off", !/^\s*[123]\. /m.test(withoutListMarkers(example)));
ok("a step number does not leak a small answer", !leaksAnswer(withoutListMarkers("1. Subtract 6.\n2. Divide both sides.\n3. Check it."), ["2", "3"]));
ok("without the markers removed it would have", leaksAnswer("1. Subtract 6.\n2. Divide both sides.", ["2"]));
ok("a value inside a step still leaks", leaksAnswer(withoutListMarkers("1. Subtract 6.\n2. That gives 21."), ["21"]));
ok("only markers that count up are removed", withoutListMarkers("1. First.\n7. not a marker") === "First.\n7. not a marker");

// --- emoji -------------------------------------------------------------------
ok("emoji are stripped", stripEmoji("Hey! I'm your Bridge Tutor. \u{1F44B} Tell me") === "Hey! I'm your Bridge Tutor. Tell me", JSON.stringify(stripEmoji("Hey! I'm your Bridge Tutor. \u{1F44B} Tell me")));
ok("math symbols survive", stripEmoji("x ≤ 4, 3 × 2, √9, ±2") === "x ≤ 4, 3 × 2, √9, ±2");

// --- formula cards -------------------------------------------------------------
ok("slope-intercept is its own card", findFormulaCard("Slope-intercept form")?.formula === "y = mx + b");
ok("point-slope is its own card", findFormulaCard("point-slope form")?.formula === "y - y1 = m(x - x1)");
ok("slope alone is rise over run", findFormulaCard("Slope between two points")?.name === "Slope between two points");
ok("a bare word still finds a card", findFormulaCard("whats the quadratic formula again")?.name === "The quadratic formula");
ok("every chip name finds its own card", FORMULA_CARDS.every((f) => findFormulaCard(f.name) === f));
ok("nothing matches nonsense", findFormulaCard("bananas") === null);
ok("reminderReply uses the right card", reminderReply({}, "slope intercept form").includes("y = mx + b"));
ok("booking intro keeps the offer phrase", BOOKING_INTRO.includes("set you up with one of our tutors"));

// ===========================================================================
// Check my work
// ===========================================================================

const W = await import("../work-check.ts");
const kinds = (lines: string[]) => W.checkWork(lines).map((m) => m.kind).join(",");
const step = (a: string, b: string) => W.compareLines(a, b);
const expect = (name: string, lines: string[], want: string) => {
  const got = kinds(lines);
  ok(name, got === want, `-> ${got}, wanted ${want}`);
};

// linear
expect("linear, two good steps", ["3x + 6 = 27", "3x = 21", "x = 7"], "start,same,final");
expect("linear, wrong subtraction", ["3x + 6 = 27", "3x = 33"], "start,changed");
expect("linear, divide with x on both sides", ["5x - 4 = 3x + 8", "2x - 4 = 8", "2x = 12"], "start,same,same");
// distributing
expect("distributing right", ["3(x + 2) = 15", "3x + 6 = 15"], "start,same");
expect("distributing, dropped term", ["3(x + 2) = 15", "3x + 2 = 15"], "start,changed");
expect("distributing a negative", ["-2(x - 4) = 10", "-2x + 8 = 10"], "start,same");
expect("distributing a negative, wrong sign", ["-2(x - 4) = 10", "-2x - 8 = 10"], "start,changed");
// fractions
expect("clearing fractions", ["x/2 + x/3 = 5", "3x + 2x = 30", "5x = 30"], "start,same,same");
expect("clearing fractions, one side missed", ["x/2 + x/3 = 5", "3x + 2x = 5"], "start,changed");
expect("a fraction coefficient", ["(2/3)x = 8", "2x = 24"], "start,same");
// moving terms
expect("moving terms across", ["2x + 3 = x - 4", "2x - x = -4 - 3"], "start,same");
expect("moving a term, wrong sign", ["2x + 3 = 11", "2x = 11 + 3"], "start,changed");
expect("sides swapped is the same", ["2x + 3 = 11", "11 = 2x + 3"], "start,same");
// inequalities
expect("inequality, adding", ["x + 4 > 9", "x > 9 - 4 + 0x"], "start,same");
ok("inequality flip when dividing by a negative, done right", step("-2(x - 1) < 8", "x - 1 > -4").kind === "same");
const missed = step("-2(x - 1) < 8", "x - 1 < -4");
ok("inequality flip missed is flagged", missed.kind === "changed", JSON.stringify(missed));
ok("the flag points at the sign", missed.note === W.NOTES.changedSign, missed.note);
ok("flip when multiplying by a negative", step("-x/3 >= 2", "-x >= 6").kind === "same" && step("-x >= 6", "x + 0x <= -6").kind === "same");
ok("a flipped sign that was not needed is flagged", step("3x + 1 < 7", "3x > 6").kind === "changed");
ok("a compound inequality", step("-3 < 2x + 1 <= 7", "-4 < 2x <= 6").kind === "same");
ok("a compound inequality, one end wrong", step("-3 < 2x + 1 <= 7", "-2 < 2x <= 6").kind === "changed");
// quadratics in factored form
expect("factored form to two equations", ["(x - 2)(x + 3) = 0", "x - 2 = 0 or x + 3 = 0", "x = 2 or x = -3"], "start,same,final");
expect("factored form expanded", ["(x - 2)(x + 3) = 0", "x^2 + x - 6 = 0"], "start,same");
expect("factored form, wrong sign", ["(x - 2)(x + 3) = 0", "x^2 - x - 6 = 0"], "start,changed");
expect("factoring a trinomial", ["x^2 + 7x + 12 = 0", "(x + 3)(x + 4) = 0"], "start,same");
expect("factoring a trinomial, wrong pair", ["x^2 + 7x + 12 = 0", "(x + 2)(x + 6) = 0"], "start,changed");
expect("a double root", ["x^2 - 6x + 9 = 0", "(x - 3)^2 = 0"], "start,same");
expect("dividing by x loses a root", ["x^2 = 5x", "x = 5 + 0x"], "start,changed");
// expressions
expect("simplifying an expression", ["3(x + 2) - x", "3x + 6 - x", "2x + 6"], "start,same,same");
expect("simplifying, wrong", ["3(x + 2) - x", "3x + 2 - x"], "start,changed");
ok("an expression step says equal, not answer", step("3(x + 2) - x", "2x + 6").note === W.NOTES.sameExpr);
ok("a wrong expression step says not equal", step("3(x + 2) - x", "2x + 2").note === W.NOTES.changedExpr);
expect("an expression under an equation cannot be compared", ["2x + 3 = 11", "2x + 3"], "start,mismatch");
// two letters
expect("rearranging a line", ["y - 3 = 2(x - 1)", "y = 2x + 1"], "start,same");
expect("rearranging a line, wrong intercept", ["y - 3 = 2(x - 1)", "y = 2x - 1"], "start,changed");
// unreadable lines
expect("an unfinished line", ["2x + 3 = 11", "2x +", "2x = 8"], "start,unreadable,same");
expect("words are unreadable", ["2x + 3 = 11", "then i subtract three"], "start,unreadable");
expect("a lead-in word is fine", ["2x + 3 = 11", "so 2x = 8"], "start,same");
expect("a sentence with an equation in it is unreadable", ["2x + 3 = 11", "subtract 3 so 2x = 8"], "start,unreadable");
expect("empty lines are skipped", ["2x + 3 = 11", "", "2x = 8"], "start,empty,same");
ok("unreadable note is plain", step("2x + 3 = 11", "2x + = ").note === W.NOTES.unreadable);
// final values are never judged, right or wrong
expect("a right final value is not judged", ["2x + 3 = 11", "x = 4"], "start,final");
expect("a wrong final value is not judged either", ["2x + 3 = 11", "x = 5"], "start,final");
expect("a bare number is final", ["2x + 3 = 11", "4"], "start,final");
expect("an inequality answer is final", ["-2x < 6", "x > -3"], "start,final");
expect("a wrong inequality answer is not judged", ["-2x < 6", "x < -3"], "start,final");
expect("a list of roots is final", ["(x - 2)(x + 3) = 0", "x = 2, -3"], "start,final");
expect("a check with numbers is not judged", ["2x + 3 = 11", "2(4) + 3 = 11"], "start,final");
expect("words for an answer are final", ["2x + 3 = 2x + 5", "no solution"], "start,final");
ok("final note sends them to the answer box", step("2x + 3 = 11", "x = 4").note === W.NOTES.final);
for (const l of ["x = 4", "4 = x", "x = 8/2", "x > 3", "-1 < x <= 4", "all real numbers", "(2, -1)", "5 * 5280"])
  ok(`looks final: ${l}`, W.looksFinal(l));
for (const l of ["2x = 8", "y = 2x + 1", "x - 2 = 0 or x + 3 = 0", "2x > 8", "x^2 = 9", "x"])
  ok(`not final: ${l}`, !W.looksFinal(l));
// after an answer line, the next step is still compared with the last real step
expect("an answer in the middle does not reset the chain", ["2x + 3 = 11", "x = 4", "2x = 8"], "start,final,same");
// notes are house style
for (const n of Object.values(W.NOTES)) ok(`note has no em dash: ${n.slice(0, 24)}`, !/—/.test(n));
// the starting line
ok("start line from a solve problem", W.startingLine("Solve for x: 3x + 6 = 27") === "3x + 6 = 27", W.startingLine("Solve for x: 3x + 6 = 27"));
ok("start line from an inequality", W.startingLine("Solve -2x + 1 < 7.") === "-2x + 1 < 7");
ok("start line from a simplify problem", W.startingLine("Simplify 3(x + 2) - x.") === "3(x + 2) - x");
ok("no start line for a unit conversion", W.startingLine("Convert 5 miles to feet. (1 mile = 5280 ft)") === "");
ok("no start line for plain words", W.startingLine("Which quadrant is the point in?") === "");

// ===========================================================================
// The route: actions shape the prompt, never the gates
// ===========================================================================

delete process.env.GROQ_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_MODEL;
const R = await import("../../app/api/helper/route.ts");
const call = async (body: unknown) => (await (await R.POST(new Request("http://x/api/helper", { method: "POST", body: JSON.stringify(body) }))).json()) as Record<string, unknown>;
const solveCtx = { skillTitle: "Two-step equations", keyIdea: "Undo the operations in reverse order.", problemPrompt: "Solve 3x + 6 = 27", hint: "Subtract 6 from both sides first.", explanation: "3x = 21, so x = 7.", answer: "7" };

// no key: every action still answers, from the local engine, with no emoji
for (const a of HELPER_ACTIONS) {
  const r = await call({ mode: "tutor", action: a, context: solveCtx, messages: [{ role: "user", content: "Give me a hint" }] });
  const msg = String(r.message ?? "");
  ok(`no key, ${a} answers`, msg.length > 10 && r.source === "local", JSON.stringify(r));
  ok(`no key, ${a} does not leak`, !leaksAnswer(msg, forbiddenValues(solveCtx)), msg);
  ok(`no key, ${a} has no emoji`, !/\p{Extended_Pictographic}/u.test(msg), msg);
}
const hinted = await call({ mode: "tutor", action: "hint", context: solveCtx, messages: [{ role: "user", content: "Give me a hint" }] });
ok("no key, a hint request gets the problem's own hint", String(hinted.message).includes("Subtract 6 from both sides first."), String(hinted.message));
const leakyHint = await call({ mode: "tutor", action: "hint", context: { ...solveCtx, hint: "Subtract 6 to get 3x = 21." }, messages: [{ role: "user", content: "Give me a hint" }] });
ok("a hint that would leak is not quoted", !leaksAnswer(String(leakyHint.message), forbiddenValues(solveCtx)), String(leakyHint.message));
const hello = await call({ mode: "tutor", context: solveCtx, messages: [{ role: "user", content: "hi" }] });
ok("the local greeting loses its emoji", !/\p{Extended_Pictographic}/u.test(String(hello.message)), String(hello.message));
ok("the local greeting is Archie", /\bArchie\b/.test(String(hello.message)) && !/Bridge Tutor/.test(String(hello.message)), String(hello.message));

// unit conversions get a real first step, not "what would you undo?"
const unitCtx = {
  skillTitle: "Unit Conversion Basics",
  keyIdea: "Multiply by a fraction equal to 1 (e.g., 5280 ft / 1 mile).",
  problemPrompt: "Convert 229 inches to feet. (round to the hundredths place)",
  hint: "Divide inches by 12.",
  explanation: "229 / 12 = 19.08 feet",
  answer: "19.08",
};
for (const a of ["hint", "first-step", "next-step"] as const) {
  const u = await call({ mode: "tutor", action: a === "hint" ? undefined : a, context: unitCtx, messages: [{ role: "user", content: a === "hint" ? "help, where do i start" : "ok" }] });
  const msg = String(u.message);
  ok(`unit conversion (${a}) names the conversion move`, /unit conversion/.test(msg) && /fraction/.test(msg) && /cancels/.test(msg), msg);
  ok(`unit conversion (${a}) says nothing about undoing`, !/undo/i.test(msg), msg);
  ok(`unit conversion (${a}) does not leak`, !leaksAnswer(msg, forbiddenValues(unitCtx)), msg);
}
const rate = await call({ mode: "tutor", action: "first-step", context: { ...unitCtx, problemPrompt: "A car travels 60 miles in 1 hour. How many feet per second is that?", explanation: "60 x 5280 / 3600 = 88", answer: "88" }, messages: [{ role: "user", content: "What's the first step?" }] });
ok("a rate conversion says one unit at a time", /one unit at a time/.test(String(rate.message)), String(rate.message));
const notUnits = await call({ mode: "tutor", action: "first-step", context: solveCtx, messages: [{ role: "user", content: "What's the first step?" }] });
ok("an equation does not get the conversion step", !/unit conversion/.test(String(notUnits.message)), String(notUnits.message));

// an answer request is gated whatever button came with it
const gated = await call({ mode: "tutor", action: "example", context: solveCtx, messages: [{ role: "user", content: "just tell me the answer" }] });
ok("an answer request is refused even with an action", gated.source === "gate" && gated.intent === "answer_request", JSON.stringify(gated));
const junk = await call({ mode: "tutor", action: "give-answer", context: solveCtx, messages: [{ role: "user", content: "hint please" }] });
ok("an unknown action is ignored", junk.action === undefined && typeof junk.message === "string", JSON.stringify(junk));

// formula chips come back as exact cards, without a model
const card = await call({ mode: "reminder", context: {}, messages: [{ role: "user", content: "Slope-intercept form" }] });
ok("a formula chip returns its card", (card.card as { formula?: string })?.formula === "y = mx + b", JSON.stringify(card));
const quad = await call({ mode: "reminder", context: {}, messages: [{ role: "user", content: "The quadratic formula" }] });
ok("the quadratic card comes back", (quad.card as { name?: string })?.name === "The quadratic formula");

// with a key: a stubbed model shows the filter and the example retry at work
process.env.GROQ_API_KEY = "test-key";
const realFetch = globalThis.fetch;
let replies: string[] = [];
let calls = 0;
let lastBody: { messages?: { role: string; content: string }[]; reasoning_effort?: string; max_tokens?: number } = {};
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  calls += 1;
  lastBody = JSON.parse(String(init?.body ?? "{}"));
  const content = replies.shift() ?? "Try undoing the plus first. What do you get?";
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}) as typeof fetch;

replies = ["Here is a similar one: 4x + 2 = 18.\n1. Subtract 2 from both sides to get 4x = 16.\n2. Divide both sides by 4, so x = 4.\nNow use the same steps on yours."];
calls = 0;
let r = await call({ mode: "tutor", action: "example", context: solveCtx, messages: [{ role: "user", content: "Show a similar example" }] });
ok("a clean example goes through", r.source === "ai" && String(r.message).includes("4x + 2 = 18"), JSON.stringify(r));
ok("the model speaks as Archie, an AI", /You are Archie/.test(lastBody.messages?.[0]?.content ?? "") && /an AI, not a person/.test(lastBody.messages?.[0]?.content ?? ""));
ok("the example prompt carries the action", (lastBody.messages?.[0]?.content ?? "").includes("NEW problem"));
ok("the example names the numbers to avoid", (lastBody.messages?.[0]?.content ?? "").includes("21, 7") || (lastBody.messages?.[0]?.content ?? "").includes("7"));
ok("the example gets room for its steps", (lastBody.max_tokens ?? 0) >= 600, String(lastBody.max_tokens));
ok("gpt-oss runs at low effort", lastBody.reasoning_effort === "low", String(lastBody.reasoning_effort));
ok("one call for a clean example", calls === 1, String(calls));

replies = ["Here is one: 2x + 7 = 21.\n1. Subtract 7.\n2. Divide by 2, so x = 7.", "Here is one: 5x + 1 = 11.\n1. Subtract 1 to get 5x = 10.\n2. Divide by 5, so x = 2."];
calls = 0;
r = await call({ mode: "tutor", action: "example", context: solveCtx, messages: [{ role: "user", content: "Show a similar example" }] });
ok("a leaking example is tried once more", calls === 2 && r.source === "ai" && String(r.message).includes("5x + 1 = 11"), JSON.stringify(r));

replies = ["Here is one: 2x + 7 = 21, so x = 7.", "Another: 3x = 21, so x = 7."];
calls = 0;
r = await call({ mode: "tutor", action: "example", context: solveCtx, messages: [{ role: "user", content: "Show a similar example" }] });
ok("an example that leaks twice falls back", calls === 2 && r.source === "local" && r.filtered === true, JSON.stringify(r));
ok("the fallback does not leak", !leaksAnswer(String(r.message), forbiddenValues(solveCtx)), String(r.message));

replies = ["Nice, so x = 7 and you are done."];
r = await call({ mode: "tutor", action: "hint", context: solveCtx, messages: [{ role: "user", content: "Give me a hint" }] });
ok("a leaking hint is replaced", r.source === "local" && r.filtered === true && !leaksAnswer(String(r.message), forbiddenValues(solveCtx)), JSON.stringify(r));

replies = ["Think of the equation as a balance — whatever you do to one side, do to the other. \u{1F642} What comes off first?"];
r = await call({ mode: "tutor", action: "another-way", context: solveCtx, messages: [{ role: "user", content: "Give me a hint" }, { role: "assistant", content: "Undo the +6 first." }, { role: "user", content: "Explain it another way" }] });
ok("another way is house style", !/—/.test(String(r.message)) && !/\p{Extended_Pictographic}/u.test(String(r.message)), String(r.message));
ok("another way prompt asks for a new angle", (lastBody.messages?.[0]?.content ?? "").includes("another way"));

calls = 0;
r = await call({ mode: "tutor", action: "hint", context: solveCtx, messages: [{ role: "user", content: "what's the answer" }] });
ok("the gate holds with a key and an action", r.source === "gate" && calls === 0, JSON.stringify(r));

calls = 0;
r = await call({ mode: "reminder", context: {}, messages: [{ role: "user", content: "Exponent rules" }] });
ok("a formula card costs no model call", calls === 0 && !!r.card, JSON.stringify(r));

globalThis.fetch = realFetch;
delete process.env.GROQ_API_KEY;

// ===========================================================================
// Archie: his own lines, and the sidebar he lives in
// ===========================================================================

const L = await import("../../components/archie/lines.ts");
for (const line of L.ALL_LINES) {
  ok(`line has no em dash: ${line}`, !/[—–]/.test(line));
  ok(`line has no emoji: ${line}`, !/\p{Extended_Pictographic}/u.test(line));
  // One short line, so it fits beside him at the narrowest sidebar width.
  ok(`line is short: ${line}`, line.length <= 32, String(line.length));
}
for (const line of L.WRONG_LINES)
  ok(`a miss line makes no claim about the answer: ${line}`, !/\b(close|almost|nearly|answer is)\b/i.test(line));
ok("greeting by first name", L.greeting("Maya") === "Hi Maya, I'm Archie.");
ok("greeting without a name", L.greeting(null) === "Hi, I'm Archie." && L.greeting("  ") === "Hi, I'm Archie.");
ok("streak line at three", L.reactionLine("correct", 3, []) === L.STREAK_LINES[3]);
ok("no streak line on a miss", (L.WRONG_LINES as readonly string[]).includes(L.reactionLine("wrong", 3, [])));
ok("a plain correct line otherwise", (L.CORRECT_LINES as readonly string[]).includes(L.reactionLine("correct", 2, [])));
{
  // Never the same line twice running, over many draws.
  let prev: string[] = [];
  let repeats = 0;
  for (let i = 0; i < 200; i += 1) {
    const l = L.reactionLine(i % 3 ? "correct" : "wrong", 1, prev);
    if (prev.includes(l)) repeats += 1;
    prev = [l, ...prev].slice(0, 2);
  }
  ok("lines do not repeat back to back", repeats === 0, String(repeats));
}
ok("pickLine falls back when every line was said", L.pickLine(["a"], ["a"]) === "a");

const S = await import("../sidebar.ts");
ok("default width at 1440", S.clampSidebarWidth(S.SIDEBAR_DEFAULT, 1440) === 400);
ok("never under 340", S.clampSidebarWidth(100, 1440) === 340);
ok("never over 520", S.clampSidebarWidth(900, 1920) === 520);
ok("leaves the page room at 1024", S.clampSidebarWidth(520, 1024) === 384, String(S.clampSidebarWidth(520, 1024)));
ok("still 340 when the window is tight", S.clampSidebarWidth(400, 900) === 340);
ok("garbage width is the default", S.clampSidebarWidth(Number.NaN, 1440) === 400);
{
  // The boot script must agree with clampSidebarWidth: run it against a fake page.
  const run = (vw: number, open: string | null, width: string | null) => {
    const attrs: Record<string, string> = {};
    const style: Record<string, string> = {};
    const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), style: { setProperty: (k: string, v: string) => (style[k] = v) } } };
    const store: Record<string, string | null> = { [S.SIDEBAR_OPEN_KEY]: open, [S.SIDEBAR_WIDTH_KEY]: width };
    new Function("document", "window", "localStorage", S.sidebarBootScript())(doc, { innerWidth: vw }, { getItem: (k: string) => store[k] ?? null });
    return { dock: "data-helper-dock" in attrs, w: style["--helper-w"] };
  };
  ok("boot: docks when left open on a wide screen", run(1440, "1", "450").dock && run(1440, "1", "450").w === "450px");
  ok("boot: nothing when closed", !run(1440, "0", "450").dock);
  ok("boot: nothing on a phone", !run(390, "1", "450").dock);
  ok("boot: clamps like the app", run(1024, "1", "520").w === `${S.clampSidebarWidth(520, 1024)}px`);
  ok("boot: default width when none saved", run(1440, "1", null).w === "400px");
}
ok("practice event name is stable", S.PRACTICE_EVENT === "algebridge:practice");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
