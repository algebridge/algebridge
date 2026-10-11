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
): { ok: true; template: string } | { ok: false; reason: "template" | "awkward"; detail: string } {
  if (typeof template !== "string" || !template.trim()) return { ok: false, reason: "template", detail: "empty" };
  const clean = template.replace(/\s+/g, " ").trim();
  if (!clean.includes("?")) return { ok: false, reason: "template", detail: "end with a question to the student" };
  if (STILTED.test(clean)) return { ok: false, reason: "awkward", detail: "ask it the way a friend would say it, plainly" };
  const contrived = contrivedWording(clean) ?? repeatsTheFact(signature, clean);
  if (contrived) return { ok: false, reason: "awkward", detail: contrived };
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
export const TEMPLATE_RULES = 4;

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
 * Wording nobody would say out loud. "What is your call on the total
 * seconds?" is a question bolted onto a sum; a friend would ask "How many
 * seconds is that?". Asking for the student's opinion is welcome where the
 * number is a decision or an estimate, and only there.
 */
export const STILTED =
  /\b(your call\b|in your view|would you say|what('s| is) your (guess|read|pick|bet|plan|move|estimate)|do you (think|figure|reckon) (is|are|it is)\b|what do you (think|figure) the (total|answer|number|value) is)/i;

const UNIT_WORDS =
  "feet|foot|inches|inch|yards|miles|meters|centimeters|millimeters|kilometers|seconds|minutes|hours|milliseconds|grams|kilograms|milligrams|liters|milliliters|pounds|ounces|cups|gallons";

/**
 * Wording that gives a story away as made up. These are the lines the
 * feedback called out: numbers right, words wrong.
 * - A made-up need for a unit: "the software needs the value in feet", "your
 *   build log wants the width in feet", "the upload form wants the length in
 *   milliseconds". Nobody in that world needs it; the story invented a form.
 * - The textbook instruction pasted into the story: "...holds 18 kilograms of
 *   volleyballs; convert 18 kilograms to grams."
 * - The math book itself inside the story: "With 1 mile = 5280 ft in the math
 *   book, how many feet...".
 * Returns what to fix, or null.
 */
export function contrivedWording(text: string): string | null {
  const madeUpNeed = new RegExp(
    String.raw`\b(needs?|wants?|asks? for|requires?|lists?|logs?|tracks?|measures?|counts?|records?|reads?|shows?)\b[^.?!]{0,48}?\b(in|into)\s+(?:square\s+|cubic\s+)?(${UNIT_WORDS})\b`,
    "i"
  );
  if (madeUpNeed.test(text)) {
    return "a made-up need for a unit (\"the app needs it in feet\"); describe something really measured that way and ask for it plainly";
  }
  if (/\bconvert(?:ing|s)?\s+(?:\{\d+\}|\d|it\b|that\b|this\b|them\b|those\b)/i.test(text)) {
    return "the textbook instruction is pasted in (\"convert ... to ...\"); ask the story's own question instead";
  }
  if (/\b(math ?book|textbook|worksheet)\b/i.test(text)) return "the math book is in the story; keep the story in its own world";
  return null;
}

/**
 * A unit fact or rounding rule from the original's parentheses ("(1 L = 1,000
 * mL)") belongs once, at the end. Woven into a sentence as well ("and you
 * recall 1 L = 1,000 mL... (1 L = 1,000 mL)") it reads twice.
 */
export function repeatsTheFact(original: string, text: string): string | null {
  const flat = (t: string) => t.replace(/[−–]/g, "-").replace(/\s+/g, "");
  for (const m of original.matchAll(/\(([^()]*=[^()]*)\)/g)) {
    const fact = flat(m[1]);
    if (!fact) continue;
    const count = flat(text).split(fact).length - 1;
    if (count > 1) return `the fact ${m[1].trim()} is written twice; keep it only in the parentheses at the end`;
  }
  return null;
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

export const TEMPLATE_WRITER_SYSTEM = `You write story templates for algebra practice problems (Algebra 1 and Algebra 2), set in things a 12 to 16 year old loves. Each template is reused for many students with different numbers, so it must work for ANY numbers.

In each problem, numbers appear as placeholders: {1}, {2}, {3}. Each stands for a number that changes every time.

Write it the way a good textbook writer would:
- Natural English in complete sentences. Read it aloud: every phrase is something a person would really say. No telegraph style ("Build a rail line for a redstone contraption."), no chains of orders, no odd phrases ("ball weight you are hauling").
- A real reason for the math. Someone in that moment would actually need this number. Never invent an app, form, log, coach or sponsor that "needs the value in feet" or "wants the length in milliseconds": that is a made-up reason and it reads wrong. For a plain conversion, describe something in that world that really is measured that way (a stretch of track, a route, a song, a bag of flour) and ask for it in the other unit because the story needs it.
- Go deep into the interest. Use its real places, roles, rules, gear and moments from things_in_this_world, so a fan recognizes the scene: a specific moment with a goal, not the interest's name pasted onto an ordinary problem.
- When an interest comes with the_students_own_favorites (their teams, players, characters, games, artists), set the story among those by name: Messi lining up the penalty, Luffy's crew counting supplies. Those names are the point. Use what they wrote; invent no facts about real people beyond what the problem's numbers say.
- The answer has a job: the number the student finds is something they need inside the story. A few words of stakes help: a deadline, a record, the last seconds of a game.
- Units must make sense for what they measure, whatever the number: track in feet, a song in seconds, flour in cups.
- End on the question someone in that moment would ask, in plain words: "How many chests do you need to fill?", "How many feet of track is that?". Where the number is an estimate or a decision, "do you think" reads fine. Never "Your call:", "What is your call on...", or "What do you think the total is?". Exactly one right answer.
- True for any value of each placeholder. Give each placeholder a role that fits any number: "rows of {1} blocks", "{1} views per video". Never tie a placeholder to a fixed fact ("a three is worth {1}").
- It must read right whether a placeholder is 1 or 50: "with {2} on the floor", "a {2}-hour drive", never "{2} are on the floor", "{2} is left" or "in {2} hours".
- A negative coefficient means something is lost or used up per item: "you spend {1} gems per upgrade". Never "you scored -{1}x points".
- A unit fact or rounding rule in parentheses goes at the very end, after your question, word for word. Never weave it into a sentence.
- Write your own story. Do not reuse the wording of the examples below.
- Pick whichever of the student's interests fits each problem best, and spread them out. When a problem lists use_one_of, pick from those. When it lists stories_already_used, write a clearly different scene.
- The student is "you". Open with the moment, then the numbers, then the question. At most 3 sentences and 55 words.
- Step problems come with steps shown below your story, never changed, and a task: either "put the steps in the right order" or "find the step with the mistake". Never repeat the steps. Set the scene and ask exactly that task in the story's words ("What order gets your build done?" or "One step of the work below is wrong. Which one wrecked your plan?").
- Some problems are ideas with no numbers. Put the idea in a moment where it matters.
- Each problem lists copy_exactly: every equation or point in it goes into your story exactly as written, placeholders included. Step problems too: the student needs to know what the steps are solving.

Hard rules, because a program checks every template:
1. Use every placeholder at least once, invent none, and write no digits of your own. Placeholders are the only numbers.
2. Copy every equation, expression, function and point exactly as written, placeholders included: {1}x + {2} = {3} stays {1}x + {2} = {3}.
3. The question must have exactly the same answer as the original.
4. Never state or hint at the answer, never name the wrong step or the order of steps, never list the answer choices.
5. No quantity words (two, three, double, half). School-appropriate: no violence, weapons, dating, alcohol, drugs or gambling. A real player, team, creator or character the student named may do in the story what they do in their world, with the placeholders' numbers; nothing about anyone's private life, and no made-up records or quotes.
6. Plain text. No emoji, no markdown, no em dashes.
7. If a problem comes with your_rejected_version and rejected_because, fix exactly that.

Examples of the standard (the interests are ones students rarely pick, so write your own for theirs):
Original: "Solve for x: {1}x + {2} = {3}" (Gardening)
-> "Frost is coming tonight, and you want {3} seedlings in the ground before dark. Each row holds {1}, with {2} already planted, so {1}x + {2} = {3}. How many rows do you still have to dig?"
Original: "Convert {1} miles to feet. ({2} mile = {3} ft)" (Skateboarding)
-> "Your crew is filming a downhill line that runs {1} miles from the top of the hill to the skate park. How many feet of pavement will you roll before you get there? ({2} mile = {3} ft)"
Original: "Tickets cost \${1} (adult) and \${2} (child). {3} tickets sold for \${4}. How many adult tickets?" (Chess)
-> "You're running the door at your club's chess tournament. Adults pay \${1}, kids pay \${2}, and you sold {3} tickets for \${4} in all. How many adult tickets did you sell?"
Original: "Find the slope between ({1}, {2}) and ({3}, {4})." (Volleyball)
-> "Your coach charts your serving as (week, serves landed), and you went from ({1}, {2}) to ({3}, {4}). What is the slope, the extra serves you land each week?"
Original: "Put these steps in the correct order to solve {1}x − {2} = {3}:" (Hiking)
-> "Your trail app solves {1}x − {2} = {3} to split the climb into equal legs, but its steps got shuffled below. What order gets you to the summit?"

Never like these, which were rejected:
- "Your studio arm is {1} inches long and the software needs the value in feet for the mix." (a made-up reason; nobody needs a mic arm in feet)
- "With {2} mile = {3} ft in the math book, how many feet do you think that is?" (the unit fact woven into a sentence, and the math book inside the story)
- "Build a rail line for a redstone contraption. You must place {3} blocks total, have {2} laid already, and each row adds {1}." (telegraph style: orders and fragments)
- "Your team's equipment bag holds {1} kilograms of volleyballs; convert {1} kilograms to grams. How many grams of ball weight are you hauling?" (the textbook instruction pasted in, and an odd phrase)

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
  interests: { label: string; details: string; specifics?: string }[]
): string {
  return JSON.stringify({
    student_interests: interests.map((t) => ({
      interest: t.label,
      things_in_this_world: t.details,
      ...(t.specifics ? { the_students_own_favorites: t.specifics } : {}),
    })),
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
