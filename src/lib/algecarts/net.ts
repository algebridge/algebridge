import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { managedAccountNow } from "@/lib/school-mode";
import type { GameHandle, InputState, Loadout, NetRole, NetSnap, PlayerSetup, RosterEntry, WeaponId } from "./engine/types";
import { unwireLoadout, wireLoadout } from "./engine/profile";
import { cleanRacerName, namesForLobby } from "./engine/Game";

/**
 * The public lobby, over Supabase Realtime. One tab hosts: it runs the
 * simulation (bots included) and sends ten snapshots a second; every other
 * tab in the lobby mirrors them and sends its own kart's input back. A
 * registry channel lists the lobbies through presence, so whoever opens the
 * page lands in the first lobby with a free seat, or starts the next one.
 * When a host leaves, the guest who arrived first carries on as host on the
 * same channel, so nobody reconnects.
 *
 * Both channels are private: the database lets only signed-in accounts in
 * (supabase/schema-2026-11-03-hardening.sql), so the session's token goes to
 * Realtime before either is joined, and a signed-out tab plays solo. On the
 * wire a tab is a random player id, never its account id; presence carries
 * no names; a name from another tab is cleaned before it is shown
 * (cleanRacerName); a school account races as "Racer". A guest only takes
 * snapshots, rosters and seats from a tab that presence lists as this
 * lobby's host.
 *
 * Without Supabase (a local-only build) the game stays solo.
 */

export const SEATS = 8;
const SNAP_MS = 100;
/** Inputs go at most this often, and at least this often while playing. */
const INPUT_MIN_MS = 66;
const INPUT_KEEPALIVE_MS = 250;
/** No snapshot for this long with no host in presence: the host is gone. */
const HOST_SILENCE_MS = 4000;
const REGISTRY = "carts-lobbies";
const lobbyTopic = (id: number) => `carts-lobby-${id}`;
/** What a player id from another tab may look like. */
const PID = /^[A-Za-z0-9-]{1,80}$/;

export interface LobbyInfo {
  id: number;
  role: NetRole;
  /** Humans in the lobby, this tab included when it plays. */
  humans: number;
  /** The other humans' names. */
  others: string[];
  seats: number;
}

type HostMsg =
  | { k: "yield" }
  | { k: "snap"; s: NetSnap }
  | { k: "roster"; r: RosterEntry[]; host: string }
  | { k: "seat"; pid: string; i: number }
  | { k: "pong"; pid: string; t: number };

type PlayerMsg =
  | { k: "hello"; pid: string }
  | { k: "join"; pid: string; name: string; loadout: Loadout }
  | { k: "leave"; pid: string }
  | { k: "input"; pid: string; i: InputState; sq: number }
  | { k: "booster"; pid: string; w: WeaponId | null }
  | { k: "ping"; pid: string; t: number };

/** What a tab puts on presence. No name: nothing on presence is shown, so nobody's name rides on it. */
interface Meta {
  role: "host" | "guest";
  since: number;
  lobby?: number;
  humans?: number;
  open?: number;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** This tab's id on the wire: random, so the account id never leaves the tab. */
function randomPid(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `p${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function subscribe(ch: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    ch.subscribe((status, err) => {
      if (done) return;
      if (status === "SUBSCRIBED") {
        done = true;
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        done = true;
        reject(err ?? new Error(status));
      }
    });
  });
}

export class CartsNet {
  private supabase: SupabaseClient | null = null;
  private registry: RealtimeChannel | null = null;
  private lobby: RealtimeChannel | null = null;
  private lobbyId = 0;
  private role: NetRole = "solo";
  private since = 0;
  private closed = false;
  private snapTimer: ReturnType<typeof setInterval> | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private ticks = 0;
  private lastSnapAt = 0;
  private lastInputSentAt = 0;
  private lastInput: InputState | null = null;
  private pressPending = false;
  /** Host: the humans present on the lobby channel, by player id. */
  private readonly present = new Map<string, Meta>();
  private hostHere = false;
  /** The other tabs presence lists as this lobby's host (normally one). */
  private readonly hostPids = new Set<string>();
  private joined = false;
  private wanted: PlayerSetup | null = null;
  private deciding = false;
  /** Host: stepped out of the registry while hidden with nobody in the lobby. */
  private steppedOut = false;
  private conflictTimer: ReturnType<typeof setTimeout> | null = null;
  /** Host: when another host last spoke on this lobby's channel. */
  private foreignSnapAt = 0;
  private seatRetries = 0;
  /**
   * This tab on the wire. opts.pid (the account id plus a suffix) stays the
   * local game's id for its own seat; rosters are translated on the way out
   * and in.
   */
  private readonly wirePid = randomPid();

  constructor(
    private readonly game: GameHandle,
    private readonly opts: { pid: string; name: string; onLobby: (info: LobbyInfo) => void },
  ) {}

  currentRole(): NetRole {
    return this.role;
  }

  async start(): Promise<void> {
    if (!isSupabaseConfigured()) {
      this.announce();
      return;
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    try {
      this.supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { isSingleton: false });
      // Private channels are authorized per topic, so a session is needed and its token goes first.
      const { data } = await this.supabase.auth.getSession();
      if (!data.session) throw new Error("Alge Carts lobbies are for signed-in accounts.");
      await this.supabase.realtime.setAuth();
      await this.decide();
    } catch (e) {
      if (this.closed) return;
      console.warn("Alge Carts lobby: playing solo.", e);
      this.role = "solo";
      this.game.setRole("solo");
      this.announce();
    }
  }

  // ----- what the game asks of the wire -----

  /** Guest: the player pressed Play. Host and solo seat the player themselves. */
  join(p: PlayerSetup): void {
    this.wanted = { name: p.name, loadout: { ...p.loadout } };
    this.joined = true;
    if (this.role === "guest") this.sendPlayer({ k: "join", pid: this.wirePid, name: this.wireName(p.name), loadout: wireLoadout(p.loadout) });
  }

  leave(): void {
    this.joined = false;
    this.wanted = null;
    this.lastInput = null;
    if (this.role === "guest") this.sendPlayer({ k: "leave", pid: this.wirePid });
  }

  sendInput(i: InputState, sq: number): void {
    if (this.role !== "guest" || !this.joined) return;
    const now = Date.now();
    this.pressPending = this.pressPending || i.firePressed;
    const last = this.lastInput;
    const changed = !last || last.throttle !== i.throttle || last.steer !== i.steer || last.fire !== i.fire || this.pressPending;
    if ((changed && now - this.lastInputSentAt >= INPUT_MIN_MS) || now - this.lastInputSentAt >= INPUT_KEEPALIVE_MS) {
      this.sendPlayer({ k: "input", pid: this.wirePid, i: { throttle: i.throttle, steer: i.steer, fire: i.fire, firePressed: this.pressPending }, sq });
      this.pressPending = false;
      this.lastInputSentAt = now;
      this.lastInput = { ...i };
    }
  }

  sendBooster(w: WeaponId | null): void {
    if (this.role === "guest") this.sendPlayer({ k: "booster", pid: this.wirePid, w });
  }

  /** Host: a seat changed hands. */
  seatChanged(): void {
    if (this.role !== "host") return;
    this.sendRoster();
    void this.trackRegistry();
    this.announce();
  }

  close(): void {
    this.closed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    if (this.snapTimer) clearInterval(this.snapTimer);
    if (this.watchTimer) clearInterval(this.watchTimer);
    if (this.conflictTimer) clearTimeout(this.conflictTimer);
    this.snapTimer = this.watchTimer = this.conflictTimer = null;
    if (this.role === "guest" && this.joined) this.sendPlayer({ k: "leave", pid: this.wirePid });
    const s = this.supabase;
    const chans = [this.lobby, this.registry].filter((c): c is RealtimeChannel => !!c);
    this.lobby = this.registry = null;
    if (!s) return;
    void Promise.all(chans.map((c) => c.untrack().then(() => s.removeChannel(c)))).then(() => s.realtime.disconnect());
  }

  /**
   * A tab in the background stops drawing, and a host that stops drawing
   * freezes its lobby. So a hidden host with guests hands the lobby to one of
   * them and stays on as a guest; one with no guests steps out of the registry
   * and looks again when it is back.
   */
  private readonly onVisibility = (): void => {
    if (this.closed || !this.supabase) return;
    if (process.env.NODE_ENV === "development" && (window as unknown as { __cartsKeepHosting?: boolean }).__cartsKeepHosting) return;
    if (document.visibilityState === "hidden") {
      if (this.role !== "host") return;
      if (this.present.size > 0) {
        this.sendHost({ k: "yield" });
        void this.demote();
      } else {
        this.steppedOut = true;
        void this.registry?.untrack();
      }
      return;
    }
    if (this.steppedOut && this.role === "host") {
      this.steppedOut = false;
      if (this.present.size > 0) void this.trackRegistry();
      else void this.closeLobbyChannel().then(() => this.decide());
    }
  };

  /** The name other tabs see for this player: a school account races as "Racer". */
  private wireName(name: string): string {
    return managedAccountNow() ? "Racer" : cleanRacerName(name);
  }

  // ----- deciding where to be -----

  private async decide(): Promise<void> {
    if (this.deciding || this.closed) return;
    this.deciding = true;
    try {
      if (!this.registry) await this.openRegistry();
      await wait(700);
      const lobbies = this.readLobbies();
      const open = lobbies.filter((l) => l.open > 0).sort((a, b) => a.id - b.id)[0];
      // The open lobby may be the one this tab already hosts.
      if (open && open.pid === this.wirePid && this.role === "host" && this.lobby) return;
      if (open) await this.becomeGuest(open.id);
      else await this.becomeHost(lobbies.length ? Math.max(...lobbies.map((l) => l.id)) + 1 : 1);
    } finally {
      this.deciding = false;
    }
  }

  private async openRegistry(): Promise<void> {
    const ch = this.supabase!.channel(REGISTRY, { config: { presence: { key: this.wirePid }, private: true } });
    ch.on("presence", { event: "sync" }, () => this.onRegistrySync());
    await subscribe(ch);
    this.registry = ch;
  }

  /** Every lobby someone is hosting, one entry each; a lobby two tabs both think they host keeps the earlier one. */
  private readLobbies(): { id: number; open: number; since: number; pid: string }[] {
    if (!this.registry) return [];
    const state = this.registry.presenceState<Meta>();
    const byId = new Map<number, { id: number; open: number; since: number; pid: string }>();
    for (const [pid, metas] of Object.entries(state)) {
      for (const m of metas) {
        if (m.role !== "host" || m.lobby === undefined) continue;
        const have = byId.get(m.lobby);
        if (!have || m.since < have.since) byId.set(m.lobby, { id: m.lobby, open: m.open ?? 0, since: m.since, pid });
      }
    }
    return [...byId.values()];
  }

  private async becomeHost(id: number): Promise<void> {
    this.lobbyId = id;
    this.role = "host";
    this.since = Date.now();
    this.game.setRole("host");
    this.game.setBotNames(namesForLobby(id, SEATS));
    if (!this.lobby) await this.openLobby(id);
    await this.lobby!.track({ role: "host", since: this.since } satisfies Meta);
    await this.trackRegistry();
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.watchTimer = null;
    if (!this.snapTimer) this.snapTimer = setInterval(() => this.tick(), SNAP_MS);
    if (this.wanted && this.joined) this.game.join(this.wanted);
    this.sendRoster();
    this.announce();
  }

  private async becomeGuest(id: number): Promise<void> {
    this.lobbyId = id;
    this.role = "guest";
    this.since = Date.now();
    if (this.snapTimer) clearInterval(this.snapTimer);
    this.snapTimer = null;
    this.game.setRole("guest");
    if (!this.lobby) await this.openLobby(id);
    await this.lobby!.track({ role: "guest", since: this.since } satisfies Meta);
    await this.registry?.untrack();
    this.lastSnapAt = Date.now();
    this.sendPlayer({ k: "hello", pid: this.wirePid });
    if (this.joined && this.wanted) this.sendPlayer({ k: "join", pid: this.wirePid, name: this.wireName(this.wanted.name), loadout: wireLoadout(this.wanted.loadout) });
    if (!this.watchTimer) this.watchTimer = setInterval(() => this.watchHost(), 1000);
    this.announce();
  }

  private async openLobby(id: number): Promise<void> {
    const ch = this.supabase!.channel(lobbyTopic(id), { config: { presence: { key: this.wirePid }, broadcast: { self: false, ack: false }, private: true } });
    ch.on("broadcast", { event: "host" }, ({ payload }) => this.onHostMsg(payload));
    ch.on("broadcast", { event: "player" }, ({ payload }) => this.onPlayerMsg(payload));
    ch.on("presence", { event: "sync" }, () => this.onLobbySync());
    await subscribe(ch);
    this.lobby = ch;
  }

  private async closeLobbyChannel(): Promise<void> {
    const ch = this.lobby;
    this.lobby = null;
    if (!ch || !this.supabase) return;
    await ch.untrack();
    await this.supabase.removeChannel(ch);
  }

  private trackRegistry(): Promise<unknown> {
    if (!this.registry || this.role !== "host") return Promise.resolve();
    const humans = this.game.humans();
    const hostPlaying = this.game.hud().joined;
    // The host keeps one seat for itself while only watching.
    const open = Math.max(0, SEATS - humans - (hostPlaying ? 0 : 1));
    return this.registry.track({ role: "host", since: this.since, lobby: this.lobbyId, humans, open } satisfies Meta);
  }

  private announce(): void {
    const others = this.game
      .roster()
      .filter((e) => !e.bot && e.pid !== this.opts.pid)
      .map((e) => e.name);
    this.opts.onLobby({ id: this.lobbyId, role: this.role, humans: this.game.humans(), others, seats: SEATS });
  }

  // ----- presence -----

  private onRegistrySync(): void {
    if (this.role !== "host" || this.closed) return;
    // Two tabs opened at once and both started lobby N: the later one joins the earlier.
    const mine = this.readLobbies().find((l) => l.id === this.lobbyId);
    const conflict = !!mine && mine.pid !== this.wirePid && mine.since < this.since;
    if (!conflict || this.conflictTimer) return;
    // A host whose tab just closed lingers in presence until its socket times out, so a
    // registry entry alone proves nothing: the other host has to be sending snapshots on
    // this lobby's channel, now and still in three seconds.
    this.conflictTimer = setTimeout(() => {
      this.conflictTimer = null;
      if (this.role !== "host" || this.closed) return;
      const again = this.readLobbies().find((l) => l.id === this.lobbyId);
      const talking = Date.now() - this.foreignSnapAt < 3000;
      if (again && again.pid !== this.wirePid && again.since < this.since && talking) void this.demote();
    }, 3000);
  }

  private async demote(): Promise<void> {
    if (this.role !== "host") return;
    if (this.snapTimer) clearInterval(this.snapTimer);
    this.snapTimer = null;
    await this.becomeGuest(this.lobbyId);
  }

  private onLobbySync(): void {
    if (!this.lobby || this.closed) return;
    const state = this.lobby.presenceState<Meta>();
    this.present.clear();
    this.hostPids.clear();
    this.hostHere = false;
    for (const [pid, metas] of Object.entries(state)) {
      const m = metas[0];
      if (!m) continue;
      if (pid === this.wirePid) continue;
      if (m.role === "host") {
        this.hostHere = true;
        this.hostPids.add(pid);
      } else this.present.set(pid, m);
    }
    if (this.role === "host") {
      // Anyone seated whose tab is gone hands the seat back to a bot.
      for (const e of this.game.roster()) if (!e.bot && e.pid && e.pid !== this.opts.pid && !this.present.has(e.pid)) this.game.unseatRemote(e.pid);
      this.announce();
    }
  }

  /** Guest: a host that stopped talking is gone; the guest who has been here longest takes over. */
  private watchHost(): void {
    if (this.role !== "guest" || this.closed || this.deciding) return;
    if (this.hostHere && Date.now() - this.lastSnapAt < HOST_SILENCE_MS * 3) return;
    if (Date.now() - this.lastSnapAt < HOST_SILENCE_MS) return;
    const guests = [...this.present.entries()].filter(([, m]) => m.role === "guest").map(([pid, m]) => ({ pid, since: m.since }));
    guests.push({ pid: this.wirePid, since: this.since });
    guests.sort((a, b) => a.since - b.since || a.pid.localeCompare(b.pid));
    if (guests[0].pid !== this.wirePid) return;
    void this.promote();
  }

  private async promote(): Promise<void> {
    if (this.role !== "guest" || this.deciding) return;
    this.deciding = true;
    try {
      if (!this.registry) await this.openRegistry();
      await this.becomeHost(this.lobbyId);
    } finally {
      this.deciding = false;
    }
  }

  // ----- messages -----

  /** Every host message says which tab sent it, so a guest can check it against presence. */
  private sendHost(m: HostMsg): void {
    if (!this.lobby) return;
    void this.lobby.send({ type: "broadcast", event: "host", payload: { ...m, from: this.wirePid } });
  }

  private sendPlayer(m: PlayerMsg): void {
    if (!this.lobby) return;
    void this.lobby.send({ type: "broadcast", event: "player", payload: m });
  }

  /** The roster as other tabs see it: this tab's seat under its wire id and wire name. */
  private sendRoster(): void {
    const r = this.game.roster().map((e) => {
      const own = !e.bot && e.pid === this.opts.pid;
      return { ...e, pid: own ? this.wirePid : e.pid, name: own ? this.wireName(e.name) : e.name, loadout: wireLoadout(e.loadout) };
    });
    this.sendHost({ k: "roster", r, host: this.wirePid });
  }

  private tick(): void {
    if (this.role !== "host" || this.closed) return;
    this.ticks++;
    const snap = this.game.exportSnap();
    if (this.present.size === 0) return;
    this.sendHost({ k: "snap", s: snap });
    if (this.ticks % 20 === 0) this.sendRoster();
  }

  private onHostMsg(raw: unknown): void {
    if (!raw || typeof raw !== "object") return;
    const m = raw as HostMsg & { from?: unknown };
    // Only a tab that presence lists as this lobby's host may steer it.
    const fromHost = typeof m.from === "string" && this.hostPids.has(m.from);
    if (this.role === "host") {
      if (m.k === "snap" && fromHost) this.foreignSnapAt = Date.now();
      return;
    }
    if (this.role !== "guest" || !fromHost) return;
    switch (m.k) {
      case "yield":
        // The host is stepping back: the earliest guest takes over right away.
        this.hostHere = false;
        this.lastSnapAt = 0;
        this.watchHost();
        return;
      case "snap":
        if (!m.s || typeof m.s !== "object") return;
        this.lastSnapAt = Date.now();
        this.game.applySnap(m.s);
        return;
      case "roster":
        if (!Array.isArray(m.r) || !m.r.every((e) => !!e && typeof e === "object" && Number.isInteger(e.i))) return;
        this.game.applyRoster(
          m.r.map((e) => ({
            ...e,
            pid: e.pid === this.wirePid ? this.opts.pid : typeof e.pid === "string" ? e.pid : null,
            name: cleanRacerName(e.name),
            loadout: unwireLoadout(e.loadout),
          })),
        );
        this.announce();
        return;
      case "seat":
        if (m.pid !== this.wirePid || typeof m.i !== "number") return;
        if (m.i >= 0) {
          this.seatRetries = 0;
          this.game.setLocalSeat(m.i);
        } else if (this.joined && this.wanted) {
          // Refused: a host mid-handover says no for a moment, a full lobby says no for good.
          if (this.seatRetries++ < 3) {
            const w = this.wanted;
            setTimeout(() => {
              if (this.joined && this.role === "guest" && !this.closed) this.sendPlayer({ k: "join", pid: this.wirePid, name: this.wireName(w.name), loadout: wireLoadout(w.loadout) });
            }, 2000);
          } else {
            this.seatRetries = 0;
            void this.closeLobbyChannel().then(() => this.decide());
          }
        }
        return;
      case "pong":
        return;
    }
  }

  private onPlayerMsg(raw: unknown): void {
    if (this.role !== "host" || !raw || typeof raw !== "object") return;
    const m = raw as PlayerMsg;
    if (typeof m.pid !== "string" || !PID.test(m.pid) || m.pid === this.wirePid) return;
    switch (m.k) {
      case "hello":
        this.sendRoster();
        return;
      case "join": {
        // Whatever a tab calls its player, the lobby shows a "First L." shape or "Racer".
        const i = this.game.seatRemote(m.pid, cleanRacerName(m.name), unwireLoadout(m.loadout));
        this.sendRoster();
        this.sendHost({ k: "seat", pid: m.pid, i });
        void this.trackRegistry();
        this.announce();
        return;
      }
      case "leave":
        this.game.unseatRemote(m.pid);
        this.sendRoster();
        void this.trackRegistry();
        this.announce();
        return;
      case "input":
        if (!m.i || typeof m.i !== "object" || typeof m.sq !== "number") return;
        this.game.setRemoteInput(m.pid, { throttle: Number(m.i.throttle) || 0, steer: Number(m.i.steer) || 0, fire: !!m.i.fire, firePressed: !!m.i.firePressed }, m.sq);
        return;
      case "booster":
        this.game.resolveRemoteBooster(m.pid, m.w);
        return;
      case "ping":
        this.sendHost({ k: "pong", pid: m.pid, t: m.t });
        return;
    }
  }
}
