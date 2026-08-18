import { getSkill, getUnit } from "@/data/curriculum";
import type { ClassAssignment, UserProgress } from "@/types";

/** Every skill an assignment covers (one skill, or the whole unit). */
export function assignmentSkillIds(assignment: ClassAssignment): string[] {
  const unit = getUnit(assignment.unitId);
  if (!unit) return [];
  if (assignment.skillId) {
    return unit.skills.some((s) => s.id === assignment.skillId) ? [assignment.skillId] : [];
  }
  return unit.skills.map((s) => s.id);
}

/** Display title — the teacher's own wording wins, otherwise the curriculum's. */
export function assignmentTitle(assignment: ClassAssignment): string {
  if (assignment.title) return assignment.title;
  if (assignment.skillId) {
    const skill = getSkill(assignment.unitId, assignment.skillId);
    if (skill) return skill.title;
  }
  const unit = getUnit(assignment.unitId);
  return unit ? `Unit ${unit.number}: ${unit.title}` : "Assigned work";
}

export function assignmentSubtitle(assignment: ClassAssignment): string {
  const unit = getUnit(assignment.unitId);
  if (!unit) return "";
  if (assignment.skillId) return `Unit ${unit.number} · ${unit.title}`;
  return `${unit.skills.length} skills`;
}

/** Where "Start" should send the student. */
export function assignmentHref(assignment: ClassAssignment): string {
  if (assignment.skillId) return `/learn/${assignment.unitId}/${assignment.skillId}`;
  return `/unit/${assignment.unitId}`;
}

const DONE_LEVELS = new Set(["proficient", "mastered"]);

/** How much of an assignment a given progress blob has finished. */
export function assignmentProgress(
  progress: UserProgress | null,
  assignment: ClassAssignment
): { done: number; total: number; percent: number; complete: boolean } {
  const skillIds = assignmentSkillIds(assignment);
  const total = skillIds.length;
  if (total === 0) return { done: 0, total: 0, percent: 0, complete: false };
  const done = progress
    ? skillIds.filter((id) => DONE_LEVELS.has(progress.skills[id]?.level ?? "locked")).length
    : 0;
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
    complete: done === total,
  };
}

export type DueTone = "overdue" | "today" | "soon" | "later" | "none";

/**
 * Human due-date label. Compares calendar days in the viewer's own timezone,
 * so "today" means today for the student looking at it.
 */
export function dueLabel(dueDate: string | null): { text: string; tone: DueTone } {
  if (!dueDate) return { text: "No due date", tone: "none" };
  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return { text: "No due date", tone: "none" };

  const due = new Date(y, m - 1, d);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due.getTime() - startOfToday.getTime()) / 86_400_000);

  const pretty = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (days < 0) return { text: `Overdue · due ${pretty}`, tone: "overdue" };
  if (days === 0) return { text: "Due today", tone: "today" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  if (days <= 7) return { text: `Due ${pretty} · in ${days} days`, tone: "soon" };
  return { text: `Due ${pretty}`, tone: "later" };
}
