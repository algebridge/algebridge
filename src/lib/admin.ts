import { createClient } from "@/lib/supabase/client";
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
  }));
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
