import type { ArenaId } from "../engine/types";
import { ARENAS, ARENA_ORDER } from "../engine/world/arenas";
import { buy, CATALOG, equip, ITEM_KINDS, itemOf, KIND_LABELS, levelOf, owns, type ItemKind, type Loadout, type Profile, type ProfileStore } from "../engine/profile";
import { KartPreview } from "./preview";
import { esc } from "./hud";
import { ICON_COIN } from "./icons";

export interface GarageChoice {
  arena: ArenaId | "random";
  gate: boolean;
}

/**
 * The lobby as a garage: the player's kart on a turntable, the shop tabs,
 * their level and coins, and the Play button. Buying equips; clicking an
 * owned item equips; clicking an unowned one tries it on and offers the buy.
 */
export class Garage {
  readonly root: HTMLDivElement;
  private readonly preview: KartPreview;
  private tab: ItemKind = "character";
  private trying: { kind: ItemKind; id: string } | null = null;
  private choice: GarageChoice;
  private readonly q: Record<string, HTMLElement> = {};
  private shakeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    parent: HTMLElement,
    private profile: Profile,
    private readonly store: ProfileStore,
    initial: GarageChoice,
    private readonly onPlay: (p: Profile, c: GarageChoice) => void,
    private readonly opts: { footNote?: string; onBack?: () => void } = {},
  ) {
    this.choice = { ...initial };
    this.root = document.createElement("div");
    this.root.className = "garage";
    this.root.innerHTML = `
      <div class="garage-card">
        <header class="g-head">
          <div class="logo"><span class="logo-a">ALGE</span><span class="logo-b">CARTS</span></div>
          <div class="g-account">
            <input class="g-name" type="text" maxlength="14" autocomplete="off" spellcheck="false" placeholder="Your name" data-q="name" />
            <div class="g-level"><span class="g-level-badge" data-q="level">Lv 1</span><span class="g-level-title" data-q="title">Rookie</span><div class="xp"><div class="xp-fill" data-q="xpFill"></div></div></div>
            <div class="g-coins" data-q="coins" title="Bridgeys">${ICON_COIN}<span data-q="coinsN">0</span><span class="g-coins-label">Bridgeys</span></div>
          </div>
        </header>
        <div class="g-body">
          <div class="g-left">
            <canvas class="g-preview" data-q="preview"></canvas>
            <div class="g-stats" data-q="stats"></div>
          </div>
          <div class="g-right">
            <div class="g-tabs" data-q="tabs"></div>
            <div class="g-grid" data-q="grid"></div>
            <div class="g-buy" data-q="buy"></div>
          </div>
        </div>
        <footer class="g-foot">
          <div class="g-foot-left">
            <div class="pills" data-q="arenas"></div>
            <label class="toggle small">
              <input type="checkbox" data-q="gate" />
              <span class="toggle-track"><span class="toggle-knob"></span></span>
              <span class="toggle-text"><b>Math gate preview</b></span>
            </label>
          </div>
          <div class="g-foot-right">
            ${this.opts.onBack ? `<button class="ghost" data-q="back">Back to games</button>` : ""}
            <button class="play" data-q="play">PLAY</button>
          </div>
        </footer>
      </div>
      <div class="lobby-foot">${esc(this.opts.footNote ?? "Progress and Bridgeys save on this device. Connected to AlgeBridge, they live on the student's account.")}</div>
    `;
    parent.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>("[data-q]").forEach((el) => (this.q[el.dataset.q!] = el));

    this.preview = new KartPreview(this.q.preview as HTMLCanvasElement);

    const name = this.q.name as HTMLInputElement;
    name.value = profile.name;
    name.addEventListener("input", () => {
      this.profile.name = name.value.slice(0, 14);
      void this.store.save(this.profile);
    });
    name.addEventListener("change", () => this.preview.setLoadout(this.previewLoadout(), this.profile.name));
    name.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.play();
    });

    this.q.tabs.innerHTML = ITEM_KINDS.map((k) => `<button class="g-tab" data-k="${k}">${KIND_LABELS[k]}</button>`).join("");
    this.q.tabs.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>(".g-tab");
      if (!b) return;
      this.tab = b.dataset.k as ItemKind;
      this.trying = null;
      this.render();
    });
    this.q.grid.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>(".g-item");
      if (!b) return;
      this.pick(this.tab, b.dataset.id!);
    });
    this.q.buy.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-buy]");
      if (!b || !this.trying) return;
      this.purchase(this.trying.kind, this.trying.id);
    });

    this.q.arenas.innerHTML =
      `<button class="pill" data-a="random">Rotate</button>` + ARENA_ORDER.map((id) => `<button class="pill" data-a="${id}" title="${esc(ARENAS[id].tagline)}">${esc(ARENAS[id].name)}</button>`).join("");
    this.q.arenas.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>(".pill");
      if (!b) return;
      this.choice.arena = b.dataset.a as ArenaId | "random";
      this.renderFoot();
    });
    const gate = this.q.gate as HTMLInputElement;
    gate.checked = this.choice.gate;
    gate.addEventListener("change", () => (this.choice.gate = gate.checked));
    this.q.play.addEventListener("click", () => this.play());
    this.q.back?.addEventListener("click", () => this.opts.onBack?.());

    this.render();
    this.renderFoot();
    this.preview.setLoadout(this.previewLoadout(), profile.name);
  }

  /** The profile changed elsewhere (rewards after a match). */
  setProfile(p: Profile): void {
    this.profile = p;
    this.trying = null;
    this.render();
    this.preview.setLoadout(this.previewLoadout(), p.name);
  }

  current(): GarageChoice {
    return { ...this.choice };
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.preview.start();
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.preview.stop();
  }

  private play(): void {
    this.trying = null;
    this.onPlay(this.profile, { ...this.choice });
  }

  private previewLoadout(): Loadout {
    const lo = { ...this.profile.loadout };
    if (this.trying) (lo as Record<ItemKind, string>)[this.trying.kind] = this.trying.id;
    return lo;
  }

  private pick(kind: ItemKind, id: string): void {
    if (owns(this.profile, kind, id)) {
      equip(this.profile, kind, id);
      this.trying = null;
      void this.store.save(this.profile);
    } else {
      this.trying = { kind, id };
    }
    this.render();
    this.preview.setLoadout(this.previewLoadout(), this.profile.name);
  }

  private purchase(kind: ItemKind, id: string): void {
    const r = buy(this.profile, kind, id);
    if (r === "ok") {
      this.trying = null;
      void this.store.save(this.profile);
      this.q.coins.classList.remove("pop");
      void this.q.coins.offsetWidth;
      this.q.coins.classList.add("pop");
    } else if (r === "poor") {
      this.q.coins.classList.remove("shake");
      void this.q.coins.offsetWidth;
      this.q.coins.classList.add("shake");
      if (this.shakeTimer) clearTimeout(this.shakeTimer);
      this.shakeTimer = setTimeout(() => this.q.coins.classList.remove("shake"), 600);
    }
    this.render();
    this.preview.setLoadout(this.previewLoadout(), this.profile.name);
  }

  private render(): void {
    const p = this.profile;
    const lv = levelOf(p.xp);
    this.q.level.textContent = `Lv ${lv.level}`;
    this.q.title.textContent = lv.title;
    this.q.xpFill.style.width = `${Math.round((100 * lv.into) / lv.need)}%`;
    this.q.level.title = `${lv.into} / ${lv.need} XP to level ${lv.level + 1}`;
    this.q.coinsN.textContent = p.coins.toLocaleString();
    const st = p.stats;
    this.q.stats.innerHTML = [
      ["Matches", st.matches],
      ["Wins", st.wins],
      ["Smashes", st.kills],
      ["Best streak", st.bestStreak],
    ]
      .map(([k, v]) => `<span><b>${v}</b>${k}</span>`)
      .join("");

    this.q.tabs.querySelectorAll<HTMLElement>(".g-tab").forEach((b) => b.classList.toggle("on", b.dataset.k === this.tab));
    const kind = this.tab;
    const equipped = p.loadout[kind];
    this.q.grid.className = `g-grid kind-${kind}`;
    this.q.grid.innerHTML = CATALOG[kind]
      .map((it) => {
        const own = owns(p, kind, it.id);
        const on = it.id === equipped;
        const trying = this.trying?.kind === kind && this.trying.id === it.id;
        const cls = `g-item${on ? " on" : ""}${trying ? " trying" : ""}${own ? " owned" : " locked"}`;
        const swatch = kind === "color" ? `<span class="g-swatch" style="--c:${it.id}"></span>` : "";
        const price = own ? (on ? `<span class="g-state">Equipped</span>` : `<span class="g-state">Owned</span>`) : `<span class="g-price">${ICON_COIN}${it.price}</span>`;
        const tier = it.price >= 800 ? `<span class="g-tier epic">Epic</span>` : it.price >= 400 ? `<span class="g-tier rare">Rare</span>` : "";
        return `<button class="${cls}" data-id="${it.id}" title="${esc(it.blurb)}">${tier}${swatch}<span class="g-item-name">${esc(it.name)}</span>${price}</button>`;
      })
      .join("");

    const t = this.trying && this.trying.kind === kind ? itemOf(kind, this.trying.id) : null;
    if (t) {
      const short = Math.max(0, t.price - p.coins);
      this.q.buy.innerHTML = `<div class="g-buy-text"><b>${esc(t.name)}</b><small>${esc(t.blurb || "Trying it on.")}</small></div><button class="g-buy-btn${short > 0 ? " poor" : ""}" data-buy="1">${short > 0 ? `Need ${short} more Bridgeys` : `Buy for ${t.price} Bridgeys`}</button>`;
    } else {
      const cur = itemOf(kind, equipped);
      this.q.buy.innerHTML = `<div class="g-buy-text"><b>${esc(cur?.name ?? "")}</b><small>${esc(cur?.blurb || "Equipped. Pick another to try it on.")}</small></div>`;
    }
  }

  private renderFoot(): void {
    this.q.arenas.querySelectorAll<HTMLElement>("[data-a]").forEach((b) => b.classList.toggle("on", b.dataset.a === this.choice.arena));
  }

  dispose(): void {
    this.preview.dispose();
    this.root.remove();
  }
}
