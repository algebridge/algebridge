/**
 * What a teacher sees about one student: what they finished, how accurate
 * they are, and their grade in the class.
 *
 * Accuracy is right answers out of every answer, from the progress the
 * student's account saves. The grade is the share of assigned skills the
 * student has completed (5 right on the first try), on the usual
 * 90/80/70/60 scale, so it only counts what the teacher asked for. With
 * nothing assigned there is no grade yet.
 */

import { units } from "@/data/curriculum";
import { assignmentCompletedAt, assignmentProgress, assignmentTitle } from "@/lib/assignments";
import { isSkillComplete } from "@/lib/path";
import type { ClassAssignment, SkillProgress, UserProgress } from "@/types";

export interface Accuracy {
  correct: number;
  attempted: number;
  /** 0 to 100, or null with nothing answered. */
  percent: number | null;
}

export function accuracyOf(skills: (SkillProgress | undefined)[]): Accuracy {
  let correct = 0;
  let attempted = 0;
  for (const s of skills) {
    if (!s) continue;
    correct += s.problemsCorrect ?? 0;
    attempted += s.problemsAttempted ?? 0;
  }
  correct = Math.min(correct, attempted);
  return { correct, attempted, percent: attempted > 0 ? Math.round((correct / attempted) * 100) : null };
}

export function letterFor(percent: number): string {
  if (percent >= 90) return "A";
  if (percent >= 80) return "B";
  if (percent >= 70) return "C";
  if (percent >= 60) return "D";
  return "F";
}

export interface AssignmentGrade {
  id: string;
  title: string;
  dueDate: string | null;
  done: number;
  total: number;
  percent: number;
  /** Past its due date and unfinished. */
  late: boolean;
  /** When they finished it, or null. */
  completedAt: string | null;
}

export interface ClassGrade {
  /** Assigned skills completed out of all assigned skills, 0 to 100; null with nothing assigned. */
  percent: number | null;
  letter: string | null;
  done: number;
  total: number;
  assignments: AssignmentGrade[];
}

export function classGrade(progress: UserProgress | null, assignments: ClassAssignment[], today = new Date()): ClassGrade {
  const todayIso = today.toISOString().slice(0, 10);
  let done = 0;
  let total = 0;
  const rows: AssignmentGrade[] = assignments.map((a) => {
    const p = assignmentProgress(progress, a);
    done += p.done;
    total += p.total;
    return {
      id: a.id,
      title: assignmentTitle(a),
      dueDate: a.dueDate,
      done: p.done,
      total: p.total,
      percent: p.percent,
      late: !!a.dueDate && a.dueDate < todayIso && !p.complete,
      completedAt: assignmentCompletedAt(progress, a),
    };
  });
  if (total === 0) return { percent: null, letter: null, done: 0, total: 0, assignments: rows };
  const percent = Math.round((done / total) * 100);
  return { percent, letter: letterFor(percent), done, total, assignments: rows };
}

export interface SkillRow {
  id: string;
  title: string;
  complete: boolean;
  started: boolean;
  accuracy: Accuracy;
  lastPracticed: string | null;
}

export interface UnitRow {
  id: string;
  number: number;
  title: string;
  completed: number;
  total: number;
  accuracy: Accuracy;
  skills: SkillRow[];
}

/** Every Algebra 1 unit with the student's work on each skill. */
export function unitReport(progress: UserProgress | null): UnitRow[] {
  return units.map((u) => {
    const skills = u.skills.map((s) => {
      const p = progress?.skills[s.id];
      return {
        id: s.id,
        title: s.title,
        complete: isSkillComplete(p),
        started: !!p && (p.problemsAttempted > 0 || p.videoWatched),
        accuracy: accuracyOf([p]),
        lastPracticed: p?.lastPracticed ?? null,
      };
    });
    return {
      id: u.id,
      number: u.number,
      title: u.title,
      completed: skills.filter((s) => s.complete).length,
      total: skills.length,
      accuracy: accuracyOf(u.skills.map((s) => progress?.skills[s.id])),
      skills,
    };
  });
}

/** Accuracy across every skill the student has touched, either course. */
export function overallAccuracy(progress: UserProgress | null): Accuracy {
  return accuracyOf(progress ? Object.values(progress.skills) : []);
}
