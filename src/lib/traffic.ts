/**
 * Visit counts for the admin console, kept by AlgeBridge itself.
 *
 * Both sites send a small beacon to /api/traffic on every page view: which
 * site, a visitor id, the page, the site that linked here and the kind of
 * device. The visitor id is random and the browser makes a new one every day,
 * so the counts can say "12 people today" and nothing can follow one person
 * from day to day. No name, email, account or IP address is sent or kept.
 * The database keeps daily totals only (supabase/schema-2026-10-05-console.sql).
 *
 * Everything here is pure, so the browser, the route and the tests share it.
 */

export type TrafficSite = "site" | "app";
export type TrafficDevice = "phone" | "tablet" | "computer";

export type TrafficBeacon =
  | { type: "view"; site: TrafficSite; visitor: string; path: string; referrer: string | null; device: TrafficDevice | null }
  | { type: "click"; site: TrafficSite; visitor: string; label: string };

/** Where the landing page (algebridge.org) sends its beacons. */
export const TRAFFIC_ENDPOINT = "https://learn.algebridge.org/api/traffic";

/** The browser storage key for today's visitor id: "YYYY-MM-DD|uuid". */
export const VISITOR_KEY = "ab-visit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOST = /^[a-z0-9.-]{1,100}$/;
const LABEL = /^[a-z0-9-]{1,40}$/;

/** The page right after these is a person, a group or a call, never kept. */
const ID_AFTER = new Set(["messages", "groups", "room"]);

/**
 * A page as the counts keep it: no query string, no hash, and every segment
 * that names a person, group or call replaced with ":id", so
 * /messages/3f2a... is stored as /messages/:id. At most 120 characters.
 */
export function normalizePath(input: string): string {
  const bare = String(input ?? "").split(/[?#]/)[0] || "/";
  const parts = (bare.startsWith("/") ? bare : `/${bare}`).split("/");
  const cleaned = parts.map((seg, i) => {
    if (!seg) return seg;
    if (i >= 2 && ID_AFTER.has(parts[i - 1])) return ":id";
    if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(seg) || (seg.length > 24 && /\d/.test(seg))) return ":id";
    return seg.replace(/[^A-Za-z0-9_.-]/g, "");
  });
  let path = cleaned.join("/").replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.slice(0, 120) || "/";
}

/**
 * The host of the page that linked here ("google.com"), without www. or m.,
 * or null for a direct visit, a link from the same site, or anything that is
 * not a plain host name.
 */
export function referrerHost(referrer: string, ownHost: string): string | null {
  if (!referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  const strip = (h: string) => h.replace(/^(www|m)\./, "");
  host = strip(host);
  if (!host || host === strip(ownHost.toLowerCase())) return null;
  return HOST.test(host) ? host : null;
}

/** Phone, tablet or computer, from a touch screen and the screen's short side in CSS pixels. */
export function deviceClass(coarsePointer: boolean, shortSide: number): TrafficDevice {
  if (!coarsePointer) return "computer";
  return shortSide < 600 ? "phone" : "tablet";
}

/** A date as YYYY-MM-DD in the browser's own time zone. */
export function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Today's visitor id: the one saved today, or a new random one saved for the
 * rest of the day. Storage that throws (private windows, blocked storage)
 * still gets an id, only one that lasts for the page.
 */
export function dailyVisitorId(
  read: () => string | null,
  write: (value: string) => void,
  today: string,
  makeId: () => string,
): string {
  try {
    const [day, id] = (read() ?? "").split("|");
    if (day === today && id && UUID.test(id)) return id.toLowerCase();
  } catch {
    /* storage unavailable */
  }
  const id = makeId().toLowerCase();
  try {
    write(`${today}|${id}`);
  } catch {
    /* storage unavailable */
  }
  return id;
}

/** A random version 4 UUID, with crypto.randomUUID when the browser has it. */
export function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * A beacon as the route accepts it, or null. Short keys keep the body small:
 * t (view or click), s (site), v (visitor), p (path), r (referrer host),
 * d (device), l (button label).
 */
export function parseTrafficBeacon(raw: unknown): TrafficBeacon | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const site: TrafficSite | null = o.s === "site" || o.s === "app" ? o.s : null;
  const visitor = typeof o.v === "string" && UUID.test(o.v) ? o.v.toLowerCase() : null;
  if (!site || !visitor) return null;
  if (o.t === "click") {
    const label = typeof o.l === "string" && LABEL.test(o.l) ? o.l : null;
    return label ? { type: "click", site, visitor, label } : null;
  }
  if (o.t !== undefined && o.t !== "view") return null;
  const path = typeof o.p === "string" ? normalizePath(o.p) : "/";
  const referrer = typeof o.r === "string" && HOST.test(o.r) ? o.r : null;
  const device: TrafficDevice | null = o.d === "phone" || o.d === "tablet" || o.d === "computer" ? o.d : null;
  return { type: "view", site, visitor, path, referrer, device };
}

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl\/|wget|python|node-fetch|undici|axios|go-http|java\/|okhttp|phantom|selenium|puppeteer|playwright/i;

/** Crawlers, link previews, scripts and headless browsers are left out of the counts. */
export function isLikelyBot(userAgent: string): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}
