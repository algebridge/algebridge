import type { SkillProgress } from "@/types";

/** Days after mastery when a skill should appear in Bridge Review */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

export interface ReviewItem {
  skillId: string;
  skillTitle: string;
  unitId: string;
  unitTitle: string;
  dueReason: string;
  priority: number;
}

export function getSkillsDueForReview(
  skills: Record<string, SkillProgress>,
  skillMeta: Array<{
    id: string;
    title: string;
    unitId: string;
    unitTitle: string;
  }>
): ReviewItem[] {
  const now = Date.now();
  const due: ReviewItem[] = [];

  for (const meta of skillMeta) {
    const prog = skills[meta.id];
    if (!prog) continue;
    if (prog.level !== "proficient" && prog.level !== "mastered") continue;
    if (!prog.lastPracticed) continue;

    const daysSince =
      (now - new Date(prog.lastPracticed).getTime()) / (1000 * 60 * 60 * 24);

    // Walk intervals from largest to smallest so a skill that's overdue by a
    // lot (e.g. missed several intervals during a vacation) still shows up —
    // it should never silently disappear just because its exact 2-day window
    // was missed.
    for (let i = REVIEW_INTERVALS_DAYS.length - 1; i >= 0; i--) {
      const interval = REVIEW_INTERVALS_DAYS[i];
      if (daysSince >= interval) {
        due.push({
          skillId: meta.id,
          skillTitle: meta.title,
          unitId: meta.unitId,
          unitTitle: meta.unitTitle,
          dueReason: `Review after ${interval} day${interval > 1 ? "s" : ""}`,
          priority: REVIEW_INTERVALS_DAYS.length - i,
        });
        break;
      }
    }
  }

  return due.sort((a, b) => b.priority - a.priority);
}

export function getReviewQueueCount(
  skills: Record<string, SkillProgress>,
  skillMeta: Array<{ id: string; title: string; unitId: string; unitTitle: string }>
): number {
  return getSkillsDueForReview(skills, skillMeta).length;
}
