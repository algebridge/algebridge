/**
 * Visit counting: Google Analytics 4, one property shared with algebridge.org.
 *
 * The measurement ID comes from the deployment's environment. With no ID the
 * page loads nothing and sends nothing, so a local checkout or a preview
 * deployment never counts. `analyticsAllowed` is the single rule for whether
 * a page view counts at all; the Analytics component applies it.
 */

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
 * Whether this page view is counted. False without an ID, inside a frame (the
 * landing page counts that visit itself), on the frame-only routes, on a local
 * host, and when the browser sends Global Privacy Control.
 */
export function analyticsAllowed(id: string, ctx: AnalyticsContext): boolean {
  if (!/^G-[A-Z0-9]{4,}$/.test(id)) return false;
  if (ctx.framed || ctx.bareRoute || ctx.globalPrivacyControl) return false;
  const host = ctx.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) return false;
  return true;
}

/** The gtag config: no Google signals, no ad personalization, page views sent by the app itself. */
export const GA_CONFIG = {
  send_page_view: false,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;
