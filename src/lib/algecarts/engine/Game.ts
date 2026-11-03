import * as THREE from "three";
import type {
  ArenaId, FeedEntry, GameHandle, GameHooks, GameOptions, HudMessage, HudState, InputSource, InputState, KartSetup, NetEvent, NetRole, NetSnap, Phase, PlayerSetup, RosterEntry, SnapKart, Standing, WeaponId,
} from "./types";
import { EMPTY_INPUT } from "./types";
import { Arena } from "./world/Arena";
import { ARENAS, nextArena } from "./world/arenas";
import { Kart } from "./entities/Kart";
import { ItemBox, itemBoxMaterial } from "./entities/ItemBox";
import { buildKart, rainbowColors, TRAILS } from "./render/KartMesh";
import { DamageNumbers, FlashLights, SkidMarks } from "./render/Effects";
import { CATALOG, type Loadout } from "./profile";
import { Renderer } from "./render/Renderer";
import { ChaseCamera } from "./render/Camera";
import { Particles, Shockwaves } from "./render/Particles";
import { KeyboardInput, mergeInputs } from "./input/Keyboard";
import { KART, stepKart } from "./physics/KartPhysics";
import { collideKarts, collideKartWithArena } from "./physics/Collision";
import { WeaponSystem, type CombatCtx } from "./weapons/WeaponSystem";
import { rollWeapon, STATS, WEAPON_IDS, WEAPONS } from "./weapons/weapons";
import { BotBrain } from "./ai/BotController";
import { NavGrid } from "./ai/NavGrid";
import { GameAudio, type SoundName } from "./audio/Audio";
import { angleDelta, clamp, lerp, Rng } from "./util";
import type { Palette } from "./render/Materials";

const FIXED = 1 / 60;
const RESPAWN_SECONDS = 3;
const PROTECT_SECONDS = 2.5;
const BOX_RESPAWN = 8;
/** A remote player who never answers a box question gets nothing after this long. */
const ASK_TIMEOUT = 30;
/** Events kept for a snapshot nobody has asked for yet. */
const EVENT_CAP = 300;

/** Bot names: first name and an initial, like the leaderboard shows people. */
export const BOT_NAMES = [
  "Mason R.", "Ava K.", "Liam T.", "Sophia M.", "Noah P.", "Emma L.", "Ethan B.", "Olivia S.",
  "Lucas D.", "Mia C.", "Aiden W.", "Isabella G.", "Jackson H.", "Chloe N.", "Logan F.", "Zoe A.",
  "Caleb J.", "Lily R.", "Owen M.", "Grace T.", "Carter S.", "Ella B.", "Wyatt K.", "Nora D.",
  "Julian P.", "Hazel W.", "Levi C.", "Aria M.", "Jayden L.", "Leah S.", "Gabriel R.", "Riley H.",
  "Elijah T.", "Layla B.", "Hudson G.", "Stella K.", "Mateo A.", "Violet J.", "Ezra D.", "Penelope F.",
  "Asher N.", "Luna M.", "Leo V.", "Ivy C.", "Miles P.", "Ruby W.", "Nolan S.", "Sadie R.",
];

/** Lobby 1 gets the first eight names, lobby 2 the next eight, round and round. */
export function namesForLobby(lobby: number, seats: number): string[] {
  const start = ((Math.max(1, lobby) - 1) * seats) % BOT_NAMES.length;
  const round = Math.floor(((Math.max(1, lobby) - 1) * seats) / BOT_NAMES.length);
  return Array.from({ length: seats }, (_, i) => {
    const name = BOT_NAMES[(start + i) % BOT_NAMES.length];
    return round ? `${name.slice(0, -1)}${round + 1}.` : name;
  });
}

export function createGame(canvas: HTMLCanvasElement, options: GameOptions = {}): GameHandle {
  return new Game(canvas, options);
}

interface RemoteInput {
  input: InputState;
  seq: number;
}

/** A guest's two latest samples of a kart, to draw it between snapshots. */
interface Lerp {
  px: number;
  py: number;
  pz: number;
  pyaw: number;
  cx: number;
  cy: number;
  cz: number;
  cyaw: number;
}

class Game implements GameHandle, CombatCtx {
  // CombatCtx
  arena: Arena;
  private nav: NavGrid;
  readonly karts: Kart[] = [];
  readonly particles = new Particles();
  readonly waves = new Shockwaves();
  private readonly skids = new SkidMarks();
  private readonly flashes = new FlashLights();
  private readonly numbers = new DamageNumbers();
  readonly palette: Palette;
  readonly scene: THREE.Scene;
  readonly rng: Rng;

  private readonly renderer: Renderer;
  private readonly camera = new ChaseCamera();
  private readonly audio: GameAudio;
  private readonly weapons: WeaponSystem;
  private readonly keyboard: KeyboardInput;
  private readonly inputs: InputSource[];
  private readonly hooks: GameHooks;
  private readonly quality: "high" | "low";
  private readonly boxes: ItemBox[] = [];
  private readonly boxMat: THREE.MeshToonMaterial;
  private readonly bots = new Map<string, BotBrain>();
  private readonly resizeObs: ResizeObserver;
  private player: Kart | null = null;

  private clock = 0;
  private acc = 0;
  private last = performance.now();
  private raf = 0;
  /** Steps the world when animation frames stop (a throttled or hidden tab), so a host keeps its lobby alive. */
  private readonly pulse: ReturnType<typeof setInterval>;
  private paused = false;
  private disposed = false;
  private frameInput: InputState = { ...EMPTY_INPUT };

  private phase: Phase = "countdown";
  private readonly matchSeconds: number;
  private readonly intermission: number;
  private timeLeft: number;
  private countdown = 3.5;
  private nextIn = 0;
  private lastBeep = 99;
  private readonly feed: FeedEntry[] = [];
  private feedId = 0;
  private message: HudMessage | null = null;
  private damageFlash = 0;
  private frozen: Standing[] | null = null;
  private readonly hudState: HudState;

  // The lobby wire.
  private netRole: NetRole;
  private readonly seats: number;
  private botNames: string[];
  private readonly pid: string | null;
  private readonly remoteInputs = new Map<string, RemoteInput>();
  private readonly askedAt = new Map<string, number>();
  private readonly events: NetEvent[] = [];
  private snapSeq = 0;
  private readonly lerps = new Map<Kart, Lerp>();
  private snapPrev: { s: NetSnap; at: number } | null = null;
  private snapCur: { s: NetSnap; at: number } | null = null;
  private inputSeq = 0;
  /** Guest: where the local kart was at each input, for reconciling with the host. */
  private readonly history: { seq: number; x: number; z: number }[] = [];
  private readonly corr = { x: 0, z: 0 };
  private wanted: PlayerSetup | null = null;

  constructor(canvas: HTMLCanvasElement, options: GameOptions) {
    this.quality = options.quality ?? "high";
    this.rng = new Rng(options.seed);
    this.hooks = options.hooks ?? {};
    this.matchSeconds = options.matchSeconds ?? 180;
    this.intermission = options.intermissionSeconds ?? 12;
    this.timeLeft = this.matchSeconds;
    this.netRole = options.role ?? "solo";
    this.seats = clamp(options.seats ?? 8, 1, 12);
    this.pid = options.pid ?? null;
    this.botNames = options.botNames?.length ? [...options.botNames] : this.rng.shuffle([...BOT_NAMES]);

    this.renderer = new Renderer(canvas, this.quality);
    this.scene = this.renderer.scene;
    this.palette = this.renderer.palette;
    this.scene.add(this.particles.group, this.waves.group, this.skids.mesh, this.numbers.group);
    if (this.quality === "high") this.scene.add(this.flashes.group);
    this.audio = new GameAudio(options.sound ?? true);
    this.weapons = new WeaponSystem(this);
    this.keyboard = new KeyboardInput(canvas);
    this.inputs = [this.keyboard];
    this.boxMat = itemBoxMaterial(this.palette);

    this.arena = new Arena(ARENAS[options.arena ?? "sunset-mesa"]);
    this.nav = new NavGrid(this.arena);
    this.renderer.setArena(this.arena);

    // A guest's karts come with the roster; everyone else starts with a full lobby of bots.
    if (this.netRole !== "guest") for (let i = 0; i < this.seats; i++) this.placeSeat(i, this.botSetup(i, this.botNames[i % this.botNames.length]), false);

    this.hudState = {
      phase: "countdown", timeLeft: this.matchSeconds, countdown: 3, nextIn: 0, now: 0, joined: false, hp: 100, weapon: null, active: null,
      kills: 0, deaths: 0, streak: 0, rank: 0, total: this.karts.length, respawnIn: 0, pending: false, feed: [], message: null, standings: [],
      speed: 0, boosting: false, arenaName: this.arena.def.name, arenaId: this.arena.def.id, damageFlash: 0,
    };

    this.setupArena();
    this.beginCountdown();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
    this.pulse = setInterval(() => {
      if (this.disposed || this.paused) return;
      const t = performance.now();
      const gap = (t - this.last) / 1000;
      if (gap < 0.25) return;
      this.last = t;
      this.acc = 0;
      const n = Math.min(60, Math.round(gap / FIXED));
      this.frameInput = mergeInputs(this.inputs);
      for (const s of this.inputs) s.endFrame?.();
      for (let i = 0; i < n; i++) {
        this.step(FIXED);
        this.frameInput.firePressed = false;
      }
    }, 100);
  }

  // ----- GameHandle -----

  join(p: PlayerSetup): void {
    if (this.netRole === "guest") {
      // The host seats us; the roster and a seat number come back over the wire.
      this.wanted = { name: p.name, loadout: { ...p.loadout } };
      this.hooks.onJoinRequest?.(this.wanted);
      return;
    }
    if (this.player) this.leave();
    const i = this.freeSeat();
    if (i < 0) return;
    const k = this.placeSeat(i, { id: `seat-${i}`, name: p.name.trim() || "You", loadout: { ...p.loadout }, bot: false, skill: 1, pid: this.pid }, true);
    this.player = k;
    this.respawn(k, true);
    this.camera.snapTo(k);
    this.message = null;
    if (this.phase === "live") this.say("GO!", this.arena.def.name, 1.6, "good");
    this.hooks.onJoinRequest?.({ name: p.name, loadout: { ...p.loadout } });
    this.hooks.onSeatChange?.();
  }

  leave(): void {
    if (this.netRole === "guest") {
      this.wanted = null;
      if (this.player) this.setLocalSeat(null);
      this.hooks.onLeaveRequest?.();
      this.audio.engine(0, false, false);
      return;
    }
    const k = this.player;
    if (!k) return;
    const i = this.karts.indexOf(k);
    this.player = null;
    const b = this.placeSeat(i, this.botSetup(i, this.nextBotName()), false);
    this.respawn(b, true);
    this.audio.engine(0, false, false);
    this.hooks.onLeaveRequest?.();
    this.hooks.onSeatChange?.();
  }

  addInput(src: InputSource): void {
    this.inputs.push(src);
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  isMuted(): boolean {
    return this.audio.muted;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.audio.engine(0, false, false);
    this.last = performance.now();
  }

  unlockAudio(): void {
    this.audio.unlock();
  }

  hud(): HudState {
    return this.hudState;
  }

  startMatch(arena?: ArenaId): void {
    if (this.netRole === "guest") return;
    this.newMatch(arena ?? this.arena.def.id);
  }

  resize(): void {
    const { w, h } = this.renderer.resize();
    this.camera.resize(w, h);
  }

  advance(seconds: number): void {
    const n = Math.max(0, Math.round(seconds / FIXED));
    for (let i = 0; i < n; i++) {
      this.frameInput = mergeInputs(this.inputs);
      for (const s of this.inputs) s.endFrame?.();
      this.step(FIXED);
    }
    this.renderer.render(this.camera.cam, seconds);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearInterval(this.pulse);
    this.resizeObs.disconnect();
    this.keyboard.dispose();
    for (const s of this.inputs) s.dispose?.();
    this.weapons.clear();
    for (const k of [...this.karts]) this.removeKart(k);
    for (const b of this.boxes) {
      this.scene.remove(b.root);
      b.dispose();
    }
    this.boxes.length = 0;
    this.boxMat.map?.dispose();
    this.boxMat.dispose();
    this.particles.dispose();
    this.waves.dispose();
    this.skids.dispose();
    this.numbers.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }

  // ----- the lobby wire -----

  role(): NetRole {
    return this.netRole;
  }

  setRole(role: NetRole): void {
    if (role === this.netRole) return;
    const was = this.netRole;
    this.netRole = role;
    this.events.length = 0;
    if (role === "guest") {
      // Everything here is now the host's to decide; karts stay until the roster says otherwise.
      this.bots.clear();
      this.weapons.clear();
      this.remoteInputs.clear();
      this.askedAt.clear();
      this.player = null;
      this.lerps.clear();
      this.snapPrev = this.snapCur = null;
      this.history.length = 0;
      this.corr.x = this.corr.z = 0;
      return;
    }
    // Host or solo: the bots need brains, and whatever was mirrored is ours to simulate now.
    for (const k of this.karts) if (k.bot && !this.bots.has(k.id)) this.bots.set(k.id, new BotBrain(k, this.rng));
    if (was === "guest") {
      this.weapons.clear();
      for (const b of this.boxes) if (!b.active) b.respawnAt = this.clock + BOX_RESPAWN * 0.5;
      for (const k of this.karts) {
        if (!k.alive) k.respawnAt = Math.min(k.respawnAt, this.clock + RESPAWN_SECONDS);
        if (k.pendingBooster && k !== this.player) k.pendingBooster = false;
      }
      this.lerps.clear();
      this.snapPrev = this.snapCur = null;
      if (this.phase === "countdown" && this.countdown <= 0) this.countdown = 0.5;
      if (this.phase === "over" && this.nextIn <= 0) this.nextIn = 1;
    }
    if (role === "solo") {
      this.remoteInputs.clear();
      this.askedAt.clear();
    }
  }

  setBotNames(names: string[]): void {
    if (!names.length) return;
    this.botNames = [...names];
    this.karts.forEach((k, i) => {
      if (!k.bot || k.name === names[i % names.length]) return;
      const nb = this.placeSeat(i, this.botSetup(i, names[i % names.length]), false);
      nb.kills = k.kills;
      nb.deaths = k.deaths;
      nb.streak = k.streak;
      nb.pos.copy(k.pos);
      nb.yaw = k.yaw;
      nb.vel.copy(k.vel);
      nb.hp = k.hp;
      nb.alive = k.alive;
      nb.respawnAt = k.respawnAt;
      nb.protectUntil = k.protectUntil;
      if (nb.view) nb.view.root.visible = k.alive;
      nb.syncView(0, this.clock);
    });
  }

  seatRemote(pid: string, name: string, loadout: Loadout): number {
    if (this.netRole !== "host") return -1;
    const have = this.karts.find((k) => k.pid === pid && !k.bot);
    if (have) return this.karts.indexOf(have);
    // The last bot seat is kept for this tab's own player while they are only watching.
    const bots = this.karts.filter((k) => k.bot).length;
    if (!this.player && bots <= 1) return -1;
    const i = this.freeSeat();
    if (i < 0) return -1;
    const k = this.placeSeat(i, { id: `seat-${i}`, name: name.trim() || "Racer", loadout: { ...loadout }, bot: false, skill: 1, remote: true, pid }, false);
    this.respawn(k, true);
    this.emit({ t: "spawn", k: i });
    this.hooks.onSeatChange?.();
    return i;
  }

  unseatRemote(pid: string): void {
    const i = this.karts.findIndex((k) => k.pid === pid && k.remote);
    this.remoteInputs.delete(pid);
    this.askedAt.delete(pid);
    if (i < 0) return;
    const b = this.placeSeat(i, this.botSetup(i, this.nextBotName()), false);
    this.respawn(b, true);
    this.hooks.onSeatChange?.();
  }

  setRemoteInput(pid: string, input: InputState, seq: number): void {
    const have = this.remoteInputs.get(pid);
    if (have && have.seq > seq) return;
    // A press that arrived between steps still counts once.
    const firePressed = input.firePressed || (!!have && have.input.firePressed);
    this.remoteInputs.set(pid, { input: { throttle: clamp(input.throttle, -1, 1), steer: clamp(input.steer, -1, 1), fire: !!input.fire, firePressed }, seq });
  }

  resolveRemoteBooster(pid: string, w: WeaponId | null): void {
    const k = this.karts.find((q) => q.pid === pid && q.remote);
    if (!k || !k.pendingBooster) return;
    k.pendingBooster = false;
    this.askedAt.delete(pid);
    if (!k.alive) return;
    const i = this.karts.indexOf(k);
    if (w && WEAPONS[w]) {
      this.grant(k, w);
      this.emit({ t: "grant", k: i, w });
    } else this.emit({ t: "deny", k: i });
  }

  exportSnap(): NetSnap {
    const now = this.clock;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const karts: SnapKart[] = this.karts.map((k, i) => {
      let f = 0;
      if (k.isShielded(now)) f |= 1;
      if (k.isBoosting(now)) f |= 2;
      if (k.isFrozen(now)) f |= 4;
      if (k.isSpinning(now)) f |= 8;
      if (k.pendingBooster) f |= 16;
      if (k.protectUntil > now) f |= 32;
      if (k.celebrateUntil > now) f |= 64;
      if (!k.onGround) f |= 128;
      return {
        i, x: r2(k.pos.x), y: r2(k.pos.y), z: r2(k.pos.z), yaw: r2(k.yaw), vx: r2(k.vel.x), vz: r2(k.vel.z), sp: r2(k.speed),
        hp: Math.max(0, Math.round(k.hp)), a: k.alive ? 1 : 0, w: k.weapon?.id ?? null, am: k.weapon?.ammo ?? 0, st: k.streak, k: k.kills, d: k.deaths,
        f, shl: r2(Math.max(0, k.shieldUntil - now)), bol: r2(Math.max(0, k.boostUntil - now)), sq: k.lastSeq, rs: k.alive ? 0 : r2(Math.max(0, k.respawnAt - now)),
      };
    });
    let bx = 0;
    this.boxes.forEach((b, i) => {
      if (b.active && i < 31) bx |= 1 << i;
    });
    const { pr, mn, sl } = this.weapons.snapshot(this.karts);
    return { n: ++this.snapSeq, ph: this.phase, tl: r2(this.timeLeft), cd: r2(this.countdown), ni: r2(this.nextIn), ar: this.arena.def.id, karts, bx, pr, mn, sl, ev: this.events.splice(0) };
  }

  roster(): RosterEntry[] {
    return this.karts.map((k, i) => ({ i, name: k.name, loadout: { ...k.loadout }, bot: k.bot, pid: k.bot ? null : k.pid }));
  }

  humans(): number {
    return this.karts.filter((k) => !k.bot).length;
  }

  applyRoster(r: RosterEntry[]): void {
    if (this.netRole !== "guest") return;
    for (const e of r) {
      const k = this.karts[e.i];
      const mine = this.pid !== null && e.pid === this.pid && !e.bot;
      const same = !!k && k.name === e.name && k.bot === e.bot && (k.pid ?? null) === (e.pid ?? null) && sameLoadout(k.loadout, e.loadout) && (k === this.player) === mine;
      if (same) continue;
      const nk = this.placeSeat(e.i, { id: `seat-${e.i}`, name: e.name, loadout: { ...e.loadout }, bot: e.bot, skill: 1, remote: !mine && !e.bot, pid: e.pid }, mine);
      if (k) {
        nk.pos.copy(k.pos);
        nk.yaw = k.yaw;
        nk.vel.copy(k.vel);
        nk.hp = k.hp;
        nk.alive = k.alive;
        nk.kills = k.kills;
        nk.deaths = k.deaths;
        nk.streak = k.streak;
        nk.respawnAt = k.respawnAt;
        const lp = this.lerps.get(k);
        this.lerps.delete(k);
        if (lp) this.lerps.set(nk, lp);
        if (nk.view) nk.view.root.visible = k.alive;
        nk.syncView(0, this.clock);
      }
      if (mine) {
        this.player = nk;
        this.camera.snapTo(nk);
        this.message = null;
        if (this.phase === "live") this.say("GO!", this.arena.def.name, 1.6, "good");
      }
    }
    while (this.karts.length > r.length) this.removeKart(this.karts[this.karts.length - 1]);
    if (this.player && !r.some((e) => e.pid === this.pid && !e.bot)) this.player = null;
    this.hudState.total = this.karts.length;
  }

  applySnap(s: NetSnap): void {
    if (this.netRole !== "guest") return;
    const at = performance.now();
    this.snapPrev = this.snapCur;
    this.snapCur = { s, at };
    const now = this.clock;
    if (s.ar !== this.arena.def.id) this.switchArenaGuest(s.ar);
    const wasPhase = this.phase;
    this.phase = s.ph;
    this.timeLeft = s.tl;
    this.countdown = s.cd;
    this.nextIn = s.ni;
    if (wasPhase !== "live" && s.ph === "live") {
      this.sound("go");
      if (this.player) this.say("GO!", this.arena.def.name, 1.4, "good");
    }
    if (wasPhase === "over" && s.ph === "countdown") {
      this.frozen = null;
      this.feed.length = 0;
      this.message = null;
      this.lastBeep = 99;
      this.weapons.clear();
    }
    for (const sk of s.karts) {
      const k = this.karts[sk.i];
      if (!k) continue;
      let lp = this.lerps.get(k);
      if (!lp) {
        lp = { px: sk.x, py: sk.y, pz: sk.z, pyaw: sk.yaw, cx: sk.x, cy: sk.y, cz: sk.z, cyaw: sk.yaw };
        this.lerps.set(k, lp);
        k.pos.set(sk.x, sk.y, sk.z);
        k.yaw = sk.yaw;
      } else {
        lp.px = lp.cx;
        lp.py = lp.cy;
        lp.pz = lp.cz;
        lp.pyaw = lp.cyaw;
        lp.cx = sk.x;
        lp.cy = sk.y;
        lp.cz = sk.z;
        lp.cyaw = sk.yaw;
      }
      const wasAlive = k.alive;
      if (!wasAlive && sk.a) {
        k.revive();
        k.place(sk.x, sk.z, sk.yaw, sk.y);
        k.view?.setTag(k.name, 100);
        if (k === this.player) {
          this.camera.snapTo(k);
          this.message = null;
          this.history.length = 0;
          this.corr.x = this.corr.z = 0;
        }
      }
      k.hp = sk.hp;
      k.alive = sk.a === 1;
      k.weapon = sk.w ? { id: sk.w, ammo: sk.am } : null;
      k.streak = sk.st;
      k.kills = sk.k;
      k.deaths = sk.d;
      k.shieldUntil = sk.f & 1 ? now + Math.max(0.15, sk.shl) : 0;
      k.boostUntil = sk.f & 2 ? now + Math.max(0.15, sk.bol) : 0;
      k.frozenUntil = sk.f & 4 ? now + 0.3 : 0;
      k.spinUntil = sk.f & 8 ? now + 0.3 : 0;
      k.pendingBooster = !!(sk.f & 16);
      k.protectUntil = sk.f & 32 ? now + 0.3 : 0;
      if (sk.f & 64) k.celebrateUntil = Math.max(k.celebrateUntil, now + 0.3);
      k.respawnAt = k.alive ? 0 : now + sk.rs;
      k.lastSeq = sk.sq;
      if (k.view) k.view.root.visible = k.alive;
      if (k === this.player) this.reconcile(k, sk);
    }
    this.boxes.forEach((b, i) => {
      const on = i < 31 ? ((s.bx >>> i) & 1) === 1 : true;
      if (on && !b.active) {
        b.active = true;
        b.respawnAt = 0;
        b.root.visible = true;
      } else if (!on && b.active) b.take(now, 1e9);
    });
    this.weapons.mirror(s.pr, s.mn, s.sl);
    for (const e of s.ev) this.handleEvent(e);
  }

  setLocalSeat(i: number | null): void {
    if (i === null) {
      this.player = null;
      return;
    }
    const k = this.karts[i];
    if (!k) return;
    if (this.player === k) return;
    const nk = this.placeSeat(i, { id: k.id, name: k.name, loadout: { ...k.loadout }, bot: false, skill: 1, pid: this.pid }, true);
    nk.pos.copy(k.pos);
    nk.yaw = k.yaw;
    nk.hp = k.hp;
    nk.alive = k.alive;
    nk.kills = k.kills;
    nk.deaths = k.deaths;
    nk.streak = k.streak;
    const lp = this.lerps.get(k);
    this.lerps.delete(k);
    if (lp) this.lerps.set(nk, lp);
    if (nk.view) nk.view.root.visible = k.alive;
    this.player = nk;
    this.camera.snapTo(nk);
    this.message = null;
    this.history.length = 0;
    this.corr.x = this.corr.z = 0;
    if (this.phase === "live") this.say("GO!", this.arena.def.name, 1.6, "good");
  }

  // ----- CombatCtx -----

  now(): number {
    return this.clock;
  }

  sound(name: SoundName, x?: number, y?: number, z?: number): void {
    this.audio.play(name, x, y, z);
    if (this.netRole === "host" && x !== undefined) this.emit({ t: "snd", n: name, x, y: y ?? 0, z: z ?? 0 });
  }

  damage(victim: Kart, amount: number, attacker: Kart, weapon: WeaponId | "bump", kx: number, ky: number, kz: number): void {
    if (!victim.alive) return;
    if (victim.isImmune(this.clock)) {
      if (victim.isShielded(this.clock)) this.particles.sparks(victim.pos.x, victim.pos.y + 1, victim.pos.z, "#6ff6ff", 5, 5, 0.3);
      return;
    }
    victim.hp -= amount;
    victim.flash = 1;
    if (victim === this.player || attacker === this.player) {
      this.numbers.show(victim.pos.x, victim.pos.y + 2.3, victim.pos.z, `-${Math.round(amount)}`, victim === this.player ? "#ff7b7b" : weapon === "bump" ? "#ffffff" : WEAPONS[weapon].color);
    }
    if (this.netRole === "host" && (victim.remote || attacker.remote)) this.emit({ t: "dmg", v: this.karts.indexOf(victim), k: this.karts.indexOf(attacker), n: Math.round(amount), w: weapon });
    victim.lastHitBy = attacker.id;
    victim.lastHitAt = this.clock;
    victim.vel.x += kx;
    victim.vel.z += kz;
    if (ky > 0.5) {
      victim.vel.y = Math.max(victim.vel.y, ky);
      victim.onGround = false;
    }
    if (victim === this.player) {
      this.damageFlash = 1;
      this.camera.shake(0.18 + amount / 150);
      this.sound("hit");
    }
    if (victim.hp <= 0) this.kill(victim, attacker, weapon);
  }

  explode(x: number, y: number, z: number, radius: number, dmg: number, edge: number, knock: number, attacker: Kart, weapon: WeaponId, scale: number): void {
    this.boomEffects(x, y, z, radius, scale);
    if (this.netRole === "host") this.emit({ t: "boom", x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100, r: radius, s: scale });
    for (const k of this.karts) {
      if (!k.alive || k === attacker) continue;
      const dx = k.pos.x - x;
      const dy = k.pos.y + 0.6 - y;
      const dz = k.pos.z - z;
      const d = Math.hypot(dx, dy, dz);
      if (d > radius + KART.radius) continue;
      const t = clamp(d / radius, 0, 1);
      const amount = lerp(dmg, edge, t);
      const h = Math.max(1e-3, Math.hypot(dx, dz));
      const push = knock * (1 - t * 0.5);
      this.damage(k, amount, attacker, weapon, (dx / h) * push, push * 0.5, (dz / h) * push);
    }
  }

  private boomEffects(x: number, y: number, z: number, radius: number, scale: number): void {
    this.particles.explosion(x, y, z, scale);
    this.waves.burst(x, y, z, radius * 0.95, scale > 1.5 ? "#ffb347" : "#ffd27a", 0.32);
    if (this.quality === "high") this.flashes.flash(x, y + 1, z, "#ffb347", 140 * scale, 0.3);
    this.audio.play(scale > 1.5 ? "bigexplosion" : "explosion", x, y, z);
    const p = this.player;
    if (p && p.alive) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius * 3) this.camera.shake((0.35 * scale * (radius * 3 - d)) / (radius * 3));
    }
  }

  private emit(e: NetEvent): void {
    if (this.netRole !== "host") return;
    this.events.push(e);
    if (this.events.length > EVENT_CAP) this.events.splice(0, this.events.length - EVENT_CAP);
  }

  // ----- karts and seats -----

  private botSetup(i: number, name: string): KartSetup {
    const colors = CATALOG.color.map((c) => c.id);
    const loadout: Loadout = {
      character: this.rng.pick(CATALOG.character).id as Loadout["character"],
      body: this.rng.pick(CATALOG.body).id as Loadout["body"],
      color: colors[(i * 5 + Math.floor(this.rng.next() * 3)) % colors.length],
      wheels: this.rng.pick(CATALOG.wheels).id as Loadout["wheels"],
      hat: this.rng.pick(CATALOG.hat).id as Loadout["hat"],
      decal: this.rng.pick(CATALOG.decal).id as Loadout["decal"],
      trail: this.rng.next() < 0.6 ? "smoke" : (this.rng.pick(CATALOG.trail).id as Loadout["trail"]),
    };
    return { id: `seat-${i}`, name, loadout, bot: true, skill: this.rng.range(0.45, 0.95) };
  }

  /** The bot seat a human takes: the bot with the least to lose. */
  private freeSeat(): number {
    let best = -1;
    let bestKills = Infinity;
    this.karts.forEach((k, i) => {
      if (k.bot && k.kills < bestKills) {
        best = i;
        bestKills = k.kills;
      }
    });
    return best;
  }

  private nextBotName(): string {
    const used = new Set(this.karts.map((k) => k.name));
    return this.botNames.find((n) => !used.has(n)) ?? `${this.botNames[0]} ${this.karts.length}`;
  }

  /** Put a kart in seat i, in place of whatever sat there. It starts off the field. */
  private placeSeat(i: number, setup: KartSetup, isPlayer: boolean): Kart {
    const old = this.karts[i];
    if (old) {
      this.bots.delete(old.id);
      this.lerps.delete(old);
      if (old.view) {
        this.scene.remove(old.view.root);
        old.view.dispose();
        old.view = null;
      }
    }
    const k = new Kart(setup);
    k.view = buildKart(this.palette, setup.loadout, setup.name, isPlayer, this.quality);
    this.scene.add(k.view.root);
    this.karts[i] = k;
    k.alive = false;
    k.view.root.visible = false;
    if (setup.bot && this.netRole !== "guest") this.bots.set(k.id, new BotBrain(k, this.rng));
    if (this.hudState) this.hudState.total = this.karts.length;
    return k;
  }

  private removeKart(k: Kart): void {
    const i = this.karts.indexOf(k);
    if (i >= 0) this.karts.splice(i, 1);
    this.bots.delete(k.id);
    this.lerps.delete(k);
    if (k.view) {
      this.scene.remove(k.view.root);
      k.view.dispose();
      k.view = null;
    }
  }

  /** Put a kart back on the field at the spawn farthest from everyone alive. */
  private respawn(k: Kart, quiet = false): void {
    const spawns = this.arena.def.spawns;
    let best = spawns[0];
    let bestD = -1;
    for (const s of spawns) {
      let minD = Infinity;
      for (const o of this.karts) {
        if (o === k || !o.alive) continue;
        minD = Math.min(minD, Math.hypot(o.pos.x - s.x, o.pos.z - s.z));
      }
      const d = (minD === Infinity ? 100 : minD) + this.rng.next() * 6;
      if (d > bestD) {
        bestD = d;
        best = s;
      }
    }
    k.revive();
    k.place(best.x, best.z, best.yaw, this.arena.topAt(best.x, best.z));
    k.protectUntil = this.clock + PROTECT_SECONDS;
    k.syncView(0, this.clock);
    k.view?.setTag(k.name, 100);
    this.bots.get(k.id)?.reset();
    if (!quiet) this.waves.burst(k.pos.x, k.pos.y + 0.9, k.pos.z, 2.6, "#ffffff", 0.35);
    if (k === this.player) {
      this.camera.snapTo(k);
      if (!quiet) this.message = null;
    }
    if (!quiet) this.emit({ t: "spawn", k: this.karts.indexOf(k) });
  }

  private kill(victim: Kart, attacker: Kart, weapon: WeaponId | "bump"): void {
    victim.alive = false;
    victim.hp = 0;
    victim.deaths++;
    victim.streak = 0;
    victim.respawnAt = this.clock + RESPAWN_SECONDS;
    victim.weapon = null;
    victim.pendingBooster = false;
    victim.shieldUntil = 0;
    victim.boostUntil = 0;
    if (victim.pid) this.askedAt.delete(victim.pid);
    attacker.kills++;
    attacker.streak++;
    attacker.lastKillAt = this.clock;
    this.emit({ t: "kill", k: this.karts.indexOf(attacker), v: this.karts.indexOf(victim), w: weapon, st: attacker.streak });
    this.killEffects(victim, attacker, weapon, attacker.streak);
  }

  /** What everyone sees and hears when a kart goes: on the host as it happens, on a guest from the event. */
  private killEffects(victim: Kart, attacker: Kart, weapon: WeaponId | "bump", streak: number): void {
    this.particles.explosion(victim.pos.x, victim.pos.y + 0.5, victim.pos.z, 1.7, victim.color);
    this.particles.sparks(victim.pos.x, victim.pos.y + 0.8, victim.pos.z, victim.color, 16, 9, 0.8, "#2a2f3f");
    this.waves.burst(victim.pos.x, victim.pos.y + 0.6, victim.pos.z, 4, "#ffffff", 0.4);
    if (victim.view) victim.view.root.visible = false;
    attacker.celebrateUntil = this.clock + 1.6;
    this.feed.push({
      id: ++this.feedId, killer: attacker.name, killerColor: attacker.color, victim: victim.name, victimColor: victim.color, weapon, at: this.clock,
    });
    if (this.feed.length > 6) this.feed.shift();
    this.hooks.onKill?.({
      killerId: attacker.id, killerName: attacker.name, victimId: victim.id, victimName: victim.name, weapon, streak,
      killerIsPlayer: attacker === this.player, victimIsPlayer: victim === this.player,
    });

    if (victim === this.player) {
      this.audio.play("death");
      this.camera.shake(0.9);
      this.say(`Smashed by ${attacker.name}`, weaponLabel(weapon), RESPAWN_SECONDS, "bad");
      this.hooks.onPlayerDeath?.({ by: attacker.name, weapon });
    } else {
      this.audio.play("explosion", victim.pos.x, victim.pos.y, victim.pos.z);
    }
    if (attacker === this.player) {
      const s = streak;
      const title = s >= 7 ? "UNSTOPPABLE" : s >= 5 ? "RAMPAGE" : s === 3 ? "TRIPLE SMASH" : s === 2 ? "DOUBLE SMASH" : `Smashed ${victim.name}`;
      this.say(title, s >= 2 ? `${s} in a row` : weaponLabel(weapon), 1.8, "good");
      this.audio.play(s >= 2 ? "streak" : "kill");
    }
  }

  private bump(a: Kart, b: Kart, closing: number): void {
    const now = this.clock;
    let dmg = 0;
    let knock = 0;
    if (a.isShielded(now)) {
      dmg = STATS.shield.ramDamage;
      knock = STATS.shield.ramKnock;
    } else if (a.isBoosting(now)) {
      dmg = STATS.boost.ramDamage;
      knock = STATS.boost.ramKnock;
    } else return;
    if ((a.bumpAt.get(b.id) ?? -10) > now - 0.6) return;
    a.bumpAt.set(b.id, now);
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const h = Math.max(1e-3, Math.hypot(dx, dz));
    this.damage(b, dmg * Math.min(1, closing / 10 + 0.5), a, "bump", (dx / h) * knock, 4, (dz / h) * knock);
    this.particles.sparks(b.pos.x, b.pos.y + 0.8, b.pos.z, "#ffffff", 10, 7, 0.4, a.color);
  }

  // ----- items -----

  private pickup(k: Kart, box: ItemBox): void {
    box.take(this.clock, BOX_RESPAWN);
    this.particles.sparkle(box.x, box.y, box.z, "#ff5d8f");
    this.sound("pickup", box.x, box.y, box.z);
    this.emit({ t: "pick", b: this.boxes.indexOf(box), k: this.karts.indexOf(k) });
    const suggested = rollWeapon(this.rng);
    if (k.remote && k.pid) {
      // Their tab asks the question; the answer comes back as resolveRemoteBooster.
      k.pendingBooster = true;
      k.input = { ...EMPTY_INPUT };
      this.askedAt.set(k.pid, this.clock);
      this.emit({ t: "ask", k: this.karts.indexOf(k), w: suggested });
      return;
    }
    if (k === this.player && this.hooks.requestBooster) {
      k.pendingBooster = true;
      k.input = { ...EMPTY_INPUT };
      const me = k;
      this.hooks.requestBooster({ kartId: k.id, options: [...WEAPON_IDS], suggested }).then(
        (w) => {
          me.pendingBooster = false;
          if (this.disposed || me !== this.player || !me.alive) return;
          if (w) this.grant(me, w);
          else {
            this.say("No booster this time", "Drive on", 1.4, "bad");
            this.sound("deny");
          }
        },
        () => {
          me.pendingBooster = false;
        },
      );
      return;
    }
    this.grant(k, suggested);
  }

  private grant(k: Kart, id: WeaponId): void {
    k.weapon = { id, ammo: WEAPONS[id].ammo };
    if (k === this.player && (!this.message || this.message.until < this.clock)) this.say(WEAPONS[id].name, WEAPONS[id].blurb, 1.5, "neutral");
  }

  // ----- match -----

  private rebuildBoxes(): void {
    this.skids.clear();
    this.skids.setGroundColor(this.arena.def.theme.ground);
    for (const b of this.boxes) {
      this.scene.remove(b.root);
      b.dispose();
    }
    this.boxes.length = 0;
    for (const it of this.arena.def.items) {
      const b = new ItemBox(it.x, it.z, this.arena.topAt(it.x, it.z), this.boxMat, this.palette);
      this.scene.add(b.root);
      this.boxes.push(b);
    }
    this.hudState.arenaName = this.arena.def.name;
  }

  private setupArena(): void {
    this.rebuildBoxes();
    for (const k of this.karts) {
      k.kills = 0;
      k.deaths = 0;
      this.respawn(k, true);
    }
  }

  private beginCountdown(): void {
    this.phase = "countdown";
    this.countdown = 3.5;
    this.lastBeep = 99;
    this.timeLeft = this.matchSeconds;
    this.feed.length = 0;
    this.frozen = null;
    this.message = null;
  }

  private newMatch(id: ArenaId): void {
    this.weapons.clear();
    if (id !== this.arena.def.id) {
      this.arena = new Arena(ARENAS[id]);
      this.nav = new NavGrid(this.arena);
      this.renderer.setArena(this.arena);
    }
    this.setupArena();
    this.beginCountdown();
    this.emit({ t: "match", arena: id });
    if (this.player) this.camera.snapTo(this.player);
  }

  /** Guest: the host moved to another arena; karts land where the next snapshot says. */
  private switchArenaGuest(id: ArenaId): void {
    this.weapons.clear();
    this.arena = new Arena(ARENAS[id]);
    this.nav = new NavGrid(this.arena);
    this.renderer.setArena(this.arena);
    this.rebuildBoxes();
    this.lerps.clear();
    this.history.length = 0;
    this.corr.x = this.corr.z = 0;
    this.feed.length = 0;
    this.frozen = null;
    this.message = null;
    this.lastBeep = 99;
    if (this.player) this.camera.snapTo(this.player);
  }

  private endMatch(): void {
    this.phase = "over";
    this.nextIn = this.intermission;
    const standings = this.standings();
    this.frozen = standings;
    this.emit({ t: "over", standings });
    this.finishEffects(standings);
  }

  private finishEffects(standings: Standing[]): void {
    const rank = this.player ? standings.findIndex((s) => s.isPlayer) + 1 : 0;
    const winner = this.karts.find((k) => k.id === standings[0]?.id);
    if (winner) winner.celebrateUntil = this.clock + this.intermission;
    this.audio.play("over");
    if (this.player) this.say("MATCH OVER", rank === 1 ? "You won" : `You placed ${ordinal(rank)}`, this.intermission, rank === 1 ? "good" : "neutral");
    this.hooks.onMatchEnd?.({ arenaId: this.arena.def.id, arenaName: this.arena.def.name, standings, playerRank: rank, durationSeconds: this.matchSeconds });
  }

  private standings(): Standing[] {
    return this.karts
      .map((k) => ({ id: k.id, name: k.name, color: k.color, kills: k.kills, deaths: k.deaths, streak: k.streak, alive: k.alive, isPlayer: k === this.player }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.name.localeCompare(b.name));
  }

  private say(title: string, sub: string | undefined, seconds: number, tone: HudMessage["tone"]): void {
    this.message = { title, sub, until: this.clock + seconds, tone };
  }

  // ----- the loop -----

  private readonly loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = performance.now();
    let frame = (t - this.last) / 1000;
    this.last = t;
    if (this.paused) return;
    frame = Math.min(frame, 0.1);
    this.acc += frame;
    this.frameInput = mergeInputs(this.inputs);
    for (const s of this.inputs) s.endFrame?.();
    let steps = 0;
    while (this.acc >= FIXED && steps < 4) {
      this.step(FIXED);
      this.acc -= FIXED;
      steps++;
      this.frameInput.firePressed = false;
    }
    if (steps === 4) this.acc = 0;
    this.renderer.render(this.camera.cam, frame);
  };

  private step(dt: number): void {
    if (this.netRole === "guest") this.stepGuest(dt);
    else this.stepHost(dt);
  }

  private stepHost(dt: number): void {
    this.clock += dt;
    const now = this.clock;

    // Phase.
    if (this.phase === "countdown") {
      this.countdown -= dt;
      const whole = Math.ceil(this.countdown);
      if (whole < this.lastBeep && whole > 0 && whole <= 3) {
        this.lastBeep = whole;
        this.sound("countdown");
      }
      if (this.countdown <= 0) {
        this.phase = "live";
        this.sound("go");
        if (this.player) this.say("GO!", this.arena.def.name, 1.4, "good");
      }
    } else if (this.phase === "live") {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.endMatch();
      }
    } else {
      this.nextIn -= dt;
      if (this.nextIn <= 0) this.newMatch(nextArena(this.arena.def.id));
    }
    const live = this.phase === "live";

    // Inputs.
    const p = this.player;
    if (p) p.input = live && p.alive && !p.pendingBooster ? this.frameInput : { ...EMPTY_INPUT };
    const world = { arena: this.arena, nav: this.nav, karts: this.karts, boxes: this.boxes };
    for (const k of this.karts) {
      if (k.bot) {
        const brain = this.bots.get(k.id);
        k.input = live && brain ? brain.update(dt, now, world) : { ...EMPTY_INPUT };
      } else if (k.remote && k.pid) {
        const ri = this.remoteInputs.get(k.pid);
        k.input = live && k.alive && !k.pendingBooster && ri ? { ...ri.input } : { ...EMPTY_INPUT };
        if (ri) {
          k.lastSeq = ri.seq;
          ri.input.firePressed = false;
        }
        // A question left unanswered for too long is a no.
        const asked = this.askedAt.get(k.pid);
        if (k.pendingBooster && asked !== undefined && now - asked > ASK_TIMEOUT) this.resolveRemoteBooster(k.pid, null);
      }
    }

    // Motion.
    for (const k of this.karts) {
      if (!k.alive) continue;
      const wasAir = !k.onGround;
      stepKart(k, dt, this.arena, now);
      if (wasAir && k.onGround && k.landed > 0.4) {
        this.particles.dust(k.pos.x, k.pos.y, k.pos.z, Math.min(1, k.landed));
        this.sound("land", k.pos.x, k.pos.y, k.pos.z);
      }
      const impact = collideKartWithArena(k, this.arena);
      if (impact > 7) {
        this.particles.sparks(k.pos.x + k.fx * 0.8, k.pos.y + 0.5, k.pos.z + k.fz * 0.8, "#ffe066", 5, 4, 0.3, "#8a8a93");
        if (k === p) this.sound("bump");
      }
    }
    for (let i = 0; i < this.karts.length; i++) {
      const a = this.karts[i];
      // A kart answering a question is off the track: nothing to drive into.
      if (!a.alive || a.hidden) continue;
      for (let j = i + 1; j < this.karts.length; j++) {
        const b = this.karts[j];
        if (!b.alive || b.hidden) continue;
        const closing = collideKarts(a, b);
        if (closing > STATS.bump.minClosing) {
          const mx = (a.pos.x + b.pos.x) / 2;
          const mz = (a.pos.z + b.pos.z) / 2;
          this.particles.sparks(mx, a.pos.y + 0.6, mz, "#ffffff", 4, 4, 0.3, "#ffe066");
          if (a === p || b === p) this.sound("bump");
          this.bump(a, b, closing);
          this.bump(b, a, closing);
        }
      }
    }

    // Weapons.
    for (const k of this.karts) if (k.alive) this.weapons.fire(k, dt);
    this.weapons.update(dt);

    // Items.
    for (const b of this.boxes) {
      b.update(dt, now);
      if (!b.active) continue;
      for (const k of this.karts) {
        // A loaded kart drives past boxes: the booster has to be used first.
        if (!k.alive || k.pendingBooster || k.weapon) continue;
        const dx = k.pos.x - b.x;
        const dz = k.pos.z - b.z;
        if (dx * dx + dz * dz < 1.75 * 1.75 && Math.abs(k.pos.y + 0.6 - b.y) < 2.2) {
          this.pickup(k, b);
          break;
        }
      }
    }

    // Respawns and views.
    for (const k of this.karts) {
      if (!k.alive && now >= k.respawnAt && this.phase !== "over") this.respawn(k);
      if (k.alive) this.exhaust(k, dt, now);
      this.syncKartView(k, dt, now);
    }
    this.finishFrame(dt, now);
  }

  private stepGuest(dt: number): void {
    this.clock += dt;
    const now = this.clock;
    // The clock on the HUD keeps moving between snapshots.
    if (this.phase === "countdown") {
      this.countdown = Math.max(0, this.countdown - dt);
      const whole = Math.ceil(this.countdown);
      if (whole < this.lastBeep && whole > 0 && whole <= 3) {
        this.lastBeep = whole;
        this.sound("countdown");
      }
    } else if (this.phase === "live") this.timeLeft = Math.max(0, this.timeLeft - dt);
    else this.nextIn = Math.max(0, this.nextIn - dt);
    const live = this.phase === "live";

    const p = this.player;
    if (p) {
      p.input = live && p.alive && !p.pendingBooster ? this.frameInput : { ...EMPTY_INPUT };
      this.inputSeq++;
      this.hooks.onInput?.(p.input, this.inputSeq);
    }

    const t = this.lerpT();
    for (const k of this.karts) {
      if (k === p && p.alive) {
        // Our own kart moves at once; the host's word on where it is comes back in reconcile().
        const wasAir = !k.onGround;
        stepKart(k, dt, this.arena, now);
        if (wasAir && k.onGround && k.landed > 0.4) this.particles.dust(k.pos.x, k.pos.y, k.pos.z, Math.min(1, k.landed));
        collideKartWithArena(k, this.arena);
        for (const o of this.karts) if (o !== k && o.alive && !o.hidden) collideKarts(k, o);
        const f = Math.min(1, 6 * dt);
        const mx = this.corr.x * f;
        const mz = this.corr.z * f;
        k.pos.x += mx;
        k.pos.z += mz;
        this.corr.x -= mx;
        this.corr.z -= mz;
        for (const h of this.history) {
          h.x += mx;
          h.z += mz;
        }
        this.history.push({ seq: this.inputSeq, x: k.pos.x, z: k.pos.z });
        if (this.history.length > 240) this.history.shift();
      } else this.placeFromSnaps(k, t);
    }
    this.weapons.drift(dt);
    for (const b of this.boxes) if (b.active) b.update(dt, now);
    for (const k of this.karts) {
      if (k.alive && !this.cloaked(k)) this.exhaust(k, dt, now);
      this.syncKartView(k, dt, now);
    }
    this.finishFrame(dt, now);
  }

  /** Hidden from this tab: answering a question, and not the kart this tab drives. */
  private cloaked(k: Kart): boolean {
    return k.hidden && k !== this.player;
  }

  private syncKartView(k: Kart, dt: number, now: number): void {
    k.syncView(dt, now);
    if (k.view) {
      // Whoever is answering a question vanishes for everyone else, with a
      // puff on the way out and back so it reads as the game, not a glitch.
      const cloaked = this.cloaked(k);
      const shown = k.alive && !cloaked;
      const ud = k.view.root.userData as { cloaked?: boolean };
      if (k.view.root.visible !== shown) {
        if (k.alive && (cloaked || ud.cloaked)) this.particles.puff(k.pos.x, k.pos.y + 0.7, k.pos.z, 0, 1.2, 0, "#ffe9a8", 1.3, 0.45, "#ffffff");
        k.view.root.visible = shown;
      }
      ud.cloaked = cloaked;
    }
    if (k.view && k.view.tag && k.alive) {
      const shown = Math.round(k.hp);
      if (k.view.tag.userData.hp !== shown) {
        k.view.tag.userData.hp = shown;
        k.view.setTag(k.name, shown);
      }
      // A tag right next to the camera would cover the screen.
      const cp = this.camera.cam.position;
      k.view.tag.visible = Math.hypot(k.pos.x - cp.x, k.pos.z - cp.z) > 5;
    }
  }

  private finishFrame(dt: number, now: number): void {
    const p = this.player;
    this.particles.update(dt);
    this.waves.update(dt);
    this.skids.update(dt);
    this.flashes.update(dt);
    this.numbers.update(dt);
    this.renderer.sky.update(dt);

    // Camera and sound.
    if (p) this.camera.follow(p, dt, this.arena, now);
    else this.camera.spectate(dt, this.arena);
    const c = this.camera.cam.position;
    this.audio.setListener(c.x, c.y, c.z);
    if (p && p.alive) this.audio.engine(clamp(Math.abs(p.speed) / KART.maxSpeed, 0, 1), p.isBoosting(now), true, clamp(p.input.throttle, 0, 1));
    else this.audio.engine(0, false, false);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);

    this.publishHud(now);
  }

  /** How far between the last two snapshots to draw: 0 at the older one, 1 at the newest, a little past when the next is late. */
  private lerpT(): number {
    if (!this.snapCur) return 0;
    const interval = this.snapPrev ? Math.max(50, this.snapCur.at - this.snapPrev.at) : 100;
    return clamp((performance.now() - this.snapCur.at) / interval, 0, 1.5);
  }

  private placeFromSnaps(k: Kart, t: number): void {
    const lp = this.lerps.get(k);
    const cur = this.snapCur?.s.karts[this.karts.indexOf(k)];
    if (!lp) return;
    k.pos.x = lerp(lp.px, lp.cx, t);
    k.pos.y = lerp(lp.py, lp.cy, t);
    k.pos.z = lerp(lp.pz, lp.cz, t);
    k.yaw = lp.pyaw + angleDelta(lp.pyaw, lp.cyaw) * t;
    if (cur) {
      k.vel.set(cur.vx, 0, cur.vz);
      k.speed = cur.sp;
      k.onGround = !(cur.f & 128);
      k.input.throttle = Math.abs(cur.sp) > 1 ? 1 : 0;
      k.input.steer = 0;
    }
    k.groundY = this.arena.heightAt(k.pos.x, k.pos.z, k.pos.y);
  }

  /** The host's word on where our kart was at a given input: shift ours by the difference, gently. */
  private reconcile(k: Kart, sk: SnapKart): void {
    const h = this.history.find((e) => e.seq === sk.sq) ?? null;
    const bx = h ? h.x : k.pos.x;
    const bz = h ? h.z : k.pos.z;
    const ex = sk.x - bx;
    const ez = sk.z - bz;
    const d = Math.hypot(ex, ez);
    if (d > 6) {
      k.pos.set(sk.x, sk.y, sk.z);
      k.yaw = sk.yaw;
      k.vel.set(sk.vx, 0, sk.vz);
      this.corr.x = this.corr.z = 0;
      this.history.length = 0;
    } else if (d > 0.35) {
      this.corr.x = ex;
      this.corr.z = ez;
    }
  }

  private handleEvent(e: NetEvent): void {
    const K = this.karts;
    switch (e.t) {
      case "kill": {
        const killer = K[e.k];
        const victim = K[e.v];
        if (!killer || !victim) return;
        victim.alive = false;
        victim.hp = 0;
        victim.streak = 0;
        victim.weapon = null;
        victim.pendingBooster = false;
        this.killEffects(victim, killer, e.w, e.st);
        return;
      }
      case "dmg": {
        const victim = K[e.v];
        const attacker = K[e.k];
        if (!victim) return;
        victim.flash = 1;
        if (victim === this.player || attacker === this.player) {
          this.numbers.show(victim.pos.x, victim.pos.y + 2.3, victim.pos.z, `-${e.n}`, victim === this.player ? "#ff7b7b" : e.w === "bump" ? "#ffffff" : WEAPONS[e.w].color);
        }
        if (victim === this.player) {
          this.damageFlash = 1;
          this.camera.shake(0.18 + e.n / 150);
          this.audio.play("hit");
        }
        return;
      }
      case "boom":
        this.boomEffects(e.x, e.y, e.z, e.r, e.s);
        return;
      case "snd":
        this.audio.play(e.n, e.x, e.y, e.z);
        return;
      case "pick": {
        const b = this.boxes[e.b];
        if (b) this.particles.sparkle(b.x, b.y, b.z, "#ff5d8f");
        return;
      }
      case "ask": {
        const k = K[e.k];
        if (k !== this.player || !k || !this.hooks.requestBooster) return;
        k.pendingBooster = true;
        k.input = { ...EMPTY_INPUT };
        this.hooks.requestBooster({ kartId: k.id, options: [...WEAPON_IDS], suggested: e.w }).then(
          (w) => this.hooks.onBoosterResolved?.(w),
          () => this.hooks.onBoosterResolved?.(null),
        );
        return;
      }
      case "grant": {
        const k = K[e.k];
        if (k === this.player && k) this.say(WEAPONS[e.w].name, WEAPONS[e.w].blurb, 1.5, "neutral");
        return;
      }
      case "deny": {
        const k = K[e.k];
        if (k === this.player && k) {
          this.say("No booster this time", "Drive on", 1.4, "bad");
          this.audio.play("deny");
        }
        return;
      }
      case "spawn": {
        const k = K[e.k];
        if (k) this.waves.burst(k.pos.x, k.pos.y + 0.9, k.pos.z, 2.6, "#ffffff", 0.35);
        return;
      }
      case "over": {
        this.phase = "over";
        const standings = e.standings.map((s) => ({ ...s, isPlayer: !!this.player && s.id === this.player.id }));
        this.frozen = standings;
        this.finishEffects(standings);
        return;
      }
      case "match":
        this.feed.length = 0;
        this.frozen = null;
        this.message = null;
        this.lastBeep = 99;
        return;
    }
  }

  private exhaust(k: Kart, dt: number, now: number): void {
    const v = k.view;
    if (!v) return;
    const rx = Math.cos(k.yaw);
    const rz = -Math.sin(k.yaw);
    const boosting = k.isBoosting(now);
    let look = TRAILS[k.loadout.trail];
    if (look.rainbow) {
      const [a, b] = rainbowColors(now + k.wheelSpin * 0.01);
      look = { ...look, puff: [a, b], boost: [a, b], flame: [a, b] };
      if (boosting) {
        v.flameMats[0].color.set(a).multiplyScalar(1.4);
        v.flameMats[1].color.set(b).multiplyScalar(1.6);
      }
    }

    // Rubber on the ground when drifting hard or braking.
    if (k.onGround && ((Math.abs(k.input.steer) > 0.55 && Math.abs(k.speed) > 13) || (k.input.throttle < 0 && k.speed > 8))) {
      k.skidTimer += dt;
      if (k.skidTimer > 0.035) {
        k.skidTimer = 0;
        for (const side of [0.8, -0.8]) {
          this.skids.add(k.pos.x - k.fx * 0.85 + rx * side, k.pos.y, k.pos.z - k.fz * 0.85 + rz * side, k.yaw);
        }
      }
      if (Math.abs(k.speed) > 14 && this.rng.next() < 0.5) {
        const side = k.input.steer > 0 ? -0.8 : 0.8;
        this.particles.puff(k.pos.x - k.fx * 0.9 + rx * side, k.pos.y + 0.1, k.pos.z - k.fz * 0.9 + rz * side, 0, 1.4, 0, "#e9dcc3", 0.5, 0.4, "#cbbda2");
      }
    }

    k.exhaustTimer += dt;
    const throttle = k.input.throttle > 0;
    if (!k.onGround || (!throttle && !boosting)) return;
    const every = boosting ? 0.03 : 0.08;
    if (k.exhaustTimer < every) return;
    k.exhaustTimer = 0;
    for (const e of v.exhaust) {
      const x = k.pos.x + k.fx * e.z + rx * e.x;
      const z = k.pos.z + k.fz * e.z + rz * e.x;
      const y = k.pos.y + e.y;
      const jx = (this.rng.next() - 0.5) * 1.5;
      const jz = (this.rng.next() - 0.5) * 1.5;
      if (boosting) this.particles.puff(x, y, z, -k.fx * 6 + jx, look.rise + 0.5, -k.fz * 6 + jz, look.boost[0], 0.7, 0.35, look.boost[1]);
      else this.particles.puff(x, y, z, -k.fx * 2 + jx * 0.6, look.rise, -k.fz * 2 + jz * 0.6, look.puff[0], 0.35, 0.5, look.puff[1]);
    }
  }

  private publishHud(now: number): void {
    const h = this.hudState;
    const p = this.player;
    h.phase = this.phase;
    h.timeLeft = this.timeLeft;
    h.countdown = Math.max(0, this.countdown);
    h.nextIn = Math.max(0, this.nextIn);
    h.now = now;
    h.joined = p !== null;
    h.total = this.karts.length;
    h.arenaName = this.arena.def.name;
    h.arenaId = this.arena.def.id;
    const standings = this.frozen ?? this.standings();
    h.standings = standings;
    h.rank = p ? standings.findIndex((s) => s.isPlayer) + 1 : 0;
    if (p) {
      h.hp = Math.max(0, Math.round(p.hp));
      h.weapon = p.weapon ? { id: p.weapon.id, ammo: p.weapon.ammo, max: WEAPONS[p.weapon.id].ammo } : null;
      h.active = p.isShielded(now)
        ? { id: "shield", left: p.shieldUntil - now, total: STATS.shield.duration }
        : p.isBoosting(now)
          ? { id: "boost", left: p.boostUntil - now, total: STATS.boost.duration }
          : null;
      h.kills = p.kills;
      h.deaths = p.deaths;
      h.streak = p.streak;
      h.respawnIn = p.alive ? 0 : Math.max(0, p.respawnAt - now);
      h.pending = p.pendingBooster;
      h.speed = clamp(Math.abs(p.speed) / (KART.maxSpeed * KART.boostMul), 0, 1);
      h.boosting = p.isBoosting(now);
    } else {
      h.hp = 0;
      h.weapon = null;
      h.active = null;
      h.kills = h.deaths = h.streak = 0;
      h.respawnIn = 0;
      h.pending = false;
      h.speed = 0;
      h.boosting = false;
    }
    while (this.feed.length && this.feed[0].at < now - 6) this.feed.shift();
    h.feed = this.feed;
    h.message = this.message && this.message.until > now ? this.message : null;
    h.damageFlash = this.damageFlash;
    this.hooks.onHud?.(h);
  }
}

function sameLoadout(a: Loadout, b: Loadout): boolean {
  return a.character === b.character && a.body === b.body && a.color === b.color && a.wheels === b.wheels && a.hat === b.hat && a.decal === b.decal && a.trail === b.trail;
}

function weaponLabel(w: WeaponId | "bump"): string {
  return w === "bump" ? "Rammed" : WEAPONS[w].name;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
