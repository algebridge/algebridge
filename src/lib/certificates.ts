/**
 * Certificates: one for each finished unit, and one for the whole course.
 *
 * A unit's certificate is earned when every skill in it is finished (five
 * first tries right), the same moment the unit pays its bonus and its house
 * prize. The date on it is the day that happened, kept in progress so it
 * never moves. A unit finished before certificates existed has no stored
 * date; it shows the day its last skill was practiced, the closest true date
 * there is.
 *
 * Everything here reads progress and writes nothing.
 */

import { allUnits, units } from "@/data/curriculum";
import type { Unit, UserProgress } from "@/types";

export const COURSE_ID = "course";

export function skillIsFinished(progress: UserProgress, skillId: string): boolean {
  const level = progress.skills[skillId]?.level;
  return level === "proficient" || level === "mastered";
}

export function unitIsFinished(progress: UserProgress, unit: Unit): boolean {
  return unit.skills.every((s) => skillIsFinished(progress, s.id));
}

export function courseIsFinished(progress: UserProgress): boolean {
  return units.every((u) => unitIsFinished(progress, u));
}

/** The latest day any of these skills was practiced, as an ISO time. */
function lastPracticedOf(progress: UserProgress, skillIds: string[]): string | null {
  let latest: string | null = null;
  for (const id of skillIds) {
    const at = progress.skills[id]?.lastPracticed;
    if (at && (!latest || at > latest)) latest = at;
  }
  return latest;
}

/** The date on a finished unit's certificate, or null while the unit is unfinished. */
export function unitCertificateDate(progress: UserProgress, unit: Unit): string | null {
  if (!unitIsFinished(progress, unit)) return null;
  return progress.certificates?.[unit.id] ?? lastPracticedOf(progress, unit.skills.map((s) => s.id));
}

/** The date on the course certificate, or null until the course is finished. */
export function courseCertificateDate(progress: UserProgress): string | null {
  if (!courseIsFinished(progress)) return null;
  if (progress.courseCompletedAt) return progress.courseCompletedAt;
  const dates = units.map((u) => unitCertificateDate(progress, u)).filter((d): d is string => !!d);
  return dates.sort().at(-1) ?? null;
}

export interface CertificateEntry {
  id: string;
  unit: Unit | null;
  earnedAt: string | null;
}

/** Every certificate on offer, the course last, with the date for each one earned. */
export function certificateList(progress: UserProgress): CertificateEntry[] {
  return [
    ...allUnits()
      .map((u) => ({ id: u.id, unit: u, earnedAt: unitCertificateDate(progress, u) }))
      // Algebra 2 is unlisted: its unit certificates show once earned, never as empty slots.
      .filter((c) => units.includes(c.unit) || c.earnedAt),
    { id: COURSE_ID, unit: null, earnedAt: courseCertificateDate(progress) },
  ];
}

/** "October 5, 2026", in the student's own time zone. */
export function certificateDateText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** The facts the course certificate and celebration show, all read from the student's own progress. */
export function courseFacts(progress: UserProgress) {
  const skills = units.flatMap((u) => u.skills);
  return {
    units: units.length,
    skills: skills.length,
    /** Skills finished without a single miss along the way. */
    flawless: skills.filter((s) => progress.skills[s.id]?.level === "mastered").length,
    problemsSolved: progress.totalProblemsSolved,
    xp: progress.xp,
  };
}
