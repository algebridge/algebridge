/**
 * The AlgeBridge study helper.
 *
 * Three modes share one rule: the helper never hands over the answer to a
 * problem the student is working on. That rule is enforced here, in code,
 * rather than in a system prompt. A prompt is a request; this is a gate. It
 * holds even when no model is configured, when a model misbehaves, and when
 * the provider is swapped out.
 *
 * The single exception is arithmetic the student could do on a calculator
 * anyway: a bare multiplication or division. Those get the number and nothing
 * else, because refusing them is theatre, not teaching.
 */

export type HelperMode = "tutor" | "reminder" | "scheduler";

/**
 * The quick actions a student can press instead of typing. Each one shapes
 * the system prompt; none of them gets past the answer gate, because the gate
 * reads the student's words, not the button.
 */
export const HELPER_ACTIONS = ["hint", "first-step", "key-idea", "example", "another-way", "next-step"] as const;
export type HelperAction = (typeof HELPER_ACTIONS)[number];

export function isHelperAction(value: unknown): value is HelperAction {
  return typeof value === "string" && (HELPER_ACTIONS as readonly string[]).includes(value);
}

export interface HelperContext {
  /** The skill being practised, when the helper is opened from a problem. */
  skillTitle?: string;
  keyIdea?: string;
  problemPrompt?: string;
  hint?: string;
  /**
   * The worked solution. Never sent to the student. Used to build the list of
   * values the reply is not allowed to contain.
   */
  explanation?: string;
  /**
   * The answer key, for the filter only. Explanations do not always state
   * the final value, and a multiple-choice answer ("y = 3x - 2") is text the
   * number filter cannot see.
   */
  answer?: string;
}

export interface HelperMessage {
  role: "user" | "assistant";
  content: string;
}

/** What the helper decided the student was asking for. */
export type Intent =
  | "answer_request"
  | "arithmetic"
  | "formula"
  | "escalate"
  | "scheduling"
  | "general";

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

const ANSWER_PATTERNS = [
  /\b(what|whats|what's)\s+(is\s+)?(the\s+)?answer\b/,
  /\b(just|please|pls|plz)?\s*(tell|give|show)\s+(me\s+)?(the\s+)?(answer|solution)\b/,
  /\bsolve\s+(it|this|the\s+problem)\b/,
  /\bdo\s+(it|this)\s+for\s+me\b/,
  /\bwhat\s+does\s+[a-z]\s+equal\b/,
  /\banswer\s+(it|this)\b/,
  /\bgive\s+me\s+the\s+(final\s+)?(answer|result)\b/,
  /\bwhat'?s\s+[a-z]\s*=\s*\?/,
];

const ESCALATE_PATTERNS = [
  /\b(i\s+)?(still\s+)?(don'?t|do\s+not|dont)\s+(get|understand)\s+(it|this|any\s+of\s+it)\b/,
  /\b(i\s+)?need\s+(a\s+)?(real\s+)?(person|human|tutor|teacher)\b/,
  /\bcan\s+i\s+(talk|speak)\s+to\s+(a|someone)\b/,
  /\b(i'?m\s+)?(completely|totally|so)\s+lost\b/,
  /\bthis\s+(isn'?t|is\s+not)\s+helping\b/,
  /\bi\s+give\s+up\b/,
  /\bmore\s+help\b/,
];

const FORMULA_PATTERNS = [
  /\bformula\b/,
  /\bwhat'?s\s+the\s+(rule|equation)\s+for\b/,
  /\bhow\s+do\s+(i|you)\s+remember\b/,
  /\bremind\s+me\b/,
  /\bmemoriz/,
];

const YES = /^\s*(y|ya|yes|yeah|yep|yup|sure|ok|okay|please|sounds good|do it|book it)\b/i;
const NO = /^\s*(n|no|nope|nah|not now|later|no thanks|maybe later)\b/i;

export function isYes(text: string): boolean {
  return YES.test(text);
}
export function isNo(text: string): boolean {
  return NO.test(text);
}

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (!t) return "general";
  // Arithmetic wins over answer_request: "what's 4728 divided by 12" reads as
  // both, and the arithmetic branch is the deliberate exception.
  if (parseArithmetic(t)) return "arithmetic";
  if (ANSWER_PATTERNS.some((r) => r.test(t))) return "answer_request";
  if (ESCALATE_PATTERNS.some((r) => r.test(t))) return "escalate";
  if (FORMULA_PATTERNS.some((r) => r.test(t))) return "formula";
  return "general";
}

// ---------------------------------------------------------------------------
// The arithmetic exception
// ---------------------------------------------------------------------------

export interface Arithmetic {
  a: number;
  op: "*" | "/";
  b: number;
  value: number;
}

const NUM = "\\d{1,12}(?:\\.\\d{1,6})?";
const MUL = new RegExp(`(${NUM})\\s*(?:\\*|x|×|times|multiplied by)\\s*(${NUM})`, "i");
const DIV = new RegExp(`(${NUM})\\s*(?:/|÷|divided by|over)\\s*(${NUM})`, "i");

/**
 * Recognises a bare multiplication or division and nothing else. Deliberately
 * narrow: no variables, no addition, no chained expressions, no parentheses.
 * Anything richer than "a times b" is a problem to be taught, not computed.
 *
 * "Tough" means it is not something worth refusing over: single-digit times
 * tables are the one case where handing over the number really is unhelpful,
 * so those fall through to teaching.
 */
export function parseArithmetic(text: string): Arithmetic | null {
  const t = text.toLowerCase();
  // A letter next to the numbers means it is algebra, not arithmetic.
  if (/[a-z]\s*[*/×÷]|[*/×÷]\s*[a-z]/.test(t.replace(/x\s*\d/g, ""))) return null;
  if (/[+\-^=()]/.test(t.replace(/[a-z\s,?.!'"]/g, ""))) return null;

  for (const [re, op] of [
    [DIV, "/"],
    [MUL, "*"],
  ] as const) {
    const m = re.exec(t);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (op === "/" && b === 0) return null;
    // Times tables stay a teaching moment.
    if (op === "*" && a < 13 && b < 13 && Number.isInteger(a) && Number.isInteger(b)) return null;
    if (op === "/" && a < 145 && b < 13 && Number.isInteger(a) && Number.isInteger(b)) return null;
    const value = op === "*" ? a * b : a / b;
    return { a, op, b, value };
  }
  return null;
}

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

// ---------------------------------------------------------------------------
// The answer gate
// ---------------------------------------------------------------------------

/**
 * Every number that appears in the worked solution but not in the problem
 * itself. Those are the values the student is supposed to arrive at, so a
 * reply containing one has given the game away.
 */
export function forbiddenValues(ctx: HelperContext): string[] {
  const fromSolution = (ctx.explanation ?? "").match(/-?\d+(?:\.\d+)?/g) ?? [];
  const fromAnswer: string[] = [];
  const key = Number((ctx.answer ?? "").trim());
  if ((ctx.answer ?? "").trim() !== "" && Number.isFinite(key)) {
    fromAnswer.push(formatNumber(key));
    // 16.666... is said out loud as 16.67 or 16.7.
    if (!Number.isInteger(key)) fromAnswer.push(key.toFixed(2), key.toFixed(1));
  }
  const inProblem = new Set((ctx.problemPrompt ?? "").match(/-?\d+(?:\.\d+)?/g) ?? []);
  return Array.from(new Set([...fromSolution, ...fromAnswer])).filter(
    // 0 and 1 appear everywhere and blocking them would gag the helper.
    (v) => !inProblem.has(v) && v !== "0" && v !== "1" && v !== "-1"
  );
}

function squash(s: string): string {
  return s.toLowerCase().replace(/\u2212/g, "-").replace(/\s+/g, "");
}

/**
 * The text form of the same rule, for answers that are not a number:
 * "Quadrant II", "(x + 3)(x + 4)", "y = 3x - 2". Single words are left out,
 * because "dashed" or "up" also turn up in any honest hint about the choice.
 */
export function leaksAnswerText(reply: string, ctx: HelperContext): boolean {
  const answer = (ctx.answer ?? "").trim();
  if (!answer || Number.isFinite(Number(answer))) return false;
  const worthGuarding = /[\d=()^²√]/.test(answer) || /\s/.test(answer);
  if (!worthGuarding) return false;
  const a = squash(answer);
  if (a.length < 3 || squash(ctx.problemPrompt ?? "").includes(a)) return false;
  return squash(reply).includes(a);
}

/**
 * True when a reply hands over a value the student was meant to find.
 *
 * The boundaries are fussier than \b for a reason. "12" must not fire on
 * "120" or on the "12" inside "3.12", but it must still fire on "12." at the
 * end of a sentence, which is where a naive rule that rejects any trailing
 * dot quietly lets the answer through.
 */
export function leaksAnswer(reply: string, forbidden: string[]): boolean {
  if (!forbidden.length) return false;
  return forbidden.some((v) => {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\w.])${esc}(?!\\w)(?!\\.\\d)`).test(reply);
  });
}

// ---------------------------------------------------------------------------
// Deterministic replies
// ---------------------------------------------------------------------------

export const ESCALATION_OFFER =
  "That sounds like it needs a person, not a hint. I can set you up with one of our tutors. Want me to find you a time?";

export function refuseAnswer(ctx: HelperContext): string {
  const idea = ctx.keyIdea ? ` The idea it turns on: ${ctx.keyIdea}` : "";
  return (
    "I won't give you the answer, that part is yours. What I can do is take it one step at a time." +
    idea +
    "\n\nTell me the first thing you tried and I'll tell you whether the move was sound."
  );
}

/**
 * Opened from a page with no problem on it, the helper has no key idea or hint
 * to quote. Saying "the key idea here:" and then nothing is worse than saying
 * something plain, so this covers the contextless case.
 */
export function generalReply(text: string): string {
  const t = text.toLowerCase();
  if (/\b(hi|hey|hello|yo)\b/.test(t) || !t)
    return "Hey. Tell me the step you are stuck on and I will take it from there, or switch to Formulas if you want a formula back.";
  if (/\b(how|what|why|explain)\b/.test(t))
    return "Open the skill you are working on and ask me there, and I can point at the exact step. From here I can still give you a formula, or put you with a tutor. Which would help more?";
  return "Tell me what you tried and where it stopped making sense. If it is a formula you want, switch to Formulas. If you want a person, choose Book a tutor.";
}

export function arithmeticReply(a: Arithmetic): string {
  const sym = a.op === "*" ? "x" : "/";
  return `${formatNumber(a.a)} ${sym} ${formatNumber(a.b)} = ${formatNumber(a.value)}`;
}

export function reminderReply(ctx: HelperContext, text: string): string {
  const f = findFormulaCard(text);
  if (f) return formulaCardText(f);
  if (ctx.keyIdea) {
    return `For ${ctx.skillTitle ?? "this skill"}, the one to keep: ${ctx.keyIdea}\n\nName the formula you are trying to remember and I will give you a way to hold on to it.`;
  }
  return "Name the formula you want to hold on to, slope, the quadratic formula, the Pythagorean theorem, and I will give you the statement plus a way to remember it.";
}

export interface FormulaCard {
  name: string;
  match: string[];
  formula: string;
  mnemonic: string;
}

export function formulaCardText(f: FormulaCard): string {
  return `${f.name}\n\n${f.formula}\n\nHow to hold on to it: ${f.mnemonic}`;
}

/**
 * The card a request names. The card's own name wins, then the longest match
 * phrase found: "slope-intercept form" contains "slope", and the first card
 * used to win on that alone, so asking for y = mx + b gave back rise over run.
 */
export function findFormulaCard(text: string): FormulaCard | null {
  const t = text.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const named = FORMULA_CARDS.find((f) => f.name.toLowerCase().replace(/-/g, " ") === t);
  if (named) return named;
  let best: { card: FormulaCard; len: number } | null = null;
  for (const card of FORMULA_CARDS) {
    for (const m of card.match) {
      const phrase = m.replace(/-/g, " ");
      if (t.includes(phrase) && (!best || phrase.length > best.len)) best = { card, len: phrase.length };
    }
  }
  return best?.card ?? null;
}

/**
 * Statements of standard formulas. These are not answers to anybody's problem,
 * they are the reference a student is allowed to look up, so the gate does not
 * apply to them.
 */
export const FORMULA_CARDS: FormulaCard[] = [
  {
    name: "Slope between two points",
    match: ["slope", "gradient", "rise over run"],
    formula: "m = (y2 - y1) / (x2 - x1)",
    mnemonic: "Rise over run. The y values are the climb, the x values are the walk.",
  },
  {
    name: "Slope-intercept form",
    match: ["slope intercept", "y = mx", "y=mx", "intercept form"],
    formula: "y = mx + b",
    mnemonic: "m is the steepness, b is where the line crosses the y axis.",
  },
  {
    name: "The quadratic formula",
    match: ["quadratic formula", "quadratic"],
    formula: "x = (-b +/- sqrt(b^2 - 4ac)) / (2a)",
    mnemonic: "Negative b, plus or minus the root of b squared minus four a c, all over two a.",
  },
  {
    name: "Difference of squares",
    match: ["difference of squares", "a2 - b2", "a^2 - b^2"],
    formula: "a^2 - b^2 = (a + b)(a - b)",
    mnemonic: "Same two terms, one sum and one difference.",
  },
  {
    name: "The Pythagorean theorem",
    match: ["pythagor", "hypotenuse", "right triangle"],
    formula: "a^2 + b^2 = c^2",
    mnemonic: "The two short sides, squared and added, equal the long side squared.",
  },
  {
    name: "Point-slope form",
    match: ["point slope", "point-slope"],
    formula: "y - y1 = m(x - x1)",
    mnemonic: "Start from a point you know, then travel at slope m.",
  },
  {
    name: "Distance between two points",
    match: ["distance formula", "distance between"],
    formula: "d = sqrt((x2 - x1)^2 + (y2 - y1)^2)",
    mnemonic: "Pythagoras with the legs measured off the axes.",
  },
  {
    name: "Exponent rules",
    match: ["exponent rule", "power rule", "laws of exponents"],
    formula: "a^m * a^n = a^(m+n),  a^m / a^n = a^(m-n),  (a^m)^n = a^(mn)",
    mnemonic: "Multiplying adds the powers, dividing subtracts them, a power of a power multiplies.",
  },
];

// ---------------------------------------------------------------------------
// The scheduling handoff
// ---------------------------------------------------------------------------

export type SchedulerStep = "offered" | "awaiting_time" | "awaiting_tutor" | "done" | "declined";

export interface SchedulerState {
  step: SchedulerStep;
  freeText?: string;
  tutorName?: string;
}

export function schedulerPrompt(step: SchedulerStep): string {
  switch (step) {
    case "offered":
      return ESCALATION_OFFER;
    case "awaiting_time":
      return "Good. When are you free? Say it however you like, \"Tuesday after 4\" or \"weekday evenings\" both work.";
    case "awaiting_tutor":
      return "Anyone in particular you want? Name a tutor, or say \"anyone\" and I will send it to whoever is free first.";
    case "done":
      return "Sent. A tutor will confirm from their side, and you will see it on your messages. You can keep working in the meantime.";
    case "declined":
      return "No problem. I am here if you change your mind. Where do you want to pick up?";
  }
}

/** Moves the little booking conversation along. Pure, so it is easy to test. */
export function advanceScheduler(state: SchedulerState, text: string): SchedulerState {
  switch (state.step) {
    case "offered":
      if (isYes(text)) return { ...state, step: "awaiting_time" };
      if (isNo(text)) return { ...state, step: "declined" };
      return state;
    case "awaiting_time":
      return { ...state, step: "awaiting_tutor", freeText: text.trim() };
    case "awaiting_tutor": {
      const t = text.trim();
      const anyone = /^(anyone|any|whoever|no preference|doesn'?t matter|dont care)\b/i.test(t);
      return { ...state, step: "done", tutorName: anyone ? undefined : t };
    }
    default:
      return state;
  }
}

/** What the panel says when a student picks Book a tutor themselves. */
export const BOOKING_INTRO =
  "I can set you up with one of our tutors, a real person who can work through it with you. Want me to find you a time?";

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

/**
 * How each quick action shapes the model's job. These sit on top of the tutor
 * prompt and its absolute rule, and the reply is still filtered afterwards:
 * an instruction is a request, the filter is the guarantee.
 *
 * `avoid` is the list of numbers the reply may not contain. A worked example
 * is full of numbers, so it is told which ones are off limits up front rather
 * than finding out from the filter.
 */
export function actionInstruction(action: HelperAction, avoid: string[] = []): string {
  switch (action) {
    case "hint":
      return `The student pressed "Give me a hint". Give one hint that points at the next move without making the move for them. If a hint is listed above, build on it in your own words. End with a short question.`;
    case "first-step":
      return `The student asked for the first step. Name the very first move and say in one sentence why it is a good place to start. Do not carry it out and do not say what it produces. End by asking them to try it.`;
    case "key-idea":
      return `Explain the key idea of this skill in plain words a 13 year old would use, with one tiny example that is not their problem. Then say in one sentence how it applies to their problem, without solving any of it. Stay under 70 words.`;
    case "example": {
      const numbers = avoid.length ? ` Never write any of these numbers anywhere in your reply: ${avoid.join(", ")}.` : "";
      return `The student asked for a similar example. Make up a NEW problem of the same kind with different numbers, and work it all the way through so they can copy the method on their own problem. The absolute rule above is about the student's problem; your made-up example has its own answer and you should show it.
Format: one line that starts "Here is a similar one:" and states the new problem. Then the steps, one short sentence each, one per line, numbered like "1. ", at most 5 steps, and the last step states the example's own answer. Then one short line inviting them to use the same steps on their problem.
Do not reuse the student's problem or its numbers, and never refer to a step by its number in a sentence. This reply may run to about 120 words.${numbers}`;
    }
    case "another-way":
      return `The student asked you to explain your last message another way. Say the same idea differently: a picture in words, an everyday comparison, or the same move on smaller, easier numbers that are not from their problem. Do not repeat your earlier wording. End with a short question.`;
    case "next-step":
      return `The student wants the next step. Look at what has been done so far in this conversation and name the one next move, without doing it for them. End with a short question.`;
  }
}

/**
 * The deterministic engine reads the student's words, not the button, so a
 * quick action is translated into the words that steer it.
 */
export function actionAsWords(action: HelperAction): string {
  switch (action) {
    case "hint":
      return "give me a hint";
    case "first-step":
      return "how do i start";
    case "key-idea":
      return "explain the key idea";
    case "example":
      return "explain the key idea";
    case "another-way":
      return "explain why";
    case "next-step":
      return "what next";
  }
}

/** When no clean example can be made, the method is the next best thing. */
export function exampleFallback(ctx: HelperContext): string {
  const idea = ctx.keyIdea ? ` The idea to copy: ${ctx.keyIdea}` : "";
  return `I could not build a clean example this time, so here is the method instead.${idea}\n\nTry the first move on your problem and tell me what you get. I will check the move with you.`;
}

/**
 * A worked example is a numbered list, and "2. Subtract..." must not trip the
 * filter when the answer happens to be 2. Only markers that count up from 1 at
 * the start of a line are removed, so a number that is part of the maths is
 * still checked.
 */
export function withoutListMarkers(text: string): string {
  let expect = 1;
  return text
    .split("\n")
    .map((line) => {
      const m = /^(\s*)(\d{1,2})[.)]\s+/.exec(line);
      if (m && Number(m[2]) === expect) {
        expect += 1;
        return m[1] + line.slice(m[0].length);
      }
      return line;
    })
    .join("\n");
}

/** Emoji are not house style, and the older local engine still greets with one. */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?])/g, "$1");
}
