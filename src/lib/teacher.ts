import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { computeCourseStatsFromProgress, normalizeProgress } from "@/lib/progress";
import type { ClassInfo, CourseStatsSummary, Profile, RosterStudent, UserProgress, UserRole } from "@/types";

function normalizeRole(role: unknown): UserRole {
  return role === "teacher" || role === "tutor" ? role : "student";
}

export function teacherFeaturesConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, avatar_url, bio")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: normalizeRole(data.role),
    avatarUrl: data.avatar_url ?? null,
    bio: data.bio ?? null,
    isAdmin: (data.email ?? "").toLowerCase() === ADMIN_EMAIL,
  };
}

export const ADMIN_EMAIL = "ivan.malchugan@gmail.com";

export async function setMyRole(userId: string, role: UserRole): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, role }, { onConflict: "id" });
  return error?.message ?? null;
}

export async function createClass(name: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { error: "Cloud login is not configured yet." };
  const { data: userData } = await supabase.auth.getUser();
  const teacherId = userData.user?.id;
  if (!teacherId) return { error: "You must be signed in." };

  const { error } = await supabase.from("classes").insert({ teacher_id: teacherId, name });
  return { error: error?.message ?? null };
}

export async function getMyClasses(): Promise<ClassInfo[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, join_code, created_at")
    .order("created_at", { ascending: false });

  if (!classes) return [];

  const { data: members } = await supabase.from("class_members").select("class_id");
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    counts.set(m.class_id, (counts.get(m.class_id) ?? 0) + 1);
  }

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    joinCode: c.join_code,
    createdAt: c.created_at,
    studentCount: counts.get(c.id) ?? 0,
  }));
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
    supabase.from("user_progress").select("user_id, progress_json").in("user_id", studentIds),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const progressMap = new Map((progressRows ?? []).map((p) => [p.user_id, p.progress_json]));

  return members.map((m) => {
    const profile = profileMap.get(m.student_id);
    const rawProgress = progressMap.get(m.student_id);
    return {
      id: m.student_id,
      email: profile?.email ?? null,
      displayName: profile?.display_name ?? null,
      joinedAt: m.joined_at,
      stats: rawProgress ? statsSummary(normalizeProgress(rawProgress as UserProgress)) : null,
    };
  });
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

export async function getMyClassesAsStudent(): Promise<{ id: string; name: string; joinCode: string }[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("classes").select("id, name, join_code");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, joinCode: c.join_code }));
}
