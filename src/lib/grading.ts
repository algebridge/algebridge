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

/** Reads a typed answer as a number, or null when it is not one. */
export function parseNumericAnswer(raw: string): number | null {
  let s = String(raw ?? "")
    .trim()
    .replace(/[−–]/g, "-") // typographic minus and en dash
    .replace(/^[a-z]\s*\([^)]*\)\s*=\s*/i, "") // "f(4) = 11" is how function problems get answered
    .replace(/^[a-z]\s*=\s*/i, "") // "x = 5" is how a lot of students write 5
    .replace(/^\+\s*/, "") // "+4" for a common difference
    .replace(/^-\s+/, "-") // "- 1/3", with a space after the minus
    .replace(/^\$\s*/, "")
    .replace(/^(-)\s*\$\s*/, "$1");

  // A trailing unit or percent sign is not part of the number.
  s = s.replace(/\s*(%|[a-zA-Z][a-zA-Z .]*)$/, "").trim();
  if (!s) return null;

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

  if (typeof decimalPlaces === "number") {
    return roundTo(value, decimalPlaces) === roundTo(expected, decimalPlaces);
  }

  if (Math.abs(expected - value) <= 1e-9 * Math.max(1, Math.abs(expected))) return true;

  // A tiny answer (1/144 is 0.0069...) is judged by how close, not by rounding:
  // rounded to two places it is 0.00, and "0" is not what the student worked out.
  if (Math.abs(expected) < 0.01) return value !== 0 && Math.abs(expected - value) <= 0.05 * Math.abs(expected);

  const places = typedDecimals(given);
  if (places >= 2 && roundTo(expected, places) === roundTo(value, places)) return true;

  // The old tolerance, kept so nothing that used to pass starts failing.
  return Math.abs(expected - value) < 0.001;
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
  problem: { type: string; answer?: string | number; decimalPlaces?: number },
  userAnswer: string
): boolean {
  if (problem.type === "multiple-choice") {
    return normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer ?? "");
  }
  if (problem.type === "numeric") {
    // Fractions, correctly rounded decimals, units and thousands commas all
    // count. See numericAnswerMatches for why each one used to fail.
    const expected = Number(problem.answer);
    if (String(problem.answer ?? "").trim() !== "" && Number.isFinite(expected)) {
      const dp = typeof problem.decimalPlaces === "number" ? problem.decimalPlaces : undefined;
      if (numericAnswerMatches(expected, userAnswer, dp)) return true;
    }
    return normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer ?? "");
  }
  return false;
}
