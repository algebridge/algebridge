import * as THREE from "three";
import type { ArenaId, FeedEntry, GameHandle, GameHooks, GameOptions, HudMessage, HudState, InputSource, InputState, KartSetup, Phase, PlayerSetup, Standing, WeaponId } from "./types";
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
import { clamp, lerp, Rng } from "./util";
import type { Palette } from "./render/Materials";

const FIXED = 1 / 60;
const RESPAWN_SECONDS = 3;
const PROTECT_SECONDS = 2.5;
const BOX_RESPAWN = 8;

const BOT_NAMES = ["Turbo Tess", "Max Vroom", "Nitro Nia", "Dash Diego", "Rocket Ray", "Zoom Zara", "Bolt Benny", "Skid Sam", "Vector Val", "Pixel Pete", "Gear Gigi", "Drift Dre"];

export function createGame(canvas: HTMLCanvasElement, options: GameOptions = {}): GameHandle {
  return new Game(canvas, options);
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

  constructor(canvas: HTMLCanvasElement, options: GameOptions) {
    this.quality = options.quality ?? "high";
    this.rng = new Rng(options.seed);
    this.hooks = options.hooks ?? {};
    this.matchSeconds = options.matchSeconds ?? 180;
    this.intermission = options.intermissionSeconds ?? 12;
    this.timeLeft = this.matchSeconds;

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

    const n = clamp(options.bots ?? 7, 0, 11);
    const names = this.rng.shuffle([...BOT_NAMES]).slice(0, n);
    const colors = this.rng.shuffle(CATALOG.color.map((c) => c.id));
    names.forEach((name, i) => {
      const loadout: Loadout = {
        character: this.rng.pick(CATALOG.character).id as Loadout["character"],
        body: this.rng.pick(CATALOG.body).id as Loadout["body"],
        color: colors[i % colors.length],
        wheels: this.rng.pick(CATALOG.wheels).id as Loadout["wheels"],
        hat: this.rng.pick(CATALOG.hat).id as Loadout["hat"],
        decal: this.rng.pick(CATALOG.decal).id as Loadout["decal"],
        trail: this.rng.next() < 0.6 ? "smoke" : (this.rng.pick(CATALOG.trail).id as Loadout["trail"]),
      };
      const setup: KartSetup = { id: `bot-${i}`, name, loadout, bot: true, skill: this.rng.range(0.45, 0.95) };
      const k = this.addKart(setup, false);
      this.bots.set(k.id, new BotBrain(k, this.rng));
    });

    this.hudState = {
      phase: "countdown", timeLeft: this.matchSeconds, countdown: 3, nextIn: 0, now: 0, joined: false, hp: 100, weapon: null, active: null,
      kills: 0, deaths: 0, streak: 0, rank: 0, total: n, respawnIn: 0, pending: false, feed: [], message: null, standings: [],
      speed: 0, boosting: false, arenaName: this.arena.def.name, arenaId: this.arena.def.id, damageFlash: 0,
    };

    this.setupArena();
    this.beginCountdown();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ----- GameHandle -----

  join(p: PlayerSetup): void {
    if (this.player) this.leave();
    const setup: KartSetup = { id: "player", name: p.name.trim() || "You", loadout: { ...p.loadout }, bot: false, skill: 1 };
    const k = this.addKart(setup, true);
    this.player = k;
    this.respawn(k, true);
    this.camera.snapTo(k);
    this.message = null;
    if (this.phase === "live") this.say("GO!", this.arena.def.name, 1.6, "good");
  }

  leave(): void {
    const k = this.player;
    if (!k) return;
    this.player = null;
    this.removeKart(k);
    this.audio.engine(0, false, false);
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

  // ----- CombatCtx -----

  now(): number {
    return this.clock;
  }

  sound(name: SoundName, x?: number, y?: number, z?: number): void {
    this.audio.play(name, x, y, z);
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
    this.particles.explosion(x, y, z, scale);
    this.waves.burst(x, y, z, radius * 0.95, scale > 1.5 ? "#ffb347" : "#ffd27a", 0.32);
    if (this.quality === "high") this.flashes.flash(x, y + 1, z, "#ffb347", 140 * scale, 0.3);
    this.sound(scale > 1.5 ? "bigexplosion" : "explosion", x, y, z);
    const p = this.player;
    if (p && p.alive) {
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius * 3) this.camera.shake((0.35 * scale * (radius * 3 - d)) / (radius * 3));
    }
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

  // ----- karts -----

  private addKart(setup: KartSetup, isPlayer: boolean): Kart {
    const k = new Kart(setup);
    k.view = buildKart(this.palette, setup.loadout, setup.name, isPlayer, this.quality);
    this.scene.add(k.view.root);
    this.karts.push(k);
    k.alive = false;
    k.view.root.visible = false;
    return k;
  }

  private removeKart(k: Kart): void {
    const i = this.karts.indexOf(k);
    if (i >= 0) this.karts.splice(i, 1);
    this.bots.delete(k.id);
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
    this.particles.explosion(victim.pos.x, victim.pos.y + 0.5, victim.pos.z, 1.7, victim.color);
    this.particles.sparks(victim.pos.x, victim.pos.y + 0.8, victim.pos.z, victim.color, 16, 9, 0.8, "#2a2f3f");
    this.waves.burst(victim.pos.x, victim.pos.y + 0.6, victim.pos.z, 4, "#ffffff", 0.4);
    if (victim.view) victim.view.root.visible = false;

    attacker.kills++;
    attacker.streak++;
    attacker.lastKillAt = this.clock;
    attacker.celebrateUntil = this.clock + 1.6;
    this.feed.push({
      id: ++this.feedId, killer: attacker.name, killerColor: attacker.color, victim: victim.name, victimColor: victim.color, weapon, at: this.clock,
    });
    if (this.feed.length > 6) this.feed.shift();
    this.hooks.onKill?.({
      killerId: attacker.id, killerName: attacker.name, victimId: victim.id, victimName: victim.name, weapon, streak: attacker.streak,
      killerIsPlayer: attacker === this.player, victimIsPlayer: victim === this.player,
    });

    if (victim === this.player) {
      this.sound("death");
      this.camera.shake(0.9);
      this.say(`Smashed by ${attacker.name}`, weaponLabel(weapon), RESPAWN_SECONDS, "bad");
      this.hooks.onPlayerDeath?.({ by: attacker.name, weapon });
    } else {
      this.sound("explosion", victim.pos.x, victim.pos.y, victim.pos.z);
    }
    if (attacker === this.player) {
      const s = attacker.streak;
      const title = s >= 7 ? "UNSTOPPABLE" : s >= 5 ? "RAMPAGE" : s === 3 ? "TRIPLE SMASH" : s === 2 ? "DOUBLE SMASH" : `Smashed ${victim.name}`;
      this.say(title, s >= 2 ? `${s} in a row` : weaponLabel(weapon), 1.8, "good");
      this.sound(s >= 2 ? "streak" : "kill");
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
    const suggested = rollWeapon(this.rng);
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

  private setupArena(): void {
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
    if (this.player) this.camera.snapTo(this.player);
  }

  private endMatch(): void {
    this.phase = "over";
    this.nextIn = this.intermission;
    const standings = this.standings();
    this.frozen = standings;
    const rank = this.player ? standings.findIndex((s) => s.isPlayer) + 1 : 0;
    const winner = this.karts.find((k) => k.id === standings[0]?.id);
    if (winner) winner.celebrateUntil = this.clock + this.intermission;
    this.sound("over");
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
      if (!k.bot) continue;
      const brain = this.bots.get(k.id);
      k.input = live && brain ? brain.update(dt, now, world) : { ...EMPTY_INPUT };
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
      if (!a.alive) continue;
      for (let j = i + 1; j < this.karts.length; j++) {
        const b = this.karts[j];
        if (!b.alive) continue;
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
        if (!k.alive || k.pendingBooster) continue;
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
      k.syncView(dt, now);
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
    if (p && p.alive) this.audio.engine(clamp(Math.abs(p.speed) / KART.maxSpeed, 0, 1), p.isBoosting(now), true);
    else this.audio.engine(0, false, false);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);

    this.publishHud(now);
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

function weaponLabel(w: WeaponId | "bump"): string {
  return w === "bump" ? "Rammed" : WEAPONS[w].name;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
