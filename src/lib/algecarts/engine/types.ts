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

export type WeaponId = "rockets" | "machinegun" | "mines" | "shield" | "boost" | "bomb" | "seeker" | "laser" | "ice" | "slick" | "shock";

import type { Loadout } from "./profile";
import type { SoundName } from "./audio/Audio";
export type { HatId, Loadout } from "./profile";

/** Who runs the simulation: nobody else (solo), this tab for a lobby (host), or another tab (guest, mirroring). */
export type NetRole = "solo" | "host" | "guest";

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
  /** A human driving from another tab; the host reads their input off the wire. */
  remote?: boolean;
  /** That human's player id. */
  pid?: string | null;
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
   * open the kart is parked, protected and hidden from every other kart
   * (nobody sees it, drives into it or hits it), and HudState.pending is true.
   * Leave it out to get the standard instant roll.
   */
  requestBooster?(req: BoosterRequest): Promise<WeaponId | null>;
  onKill?(e: KillEvent): void;
  onPlayerDeath?(e: { by: string; weapon: WeaponId | "bump" }): void;
  onMatchEnd?(r: MatchResult): void;
  /** Once per rendered frame. Cheap: the same object, mutated. */
  onHud?(s: HudState): void;
  /** Guest: the local kart's input each step, numbered, for the wire. */
  onInput?(input: InputState, seq: number): void;
  /** Guest: the answer to a booster question, for the host to grant. */
  onBoosterResolved?(w: WeaponId | null): void;
  /** Guest: the player pressed Play or left; the host has to seat or unseat them. */
  onJoinRequest?(p: PlayerSetup): void;
  onLeaveRequest?(): void;
  /** Host: a seat changed hands (a human in, a bot back), so the roster should go out. */
  onSeatChange?(): void;
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
  /** Start as this role (default solo). A guest makes no karts until a roster arrives. */
  role?: NetRole;
  /** Karts in the lobby, bots and humans together (default 8). */
  seats?: number;
  /** Names for the bot seats, in order. */
  botNames?: string[];
  /** This tab's player id on the wire, so a roster can say which seat is ours. */
  pid?: string;
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

  // ----- the lobby wire -----
  role(): NetRole;
  /** Change role in place: a guest that becomes the host keeps every kart and carries on. */
  setRole(role: NetRole): void;
  /** Host: give the bot seats these names. */
  setBotNames(names: string[]): void;
  /** Host: a human from another tab takes a bot's seat; -1 when every seat is human. */
  seatRemote(pid: string, name: string, loadout: Loadout): number;
  /** Host: that human left; a bot takes the seat back. */
  unseatRemote(pid: string): void;
  setRemoteInput(pid: string, input: InputState, seq: number): void;
  resolveRemoteBooster(pid: string, w: WeaponId | null): void;
  /** Host: the world right now plus everything that happened since the last call. */
  exportSnap(): NetSnap;
  roster(): RosterEntry[];
  /** Humans in the lobby, this tab included. */
  humans(): number;
  /** Guest: who sits where. */
  applyRoster(r: RosterEntry[]): void;
  applySnap(s: NetSnap): void;
  /** Guest: which seat is this tab's player (null for watching). */
  setLocalSeat(i: number | null): void;
}

/** One kart in a host snapshot. Short keys: ten of these go out a second. */
export interface SnapKart {
  i: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  /** Signed forward speed. */
  sp: number;
  hp: number;
  a: 0 | 1;
  w: WeaponId | null;
  am: number;
  st: number;
  k: number;
  d: number;
  /** Bits: 1 shield, 2 boost, 4 frozen, 8 spinning, 16 pending a question, 32 protected, 64 celebrating, 128 in the air. */
  f: number;
  /** Seconds left on a shield or a boost. */
  shl: number;
  bol: number;
  /** Last input sequence applied, for a remote human. */
  sq: number;
  /** Seconds until respawn when dead. */
  rs: number;
}

export interface SnapProjectile {
  id: number;
  k: "rocket" | "bullet" | "bomb" | "seeker" | "ice";
  o: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface SnapMine {
  id: number;
  o: number;
  x: number;
  y: number;
  z: number;
  ar: 0 | 1;
}

export interface SnapSlick {
  id: number;
  o: number;
  x: number;
  y: number;
  z: number;
}

/** Something that happened on the host between two snapshots. Kart indexes, not ids. */
export type NetEvent =
  | { t: "kill"; k: number; v: number; w: WeaponId | "bump"; st: number }
  | { t: "dmg"; v: number; k: number; n: number; w: WeaponId | "bump" }
  | { t: "boom"; x: number; y: number; z: number; r: number; s: number }
  | { t: "snd"; n: SoundName; x: number; y: number; z: number }
  | { t: "pick"; b: number; k: number }
  | { t: "ask"; k: number; w: WeaponId }
  | { t: "grant"; k: number; w: WeaponId }
  | { t: "deny"; k: number }
  | { t: "spawn"; k: number }
  | { t: "over"; standings: Standing[] }
  | { t: "match"; arena: ArenaId };

export interface NetSnap {
  /** Sequence number. */
  n: number;
  ph: Phase;
  tl: number;
  cd: number;
  ni: number;
  ar: ArenaId;
  karts: SnapKart[];
  /** Bit i set: item box i is there to take. */
  bx: number;
  pr: SnapProjectile[];
  mn: SnapMine[];
  sl: SnapSlick[];
  ev: NetEvent[];
}

export interface RosterEntry {
  i: number;
  name: string;
  loadout: Loadout;
  bot: boolean;
  pid: string | null;
}
