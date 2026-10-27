/**
 * The season AlgeBridge is dressed for.
 *
 * One switch the whole site reads: Archie's costume and lines, the seasonal
 * titles and furniture in the shop, the award, the leaves and the colors.
 * Nothing seasonal is ever written into saved progress as "on" or "off": a
 * title or a piece bought in season stays owned after it; only the shop and
 * the dressing follow the calendar.
 *
 * The calendar is the student's own clock (client) or the server's (API).
 * For looking at it out of season, `?season=halloween` on any page keeps the
 * season on for this browser and `?season=off` turns it off; both stay until
 * `?season=auto`.
 */

export type Season = "halloween" | null;

/** Halloween season: all of October through November 2. */
export function seasonFor(now: Date = new Date()): Season {
  const m = now.getMonth();
  const d = now.getDate();
  if (m === 9) return "halloween";
  if (m === 10 && d <= 2) return "halloween";
  return null;
}

/** The last day of the season, for "until" copy. */
export const HALLOWEEN_ENDS = "November 2";

/** The count key the seasonal award reads (progress.seasonal). One per year, so next year starts fresh. */
export function seasonKey(now: Date = new Date()): string | null {
  const s = seasonFor(now);
  return s ? `${s}-${now.getFullYear()}` : null;
}

export const SEASON_OVERRIDE_KEY = "algebridge:season";

/** The season on this device: the override if one was set, else the calendar. */
export function currentSeason(now: Date = new Date()): Season {
  if (typeof window !== "undefined") {
    try {
      const o = window.localStorage.getItem(SEASON_OVERRIDE_KEY);
      if (o === "off") return null;
      if (o === "halloween") return "halloween";
    } catch {
      // Private mode: the calendar decides.
    }
  }
  return seasonFor(now);
}

/**
 * Runs in <head> before paint: reads ?season=, saves it, and sets
 * data-season on <html> so the seasonal styles apply from the first frame.
 */
export function seasonBootScript(): string {
  return `(function(){try{var k=${JSON.stringify(SEASON_OVERRIDE_KEY)};var q=new URLSearchParams(location.search).get("season");if(q==="off"||q==="halloween")localStorage.setItem(k,q);else if(q==="auto")localStorage.removeItem(k);var o=localStorage.getItem(k);var n=new Date();var cal=(n.getMonth()===9||(n.getMonth()===10&&n.getDate()<=2))?"halloween":"";var s=o==="off"?"":o==="halloween"?"halloween":cal;if(s)document.documentElement.setAttribute("data-season",s);else document.documentElement.removeAttribute("data-season");}catch(e){}})();`;
}

// The React hook lives in lib/use-season.ts: this file is imported by API
// routes too, which must not pull in React's client hooks.
