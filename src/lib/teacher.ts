import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { computeCourseStatsFromProgress, normalizeProgress } from "@/lib/progress";
import type {
  ClassAssignment,
  ClassColor,
  ClassDraft,
  ClassInfo,
  CourseStatsSummary,
  Profile,
  RosterStudent,
  UserProgress,
  UserRole,
} from "@/types";

function normalizeRole(role: unknown): UserRole {
  return role === "teacher" || role === "tutor" ? role : "student";
}

export function teacherFeaturesConfigured(): boolean {
  return isSupabaseConfigured();
}

/**
 * True when a Postgres/PostgREST error means "that column or table isn't
 * there". The classroom migration (supabase/schema-classroom.sql) is additive,
 * so every call site can fall back to the pre-migration shape and keep working
 * on a database where it hasn't been run yet.
 */
function isMissingSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (code === "42703" || code === "42P01" || code === "PGRST204" || code === "PGRST202") return true;
  return /does not exist|schema cache|could not find/i.test(error.message ?? "");
}

const CLASS_COLORS: ClassColor[] = ["blue", "emerald", "amber", "violet", "rose", "slate"];

function normalizeColor(value: unknown): ClassColor {
  return CLASS_COLORS.includes(value as ClassColor) ? (value as ClassColor) : "blue";
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const [{ data }, { data: admin }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name, role, avatar_url, bio")
      .eq("id", userId)
      .maybeSingle(),
    // The database decides who is an admin. Comparing against a hardcoded
    // address here used to let the UI and the RLS policies disagree, and made
    // a second admin impossible without a deploy.
    supabase.rpc("is_admin"),
  ]);
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: normalizeRole(data.role),
    avatarUrl: data.avatar_url ?? null,
    bio: data.bio ?? null,
    isAdmin: admin === true,
  };
}

export async function setMyRole(userId: string, role: UserRole): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, role }, { onConflict: "id" });
  return error?.message ?? null;
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

interface ClassRow {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
  period?: string | null;
  grade_level?: string | null;
  color?: string | null;
  sort_order?: number | null;
  archived?: boolean | null;
}

function toClassInfo(row: ClassRow, studentCount: number, fallbackPosition: number): ClassInfo {
  return {
    id: row.id,
    name: row.name,
    joinCode: row.join_code,
    createdAt: row.created_at,
    studentCount,
    period: row.period ?? null,
    gradeLevel: row.grade_level ?? null,
    color: normalizeColor(row.color),
    position: row.sort_order ?? fallbackPosition,
    archived: row.archived ?? false,
  };
}

export async function createClass(draft: ClassDraft): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { error: "Cloud login is not configured yet." };
  const { data: userData } = await supabase.auth.getUser();
  const teacherId = userData.user?.id;
  if (!teacherId) return { error: "You must be signed in." };

  const name = draft.name.trim();
  if (!name) return { error: "Give the class a name." };

  // New classes land at the bottom of the teacher's list.
  const existing = await getMyClasses({ includeArchived: true });
  const nextPosition = existing.reduce((max, c) => Math.max(max, c.position), 0) + 1;

  const full = {
    teacher_id: teacherId,
    name,
    period: draft.period?.trim() || null,
    grade_level: draft.gradeLevel?.trim() || null,
    color: draft.color ?? "blue",
    sort_order: nextPosition,
  };

  const { error } = await supabase.from("classes").insert(full);
  if (error && isMissingSchema(error)) {
    const retry = await supabase.from("classes").insert({ teacher_id: teacherId, name });
    return { error: retry.error?.message ?? null };
  }
  return { error: error?.message ?? null };
}

export async function getMyClasses(
  opts: { includeArchived?: boolean } = {}
): Promise<ClassInfo[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const teacherId = userData.user?.id;
  if (!teacherId) return [];

  // select("*") rather than a column list: it works before and after the
  // classroom migration, and toClassInfo fills in whatever is absent.
  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", teacherId);

  if (!classes) return [];

  const { data: members } = await supabase.from("class_members").select("class_id");
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    counts.set(m.class_id, (counts.get(m.class_id) ?? 0) + 1);
  }

  const byCreated = [...(classes as ClassRow[])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  return byCreated
    .map((c, i) => toClassInfo(c, counts.get(c.id) ?? 0, i + 1))
    .filter((c) => (opts.includeArchived ? true : !c.archived))
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export async function updateClass(
  classId: string,
  patch: Partial<ClassDraft> & { archived?: boolean; position?: number }
): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";

  const full: Record<string, unknown> = {};
  if (patch.name !== undefined) full.name = patch.name.trim();
  if (patch.period !== undefined) full.period = patch.period?.trim() || null;
  if (patch.gradeLevel !== undefined) full.grade_level = patch.gradeLevel?.trim() || null;
  if (patch.color !== undefined) full.color = patch.color;
  if (patch.archived !== undefined) full.archived = patch.archived;
  if (patch.position !== undefined) full.sort_order = patch.position;
  if (Object.keys(full).length === 0) return null;

  const { error } = await supabase.from("classes").update(full).eq("id", classId);
  if (error && isMissingSchema(error)) {
    if (full.name === undefined) return CLASSROOM_MIGRATION_HINT;
    const retry = await supabase.from("classes").update({ name: full.name }).eq("id", classId);
    return retry.error ? retry.error.message : CLASSROOM_MIGRATION_HINT;
  }
  return error?.message ?? null;
}

export const CLASSROOM_MIGRATION_HINT =
  "This needs the classroom database update (supabase/schema-classroom.sql) to be run first.";

/** Persist a new manual order for a teacher's class list. */
export async function reorderClasses(orderedIds: string[]): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("classes").update({ sort_order: i + 1 }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return isMissingSchema(failed.error) ? CLASSROOM_MIGRATION_HINT : failed.error.message;
  }
  return null;
}

export async function deleteClass(classId: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  return error?.message ?? null;
}

function statsSummary(progress: UserProgress): CourseStatsSummary {
  const s = computeCourseStatsFromProgress(progress);
  return {
    percent: s.percent,
    completedSkills: s.completedSkills,
    totalSkills: s.totalSkills,
    level: s.level,
    levelTitle: s.levelTitle,
    streak: s.streak,
    xp: s.xp,
    badgeCount: s.badgeCount,
    problemsSolved: s.problemsSolved,
  };
}

export async function getClassRoster(classId: string): Promise<RosterStudent[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data: members } = await supabase
    .from("class_members")
    .select("student_id, joined_at")
    .eq("class_id", classId);

  if (!members || members.length === 0) return [];

  const studentIds = members.map((m) => m.student_id);

  const [{ data: profiles }, { data: progressRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name").in("id", studentIds),
    supabase
      .from("user_progress")
      .select("user_id, progress_json, updated_at")
      .in("user_id", studentIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const progressMap = new Map((progressRows ?? []).map((p) => [p.user_id, p]));

  return members
    .map((m) => {
      const profile = profileMap.get(m.student_id);
      const row = progressMap.get(m.student_id);
      const progress = row?.progress_json
        ? normalizeProgress(row.progress_json as UserProgress)
        : null;
      return {
        id: m.student_id,
        email: profile?.email ?? null,
        displayName: profile?.display_name ?? null,
        joinedAt: m.joined_at,
        stats: progress ? statsSummary(progress) : null,
        lastActiveAt: row?.updated_at ?? null,
        progress,
      };
    })
    .sort((a, b) =>
      (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? "")
    );
}

export async function findStudentByEmail(
  email: string
): Promise<{ id: string; email: string | null; displayName: string | null } | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("find_student_by_email", { p_email: email });
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export async function addStudentToClass(classId: string, studentId: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { error } = await supabase
    .from("class_members")
    .insert({ class_id: classId, student_id: studentId });
  return error?.message ?? null;
}

export interface BulkAddResult {
  added: string[];
  alreadyIn: string[];
  notFound: string[];
  failed: { email: string; reason: string }[];
}

/**
 * Add a whole roster at once. Teachers paste a column of emails out of their
 * SIS or a spreadsheet; anything separated by commas, semicolons, spaces or
 * newlines is accepted.
 */
export async function addStudentsByEmail(
  classId: string,
  rawEmails: string
): Promise<BulkAddResult> {
  const result: BulkAddResult = { added: [], alreadyIn: [], notFound: [], failed: [] };
  const emails = Array.from(
    new Set(
      rawEmails
        .split(/[\s,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@"))
    )
  );

  for (const email of emails) {
    const student = await findStudentByEmail(email);
    if (!student) {
      result.notFound.push(email);
      continue;
    }
    const error = await addStudentToClass(classId, student.id);
    if (!error) {
      result.added.push(student.displayName ?? email);
    } else if (/duplicate|already exists/i.test(error)) {
      result.alreadyIn.push(student.displayName ?? email);
    } else {
      result.failed.push({ email, reason: error });
    }
  }
  return result;
}

export async function removeStudentFromClass(classId: string, studentId: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", studentId);
  return error?.message ?? null;
}

export async function joinClassByCode(
  code: string
): Promise<{ className: string | null; error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { className: null, error: "Cloud login is not configured yet." };
  const { data, error } = await supabase.rpc("join_class_by_code", { p_code: code });
  if (error) return { className: null, error: error.message };
  const row = data?.[0];
  return { className: row?.class_name ?? null, error: null };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

interface AssignmentRow {
  id: string;
  class_id: string;
  unit_id: string;
  skill_id: string | null;
  title: string | null;
  note: string | null;
  due_date: string | null;
  sort_order: number | null;
  created_at: string;
}

function toAssignment(row: AssignmentRow, fallbackPosition: number): ClassAssignment {
  return {
    id: row.id,
    classId: row.class_id,
    unitId: row.unit_id,
    skillId: row.skill_id,
    title: row.title,
    note: row.note,
    dueDate: row.due_date,
    position: row.sort_order ?? fallbackPosition,
    createdAt: row.created_at,
  };
}

export interface AssignmentsResult {
  assignments: ClassAssignment[];
  /** True when the classroom migration hasn't been run on this database. */
  unavailable: boolean;
}

export async function getClassAssignments(classId: string): Promise<AssignmentsResult> {
  const supabase = createClient();
  if (!supabase) return { assignments: [], unavailable: false };
  const { data, error } = await supabase
    .from("class_assignments")
    .select("*")
    .eq("class_id", classId);
  if (error) return { assignments: [], unavailable: isMissingSchema(error) };
  const rows = (data ?? []) as AssignmentRow[];
  return {
    assignments: rows
      .map((r, i) => toAssignment(r, i + 1))
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)),
    unavailable: false,
  };
}

export async function createAssignment(input: {
  classId: string;
  unitId: string;
  skillId?: string | null;
  title?: string | null;
  note?: string | null;
  dueDate?: string | null;
}): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { assignments } = await getClassAssignments(input.classId);
  const nextPosition = assignments.reduce((max, a) => Math.max(max, a.position), 0) + 1;

  const { error } = await supabase.from("class_assignments").insert({
    class_id: input.classId,
    unit_id: input.unitId,
    skill_id: input.skillId || null,
    title: input.title?.trim() || null,
    note: input.note?.trim() || null,
    due_date: input.dueDate || null,
    sort_order: nextPosition,
  });
  if (error) return isMissingSchema(error) ? CLASSROOM_MIGRATION_HINT : error.message;
  return null;
}

export async function deleteAssignment(id: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { error } = await supabase.from("class_assignments").delete().eq("id", id);
  return error?.message ?? null;
}

/** Persist a new manual order for a class's assignment list. */
export async function reorderAssignments(orderedIds: string[]): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      supabase.from("class_assignments").update({ sort_order: i + 1 }).eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return isMissingSchema(failed.error) ? CLASSROOM_MIGRATION_HINT : failed.error.message;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Student-side view of their classes
// ---------------------------------------------------------------------------

export interface StudentClass {
  id: string;
  name: string;
  joinCode: string;
  period: string | null;
  color: ClassColor;
  teacherName: string | null;
  assignments: ClassAssignment[];
}

export async function getMyClassesAsStudent(): Promise<StudentClass[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) return [];

  // RLS narrows this to classes the student is a member of, plus any they
  // teach, filter to memberships so a teacher's own classes don't show up
  // in the student dashboard.
  const { data: memberships } = await supabase
    .from("class_members")
    .select("class_id")
    .eq("student_id", me);
  const memberIds = new Set((memberships ?? []).map((m) => m.class_id));
  if (memberIds.size === 0) return [];

  const { data: classes } = await supabase.from("classes").select("*");
  const rows = ((classes ?? []) as ClassRow[]).filter((c) => memberIds.has(c.id));
  if (rows.length === 0) return [];

  const { data: assignmentRows } = await supabase
    .from("class_assignments")
    .select("*")
    .in(
      "class_id",
      rows.map((r) => r.id)
    );

  const byClass = new Map<string, ClassAssignment[]>();
  for (const row of (assignmentRows ?? []) as AssignmentRow[]) {
    const list = byClass.get(row.class_id) ?? [];
    list.push(toAssignment(row, list.length + 1));
    byClass.set(row.class_id, list);
  }

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    joinCode: c.join_code,
    period: c.period ?? null,
    color: normalizeColor(c.color),
    teacherName: null,
    assignments: (byClass.get(c.id) ?? []).sort(
      (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)
    ),
  }));
}

export async function leaveClass(classId: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { data: userData } = await supabase.auth.getUser();
  const me = userData.user?.id;
  if (!me) return "You must be signed in.";
  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("student_id", me);
  return error?.message ?? null;
}
