/**
 * The backyard rink: where it sits, what stands around it, which problems
 * Veronica skates you into, and what solving them pays.
 *
 * The rink is an ice rink on the lawn behind the house, boards and all,
 * drawn on the same 1200 x 800 plane as the front (see dollhouse.ts). Problems come from the
 * skills the student has already finished, which makes the rink the place
 * finished work comes back to: spaced review that feels like a game.
 */

import { units } from "@/data/curriculum";
import { getFreshProblemsForSkill } from "@/data/problem-banks";
import { generateProblemBank } from "@/data/skill-problem-generators";
import { SCENE_W } from "@/lib/dollhouse";
import { bridgeysForSkill } from "@/lib/gamification";
import { stripVariantTag } from "@/lib/personalize";
import type { PracticeProblem, UserProgress } from "@/types";

/** The rink, as an ellipse in scene units. */
export const RINK = { cx: SCENE_W / 2, cy: 600, rx: 400, ry: 130 } as const;

/** The back of the house, which the backyard looks at. Two storeys, like the front. */
export const BACK_HOUSE = { left: 220, right: 980, wallTop: 118, base: 402, apex: 22 } as const;

/** Where the boards stand: the rink plus a little for the rail. */
export const BOARD = 14;

export interface RinkSlot {
  id: string;
  /** Scene units, at the object's feet. */
  x: number;
  y: number;
  /** Size multiplier: things behind the rink are further away. */
  scale: number;
  /** Paint order; larger draws later (in front). */
  depth: number;
  label: string;
}

/** Fixed places a decoration can stand, so the rink stays a rink. */
export const RINK_SLOTS: RinkSlot[] = [
  { id: "back-left", x: 330, y: 452, scale: 0.9, depth: 1, label: "back left" },
  { id: "back-center", x: 600, y: 446, scale: 0.9, depth: 1, label: "back centre" },
  { id: "back-right", x: 870, y: 452, scale: 0.9, depth: 1, label: "back right" },
  { id: "left", x: 112, y: 664, scale: 1.05, depth: 3, label: "left end" },
  { id: "right", x: 1088, y: 664, scale: 1.05, depth: 3, label: "right end" },
  { id: "front-left", x: 300, y: 792, scale: 1.15, depth: 5, label: "front left" },
  { id: "front-right", x: 900, y: 792, scale: 1.15, depth: 5, label: "front right" },
];

export function getRinkSlot(id: string): RinkSlot | undefined {
  return RINK_SLOTS.find((s) => s.id === id);
}

/** Is a point on the rink, kept `margin` units in from the boards? */
export function onRink(x: number, y: number, margin = 0): boolean {
  const dx = (x - RINK.cx) / (RINK.rx - margin);
  const dy = (y - RINK.cy) / (RINK.ry - margin);
  return dx * dx + dy * dy <= 1;
}

/** The nearest point on the rink to one that has left it. */
export function clampToRink(x: number, y: number, margin = 0): { x: number; y: number } {
  if (onRink(x, y, margin)) return { x, y };
  const rx = RINK.rx - margin;
  const ry = RINK.ry - margin;
  const a = Math.atan2((y - RINK.cy) / ry, (x - RINK.cx) / rx);
  return { x: RINK.cx + rx * Math.cos(a), y: RINK.cy + ry * Math.sin(a) };
}

/**
 * The unit a student is on: the one holding their first unfinished skill in
 * course order, or the last unit once everything is done.
 */
export function currentUnit(progress: UserProgress) {
  for (const u of units) {
    const unfinished = u.skills.some((s) => {
      const lvl = progress.skills[s.id]?.level;
      return lvl !== "proficient" && lvl !== "mastered";
    });
    if (unfinished) return u;
  }
  return units[units.length - 1];
}

/**
 * Which skills feed the rink: the unit the student is on, all of it, so the
 * rink is about what they are learning this week. A unit with nothing that
 * works in the head (the money and decimal units) hands over to the unit
 * before it.
 */
export function rinkSkillIds(progress: UserProgress): { ids: string[]; unitId: string; unitNumber: number; borrowed: boolean } {
  const here = currentUnit(progress);
  const hasHeadMath = (u: (typeof units)[number]) =>
    u.skills.some((s) => generateProblemBank(s.id, s.problems, 7).some((p) => isHeadMath(p as PracticeProblem)));
  let unit = here;
  let borrowed = false;
  while (!hasHeadMath(unit) && unit.number > 1) {
    unit = units[unit.number - 2];
    borrowed = true;
  }
  return { ids: unit.skills.map((s) => s.id), unitId: unit.id, unitNumber: unit.number, borrowed };
}

/** What a rink problem pays: a slice of what the skill paid to finish. */
export function rinkPayFor(skillId: string): number {
  return Math.max(2, Math.round(bridgeysForSkill(skillId) / 4));
}

/** The most the rink pays in a day, so it is a place to review, never a mine. */
export const RINK_DAILY_CAP = 60;

export function rinkRemainingToday(progress: UserProgress, day: string): number {
  const r = progress.rink;
  if (!r || r.day !== day) return RINK_DAILY_CAP;
  return Math.max(0, RINK_DAILY_CAP - r.earned);
}

/**
 * Head math only. Veronica is skating, so a rink problem has to be one you
 * can hold in your head: small whole numbers in, a whole number out, and
 * short. Anything with decimals, money, rounding or big numbers stays in the
 * lesson where the calculator is.
 */
export const HEAD_MAX_NUMBER = 50;
export const HEAD_MAX_ANSWER = 100;
/** Anything multiplied or divided by has to be a times-table number. */
export const HEAD_MAX_FACTOR = 12;

export function isHeadMath(p: PracticeProblem): boolean {
  if (p.type !== "numeric" && p.type !== "multiple-choice") return false;
  if (p.answer === undefined || p.answer === null) return false;
  const prompt = stripVariantTag(p.prompt);
  if (prompt.length > 110) return false;
  if (/\d\.\d|\$|%|round|nearest|hundredth|tenth|scientific|\^\(|\d{3,}/i.test(prompt)) return false;
  const numbers = prompt.match(/\d+/g) ?? [];
  if (numbers.some((n) => Number(n) > HEAD_MAX_NUMBER)) return false;
  // Coefficients ("7x"), divisors ("x/4", "÷ 6") and products ("6 × 7"): times tables only.
  const factors = [
    ...[...prompt.matchAll(/(\d+)\s*[a-z]\b/gi)].map((m) => m[1]),
    ...[...prompt.matchAll(/[\/÷]\s*(\d+)/g)].map((m) => m[1]),
    ...[...prompt.matchAll(/(\d+)\s*[×*]\s*(\d+)/g)].flatMap((m) => [m[1], m[2]]),
  ];
  if (factors.some((n) => Number(n) > HEAD_MAX_FACTOR)) return false;
  if (p.type === "numeric") {
    const a = Number(p.answer);
    return Number.isInteger(a) && Math.abs(a) <= HEAD_MAX_ANSWER;
  }
  return (p.choices ?? []).every((c) => c.length <= 24);
}

export interface RinkProblem {
  skillId: string;
  skillTitle: string;
  unitId: string;
  unitNumber: number;
  problem: PracticeProblem;
}

/** A head-math problem from the unit the student is on, a different one each time. */
export function pickRinkProblem(progress: UserProgress, avoid = new Set<string>()): RinkProblem | null {
  const { ids } = rinkSkillIds(progress);
  const order = [...ids].sort(() => Math.random() - 0.5);
  for (const skillId of order) {
    const unit = units.find((u) => u.skills.some((s) => s.id === skillId));
    const skill = unit?.skills.find((s) => s.id === skillId);
    if (!unit || !skill) continue;
    const pool = getFreshProblemsForSkill(skillId, skill.problems).filter((p) => isHeadMath(p) && !avoid.has(p.prompt));
    if (!pool.length) continue;
    return { skillId, skillTitle: skill.title, unitId: unit.id, unitNumber: unit.number, problem: pool[Math.floor(Math.random() * pool.length)] };
  }
  return null;
}
