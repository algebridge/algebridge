/**
 * "Get the idea": the first step of every lesson, before any numbers. What
 * the skill is really about, in plain words; the same idea in a situation a
 * student knows; and a picture of it. The video, the worked examples and the
 * practice come after, so the steps mean something.
 *
 * Every picture is data, drawn by components/SkillIdea.tsx, and checked by
 * the practice tests: a balance really balances at its answer, a table's
 * rows fit its headers, a graph's numbers are finite and on its axes.
 */

/** One pan of a balance: some boxes (each is x; negative means x taken away) and some weights of 1 (negative means taken away). */
export interface Pan {
  x?: number;
  ones?: number;
}

export type Curve =
  | { f: "linear"; m: number; b: number; label?: string }
  | { f: "quadratic"; a: number; b: number; c: number; label?: string }
  | { f: "cubic"; a: number; b: number; c: number; d: number; label?: string }
  | { f: "exponential"; a: number; base: number; label?: string }
  | { f: "log"; base: number; label?: string }
  | { f: "abs"; a: number; h: number; k: number; label?: string }
  | { f: "sqrt"; a: number; h: number; k: number; label?: string }
  | { f: "reciprocal"; a: number; h: number; k: number; label?: string }
  | { f: "sine"; a: number; period: number; label?: string }
  | { f: "cosine"; a: number; period: number; label?: string };

export type Picture =
  /** An equation as a balance: both pans weigh the same, and x is the box's weight (`solution`). */
  | { kind: "balance"; left: Pan; right: Pan; solution: number }
  /** A number line from min to max: marked points, a ray or a stretch (open or filled ends), and jumps (like +3) drawn as arcs. */
  | {
      kind: "numberLine";
      min: number;
      max: number;
      marks?: { at: number; label?: string }[];
      ray?: { from: number; dir: "left" | "right"; closed: boolean };
      segment?: { from: number; to: number; closedFrom: boolean; closedTo: boolean };
      jumps?: { from: number; to: number; label: string }[];
    }
  /** A coordinate graph: curves, marked points, and a shaded side of one curve (an inequality). */
  | {
      kind: "graph";
      x: [number, number];
      y: [number, number];
      curves: Curve[];
      points?: { x: number; y: number; label?: string }[];
      shade?: { curve: number; side: "above" | "below" };
    }
  /** An area model: a rectangle cut into rows and columns, each side labelled, each cell its product. */
  | { kind: "area"; rows: string[]; cols: string[]; cells: string[][]; total?: string }
  /** A bar (tape) model: bars of labelled parts, each part as wide as its value. */
  | { kind: "tape"; bars: { label: string; parts: { label: string; value: number }[] }[] }
  /** A small table, with an optional note on the pattern down the rows. */
  | { kind: "table"; headers: string[]; rows: string[][]; note?: string }
  /** A chain of steps joined by arrows (a conversion, an order of moves). */
  | { kind: "chain"; steps: string[] }
  /** Points on the complex plane: real across, imaginary up. */
  | { kind: "complexPlane"; points: { re: number; im: number; label: string }[]; max: number }
  /** The unit circle with some angles marked (degrees) and their (cos, sin) points. */
  | { kind: "unitCircle"; angles: number[] };

export interface SkillIdea {
  /** What the skill is really about, in plain words: two to four short sentences, the kind a friend would say. */
  idea: string;
  /** The same idea in something a teenager meets: money, phones, sports, games, cooking, travel. One or two sentences. */
  everyday: string;
  picture: Picture;
  /** What to notice in the picture, one sentence. */
  caption: string;
  /** Why the method works, in one to three short points. */
  why: string[];
}

export type SkillIdeas = Record<string, SkillIdea>;
