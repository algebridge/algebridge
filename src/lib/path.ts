/**
 * The learning path: skills open in course order, like levels, the way
 * i-Ready and Imagine Math lay out a student's work. Finishing a skill (five
 * right) opens the next one; everything past it waits.
 *
 * A skill is open when any of these is true:
 *   - it is the first skill of the course;
 *   - the skill before it is complete;
 *   - the student already did real work on it (an answer or the video), so
 *     nobody loses a skill they had started before the path existed;
 *   - they passed "Show what you know" on it, three in a row right, which is
 *     how a student who already knows the material skips ahead;
 *   - their teacher assigned it;
 *   - they are a teacher or tutor, who need to see every lesson.
 *
 * Merely opening a page is not work: the course used to be open, and a
 * student who clicked through every unit would otherwise keep all of it.
 */

import { units } from "@/data/curriculum";
import type { SkillProgress, UserProgress } from "@/types";

export interface PathStep {
  unitId: string;
  unitNumber: number;
  skillId: string;
  title: string;
}

/** Every skill in course order. */
export const PATH: PathStep[] = units.flatMap((u) =>
  u.skills.map((s) => ({ unitId: u.id, unitNumber: u.number, skillId: s.id, title: s.title }))
);

const pathIndex = new Map(PATH.map((step, i) => [step.skillId, i]));

export type OpenReason = "first" | "path" | "started" | "checked" | "assigned" | "staff";

export type SkillAccess =
  | { open: true; why: OpenReason }
  | { open: false; after: PathStep };

export interface AccessContext {
  /** Teachers and tutors see the whole course. */
  staff?: boolean;
  /** Skills a teacher assigned to this student. */
  assigned?: ReadonlySet<string>;
}

export function isSkillComplete(p: SkillProgress | undefined): boolean {
  return p?.level === "proficient" || p?.level === "mastered";
}

/** Real work on a skill: an answer, the lesson video, or a passed check. */
export function hasWorkOn(p: SkillProgress | undefined): boolean {
  return !!p && (p.problemsAttempted > 0 || p.videoWatched || isSkillComplete(p) || p.openedBy === "check");
}

export function skillAccess(progress: UserProgress, skillId: string, ctx: AccessContext = {}): SkillAccess {
  const i = pathIndex.get(skillId);
  if (i === undefined || ctx.staff) return { open: true, why: "staff" };
  if (i === 0) return { open: true, why: "first" };
  const own = progress.skills[skillId];
  if (own?.openedBy === "check") return { open: true, why: "checked" };
  if (hasWorkOn(own)) return { open: true, why: "started" };
  const before = PATH[i - 1];
  if (isSkillComplete(progress.skills[before.skillId])) return { open: true, why: "path" };
  if (ctx.assigned?.has(skillId)) return { open: true, why: "assigned" };
  return { open: false, after: before };
}

/** A unit is open when any of its skills is. */
export function unitIsOpen(progress: UserProgress, unitId: string, ctx: AccessContext = {}): boolean {
  const unit = units.find((u) => u.id === unitId);
  return !!unit && unit.skills.some((s) => skillAccess(progress, s.id, ctx).open);
}

/** Today as YYYY-MM-DD in the student's own time zone. */
export function today(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "Show what you know" is one try a day per skill, so it cannot be guessed through. */
export function canTryCheck(p: SkillProgress | undefined, now = new Date()): boolean {
  return p?.checkedOn !== today(now);
}

/** How many in a row "Show what you know" asks for. */
export const CHECK_LENGTH = 3;
