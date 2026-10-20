import type { PracticeProblem, Unit, UserProgress } from "@/types";
import { getFreshProblemsForSkill } from "@/data/problem-banks";
import { shuffleArray } from "@/lib/problem-utils";
import { stripVariantTag } from "@/lib/personalize";
import { explanationSteps } from "@/lib/diagnose";
import { displayAnswer } from "@/lib/problem-utils";
import { shapeKey } from "@/lib/problem-order";
import { awardBridgeys } from "@/lib/bridgeys";
import { getProgress, payAnswer, saveProgress, tallyDaily } from "@/lib/progress";

/**
 * The unit arena: three short rounds on a unit's skills, played for a score.
 *
 * - Boss: two problems from every skill in the unit, from the harder end, three
 *   lives. Opens when the unit is finished; beating it the first time pays
 *   BOSS_PAY.
 * - Speed: as many as you can in SPEED_SECONDS, from the skills open to you.
 * - Mistakes: a worked solution that ends in the right answer or in a
 *   classic wrong one (the problem's own traps); call it. Three lives.
 *
 * Right answers count toward the daily goal and pay like practice answers
 * (inside the same daily cap). Nothing here moves a skill's mastery: the
 * arena is play on what the path already opened.
 */
export type ArenaMode = "boss" | "speed" | "mistakes";

export const BOSS_PAY = 50;
export const SPEED_SECONDS = 60;
export const LIVES = 3;

export const ARENA_MODES: Record<ArenaMode, { title: string; line: string }> = {
  boss: { title: "Boss fight", line: "The whole unit in one fight. Three lives." },
  speed: { title: "Speed round", line: `As many as you can in ${SPEED_SECONDS} seconds.` },
  mistakes: { title: "Spot the mistake", line: "Right answer, or a classic mistake? Call it." },
};

/** Problems the arena can grade quickly: typed numbers, choices, and a wrong step to find. */
function playable(p: PracticeProblem): boolean {
  if (p.type === "step-order") return false;
  if (p.type === "error-analysis") return typeof p.wrongStepIndex === "number" && !!p.steps?.length;
  if (p.type === "multiple-choice") return !!p.choices?.length;
  return p.answer !== undefined;
}

/** A problem in a round, with the skill it came from (the calculator rule is per skill). */
export type ArenaProblem = PracticeProblem & {
  skillId: string;
  /** A "right or mistake?" card: the worked steps as shown, whether they are right, and why not. */
  check?: { steps: string[]; right: boolean; why?: string };
};

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A worked solution to judge, from a typed problem with traps: the steps as
 * written, ending in the right answer or, half the time, in one of its
 * classic wrong answers put where the answer was. Null when the last step
 * does not show the answer, so a swap would not read naturally.
 */
export function checkCard(p: PracticeProblem, wrong: boolean, rng: () => number = Math.random): ArenaProblem["check"] | null {
  if (p.type !== "numeric" || !p.traps?.length) return null;
  const steps = explanationSteps(p.explanation);
  if (steps.length < 2) return null;
  const answer = displayAnswer(p);
  const last = steps[steps.length - 1];
  const at = new RegExp(`(?<![\\d.])${escape(answer)}(?![\\d.])`, "g");
  const hits = [...last.matchAll(at)];
  if (!hits.length) return null;
  if (!wrong) return { steps, right: true };
  const trap = p.traps[Math.floor(rng() * p.traps.length)];
  const value = String(trap.value);
  if (value === answer) return null;
  const end = hits[hits.length - 1].index ?? 0;
  const swapped = last.slice(0, end) + value + last.slice(end + answer.length);
  return { steps: [...steps.slice(0, -1), swapped], right: false, why: trap.why };
}

function clean(p: PracticeProblem, skillId: string): ArenaProblem {
  return { ...p, prompt: stripVariantTag(p.prompt), skillId };
}

/** The problems for one round. `open` says which of the unit's skills the student may play. */
export function buildRound(unit: Unit, mode: ArenaMode, open: (skillId: string) => boolean): ArenaProblem[] {
  const skills = unit.skills.filter((s) => open(s.id));
  const banks = skills.map((s) => getFreshProblemsForSkill(s.id, s.problems).filter(playable).map((p) => clean(p, s.id)));
  if (mode === "mistakes") {
    const found = banks.flat().filter((p) => p.type === "error-analysis");
    // One card per kind of problem, so a round is ten different situations, not one cooler ten times.
    const cards: ArenaProblem[] = [];
    const kinds = new Set<string>();
    for (const p of shuffleArray(banks.flat())) {
      const kind = shapeKey(p.prompt);
      if (kinds.has(kind)) continue;
      const check = checkCard(p, Math.random() < 0.5);
      if (check) {
        kinds.add(kind);
        cards.push({ ...p, check });
      }
    }
    return shuffleArray([...shuffleArray(found).slice(0, 3), ...cards.slice(0, 10 - Math.min(3, found.length))]);
  }
  if (mode === "boss") {
    // The last problems in a bank are its harder shapes; take one from each skill, in course order.
    // Two from each skill (one in a four-skill unit or more past ten), from the harder end, in course order.
    const hard = banks.map((b) => b.filter((p) => p.type !== "error-analysis")).filter((b) => b.length);
    const each = Math.max(1, Math.min(2, Math.floor(10 / Math.max(1, hard.length))));
    return hard.flatMap((b) => {
      const tail = b.slice(Math.floor(b.length * 0.6));
      const picks: ArenaProblem[] = [];
      for (const p of shuffleArray(tail.length ? tail : b)) {
        if (picks.length >= each) break;
        if (!picks.some((q) => shapeKey(q.prompt) === shapeKey(p.prompt))) picks.push(p);
      }
      return picks;
    });
  }
  // Speed: typed and chosen answers only, dealt round-robin across skills so no skill dominates.
  const quick = banks.map((b) => b.filter((p) => p.type !== "error-analysis"));
  const out: ArenaProblem[] = [];
  for (let i = 0; out.length < 60 && quick.some((b) => b.length > i); i++) {
    for (const b of shuffleArray(quick)) if (b[i]) out.push(b[i]);
  }
  // No kind of problem twice in a row.
  for (let i = 1; i < out.length; i++) {
    if (shapeKey(out[i].prompt) !== shapeKey(out[i - 1].prompt)) continue;
    const j = out.findIndex((p, k) => k > i && shapeKey(p.prompt) !== shapeKey(out[i - 1].prompt));
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function arenaOf(progress: UserProgress) {
  return progress.arena ?? { beaten: [], best: {} };
}

export function bestScore(progress: UserProgress, unitId: string, mode: ArenaMode): number {
  return arenaOf(progress).best[`${unitId}:${mode}`] ?? 0;
}

export function bossBeaten(progress: UserProgress, unitId: string): boolean {
  return arenaOf(progress).beaten.includes(unitId);
}

/** One right answer in the arena: the daily goal and the answer pay. Returns what it paid. */
export function recordArenaRight(run: number): { paid: number; dailyBonus: number } {
  const progress = getProgress();
  const dailyBonus = tallyDaily(progress);
  const paid = payAnswer(progress, run);
  progress.totalProblemsSolved += 1;
  saveProgress(progress);
  return { paid, dailyBonus };
}

/** The end of a round: a new best is kept, and a first boss win pays. */
export function finishRound(unitId: string, mode: ArenaMode, score: number, won: boolean): { best: boolean; bossPay: number } {
  const progress = getProgress();
  const arena = { beaten: [...arenaOf(progress).beaten], best: { ...arenaOf(progress).best } };
  const key = `${unitId}:${mode}`;
  const best = score > (arena.best[key] ?? 0);
  if (best) arena.best[key] = score;
  let bossPay = 0;
  if (mode === "boss" && won && !arena.beaten.includes(unitId)) {
    arena.beaten.push(unitId);
    bossPay = awardBridgeys(progress, BOSS_PAY);
  }
  progress.arena = arena;
  saveProgress(progress);
  return { best, bossPay };
}
