/**
 * Alge Carts engine: shared types.
 *
 * The engine is plain TypeScript over Three.js with no framework, no asset
 * files and no bundler-specific code, so the same folder drops into
 * AlgeBridge (src/lib/algecarts) and is mounted from a React component the
 * way src/lib/house3d/engine.ts is. Everything the host needs to draw its own
 * HUD arrives through GameHooks.onHud; everything the host wants to gate
 * (the math question before a booster) goes through GameHooks.requestBooster.
 */

export type WeaponId = "rockets" | "machinegun" | "mines" | "shield" | "boost" | "bomb";

import type { Loadout } from "./profile";
export type { HatId, Loadout } from "./profile";

export type ArenaId = "sunset-mesa" | "neon-harbor";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Uses before the slot empties. Shield and boost are single use. */
  ammo: number;
  color: string;
  /** Relative chance of coming out of an item box. */
  weight: number;
  blurb: string;
}

export interface InputState {
  /** -1 (brake / reverse) to 1 (gas). */
  throttle: number;
  /** -1 (left) to 1 (right). */
  steer: number;
  /** Fire held this frame. */
  fire: boolean;
  /** Fire went down this frame. */
  firePressed: boolean;
}

export interface InputSource {
  read(): InputState;
  /** Called once per frame after reading, to clear edge-triggered state. */
  endFrame?(): void;
  dispose?(): void;
}

export const EMPTY_INPUT: InputState = { throttle: 0, steer: 0, fire: false, firePressed: false };

export interface KartSetup {
  id: string;
  name: string;
  loadout: Loadout;
  bot: boolean;
  /** 0..1, bots only: aim, reaction time and weapon timing. */
  skill: number;
}

export interface PlayerSetup {
  name: string;
  loadout: Loadout;
}

export interface BoosterRequest {
  kartId: string;
  /** Every weapon the box could hand out. */
  options: WeaponId[];
  /** The one the dice picked; hand it back to keep the standard roll. */
  suggested: WeaponId;
}

export interface KillEvent {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weapon: WeaponId | "bump";
  /** The killer's streak after this kill. */
  streak: number;
  killerIsPlayer: boolean;
  victimIsPlayer: boolean;
}

export interface Standing {
  id: string;
  name: string;
  color: string;
  kills: number;
  deaths: number;
  streak: number;
  alive: boolean;
  isPlayer: boolean;
}

export interface FeedEntry {
  id: number;
  killer: string;
  killerColor: string;
  victim: string;
  victimColor: string;
  weapon: WeaponId | "bump";
  /** Engine clock, seconds. */
  at: number;
}

export interface HudMessage {
  title: string;
  sub?: string;
  /** Engine clock, seconds. */
  until: number;
  tone: "neutral" | "good" | "bad";
}

export type Phase = "countdown" | "live" | "over";

export interface HudState {
  phase: Phase;
  /** Seconds left in the match. */
  timeLeft: number;
  /** Seconds left in the pre-match countdown (phase "countdown"). */
  countdown: number;
  /** Seconds until the next match starts (phase "over"). */
  nextIn: number;
  /** Engine clock, seconds; feed and message timestamps are on it. */
  now: number;
  joined: boolean;
  hp: number;
  weapon: { id: WeaponId; ammo: number; max: number } | null;
  /** A running shield or boost. */
  active: { id: WeaponId; left: number; total: number } | null;
  kills: number;
  deaths: number;
  streak: number;
  rank: number;
  total: number;
  /** Seconds until respawn; 0 while alive. */
  respawnIn: number;
  /** Waiting on the host's requestBooster promise. */
  pending: boolean;
  feed: FeedEntry[];
  message: HudMessage | null;
  standings: Standing[];
  /** 0..1 of top speed, for the speed readout. */
  speed: number;
  boosting: boolean;
  arenaName: string;
  arenaId: ArenaId;
  /** 1 right after taking damage, decaying to 0. */
  damageFlash: number;
}

export interface MatchResult {
  arenaId: ArenaId;
  arenaName: string;
  standings: Standing[];
  /** 1-based; 0 when the player was not in the match. */
  playerRank: number;
  durationSeconds: number;
}

export interface GameHooks {
  /**
   * The local player drove into an item box. Resolve with the weapon to hand
   * out, or null for nothing (the box is still used up). While the promise is
   * open the kart is parked and protected, and HudState.pending is true.
   * Leave it out to get the standard instant roll.
   */
  requestBooster?(req: BoosterRequest): Promise<WeaponId | null>;
  onKill?(e: KillEvent): void;
  onPlayerDeath?(e: { by: string; weapon: WeaponId | "bump" }): void;
  onMatchEnd?(r: MatchResult): void;
  /** Once per rendered frame. Cheap: the same object, mutated. */
  onHud?(s: HudState): void;
}

export interface GameOptions {
  arena?: ArenaId;
  /** Bots in the lobby besides the player (default 7). */
  bots?: number;
  matchSeconds?: number;
  /** Seconds the results board stays up before the next match (default 12). */
  intermissionSeconds?: number;
  hooks?: GameHooks;
  quality?: "high" | "low";
  /** Start with sound on (default true). Audio only starts after a user gesture. */
  sound?: boolean;
  /** Seeded bots and rolls, for tests. */
  seed?: number;
}

export interface GameHandle {
  /** Put the local player into the running match. */
  join(p: PlayerSetup): void;
  /** Take the local player out; the camera goes back to watching the bots. */
  leave(): void;
  /** Add a source of player input (keyboard is built in; touch pads go here). */
  addInput(src: InputSource): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  /** Pause the whole simulation (a tab change, a dialog that stops the game). */
  setPaused(paused: boolean): void;
  /** Unlock audio: call from a click or key handler. */
  unlockAudio(): void;
  hud(): HudState;
  /** Jump to a new match on this arena right away. */
  startMatch(arena?: ArenaId): void;
  resize(): void;
  /** Run the simulation forward by this many seconds right now and draw a frame. For tests. */
  advance(seconds: number): void;
  dispose(): void;
}
