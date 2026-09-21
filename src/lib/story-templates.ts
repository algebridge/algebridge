/**
 * Story templates: one story per kind of problem and interest, reused for
 * every student.
 *
 * Writing a fresh story for every problem of every visit made the AI bill
 * scale with students: the free Groq tier covered about 150 problems a day
 * for the whole site. A problem generator only ever produces a few shapes
 * ("Solve for x: 4x + 6 = 30" and "Solve for x: 5x + 3 = 23" are the same
 * shape), so the story is written once per shape and interest, with numbers
 * as placeholders:
 *
 *   "Solve for x: {1}x + {2} = {3}"  (Minecraft)
 *   -> "A raid is coming and you need {3} stacks stored: each chest holds {1}
 *       stacks and {2} are already on the floor. {1}x + {2} = {3}. How many
 *       chests do you have to fill?"
 *
 * Code fills the placeholders with each problem's real numbers, and every
 * filled story still goes through the same checks as a hand-written one.
 * After a shape and interest have a template, every student who likes that
 * interest gets that problem as a story instantly, at no cost.
 */

/** A number as the generators write it: digits, with an optional decimal part. */
const NUMBER = /\d+(?:\.\d+)?/g;

export interface Signature {
  /** The prompt with every number replaced by {1}, {2}, ... in order. */
  signature: string;
  /** The numbers that were taken out, exactly as written. */
  values: string[];
}

/**
 * The shape of a prompt. Signs and operators stay literal ("x − {1} = -{2}"),
 * so a problem whose answer goes negative is a different shape from one that
 * stays positive, and gets a story that fits it.
 */
export function signatureOf(prompt: string): Signature {
  const values: string[] = [];
  const signature = prompt.replace(NUMBER, (m) => {
    values.push(m);
    return `{${values.length}}`;
  });
  return { signature, values };
}

/** Puts a problem's numbers back into a template. */
export function fillTemplate(template: string, values: string[]): string {
  return template.replace(/\{(\d+)\}/g, (whole, k) => {
    const v = values[Number(k) - 1];
    return v === undefined ? whole : v;
  });
}

function placeholdersIn(text: string): Set<number> {
  return new Set([...text.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])));
}

/**
 * Structural checks a template must pass before any filled-in version is
 * checked: every placeholder of the shape used, no invented ones, and no
 * digits of its own (a digit in a template is a number that does not change
 * with the problem, which is a new number in every story it produces).
 */
export function checkTemplate(
  signature: string,
  template: unknown,
  /** Equations and points from the shape that must appear word for word. */
  spans: string[] = []
): { ok: true; template: string } | { ok: false; reason: "template"; detail: string } {
  if (typeof template !== "string" || !template.trim()) return { ok: false, reason: "template", detail: "empty" };
  const asked = askAsTheirCall(template.replace(/\s+/g, " ").trim());
  if (!asked) return { ok: false, reason: "template", detail: "end with a question to the student" };
  const clean = asked;
  const flat = (t: string) => t.replace(/[−–]/g, "-").replace(/\s+/g, "");
  const absent = spans.filter((s) => !flat(clean).includes(flat(s)));
  if (absent.length) {
    return { ok: false, reason: "template", detail: `put ${absent.map((s) => `"${s}"`).join(" and ")} in the story exactly as written` };
  }
  const want = placeholdersIn(signature);
  const got = placeholdersIn(clean);
  const missing = [...want].filter((k) => !got.has(k));
  const extra = [...got].filter((k) => !want.has(k));
  if (missing.length || extra.length) {
    const parts = [
      missing.length ? `left out ${missing.map((k) => `{${k}}`).join(", ")}` : "",
      extra.length ? `invented ${extra.map((k) => `{${k}}`).join(", ")}` : "",
    ].filter(Boolean);
    return { ok: false, reason: "template", detail: `${parts.join("; ")}; use each of ${[...want].map((k) => `{${k}}`).join(", ")}` };
  }
  if (/\d/.test(clean.replace(/\{\d+\}/g, ""))) {
    return { ok: false, reason: "template", detail: "it has digits of its own; every number must be a placeholder" };
  }
  // "{2} are on the floor" reads "1 are on the floor" when {2} is 1.
  if (/\{\d+\}\s+(is|are|was|were|has|have)\b/i.test(clean)) {
    return { ok: false, reason: "template", detail: "a verb right after a placeholder breaks when it is 1; write \"with {2} on the floor\", not \"{2} are on the floor\"" };
  }
  return { ok: true, template: clean };
}

/**
 * Bumped when the rules a template must pass change in a way code cannot
 * re-check (a new judge rule, say). Templates approved under older rules are
 * then never served again, instead of living in the library forever.
 */
export const TEMPLATE_RULES = 2;

/** The key a template is stored under. */
export function templateKey(signature: string, topic: string): string {
  return `v${TEMPLATE_RULES}::${signature}::${topic.toLowerCase()}`;
}

/** A short stable id for a template, so a session can avoid repeating one. */
export function templateId(template: string): string {
  // Two FNV-1a passes; collisions do not matter at this scale.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < template.length; i += 1) {
    const c = template.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x811c9dc5) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0").slice(0, 4);
}

/**
 * The question is the student's call ("What do you think...?", "How many do
 * you figure...?"), which is how students were asked to be spoken to.
 */
export const OPINION =
  /\b(do you think|you think|do you figure|you figure|do you reckon|you reckon|would you say|what'?s your (call|guess|read|pick|bet|plan|move)|your (best )?(guess|call|read)|in your view|would you (pick|choose|go with|bet on)|do you (pick|choose|go with))\b/i;

/**
 * Makes the closing question the student's call when the writer forgot to:
 * "How many rows must you build?" becomes "Your call: how many rows must you
 * build?". The writer is asked for it and mostly does it; this makes it
 * certain without throwing away an otherwise good story. Null when the
 * template asks nothing.
 */
export function askAsTheirCall(template: string): string | null {
  const end = template.lastIndexOf("?");
  if (end < 0) return null;
  const start = Math.max(template.lastIndexOf(". ", end), template.lastIndexOf("! ", end)) + 1;
  const question = template.slice(start, end + 1).trim();
  if (OPINION.test(question)) return template;
  // "What's your call: what order..." reads worse than a plain "Your call:".
  const lead = question.charAt(0).toLowerCase() + question.slice(1);
  return `${template.slice(0, start).trimEnd()} Your call: ${lead}${template.slice(end + 1)}`.trim();
}

/**
 * A filled template that only reads wrong when a number is 1: "1 hours",
 * "1 stacks". Checked on every fill, so a template that reads fine with the
 * numbers it was proven on still cannot reach a student as "in 1 hours".
 */
export function readsWrongAtOne(filled: string, original: string): string | null {
  const OK = new Set(["is", "was", "has", "its", "this", "thus", "plus", "minus", "less", "yes", "us", "as", "times", "across", "gets", "goes", "does", "makes", "takes", "adds", "costs", "pays", "holds", "fits", "needs"]);
  for (const m of filled.matchAll(/(?<![\d.,])1\s+([A-Za-z]+s)\b/g)) {
    const word = m[1].toLowerCase();
    if (OK.has(word) || word.endsWith("ss")) continue;
    if (original.includes(m[0])) continue;
    return m[0];
  }
  return null;
}

export const TEMPLATE_WRITER_SYSTEM = `You write story templates for Algebra 1 practice problems, set in things a 12 to 16 year old loves. Each template is reused for many students with different numbers, so it must work for ANY numbers.

In each problem, numbers appear as placeholders: {1}, {2}, {3}. Each stands for a number that changes every time.

What makes one good:
- The answer has a job. The number the student finds is something they need inside the story: how many rails to craft, how many chests to fill, how many threes they sank. Never end on a dry "how many feet is that?".
- Stakes, in a few words: a raid, a deadline, a record, the last seconds of a game.
- Ask for the student's call, as if their thinking matters: "What do you think...?", "How many do you figure...?", "What's your call...?". It must still have exactly one right answer: "How many chests do you think you need to fill?", never "How many chests would be good?".
- Really set in that world, and true for any value of each placeholder. Give each placeholder a role that fits any number: "rows of {1} blocks", "trays of {1} cookies", "{1} views per video". Never tie a placeholder to a fixed fact ("a three is worth {1}" is false for most values).
- It must read right whether a placeholder is 1 or 50: "with {2} on the floor", "a {2}-hour drive", "a total of {3}", never "{2} are on the floor", "{2} is left" or "in {2} hours".
- A negative coefficient means something is lost or used up per item: "you spend {1} gems per upgrade". Never "you scored -{1}x points".
- Write your own story. Do not reuse the wording of the examples below.
- Pick whichever of the student's interests fits each problem best, and spread them out. When a problem lists use_one_of, pick from those. When it lists stories_already_used, write a clearly different scene.
- The student is "you". Open with the moment, then the numbers, then a punchy question in the story's words. At most 2 sentences and 40 words.
- Step problems come with steps shown below your story, never changed, and a task: either "put the steps in the right order" or "find the step with the mistake". Never repeat the steps. Set the scene and ask exactly that task in the story's words ("What order gets your build done?" or "One step of the work below is wrong. Which one wrecked your plan?").
- Some problems are ideas with no numbers. Put the idea in a moment where it matters.
- Each problem lists copy_exactly: every equation or point in it goes into your story exactly as written, placeholders included. Step problems too: the student needs to know what the steps are solving.

Hard rules, because a program checks every template:
1. Use every placeholder at least once, invent none, and write no digits of your own. Placeholders are the only numbers.
2. Copy every equation, expression, function and point exactly as written, placeholders included: {1}x + {2} = {3} stays {1}x + {2} = {3}.
3. The question must have exactly the same answer as the original. A rounding rule or unit fact in parentheses stays word for word.
4. Never state or hint at the answer, never name the wrong step or the order of steps, never list the answer choices.
5. No quantity words (two, three, double, half). School-appropriate: no violence, weapons, dating, alcohol, drugs or gambling, and no claims about real people.
6. Plain text. No emoji, no markdown, no em dashes.
7. If a problem comes with your_rejected_version and rejected_because, fix exactly that.

Examples of the standard (the interests are ones students rarely pick, so write your own for theirs):
Original: "Solve for x: {1}x + {2} = {3}" (Gardening)
-> "Frost hits tonight and you need {3} seedlings in the ground: each row fits {1}, with {2} already planted. {1}x + {2} = {3}. How many rows do you figure you have to dig?"
Original: "Convert {1} miles to feet. ({2} mile = {3} ft)" (Skateboarding)
-> "The downhill run to the skate park is {1} miles, and you want its length for your route video. What's your call, how many feet of pavement is that? ({2} mile = {3} ft)"
Original: "Tickets cost \${1} (adult) and \${2} (child). {3} tickets sold for \${4}. How many adult tickets?" (Chess)
-> "You're running the door at your club's chess tournament: adults pay \${1}, kids \${2}, and you sold {3} tickets for \${4}. How many adult tickets do you think you sold?"
Original: "Find the slope between ({1}, {2}) and ({3}, {4})." (Volleyball)
-> "Plotted as (week, serves landed), your practice log went from ({1}, {2}) to ({3}, {4}). What do you think your slope is, the extra serves you land each week?"
Original: "Put these steps in the correct order to solve {1}x − {2} = {3}:" (Hiking), task "put the steps in the right order"
-> "Your trail map app works out {1}x − {2} = {3} to split the climb into equal legs, but its steps got shuffled below. What order do you think gets you to the summit?"

Reply with JSON only: {"items":[{"id":"...","topic":"<one of the student's interests, exactly as given>","template":"..."}]}`;

/** A step problem's task, in words both the writer and the judge read. */
export function stepTask(type?: string): string {
  return type === "step-order" ? "put the steps in the right order" : "find the step with the mistake";
}

export interface TemplateWriterItem {
  id: string;
  signature: string;
  type?: string;
  choices?: string[];
  steps?: string[];
  previous?: string;
  rejectedBecause?: string;
  /** Interests this shape has no story for yet, to spread the library. */
  useOneOf?: string[];
  /** Stories this student already has for this shape. */
  alreadyUsed?: string[];
  /** Equations and points that must appear word for word. */
  mustInclude?: string[];
}

export function templateWriterMessage(
  items: TemplateWriterItem[],
  interests: { label: string; details: string }[]
): string {
  return JSON.stringify({
    student_interests: interests.map((t) => ({ interest: t.label, things_in_this_world: t.details })),
    problems: items.map((i) => ({
      id: i.id,
      original: i.signature,
      ...(i.mustInclude?.length ? { copy_exactly: i.mustInclude } : {}),
      ...(i.choices ? { answer_choices_shown_separately: i.choices } : {}),
      ...(i.steps ? { steps_shown_separately_unchanged: i.steps, task: stepTask(i.type) } : {}),
      ...(i.useOneOf?.length ? { use_one_of: i.useOneOf } : {}),
      ...(i.alreadyUsed?.length ? { stories_already_used: i.alreadyUsed } : {}),
      ...(i.previous ? { your_rejected_version: i.previous, rejected_because: i.rejectedBecause } : {}),
    })),
  });
}
