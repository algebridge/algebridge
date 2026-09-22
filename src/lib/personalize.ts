/**
 * Practice problems set in the things a student is into.
 *
 * The one rule: code owns the math, the model only owns the words. Every
 * number and every answer comes from the problem generators, exactly as
 * before. A model is asked to move a problem into the student's world
 * ("Your team hits x threes..."), and what it writes has to survive four
 * checks before a student sees it:
 *
 *   1. The same numbers as the original, no more and no fewer. A new number
 *      would be a new problem; a missing one, a broken one.
 *   2. Every equation, expression and point copied character for character,
 *      so the thing being solved is literally the thing that was generated.
 *   3. No answer in the text, and nothing a classroom would object to.
 *   4. A second, separate model solves the rewrite without seeing the
 *      original, and must land on the generator's answer key. That is what
 *      catches a story that quietly asks a different question.
 *
 * Anything that fails any check is dropped and the student gets the original
 * problem. The worst case is a plain problem, never a wrong answer key.
 *
 * Pure and shared, so it is tested without a network.
 */

import { STILTED } from "@/lib/story-templates";
import { numericAnswerMatches } from "@/lib/grading";
import { isSchoolSafe } from "@/lib/interests";

/** Problems written per request: one skill's worth of the five that count. */
export const BATCH_SIZE = 5;

/** The first request of a visit is smaller, so the first problem arrives fast. */
export const FIRST_BATCH_SIZE = 3;

/**
 * Stories scoring below this on the judge's 1 to 5 engagement scale stay
 * plain. 3 means "their world, but flat", which still beats "Solve for x:
 * 3x + 5 = 20"; a bar of 4 was swapping decent stories for the plain
 * original. Nonsense and give-aways are rejected whatever the score.
 */
export const MIN_ENGAGING = 3;

/** Room for two short sentences, which is the whole reading budget. */
export const MAX_PROMPT_CHARS = 260;

export interface PersonalizableProblem {
  id: string;
  type: string;
  prompt: string;
  answer?: string | number;
  choices?: string[];
  decimalPlaces?: number;
  /** Step problems (put in order, find the wrong one) show these separately, unchanged. */
  steps?: string[];
}

/** Problems whose steps are shown under the story and never rewritten. */
export function isStepProblem(p: Pick<PersonalizableProblem, "type">): boolean {
  return p.type === "step-order" || p.type === "error-analysis";
}

/**
 * Generators pad a bank with "(Review 3)" or "(Set 2)" to keep prompts
 * unique. The tag means nothing to a student, and its number would otherwise
 * have to be worked into the story.
 */
export function stripVariantTag(prompt: string): string {
  return prompt.replace(/\s*\((?:Review|Variant|Set)\s+\d+\)\s*$/i, "").trim();
}

/**
 * Every kind of problem gets a story: numbers to find, choices, concept
 * questions ("When do you flip the inequality sign?"), and step problems,
 * where only the framing is rewritten and the steps are shown as they are.
 */
export function canPersonalize(p: PersonalizableProblem): boolean {
  const prompt = stripVariantTag(p.prompt ?? "");
  if (!prompt || prompt.length > 220) return false;
  if (isStepProblem(p)) return Array.isArray(p.steps) && p.steps.length >= 2;
  if (p.answer === undefined || p.answer === null || p.answer === "") return false;
  if (p.type === "multiple-choice") return Array.isArray(p.choices) && p.choices.length >= 2;
  return p.type === "numeric";
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Every number in a text, as a canonical string, sign ignored. Thousands
 * commas are removed first so "5,280" and "5280" are the same number, while
 * the comma in "(1, 4)" is left alone because of the space after it.
 */
export function numberSet(text: string): Set<string> {
  const flat = text.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  const out = new Set<string>();
  for (const m of flat.match(/\d+(?:\.\d+)?/g) ?? []) out.add(String(Number(m)));
  return out;
}

/** First words of a sentence, lowercased, letters and digits only. */
function openingWords(sentence: string, n: number): string {
  return (sentence.toLowerCase().match(/[a-z0-9]+/g) ?? []).slice(0, n).join(" ");
}

/** Sentences of a text, with any parenthesised rules at the very end set aside. */
function sentencesOf(text: string): string[] {
  const body = text.replace(/(\s*\([^()]*\)[.?!]?)+\s*$/, "").trim();
  // A closing parenthesis followed by a capital also ends a sentence:
  // "(enter as a number) How many blocks do you need?"
  return body.split(/(?<=[.?!])\s+|(?<=\))\s+(?=[A-Z])/).filter(Boolean);
}

function squashWords(s: string): string {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).join(" ");
}

/**
 * Is the story's question just the original's, with a scene glued on in
 * front? Either it opens the way the original opened ("Convert 7 miles...",
 * "Solve for x"), or it is the original's own closing question word for word
 * ("What number does x have to be greater than?", "How many miles?").
 */
/** "the second step", "step 2", "first subtract ... then divide". */
const STEP_GIVEAWAY =
  /\b(first|second|third|fourth|last|final|middle|1st|2nd|3rd|4th)\s+(step|line|move)\b|\bstep\s*#?\d|\b(first|start by)\b[^.?!]*\b(add|subtract|divide|multiply|substitute|distribute)\w*[^.?!]*\b(then|next|after)\b/i;

/** Instructions whose opening a story question should never reuse. */
const INSTRUCTION = /^(convert|solve|find|simplify|evaluate|expand|factor|write|rewrite|put|order|complete|graph|calculate|compute|determine|identify)\b/i;

export function endsLikeOriginal(original: string, rewrite: string): boolean {
  const mine = sentencesOf(rewrite);
  const theirs = sentencesOf(original);
  const last = mine[mine.length - 1] ?? "";
  // Only an instruction's opening counts: "Convert 7 miles" or "Solve for x".
  // A question can fairly start the same way ("When do you flip it?").
  const lead = openingWords(original, 3);
  if (INSTRUCTION.test(original.trim()) && lead.split(" ").length === 3 && openingWords(last, 3) === lead) return true;
  const theirLast = theirs[theirs.length - 1];
  if (theirLast && squashWords(last) === squashWords(theirLast)) return true;
  // The flattest ending there is, whatever the original said.
  return /^how (many|much) [a-z ]+ is (that|it)$/.test(squashWords(last));
}

function countNumber(text: string, value: string): number {
  const flat = text.replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  return (flat.match(/\d+(?:\.\d+)?/g) ?? []).filter((m) => String(Number(m)) === value).length;
}

/**
 * Quantities written as words would dodge the number check, so a rewrite
 * that uses them is refused outright. "one" is left out: "each one" and
 * "someone" are ordinary English, and the verifier still has to agree.
 */
const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|twice|double|triple|half)\b(?!-point)/i;

// ---------------------------------------------------------------------------
// Math spans
// ---------------------------------------------------------------------------

/** A token made only of digits, operators, brackets and the letters x y f g h. */
const MATH_TOKEN = /^[0-9xyfgh²³√|()^.+\-−×÷*/=<>≤≥,{};…]+$/;
const OPERATOR = /[=<>≤≥+×÷*/^²³√|]|[\-−](?=\s*[\dxy(])/;
const VARIABLE = /[xy]|[fgh]\(/;

/**
 * The equations, expressions and points in a prompt, as they are written.
 * "Solve for x: 9x = 72" gives ["9x = 72"]; "Find the slope between (1, 4)
 * and (4, 7)." gives ["(1, 4)", "(4, 7)"]. A lone number is not a span, and
 * neither is "= 5280" in a unit fact, which the number check already covers.
 */
export function mathSpans(prompt: string): string[] {
  const tokens = prompt.split(/\s+/);
  const spans: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length) {
      const span = run.join(" ").replace(/[.,;:?!]+$/, "").replace(/^[:;,]+/, "");
      if (isRequiredSpan(span)) spans.push(balance(span));
    }
    run = [];
  };

  for (const raw of tokens) {
    // "x:" and "f(6)." carry punctuation that belongs to the sentence.
    const token = raw.replace(/[:?!]+$/, "");
    const trailing = raw.length !== token.length;
    if (token && MATH_TOKEN.test(token.replace(/[.,;]+$/, ""))) {
      run.push(token);
      // A number that ends a sentence ("each row adds 6.") is prose, and the
      // equation after it starts a new span rather than joining this one.
      if (trailing || /^\d+(\.\d+)?[.;]$/.test(token)) flush();
    } else {
      flush();
    }
  }
  flush();
  return spans;
}

/**
 * A span that picked up half a bracket from the sentence around it, like
 * "(1" in "(1 mile = 5280 ft)", is trimmed back to the part that balances.
 */
function balance(span: string): string {
  let s = span;
  const count = (c: string) => s.split(c).length - 1;
  while (s.startsWith("(") && count("(") > count(")")) s = s.slice(1).trim();
  while (s.endsWith(")") && count(")") > count("(")) s = s.slice(0, -1).trim();
  return s;
}

function isRequiredSpan(span: string): boolean {
  if (span.length < 2) return false;
  const digits = (span.match(/\d+/g) ?? []).length;
  if (/[√^²³]/.test(span)) return true;
  if (VARIABLE.test(span) && OPERATOR.test(span)) return true;
  // Points and pairs: "(1, 4)". Their order is the problem.
  if (/^\(-?−?\d+(\.\d+)?,\s*-?−?\d+(\.\d+)?\)$/.test(span)) return true;
  return OPERATOR.test(span) && digits >= 2 && !/^[=<>≤≥]/.test(span);
}

/** Compared ignoring spacing and the two kinds of minus sign. */
function normalizeMath(s: string): string {
  return s.replace(/−/g, "-").replace(/\s+/g, "").toLowerCase();
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

export type RejectReason =
  | "empty"
  | "too-long"
  | "unsafe"
  | "numbers"
  | "number-words"
  | "math-changed"
  | "gives-answer"
  | "textbook"
  | "awkward"
  | "format";

/**
 * Tidies what a model wrote, then runs checks 1 to 3. Returns the text to
 * show, or why it cannot be shown.
 */
export function checkRewrite(
  original: PersonalizableProblem,
  rewrite: unknown
): { ok: true; text: string } | { ok: false; reason: RejectReason; detail?: string } {
  if (typeof rewrite !== "string") return { ok: false, reason: "empty" };
  // Writers paste a step problem's steps into the story despite being told
  // they are shown below it. Any line that is one of the steps is dropped.
  let draft = rewrite;
  if (isStepProblem(original) && original.steps?.length) {
    const stepSet = new Set(original.steps.map((st) => normalizeMath(st)));
    draft = rewrite
      .split(/\n+/)
      .filter((line) => !stepSet.has(normalizeMath(line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, ""))))
      .join(" ");
  }
  const text = draft
    .replace(/[\u2010\u2011]/g, "-") // "three\u2011pointer" uses a no-break hyphen
    .replace(/[—–]/g, ", ")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 8) return { ok: false, reason: "empty" };
  if (text.length > MAX_PROMPT_CHARS) return { ok: false, reason: "too-long" };
  if (!isSchoolSafe(text)) return { ok: false, reason: "unsafe" };
  // "\w_\w" catches a model echoing its instructions, like
  // "(choices_stay_the_same)" at the end of a story.
  if (/https?:|www\.|@\w|#\w|\w_\w/.test(text)) return { ok: false, reason: "format" };
  // Emoji and pictographs: the house style is plain text.
  if (/\p{Extended_Pictographic}/u.test(text)) return { ok: false, reason: "format" };

  const source = stripVariantTag(original.prompt);

  const want = numberSet(source);
  const got = numberSet(text);
  if (want.size !== got.size || [...want].some((n) => !got.has(n))) {
    // Said precisely, so a second try can fix exactly this.
    const added = [...got].filter((n) => !want.has(n));
    const missing = [...want].filter((n) => !got.has(n));
    const detail = [
      added.length ? `added ${added.join(", ")}` : "",
      missing.length ? `left out ${missing.join(", ")}` : "",
      `use only ${[...want].join(", ")}`,
    ]
      .filter(Boolean)
      .join("; ");
    return { ok: false, reason: "numbers", detail };
  }
  // When the answer happens to equal a number already in the problem (x = 5
  // in 3x + 5 = 20), the set check above cannot see "You hit 5 threes". A
  // story may restate each number once next to its equation, so the answer
  // may appear at most twice as often as in the original. The judge (check 4)
  // is what catches a single give-away; a strict count here threw out good
  // stories like "free throws got you 5 ... 3x + 5 = 20".
  if (original.type === "numeric" && original.answer !== undefined) {
    const key = String(Number(original.answer));
    if (want.has(key) && countNumber(text, key) > 2 * countNumber(source, key)) {
      return { ok: false, reason: "gives-answer" };
    }
  }
  // "the three steps below" counts steps, not a quantity in the math.
  const wordsChecked = isStepProblem(original) ? text.replace(/\b(two|three|four|five)\s+steps\b/gi, "steps") : text;
  const numberWord = wordsChecked.match(NUMBER_WORDS);
  if (numberWord && !NUMBER_WORDS.test(source)) {
    return { ok: false, reason: "number-words", detail: `"${numberWord[0]}"` };
  }

  const flat = normalizeMath(text);
  for (const span of mathSpans(source)) {
    if (!flat.includes(normalizeMath(span))) return { ok: false, reason: "math-changed", detail: `copy exactly: ${span}` };
  }

  // The failure that made these feel like 2 + 2: a scene glued onto the
  // original sentence, ending "...Convert 7 miles to feet?" or "Solve for x."
  // The question has to be the story's own.
  if (endsLikeOriginal(source, text)) return { ok: false, reason: "textbook" };
  if (STILTED.test(text)) return { ok: false, reason: "awkward", detail: "ask it the way a friend would say it, plainly" };

  // A step problem's answer is which step is wrong, or their order. Naming a
  // step, or narrating the moves in order, hands it over whatever the judge
  // thinks.
  if (isStepProblem(original) && STEP_GIVEAWAY.test(text)) return { ok: false, reason: "gives-answer" };

  // A choice answer ("Quadrant II", "y = 3x − 2") showing up in the story is
  // the answer handed over, unless the original already said it.
  if (original.type === "multiple-choice" && typeof original.answer === "string") {
    const ans = normalizeMath(original.answer);
    if (ans.length >= 2 && flat.includes(ans) && !normalizeMath(source).includes(ans)) {
      return { ok: false, reason: "gives-answer" };
    }
  }

  return { ok: true, text };
}

/**
 * Check 4: did an independent solver, reading only the rewrite, reach the
 * generator's answer? For choices it answers with a letter, A to D.
 */
export function verifierAgrees(original: PersonalizableProblem, solved: unknown): boolean {
  if (solved === undefined || solved === null) return false;
  const given = String(solved).trim();
  if (!given) return false;

  if (original.type === "multiple-choice") {
    const choices = original.choices ?? [];
    const correct = choices.findIndex((c) => c === original.answer);
    if (correct < 0) return false;
    // Lettered, not numbered: with choices like "0", "1", "2", a bare "2"
    // could mean the second choice or the value two, and one reading of that
    // can pass a wrong rewrite.
    const letter = given.toUpperCase().match(/^\(?([A-H])\)?(?:[.):\s]|$)/);
    if (letter) return letter[1].charCodeAt(0) - 65 === correct;
    // A solver that quoted the choice instead of lettering it.
    return normalizeMath(given) === normalizeMath(String(original.answer));
  }

  const expected = Number(original.answer);
  if (!Number.isFinite(expected)) return false;
  return numericAnswerMatches(expected, given, original.decimalPlaces);
}

export type Verdict = "keep" | "verifier" | "unfit" | "gives-away" | "flat";

/**
 * Check 4 in full: the judge solved the story blind, then said whether it
 * makes sense, whether it gives the answer away, and how engaging it is.
 * A story is shown only when every one of those comes back right.
 */
export function judgeVerdict(
  original: PersonalizableProblem,
  entry: { answer?: unknown; fits?: unknown; gives_away?: unknown; engaging?: unknown } | undefined
): Verdict {
  // A step problem's answer lives in its steps, which are never rewritten, so
  // there is no number for the judge to reach. It still has to make sense.
  if (!entry) return "verifier";
  if (!isStepProblem(original) && !verifierAgrees(original, entry.answer)) return "verifier";
  if (entry?.fits !== true) return "unfit";
  if (entry?.gives_away !== false) return "gives-away";
  if (!(Number(entry?.engaging) >= MIN_ENGAGING)) return "flat";
  return "keep";
}

// ---------------------------------------------------------------------------
// Talking to a model
// ---------------------------------------------------------------------------

/**
 * Pulls the JSON object out of a reply. Models wrap it in prose, code fences,
 * or a reasoning preamble often enough that JSON.parse on the raw text is not
 * a plan.
 */
export function parseModelJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const list = cleaned.indexOf("[");
  // qwen sometimes answers with the bare list instead of {"answers": [...]}.
  // Reading that as nothing threw away whole rounds of good work.
  if (list >= 0 && (start < 0 || list < start)) {
    const items = parseList(cleaned.slice(list));
    return items ? { items, answers: items } : null;
  }
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    // Cut off at the token limit: keep every entry that was finished.
    const key = /"(answers|items)"\s*:\s*\[/.exec(cleaned);
    if (!key) return null;
    const items = completeObjects(cleaned.slice(key.index + key[0].length - 1));
    return items ? { [key[1]]: items } : null;
  }
}

function parseList(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text.slice(0, text.lastIndexOf("]") + 1));
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* cut off: fall through */
  }
  return completeObjects(text);
}

/** Every complete top-level {...} in the text, in order. */
function completeObjects(text: string): unknown[] | null {
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (c === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          /* skip a broken entry */
        }
        start = -1;
      }
    }
  }
  return out.length ? out : null;
}

export const WRITER_SYSTEM = `You turn Algebra 1 practice problems into tiny stories a 12 to 16 year old actually wants to solve. You get the student's interests and a few problems. Return one story for every problem.

What makes one good:
- The answer has a job. The number the student finds is something they need inside the story: how many rails to craft, how many chests to fill, what to charge, how many threes they sank. Never end on a dry "how many feet is that?".
- There are stakes, in a few words: a rival, a record, a deadline, a drop, a raid, the last seconds of a game.
- End on the question a friend would ask in that moment, plainly. Where the number is a decision or an estimate, asking for their take reads well ("How many chests do you think you need?"); where it is a plain count, ask plainly and specifically ("How many rails do you need to craft?"). Never bolt on "What is your call on..." or "Your call:". Exactly one right answer either way.
- It is really set in that world, using things that exist there. Every number means exactly what the math uses it for, in matching units, and every fact is true (a free throw is worth 1 point). If a problem's units do not exist in one interest (there are no gallons in Minecraft, and a livestream does not travel at 66 mph), use a different interest, or a real trip or event around it, like the bus ride to a tournament.
- Use the interest for real. Tickets become tickets to your team's playoff game or your server's build contest, not just "tickets". Nothing impossible: you cannot bake tickets.
- For an equation like 6x + 10 = 34: x counts something the student does or gets, 6 is what ONE of those is worth or holds (and it must be true: a three is worth 3, never 6), 10 is what they already have, 34 is the goal or total. When nothing in that world is naturally worth that number, use packs, rows, trays or boxes of that size ("trays of 6 cookies", "rows of 6 blocks").
- When a problem uses points like (1, 4), say what the first and second number measure, like (month, thousands of subscribers).
- Step problems come with steps that are shown right below your story and never change. Never repeat the steps or their results in the story. Set the scene around the equation or conversion, keep it exactly as written, and end with a question about the steps in the story's words: "One step of the work below is wrong. Which one wrecked your plan?", "What order gets your team there?".
- Some problems are ideas, not numbers ("When do you flip the inequality sign?"). Put the idea in a moment where it matters, and ask it in the story's words.
- If a problem comes with your_rejected_version and rejected_because, write a new version that fixes exactly that.
- For each problem, pick whichever of the student's interests fits its numbers best. Spread the interests out when several fit.
- Open with the moment and its stakes, never with "Your X is": "Two minutes left and you're down by 3...", "The server resets at midnight...", "The drop sells out in an hour...".
- End with a question in the story's words ("How many rails do you need to craft?"), never a textbook one: no "What is the 10th term?", "How many feet is that?", "Which factor converts pounds to ounces?".
- The student is "you". At most 2 sentences and 40 words, easy words.

Hard rules, because a program checks your work and throws out anything that breaks one:
1. Use every number from the original problem. Add no other numbers, not even written as words: no years, levels, scores or jersey numbers that are not in the original.
2. Copy every equation, expression, function and point, like 3x + 4 = 19, f(x) = 2x - 1 or (1, 4), exactly as written. Mention each point only once.
3. The answer must be exactly the same number as the original's. Your question can and should use completely different words: never end on the original's sentence, like "Convert 7 miles to feet." or "Solve for x." A rounding rule or unit fact in parentheses stays word for word; labels like (adult) are just words, write them naturally.
4. Never state or hint at the answer, and never list the answer choices in your text.
5. School-appropriate: no violence, weapons, dating, alcohol, drugs or gambling, and no claims about real people.
6. Plain text. No emoji, no markdown, no em dashes.

Examples of the standard:
Original: "Solve for x: 3x + 4 = 19" (Basketball)
-> "Your threes are worth 3 each, free throws got you 4, and the scoreboard shows 19 before the buzzer: 3x + 4 = 19. How many threes do you think you drained?"
Original: "Solve for x: 4x + 6 = 42" (Minecraft)
-> "A raid is coming and you need 42 stacks stored: each chest holds 4 stacks and 6 are already on the floor. 4x + 6 = 42. How many chests do you figure you have to fill?"
Original: "Convert 7 miles to feet. (1 mile = 5280 ft)" (Minecraft)
-> "You're laying a 7-mile rail line to your friend's base, one rail per foot. How many rails do you need to craft? (1 mile = 5280 ft)"
Original: "A train travels 42 mph for 4 hours. How many miles?" (Basketball)
-> "The team bus to the state final cruises at 42 mph for 4 hours. How many miles away is the arena?"
Original: "Tickets cost $8 (adult) and $5 (child). 12 tickets sold for $78. How many adult tickets?" (Basketball)
-> "You're running the ticket table for your team's playoff game: adults pay $8, kids $5, and you sold 12 tickets for $78. How many adult tickets do you think you sold?"
Original: "Sequence: 3, 7, 11, 15, ... What is the 10th term?" (YouTube)
-> "Your channel's weekly uploads go 3, 7, 11, 15, ... views in thousands, and a sponsor pays out at the 10th week. How many views, in thousands, will that 10th week bring?"
Original: "Find the slope between (1, 2) and (4, 8)." (YouTube)
-> "Plotted as (month, thousands of subscribers), your channel went from (1, 2) to (4, 8). What's your slope, the thousands of subscribers you gain each month?"

Reply with JSON only: {"items":[{"id":"...","topic":"<one of the student's interests, exactly as given>","text":"..."}]}`;

export const SOLVER_SYSTEM = `You check Algebra 1 practice problems written as short stories for students aged 12 to 16. For each one, do four things.

1. Solve it exactly as written. Questions may be phrased as the student's call ("What do you think...?"); answer what they are really asking. If a question has no single right answer, set fits to false. For a multiple-choice problem, answer with the letter of the correct choice (A, B, C or D). Otherwise answer with the number only, no units. If the problem says how to round, round that way. For a problem of kind "steps", whose steps are shown with it, answer "-".
2. "fits" is true only if ALL of these hold, otherwise false:
   - The situation could really happen, in real life or in that game or world, and its facts are right: a free throw is worth 1 point and a three is worth 3, Minecraft has no gallons of fuel, a livestream does not travel at 66 mph, nobody bakes tickets.
   - Every number means what the math uses it for, and the units agree. No adding streams to beats per minute, no calling rebounds points.
   - Any point like (1, 4) says what its two numbers measure.
   - The interest is really part of the situation, not just a name pasted onto an ordinary problem.
   - For a "steps" problem, the story asks for exactly its task (ordering the steps, or finding the wrong one), and matches the steps shown with it.
   - Numbers read naturally: no "you scored -2x points", no "1 are".
   - The closing question reads the way a person would say it. "What is your call on the total seconds?" and "What do you think the answer is?" are stilted; a stilted or bolted-on question means fits is false, with why "stilted question".
3. "gives_away" is true if the story states the answer, or makes it obvious without doing the math (for example "you hit 5 threes" when the question is how many threes). For a "steps" problem, gives_away is false unless the story names the wrong step ("the second step") or states the order of the steps ("first subtract, then divide"). Spotting the error in easy algebra is the skill being practised, not a give-away.
4. "engaging" from 1 to 5, as a 13 year old who loves that interest would feel it. 5: the answer matters to them inside the story and there are stakes. 4: clearly their world, with a real reason to want the answer. 3: their world, but flat. 2: barely connected. 1: generic.

When fits is false or engaging is below 3, add "why": what is wrong, in at most 12 words.

Be strict. When in doubt, fits is false and gives_away is true.

Reply with JSON only: {"answers":[{"id":"...","answer":"...","fits":true,"gives_away":false,"engaging":4,"why":""}]}`;

export interface WriterItem {
  id: string;
  prompt: string;
  choices?: string[];
  steps?: string[];
  type?: string;
  /** A repair: the version that was rejected, and why. */
  previous?: string;
  rejectedBecause?: string;
}

export function writerUserMessage(
  items: WriterItem[],
  interests: { label: string; details: string }[]
): string {
  return JSON.stringify({
    student_interests: interests.map((t) => ({ interest: t.label, things_in_this_world: t.details })),
    problems: items.map((i) => ({
      id: i.id,
      original: i.prompt,
      ...(i.choices ? { answer_choices_shown_separately: i.choices } : {}),
      ...(i.steps ? { steps_shown_separately_unchanged: i.steps, kind: i.type } : {}),
      ...(i.previous ? { your_rejected_version: i.previous, rejected_because: i.rejectedBecause } : {}),
    })),
  });
}

export function solverUserMessage(
  items: { id: string; text: string; choices?: string[]; steps?: string[]; type?: string }[]
): string {
  return JSON.stringify({
    problems: items.map((i) => ({
      id: i.id,
      problem: i.text,
      ...(i.choices ? { choices: i.choices.map((c, n) => `${String.fromCharCode(65 + n)}. ${c}`) } : {}),
      ...(i.steps
        ? {
            kind: "steps",
            steps_shown_with_it: i.steps,
            task: i.type === "step-order" ? "put the steps in the right order" : "find the step with the mistake",
          }
        : {}),
    })),
  });
}

/**
 * Why a draft was thrown out, in words a writer can act on. Sent back with
 * the draft for one more try, which is what turns most rejections into a
 * story instead of a plain problem.
 */
export function whyRejected(reason: string, detail?: string): string {
  switch (reason) {
    case "numbers":
      return `It changed the numbers${detail ? ` (${detail})` : ""}. If you repeated the steps or their results, leave them out: they are shown below the story.`;
    case "number-words":
      return `It wrote a quantity as a word${detail ? ` (${detail})` : ""}. Use no quantity words at all.`;
    case "math-changed":
      return `It changed an equation, expression or point${detail ? ` (${detail})` : ""}. Copy every one exactly as written.`;
    case "textbook":
      return "It ended on the textbook question. End with a question in the story's own words.";
    case "awkward":
      return "Its question was stilted (\"What is your call on the total...\"). Ask it the way a friend would say it, plainly.";
    case "gives-answer":
    case "gives-away":
      return "It gave the answer away. Keep the answer hidden.";
    case "too-long":
      return "It was too long. At most 2 sentences and 40 words.";
    case "unsafe":
      return "It used a word that is not school-appropriate.";
    case "format":
      return "It had formatting in it. Plain text only.";
    case "verifier":
      return "Its question has a different answer than the original. The answer must stay exactly the same.";
    case "unfit":
      return `It did not make sense in that world${detail ? `: ${detail}` : ""}. Keep every fact true and every number meaningful.`;
    case "flat":
      return `It was flat${detail ? `: ${detail}` : ""}. Give the answer a job and add stakes.`;
    default:
      return "It was rejected. Write a better one.";
  }
}
