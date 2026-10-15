/**
 * Class controls: what a teacher lets their class see.
 *
 * A teacher can block whole units or single skills, turn parts of the app off
 * (games, the leaderboard, Bridgey House, Archie, messages and the rest),
 * open only the skills they assigned, and stop students leaving the class.
 * Stored in class_controls (supabase/schema-2026-10-15-class-controls.sql).
 *
 * A student in more than one class gets the strictest mix. Like the path
 * itself (src/lib/path.ts), the course locks are enforced in the app; leaving
 * a class is enforced by the database.
 */

import { createClient } from "@/lib/supabase/client";
import { getUnit } from "@/data/curriculum";
import type { ClassFeature } from "@/lib/school-mode";

export interface ClassControls {
  classId: string;
  blockedUnits: string[];
  blockedSkills: string[];
  blockedFeatures: ClassFeature[];
  assignedOnly: boolean;
  allowLeave: boolean;
}

/** The features a teacher can turn off, in the order the controls list them. */
export const CLASS_FEATURES: { feature: ClassFeature; name: string; detail: string }[] = [
  { feature: "games", name: "Games", detail: "The team games and Veronica's rink." },
  { feature: "leaderboard", name: "Leaderboard", detail: "The page, and their place on it." },
  { feature: "house", name: "Bridgey House", detail: "The house, the yard and the street." },
  { feature: "archie", name: "Archie", detail: "The study helper in the corner of every page." },
  { feature: "messages", name: "Messages", detail: "Direct messages." },
  { feature: "groups", name: "Group chats", detail: "AlgeGroups and every group chat." },
  { feature: "calls", name: "Video calls", detail: "Call rooms and incoming rings." },
  { feature: "tutors", name: "Tutors", detail: "The tutor directory." },
  { feature: "booking", name: "Booking a tutor", detail: "Archie's Book a tutor mode and the calendar." },
];

const FEATURE_SET = new Set<string>(CLASS_FEATURES.map((f) => f.feature));

export const CLASS_FEATURE_NAMES: Record<ClassFeature, string> = Object.fromEntries(
  CLASS_FEATURES.map((f) => [f.feature, f.name])
) as Record<ClassFeature, string>;

export function emptyControls(classId: string): ClassControls {
  return { classId, blockedUnits: [], blockedSkills: [], blockedFeatures: [], assignedOnly: false, allowLeave: true };
}

/** Everything the controls of all a student's classes add up to. */
export interface MergedControls {
  /** Skill ids that are blocked, units expanded into their skills. */
  blockedSkills: Set<string>;
  blockedFeatures: Set<ClassFeature>;
  assignedOnly: boolean;
}

export function mergeControls(list: ClassControls[]): MergedControls {
  const blockedSkills = new Set<string>();
  const blockedFeatures = new Set<ClassFeature>();
  let assignedOnly = false;
  for (const c of list) {
    for (const unitId of c.blockedUnits) getUnit(unitId)?.skills.forEach((s) => blockedSkills.add(s.id));
    c.blockedSkills.forEach((id) => blockedSkills.add(id));
    c.blockedFeatures.forEach((f) => blockedFeatures.add(f));
    assignedOnly ||= c.assignedOnly;
  }
  return { blockedSkills, blockedFeatures, assignedOnly };
}

interface ControlsRow {
  class_id: string;
  blocked_units: string[] | null;
  blocked_skills: string[] | null;
  blocked_features: string[] | null;
  assigned_only: boolean | null;
  allow_leave: boolean | null;
}

export function toControls(row: ControlsRow): ClassControls {
  return {
    classId: row.class_id,
    blockedUnits: row.blocked_units ?? [],
    blockedSkills: row.blocked_skills ?? [],
    blockedFeatures: (row.blocked_features ?? []).filter((f): f is ClassFeature => FEATURE_SET.has(f)),
    assignedOnly: !!row.assigned_only,
    allowLeave: row.allow_leave ?? true,
  };
}

export const CONTROLS_MIGRATION_HINT =
  "Class controls need a database update: run supabase/schema-2026-10-15-class-controls.sql.";

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache|could not find/i.test(error.message ?? "");
}

/** One class's controls, for its teacher. `unavailable` when the migration has not run. */
export async function getClassControls(classId: string): Promise<{ controls: ClassControls; unavailable: boolean }> {
  const supabase = createClient();
  if (!supabase) return { controls: emptyControls(classId), unavailable: false };
  const { data, error } = await supabase.from("class_controls").select("*").eq("class_id", classId).maybeSingle();
  if (error) return { controls: emptyControls(classId), unavailable: missingTable(error) };
  return { controls: data ? toControls(data as ControlsRow) : emptyControls(classId), unavailable: false };
}

export async function saveClassControls(c: ClassControls): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud login is not configured yet.";
  const { error } = await supabase.from("class_controls").upsert({
    class_id: c.classId,
    blocked_units: c.blockedUnits,
    blocked_skills: c.blockedSkills,
    blocked_features: c.blockedFeatures,
    assigned_only: c.assignedOnly,
    allow_leave: c.allowLeave,
    updated_at: new Date().toISOString(),
  });
  if (error) return missingTable(error) ? CONTROLS_MIGRATION_HINT : error.message;
  return null;
}

/**
 * The signed-in student's controls across every class they are in. RLS
 * returns the rows of classes they belong to (and, for a teacher, the
 * classes they teach), so the caller filters to memberships.
 */
export async function getMyControls(memberOf: ReadonlySet<string>): Promise<ClassControls[]> {
  const supabase = createClient();
  if (!supabase || memberOf.size === 0) return [];
  const { data, error } = await supabase.from("class_controls").select("*").in("class_id", [...memberOf]);
  if (error || !data) return [];
  return (data as ControlsRow[]).map(toControls);
}
