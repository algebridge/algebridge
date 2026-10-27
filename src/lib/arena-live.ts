/**
 * The Live Arena: a quiz show over the course, played against friends.
 *
 * One screen hosts (a teacher's projector, or a laptop on the table), players
 * join from their phones with a six-letter code, and everyone answers the same
 * question at the same time. Faster right answers score more, the standings
 * show after every question, and a podium ends it. The same engine runs
 * "on this computer": two to four players share one keyboard and the host
 * screen is also the answer pad.
 *
 * The host is the referee. Players only ever send one thing, an answer; the
 * host scores it and tells everyone the result, so two phones can never
 * disagree about who won. All of the scoring and the question-picking here is
 * pure, so the tests hold it (practice.test.ts).
 *
 * Nothing in the arena pays Bridgeys: points are the prize, as in a match.
 */

import { allUnits } from "@/data/curriculum";
import { getFreshProblemsForSkill } from "@/data/problem-banks";
import { isHeadMath } from "@/lib/rink";
import { stripVariantTag } from "@/lib/personalize";
import type { PracticeProblem } from "@/types";

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const QUESTION_COUNTS = [5, 10, 15] as const;
export const SECONDS_PER_QUESTION = 20;
/** Full marks for an instant right answer; half for one on the buzzer. */
export const MAX_POINTS = 1000;
export const MAX_PLAYERS = 50;
export const LOCAL_MAX_PLAYERS = 4;
export const NAME_MAX = 16;

export interface ArenaSettings {
  /** Questions come from units 1 to this one. */
  unitCap: number;
  count: number;
}

export const DEFAULT_SETTINGS: ArenaSettings = { unitCap: 3, count: 10 };

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export interface ArenaQuestion {
  /** Index in the game, from 0. */
  i: number;
  prompt: string;
  /** Four choices; `answer` is the index of the right one. */
  choices: string[];
  answer: number;
  skillTitle: string;
  unitNumber: number;
}

/** A fixed random source, so a test can replay a game. */
export type Rng = () => number;

/**
 * Four choices for a head-math problem. Multiple choice problems bring their
 * own; a numeric answer gets near misses around it (off by one, off by a
 * sign, doubled, a times-table neighbour), never a duplicate.
 */
export function choicesFor(problem: PracticeProblem, rng: Rng = Math.random): { choices: string[]; answer: number } | null {
  const right = String(problem.answer ?? "").trim();
  if (!right) return null;
  let pool: string[];
  if (problem.type === "multiple-choice" && problem.choices?.length) {
    pool = [...new Set(problem.choices.map((c) => c.trim()))];
    if (!pool.includes(right)) pool.unshift(right);
  } else {
    const n = Number(right);
    if (!Number.isFinite(n)) return null;
    const near = [n + 1, n - 1, n + 2, n - 2, -n, n * 2, n + 10, n - 10, n === 0 ? 5 : Math.round(n / 2), n + 3, n - 3].filter((v) => Number.isInteger(v) && v !== n);
    pool = [right];
    const order = shuffle(near, rng);
    for (const v of order) {
      const s = String(v);
      if (!pool.includes(s)) pool.push(s);
      if (pool.length === 4) break;
    }
  }
  pool = pool.slice(0, 4);
  while (pool.length < 4) pool.push(String(Number(right) + pool.length * 7));
  const choices = shuffle(pool, rng);
  return { choices, answer: choices.indexOf(right) };
}

function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Units 1 to cap, the top one most often (its weight is its number). */
export function weightedUnit(cap: number, rng: Rng = Math.random): number {
  const top = Math.max(1, Math.min(cap, allUnits().length));
  const total = (top * (top + 1)) / 2;
  let r = rng() * total;
  for (let u = top; u >= 1; u -= 1) {
    r -= u;
    if (r < 0) return u;
  }
  return 1;
}

/**
 * A quiz-show question has to read in a glance: one short line of plain
 * math, never a story. So on top of head math (small numbers, times-table
 * factors) a prompt must be short, one sentence, mostly symbols and the few
 * verbs a quick question uses, with none of the furniture of a word problem.
 */
const QUICK_START = /^(solve|simplify|evaluate|find|what is|what's|compute|calculate|factor|expand|which|is|how many|convert|write|rewrite|combine|add|subtract|multiply|divide|round|the slope|the y-intercept|the x-intercept|slope|f\(|g\(|h\(|[-+(]?\d|[a-z]\b|\(|√|-?\d)/i;
const STORY_WORDS = /\b(store|shop|bought|buys|buy|sells|sold|costs?|price|dollars?|each|per|tickets?|miles?|hours?|minutes?|weeks?|days?|years?|friends?|team|game|school|class|she|he|they|his|her|their|you|your|total|how much|how long|how far|if a|a car|a train|a bus|recipe|cups?|bottles?|students?|people|boxes?|bags?)\b/i;

export function isQuickQuestion(prompt: string): boolean {
  const p = prompt.trim();
  if (p.length < 4 || p.length > 64) return false;
  if (!/\d/.test(p)) return false;
  // One sentence or question, at most ten words.
  const sentences = p.split(/[.?!]\s+/).filter(Boolean);
  if (sentences.length > 1) return false;
  if (p.split(/\s+/).length > 10) return false;
  if (STORY_WORDS.test(p)) return false;
  if (/[$%]/.test(p)) return false;
  return QUICK_START.test(p);
}

/** `count` quick questions from units 1 to `unitCap`, no prompt twice. */
export function pickQuestions(settings: ArenaSettings, rng: Rng = Math.random): ArenaQuestion[] {
  const out: ArenaQuestion[] = [];
  const seen = new Set<string>();
  const units = allUnits();
  let tries = 0;
  while (out.length < settings.count && tries < settings.count * 40) {
    tries += 1;
    const unit = units[weightedUnit(settings.unitCap, rng) - 1];
    if (!unit) continue;
    const skill = unit.skills[Math.floor(rng() * unit.skills.length)];
    const pool = getFreshProblemsForSkill(skill.id, skill.problems).filter((p) => isHeadMath(p) && isQuickQuestion(stripVariantTag(p.prompt)));
    if (!pool.length) continue;
    const p = pool[Math.floor(rng() * pool.length)];
    const prompt = stripVariantTag(p.prompt);
    if (seen.has(prompt)) continue;
    const mc = choicesFor(p, rng);
    if (!mc) continue;
    seen.add(prompt);
    out.push({ i: out.length, prompt, choices: mc.choices, answer: mc.answer, skillTitle: skill.title, unitNumber: unit.number });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** A right answer scores by speed: 1000 at once, 500 on the buzzer, 0 when wrong or late. */
export function pointsFor(correct: boolean, ms: number, limitMs = SECONDS_PER_QUESTION * 1000): number {
  if (!correct) return 0;
  const t = Math.max(0, Math.min(1, ms / limitMs));
  return Math.round(MAX_POINTS * (1 - t / 2));
}

export interface ArenaPlayer {
  id: string;
  name: string;
  score: number;
  /** Right answers in a row, for the "on a streak" tag. */
  streak: number;
  /** Their answer to the current question, once in. */
  pick?: number;
  ms?: number;
  /** What the last question gave them. */
  last?: { correct: boolean; points: number };
}

export interface Standing {
  rank: number;
  player: ArenaPlayer;
}

/** Players by score, ties sharing a rank. */
export function standings(players: readonly ArenaPlayer[]): Standing[] {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const out: Standing[] = [];
  sorted.forEach((player, i) => {
    const rank = i > 0 && sorted[i - 1].score === player.score ? out[i - 1].rank : i + 1;
    out.push({ rank, player });
  });
  return out;
}

/** Everyone scored for the question just closed. */
export function scoreQuestion(players: readonly ArenaPlayer[], question: ArenaQuestion, limitMs = SECONDS_PER_QUESTION * 1000): ArenaPlayer[] {
  return players.map((p) => {
    const correct = p.pick === question.answer;
    const points = p.pick === undefined ? 0 : pointsFor(correct, p.ms ?? limitMs, limitMs);
    return { ...p, score: p.score + points, streak: correct ? p.streak + 1 : 0, last: { correct, points }, pick: undefined, ms: undefined };
  });
}

/** How many picked each choice, for the bars after a question. */
export function tally(players: readonly ArenaPlayer[], choices: number): number[] {
  const out = Array.from({ length: choices }, () => 0);
  for (const p of players) if (p.pick !== undefined && p.pick >= 0 && p.pick < choices) out[p.pick] += 1;
  return out;
}

// ---------------------------------------------------------------------------
// Codes and names
// ---------------------------------------------------------------------------

/** Letters that are never mistaken for each other on a projector. */
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

export function makeCode(rng: Rng = Math.random): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) s += CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)];
  return s;
}

/** A typed code, tidied: upper case, only the letters codes use. */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, "").replace(/[ILO]/g, "").slice(0, CODE_LENGTH);
}

export function isCode(s: string): boolean {
  return s.length === CODE_LENGTH && [...s].every((ch) => CODE_LETTERS.includes(ch));
}

/** A player's name as the room sees it: letters, digits and spaces, trimmed, short. */
export function cleanName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} '-]/gu, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

/** A name nobody in the room has yet: "Sam" becomes "Sam 2". */
export function uniqueName(name: string, taken: readonly string[]): string {
  const base = name || "Player";
  if (!taken.includes(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const next = `${base} ${n}`;
    if (!taken.includes(next)) return next;
  }
  return `${base} ${Date.now() % 1000}`;
}

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

export type Phase = "lobby" | "question" | "result" | "podium";

/** What the host tells the room. Every player screen is drawn from the latest one of these. */
export type HostMessage =
  | { type: "lobby"; players: { id: string; name: string }[]; settings: ArenaSettings }
  | { type: "question"; q: Omit<ArenaQuestion, "answer">; total: number; endsAt: number; answered: number }
  | { type: "result"; q: ArenaQuestion; counts: number[]; standings: { rank: number; id: string; name: string; score: number; streak: number; last?: { correct: boolean; points: number } }[]; total: number }
  | { type: "podium"; standings: { rank: number; id: string; name: string; score: number }[] }
  | { type: "closed" };

/** What a player tells the host. */
export type PlayerMessage = { type: "join"; id: string; name: string } | { type: "answer"; id: string; i: number; pick: number; ms: number } | { type: "leave"; id: string };

/** The result as the host sends it: `picked` is the room before scoring (the picks are still on it), `scored` after. */
export function resultMessage(picked: readonly ArenaPlayer[], scored: readonly ArenaPlayer[], q: ArenaQuestion, total: number): HostMessage {
  const players = scored;
  return {
    type: "result",
    q,
    counts: tally(picked, q.choices.length),
    standings: standings(players).map(({ rank, player }) => ({ rank, id: player.id, name: player.name, score: player.score, streak: player.streak, last: player.last })),
    total,
  };
}

export function podiumMessage(players: readonly ArenaPlayer[]): HostMessage {
  return { type: "podium", standings: standings(players).map(({ rank, player }) => ({ rank, id: player.id, name: player.name, score: player.score })) };
}

/** The keys each seat uses when everyone shares one keyboard: four per player, left to right. */
export const LOCAL_KEYS: readonly (readonly string[])[] = [
  ["1", "2", "3", "4"],
  ["7", "8", "9", "0"],
  ["a", "s", "d", "f"],
  ["h", "j", "k", "l"],
];

export const LOCAL_KEY_LABELS: readonly string[] = ["1 2 3 4", "7 8 9 0", "A S D F", "H J K L"];
