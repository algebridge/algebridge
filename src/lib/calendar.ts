import { createClient } from "@/lib/supabase/client";

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
 * no relationship to embed. The names are resolved in a second query instead.
 */
async function attachNames(rows: EventRow[]): Promise<CalendarEvent[]> {
  const supabase = createClient();
  const ids = Array.from(
    new Set(rows.flatMap((r) => [r.tutor_id, r.student_id]).filter((v): v is string => !!v))
  );

  const names = new Map<string, string | null>();
  if (supabase && ids.length) {
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    for (const p of data ?? []) names.set(p.id as string, (p.display_name as string) ?? null);
  }

  return rows.map((r) => ({
    id: r.id,
    tutorId: r.tutor_id,
    tutorName: names.get(r.tutor_id) ?? null,
    title: r.title,
    kind: r.kind,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    studentId: r.student_id,
    studentName: r.student_id ? names.get(r.student_id) ?? null : null,
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
  return error?.message ?? null;
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
  return error?.message ?? null;
}

export async function deleteEvent(id: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.from("tutor_events").delete().eq("id", id);
  return error?.message ?? null;
}

export interface StudentOption {
  id: string;
  name: string;
}

/** Students a tutor can book a session with. RLS already limits this to them. */
export async function listStudentOptions(): Promise<StudentOption[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("role", "student")
    .order("display_name", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.display_name as string) || (p.email as string) || "Unnamed student",
  }));
}
