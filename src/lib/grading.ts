/**
 * Grading a typed number.
 *
 * The old check compared `Number(input)` to the key with a 0.001 tolerance,
 * which marked real answers wrong in three common ways: a fraction ("5/3" for
 * a slope of 1.666...), a sensibly rounded decimal ("1.67"), and a number with
 * its unit or a thousands comma still on it ("168 miles", "15,840"). With a
 * skill finished by five right answers, each of those cost a student a point
 * they had earned.
 *
 * Shared by the practice panel and by the server that checks AI-written
 * problems, so a rewrite is judged by exactly the rule a student is.
 */

import { constValue, normalizeMath } from "@/lib/mathexpr";

/** The fractions a phone keyboard, the math keys or a paste can produce. */
const VULGAR: Record<string, string> = {
  "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6", "⅐": "1/7", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅑": "1/9", "⅒": "1/10",
};
const VULGAR_CHARS = Object.keys(VULGAR).join("");
const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
};

/**
 * One spelling for the symbols that only change how a number looks: minus
 * signs, fraction slashes, ÷ between two numbers, ½-style fractions ("2½" is
 * the mixed number 2 1/2), superscript powers ("10⁻⁴" is 10^-4), and the
 * "x =", "f(4) =" and "≈" a student writes in front of an answer.
 */
function tidy(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/[−–]/g, "-") // typographic minus and en dash
    .replace(/[⁄∕÷]/g, "/")
    .replace(new RegExp(`(\\d)\\s*([${VULGAR_CHARS}])`, "g"), (_, d: string, f: string) => `${d} ${VULGAR[f]}`)
    .replace(new RegExp(`[${VULGAR_CHARS}]`, "g"), (f) => VULGAR[f])
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => "^" + Array.from(run).map((c) => SUPERSCRIPT[c]).join(""))
    .replace(/^[a-z]\s*\([^)]*\)\s*[=≈]\s*/i, "") // "f(4) = 11" is how function problems get answered
    .replace(/^[a-z]\s*[=≈]\s*/i, "") // "x = 5" is how a lot of students write 5
    .replace(/^≈\s*/, "");
}

/** Reads a typed answer as a number, or null when it is not one. */
export function parseNumericAnswer(raw: string): number | null {
  let s = tidy(raw)
    .replace(/^\+\s*/, "") // "+4" for a common difference
    .replace(/^-\s+/, "-") // "- 1/3", with a space after the minus
    .replace(/^\$\s*/, "")
    .replace(/^(-)\s*\$\s*/, "$1");

  // A trailing unit or percent sign is not part of the number.
  s = s.replace(/\s*(%|[a-zA-Z][a-zA-Z .]*)$/, "").trim();
  if (!s) return null;

  // Scientific notation: "3.5 × 10^4", "3.5x10^4", "3.5*10^(-4)", "3.5e4".
  const sci =
    s.match(/^(-?\d+(?:\.\d+)?)\s*(?:[×x*·]|times)\s*10\s*\^\s*\(?\s*(-?\d+)\s*\)?$/i) ?? s.match(/^(-?\d+(?:\.\d+)?)e([+-]?\d+)$/i);
  if (sci) {
    const v = Number(sci[1]) * Math.pow(10, Number(sci[2]));
    return Number.isFinite(v) && Math.abs(Number(sci[2])) <= 40 ? v : null;
  }

  // Mixed number: "1 2/3".
  const mixed = s.match(/^(-?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const den = Number(mixed[4]);
    if (den === 0) return null;
    const value = Number(mixed[2]) + Number(mixed[3]) / den;
    return mixed[1] ? -value : value;
  }

  // Fraction: "5/3", "-1/7", "1 / 8".
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) return null;
    return Number(frac[1]) / den;
  }

  // A power: "3^6" for 729, "2^(-3)" for 1/8. Exponent problems invite it.
  const power = s.match(/^(-?\d+(?:\.\d+)?)\s*\^\s*\(?\s*(-?\d+(?:\/\d+)?)\s*\)?$/);
  if (power) {
    const [top, bottom] = power[2].split("/").map(Number);
    const exponent = bottom ? top / bottom : top;
    const v = Math.pow(Number(power[1]), exponent);
    return Number.isFinite(v) && Math.abs(exponent) <= 40 ? v : null;
  }

  // Thousands separators: "15,840" and "1,000,000", never "1,5".
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");

  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Decimal places the student actually typed, e.g. 2 for "1.67". */
function typedDecimals(raw: string): number {
  const m = String(raw).trim().match(/\.(\d+)\s*(%|[a-zA-Z][a-zA-Z .]*)?$/);
  return m ? m[1].length : 0;
}

/** "45%" and "45 %": an amount written as a percent. */
function typedPercent(raw: string): boolean {
  return /%\s*$/.test(String(raw));
}

/** Rounds half away from zero, the way it is taught: -0.125 is -0.13 to two places, like 0.125 is 0.13. */
function roundTo(n: number, places: number): number {
  const f = Math.pow(10, places);
  const x = Math.abs(n) * f;
  return (Math.sign(n) * Math.round(x + 1e-9 * Math.max(1, x))) / f;
}

/**
 * Does a typed answer match the key?
 *
 * - When the problem names a rounding place, both sides are rounded to it.
 * - An exact value always matches, which is what lets "5/3" through.
 * - A decimal typed to two or more places matches when it is the key
 *   correctly rounded to that many places, so "1.67" is right for 5/3 and
 *   "1.66" is not. One place is too coarse to count: "0.1" is not 0.125.
 */
export function numericAnswerMatches(
  expected: number,
  given: string,
  decimalPlaces?: number
): boolean {
  const value = parseNumericAnswer(given);
  if (value === null || !Number.isFinite(expected)) return false;
  const places = typedDecimals(given);
  if (valueMatches(expected, value, decimalPlaces, places)) return true;
  // "45%" for a share of 0.45 is the same amount, written as a percent.
  return typedPercent(given) && valueMatches(expected, value / 100, decimalPlaces, places + 2);
}

/** Is a value the key? `places` is how many decimals the student typed. */
function valueMatches(expected: number, value: number, decimalPlaces: number | undefined, places: number): boolean {
  if (typeof decimalPlaces === "number") {
    return roundTo(value, decimalPlaces) === roundTo(expected, decimalPlaces);
  }

  if (Math.abs(expected - value) <= 1e-9 * Math.max(1, Math.abs(expected))) return true;

  // A tiny answer (1/144 is 0.0069...) is judged by how close, not by rounding:
  // rounded to two places it is 0.00, and "0" is not what the student worked out.
  if (Math.abs(expected) < 0.01) return value !== 0 && Math.abs(expected - value) <= 0.05 * Math.abs(expected);

  if (places >= 2 && roundTo(expected, places) === roundTo(value, places)) return true;

  // The old tolerance, kept so nothing that used to pass starts failing.
  return Math.abs(expected - value) < 0.001;
}

/**
 * The value of typed arithmetic: "(3 + √17)/2", "500 × 1.04^3", "4π", "2√3".
 * Null for anything with a variable in it, or that does not read as math.
 */
export function expressionValue(raw: string): number | null {
  const s = tidy(raw)
    .replace(/^\$\s*/, "")
    .replace(/(\d)\s*x\s*(?=[\d(])/gi, "$1×"); // "3x4" typed for 3 × 4
  const v = constValue(s) ?? constValue(s.replace(/\s+[a-zA-Z][a-zA-Z .]*$/, "")); // "562.43 dollars"
  return v !== null && Number.isFinite(v) ? v : null;
}

/** One spelling to compare with: no spaces, one minus, one times. */
function compact(text: string): string {
  return normalizeMath(tidy(text)).toLowerCase().replace(/(\d)x(?=\d)/g, "$1*").replace(/\s+/g, "");
}

/**
 * Is the typed answer the problem's own arithmetic, copied back? "2^5" for
 * "Evaluate 2^5", "√49" for "Simplify √49", "3.5 × 10^4" for "Write 3.5 ×
 * 10^4 in standard form". Those equal the answer without being one. A plain
 * number or fraction is never caught: "2/3" is the answer to "a line parallel
 * to one with slope 2/3".
 */
export function copiesPrompt(given: string, prompt: string): boolean {
  const typed = compact(given);
  const work = /[\^√*+π]|\d-\d|\de[+-]?\d/.test(typed);
  return work && typed.length >= 2 && compact(prompt).includes(typed);
}

/**
 * How a typed answer reads:
 * - "right" and "wrong" are judged answers.
 * - "simplify" is arithmetic that is not finished: an expression where the
 *   arithmetic is part of the skill, or the problem's own expression copied
 *   back. Nothing is judged, so it costs no try.
 * - "unreadable" is something that is not a number at all, like a typo. It
 *   costs no try either.
 */
export type TypedVerdict = "right" | "wrong" | "simplify" | "unreadable";

export interface TypedOptions {
  decimalPlaces?: number;
  /**
   * Typed arithmetic is judged by its value, the way the calculator is
   * offered: where the numbers are bookkeeping around the idea.
   */
  expressions?: boolean;
  /** The problem as shown, so its own expression typed back is not an answer. */
  prompt?: string;
}

export function gradeTyped(expected: number, given: string, opts: TypedOptions = {}): TypedVerdict {
  if (!String(given ?? "").trim()) return "unreadable";
  if (parseNumericAnswer(given) !== null) {
    const right = numericAnswerMatches(expected, given, opts.decimalPlaces);
    if (right && opts.prompt && copiesPrompt(given, opts.prompt)) return "simplify";
    return right ? "right" : "wrong";
  }
  const value = expressionValue(given);
  if (value === null) return "unreadable";
  if (!opts.expressions) return "simplify";
  const right = valueMatches(expected, value, opts.decimalPlaces, 0);
  if (right && opts.prompt && copiesPrompt(given, opts.prompt)) return "simplify";
  return right ? "right" : "wrong";
}

function normalizeAnswer(val: string | number): string {
  // "−3" and "-3" are the same answer, whichever minus a generator typed.
  return String(val).trim().toLowerCase().replace(/\s+/g, "").replace(/[−–]/g, "-");
}

/**
 * Is this answer right, for a problem answered by typing or by picking a
 * choice? Step problems are graded where their steps are arranged.
 */
export function answerIsRight(
  problem: { type: string; answer?: string | number; decimalPlaces?: number; prompt?: string },
  userAnswer: string,
  opts: { expressions?: boolean } = {}
): boolean {
  return gradeAnswer(problem, userAnswer, opts) === "right";
}

/**
 * answerIsRight, with the two readings that are neither: unfinished
 * arithmetic and something that is not a number. The practice card says what
 * to fix for those instead of spending the student's first try.
 */
export function gradeAnswer(
  problem: { type: string; answer?: string | number; decimalPlaces?: number; prompt?: string },
  userAnswer: string,
  opts: { expressions?: boolean } = {}
): TypedVerdict {
  if (problem.type === "multiple-choice") {
    return normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer ?? "") ? "right" : "wrong";
  }
  if (problem.type === "numeric") {
    // Fractions, correctly rounded decimals, units and thousands commas all
    // count. See numericAnswerMatches for why each one used to fail.
    const expected = Number(problem.answer);
    if (String(problem.answer ?? "").trim() !== "" && Number.isFinite(expected)) {
      const dp = typeof problem.decimalPlaces === "number" ? problem.decimalPlaces : undefined;
      const verdict = gradeTyped(expected, userAnswer, { decimalPlaces: dp, expressions: opts.expressions, prompt: problem.prompt });
      if (verdict !== "wrong" && verdict !== "unreadable") return verdict;
      if (normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer ?? "")) return "right";
      return verdict;
    }
    return normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer ?? "") ? "right" : "wrong";
  }
  return "wrong";
}
