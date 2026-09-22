import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { LeaderboardEntry } from "@/types";

export type LeaderboardSort = "lessons" | "bridgeys" | "prestige";

const LEADERBOARD_TABLE = "leaderboard_stats";

/**
 * The leaderboard is readable by every signed-in account, and most of them
 * belong to minors, so it must never carry a student's full real name. Show
 * the first name and a last initial ("Jordyn Harwood" -> "Jordyn H.").
 */
export function publicLeaderboardName(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return "Anonymous Student";
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last[0].toUpperCase()}.`;
}

export async function syncLeaderboardStats(
  userId: string,
  displayName: string | null,
  snapshot: {
    bridgeys: number;
    completedSkills: number;
    bestFurnitureValue: number;
    bestFurnitureName: string | null;
    equippedTitle: string | null;
    leaderboardOptIn: boolean;
  }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (!supabase) return;

  await supabase.from(LEADERBOARD_TABLE).upsert(
    {
      user_id: userId,
      display_name: publicLeaderboardName(displayName),
      bridgeys: snapshot.bridgeys,
      completed_skills: snapshot.completedSkills,
      best_furniture_value: snapshot.bestFurnitureValue,
      best_furniture_name: snapshot.bestFurnitureName,
      equipped_title: snapshot.equippedTitle,
      leaderboard_opt_in: snapshot.leaderboardOptIn,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

const SORT_COLUMN: Record<LeaderboardSort, "bridgeys" | "best_furniture_value" | "completed_skills"> = {
  bridgeys: "bridgeys",
  prestige: "best_furniture_value",
  lessons: "completed_skills",
};

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  /** How many students are on the board in all, beyond the rows returned. */
  total: number;
  error: string | null;
}

export async function fetchNationwideLeaderboard(sort: LeaderboardSort = "bridgeys"): Promise<LeaderboardResult> {
  if (!isSupabaseConfigured()) {
    return { entries: [], total: 0, error: "Cloud leaderboard requires sign-in. Progress is saved locally." };
  }

  const supabase = createClient();
  if (!supabase) {
    return { entries: [], total: 0, error: "Could not connect to leaderboard." };
  }

  const sortColumn = SORT_COLUMN[sort];

  // Ties break on the other two measures, then on who got there first, so
  // two students never share a rank by accident of row order.
  const { data, error, count } = await supabase
    .from(LEADERBOARD_TABLE)
    .select(
      "user_id, display_name, bridgeys, completed_skills, best_furniture_value, best_furniture_name, equipped_title",
      { count: "exact" }
    )
    .eq("leaderboard_opt_in", true)
    .order(sortColumn, { ascending: false })
    .order(sortColumn === "completed_skills" ? "bridgeys" : "completed_skills", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(100);

  if (error) {
    return { entries: [], total: 0, error: "Leaderboard table not set up yet. Ask your teacher to run the latest database schema." };
  }

  const entries: LeaderboardEntry[] = (data ?? []).map((row, i) => ({
    userId: row.user_id,
    displayName: row.display_name ?? "Student",
    bridgeys: row.bridgeys ?? 0,
    completedSkills: row.completed_skills ?? 0,
    bestFurnitureValue: row.best_furniture_value ?? 0,
    bestFurnitureName: row.best_furniture_name ?? null,
    equippedTitle: row.equipped_title ?? null,
    rank: i + 1,
  }));

  return { entries, total: count ?? entries.length, error: null };
}

/**
 * Where one student stands on the board, whether or not they are in the rows
 * shown: one more than the number of students ahead of them. Null when they
 * are not on the board (opted out, or never synced).
 */
export async function fetchMyStanding(
  sort: LeaderboardSort,
  userId: string
): Promise<{ rank: number; value: number } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  if (!supabase) return null;
  const col = SORT_COLUMN[sort];
  const { data: me } = await supabase
    .from(LEADERBOARD_TABLE)
    .select("bridgeys, completed_skills, best_furniture_value, leaderboard_opt_in")
    .eq("user_id", userId)
    .maybeSingle();
  if (!me || !me.leaderboard_opt_in) return null;
  const value = Number(me[col] ?? 0);
  const { count } = await supabase
    .from(LEADERBOARD_TABLE)
    .select("user_id", { count: "exact", head: true })
    .eq("leaderboard_opt_in", true)
    .gt(col, value);
  return { rank: (count ?? 0) + 1, value };
}
