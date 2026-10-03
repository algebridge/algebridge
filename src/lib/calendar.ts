import { createClient } from "@/lib/supabase/client";
import { lookupPeople, plainDbError } from "@/lib/social";

/**
 * The shared tutor calendar. Tutors and admins read every entry (so a clash is
 * visible before it happens); a tutor may only write their own.
 * See supabase/schema-admin-console.sql.
 */

export type EventKind = "session" | "event";

export interface CalendarEvent {
  id: string;
  tutorId: string;
  tutorName: string | null;
  title: string;
  kind: EventKind;
  startsAt: string;
  endsAt: string;
  studentId: string | null;
  studentName: string | null;
  location: string | null;
  notes: string | null;
}

export interface EventDraft {
  title: string;
  kind: EventKind;
  startsAt: string;
  endsAt: string;
  studentId: string | null;
  location: string | null;
  notes: string | null;
}

interface EventRow {
  id: string;
  tutor_id: string;
  title: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string;
  student_id: string | null;
  location: string | null;
  notes: string | null;
}

/**
 * tutor_id and student_id reference auth.users, not profiles, so PostgREST has
 * no relationship to embed. The names are resolved in a second query instead:
 * the profiles table, then (once supabase/schema-2026-10-03-safety.sql has run
 * and tutors no longer read students' rows) the student and tutor directories.
 */
async function attachNames(rows: EventRow[]): Promise<CalendarEvent[]> {
  const people = await lookupPeople(rows.flatMap((r) => [r.tutor_id, r.student_id]));
  const nameOf = (id: string) => people.get(id)?.displayName ?? null;

  return rows.map((r) => ({
    id: r.id,
    tutorId: r.tutor_id,
    tutorName: nameOf(r.tutor_id),
    title: r.title,
    kind: r.kind,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    studentId: r.student_id,
    studentName: r.student_id ? nameOf(r.student_id) : null,
    location: r.location,
    notes: r.notes,
  }));
}

/** Every entry that overlaps [from, to). */
export async function listEvents(fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("tutor_events")
    .select("id, tutor_id, title, kind, starts_at, ends_at, student_id, location, notes")
    .lt("starts_at", toISO)
    .gt("ends_at", fromISO)
    .order("starts_at", { ascending: true });
  return attachNames((data ?? []) as EventRow[]);
}

export async function createEvent(tutorId: string, draft: EventDraft): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.from("tutor_events").insert({
    tutor_id: tutorId,
    title: draft.title.trim(),
    kind: draft.kind,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt,
    student_id: draft.studentId,
    location: draft.location?.trim() || null,
    notes: draft.notes?.trim() || null,
  });
  return plainDbError(error, "That calendar entry could not be saved. A tutor can only change their own entries.");
}

export async function updateEvent(id: string, draft: EventDraft): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase
    .from("tutor_events")
    .update({
      title: draft.title.trim(),
      kind: draft.kind,
      starts_at: draft.startsAt,
      ends_at: draft.endsAt,
      student_id: draft.studentId,
      location: draft.location?.trim() || null,
      notes: draft.notes?.trim() || null,
    })
    .eq("id", id);
  return plainDbError(error, "That calendar entry could not be saved. A tutor can only change their own entries.");
}

export async function deleteEvent(id: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.from("tutor_events").delete().eq("id", id);
  return plainDbError(error, "That calendar entry could not be deleted. A tutor can only change their own entries.");
}

export interface StudentOption {
  id: string;
  name: string;
}

/**
 * Students a tutor can book a session with. Once
 * supabase/schema-2026-10-03-safety.sql has run, that is the student_directory
 * view: only the students this tutor may reach, and no email. Before it runs
 * the view does not exist, and RLS on profiles decides, as before.
 */
export async function listStudentOptions(): Promise<StudentOption[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const viewed = await supabase
    .from("student_directory")
    .select("id, display_name")
    .order("display_name", { ascending: true });
  const rows: { id: string; display_name: string | null; email?: string | null }[] = !viewed.error
    ? (viewed.data ?? [])
    : ((
        await supabase
          .from("profiles")
          .select("id, display_name, email")
          .eq("role", "student")
          .order("display_name", { ascending: true })
      ).data ?? []);
  return rows.map((p) => ({
    id: p.id,
    name: p.display_name || p.email || "Unnamed student",
  }));
}
