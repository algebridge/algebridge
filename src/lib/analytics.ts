/**
 * Visit counting, two ways: AlgeBridge's own daily totals for the admin
 * console (src/lib/traffic.ts), and Google Analytics 4, one property shared
 * with algebridge.org.
 *
 * `countingAllowed` is the single rule for whether a page view counts at all,
 * and `analyticsAllowed` adds Google's measurement ID on top of it. The
 * Analytics component applies both. With no ID the page loads nothing from
 * Google and sends nothing there.

/** The Algebridge property (account "Algebridge" under ivan.malchugan@gmail.com), shared with algebridge.org. */
const DEFAULT_GA_ID = "G-3JJ9QGH9DM";

/**
 * The GA4 measurement ID in use, or "" when visits are not counted. A deployment
 * overrides it with NEXT_PUBLIC_GA_ID; setting that to an empty string turns
 * counting off, which is what a district running its own copy would do.
 */
export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID ?? DEFAULT_GA_ID).trim();

export const GA_SCRIPT_ORIGIN = "https://www.googletagmanager.com";

export type AnalyticsContext = {
  /** The page is inside another page's iframe (the demos on algebridge.org). */
  framed: boolean;
  /** The current route, to leave the frame-only routes (/try, /demo) out. */
  bareRoute: boolean;
  /** window.location.hostname */
  hostname: string;
  /** navigator.globalPrivacyControl: the visitor asked not to be tracked. */
  globalPrivacyControl: boolean;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/**
 * Whether this page view counts at all. False inside a frame (the landing
 * page counts that visit itself), on the frame-only routes, on a local host,
 * and when the browser sends Global Privacy Control.
 */
export function countingAllowed(ctx: AnalyticsContext): boolean {
  if (ctx.framed || ctx.bareRoute || ctx.globalPrivacyControl) return false;
  const host = ctx.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) return false;
  return true;
}

/** Whether Google Analytics hears about this page view: a counted view, with a measurement ID. */
export function analyticsAllowed(id: string, ctx: AnalyticsContext): boolean {
  return /^G-[A-Z0-9]{4,}$/.test(id) && countingAllowed(ctx);
}

/** The gtag config: no Google signals, no ad personalization, page views sent by the app itself. */
export const GA_CONFIG = {
  send_page_view: false,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;
