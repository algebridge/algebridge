/**
 * Color with a job. Every unit of the course has its own hue, so a student
 * can tell where they are by color alone: the unit's card, its banner, its
 * path and its lessons all share it. Practice problems pick up the hue of the
 * interest their story is set in.
 *
 * A hue is a set of CSS variables (see `hueVars`), so one set of classes in
 * globals.css (.hue-banner, .hue-tint, .hue-ink...) serves all of them, and
 * every pairing of text and surface below is contrast-checked in
 * `npm run test:practice` instead of by eye. Values are Tailwind's palette.
 */

import type { CSSProperties } from "react";

export interface Hue {
  name: string;
  /** Filled surfaces: banners, the node you are on, finished steps. */
  solid: string;
  /** Where a banner's gradient ends. */
  deep: string;
  /** Text and icons on `solid` and `deep`. */
  onSolid: string;
  /** A chip on a banner: darker on deep hues, lighter on bright ones, so its text gains contrast. */
  chip: string;
  /** Quiet surfaces on a white page. */
  tint: string;
  wash: string;
  /** Borders and rails. */
  line: string;
  /** Text and icons on white, `tint` and `wash`. */
  ink: string;
  /** Progress fills and accents. */
  bar: string;
}

type Ramp = Record<50 | 100 | 200 | 400 | 500 | 600 | 700 | 800 | 950, string>;

/** A deep hue carries white text. */
function deepHue(name: string, r: Ramp, solid: 600 | 700): Hue {
  return {
    name,
    solid: r[solid],
    deep: solid === 600 ? r[700] : r[800],
    onSolid: "#ffffff",
    chip: "rgba(0, 0, 0, 0.2)",
    tint: r[50],
    wash: r[100],
    line: r[200],
    ink: r[700],
    bar: r[500],
  };
}

/** A bright hue (yellows, oranges, limes) carries dark text; white on it is unreadable. */
function brightHue(name: string, r: Ramp): Hue {
  return {
    name,
    solid: r[400],
    deep: r[500],
    onSolid: r[950],
    chip: "rgba(255, 255, 255, 0.5)",
    tint: r[50],
    wash: r[100],
    line: r[200],
    ink: r[700],
    // A 500 amber or lime bar fades into a white track; 600 still reads as the hue.
    bar: r[600],
  };
}

const RAMPS = {
  sky: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 950: "#082f49" },
  violet: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 950: "#2e1065" },
  emerald: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 950: "#022c22" },
  amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 950: "#451a03" },
  rose: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 950: "#4c0519" },
  cyan: { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 950: "#083344" },
  indigo: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 950: "#1e1b4b" },
  orange: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 950: "#431407" },
  teal: { 50: "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e", 800: "#115e59", 950: "#042f2e" },
  lime: { 50: "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 400: "#a3e635", 500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f", 800: "#3f6212", 950: "#1a2e05" },
  fuchsia: { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 400: "#e879f9", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 950: "#4a044e" },
  blue: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 950: "#172554" },
  pink: { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 950: "#500724" },
} satisfies Record<string, Ramp>;

export type HueName = keyof typeof RAMPS;

export const HUES: Record<HueName, Hue> = {
  // 600 where white text clears 4.5:1 on it, 700 where it takes 700 to get there.
  sky: deepHue("sky", RAMPS.sky, 700),
  violet: deepHue("violet", RAMPS.violet, 600),
  emerald: deepHue("emerald", RAMPS.emerald, 700),
  amber: brightHue("amber", RAMPS.amber),
  rose: deepHue("rose", RAMPS.rose, 600),
  cyan: deepHue("cyan", RAMPS.cyan, 700),
  indigo: deepHue("indigo", RAMPS.indigo, 600),
  orange: brightHue("orange", RAMPS.orange),
  teal: deepHue("teal", RAMPS.teal, 700),
  lime: brightHue("lime", RAMPS.lime),
  fuchsia: deepHue("fuchsia", RAMPS.fuchsia, 600),
  blue: deepHue("blue", RAMPS.blue, 600),
  pink: deepHue("pink", RAMPS.pink, 600),
};

/**
 * One hue per unit, in course order. Neighbours are chosen to contrast, so
 * moving on to the next unit is a visible change of place.
 */
const UNIT_HUES: Record<string, HueName> = {
  "working-with-units": "sky",
  "solving-equations": "violet",
  "linear-equations-graphs": "emerald",
  "forms-linear-equations": "amber",
  "systems-equations": "rose",
  "inequalities-systems": "cyan",
  functions: "indigo",
  sequences: "orange",
  "exponents-radicals": "teal",
  "exponential-growth-decay": "lime",
  "quadratics-factoring": "fuchsia",
  "quadratic-functions": "blue",
  "absolute-value-piecewise": "pink",
};

export function unitHue(unitId: string): Hue {
  return HUES[UNIT_HUES[unitId] ?? "blue"];
}

/** The interests a student can tap at sign-up, by their label. */
const TOPIC_HUES: Record<string, HueName> = {
  basketball: "orange",
  soccer: "emerald",
  football: "teal",
  "video games": "violet",
  minecraft: "lime",
  roblox: "sky",
  music: "fuchsia",
  "drawing & art": "pink",
  "cooking & baking": "amber",
  "animals & pets": "cyan",
  space: "indigo",
  "cars & racing": "rose",
  "anime & manga": "pink",
  "youtube & tiktok": "rose",
  "fashion & sneakers": "fuchsia",
  dance: "violet",
  "coding & tech": "blue",
  "money & business": "emerald",
};

const HUE_NAMES = Object.keys(HUES) as HueName[];

/** The hue of an interest. One a student typed in gets a steady hue of its own from its letters. */
export function topicHue(label: string): Hue {
  const key = label.trim().toLowerCase();
  const known = TOPIC_HUES[key];
  if (known) return HUES[known];
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return HUES[HUE_NAMES[h % HUE_NAMES.length]];
}

/** The CSS variables the .hue-* classes read. Put it on a wrapper's `style`. */
export function hueVars(hue: Hue): CSSProperties {
  return {
    "--hue-solid": hue.solid,
    "--hue-deep": hue.deep,
    "--hue-on-solid": hue.onSolid,
    "--hue-chip": hue.chip,
    "--hue-tint": hue.tint,
    "--hue-wash": hue.wash,
    "--hue-line": hue.line,
    "--hue-ink": hue.ink,
    "--hue-bar": hue.bar,
  } as CSSProperties;
}
