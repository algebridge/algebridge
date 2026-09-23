import type { MasteryLevel, UserProgress } from "@/types";
import { units, TOTAL_SKILLS } from "@/data/curriculum";

/** How many of the most recent attempts count toward mastery accuracy. */
export const RECENT_WINDOW = 5;

/**
 * Problems a student must get right, on the first try, to finish a skill.
 *
 * History: 80% accuracy over a rolling window, then five right IN A ROW, now
 * five right in any order. The run rule made one slip cost up to four earned
 * answers, which is a punishment for being twelve, not a measure of skill.
 *
 * First tries only, because a retry on a multiple-choice problem is a
 * process of elimination: with credit for retries, about a third of the
 * course (the skills that are all multiple choice) could be finished by
 * clicking every option in turn.
 */
export const REQUIRED_CORRECT = 5;

export const XP_REWARDS = {
  correctAnswer: 10,
  firstTryBonus: 5,
  videoWatched: 15,
  skillComplete: 50,
  unitComplete: 150,
};

/** Bridgeys, in-game currency earned from lessons. */
export const BRIDGEY_REWARDS = {
  /** Completing a skill in Unit 1 (once per skill). */
  skillComplete: 10,
  /** Each later unit pays this much more per skill, so the course pays more as it gets harder. */
  perUnitStep: 2,
  /** Finishing every skill in a unit, on top of its prize. */
  unitComplete: 40,
  /** Meeting the daily goal, once a day. */
  dailyGoal: 15,
};

/**
 * Right answers a day that make the daily goal: about ten minutes of work.
 * Lessons and the rink both count. The streak still only needs one answer a
 * day; the goal is what a good day looks like, and it pays.
 */
export const DAILY_GOAL = 10;

/** What finishing a skill pays: 10 in Unit 1, 34 by Unit 13. */
export function bridgeysForSkill(skillId: string): number {
  const unit = units.find((u) => u.skills.some((s) => s.id === skillId));
  return BRIDGEY_REWARDS.skillComplete + BRIDGEY_REWARDS.perUnitStep * Math.max(0, (unit?.number ?? 1) - 1);
}

export interface LevelInfo {
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
}

const LEVEL_TITLES = [
  "Newcomer",
  "Number Ninja",
  "Equation Explorer",
  "Formula Fighter",
  "Graph Guru",
  "Bridge Builder",
  "Algebra Ace",
  "Math Marvel",
  "Quadratic Hero",
  "AlgeBridge Legend",
];

function xpRequiredForLevel(level: number): number {
  return 100 + (level - 1) * 40;
}

export function getLevelInfo(xp: number): LevelInfo {
  let level = 1;
  let xpAtLevelStart = 0;
  let xpForNextLevel = xpRequiredForLevel(level);

  while (xp >= xpAtLevelStart + xpForNextLevel) {
    xpAtLevelStart += xpForNextLevel;
    level += 1;
    xpForNextLevel = xpRequiredForLevel(level);
  }

  const xpIntoLevel = xp - xpAtLevelStart;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    xpIntoLevel,
    xpForNextLevel,
    progress: xpForNextLevel > 0 ? xpIntoLevel / xpForNextLevel : 1,
  };
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

function isSkillComplete(level: MasteryLevel | undefined): boolean {
  return level === "proficient" || level === "mastered";
}

function countCompletedSkills(progress: UserProgress): number {
  let count = 0;
  for (const unit of units) {
    for (const skill of unit.skills) {
      if (isSkillComplete(progress.skills[skill.id]?.level)) count += 1;
    }
  }
  return count;
}

function countCompletedUnits(progress: UserProgress): number {
  return units.filter((unit) =>
    unit.skills.every((skill) => isSkillComplete(progress.skills[skill.id]?.level))
  ).length;
}

function countVideosWatched(progress: UserProgress): number {
  return Object.values(progress.skills).filter((s) => s.videoWatched).length;
}

/**
 * A skill finished without ever getting one wrong.
 *
 * Deliberately stricter than finishing: five right with misses in between
 * completes a skill, never missing at all earns this.
 */
function hasFlawlessSkill(progress: UserProgress): boolean {
  return Object.values(progress.skills).some(
    (s) => s.level === "mastered" && s.problemsAttempted > 0 && s.problemsAttempted === s.problemsCorrect
  );
}

function hasGritMoment(progress: UserProgress): boolean {
  return Object.values(progress.skills).some(
    (s) => isSkillComplete(s.level) && s.problemsAttempted > s.problemsCorrect
  );
}

type BadgeDefinition = Badge & { check: (progress: UserProgress) => boolean };

export const BADGES: BadgeDefinition[] = [
  {
    id: "first-skill",
    title: "First Steps",
    description: "Complete your first skill",
    emoji: "🎉",
    check: (p) => countCompletedSkills(p) >= 1,
  },
  {
    id: "first-unit",
    title: "Bridge Builder",
    description: "Complete every skill in a unit",
    emoji: "🌉",
    check: (p) => countCompletedUnits(p) >= 1,
  },
  {
    id: "perfect-five",
    title: "Perfect Round",
    description: "Finish a skill without a single wrong answer",
    emoji: "💯",
    check: hasFlawlessSkill,
  },
  {
    id: "streak-3",
    title: "3-Day Streak",
    description: "Practice 3 days in a row",
    emoji: "🔥",
    check: (p) => p.streak >= 3,
  },
  {
    id: "streak-7",
    title: "Week Warrior",
    description: "Practice 7 days in a row",
    emoji: "🔥🔥",
    check: (p) => p.streak >= 7,
  },
  {
    id: "century",
    title: "Century Club",
    description: "Solve 100 practice problems",
    emoji: "🌟",
    check: (p) => p.totalProblemsSolved >= 100,
  },
  {
    id: "grit",
    title: "Growth Mindset",
    description: "Master a skill after getting one wrong first",
    emoji: "💪",
    check: hasGritMoment,
  },
  {
    id: "video-buff",
    title: "Video Buff",
    description: "Watch 10 lesson videos",
    emoji: "📺",
    check: (p) => countVideosWatched(p) >= 10,
  },
  {
    id: "level-5",
    title: "Rising Star",
    description: "Reach Level 5",
    emoji: "🚀",
    check: (p) => getLevelInfo(p.xp).level >= 5,
  },
  {
    id: "course-complete",
    title: "Course Champion",
    description: "Complete every skill in AlgeBridge",
    emoji: "🏆",
    check: (p) => countCompletedSkills(p) >= TOTAL_SKILLS,
  },
];

/** Mutates progress.badges in place, returns newly earned badges. */
export function evaluateNewBadges(progress: UserProgress): Badge[] {
  const newly: Badge[] = [];
  for (const badge of BADGES) {
    if (progress.badges.includes(badge.id)) continue;
    if (badge.check(progress)) {
      progress.badges.push(badge.id);
      newly.push(badge);
    }
  }
  return newly;
}

export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}
