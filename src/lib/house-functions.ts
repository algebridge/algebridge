/**
 * What every piece in the Bridgey House is for.
 *
 * A piece was a picture you bought and set down; now each one does a job.
 * Tapped, it opens a real part of AlgeBridge (the desk your next skill, the
 * TV that skill's lesson, the arcade the games, the record player the study
 * music). Many show something true about the student as well: the clock is
 * today's goal, the shelf fills with a book per skill finished, plants grow
 * with the daily goals reached, the trophy case holds a trophy per unit. A
 * bed gives a rest day: one missed day a week keeps the streak.
 *
 * Pure, so the rules are tested; the house reads them.
 */

import { units } from "@/data/curriculum";
import type { UserProgress } from "@/types";
import { DEFAULT_LIVE, type LiveData } from "@/lib/house3d/types";

export type UseKind =
  | "study"
  | "water"
  | "watch"
  | "play"
  | "read"
  | "draw"
  | "listen"
  | "ask"
  | "review"
  | "break"
  | "certificates"
  | "unit"
  | "light"
  | "rest";

export interface UseSpec {
  /** The button: a verb. */
  verb: string;
  /** What it does, in one line, for the piece's card. */
  does: string;
}

export const USES: Record<UseKind, UseSpec> = {
  study: { verb: "Study", does: "Opens your next skill." },
  water: { verb: "Water it", does: "Practice waters it: opens your next skill. It grows with every daily goal you reach." },
  watch: { verb: "Watch", does: "Plays the lesson video for the skill you are on." },
  play: { verb: "Play", does: "Opens the games: every right answer there pays Bridgeys." },
  read: { verb: "Read", does: "Opens your notebook, where your notes and the key ideas live." },
  draw: { verb: "Draw", does: "Opens the scratchpad, to work a problem out by hand." },
  listen: { verb: "Music", does: "Turns the study music on or off." },
  ask: { verb: "Ask Archie", does: "Opens Archie, your study buddy, for a hint or a first step." },
  review: { verb: "Review", does: "Brings back the skills that are due, so they stay sharp." },
  break: { verb: "Brain break", does: "Opens Archie for a fun fact, a joke or a quick quiz." },
  certificates: { verb: "See awards", does: "Opens your certificates and achievements." },
  unit: { verb: "Revisit", does: "Opens the unit this prize was earned in." },
  light: { verb: "Light", does: "Lights the room. Switch it on for the night." },
  rest: { verb: "Rest day", does: "A rest day: one missed day a week keeps your streak." },
};

/** Each piece's job. Unit prizes open their own unit. */
export const PIECE_USE: Record<string, UseKind> = {
  // Study
  desk: "study",
  chair: "study",
  "homework-station": "study",
  poster: "study",
  clock: "study",
  "coffee-machine": "study",
  "pc-setup": "study",
  "neon-sign": "study",
  "golden-calculator": "study",
  rocket: "study",
  "dragon-egg": "study",
  // Plants: practice waters them
  plant: "water",
  cactus: "water",
  "window-plant": "water",
  terrarium: "water",
  greenhouse: "water",
  // Lessons
  tv: "watch",
  projector: "watch",
  "cloud-couch": "watch",
  "holo-table": "watch",
  // Games
  arcade: "play",
  skateboard: "play",
  hoop: "play",
  "skate-ramp": "play",
  foosball: "play",
  pinball: "play",
  "claw-machine": "play",
  "ball-pit": "play",
  "sim-rig": "play",
  "robot-dog": "play",
  slide: "play",
  "block-castle": "play",
  "gaming-chair": "play",
  portal: "play",
  // Notebook
  bookshelf: "read",
  beanbag: "read",
  "floor-cushion": "read",
  "side-table": "read",
  "swing-chair": "read",
  hammock: "read",
  // Scratchpad
  whiteboard: "draw",
  easel: "draw",
  // Music
  headphones: "listen",
  "record-player": "listen",
  keyboard: "listen",
  guitar: "listen",
  "vinyl-wall": "listen",
  "drum-kit": "listen",
  jukebox: "listen",
  "dj-booth": "listen",
  piano: "listen",
  "disco-ball": "listen",
  // Archie
  "calculator-bot": "ask",
  robot: "ask",
  // Review
  "coat-rack": "review",
  "time-machine": "review",
  // Brain breaks
  rug: "break",
  "yoga-mat": "break",
  fan: "break",
  "mini-fridge": "break",
  fireplace: "break",
  globe: "break",
  "snack-bar": "break",
  "candy-machine": "break",
  dumbbells: "break",
  drone: "break",
  vending: "break",
  "ice-cream-cart": "break",
  bike: "break",
  telescope: "break",
  "science-lab": "break",
  aquarium: "break",
  "infinity-pool": "break",
  "hot-tub": "break",
  planetarium: "break",
  "dino-skeleton": "break",
  // Awards
  "wall-shelf": "certificates",
  pinboard: "certificates",
  "trophy-case": "certificates",
  "dragon-statue": "certificates",
  throne: "certificates",
  "unicorn-statue": "certificates",
  // Light
  lamp: "light",
  "string-lights": "light",
  "floor-lamp": "light",
  "lava-lamp": "light",
  "ring-light": "light",
  chandelier: "light",
  // Rest
  bed: "rest",
  "bunk-bed": "rest",
};

/** Each garden ornament's job: plants are watered by practice, water and birds give a break. */
export const ORNAMENT_USE: Record<string, UseKind> = {
  flowerbed: "water",
  topiary: "water",
  tree: "water",
  fence: "study",
  mailbox: "review",
  bench: "read",
  birdbath: "break",
  pond: "break",
  fountain: "break",
  lamp: "light",
};

/** A piece's job; a unit prize opens its unit, anything unknown opens the next skill. */
export function pieceUse(itemId: string, kind: "furniture" | "ornament" = "furniture"): UseKind {
  if (kind === "ornament") return ORNAMENT_USE[itemId] ?? "study";
  if (itemId.startsWith("prize-")) return PIECE_USE[itemId] ?? "unit";
  return PIECE_USE[itemId] ?? "study";
}

/** Pieces that give a rest day while they are placed in the house. */
export const REST_PIECES = new Set(["bed", "bunk-bed"]);

// ---------------------------------------------------------------------------
// What the pieces show
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Daily goals reached in the two weeks up to `now`. */
export function recentGoalDays(progress: UserProgress, now = new Date()): number {
  const days = progress.goalDays ?? [];
  const from = dayKey(new Date(now.getTime() - 13 * DAY_MS));
  return days.filter((d) => d >= from && d <= dayKey(now)).length;
}

/** How grown the plants are: ten goals in two weeks is full grown. */
export function plantGrowth(progress: UserProgress, now = new Date()): number {
  return Math.min(1, recentGoalDays(progress, now) / 10);
}

/** Three days or more without practice: the plants droop until the next answer. */
export function plantsThirsty(progress: UserProgress, now = new Date()): boolean {
  if (!progress.lastVisit) return false;
  return (now.getTime() - new Date(progress.lastVisit).getTime()) / DAY_MS >= 3;
}

function finished(progress: UserProgress, skillId: string): boolean {
  const l = progress.skills[skillId]?.level;
  return l === "proficient" || l === "mastered";
}

/** Everything the pieces can show, from the student's own progress. */
export function liveFromProgress(progress: UserProgress, next: { title: string; keyIdea: string } | null, now = new Date()): LiveData {
  const all = units.flatMap((u) => u.skills);
  const today = progress.daily && progress.daily.day === dayKey(now) ? progress.daily.right : 0;
  return {
    ...DEFAULT_LIVE,
    goalRight: today,
    goalTarget: 10,
    streak: progress.streak ?? 0,
    unitsDone: units.filter((u) => u.skills.every((s) => finished(progress, s.id))).length,
    unitsTotal: units.length,
    skillsDone: all.filter((s) => finished(progress, s.id)).length,
    skillsTotal: all.length,
    growth: plantGrowth(progress, now),
    thirsty: plantsThirsty(progress, now),
    skillTitle: next?.title ?? null,
    keyIdea: next?.keyIdea ?? null,
    now,
  };
}

/** The line on an ornament's card. */
export function ornamentNote(itemId: string, live: LiveData): string {
  const use = pieceUse(itemId, "ornament");
  if (itemId === "mailbox") return "Skills that are due arrive here. Review brings them back, so they stay sharp.";
  if (itemId === "fence") return "Keeps the beds safe. Opens your next skill.";
  if (use === "water") return live.thirsty ? "Thirsty: three days without practice. One right answer perks it up." : USES.water.does;
  return USES[use].does;
}

/** The line on a piece's card: what it does, and what it is showing right now. */
export function pieceNote(itemId: string, live: LiveData, rest: { available: boolean } = { available: true }): string {
  const use = pieceUse(itemId);
  const shows: Record<string, string> = {
    clock: `Today: ${Math.min(live.goalRight, live.goalTarget)} of ${live.goalTarget} right toward your daily goal.`,
    bookshelf: `${live.skillsDone} of ${live.skillsTotal} books: one for every skill you finish.`,
    "trophy-case": `${live.unitsDone} of ${live.unitsTotal} trophies: one for every unit you finish.`,
    pinboard: `${live.unitsDone} cards pinned: one for every unit you finish.`,
    "neon-sign": `It reads your streak: ${live.streak} ${live.streak === 1 ? "day" : "days"}.`,
    aquarium: `${3 + Math.min(live.streak, 9)} fish: one more for each day of your streak, up to 12.`,
    rocket: live.unitsDone >= live.unitsTotal ? "Ready to launch: every unit is done." : `${live.unitsTotal - live.unitsDone} units to launch.`,
    "dragon-egg": live.unitsDone >= live.unitsTotal ? "Hatched: you finished the course." : `It cracks a little more with every unit you finish: ${live.unitsDone} of ${live.unitsTotal}.`,
    whiteboard: live.skillTitle ? `On the board: ${live.skillTitle}.` : "On the board: the skill you are on.",
    tv: live.skillTitle ? `Showing: ${live.skillTitle}.` : "Showing the skill you are on.",
    poster: live.keyIdea ? `The key idea of ${live.skillTitle ?? "your skill"}.` : "A classic formula, until you start a skill.",
  };
  if (use === "water") {
    const pct = Math.round(live.growth * 100);
    return live.thirsty ? "Thirsty: three days without practice. One right answer perks it up." : `Grows with your daily goals: ${pct}% grown. ${USES.water.does.split(":")[0]}.`;
  }
  if (use === "rest") return rest.available ? "Rest day ready: miss one day this week and your streak stays." : "Rest day used this week. Next one on Monday.";
  return shows[itemId] ?? USES[use].does;
}

// ---------------------------------------------------------------------------
// The rest day
// ---------------------------------------------------------------------------

/** Monday of the week a day falls in, as a key: rest days reset each Monday. */
export function weekKey(d: Date): string {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return dayKey(m);
}

/** A bed or bunk bed is placed in the house. */
export function hasRestPiece(progress: UserProgress): boolean {
  return (progress.placedFurnitureItems ?? []).some((p) => REST_PIECES.has(p.itemId));
}

/** This week's rest day is there to use: a bed in the house and none used since Monday. */
export function restDayAvailable(progress: UserProgress, now = new Date()): boolean {
  return hasRestPiece(progress) && progress.restDayWeek !== weekKey(now);
}
