import { createClient } from "@/lib/supabase/client";
import { lookupPeople, plainDbError } from "@/lib/social";

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
  return plainDbError(error, "AlgeBridge's safety rules do not allow this request. Ask your teacher for help instead.");
}

/**
 * student_id references auth.users, not profiles, so there is no PostgREST
 * relationship to embed. Names come from a second query, same as the calendar:
 * the profiles table, then (once supabase/schema-2026-10-03-safety.sql has
 * run and tutors no longer read students' rows) the student directory.
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

  const people = await lookupPeople(rows.map((r) => r.student_id));

  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: people.get(r.student_id)?.displayName ?? null,
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
  return plainDbError(error, "That request could not be taken. Another tutor may have taken it first.");
}

export async function closeSessionRequest(id: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.from("session_requests").update({ status: "closed" }).eq("id", id);
  return plainDbError(error, "That request could not be closed. Only the tutor who took it can close it.");
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
