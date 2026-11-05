import { createClient } from "@/lib/supabase/client";
import { detectPersonalInfo, PERSONAL_INFO_LABELS } from "@/lib/safety";

/**
 * Announcements: one message from a tutor or an admin that every signed-in
 * person sees on the course page. The table, its limits and its contact
 * guard are in supabase/schema-2026-11-04-announcements.sql.
 */

export const ANNOUNCEMENT_LIMITS = { title: 80, body: 600, perDay: 3 } as const;
/** How long an announcement stays on the course page. */
export const ANNOUNCEMENT_DAYS = 14;
const DISMISSED_KEY = "algebridge:announcements-dismissed";

export interface Announcement {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  createdAt: string;
}

type Row = { id: string; author_id: string; title: string; body: string; created_at: string };

async function withNames(rows: Row[]): Promise<Announcement[]> {
  const supabase = createClient();
  const ids = [...new Set(rows.map((r) => r.author_id))];
  const names = new Map<string, string>();
  if (supabase && ids.length) {
    const { data } = await supabase.from("tutor_directory").select("id, display_name").in("id", ids);
    for (const p of data ?? []) if (p.display_name) names.set(p.id, p.display_name);
  }
  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: names.get(r.author_id) ?? "The AlgeBridge team",
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
  }));
}

/** The announcements still on the course page, newest first. Empty if the table is not there yet. */
export async function listRecentAnnouncements(): Promise<Announcement[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const since = new Date(Date.now() - ANNOUNCEMENT_DAYS * 86400000).toISOString();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, author_id, title, body, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return withNames(data ?? []);
}

/** Why the app would hold an announcement back, or null when it reads fine. */
export function checkAnnouncement(title: string, body: string): string | null {
  const t = title.trim();
  const b = body.trim();
  if (!t) return "Give it a title.";
  if (!b) return "Write the message.";
  if (t.length > ANNOUNCEMENT_LIMITS.title) return `Keep the title to ${ANNOUNCEMENT_LIMITS.title} characters.`;
  if (b.length > ANNOUNCEMENT_LIMITS.body) return `Keep the message to ${ANNOUNCEMENT_LIMITS.body} characters.`;
  const hits = detectPersonalInfo(`${t}\n${b}`);
  if (hits.length) {
    const kinds = [...new Set(hits.map((h) => PERSONAL_INFO_LABELS[h.kind]))].join(", ");
    return `Not sent: it looks like it has ${kinds}. Everyone who reads announcements includes students, who are minors, so keep contact details and other apps out.`;
  }
  return null;
}

export async function postAnnouncement(title: string, body: string): Promise<{ error: string | null }> {
  const refused = checkAnnouncement(title, body);
  if (refused) return { error: refused };
  const supabase = createClient();
  if (!supabase) return { error: "Cloud accounts are not configured." };
  const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim() });
  if (!error) return { error: null };
  const msg = error.message ?? "";
  if (/announcement_limit/.test(msg)) return { error: `That is ${ANNOUNCEMENT_LIMITS.perDay} today. You can post again tomorrow.` };
  if (/announcement_contact/.test(msg)) return { error: "Not sent: announcements cannot share contact details, links or other apps." };
  if (/row-level security/i.test(msg)) return { error: "Only tutors can post announcements." };
  if (/does not exist|schema cache/i.test(msg)) return { error: "Announcements are not switched on yet (the database migration has not run)." };
  return { error: "Could not post that. Try again in a moment." };
}

export async function deleteAnnouncement(id: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { error: "Cloud accounts are not configured." };
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  return { error: error ? "Could not take that down. Try again." : null };
}

export function dismissedAnnouncements(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function dismissAnnouncement(id: string): void {
  const s = dismissedAnnouncements();
  s.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s].slice(-50)));
}
