/**
 * The activity ticker: one running line of what students across AlgeBridge
 * are doing right now ("Ava solved a problem", "Shaurya earned 25 Bridgeys"),
 * shown under the header on every page.
 *
 * This file is the pure part (tested by `npm run test:activity`): the kinds
 * of moment the ticker tells, the words for each, and the shape of a row as
 * the database hands it back. The browser side (posting, fetching, the
 * moving strip) lives in activity-client.ts and components/ActivityTicker.tsx.
 *
 * Privacy: a row carries a first name only (the database takes it from the
 * account's profile, never from the browser), the kind of moment, a number
 * and a short label from the curriculum or the shop. No account id leaves
 * the database, and students who hid themselves from the leaderboard never
 * appear.
 */

export const ACTIVITY_KINDS = ["solved", "bridgeys", "skill", "unit", "bought", "game"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityItem {
  /** Row id from the database; a local echo of the student's own moment is negative. */
  id: number;
  /** ISO time. */
  at: string;
  /** First name only. */
  name: string;
  kind: ActivityKind;
  amount: number | null;
  /** A skill, unit, item or game title; nothing a student typed. */
  detail: string | null;
}

/** Rows read at once, and the most the strip keeps to cycle through. */
export const RECENT_LIMIT = 40;
export const POOL_MAX = 60;
/** How often the strip asks for new rows while the tab is visible. */
export const POLL_MS = 20_000;

export const DETAIL_MAX = 48;
/** Titles from the curriculum and the shop: letters, digits and a little punctuation. Same rule as post_activity() in the database. */
const DETAIL_RE = /^[\p{L}\p{N} ,.'’&:()\-]{1,48}$/u;
const NAME_RE = /^[\p{L}\p{M}'’.\-]{1,30}$/u;

const KINDS = new Set<string>(ACTIVITY_KINDS);

export function isActivityKind(v: unknown): v is ActivityKind {
  return typeof v === "string" && KINDS.has(v);
}

/** The first name out of a profile's "First Last", or "" when there is none fit to show. */
export function firstNameOf(displayName: string | null | undefined): string {
  const first = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  return NAME_RE.test(first) ? first : "";
}

/** A title cleaned to what the database accepts, or null when it does not fit. */
export function cleanDetail(detail: string | null | undefined): string | null {
  const d = (detail ?? "").replace(/\s+/g, " ").trim().slice(0, DETAIL_MAX);
  return DETAIL_RE.test(d) ? d : null;
}

/** "a Lava Lamp", "an Arcade Cabinet"; a title that is already plural or named keeps no article. */
export function withArticle(noun: string): string {
  const n = noun.trim();
  if (!n) return n;
  if (/^(the|a|an)\s/i.test(n)) return n;
  return `${/^[aeiou]/i.test(n) ? "an" : "a"} ${n}`;
}

export function bridgeysWord(n: number): string {
  return n === 1 ? "Bridgey" : "Bridgeys";
}

/**
 * The words for one moment, the name apart so the strip can set it in bold.
 * Lines stay short: the strip is one line high and never wraps.
 */
export function activityLine(item: Pick<ActivityItem, "name" | "kind" | "amount" | "detail">): { name: string; rest: string } {
  const name = item.name || "Someone";
  switch (item.kind) {
    case "solved":
      return { name, rest: "solved a problem" };
    case "bridgeys": {
      const n = Math.max(1, Math.round(item.amount ?? 1));
      return { name, rest: `earned ${n} ${bridgeysWord(n)}` };
    }
    case "skill":
      return { name, rest: item.detail ? `finished ${item.detail}` : "finished a lesson" };
    case "unit":
      return { name, rest: item.detail ? `finished ${item.detail}` : "finished a unit" };
    case "bought":
      return { name, rest: item.detail ? `bought ${withArticle(item.detail)}` : "bought something for the house" };
    case "game":
      return { name, rest: item.detail ? `played ${item.detail}` : "played a game" };
  }
}

/** A row as recent_activity() returns it, checked field by field; anything odd is dropped. */
export function parseActivityRow(row: unknown): ActivityItem | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "number" ? r.id : typeof r.id === "string" ? Number(r.id) : NaN;
  if (!Number.isFinite(id)) return null;
  if (!isActivityKind(r.kind)) return null;
  const name = firstNameOf(typeof r.first_name === "string" ? r.first_name : "");
  if (!name) return null;
  const at = typeof r.at === "string" ? r.at : "";
  const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? Math.round(r.amount) : null;
  const detail = cleanDetail(typeof r.detail === "string" ? r.detail : null);
  return { id, at, name, kind: r.kind, amount, detail };
}

/** The same moment told twice (the student's own echo, then the row the database kept): keep one. */
export function sameMoment(a: ActivityItem, b: ActivityItem): boolean {
  if (a.name !== b.name || a.kind !== b.kind || a.amount !== b.amount || a.detail !== b.detail) return false;
  const ta = Date.parse(a.at);
  const tb = Date.parse(b.at);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return true;
  return Math.abs(ta - tb) < 90_000;
}
