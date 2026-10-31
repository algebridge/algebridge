import type { HudState } from "../engine/types";
import { WEAPONS } from "../engine/weapons/weapons";
import { WEAPON_ICONS } from "./icons";

/** The in-match overlay, drawn from HudState each frame. Only changed text touches the DOM. */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly q: Record<string, HTMLElement> = {};
  private tabHeld = false;
  private lastFeed = "";
  private lastStandings = "";
  private lastMsg: object | null = null;
  private cache = new Map<string, string>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud hidden";
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="feed" data-q="feed"></div>
        <div class="timer"><div class="timer-text" data-q="timer">3:00</div><div class="timer-arena" data-q="arena"></div></div>
        <div class="score"><div class="score-rank" data-q="rank">#1</div><div class="score-kills" data-q="kills">0 smashes</div><div class="score-coins hidden" data-q="coins">+0 Bridgeys</div></div>
      </div>
      <div class="hud-center">
        <div class="countdown hidden" data-q="countdown">3</div>
        <div class="message hidden" data-q="message"><div class="message-title" data-q="msgTitle"></div><div class="message-sub" data-q="msgSub"></div></div>
        <div class="respawn hidden" data-q="respawn">Back in <b data-q="respawnN">3</b></div>
      </div>
      <div class="hud-bottom">
        <div class="hp"><div class="hp-label">HP</div><div class="hp-bar"><div class="hp-fill" data-q="hpFill"></div></div><div class="hp-text" data-q="hpText">100</div></div>
        <div class="weapon empty" data-q="weapon">
          <div class="weapon-icon" data-q="wIcon"></div>
          <div class="weapon-body"><div class="weapon-name" data-q="wName">No booster</div><div class="weapon-ammo" data-q="wAmmo">Drive through a ? box</div></div>
        </div>
        <div class="active hidden" data-q="active"><div class="active-icon" data-q="aIcon"></div><div class="active-bar"><div class="active-fill" data-q="aFill"></div></div></div>
        <div class="hint">WASD drive · Space fire · Tab scores · M sound · Esc garage</div>
      </div>
      <div class="speedlines" data-q="speed"></div>
      <div class="vignette" data-q="vignette"></div>
      <div class="standings hidden" data-q="standings"><div class="standings-title">Standings</div><table><tbody data-q="standingsBody"></tbody></table></div>
    `;
    parent.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>("[data-q]").forEach((el) => (this.q[el.dataset.q!] = el));
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.code !== "Tab" && e.key !== "Tab") return;
    if (this.root.classList.contains("hidden")) return;
    e.preventDefault();
    this.tabHeld = e.type === "keydown";
  };

  show(): void {
    this.root.classList.remove("hidden");
  }

  /** Coins earned this session, shown under the rank. */
  setCoins(n: number): void {
    this.toggle("coins", n > 0);
    this.text("coins", `+${n} Bridgeys`);
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.tabHeld = false;
  }

  private text(key: string, value: string): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    this.q[key].textContent = value;
  }

  private toggle(key: string, on: boolean): void {
    this.q[key].classList.toggle("hidden", !on);
  }

  update(s: HudState): void {
    const q = this.q;
    const m = Math.floor(s.timeLeft / 60);
    const sec = Math.floor(s.timeLeft % 60);
    this.text("timer", `${m}:${sec.toString().padStart(2, "0")}`);
    q.timer.parentElement!.classList.toggle("urgent", s.phase === "live" && s.timeLeft < 15);
    this.text("arena", s.arenaName);
    this.text("rank", s.joined ? `#${s.rank} of ${s.total}` : "Watching");
    this.text("kills", s.joined ? `${s.kills} ${s.kills === 1 ? "smash" : "smashes"}` : `${s.total} karts`);

    // Countdown.
    const cd = s.phase === "countdown" && s.countdown > 0 ? Math.ceil(s.countdown) : 0;
    this.toggle("countdown", cd > 0 && cd <= 3);
    if (cd > 0 && cd <= 3) {
      const txt = String(cd);
      if (q.countdown.textContent !== txt) {
        q.countdown.textContent = txt;
        q.countdown.classList.remove("pop");
        void q.countdown.offsetWidth;
        q.countdown.classList.add("pop");
      }
    }

    // Message.
    const msg = s.message;
    this.toggle("message", msg !== null && s.joined);
    if (msg && msg !== this.lastMsg) {
      this.lastMsg = msg;
      q.msgTitle.textContent = msg.title;
      q.msgSub.textContent = msg.sub ?? "";
      q.message.className = `message tone-${msg.tone}`;
      void q.message.offsetWidth;
      q.message.classList.add("in");
    }
    if (!msg) this.lastMsg = null;

    // Respawn.
    this.toggle("respawn", s.joined && s.respawnIn > 0);
    if (s.respawnIn > 0) this.text("respawnN", String(Math.ceil(s.respawnIn)));

    // Health.
    const hp = Math.max(0, Math.min(100, s.hp));
    q.hpFill.style.width = `${hp}%`;
    q.hpFill.className = `hp-fill ${hp > 50 ? "ok" : hp > 25 ? "warn" : "low"}`;
    this.text("hpText", String(hp));

    // Weapon.
    const w = s.weapon;
    q.weapon.classList.toggle("empty", !w);
    if (w) {
      const def = WEAPONS[w.id];
      if (this.cache.get("icon") !== w.id) {
        this.cache.set("icon", w.id);
        q.wIcon.innerHTML = WEAPON_ICONS[w.id];
        q.weapon.style.setProperty("--w", def.color);
      }
      this.text("wName", def.name);
      const ammo = def.ammo > 6 ? `${w.ammo} rounds` : "●".repeat(w.ammo) + "○".repeat(Math.max(0, w.max - w.ammo));
      this.text("wAmmo", ammo);
    } else {
      if (this.cache.get("icon") !== "") {
        this.cache.set("icon", "");
        q.wIcon.innerHTML = "";
      }
      this.text("wName", "No booster");
      this.text("wAmmo", s.pending ? "Answer to unlock" : "Drive through a ? box");
    }

    // Shield or boost timer.
    this.toggle("active", s.active !== null);
    if (s.active) {
      const key = `active:${s.active.id}`;
      if (this.cache.get("activeId") !== key) {
        this.cache.set("activeId", key);
        q.aIcon.innerHTML = WEAPON_ICONS[s.active.id];
        q.active.style.setProperty("--w", WEAPONS[s.active.id].color);
      }
      q.aFill.style.width = `${(100 * s.active.left) / s.active.total}%`;
    }

    // Speed lines while boosting.
    q.speed.style.opacity = s.boosting ? "1" : "0";

    // Vignette.
    const low = hp > 0 && hp <= 25 && s.respawnIn === 0 ? 0.25 + 0.15 * Math.sin(s.now * 6) : 0;
    const v = Math.min(1, s.damageFlash * 0.8 + low);
    q.vignette.style.opacity = s.joined ? v.toFixed(3) : "0";

    // Feed.
    const sig = s.feed.map((f) => f.id).join(",");
    if (sig !== this.lastFeed) {
      this.lastFeed = sig;
      q.feed.innerHTML = s.feed
        .slice(-5)
        .map(
          (f) =>
            `<div class="feed-row"><span class="feed-name" style="color:${f.killerColor}">${esc(f.killer)}</span><span class="feed-icon">${WEAPON_ICONS[f.weapon]}</span><span class="feed-name" style="color:${f.victimColor}">${esc(f.victim)}</span></div>`,
        )
        .join("");
    }

    // Standings (Tab).
    const showStandings = this.tabHeld && s.joined && s.phase !== "over";
    this.toggle("standings", showStandings);
    if (showStandings) {
      const sg = s.standings.map((r) => `${r.id}:${r.kills}:${r.deaths}:${r.alive ? 1 : 0}`).join("|");
      if (sg !== this.lastStandings) {
        this.lastStandings = sg;
        q.standingsBody.innerHTML = s.standings
          .map(
            (r, i) =>
              `<tr class="${r.isPlayer ? "me" : ""}"><td class="pos">${i + 1}</td><td><span class="dot" style="background:${r.color}"></span>${esc(r.name)}</td><td class="num">${r.kills}</td><td class="num dim">${r.deaths}</td></tr>`,
          )
          .join("");
      }
    }
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
    this.root.remove();
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
