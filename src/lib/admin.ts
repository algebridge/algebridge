import { createClient } from "@/lib/supabase/client";
import { REPORT_REASONS } from "@/lib/safety";
import type { UserRole } from "@/types";

/**
 * Admin console data. Every call here goes through a SECURITY DEFINER RPC that
 * checks is_admin() in the database, so a forged client can't read any of it.
 * See supabase/schema-admin-console.sql.
 */

export interface AdminOverview {
  total: number;
  students: number;
  tutors: number;
  teachers: number;
  active1d: number;
  active7d: number;
  active30d: number;
  new1d: number;
  new7d: number;
  new30d: number;
  dormant: number;
  sessions7d: number;
  sessionsNext7: number;
  /**
   * A LAST-SEEN histogram over the past 30 days, not daily actives: every
   * account appears once, on the day it was last seen. The UI has to label it
   * that way, reading it as DAU would overstate a quiet day and understate a
   * busy one.
   */
  seenByDay: { day: string; n: number }[];
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  isAdmin: boolean;
  /** The shop charges this account nothing (an admin-set allowance). */
  unlimitedBridgeys: boolean;
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0) || 0;
}

export async function fetchAdminOverview(): Promise<AdminOverview | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("admin_overview");
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  return {
    total: num(d.total),
    students: num(d.students),
    tutors: num(d.tutors),
    teachers: num(d.teachers),
    active1d: num(d.active_1d),
    active7d: num(d.active_7d),
    active30d: num(d.active_30d),
    new1d: num(d.new_1d),
    new7d: num(d.new_7d),
    new30d: num(d.new_30d),
    dormant: num(d.dormant),
    sessions7d: num(d.sessions_7d),
    sessionsNext7: num(d.sessions_next7),
    seenByDay: Array.isArray(d.seen_by_day)
      ? (d.seen_by_day as { day: string; n: number }[]).map((r) => ({ day: r.day, n: num(r.n) }))
      : [],
  };
}

export async function fetchAdminUserRows(): Promise<AdminUserRow[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("admin_user_rows");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    email: (r.email as string) ?? null,
    displayName: (r.display_name as string) ?? null,
    role: ((r.role as UserRole) ?? "student") as UserRole,
    avatarUrl: (r.avatar_url as string) ?? null,
    createdAt: String(r.created_at),
    lastSeenAt: (r.last_seen_at as string) ?? null,
    isAdmin: Boolean(r.is_admin),
    unlimitedBridgeys: Boolean(r.unlimited_bridgeys),
  }));
}

export interface AdminReview {
  id: string;
  /** 1 to 5. Null only for a review sent before the rating column existed and not yet backfilled. */
  rating: number | null;
  message: string;
  createdAt: string;
  /** The reviewer's display name when they were signed in, otherwise null. */
  displayName: string | null;
}

export interface AdminReviews {
  /** Mean of every rated review, not only the 50 listed. Null with no reviews. */
  average: number | null;
  count: number;
  /** The latest 50, newest first. */
  reviews: AdminReview[];
}

/**
 * Star reviews from /feedback, via admin_reviews() (see
 * supabase/schema-2026-10-01-reviews.sql). Null when the function is missing
 * (the migration has not run) or the call fails, and the console then hides
 * its Reviews section rather than showing an empty one.
 */
export async function fetchAdminReviews(): Promise<AdminReviews | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("admin_reviews");
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const avg = d.average == null ? null : Number(d.average);
  return {
    average: avg != null && Number.isFinite(avg) ? avg : null,
    count: num(d.count),
    reviews: Array.isArray(d.reviews)
      ? (d.reviews as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          rating: r.rating == null ? null : num(r.rating),
          message: String(r.message ?? ""),
          createdAt: String(r.created_at),
          displayName: (r.display_name as string) ?? null,
        }))
      : [],
  };
}

// --- Reports ------------------------------------------------------------------

/** One report about a person, from the Report button on a message, chat, call or profile. */
export interface AdminReport {
  id: string;
  createdAt: string;
  /** bullying, personal-info, inappropriate, uncomfortable or other. */
  reason: string | null;
  /** "dm:<thread>", "group:<id>", "call:<room>" or "profile:<id>". */
  where: string | null;
  /** The reported message, quoted from the database's own copy when it had an id. */
  excerpt: string | null;
  /** Everything the report says, the reporter's own words included. */
  message: string;
  page: string | null;
  reporterId: string | null;
  reporterName: string | null;
  reportedUserId: string | null;
  reportedName: string | null;
  reportedRole: string | null;
  messageId: string | null;
  messageSentAt: string | null;
}

export type AdminReportsResult =
  | { status: "ok"; reports: AdminReport[] }
  /** admin_reports() is not in the database: supabase/schema-2026-10-03-safety.sql has not run. */
  | { status: "missing" }
  | { status: "error"; message: string };

/** The plain words for each report reason, exactly as the Report form shows them. */
export const REPORT_REASON_LABELS: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));

/**
 * Reports, newest first, through admin_reports() (admins only, checked in
 * the database). The function arrives with supabase/schema-2026-10-03-
 * safety.sql; before that it is missing and the console says so. Until then
 * the reports are only in the Supabase Table Editor (feedback, kind =
 * 'report'), because the feedback table has no read policy at all.
 */
export async function fetchAdminReports(limit = 200): Promise<AdminReportsResult> {
  const supabase = createClient();
  if (!supabase) return { status: "error", message: "Cloud accounts are not configured on this deployment." };
  const { data, error } = await supabase.rpc("admin_reports", { p_limit: limit });
  if (error) {
    const text = `${error.code ?? ""} ${error.message ?? ""}`;
    if (/PGRST202|42883|could not find the function|does not exist/i.test(text)) return { status: "missing" };
    return { status: "error", message: error.message || "The reports could not be read." };
  }
  const str = (v: unknown) => (v == null ? null : String(v));
  return {
    status: "ok",
    reports: (Array.isArray(data) ? (data as Record<string, unknown>[]) : []).map((r) => ({
      id: String(r.id),
      createdAt: String(r.created_at),
      reason: str(r.reason),
      where: str(r.report_where),
      excerpt: str(r.excerpt),
      message: String(r.message ?? ""),
      page: str(r.page),
      reporterId: str(r.reporter_id),
      reporterName: str(r.reporter_name),
      reportedUserId: str(r.reported_user_id),
      reportedName: str(r.reported_name),
      reportedRole: str(r.reported_role),
      messageId: str(r.message_id),
      messageSentAt: str(r.message_sent_at),
    })),
  };
}

/**
 * Give an account unlimited Bridgeys, or take the allowance back. Admin-only in
 * the database (set_unlimited_bridgeys checks is_admin()), and the column is
 * guarded by a trigger, so no account can grant it to itself.
 */
export async function setUnlimitedBridgeysFor(userId: string, enabled: boolean): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.rpc("set_unlimited_bridgeys", { target: userId, enabled });
  if (!error) return null;
  if (error.code === "PGRST202") return "Run supabase/schema-2026-09-22.sql first: the allowance lives in the database.";
  return error.message;
}

/** Promote an existing account to admin. Fails unless the caller is an admin. */
export async function grantAdmin(email: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.rpc("grant_admin", { p_email: email });
  return error?.message ?? null;
}

/**
 * The database is the single source of truth for who is an admin. The client
 * used to compare against a hardcoded email, which meant the UI and the RLS
 * policies could disagree.
 */
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

// --- Heartbeat -------------------------------------------------------------

const HEARTBEAT_MS = 5 * 60 * 1000;
let lastTouch = 0;

/**
 * Bump profiles.last_seen_at, at most once every 5 minutes per tab. This is
 * what the "active in the last 24h / 7d / 30d" numbers count, so it has to be
 * called from the app shell rather than from one page.
 */
export async function touchLastSeen(): Promise<void> {
  const now = Date.now();
  if (now - lastTouch < HEARTBEAT_MS) return;
  lastTouch = now;
  const supabase = createClient();
  if (!supabase) return;
  await supabase.rpc("touch_last_seen");
}
