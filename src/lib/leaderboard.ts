import { HOUSE_STYLES } from "@/data/house-catalog";
import { CITY_LOTS } from "@/lib/house3d/city";
import { sanitizePlots } from "@/lib/world";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { schoolModeNow } from "@/lib/school-mode";
import { sanitizeAvatar } from "@/lib/avatar";
import type { AvatarSpec, LeaderboardEntry } from "@/types";

export type LeaderboardSort = "lessons" | "bridgeys" | "prestige";

const LEADERBOARD_TABLE = "leaderboard_stats";
/**
 * The board as other students read it, once supabase/schema-2026-10-03-safety.sql
 * has run: the same rows without anyone's account id (a user id is what let
 * a stranger message, ring or look a student up), and an is_me column so a
 * student still finds their own row. Before that migration the view does not
 * exist and the table is read as before.
 */
const LEADERBOARD_VIEW = "leaderboard_public";
const BOARD_COLUMNS = "display_name, bridgeys, completed_skills, best_furniture_value, best_furniture_name, equipped_title";

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
    houseStyle?: string | null;
    avatar?: AvatarSpec | null;
    cityPlots?: { city: string; plot: string }[];
  }
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (!supabase) return;

  const row = {
    user_id: userId,
    display_name: publicLeaderboardName(displayName),
    bridgeys: snapshot.bridgeys,
    completed_skills: snapshot.completedSkills,
    best_furniture_value: snapshot.bestFurnitureValue,
    best_furniture_name: snapshot.bestFurnitureName,
    equipped_title: snapshot.equippedTitle,
    // Opt-in, off by default; and school mode keeps everyone off the board.
    leaderboard_opt_in: snapshot.leaderboardOptIn === true && !schoolModeNow(),
    updated_at: new Date().toISOString(),
  };
  const style = snapshot.houseStyle && STREET_STYLES.has(snapshot.houseStyle) ? snapshot.houseStyle : null;
  // The street's columns, newest last: a database behind the app (a column
  // missing, a house style its check does not know yet) refuses the row,
  // names what it refused, and that column is left out from then on.
  const street: Record<string, unknown> = { house_style: style, avatar: snapshot.avatar ?? null, city_plots: snapshot.cityPlots?.length ? snapshot.cityPlots : null };
  for (let tries = 0; tries <= STREET_COLUMNS.length; tries += 1) {
    const extra: Record<string, unknown> = {};
    for (const col of STREET_COLUMNS) if (!missingColumns.has(col)) extra[col] = street[col];
    const { error } = await supabase.from(LEADERBOARD_TABLE).upsert({ ...row, ...extra }, { onConflict: "user_id" });
    if (!error) return;
    const refused = STREET_COLUMNS.find((col) => !missingColumns.has(col) && new RegExp(col).test(error.message ?? ""));
    if (!refused) return;
    missingColumns.add(refused);
  }
}

const STREET_COLUMNS = ["house_style", "avatar", "city_plots"] as const;
/** Columns of leaderboard_stats this database turned out not to have (or not to accept) during this session. */
const missingColumns = new Set<string>();

/** The house styles a street can show: every house in the shop (the check on leaderboard_stats.house_style lists the same). */
const STREET_STYLES = new Set(HOUSE_STYLES.map((h) => h.id));

/** A neighbour on the street outside a student's house: another student on the board, their house, and their character if they made one. */
export interface Neighbour {
  name: string;
  styleId: string;
  avatar?: AvatarSpec;
}

/** A small fixed hash, so the same student sees the same neighbours from one visit to the next. */
function mix(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Picks who lives on a student's street from the other students on the
 * board: the same ones every visit (ordered by a hash of the student and
 * each neighbour), so the street feels like a place rather than a shuffle.
 * Pure, so it is tested.
 */
export function pickNeighbours(rows: { name: string; styleId: string; avatar?: unknown }[], seed: string, count: number): Neighbour[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => STREET_STYLES.has(r.styleId) && r.name.trim())
    .filter((r) => {
      const key = `${r.name}|${r.styleId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({ r, k: mix(`${seed}|${r.name}|${r.styleId}`) }))
    .sort((a, b) => a.k - b.k)
    .slice(0, count)
    .map(({ r }) => ({ name: r.name, styleId: r.styleId, ...(r.avatar && typeof r.avatar === "object" ? { avatar: sanitizeAvatar(r.avatar) } : {}) }));
}

/**
 * The students who live on your street: others on the leaderboard (only
 * they are visible to other students), "First L." and their house style.
 * Empty when signed out, before the neighbours migration, or when nobody
 * else is on the board yet: the street then has open lots, never houses
 * that belong to nobody.
 */
export async function fetchNeighbours(count = CITY_LOTS.length): Promise<Neighbour[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];
  // The most recently active students first, then a fixed pick among them.
  const read = (from: string, columns: string) =>
    supabase.from(from).select(columns).eq("leaderboard_opt_in", true).order("updated_at", { ascending: false }).limit(200);
  // With characters (schema-2026-10-09-street.sql), or without them on a database before that.
  let res = await read(LEADERBOARD_VIEW, "display_name, house_style, avatar, is_me");
  if (res.error) res = await read(LEADERBOARD_VIEW, "display_name, house_style, is_me");
  if (res.error) res = await read(LEADERBOARD_TABLE, "display_name, house_style, avatar, user_id");
  if (res.error) res = await read(LEADERBOARD_TABLE, "display_name, house_style, user_id");
  if (res.error || !res.data) return [];
  type Row = { display_name: string | null; house_style: string | null; avatar?: unknown; is_me?: boolean; user_id?: string };
  const rows = (res.data as unknown as Row[])
    .filter((r) => !r.is_me && r.user_id !== me)
    // Everyone on the board has a house: a student who never moved has the cottage they started in.
    .map((r) => ({ name: publicLeaderboardName(r.display_name), styleId: r.house_style || "cottage", avatar: r.avatar }));
  return pickNeighbours(rows, me, count);
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
  const read = (from: string, columns: string) =>
    supabase
      .from(from)
      .select(columns, { count: "exact" })
      .eq("leaderboard_opt_in", true)
      .order(sortColumn, { ascending: false })
      .order(sortColumn === "completed_skills" ? "bridgeys" : "completed_skills", { ascending: false })
      .order("updated_at", { ascending: true })
      .limit(100);
  let res = await read(LEADERBOARD_VIEW, `${BOARD_COLUMNS}, is_me`);
  let viaView = !res.error;
  if (res.error) {
    res = await read(LEADERBOARD_TABLE, `user_id, ${BOARD_COLUMNS}`);
    viaView = false;
  }
  const { data, error, count } = res;

  if (error) {
    return { entries: [], total: 0, error: "Leaderboard table not set up yet. Ask your teacher to run the latest database schema." };
  }

  // Without ids, a row is keyed by its place on the board, and the student's
  // own row by their own id, which is how the page finds "you".
  const { data: auth } = viaView ? await supabase.auth.getUser() : { data: { user: null } };
  const myId = auth.user?.id ?? "me";
  type Row = {
    user_id?: string;
    is_me?: boolean;
    display_name: string | null;
    bridgeys: number | null;
    completed_skills: number | null;
    best_furniture_value: number | null;
    best_furniture_name: string | null;
    equipped_title: string | null;
  };
  const entries: LeaderboardEntry[] = ((data ?? []) as unknown as Row[]).map((row, i) => ({
    userId: viaView ? (row.is_me ? myId : `rank-${i + 1}`) : (row.user_id ?? `rank-${i + 1}`),
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
  // Counted on the view once the migration has run (the table then shows a
  // student only their own row), on the table before.
  const ahead = (from: string) =>
    supabase.from(from).select(col, { count: "exact", head: true }).eq("leaderboard_opt_in", true).gt(col, value);
  let res = await ahead(LEADERBOARD_VIEW);
  if (res.error) res = await ahead(LEADERBOARD_TABLE);
  return { rank: (res.count ?? 0) + 1, value };
}

/** Someone with a house in a city: their name, their house style, and the plot it stands on. */
export interface CityResident {
  name: string;
  styleId: string;
  plot: string;
}

/**
 * Who else has a house in this city: other students on the board who
 * bought a plot there (schema-2026-10-11-city-plots.sql). Empty when signed
 * out or before that migration; several students may share a plot, and the
 * city shows the first.
 */
export async function fetchCityResidents(cityId: string): Promise<CityResident[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  if (!supabase) return [];
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return [];
  const read = (from: string, columns: string) => supabase.from(from).select(columns);
  let res = await read(LEADERBOARD_VIEW, "display_name, house_style, city_plots, is_me").eq("leaderboard_opt_in", true).not("city_plots", "is", null).limit(400);
  if (res.error) res = await read(LEADERBOARD_TABLE, "display_name, house_style, city_plots, user_id").eq("leaderboard_opt_in", true).not("city_plots", "is", null).limit(400);
  if (res.error || !res.data) return [];
  type Row = { display_name: string | null; house_style: string | null; city_plots: unknown; is_me?: boolean; user_id?: string };
  const out: CityResident[] = [];
  for (const r of res.data as unknown as Row[]) {
    if (r.is_me || r.user_id === me) continue;
    const styleId = r.house_style && STREET_STYLES.has(r.house_style) ? r.house_style : "cottage";
    for (const p of sanitizePlots(r.city_plots)) if (p.city === cityId) out.push({ name: publicLeaderboardName(r.display_name), styleId, plot: p.plot });
  }
  return out;
}

