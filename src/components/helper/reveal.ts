/**
 * When each word of one of Archie's replies appears, in ms from the start.
 *
 * Natural pacing, not a metronome: a short beat after a comma, a longer one
 * after a sentence, a longer one again at a line break, and a little more for
 * a long word. Short replies run quicker so a one-liner never drags, and the
 * whole thing is squeezed to fit under `cap`, so even a worked example is in
 * full view in under three seconds. Pure, so the helper tests can pin it.
 */

export interface RevealWord {
  text: string;
  /** The last word on its line or paragraph. */
  eol?: boolean;
}

export const REVEAL_CAP_MS = 2600;

export function revealSchedule(words: readonly RevealWord[], cap = REVEAL_CAP_MS): number[] {
  const n = words.length;
  if (n === 0) return [];
  const short = n <= 12;
  // Per word: brisk for a one-liner, a touch slower for a real explanation.
  const base = short ? 30 : Math.min(44, 30 + n * 0.25);
  const pause = short ? 0.6 : 1;
  const gaps: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const w = words[i];
    const t = w.text.trim();
    let gap = base + Math.min(24, Math.max(0, t.length - 5) * 3);
    if (w.eol) gap += 240 * pause;
    else if (/[.!?]["')\]]*$/.test(t) && !/^\d+\.$/.test(t)) gap += 200 * pause;
    else if (/[,;:]["')\]]*$/.test(t)) gap += 90 * pause;
    gaps.push(gap);
  }
  const total = gaps.reduce((a, b) => a + b, 0);
  const scale = total > cap ? cap / total : 1;
  const out = [0];
  let at = 0;
  for (const g of gaps) {
    at += g * scale;
    out.push(Math.round(at));
  }
  return out;
}

/**
 * A line split into words and the spaces between them, for the reveal. A
 * power with spaces in its brackets, like "2^(x + 1)", stays one word: cut
 * at its spaces, MathText would see "2^(x" and never raise it, and the words
 * are fixed once the reveal starts, so it would stay broken after it ends.
 * The same bracket rule as MathText's POWER (up to 12 characters inside).
 */
export function revealParts(text: string): string[] {
  return text.match(/\s+|(?:\^\([^()]{1,12}\)|\S)+/g) ?? [];
}
