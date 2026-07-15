import type { GeneratedProblem, MasteryLevel, UserProgress, SkillProgress } from "@/types";
import { units, TOTAL_SKILLS } from "@/data/curriculum";
import {
  BADGES,
  evaluateNewBadges,
  getLevelInfo,
  RECENT_WINDOW,
  XP_REWARDS,
  type Badge,
} from "@/lib/gamification";
import {
  normalizeBridgeyProgress,
  tryAwardSkillCompleteBridgeys,
  tryAwardVisualBridgeys,
} from "@/lib/bridgeys";
import { STARTER_HOUSE_ID } from "@/data/house-catalog";

export { BADGES, getLevelInfo };
export type { Badge };

const STORAGE_KEY = "algebridge-progress";
export const PROGRESS_UPDATED_EVENT = "algebridge-progress-updated";

export type SimpleStatus = "not-started" | "in-progress" | "complete";

export interface CourseStats {
  completedSkills: number;
  totalSkills: number;
  percent: number;
  unitsComplete: number;
  totalUnits: number;
  problemsSolved: number;
  inProgressSkills: number;
  xp: number;
  level: number;
  levelTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: number;
  badgeCount: number;
  bridgeys: number;
}

export interface ContinueTarget {
  unitId: string;
  skillId: string;
  skillTitle: string;
  unitTitle: string;
  unitNumber: number;
}

export interface SkillPracticeStats {
  attempted: number;
  correct: number;
  /** Attempts within the rolling accuracy window (see RECENT_WINDOW) */
  recentAttempted: number;
  recentCorrect: number;
  /** Accuracy computed from the rolling window — this drives mastery, not lifetime accuracy */
  accuracy: number;
  problemsNeeded: number;
  isComplete: boolean;
}

export interface AttemptResult {
  progress: UserProgress;
  newLevel: MasteryLevel;
  skillJustCompleted: boolean;
  unitJustCompleted: boolean;
  xpGained: number;
  bridgeysGained: number;
  leveledUp: boolean;
  newLevelNumber: number;
  newBadges: Badge[];
}

export interface VideoWatchedResult {
  progress: UserProgress;
  xpGained: number;
  newBadges: Badge[];
}

export interface VisualCompletedResult {
  progress: UserProgress;
  xpGained: number;
  bridgeysGained: number;
  newBadges: Badge[];
}

const DEFAULT_PROGRESS: UserProgress = {
  skills: {},
  streak: 0,
  loginPromptDismissed: false,
  totalProblemsSolved: 0,
  xp: 0,
  badges: [],
  soundEnabled: false,
  musicEnabled: false,
  onboarded: false,
  bridgeys: 25,
  bridgeysLifetime: 25,
  houseStyleId: STARTER_HOUSE_ID,
  ownedHouseStyles: [STARTER_HOUSE_ID],
  ownedFurniture: [],
  placedFurniture: {},
  placedFurnitureItems: [],
  ownedTitles: [],
  bridgeyRewardsClaimed: { visual: [], complete: [] },
  leaderboardOptIn: true,
};

/** Fills in any missing fields (e.g. from an older save, or a remotely-fetched student record) with safe defaults. */
export function normalizeProgress(raw: Partial<UserProgress> | null | undefined): UserProgress {
  const merged = { ...DEFAULT_PROGRESS, ...raw, skills: { ...(raw?.skills ?? {}) } };
  return normalizeBridgeyProgress(merged);
}

/**
 * Bumps (or resets) the daily practice streak based on a *real* learning
 * action — a correct/incorrect problem attempt, a watched video, or a
 * completed visualize exercise. Merely opening the app never counts, so the
 * streak always reflects actual practice days. Idempotent within a day.
 */
function applyStreakForActivity(progress: UserProgress): void {
  const now = new Date();
  const todayKey = now.toDateString();
  const previousKey = progress.lastVisit ? new Date(progress.lastVisit).toDateString() : null;

  if (previousKey !== todayKey) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffDays = previousKey
      ? Math.round((new Date(todayKey).getTime() - new Date(previousKey).getTime()) / msPerDay)
      : null;
    // A streak survives being exactly one day apart (yesterday → today);
    // any bigger gap (or no prior activity at all) starts a fresh streak of 1.
    progress.streak = diffDays === 1 ? (progress.streak || 0) + 1 : 1;
  }
  progress.lastVisit = now.toISOString();
}

/**
 * One-time migration: earlier versions marked a video "watched" the instant the
 * iframe loaded, with no real playback check. That flag isn't trustworthy, so the
 * first time a returning user's data is loaded, un-verified "watched" videos are
 * reset to unwatched — they'll need to actually watch (or confirm after a
 * time-gated fallback) under the new, real tracking.
 */
function migrateProgress(progress: UserProgress): UserProgress {
  if (progress.videoTrackingMigratedV1) return progress;

  const skills = { ...progress.skills };
  for (const [id, skill] of Object.entries(skills)) {
    if (skill.videoWatched && !skill.videoWatchedVerified) {
      skills[id] = { ...skill, videoWatched: false };
    }
  }

  return { ...progress, skills, videoTrackingMigratedV1: true };
}

function migrateBridgeyEconomy(progress: UserProgress): UserProgress {
  if (progress.bridgeyEconomyMigratedV1) return progress;
  return normalizeBridgeyProgress({ ...progress, bridgeyEconomyMigratedV1: true });
}

export function getProgress(): UserProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    let normalized = normalizeProgress(JSON.parse(raw));
    if (!normalized.videoTrackingMigratedV1) {
      normalized = migrateProgress(normalized);
    }
    if (!normalized.bridgeyEconomyMigratedV1) {
      normalized = migrateBridgeyEconomy(normalized);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT));
    }
    return normalized;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT));
}

export function getSkillProgress(skillId: string): SkillProgress {
  const progress = getProgress();
  return (
    progress.skills[skillId] ?? {
      skillId,
      level: "locked" as MasteryLevel,
      problemsAttempted: 0,
      problemsCorrect: 0,
      videoWatched: false,
    }
  );
}

export function markVideoWatched(skillId: string): VideoWatchedResult {
  const progress = getProgress();
  const existing = getSkillProgress(skillId);
  const alreadyWatched = existing.videoWatched;

  progress.skills[skillId] = {
    ...existing,
    level: existing.level === "locked" ? "attempted" : existing.level,
    videoWatched: true,
    videoWatchedVerified: true,
  };
  applyStreakForActivity(progress);

  let xpGained = 0;
  if (!alreadyWatched) {
    xpGained = XP_REWARDS.videoWatched;
    progress.xp += xpGained;
  }

  const newBadges = evaluateNewBadges(progress);
  saveProgress(progress);
  return { progress, xpGained, newBadges };
}

export function markVisualCompleted(skillId: string): VisualCompletedResult {
  const progress = getProgress();
  const existing = getSkillProgress(skillId);
  const alreadyDone = existing.visualized;

  progress.skills[skillId] = {
    ...existing,
    level: existing.level === "locked" ? "attempted" : existing.level,
    visualized: true,
  };
  applyStreakForActivity(progress);

  let xpGained = 0;
  if (!alreadyDone) {
    xpGained = XP_REWARDS.visualCompleted;
    progress.xp += xpGained;
  }

  const bridgeysGained = tryAwardVisualBridgeys(progress, skillId);

  const newBadges = evaluateNewBadges(progress);
  saveProgress(progress);
  return { progress, xpGained, bridgeysGained, newBadges };
}

export function recordProblemAttempt(
  skillId: string,
  correct: boolean,
  opts?: { firstTry?: boolean }
): AttemptResult {
  const progress = getProgress();
  const existing = getSkillProgress(skillId);
  const wasComplete = existing.level === "proficient" || existing.level === "mastered";

  const attempted = existing.problemsAttempted + 1;
  const correctCount = existing.problemsCorrect + (correct ? 1 : 0);
  const recentResults = [...(existing.recentResults ?? []), correct].slice(
    -RECENT_WINDOW
  );
  const windowAccuracy =
    recentResults.length > 0
      ? recentResults.filter(Boolean).length / recentResults.length
      : 0;

  // Mastery is based on the last few attempts (a rolling window), not lifetime
  // accuracy — so an early mistake doesn't permanently drag down a student
  // who has since learned the skill.
  let level: MasteryLevel = existing.level === "locked" ? "attempted" : existing.level;
  if (attempted >= 3) {
    if (windowAccuracy >= 1) level = "mastered";
    else if (windowAccuracy >= 0.8) level = "proficient";
    else if (windowAccuracy >= 0.6) level = "familiar";
    else level = "attempted";
  }

  progress.skills[skillId] = {
    ...existing,
    level,
    problemsAttempted: attempted,
    problemsCorrect: correctCount,
    recentResults,
    lastPracticed: new Date().toISOString(),
    videoWatched: existing.videoWatched,
  };

  if (correct) progress.totalProblemsSolved += 1;
  applyStreakForActivity(progress);

  const isNowComplete = level === "proficient" || level === "mastered";
  const skillJustCompleted = !wasComplete && isNowComplete;

  let xpGained = 0;
  if (correct) {
    xpGained += XP_REWARDS.correctAnswer;
    if (opts?.firstTry) xpGained += XP_REWARDS.firstTryBonus;
  }
  if (skillJustCompleted) xpGained += XP_REWARDS.skillComplete;

  const bridgeysGained = skillJustCompleted
    ? tryAwardSkillCompleteBridgeys(progress, skillId)
    : 0;

  const beforeLevelNumber = getLevelInfo(progress.xp).level;
  progress.xp += xpGained;

  let unitJustCompleted = false;
  if (skillJustCompleted) {
    const unit = units.find((u) => u.skills.some((s) => s.id === skillId));
    if (unit) {
      const allComplete = unit.skills.every((s) => {
        const lvl = s.id === skillId ? level : progress.skills[s.id]?.level ?? "locked";
        return lvl === "proficient" || lvl === "mastered";
      });
      if (allComplete) {
        unitJustCompleted = true;
        progress.xp += XP_REWARDS.unitComplete;
      }
    }
  }

  const afterLevelInfo = getLevelInfo(progress.xp);
  const leveledUp = afterLevelInfo.level > beforeLevelNumber;
  const newBadges = evaluateNewBadges(progress);

  saveProgress(progress);

  return {
    progress,
    newLevel: level,
    skillJustCompleted,
    unitJustCompleted,
    xpGained,
    bridgeysGained,
    leveledUp,
    newLevelNumber: afterLevelInfo.level,
    newBadges,
  };
}

/**
 * Call once per app load. This never *grants* streak credit (only real
 * practice activity does, via `applyStreakForActivity`) — it only clears a
 * streak that's already been broken, so the header/achievements never show a
 * stale streak from many days ago.
 */
export function ensureDailyStreak(): { streak: number; newBadges: Badge[] } {
  const progress = getProgress();
  if (!progress.streak || !progress.lastVisit) {
    return { streak: progress.streak || 0, newBadges: [] };
  }

  const now = new Date();
  const todayKey = now.toDateString();
  const lastKey = new Date(progress.lastVisit).toDateString();
  if (lastKey === todayKey) {
    return { streak: progress.streak, newBadges: [] };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.round(
    (new Date(todayKey).getTime() - new Date(lastKey).getTime()) / msPerDay
  );

  // A streak survives one skipped calendar day (e.g. practiced late last
  // night); a bigger gap with no activity at all means it's broken.
  if (diffDays > 1) {
    progress.streak = 0;
    saveProgress(progress);
  }

  return { streak: progress.streak, newBadges: [] };
}

export function setSoundEnabled(enabled: boolean): void {
  const progress = getProgress();
  progress.soundEnabled = enabled;
  saveProgress(progress);
}

export function setMusicEnabled(enabled: boolean): void {
  const progress = getProgress();
  progress.musicEnabled = enabled;
  saveProgress(progress);
}

export function markOnboarded(): void {
  const progress = getProgress();
  progress.onboarded = true;
  saveProgress(progress);
}

export function unlockSkill(skillId: string): void {
  const progress = getProgress();
  const existing = getSkillProgress(skillId);
  if (existing.level === "locked") {
    progress.skills[skillId] = { ...existing, level: "attempted" };
    saveProgress(progress);
  }
}

export function dismissLoginPrompt(): void {
  const progress = getProgress();
  progress.loginPromptDismissed = true;
  saveProgress(progress);
}

export function getUnitCompletion(
  skillIds: string[]
): { completed: number; total: number; percent: number } {
  const progress = getProgress();
  const total = skillIds.length;
  const completed = skillIds.filter((id) => {
    const level = progress.skills[id]?.level;
    return level === "proficient" || level === "mastered";
  }).length;
  return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
}

export function getOverallProgress(allSkillIds: string[]): number {
  const { completed, total } = getUnitCompletion(allSkillIds);
  return total ? Math.round((completed / total) * 100) : 0;
}

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  locked: "Not started",
  attempted: "In progress",
  familiar: "In progress",
  proficient: "Complete",
  mastered: "Complete",
};

export const SIMPLE_STATUS_LABELS: Record<SimpleStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  complete: "Complete",
};

export function getSimpleStatus(level: MasteryLevel): SimpleStatus {
  if (level === "proficient" || level === "mastered") return "complete";
  if (level === "locked") return "not-started";
  return "in-progress";
}

export function getSkillPracticeStats(skillId: string): SkillPracticeStats {
  const prog = getSkillProgress(skillId);
  const recentResults = prog.recentResults ?? [];
  const recentAttempted = recentResults.length;
  const recentCorrect = recentResults.filter(Boolean).length;
  const accuracy = recentAttempted > 0 ? recentCorrect / recentAttempted : 0;
  const isComplete = prog.level === "proficient" || prog.level === "mastered";

  // Mirrors the real mastery rule in recordProblemAttempt (>=3 attempts AND
  // >=80% accuracy over the rolling window) by simulating best-case correct
  // answers, so the UI never tells a student "0 more to try" while they're
  // still short of mastery due to earlier misses dragging down their window.
  let problemsNeeded = 0;
  if (!isComplete) {
    let simulated = [...recentResults];
    let attempted = prog.problemsAttempted;
    let guard = 0;
    while (guard < RECENT_WINDOW + 3) {
      const acc = simulated.length > 0 ? simulated.filter(Boolean).length / simulated.length : 0;
      if (attempted >= 3 && acc >= 0.8) break;
      simulated = [...simulated, true].slice(-RECENT_WINDOW);
      attempted += 1;
      problemsNeeded += 1;
      guard += 1;
    }
  }

  return {
    attempted: prog.problemsAttempted,
    correct: prog.problemsCorrect,
    recentAttempted,
    recentCorrect,
    accuracy,
    problemsNeeded,
    isComplete,
  };
}

export function getEmptyCourseStats(): CourseStats {
  const level = getLevelInfo(0);
  return {
    completedSkills: 0,
    totalSkills: TOTAL_SKILLS,
    percent: 0,
    unitsComplete: 0,
    totalUnits: units.length,
    problemsSolved: 0,
    inProgressSkills: 0,
    xp: 0,
    level: level.level,
    levelTitle: level.title,
    xpIntoLevel: level.xpIntoLevel,
    xpForNextLevel: level.xpForNextLevel,
    streak: 0,
    badgeCount: 0,
    bridgeys: 25,
  };
}

/** Pure helper so both local progress and a fetched (e.g. teacher-viewed) student's progress can be summarized. */
export function computeCourseStatsFromProgress(progress: UserProgress): CourseStats {
  let completedSkills = 0;
  let inProgressSkills = 0;

  for (const unit of units) {
    for (const skill of unit.skills) {
      const level = progress.skills[skill.id]?.level ?? "locked";
      const simple = getSimpleStatus(level);
      if (simple === "complete") completedSkills += 1;
      if (simple === "in-progress") inProgressSkills += 1;
    }
  }

  const unitsComplete = units.filter((unit) => {
    const total = unit.skills.length;
    const completed = unit.skills.filter((s) => {
      const level = progress.skills[s.id]?.level;
      return level === "proficient" || level === "mastered";
    }).length;
    return completed === total;
  }).length;

  const level = getLevelInfo(progress.xp);

  return {
    completedSkills,
    totalSkills: TOTAL_SKILLS,
    percent: TOTAL_SKILLS
      ? Math.round((completedSkills / TOTAL_SKILLS) * 100)
      : 0,
    unitsComplete,
    totalUnits: units.length,
    problemsSolved: progress.totalProblemsSolved,
    inProgressSkills,
    xp: progress.xp,
    level: level.level,
    levelTitle: level.title,
    xpIntoLevel: level.xpIntoLevel,
    xpForNextLevel: level.xpForNextLevel,
    streak: progress.streak,
    badgeCount: progress.badges.length,
    bridgeys: progress.bridgeys ?? 0,
  };
}

export function getCourseStats(): CourseStats {
  return computeCourseStatsFromProgress(getProgress());
}

export function getContinueLearning(): ContinueTarget | null {
  for (const unit of units) {
    for (const skill of unit.skills) {
      const level = getSkillProgress(skill.id).level;
      if (level !== "proficient" && level !== "mastered") {
        return {
          unitId: unit.id,
          skillId: skill.id,
          skillTitle: skill.title,
          unitTitle: unit.title,
          unitNumber: unit.number,
        };
      }
    }
  }
  return null;
}

export const MASTERY_COLORS: Record<MasteryLevel, string> = {
  locked: "bg-slate-200 text-slate-600",
  attempted: "bg-amber-100 text-amber-800",
  familiar: "bg-amber-100 text-amber-800",
  proficient: "bg-emerald-100 text-emerald-800",
  mastered: "bg-emerald-100 text-emerald-800",
};

export const SIMPLE_STATUS_COLORS: Record<SimpleStatus, string> = {
  "not-started": "bg-slate-100 text-slate-600",
  "in-progress": "bg-amber-100 text-amber-800",
  complete: "bg-emerald-100 text-emerald-800",
};

/** Placeholder for future cloud sync when user logs in */
export function exportProgressForSync(): string {
  return JSON.stringify(getProgress());
}

export function importProgressFromSync(data: string): boolean {
  try {
    const parsed = JSON.parse(data) as Partial<UserProgress>;
    saveProgress(normalizeProgress(parsed));
    return true;
  } catch {
    return false;
  }
}

/** Wipe this browser's saved progress back to a clean slate. Used on sign-out
 *  and before loading a different account's cloud progress, so one student's
 *  work never leaks into another student's session on a shared device. */
export function clearLocalProgress(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT));
}

export function generateExtraProblems(
  generatorKey: string,
  count: number = 5
): GeneratedProblem[] {
  const generators: Record<string, () => GeneratedProblem> = {
    "one-step-add": () => {
      const a = Math.floor(Math.random() * 20) + 1;
      const x = Math.floor(Math.random() * 15) + 1;
      const isSubtraction = Math.random() < 0.5;
      if (isSubtraction) {
        // x − a = c
        const c = x - a;
        return {
          id: `gen-${Date.now()}-${Math.random()}`,
          type: "numeric",
          prompt: `Solve for x: x − ${a} = ${c}`,
          hint: `Add ${a} to both sides.`,
          answer: x,
          explanation: `x − ${a} = ${c} → x = ${c} + ${a} = ${x}`,
        };
      }
      const c = x + a;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `Solve for x: x + ${a} = ${c}`,
        hint: `Subtract ${a} from both sides.`,
        answer: x,
        explanation: `x + ${a} = ${c} → x = ${c} − ${a} = ${x}`,
      };
    },
    "one-step-mult": () => {
      const a = Math.floor(Math.random() * 9) + 2;
      const x = Math.floor(Math.random() * 12) + 1;
      const c = a * x;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `Solve for x: ${a}x = ${c}`,
        hint: `Divide both sides by ${a}.`,
        answer: x,
        explanation: `${a}x = ${c} → x = ${c} ÷ ${a} = ${x}`,
      };
    },
    "two-step": () => {
      const a = Math.floor(Math.random() * 5) + 2;
      const b = Math.floor(Math.random() * 10) + 1;
      const x = Math.floor(Math.random() * 10) + 1;
      const c = a * x + b;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `Solve for x: ${a}x + ${b} = ${c}`,
        hint: `First subtract ${b}, then divide by ${a}.`,
        answer: x,
        explanation: `${a}x + ${b} = ${c} → ${a}x = ${c - b} → x = ${(c - b) / a}`,
      };
    },
    "slope": () => {
      const x1 = 0;
      const y1 = Math.floor(Math.random() * 5);
      const x2 = Math.floor(Math.random() * 5) + 2;
      const m = Math.floor(Math.random() * 4) + 1;
      const y2 = y1 + m * (x2 - x1);
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `Find the slope between (${x1}, ${y1}) and (${x2}, ${y2}).`,
        hint: `Slope = (y₂ − y₁) / (x₂ − x₁)`,
        answer: m,
        explanation: `m = (${y2} − ${y1}) / (${x2} − ${x1}) = ${m}`,
      };
    },
    "exponent-mult": () => {
      const base = Math.floor(Math.random() * 4) + 2;
      const exp1 = Math.floor(Math.random() * 4) + 2;
      const exp2 = Math.floor(Math.random() * 4) + 2;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `Simplify: ${base}^${exp1} × ${base}^${exp2}`,
        hint: `When multiplying same base, add exponents.`,
        answer: Math.pow(base, exp1 + exp2),
        explanation: `${base}^${exp1} × ${base}^${exp2} = ${base}^${exp1 + exp2} = ${Math.pow(base, exp1 + exp2)}`,
      };
    },
    "factor-trinomial": () => {
      const a = 1;
      const r = Math.floor(Math.random() * 5) + 2;
      const s = Math.floor(Math.random() * 5) + 2;
      const b = r + s;
      const c = r * s;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "multiple-choice",
        prompt: `Factor: x² + ${b}x + ${c}`,
        hint: `Find two numbers that multiply to ${c} and add to ${b}.`,
        answer: `(x + ${r})(x + ${s})`,
        choices: [
          `(x + ${r})(x + ${s})`,
          `(x + ${r + 1})(x + ${s - 1})`,
          `(x − ${r})(x − ${s})`,
          `(x + ${b})(x + 1)`,
        ],
        explanation: `x² + ${b}x + ${c} = (x + ${r})(x + ${s}) because ${r} × ${s} = ${c} and ${r} + ${s} = ${b}.`,
      };
    },
    "quadratic-formula": () => {
      // Randomly build a quadratic with 2, 1, or 0 real solutions so the
      // discriminant question actually varies instead of always being "2".
      const outcome = Math.floor(Math.random() * 3); // 0 = two roots, 1 = one root, 2 = no real roots
      let b: number;
      let c: number;
      let answer: string;

      if (outcome === 0) {
        const r1 = Math.floor(Math.random() * 6) - 2 || 1;
        let r2 = Math.floor(Math.random() * 6) - 2 || -1;
        if (r2 === r1) r2 += 1;
        b = -(r1 + r2);
        c = r1 * r2;
        answer = "2";
      } else if (outcome === 1) {
        const r = Math.floor(Math.random() * 6) - 2 || 1;
        b = -2 * r;
        c = r * r;
        answer = "1";
      } else {
        // Discriminant b² − 4c < 0 (e.g. b small, c large and positive)
        b = Math.floor(Math.random() * 3);
        c = Math.floor(Math.random() * 5) + 5;
        answer = "0";
      }

      const discriminant = b * b - 4 * c;
      const sign = discriminant > 0 ? "positive" : discriminant < 0 ? "negative" : "zero";
      const bTerm = b === 0 ? "" : ` ${b > 0 ? "+" : "−"} ${Math.abs(b)}x`;
      const cTerm = ` ${c >= 0 ? "+" : "−"} ${Math.abs(c)}`;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "multiple-choice",
        prompt: `How many real solutions does x²${bTerm}${cTerm} = 0 have?`,
        hint: `Compute the discriminant b² − 4ac.`,
        answer,
        choices: ["0", "1", "2", "Infinitely many"],
        explanation: `Discriminant = (${b})² − 4(1)(${c}) = ${discriminant}. Since it's ${sign}, there ${answer === "1" ? "is" : "are"} ${answer} real solution${answer === "1" ? "" : "s"}.`,
      };
    },
    "unit-conversion": () => {
      const feet = (Math.floor(Math.random() * 8) + 2) * 5280;
      const miles = feet / 5280;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `Convert ${feet} feet to miles. (1 mile = 5280 ft)`,
        hint: `Divide by 5280.`,
        answer: miles,
        explanation: `${feet} ÷ 5280 = ${miles} miles`,
      };
    },
    "substitution": () => {
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `Solve: y = 2x and x + y = 9. What is x?`,
        hint: `Substitute y = 2x into x + y = 9.`,
        answer: 3,
        explanation: `x + 2x = 9 → 3x = 9 → x = 3`,
      };
    },
    "function-eval": () => {
      const a = Math.floor(Math.random() * 4) + 1;
      const b = Math.floor(Math.random() * 6) + 1;
      const x = Math.floor(Math.random() * 5) + 1;
      const result = a * x + b;
      return {
        id: `gen-${Date.now()}-${Math.random()}`,
        type: "numeric",
        prompt: `If f(x) = ${a}x + ${b}, find f(${x}).`,
        hint: `Replace x with ${x} in the expression.`,
        answer: result,
        explanation: `f(${x}) = ${a}(${x}) + ${b} = ${result}`,
      };
    },
  };

  const gen = generators[generatorKey];
  if (!gen) return [];
  return Array.from({ length: count }, () => gen());
}
