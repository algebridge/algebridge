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

// --- Traffic ------------------------------------------------------------------

/** One day of visits: a visitor is one browser on one day. */
export interface TrafficDay {
  day: string;
  siteVisitors: number;
  siteViews: number;
  appVisitors: number;
  appViews: number;
}

/** A labelled count for one site: a source, a page, a button or a device. */
export interface TrafficCount {
  site: "site" | "app";
  label: string;
  n: number;
}

export interface AdminTraffic {
  /** New York dates, the same days Google Analytics uses. */
  today: string;
  from: string;
  /** The first day anything was counted, or null before the first visit. */
  firstDay: string | null;
  days: TrafficDay[];
  referrers: TrafficCount[];
  pages: TrafficCount[];
  clicks: TrafficCount[];
  devices: TrafficCount[];
}

export type AdminTrafficResult =
  | { status: "ok"; data: AdminTraffic }
  /** admin_traffic() is not in the database: supabase/schema-2026-10-05-console.sql has not run. */
  | { status: "missing" }
  | { status: "error"; message: string };

const MISSING_FUNCTION = /PGRST202|42883|could not find the function|does not exist/i;

function site(v: unknown): "site" | "app" {
  return v === "app" ? "app" : "site";
}

/** Visit counts for both sites over the last `days` days, through admin_traffic() (admins only). */
export async function fetchAdminTraffic(days = 30): Promise<AdminTrafficResult> {
  const supabase = createClient();
  if (!supabase) return { status: "error", message: "Cloud accounts are not configured on this deployment." };
  const { data, error } = await supabase.rpc("admin_traffic", { p_days: days });
  if (error) {
    if (MISSING_FUNCTION.test(`${error.code ?? ""} ${error.message ?? ""}`)) return { status: "missing" };
    return { status: "error", message: error.message || "The visit counts could not be read." };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    status: "ok",
    data: {
      today: String(d.today ?? ""),
      from: String(d.from ?? ""),
      firstDay: d.first_day == null ? null : String(d.first_day),
      days: list(d.days).map((r) => ({
        day: String(r.day),
        siteVisitors: num(r.site_visitors),
        siteViews: num(r.site_views),
        appVisitors: num(r.app_visitors),
        appViews: num(r.app_views),
      })),
      referrers: list(d.referrers).map((r) => ({ site: site(r.site), label: String(r.referrer ?? ""), n: num(r.visitors) })),
      pages: list(d.pages).map((r) => ({ site: site(r.site), label: String(r.path ?? ""), n: num(r.views) })),
      clicks: list(d.events).map((r) => ({ site: site(r.site), label: String(r.label ?? ""), n: num(r.n) })),
      devices: list(d.devices).map((r) => ({ site: site(r.site), label: String(r.device ?? ""), n: num(r.visitors) })),
    },
  };
}

// --- Feedback -----------------------------------------------------------------

/** Anything sent from /feedback: a problem, a bug, an idea, a review or a report. */
export interface AdminFeedbackItem {
  id: string;
  /** review, problem, broken, confusing, idea, love, report or other. */
  kind: string;
  message: string;
  /** The contact the sender left, often an email, or null. */
  contact: string | null;
  /** The page it was sent from. */
  page: string | null;
  createdAt: string;
  /** 1 to 5 for a review once the reviews update has run, otherwise null. */
  rating: number | null;
  senderId: string | null;
  /** The sender's display name when they were signed in. */
  senderName: string | null;
  senderRole: string | null;
}

export interface AdminFeedback {
  total: number;
  byKind: Record<string, number>;
  /** The newest first, up to the limit asked for. */
  items: AdminFeedbackItem[];
}

export type AdminFeedbackResult =
  | { status: "ok"; data: AdminFeedback }
  /** admin_feedback() is not in the database: supabase/schema-2026-10-05-console.sql has not run. */
  | { status: "missing" }
  | { status: "error"; message: string };

/** Every piece of feedback, newest first, through admin_feedback() (admins only). */
export async function fetchAdminFeedback(limit = 300): Promise<AdminFeedbackResult> {
  const supabase = createClient();
  if (!supabase) return { status: "error", message: "Cloud accounts are not configured on this deployment." };
  const { data, error } = await supabase.rpc("admin_feedback", { p_limit: limit });
  if (error) {
    if (MISSING_FUNCTION.test(`${error.code ?? ""} ${error.message ?? ""}`)) return { status: "missing" };
    return { status: "error", message: error.message || "The feedback could not be read." };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null || v === "" ? null : String(v));
  const byKind: Record<string, number> = {};
  if (d.by_kind && typeof d.by_kind === "object") {
    for (const [k, v] of Object.entries(d.by_kind as Record<string, unknown>)) byKind[k] = num(v);
  }
  return {
    status: "ok",
    data: {
      total: num(d.total),
      byKind,
      items: (Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : []).map((r) => {
        const rating = r.rating == null ? null : Number(r.rating);
        return {
          id: String(r.id),
          kind: String(r.kind ?? "other"),
          message: String(r.message ?? ""),
          contact: str(r.contact),
          page: str(r.page),
          createdAt: String(r.created_at),
          rating: rating != null && rating >= 1 && rating <= 5 ? rating : null,
          senderId: str(r.sender_id),
          senderName: str(r.sender_name),
          senderRole: str(r.sender_role),
        };
      }),
    },
  };
}
