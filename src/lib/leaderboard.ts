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

export async function fetchNationwideLeaderboard(
  sort: LeaderboardSort = "lessons"
): Promise<{ entries: LeaderboardEntry[]; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { entries: [], error: "Cloud leaderboard requires sign-in. Progress is saved locally." };
  }

  const supabase = createClient();
  if (!supabase) {
    return { entries: [], error: "Could not connect to leaderboard." };
  }

  const sortColumn =
    sort === "bridgeys"
      ? "bridgeys"
      : sort === "prestige"
        ? "best_furniture_value"
        : "completed_skills";

  const { data, error } = await supabase
    .from(LEADERBOARD_TABLE)
    .select(
      "user_id, display_name, bridgeys, completed_skills, best_furniture_value, best_furniture_name, equipped_title"
    )
    .eq("leaderboard_opt_in", true)
    .order(sortColumn, { ascending: false })
    .limit(100);

  if (error) {
    return { entries: [], error: "Leaderboard table not set up yet. Ask your teacher to run the latest database schema." };
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

  return { entries, error: null };
}
