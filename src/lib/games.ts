/**
 * The team games: the same loop as skating with Veronica, one per teammate
 * and their sport. Move to the target, answer a head-math problem from the
 * unit you are on, and a right answer pays. Veronica's rink lives in the
 * backyard of the House; the four here have their own courts.
 *
 * All five share one daily cap (RINK_DAILY_CAP), counted in progress.rink,
 * so the games stay a place to review rather than a second way to earn.
 */

import { SCENE_H, SCENE_W } from "@/lib/dollhouse";

export type CourtGameId = "wrestling" | "cheer" | "volleyball" | "soccer";
export type GameId = "rink" | CourtGameId;

/** Where the player can move: an ellipse or a box, in scene units (1200 × 800). */
export type PlayArea =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x0: number; x1: number; y0: number; y1: number };

export interface CourtGame {
  id: CourtGameId;
  /** Their first name, as it shows on the card. */
  player: string;
  sport: string;
  /** The invitation: "Wrestle with Shaurya". */
  title: string;
  /** One line on the card. */
  blurb: string;
  area: PlayArea;
  start: { x: number; y: number };
  /** How tall they are drawn at the front of the court, in scene units. */
  height: number;
  /** The target, in a few words, for the hint line. */
  target: string;
  /** What flashes up on a right answer. */
  cheers: string[];
  /** The button after an answer. */
  continueLabel: string;
  /** The note over the problem. */
  note: string;
  /** Movement: quick to start and stop, unlike ice. */
  accel: number;
  maxSpeed: number;
  drag: number;
  /** The game's color, for its marker and card. */
  accent: string;
}

const MOVE = { accel: 2400, maxSpeed: 470, drag: 7 };

export const COURT_GAMES: CourtGame[] = [
  {
    id: "wrestling",
    player: "Shaurya",
    sport: "Wrestling",
    title: "Wrestle with Shaurya",
    blurb: "Circle the mat, step into the gold ring, and take the shot.",
    area: { kind: "ellipse", cx: 600, cy: 590, rx: 380, ry: 140 },
    start: { x: 600, y: 640 },
    height: 172,
    target: "the gold ring",
    cheers: ["Takedown!", "Two points!", "Clean shot!", "On the mat!"],
    continueLabel: "Wrestle on",
    note: "In your head, or draw it out. Hands on the mat, calculator away.",
    ...MOVE,
    accent: "#f59e0b",
  },
  {
    id: "cheer",
    player: "Jo",
    sport: "Cheer",
    title: "Cheer with Jo",
    blurb: "Hit the star on the mat and throw a jump for the crowd.",
    area: { kind: "rect", x0: 170, x1: 1030, y0: 505, y1: 760 },
    start: { x: 600, y: 700 },
    height: 164,
    target: "the star",
    cheers: ["Go team!", "Toe touch!", "Stuck it!", "Crowd's up!"],
    continueLabel: "Keep cheering",
    note: "In your head, or draw it out. Pom-poms down, calculator away.",
    ...MOVE,
    accent: "#facc15",
  },
  {
    id: "volleyball",
    player: "Jordyn",
    sport: "Volleyball",
    title: "Spike with Jordyn",
    blurb: "Get under the ball, answer, and put it away over the net.",
    area: { kind: "rect", x0: 150, x1: 1050, y0: 575, y1: 765 },
    start: { x: 600, y: 720 },
    height: 182,
    target: "the ball",
    cheers: ["Kill!", "Spiked it!", "Point!", "Over the top!"],
    continueLabel: "Next ball",
    note: "In your head, or draw it out. Eyes on the ball, calculator away.",
    ...MOVE,
    accent: "#f97316",
  },
  {
    id: "soccer",
    player: "Rayla",
    sport: "Soccer",
    title: "Score with Rayla",
    blurb: "Run onto the ball, answer, and bury it in the net.",
    area: { kind: "rect", x0: 140, x1: 1060, y0: 400, y1: 765 },
    start: { x: 600, y: 720 },
    height: 170,
    target: "the ball",
    cheers: ["Goal!", "Top corner!", "Back of the net!", "What a strike!"],
    continueLabel: "Play on",
    note: "In your head, or draw it out. Head up, calculator away.",
    ...MOVE,
    accent: "#22c55e",
  },
];

/** What a game's card on the Games page needs: the courts have it all; the rink has its own. */
export interface GameCard {
  id: GameId;
  player: string;
  sport: string;
  title: string;
  blurb: string;
  accent: string;
  /** The player's drawn height on their court, in scene units. */
  height: number;
}

export const RINK_CARD: GameCard = {
  id: "rink",
  player: "Veronica",
  sport: "Skating",
  title: "Skate with Veronica",
  blurb: "Glide around the rink, skate through the ring, and answer.",
  accent: "#0ea5e9",
  height: 168,
};

/** Every game, the rink first. */
export const GAME_CARDS: GameCard[] = [RINK_CARD, ...COURT_GAMES];

export function getGameCard(id: string): GameCard | undefined {
  return GAME_CARDS.find((g) => g.id === id);
}

export function isGameId(id: string | null | undefined): id is GameId {
  return !!id && GAME_CARDS.some((g) => g.id === id);
}

export function getCourtGame(id: string): CourtGame | undefined {
  return COURT_GAMES.find((g) => g.id === id);
}

/** Is a point inside the area, kept `margin` units in from its edge? */
export function inArea(area: PlayArea, x: number, y: number, margin = 0): boolean {
  if (area.kind === "rect") return x >= area.x0 + margin && x <= area.x1 - margin && y >= area.y0 + margin * 0.5 && y <= area.y1 - margin * 0.5;
  const dx = (x - area.cx) / (area.rx - margin);
  const dy = (y - area.cy) / (area.ry - margin * 0.5);
  return dx * dx + dy * dy <= 1;
}

/** The nearest point inside the area. */
export function clampToArea(area: PlayArea, x: number, y: number, margin = 0): { x: number; y: number } {
  if (inArea(area, x, y, margin)) return { x, y };
  if (area.kind === "rect") {
    return {
      x: Math.min(area.x1 - margin, Math.max(area.x0 + margin, x)),
      y: Math.min(area.y1 - margin * 0.5, Math.max(area.y0 + margin * 0.5, y)),
    };
  }
  const rx = area.rx - margin;
  const ry = area.ry - margin * 0.5;
  const a = Math.atan2((y - area.cy) / ry, (x - area.cx) / rx);
  return { x: area.cx + rx * Math.cos(a), y: area.cy + ry * Math.sin(a) };
}

/**
 * A place for the next target: inside the area, a fair run from the player
 * (the vertical distance counts more, since the floor is foreshortened).
 */
export function spotAwayFrom(area: PlayArea, from: { x: number; y: number }, random = Math.random): { x: number; y: number } {
  let best = { x: 0, y: 0 };
  let bestGap = -1;
  for (let tries = 0; tries < 24; tries += 1) {
    let x: number;
    let y: number;
    if (area.kind === "rect") {
      x = area.x0 + 40 + random() * (area.x1 - area.x0 - 80);
      y = area.y0 + 20 + random() * (area.y1 - area.y0 - 40);
    } else {
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * 0.82;
      x = area.cx + Math.cos(a) * area.rx * r;
      y = area.cy + Math.sin(a) * area.ry * r;
    }
    const gap = Math.hypot(x - from.x, (y - from.y) * 2.5);
    if (gap > bestGap) {
      best = { x, y };
      bestGap = gap;
    }
    if (gap > 260) return { x, y };
  }
  return best;
}

/** Nearer the front of the court is nearer the viewer: drawn larger. */
export function depthScale(area: PlayArea, y: number): number {
  const top = area.kind === "rect" ? area.y0 : area.cy - area.ry;
  const bottom = area.kind === "rect" ? area.y1 : area.cy + area.ry;
  const t = Math.min(1, Math.max(0, (y - top) / Math.max(1, bottom - top)));
  return 0.78 + 0.22 * t;
}

export const SCENE = { W: SCENE_W, H: SCENE_H };

/** Rayla's goal, up the field: the mouth between the posts, crossbar to goal line. */
export const GOAL = { x0: 470, x1: 730, top: 188, line: 292 } as const;

/** Where Jordyn's net meets the floor; her side of the court is in front of it. */
export const NET_Y = 540;
