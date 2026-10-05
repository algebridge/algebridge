/**
 * How a game session is set up: which topic its questions come from, and
 * whether it is one player or two at the same keyboard.
 *
 * Topics: the unit the student is on (the default, as before), Jumbo (every
 * topic in the course, mixed), or one exact skill. Only skills with
 * head-math problems are on the list, since a game stops for a question
 * answered in the head.
 *
 * Two players race to the same target. Whoever gets there first takes the
 * question; a right answer is a point; a miss lets the other player steal it
 * before the answer is shown. First to the agreed score wins. A match is
 * played for the win: Bridgeys come from solo play, so a friend's answers
 * never land in this student's account.
 */

import { units } from "@/data/curriculum";
import { getFreshProblemsForSkill } from "@/data/problem-banks";
import { generateProblemBank } from "@/data/skill-problem-generators";
import type { CourtGameId, GameId, PlayArea } from "@/lib/games";
import { isHeadMath, rinkSkillIds, type RinkProblem } from "@/lib/rink";
import type { PracticeProblem, UserProgress } from "@/types";

export type GameTopic = { kind: "unit" } | { kind: "jumbo" } | { kind: "skill"; skillId: string };

export interface TopicSkill {
  skillId: string;
  title: string;
  unitId: string;
  unitNumber: number;
  unitTitle: string;
}

/** A skill needs this many head-math problems in its bank to be a topic of its own. */
const MIN_HEAD_MATH = 6;

let topicCache: TopicSkill[] | null = null;

/** Every skill a game can ask about, in course order. */
export function topicSkills(): TopicSkill[] {
  if (topicCache) return topicCache;
  topicCache = units.flatMap((u) =>
    u.skills
      .filter((s) => generateProblemBank(s.id, s.problems, 7).filter((p) => isHeadMath(p as PracticeProblem)).length >= MIN_HEAD_MATH)
      .map((s) => ({ skillId: s.id, title: s.title, unitId: u.id, unitNumber: u.number, unitTitle: u.title }))
  );
  return topicCache;
}

/** The skills a topic draws from. */
export function topicSkillIds(progress: UserProgress, topic: GameTopic): string[] {
  if (topic.kind === "skill") return topicSkills().some((t) => t.skillId === topic.skillId) ? [topic.skillId] : rinkSkillIds(progress).ids;
  if (topic.kind === "jumbo") return topicSkills().map((t) => t.skillId);
  return rinkSkillIds(progress).ids;
}

/** What the topic is called on the court and in the setup: "Unit 3", "Jumbo", "Slope". */
export function topicLabel(progress: UserProgress, topic: GameTopic): string {
  if (topic.kind === "jumbo") return "Jumbo: every topic";
  if (topic.kind === "skill") {
    const t = topicSkills().find((s) => s.skillId === topic.skillId);
    if (t) return `Unit ${t.unitNumber}: ${t.title}`;
  }
  const r = rinkSkillIds(progress);
  return `Unit ${r.unitNumber}, the unit you are on`;
}

/** A head-math problem from the topic, a different one each time. */
export function pickGameProblem(progress: UserProgress, topic: GameTopic, avoid = new Set<string>(), random = Math.random): RinkProblem | null {
  const ids = topicSkillIds(progress, topic);
  const order = [...ids].sort(() => random() - 0.5);
  for (const skillId of order) {
    const unit = units.find((u) => u.skills.some((s) => s.id === skillId));
    const skill = unit?.skills.find((s) => s.id === skillId);
    if (!unit || !skill) continue;
    const head = getFreshProblemsForSkill(skillId, skill.problems).filter((p) => isHeadMath(p));
    // A single topic can run through its whole pool in a long session: then repeats are fine.
    const pool = head.filter((p) => !avoid.has(p.prompt));
    const from = pool.length ? pool : topic.kind === "skill" ? head : [];
    if (!from.length) continue;
    return { skillId, skillTitle: skill.title, unitId: unit.id, unitNumber: unit.number, problem: from[Math.floor(random() * from.length)] };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export const MATCH_LENGTHS = [3, 5, 7] as const;
export type MatchLength = (typeof MATCH_LENGTHS)[number];

export interface GameSetup {
  topic: GameTopic;
  players: 1 | 2;
  toWin: MatchLength;
  names: [string, string];
}

export const DEFAULT_SETUP: GameSetup = { topic: { kind: "unit" }, players: 1, toWin: 5, names: ["", ""] };

/** The two sides' colors: the app's blue and an orange that reads beside it. */
export const SIDE_COLORS = ["#2563eb", "#ea580c"] as const;

/** A side's name: what was typed, or Player 1 / Player 2. */
export function sideName(setup: GameSetup, side: 0 | 1): string {
  const typed = setup.names[side].trim();
  return typed || `Player ${side + 1}`;
}

/** Who plays beside the host in a match: a teammate from another sport, on this one's court. */
export const PARTNERS: Record<GameId, CourtGameId> = {
  rink: "cheer",
  wrestling: "volleyball",
  cheer: "soccer",
  volleyball: "cheer",
  soccer: "wrestling",
};

/** The score after a side answers: only a right answer moves it. */
export function scoreAfter(score: readonly [number, number], side: 0 | 1, right: boolean): [number, number] {
  const next: [number, number] = [score[0], score[1]];
  if (right) next[side] += 1;
  return next;
}

/** Who has won, if anyone. */
export function matchWinner(score: readonly [number, number], toWin: number): 0 | 1 | null {
  if (score[0] >= toWin) return 0;
  if (score[1] >= toWin) return 1;
  return null;
}

/**
 * A spot for the next target that is fair to two players: on the line of
 * points exactly as far from each (distances measured with up and down
 * counting 2.5 times, since the floor is seen at an angle), inside the
 * court, and a real run for both. Which fair spot is picked is random.
 */
export function spotFairFor(area: PlayArea, a: { x: number; y: number }, b: { x: number; y: number }, random = Math.random): { x: number; y: number } {
  const K = 2.5;
  const inside = (x: number, y: number) => {
    if (area.kind === "rect") return x >= area.x0 + 40 && x <= area.x1 - 40 && y >= area.y0 + 20 && y <= area.y1 - 20;
    const dx = (x - area.cx) / (area.rx * 0.84);
    const dy = (y - area.cy) / (area.ry * 0.84);
    return dx * dx + dy * dy <= 1;
  };
  // In the stretched plane, the fair line is the perpendicular bisector of the two players.
  const A = { x: a.x, y: a.y * K };
  const B = { x: b.x, y: b.y * K };
  const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  let dx = -(B.y - A.y);
  let dy = B.x - A.x;
  const len = Math.hypot(dx, dy);
  if (len < 1) {
    // Standing together: any direction is fair.
    const ang = random() * Math.PI * 2;
    dx = Math.cos(ang);
    dy = Math.sin(ang);
  } else {
    dx /= len;
    dy /= len;
  }
  const good: { x: number; y: number }[] = [];
  const ok: { x: number; y: number; d: number }[] = [];
  for (let t = -1600; t <= 1600; t += 16) {
    const x = M.x + dx * t;
    const y = (M.y + dy * t) / K;
    if (!inside(x, y)) continue;
    const d = Math.hypot(x - a.x, (y - a.y) * K);
    ok.push({ x, y, d });
    if (d >= 220) good.push({ x, y });
  }
  if (good.length) return good[Math.floor(random() * good.length)];
  if (ok.length) {
    // The court is too small for a long run from both: the farthest fair spot.
    const far = ok.reduce((m, q) => (q.d > m.d ? q : m));
    return { x: far.x, y: far.y };
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ---------------------------------------------------------------------------
// Remembered on this device
// ---------------------------------------------------------------------------

const SETUP_KEY = "algebridge:game-setup";

export function readSetup(): GameSetup {
  try {
    const raw = window.localStorage.getItem(SETUP_KEY);
    if (!raw) return DEFAULT_SETUP;
    const got = JSON.parse(raw) as Partial<GameSetup>;
    const t = got.topic;
    const topic: GameTopic =
      t?.kind === "jumbo" ? { kind: "jumbo" } : t?.kind === "skill" && typeof t.skillId === "string" && topicSkills().some((s) => s.skillId === t.skillId) ? { kind: "skill", skillId: t.skillId } : { kind: "unit" };
    return {
      topic,
      players: got.players === 2 ? 2 : 1,
      toWin: MATCH_LENGTHS.includes(got.toWin as MatchLength) ? (got.toWin as MatchLength) : 5,
      names: Array.isArray(got.names) ? [String(got.names[0] ?? "").slice(0, 14), String(got.names[1] ?? "").slice(0, 14)] : ["", ""],
    };
  } catch {
    return DEFAULT_SETUP;
  }
}

export function saveSetup(setup: GameSetup): void {
  try {
    window.localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  } catch {
    /* Remembering the setup is a nicety. */
  }
}
