"use client";

/**
 * The browser side of the activity ticker (src/lib/activity.ts): posting a
 * student's own moment and reading everyone's.
 *
 * postActivity() is called where the moment happens (a right answer, a
 * purchase, a game played). It tells the strip on this page at once, so the
 * student sees their own line go by, and sends the moment to the database
 * when counting is allowed (never from a local host, a frame or a bare
 * route, the same gate as page views). The database puts the first name on
 * the row itself from the profile (only a name that passes the real-name
 * rule), checks the student is on the leaderboard and not a school account,
 * keeps a title only when the app really has it (public.ticker_titles; any
 * other is told as the plain line), and refuses more than one row every two
 * seconds, or six a minute, per account.
 */

import { countingAllowed, type AnalyticsContext } from "@/lib/analytics";
import { isBareRoute } from "@/lib/bare-route";
import { getProgress } from "@/lib/progress";
import { schoolModeNow } from "@/lib/school-mode";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  cleanDetail,
  firstNameOf,
  parseActivityRow,
  RECENT_LIMIT,
  type ActivityItem,
  type ActivityKind,
} from "@/lib/activity";

/** Who is signed in, set by AppInit once the profile is known. */
type Identity = { userId: string; firstName: string; student: boolean };

let identity: Identity | null = null;

export function setActivityIdentity(next: { userId: string; displayName: string | null; role: string } | null): void {
  if (!next) {
    identity = null;
    return;
  }
  identity = { userId: next.userId, firstName: firstNameOf(next.displayName), student: next.role === "student" };
}

/** Fired on window with the student's own moment, so the strip shows it without waiting for the database. */
export const ACTIVITY_EVENT = "algebridge-activity";

function allowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const ctx: AnalyticsContext = {
      framed: window.top !== window.self,
      bareRoute: isBareRoute(window.location.pathname),
      hostname: window.location.hostname,
      globalPrivacyControl: nav.globalPrivacyControl === true,
    };
    return countingAllowed(ctx);
  } catch {
    return false;
  }
}

let echoId = -1;

/**
 * One moment of the signed-in student's. Never throws, never waits. Dropped
 * for teachers and tutors, for a student who hid themselves from the
 * leaderboard, in school mode, and when the account has no first name yet.
 */
export function postActivity(e: { kind: ActivityKind; amount?: number | null; detail?: string | null }): void {
  try {
    const dropped = !identity
      ? "no account"
      : !identity.student
        ? "not a student"
        : !identity.firstName
          ? "no first name"
          : getProgress().leaderboardOptIn !== true
            ? "hidden from the leaderboard"
            : schoolModeNow()
              ? "school mode"
              : null;
    if (dropped || !identity) {
      // On a development build, say why a moment stays off the ticker.
      if (process.env.NODE_ENV !== "production") console.debug("[activity] dropped:", dropped);
      return;
    }
    const amount = e.kind === "bridgeys" ? Math.max(1, Math.round(e.amount ?? 1)) : null;
    const detail = e.kind === "solved" || e.kind === "bridgeys" ? null : cleanDetail(e.detail);

    const echo: ActivityItem = { id: echoId--, at: new Date().toISOString(), name: identity.firstName, kind: e.kind, amount, detail };
    window.dispatchEvent(new CustomEvent<ActivityItem>(ACTIVITY_EVENT, { detail: echo }));

    if (!allowed() || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;
    void supabase
      .rpc("post_activity", { p_kind: e.kind, p_amount: amount, p_detail: detail })
      .then(({ error }) => {
        // A database behind the app (the function missing) is quiet here: the
        // strip simply has nothing new to show until the migration runs.
        if (error && process.env.NODE_ENV !== "production") console.warn("[activity] refused:", error.code, error.message);
      });
  } catch {
    /* a moment lost is not worth an error on the page */
  }
}

/**
 * The latest moments across the platform, newest first; only rows with an id
 * past `after`. Empty when signed out, offline, or before the migration.
 */
export async function fetchActivity(after = 0, limit = RECENT_LIMIT): Promise<ActivityItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("recent_activity", { p_after: after, p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    const items: ActivityItem[] = [];
    for (const row of data) {
      const item = parseActivityRow(row);
      if (item) items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}
