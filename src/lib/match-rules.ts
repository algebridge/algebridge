/**
 * The rules of a two-player match, sport by sport. Pure, so they are tested.
 *
 * Alone, every court is the same loop: run to the target, answer, do your
 * move. Two players now play the sport itself:
 *
 * - Soccer: the camera is on the touchline, a goal at each end, and each
 *   player keeps to their own half. Dribble up to the halfway line (the ball
 *   runs at your feet) and shoot from there at the far goal. The other one
 *   chooses: meet you at the line, where running into the ball steals it, or
 *   stay in goal, where a right answer of their own saves the shot.
 * - Volleyball: from the sideline, one player each side of the net. The ball
 *   comes over and where it will land shows on the floor; get under it and
 *   answer right to spike it back over. A wrong answer lets it drop: a point
 *   to the other side.
 * - Wrestling: face each other and lock up. The one who shot in answers: a
 *   right answer is a takedown, a wrong one lets the other try a reversal.
 * - Cheer and skating: compete for the judges. Each round both perform in
 *   turn, run to the mark and answer; three judges hold up their scores (a
 *   right answer and a quick routine score high) and the higher total takes
 *   the round.
 *
 * The scene is 1200 by 800, seen from a high camera whose lines meet at the
 * vanishing point VP; a thing's size goes with how far down the picture it
 * stands (persp).
 */

export const VP = { x: 600, y: -110 };
/** The depth the court's figures are drawn at full size. */
const FULL = 765;

/** How big something standing at this depth is drawn, 1 at the front of the court. */
export function persp(y: number): number {
  return (y - VP.y) / (FULL - VP.y);
}

/** Along a line of the floor that runs into the picture: its x at depth y, given its x at the front. */
export function lineX(xFront: number, y: number): number {
  return VP.x + (xFront - VP.x) * persp(y);
}

/** A stretch of floor between two lines that run into the picture, from depth y0 to y1. */
export interface Trap {
  y0: number;
  y1: number;
  /** The left and right edges, as their x at the front. */
  l: number;
  r: number;
}

export function inTrap(t: Trap, x: number, y: number, margin = 0): boolean {
  return y >= t.y0 + margin * 0.5 && y <= t.y1 - margin * 0.5 && x >= lineX(t.l, y) + margin && x <= lineX(t.r, y) - margin;
}

export function clampToTrap(t: Trap, x: number, y: number, margin = 0): { x: number; y: number } {
  const cy = Math.min(t.y1 - margin * 0.5, Math.max(t.y0 + margin * 0.5, y));
  const cx = Math.min(lineX(t.r, cy) - margin, Math.max(lineX(t.l, cy) + margin, x));
  return { x: cx, y: cy };
}

/** A fair place in a stretch of floor: some way from `from`, never on top of it. */
export function spotInTrap(t: Trap, from: { x: number; y: number }, random = Math.random, gap = [170, 380]): { x: number; y: number } {
  let best = { x: (lineX(t.l, (t.y0 + t.y1) / 2) + lineX(t.r, (t.y0 + t.y1) / 2)) / 2, y: (t.y0 + t.y1) / 2 };
  let bestScore = -1;
  for (let i = 0; i < 40; i += 1) {
    const y = t.y0 + 18 + random() * (t.y1 - t.y0 - 36);
    const x0 = lineX(t.l, y) + 40;
    const x1 = lineX(t.r, y) - 40;
    const x = x0 + random() * Math.max(1, x1 - x0);
    // Distance as the player feels it: depth runs slower on the screen than across it.
    const d = Math.hypot(x - from.x, (y - from.y) * 1.6) / persp(y);
    const score = d >= gap[0] && d <= gap[1] ? 1000 - Math.abs(d - (gap[0] + gap[1]) / 2) : -Math.abs(d - (gap[0] + gap[1]) / 2);
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

// ── Soccer, from the touchline ───────────────────────────────────────────

/** The pitch from the side: the far and near touchlines, the goal lines running into the picture. */
export const PITCH: Trap = { y0: 440, y1: 772, l: 150, r: 1050 };
/** Each goal's mouth along its goal line, from depth to depth. */
export const GOAL_MOUTH = { y0: 560, y1: 660 };
/** How deep the box in front of each goal reaches into the pitch, at the front (in scene units, scaled with depth). */
export const BOX_DEPTH = 190;
/** Where the players and the ball start a kickoff. */
export const KICKOFF = { y: 612, ball: { x: 600, y: 612 }, gap: 230 };

/** Each side keeps to its own half: player one the left, player two the right. */
export const SOCCER_HALF: Record<0 | 1, Trap> = {
  0: { ...PITCH, r: 600 },
  1: { ...PITCH, l: 600 },
};
/** How far back from the halfway line a shot can be taken, at the front (scaled with depth). */
export const SHOT_ZONE = 120;

/** Is a point close enough to the halfway line, on a side's own half, to shoot from. */
export function inShotZone(side: 0 | 1, x: number, y: number): boolean {
  const reach = SHOT_ZONE * persp(y);
  return side === 0 ? x >= 600 - reach && x <= 600 + 12 : x <= 600 + reach && x >= 600 - 12;
}

/** Which goal a side attacks: player one (blue) attacks the right, player two the left. */
export function attacking(side: 0 | 1): "left" | "right" {
  return side === 0 ? "right" : "left";
}

/** The goal line's x at a depth. */
export function goalLineX(end: "left" | "right", y: number): number {
  return lineX(end === "left" ? PITCH.l : PITCH.r, y);
}

/** Is a point in the box in front of a goal: the shot. */
export function inBox(end: "left" | "right", x: number, y: number): boolean {
  if (y < GOAL_MOUTH.y0 - 70 || y > GOAL_MOUTH.y1 + 80) return false;
  const line = goalLineX(end, y);
  const depth = BOX_DEPTH * persp(y);
  return end === "left" ? x >= line && x <= line + depth : x <= line && x >= line - depth;
}

/** Where a shot goes in: a spot in the goal's mouth. */
export function shotTarget(end: "left" | "right", random = Math.random): { x: number; y: number; lift: number } {
  const y = GOAL_MOUTH.y0 + 14 + random() * (GOAL_MOUTH.y1 - GOAL_MOUTH.y0 - 28);
  const x = goalLineX(end, y) + (end === "left" ? -14 : 14) * persp(y);
  return { x, y, lift: (40 + random() * 120) * persp(y) };
}

// ── Volleyball, across the net ───────────────────────────────────────────

/** The court from the sideline: the far and near sidelines, the end lines running into the picture. */
export const VCOURT: Trap = { y0: 470, y1: 760, l: 170, r: 1030 };
/** The net, across the middle (its floor line at the front x; the camera sits a touch off it, so it shows as a panel). */
export const NET = { x: 600, near: 652, far: 582, height: 200 };
/** The two halves: player one left of the net, player two right, kept a step off it. */
export const HALF: Record<0 | 1, Trap> = {
  0: { ...VCOURT, r: 536 },
  1: { ...VCOURT, l: 676 },
};
/** The net's top at a depth, for a ball to clear. */
export function netTop(y: number): number {
  return y - NET.height * persp(y);
}

// ── Wrestling ───────────────────────────────────────────────────────────

/**
 * Who shot in when the two met: the one moving at the other harder. Null
 * when neither came on (they bumped standing still).
 */
export function shooter(a: { pos: { x: number; y: number }; vel: { x: number; y: number } }, b: { pos: { x: number; y: number }; vel: { x: number; y: number } }): 0 | 1 | null {
  const dx = b.pos.x - a.pos.x;
  const dy = (b.pos.y - a.pos.y) * 1.6;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const aIn = a.vel.x * ux + a.vel.y * 1.6 * uy;
  const bIn = -(b.vel.x * ux + b.vel.y * 1.6 * uy);
  if (Math.max(aIn, bIn) < 25) return null;
  return aIn >= bIn ? 0 : 1;
}

// ── Judges ──────────────────────────────────────────────────────────────

/** A routine, as the judges saw it: was the answer right, and how long from the mark appearing to the answer. */
export interface Routine {
  right: boolean;
  seconds: number;
}

/**
 * Three judges' cards for a routine, each to one decimal. A right answer
 * scores 8.6 to 9.9, higher the quicker it came; a wrong one 5.4 to 6.8.
 * The judges differ a little, as judges do.
 */
export function judgeCards(r: Routine, random = Math.random): [number, number, number] {
  const quick = Math.max(0, Math.min(1, (14 - r.seconds) / 11));
  const base = r.right ? 8.75 + quick * 1.05 : 5.6 + quick * 0.9;
  const card = () => {
    const v = base + (random() - 0.5) * 0.36;
    const lo = r.right ? 8.6 : 5.4;
    const hi = r.right ? 9.9 : 6.8;
    return Math.round(Math.min(hi, Math.max(lo, v)) * 10) / 10;
  };
  return [card(), card(), card()];
}

export function cardsTotal(cards: readonly number[]): number {
  return Math.round(cards.reduce((a, b) => a + b, 0) * 10) / 10;
}

/** Who takes a round of routines: the higher total; the quicker on a tie. Null only if both totals and times are equal. */
export function roundWinner(a: { total: number; seconds: number }, b: { total: number; seconds: number }): 0 | 1 | null {
  if (a.total !== b.total) return a.total > b.total ? 0 : 1;
  if (a.seconds !== b.seconds) return a.seconds < b.seconds ? 0 : 1;
  return null;
}
