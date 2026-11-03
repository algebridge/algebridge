import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { publicLeaderboardName } from "@/lib/leaderboard";

/**
 * The Alge Carts board: smashes, wins and matches per racer, bots included.
 * Students write their own row from their kart profile; the tab hosting a
 * lobby adds each match's bot results to the bots' rows. The board shows the
 * top ten, with bots filling whatever seats students have not taken yet.
 * See supabase/schema-2026-10-31-carts-leaderboard.sql.
 */

export const BOARD_SIZE = 10;
const TABLE = "carts_leaderboard";

export interface CartsRow {
  key: string;
  name: string;
  isBot: boolean;
  smashes: number;
  wins: number;
  matches: number;
  bestStreak: number;
  xp: number;
  rank: number;
  isMe: boolean;
}

interface DbRow {
  key: string;
  name: string;
  is_bot: boolean;
  smashes: number;
  wins: number;
  matches: number;
  best_streak: number;
  xp: number;
}

const COLS = "key, name, is_bot, smashes, wins, matches, best_streak, xp";

/** A real student id, as opposed to a local or development guest. */
export function canWriteBoard(userId: string): boolean {
  return isSupabaseConfigured() && /^[0-9a-f-]{36}$/i.test(userId);
}

/** A row as carts_board() returns it: no user id and no key (supabase/schema-2026-11-03-hardening.sql). */
interface BoardRow {
  rank: number;
  name: string;
  is_bot: boolean;
  smashes: number;
  wins: number;
  matches: number;
  best_streak: number;
  xp: number;
  is_me: boolean;
}

export async function fetchCartsBoard(userId: string | null): Promise<{ rows: CartsRow[]; error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { rows: [], error: null };
  // The board without account ids. Before the hardening file runs the function
  // is missing (PGRST202) and the table is read as before; after it, the table
  // shows a student only their own row and the bots.
  let all: (Omit<DbRow, "key"> & { key: string; is_me: boolean })[];
  const board = await supabase.rpc("carts_board", { p_limit: 60 });
  if (!board.error) {
    all = ((board.data ?? []) as BoardRow[]).map((r) => ({ ...r, key: `#${r.rank}` }));
  } else if (board.error.code === "PGRST202") {
    const { data, error } = await supabase.from(TABLE).select(COLS).order("smashes", { ascending: false }).order("wins", { ascending: false }).limit(60);
    if (error) return { rows: [], error: error.message };
    const me = userId ? `u:${userId}` : null;
    all = ((data ?? []) as DbRow[]).map((r) => ({ ...r, is_me: r.key === me }));
  } else {
    return { rows: [], error: board.error.message };
  }
  const people = all.filter((r) => !r.is_bot);
  const bots = all.filter((r) => r.is_bot);
  // Students first; bots fill the seats left, never pushing a student off.
  const picked = [...people.slice(0, BOARD_SIZE), ...bots.slice(0, Math.max(0, BOARD_SIZE - Math.min(people.length, BOARD_SIZE)))];
  picked.sort((a, b) => b.smashes - a.smashes || b.wins - a.wins || b.matches - a.matches || a.name.localeCompare(b.name));
  return {
    rows: picked.map((r, i) => ({ key: r.key, name: r.name, isBot: r.is_bot, smashes: r.smashes, wins: r.wins, matches: r.matches, bestStreak: r.best_streak, xp: r.xp, rank: i + 1, isMe: r.is_me })),
    error: null,
  };
}

/** The student's own row, from the kart profile on this device. */
export async function syncMyCartsRow(userId: string, displayName: string, stats: { kills: number; wins: number; matches: number; bestStreak: number }, xp: number): Promise<void> {
  if (!canWriteBoard(userId)) return;
  const supabase = createClient();
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).upsert(
    { key: `u:${userId}`, user_id: userId, name: publicLeaderboardName(displayName), is_bot: false, smashes: stats.kills, wins: Math.min(stats.wins, stats.matches), matches: stats.matches, best_streak: stats.bestStreak, xp, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) console.warn("Alge Carts board: own row refused.", error.message);
}

/** Host: this match's bot results go on the bots' careers. */
export async function addBotResults(results: { name: string; kills: number; won: boolean; streak: number }[]): Promise<void> {
  if (!isSupabaseConfigured() || !results.length) return;
  const supabase = createClient();
  if (!supabase) return;
  const keys = results.map((r) => `b:${r.name}`);
  const { data, error } = await supabase.from(TABLE).select(COLS).in("key", keys);
  if (error) {
    console.warn("Alge Carts board: bots unread.", error.message);
    return;
  }
  const have = new Map(((data ?? []) as DbRow[]).map((r) => [r.key, r]));
  const rows = results.map((r) => {
    const old = have.get(`b:${r.name}`);
    return {
      key: `b:${r.name}`,
      user_id: null,
      name: r.name,
      is_bot: true,
      smashes: (old?.smashes ?? 0) + r.kills,
      wins: (old?.wins ?? 0) + (r.won ? 1 : 0),
      matches: (old?.matches ?? 0) + 1,
      best_streak: Math.max(old?.best_streak ?? 0, r.streak),
      xp: (old?.xp ?? 0) + r.kills * 15 + (r.won ? 40 : 0),
      updated_at: new Date().toISOString(),
    };
  });
  const { error: err2 } = await supabase.from(TABLE).upsert(rows, { onConflict: "key" });
  if (err2) console.warn("Alge Carts board: bot rows refused.", err2.message);
}
