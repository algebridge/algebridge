export interface TutorContext {
  skillTitle: string;
  keyIdea: string;
  learningGoal: string;
  problemPrompt: string;
  hint: string;
  explanation: string;
  userAttempt?: string;
  wrongAttempts?: number;
}

export interface TutorChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Strips markdown emphasis syntax (**bold**, __bold__, *italic*, _italic_) so
 * hint text never shows literal asterisks/underscores, the tutor UI renders
 * plain text, not markdown. Keeps the wrapped words, just drops the markers.
 */
export function stripMarkdownEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "$1")
    .replace(/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "$1");
}

// ---------------------------------------------------------------------------
// Problem analysis, lets the built-in tutor give guidance specific to THIS
// problem (which operation to undo first, whether to flip an inequality, …)
// rather than only restating the generic hint. Never reveals the final answer.
// ---------------------------------------------------------------------------
/**
 * Units by what they measure, each with the ways it is written. A conversion
 * stays inside one kind: miles to feet, hours to seconds.
 */
const UNITS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  length: {
    inch: ["inch", "inches"],
    foot: ["foot", "feet", "ft"],
    yard: ["yard", "yards", "yd", "yds"],
    mile: ["mile", "miles", "mi"],
    millimeter: ["millimeter", "millimeters", "mm"],
    centimeter: ["centimeter", "centimeters", "cm"],
    meter: ["meter", "meters"],
    kilometer: ["kilometer", "kilometers", "km"],
  },
  time: {
    second: ["second", "seconds", "sec", "secs"],
    minute: ["minute", "minutes", "min", "mins"],
    hour: ["hour", "hours", "hr", "hrs"],
    day: ["day", "days"],
    week: ["week", "weeks"],
    month: ["month", "months"],
    year: ["year", "years", "yr", "yrs"],
  },
  mass: {
    ounce: ["ounce", "ounces", "oz"],
    pound: ["pound", "pounds", "lb", "lbs"],
    ton: ["ton", "tons"],
    gram: ["gram", "grams"],
    milligram: ["milligram", "milligrams", "mg"],
    kilogram: ["kilogram", "kilograms", "kg"],
  },
  volume: {
    cup: ["cup", "cups"],
    pint: ["pint", "pints", "pt"],
    quart: ["quart", "quarts", "qt"],
    gallon: ["gallon", "gallons", "gal"],
    liter: ["liter", "liters", "litre", "litres"],
    milliliter: ["milliliter", "milliliters", "ml"],
  },
};

function unitOf(word: string): { kind: string; unit: string } | null {
  const w = word.toLowerCase();
  for (const [kind, units] of Object.entries(UNITS))
    for (const [unit, spellings] of Object.entries(units)) if (spellings.includes(w)) return { kind, unit };
  return null;
}

/** "3 miles", "500-milliliter", "2.5 hrs": the amounts a problem gives, with their units. */
function amountsIn(text: string): { kind: string; unit: string }[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?\s*-?\s*([a-z]+)/gi)].flatMap((m) => unitOf(m[1]) ?? []);
}

/**
 * A unit conversion: no x to undo, and the check is converting back. It is
 * one when the problem says "convert" about units, when it asks "how many
 * feet" about an amount given in another unit of the same kind, or, on a
 * units skill, when it gives amounts in two units of one kind ("150
 * seconds", "3 hours"). "How many weeks until Jordan has $130?" asks for
 * weeks with no other time given: an equation to set up, not a conversion.
 * Neither is "Convert 2x + 4y = 8 to slope-intercept form".
 */
export function isUnitConversion(prompt: string, skillTitle = ""): boolean {
  const p = prompt.replace(/\s+/g, " ").trim();
  const given = amountsIn(p);
  if (/\bconver(t|ts|ting|sion)\b/i.test(p)) return given.length > 0 || p.split(/[^a-z]+/i).some((w) => unitOf(w));
  const asked = /\bhow many (?:\d[\d,]*(?:\.\d+)?\s*-?\s*)?([a-z]+)\b/i.exec(p);
  const want = asked ? unitOf(asked[1]) : null;
  if (want && given.some((g) => g.kind === want.kind && g.unit !== want.unit)) return true;
  if (/\b(units?|dimensional|conversions?)\b/i.test(skillTitle))
    return given.some((a) => given.some((b) => a.kind === b.kind && a.unit !== b.unit));
  return false;
}

function firstStepFor(prompt: string, skillTitle = ""): string | null {
  const p = prompt.replace(/\s+/g, " ").trim();

  // Unit conversion. Checked first: these have no x to undo, and the generic
  // "what's the first operation you'd undo?" left a student with nothing.
  if (isUnitConversion(p, skillTitle)) {
    const rate = /\bper\b/i.test(p);
    return `This is a unit conversion. Turn the fact you know into that fraction, with the unit you want to get rid of on the bottom so it cancels, then multiply.${
      rate ? " With a rate, change one unit at a time: one fraction for the top unit, another for the bottom one." : ""
    }`;
  }

  // ax + b = c  or  ax - b = c   (two-step linear)
  let m = p.match(/(-?\d+)\s*x\s*([+\-−])\s*(\d+)\s*=/);
  if (m) {
    const sign = m[2] === "+" ? "add" : "subtract";
    const undo = sign === "add" ? "subtract" : "add";
    const b = m[3];
    return `This is a two-step equation. Undo the "${sign === "add" ? "+" : "−"} ${b}" first by ${undo}ing ${b} from BOTH sides, then divide both sides by the number in front of x.`;
  }

  // x + b = c  or  x - b = c   (one-step add/subtract)
  m = p.match(/(?:^|[^0-9])x\s*([+\-−])\s*(\d+)\s*=/);
  if (m) {
    const undo = m[1] === "+" ? "subtract" : "add";
    return `x is by itself except for a "${m[1] === "+" ? "+" : "−"} ${m[2]}". Do the opposite to BOTH sides: ${undo} ${m[2]}.`;
  }

  // ax = c   (one-step multiply/divide)
  m = p.match(/(-?\d+)\s*x\s*=/);
  if (m && m[1] !== "1" && m[1] !== "-1") {
    return `x is being multiplied by ${m[1]}. Undo that by dividing BOTH sides by ${m[1]}.`;
  }

  // inequality
  if (/[<>]=?|≤|≥/.test(p) && /x/.test(p)) {
    return `Solve it just like an equation to get x by itself, but remember: if you multiply or divide both sides by a NEGATIVE number, flip the inequality sign.`;
  }

  // quadrant / coordinate
  m = p.match(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
  if (m && /quadrant/i.test(p)) {
    const xs = m[1].startsWith("-") ? "negative" : "positive";
    const ys = m[2].startsWith("-") ? "negative" : "positive";
    return `Look at the SIGNS: the x-coordinate is ${xs} and the y-coordinate is ${ys}. Quadrants go counter-clockwise starting from the top-right (+, +).`;
  }

  // slope between two points
  if (/slope/i.test(p) && /\(.*\).*\(.*\)/.test(p)) {
    return `Slope = rise over run = (change in y) ÷ (change in x). Subtract the y-values on top, the x-values on the bottom, keep the points in the same order.`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Conversational fallback for the chat tutor (used when no AI key is set).
// Classifies the student's latest message and responds Socratically without
// ever revealing the final answer.
// ---------------------------------------------------------------------------
export function buildLocalChatReply(ctx: TutorContext, messages: TutorChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const text = last.toLowerCase().trim();
  const priorTutorTurns = messages.filter((m) => m.role === "assistant").length;
  const firstStep = firstStepFor(ctx.problemPrompt, ctx.skillTitle);

  const isGreeting = /^(hi|hey|hello|yo|sup|hiya)\b/.test(text) || text.length === 0;
  const wantsHint = /\b(hint|help|stuck|lost|confus|don'?t (get|understand|know)|no idea|how do i|where do i start|start)\b/.test(text);
  const claimsAnswer = /\b(is it|answer is|i got|equals?|=)\b/.test(text) && /-?\d/.test(text);
  const wantsWhy = /\b(why|how come|what does|what is|explain)\b/.test(text);
  const wantsNext = /\b(next|then what|after that|now what|what now)\b/.test(text);

  if (isGreeting) {
    return `Hey! I'm Archie, your AI study buddy for ${ctx.skillTitle}. Tell me where you're stuck on "${ctx.problemPrompt}", or just say "give me a hint" and we'll take it one step at a time. I won't hand you the answer, but I'll help you get there.`;
  }

  if (claimsAnswer) {
    // A conversion has no equation to substitute into; the check is the trip back.
    if (isUnitConversion(ctx.problemPrompt, ctx.skillTitle)) {
      return `Nice, let's check it yourself instead of me telling you: convert your answer back to the unit you started with. If you land on the amount in the problem, you have it. What do you get on the way back?`;
    }
    return `Nice, instead of me telling you if that's right, let's PROVE it: take your value and substitute it back into "${ctx.problemPrompt}". If both sides come out equal, you nailed it. Does it check out? Show me what you get when you plug it in.`;
  }

  if (wantsWhy) {
    return `Good question, that's the important part. The key idea here: ${ctx.keyIdea}\n\nDoes that help it click? If not, tell me which part feels fuzzy and I'll zoom in.`;
  }

  if (wantsNext) {
    return `${firstStep ? firstStep + "\n\n" : ""}Do that step, then tell me the new version of the problem. What does it look like now?`;
  }

  if (wantsHint || priorTutorTurns === 0) {
    if (priorTutorTurns <= 1) {
      return `Let's start here: ${ctx.keyIdea}\n\n${firstStep ? firstStep : `Look at "${ctx.problemPrompt}", what's the first operation you'd undo?`}\n\nTry just that first step and tell me what you get.`;
    }
    return `More specific nudge: ${ctx.hint}\n\nApply that one small step and show me the result, we'll take the next one together.`;
  }

  // Default: treat their message as a work-in-progress and keep them moving.
  return `Okay, walk me through your thinking on that. ${firstStep ? "Remember: " + firstStep : "Remember the key idea: " + ctx.keyIdea}\n\nWhat do you get after your next step?`;
}

export async function fetchTutorChat(
  ctx: TutorContext,
  messages: TutorChatMessage[]
): Promise<{ message: string; source: "ai" | "local" }> {
  try {
    const res = await fetch("/api/tutor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: ctx, messages }),
    });
    if (!res.ok) throw new Error("Tutor chat API failed");
    const data = (await res.json()) as { message: string; source: "ai" | "local" };
    return { ...data, message: stripMarkdownEmphasis(data.message) };
  } catch {
    return { message: buildLocalChatReply(ctx, messages), source: "local" };
  }
}
