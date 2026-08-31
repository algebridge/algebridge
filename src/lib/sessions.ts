import { createClient } from "@/lib/supabase/client";

/** Session requests: the handoff from the study helper to a real tutor. */

export interface SessionRequest {
  id: string;
  studentId: string;
  studentName: string | null;
  availability: string;
  preferredTutor: string | null;
  topic: string | null;
  status: "open" | "claimed" | "scheduled" | "closed";
  claimedBy: string | null;
  createdAt: string;
}

export interface WorkspaceCounts {
  openRequests: number;
  claimedRequests: number;
  sessionsToday: number;
  sessionsNext7: number;
}

interface RequestRow {
  id: string;
  student_id: string;
  availability: string;
  preferred_tutor: string | null;
  topic: string | null;
  status: SessionRequest["status"];
  claimed_by: string | null;
  created_at: string;
}

export async function createSessionRequest(
  studentId: string,
  availability: string,
  preferredTutor: string | null,
  topic: string | null
): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.from("session_requests").insert({
    student_id: studentId,
    availability: availability.trim().slice(0, 400),
    preferred_tutor: preferredTutor?.trim().slice(0, 120) || null,
    topic: topic?.trim().slice(0, 200) || null,
  });
  return error?.message ?? null;
}

/**
 * student_id references auth.users, not profiles, so there is no PostgREST
 * relationship to embed. Names come from a second query, same as the calendar.
 */
export async function listSessionRequests(): Promise<SessionRequest[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("session_requests")
    .select("id, student_id, availability, preferred_tutor, topic, status, claimed_by, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as RequestRow[];

  const names = new Map<string, string | null>();
  const ids = Array.from(new Set(rows.map((r) => r.student_id)));
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ids);
    for (const p of profiles ?? []) names.set(p.id as string, (p.display_name as string) ?? null);
  }

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: names.get(r.student_id) ?? null,
    availability: r.availability,
    preferredTutor: r.preferred_tutor,
    topic: r.topic,
    status: r.status,
    claimedBy: r.claimed_by,
    createdAt: r.created_at,
  }));
}

export async function claimSessionRequest(id: string, tutorId: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase
    .from("session_requests")
    .update({ status: "claimed", claimed_by: tutorId })
    .eq("id", id);
  return error?.message ?? null;
}

export async function closeSessionRequest(id: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.from("session_requests").update({ status: "closed" }).eq("id", id);
  return error?.message ?? null;
}

export async function fetchWorkspaceCounts(): Promise<WorkspaceCounts | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("workspace_counts");
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return {
    openRequests: n(d.open_requests),
    claimedRequests: n(d.claimed_requests),
    sessionsToday: n(d.sessions_today),
    sessionsNext7: n(d.sessions_next7),
  };
}
