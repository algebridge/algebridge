import { evaluate, parseExpr, variablesOf, constValue, close } from "@/lib/mathexpr";

/**
 * Checks for the test review, done in code so they hold whatever the model says.
 *
 * Photo reading mangles handwriting: a minus dropped, "1" read as "|", stray
 * "#" and "==". A review that trusts those lines blames the student for the
 * reader's mistake, so such lines are flagged and their questions are shown
 * as "hard to read" instead of "missed".
 */

const MISREAD = /==|#|\||[{}[\]~@$%&\\]|\?\?|[^\x00-\x7F×÷−–√π²³·°≤≥≠]/;

/** The reader's own bracket tags ("[marked wrong]", "[-2 points]", "[unreadable]", "[name]") are not garbling. */
const TAGS = /\[[^\]\n]{1,40}\]/g;

export function looksMisread(line: string): boolean {
  return MISREAD.test(line.replace(TAGS, ""));
}

/** The raw transcript line for question n ("3)", "3.", "Q3"), if there is one. */
export function lineForQuestion(text: string, n: string): string | null {
  const num = n.replace(/\D/g, "");
  if (!num) return null;
  const re = new RegExp(`^\\s*(?:q(?:uestion)?\\s*)?${num}\\s*[).:]`, "i");
  return text.split("\n").find((l) => re.test(l)) ?? null;
}

/** 1-based numbers of non-empty lines that look misread, for the page to point at. */
export function misreadLines(text: string): number[] {
  return text.split("\n").flatMap((l, i) => (l.trim() && looksMisread(l) ? [i + 1] : []));
}

/**
 * What the photo reader said about the pictures. The reader answers with one
 * of two fixed words instead of a transcript when there is nothing to
 * transcribe, and writes "[unreadable]" where it could not make out a part.
 */
export type ReaderVerdict =
  | { kind: "not-a-test" }
  | { kind: "unreadable" }
  | { kind: "text"; text: string; unreadableParts: number };

export function readerVerdict(raw: string): ReaderVerdict {
  const text = raw.trim();
  const head = text.split("\n")[0]?.trim().replace(/[.!]+$/, "").toUpperCase() ?? "";
  if (head === "NOT_A_TEST" || head === "NOT A TEST") return { kind: "not-a-test" };
  if (head === "UNREADABLE") return { kind: "unreadable" };
  const unreadableParts = (text.match(/\[unreadable\]/gi) ?? []).length;
  // A transcript that is mostly holes is no better than none.
  const lines = text.split("\n").filter((l) => l.trim()).length;
  if (lines > 0 && unreadableParts >= lines) return { kind: "unreadable" };
  return { kind: "text", text, unreadableParts };
}

/** Photo limits: the page shrinks to 1600 px JPEG, so a page is ~300 KB; 4 MB is a safety stop. */
export const MAX_IMAGES = 6;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type TestImage = { media: "image/jpeg" | "image/png" | "image/webp"; data: string };

/** The photos from a request body: 1 to 6 data URLs of JPEG, PNG or WebP, each under the size limit. */
export function parseImages(raw: unknown): TestImage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_IMAGES) return null;
  const out: TestImage[] = [];
  for (const item of raw) {
    const m = typeof item === "string" ? item.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!m) return null;
    if (m[2].length * 0.75 > MAX_IMAGE_BYTES) return null;
    out.push({ media: m[1] as TestImage["media"], data: m[2] });
  }
  return out;
}

function tidy(s: string): string {
  return s.replace(/[−–‑]/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/[.?]\s*$/, "").trim();
}

function valueOf(answer: string): number | null {
  const v = constValue(tidy(answer).replace(/^[a-z]\s*=\s*/i, ""));
  return v !== null && Number.isFinite(v) ? v : null;
}

/**
 * Does an answer the model called correct hold up? true or false when the
 * problem is a kind code can check, null when it is not. Checked kinds: solve
 * one equation in one variable (plug the answer back in), slope through two
 * points, slope or y-intercept of y = mx + b. A false means the model's own
 * answer is wrong, so its verdict on that question cannot be trusted.
 */
export function checkAnswer(prompt: string, answer: string): boolean | null {
  const p = tidy(prompt);
  try {
    const solve = p.match(/solve\s*:?\s*(?:the\s+equation\s*:?\s*)?(?:for\s+[a-z]\s*:?\s*)?([^=<>]+=[^=<>]+?)(?:\s+for\s+[a-z])?$/i);
    if (solve) {
      const [l, r] = solve[1].split("=");
      const vars = new Set([...variablesOf(l), ...variablesOf(r)]);
      const v = valueOf(answer);
      if (vars.size !== 1 || v === null) return null;
      const name = [...vars][0];
      return close(evaluate(parseExpr(l), { [name]: v }), evaluate(parseExpr(r), { [name]: v }));
    }
    const pts = [...p.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    if (/slope/i.test(p) && pts.length === 2 && !/equation|write/i.test(p)) {
      const v = valueOf(answer);
      if (v === null || pts[0][0] === pts[1][0]) return null;
      return close(v, (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]));
    }
    const line = p.match(/y\s*=\s*([-+*/^().\d\sx]*x[-+*/^().\d\sx]*)/i);
    if (line && /slope|intercept/i.test(p) && !/x-intercept/i.test(p)) {
      const f = parseExpr(line[1]);
      const v = valueOf(answer);
      if (v === null || variablesOf(f).some((n) => n !== "x")) return null;
      const b = evaluate(f, { x: 0 });
      return /slope/i.test(p) ? close(v, evaluate(f, { x: 1 }) - b) : close(v, b);
    }
  } catch {
    return null;
  }
  return null;
}

export type QuestionStatus = "correct" | "wrong" | "partial" | "unclear";

export interface ReviewedQuestion {
  number: string;
  problem: string;
  studentAnswer: string | null;
  status: QuestionStatus;
  correctAnswer: string | null;
  mistake: string | null;
  fix: string | null;
  /** A curriculum skill id, when the model named a valid one. */
  skill: string | null;
}

/**
 * Which skills to practice after a review: the ones behind lost points
 * first, and when nothing was lost, the ones the test covered, so a perfect
 * score still ends in practice on the same material. Order follows the
 * test, at most `max` skills.
 */
export function skillsToPractice(questions: { status: QuestionStatus; skill: string | null }[], extra: string[] = [], max = 4): string[] {
  const missed = questions.filter((q) => q.status === "wrong" || q.status === "partial").map((q) => q.skill);
  const covered = questions.map((q) => q.skill);
  const pool = [...missed, ...extra, ...(missed.length || extra.length ? [] : covered)];
  const out: string[] = [];
  for (const id of pool) if (id && !out.includes(id)) out.push(id);
  return out.slice(0, max);
}
