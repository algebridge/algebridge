export type MasteryLevel = "locked" | "attempted" | "familiar" | "proficient" | "mastered";

export type ProblemType =
  | "numeric"
  | "multiple-choice"
  | "error-analysis"
  | "step-order";

export interface Video {
  id: string;
  title: string;
  channel: string;
  duration: string;
  youtubeId: string;
}

export interface PracticeProblem {
  id: string;
  type: ProblemType;
  prompt: string;
  /** LaTeX or plain text hint shown after 2 wrong attempts */
  hint: string;
  /** For numeric / multiple-choice */
  answer?: string | number;
  choices?: string[];
  /** For error-analysis: which step index is wrong (0-based) */
  wrongStepIndex?: number;
  steps?: string[];
  /** For step-order: correct order as indices */
  correctOrder?: number[];
  explanation: string;
}

export interface Skill {
  id: string;
  title: string;
  description: string;
  learningGoal: string;
  keyIdea: string;
  video: Video;
  backupVideo?: Video;
  problems: PracticeProblem[];
  /** Generator key for infinite practice variations */
  generatorKey?: string;
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  description: string;
  icon: string;
  skills: Skill[];
}

export interface SkillProgress {
  skillId: string;
  level: MasteryLevel;
  problemsAttempted: number;
  problemsCorrect: number;
  /** Rolling window of the most recent attempt results (true = correct) */
  recentResults?: boolean[];
  lastPracticed?: string;
  videoWatched: boolean;
  /** True only once real playback tracking (or a time-gated manual confirm) verified the watch. */
  videoWatchedVerified?: boolean;
  /** True once the student has completed the "Visualize It" diagram exercise for this skill. */
  visualized?: boolean;
}

export interface UserProgress {
  skills: Record<string, SkillProgress>;
  currentUnitId?: string;
  currentSkillId?: string;
  streak: number;
  lastVisit?: string;
  loginPromptDismissed: boolean;
  totalProblemsSolved: number;
  xp: number;
  badges: string[];
  soundEnabled: boolean;
  musicEnabled: boolean;
  onboarded: boolean;
  /** One-time migration marker: clears "watched" flags earned before real playback tracking existed. */
  videoTrackingMigratedV1?: boolean;
  /** In-game currency earned from lessons and spent in the shop. */
  bridgeys: number;
  /** Total Bridgeys ever earned (never decreases). */
  bridgeysLifetime?: number;
  /** Currently equipped house exterior style. */
  houseStyleId: string;
  /** House styles the student owns (includes the free starter cottage). */
  ownedHouseStyles: string[];
  /** Furniture item IDs purchased but not necessarily placed. */
  ownedFurniture: string[];
  /** Legacy slot-based placement — migrated to placedFurnitureItems. */
  placedFurniture: Record<string, string>;
  /** Free-position furniture inside the house (percent coords 0–100). */
  placedFurnitureItems?: PlacedFurnitureEntry[];
  /** Purchasable display titles (separate from XP level titles). */
  ownedTitles: string[];
  /** Title shown on profile and leaderboard. */
  equippedTitleId?: string;
  /** Skill IDs that already paid out Bridgey rewards (prevents double-claim). */
  bridgeyRewardsClaimed?: { visual: string[]; complete: string[] };
  /** Share stats on the nationwide leaderboard (requires sign-in). */
  leaderboardOptIn?: boolean;
  /** One-time migration: backfill Bridgey economy fields for older saves. */
  bridgeyEconomyMigratedV1?: boolean;
  /** One-time migration: slot furniture → free-position coords. */
  housePlacementMigratedV2?: boolean;
}

export interface PlacedFurnitureEntry {
  instanceId: string;
  itemId: string;
  /** Horizontal position as % of room width (0–100). */
  x: number;
  /** Vertical position as % of room height (0–100). */
  y: number;
}

export interface HouseStyle {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
  wallColor: string;
  floorColor: string;
  accentColor: string;
  /** Cartoon exterior illustration for shop / outside view. */
  exteriorImage?: string;
  /** Cartoon interior room background. */
  interiorImage?: string;
}

export interface FurnitureItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  /** @deprecated Legacy slot id — only used when migrating old saves. */
  slot: FurnitureSlot;
  /** Prestige value used for "best item in house" on the leaderboard. */
  prestige: number;
  rarity: "common" | "rare" | "legendary";
  /** Cartoon shop / in-room illustration (PNG or SVG path). */
  imageSrc?: string;
  /** Display width in the room (px at 800 reference width). */
  displayWidth?: number;
}

export type FurnitureSlot =
  | "back-left"
  | "back-center"
  | "back-right"
  | "mid-left"
  | "mid-center"
  | "mid-right";

export interface DisplayTitle {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  bridgeys: number;
  completedSkills: number;
  bestFurnitureName: string | null;
  bestFurnitureValue: number;
  equippedTitle: string | null;
  rank: number;
}

// ---------------------------------------------------------------------------
// "Visualize It" diagram exercises — pick the graph/diagram that matches the
// math, to build visual intuition alongside symbolic practice.
// ---------------------------------------------------------------------------

export type NumberLineMark =
  | { kind: "point"; value: number }
  | { kind: "ray"; boundary: number; direction: "left" | "right"; inclusive: boolean }
  | { kind: "segment"; low: number; high: number; inclusiveLow: boolean; inclusiveHigh: boolean };

export interface NumberLineSpec {
  type: "number-line";
  min: number;
  max: number;
  mark: NumberLineMark;
}

export interface GraphLine {
  slope: number;
  intercept: number;
  color?: string;
  dashed?: boolean;
}

export interface GraphPoint {
  x: number;
  y: number;
  label?: string;
}

export interface CoordinateSpec {
  type: "coordinate";
  range: number;
  lines?: GraphLine[];
  points?: GraphPoint[];
  shade?: "above" | "below";
  parabola?: { a: number; h: number; k: number };
}

export type DiagramSpec = NumberLineSpec | CoordinateSpec;

export interface VisualOption {
  id: string;
  diagram: DiagramSpec;
}

export interface VisualExercise {
  skillId: string;
  prompt: string;
  hint: string;
  explanation: string;
  options: VisualOption[];
  correctOptionId: string;
}

export type UserRole = "student" | "teacher";

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
}

export interface ClassInfo {
  id: string;
  name: string;
  joinCode: string;
  createdAt: string;
  studentCount: number;
}

export interface RosterStudent {
  id: string;
  email: string | null;
  displayName: string | null;
  joinedAt: string;
  stats: CourseStatsSummary | null;
}

/** Trimmed-down subset of CourseStats needed for the teacher roster view. */
export interface CourseStatsSummary {
  percent: number;
  completedSkills: number;
  totalSkills: number;
  level: number;
  levelTitle: string;
  streak: number;
  xp: number;
  badgeCount: number;
  problemsSolved: number;
}

export interface GeneratedProblem {
  id: string;
  type: ProblemType;
  prompt: string;
  hint: string;
  answer: string | number;
  choices?: string[];
  explanation: string;
}
