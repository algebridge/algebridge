/**
 * Learning insights: what students do on the platform, kept by AlgeBridge
 * itself so the team can see what to improve. Which units and skills take
 * the most time, how long one problem takes, how much Archie is used, how
 * much the games are played, and how students say they feel.
 *
 * The browser sends one small beacon per fact to /api/insights, under the
 * same rule as the page-view counts (src/lib/analytics.ts): never inside a
 * frame, on a bare route, on a local host, with Global Privacy Control, or
 * from an admin. A row carries the daily random visitor id from
 * src/lib/traffic.ts and never an account id, name, email or IP address.
 * No free text is ever sent: a message to Archie is counted and measured,
 * not stored. The database side is supabase/schema-2026-10-27-insights.sql.
 *
 * Everything here is pure, so the browser, the route and the tests share it.
 */

export const INSIGHT_NAMES = [
  "problem_attempt",
  "problem_skip",
  "skill_time",
  "archie_open",
  "archie_message",
  "game_start",
  "game_end",
  "mood",
  "mood_dismiss",
] as const;

export type InsightName = (typeof INSIGHT_NAMES)[number];
export type InsightRole = "student" | "teacher" | "tutor" | "guest";

/** One fact, as the browser sends it and the route accepts it. */
export interface InsightEvent {
  name: InsightName;
  /** Course, unit and skill ids, when the fact is about one. */
  course?: string | null;
  unit?: string | null;
  skill?: string | null;
  /** A short tag: the problem type, Archie's mode, the game, the page a mood was asked on. */
  label?: string | null;
  /** Seconds, a mood from 1 to 5, or a message's length in characters. */
  value?: number | null;
  /** Right or wrong, for an attempt. */
  ok?: boolean | null;
  /** Whether an attempt was the first try at that problem. */
  first?: boolean | null;
  /** A small count: attempts so far, problems answered, players. */
  n?: number | null;
}

export interface InsightBeacon extends InsightEvent {
  visitor: string;
  role: InsightRole;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9_-]{1,60}$/;
const NAMES = new Set<string>(INSIGHT_NAMES);
const ROLES = new Set<string>(["student", "teacher", "tutor", "guest"]);

function slug(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.toLowerCase();
  return SLUG.test(s) ? s : undefined;
}

function num(v: unknown, max = 100000): number | null | undefined {
  if (v === undefined || v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) return undefined;
  return Math.round(v * 10) / 10;
}

function bool(v: unknown): boolean | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "boolean" ? v : undefined;
}

/**
 * A beacon as the route accepts it, or null. Every field is checked here so
 * the database function only ever sees short slugs and bounded numbers.
 */
export function parseInsightBeacon(raw: unknown): InsightBeacon | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const visitor = typeof o.v === "string" && UUID.test(o.v) ? o.v.toLowerCase() : null;
  const name = typeof o.name === "string" && NAMES.has(o.name) ? (o.name as InsightName) : null;
  if (!visitor || !name) return null;
  const role: InsightRole = typeof o.role === "string" && ROLES.has(o.role) ? (o.role as InsightRole) : "guest";

  const course = slug(o.course);
  const unit = slug(o.unit);
  const skill = slug(o.skill);
  const label = slug(o.label);
  const value = num(o.value);
  const n = num(o.n);
  const ok = bool(o.ok);
  const first = bool(o.first);
  if ([course, unit, skill, label, value, n, ok, first].some((x) => x === undefined)) return null;
  if (name === "mood" && (value == null || value < 1 || value > 5 || !Number.isInteger(value))) return null;

  return {
    visitor,
    role,
    name,
    course: course ?? null,
    unit: unit ?? null,
    skill: skill ?? null,
    label: label ?? null,
    value: value ?? null,
    ok: ok ?? null,
    first: first ?? null,
    n: n === null || n === undefined ? null : Math.round(n),
  };
}

/** The arguments for record_learning_event(), in the database's own names. */
export function rpcArgs(b: InsightBeacon): Record<string, unknown> {
  return {
    p_visitor: b.visitor,
    p_role: b.role,
    p_name: b.name,
    p_course: b.course,
    p_unit: b.unit,
    p_skill: b.skill,
    p_label: b.label,
    p_value: b.value,
    p_ok: b.ok,
    p_first: b.first,
    p_n: b.n,
  };
}

/** The mood survey's five answers, lowest first. Words, never pictures. */
export const MOODS: { value: number; word: string }[] = [
  { value: 1, word: "Frustrated" },
  { value: 2, word: "Bored" },
  { value: 3, word: "Okay" },
  { value: 4, word: "Good" },
  { value: 5, word: "Great" },
];

/** What a student was doing when a mood was asked, from the page they were on. */
export function moodContext(pathname: string): string {
  const p = pathname.split(/[?#]/)[0];
  if (p.startsWith("/learn/") || p.startsWith("/unit/")) return "practice";
  if (p.startsWith("/games") || p.startsWith("/arena")) return "games";
  if (p.startsWith("/house") || p.startsWith("/room/")) return "house";
  if (p.startsWith("/messages") || p.startsWith("/groups") || p.startsWith("/tutor")) return "social";
  if (p.startsWith("/review") || p.startsWith("/notebook") || p.startsWith("/achievements") || p.startsWith("/leaderboard")) return "progress";
  if (p === "/" || p.startsWith("/algebra-2")) return "home";
  return "other";
}

/** Pages where a popup would be in the way: a live call, a teacher's console, signing in. */
export function moodAllowedOn(pathname: string): boolean {
  const p = pathname.split(/[?#]/)[0];
  return !/^\/(room\/|login|admin|teacher|classes|schools|certificate|privacy|terms|safety|guidelines)/.test(p);
}

export const MOOD_KEY = "ab-mood-asked";
/** At most one survey every six hours in one browser. */
export const MOOD_GAP_MS = 6 * 60 * 60 * 1000;
/** Asked after this much active time on the site, plus a random wait. */
export const MOOD_MIN_ACTIVE_MS = 4 * 60 * 1000;
export const MOOD_EXTRA_MAX_MS = 10 * 60 * 1000;

/**
 * When the next survey may show, in active milliseconds since the page
 * opened: four minutes plus up to ten more at random, so the moment is not
 * the same for everyone, or null when one showed in the last six hours.
 */
export function moodDueAfter(lastAskedAt: number | null, now: number, random = Math.random): number | null {
  if (lastAskedAt !== null && now - lastAskedAt < MOOD_GAP_MS) return null;
  return MOOD_MIN_ACTIVE_MS + Math.floor(random() * MOOD_EXTRA_MAX_MS);
}
