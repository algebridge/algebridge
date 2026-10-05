/**
 * The order practice problems come in, so a session feels varied.
 *
 * A student wrote in (Oct 5 2026, Dimensional Analysis): "AlgeBridge uses the
 * same question, rewords it or just switches the numbers, and asks it as
 * another question." Banks are random, but a plain shuffle often dealt the same
 * kind of question twice close together ("convert 18 kg to grams", then "convert
 * 12 kg to grams"), and a new session could deal a question already answered.
 *
 * Three rules, all pure so the tests can hold them:
 *  - interleaveByShape: one of each kind in turn, so a kind comes back only
 *    after every other kind has had its turn.
 *  - freshFirst: questions this browser has shown before go to the back.
 *  - spreadShapes: after any later reordering (stories first), no kind twice
 *    in a row where something else can go between.
 */

import { canonicalPrompt } from "@/lib/problem-utils";

/** A problem's kind: its prompt with every number taken out. "Convert 18 kilograms to grams." -> "convert # kilograms to grams." */
export function shapeKey(prompt: string): string {
  return canonicalPrompt(prompt).replace(/\d[\d,]*(?:\.\d+)?/g, "#");
}

/**
 * Spreads every kind evenly over the whole list: a kind with n problems in a
 * list of N comes about every N/n places, so the first stretch of a session
 * holds one of each kind, a big kind never piles up at the end, and two of a
 * kind meet only when nothing else is left. Kinds tie in the order they first
 * appear (the list is already shuffled, so that order is random).
 */
export function interleaveByShape<T>(list: T[], key: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  const slots: { item: T; at: number; group: number }[] = [];
  let g = 0;
  for (const group of groups.values()) {
    const step = list.length / group.length;
    group.forEach((item, k) => slots.push({ item, at: (k + 0.5) * step, group: g }));
    g += 1;
  }
  slots.sort((x, y) => x.at - y.at || x.group - y.group);
  return spreadShapes(
    slots.map((x) => x.item),
    0,
    key,
  );
}

/** Problems already shown in this browser go after the rest, each part keeping its order. */
export function freshFirst<T>(list: T[], seen: (item: T) => boolean): T[] {
  return [...list.filter((p) => !seen(p)), ...list.filter(seen)];
}

/**
 * From `from` on, moves a problem that repeats the kind right before it behind
 * the next problem of another kind. Nothing before `from` moves, so the
 * problem on screen never changes under the student.
 */
export function spreadShapes<T>(list: T[], from: number, key: (item: T) => string): T[] {
  const out = [...list];
  const start = Math.max(from, 1);
  for (let i = start; i < out.length; i += 1) {
    const kind = key(out[i]);
    if (kind !== key(out[i - 1])) continue;
    // Bring the next problem of another kind forward to sit between them.
    const j = out.findIndex((p, k) => k > i && key(p) !== kind);
    if (j >= 0) {
      const [moved] = out.splice(j, 1);
      out.splice(i, 0, moved);
      continue;
    }
    // Nothing later is different (the end of the list): move this one back
    // into a gap between two other kinds, never before `from`.
    let gap = -1;
    for (let p = Math.max(from, 0); p < i - 1 && gap < 0; p += 1) {
      const before = p === 0 ? null : key(out[p - 1]);
      if (p >= from && before !== kind && key(out[p]) !== kind) gap = p;
    }
    if (gap < 0) continue;
    const [moved] = out.splice(i, 1);
    out.splice(gap, 0, moved);
  }
  return out.every((p, i) => p === list[i]) ? list : out;
}

// ---- What this browser has already shown, per skill --------------------------

const SEEN_LIMIT = 300;
const seenKey = (skillId: string) => `ab-seen:${skillId}`;

/** The questions this browser has shown for a skill, as canonical prompts. Empty when storage is unavailable. */
export function loadSeen(skillId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(seenKey(skillId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : []);
  } catch {
    return new Set();
  }
}

/** Remembers that a question was shown; keeps the latest few hundred per skill. */
export function rememberSeen(skillId: string, prompt: string): void {
  try {
    const key = canonicalPrompt(prompt);
    const list = [...loadSeen(skillId)].filter((p) => p !== key);
    list.push(key);
    window.localStorage.setItem(seenKey(skillId), JSON.stringify(list.slice(-SEEN_LIMIT)));
  } catch {
    /* storage unavailable: the session order still varies */
  }
}
