import type { ArenaId } from "../../types";
import type { ArenaDef } from "../Arena";
import { NEON_HARBOR } from "./neonHarbor";
import { SUNSET_MESA } from "./sunsetMesa";

export const ARENAS: Record<ArenaId, ArenaDef> = {
  "sunset-mesa": SUNSET_MESA,
  "neon-harbor": NEON_HARBOR,
};

export const ARENA_ORDER: ArenaId[] = ["sunset-mesa", "neon-harbor"];

export function nextArena(id: ArenaId): ArenaId {
  const i = ARENA_ORDER.indexOf(id);
  return ARENA_ORDER[(i + 1) % ARENA_ORDER.length];
}
