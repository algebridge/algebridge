import type { HudState } from "../engine/types";
import { esc } from "./hud";
import type { Rewards } from "../engine/profile";
import { ICON_COIN } from "./icons";

/** End-of-match results, with the countdown to the next arena. */
export class Scoreboard {
  readonly root: HTMLDivElement;
  private lastSig = "";

  constructor(parent: HTMLElement, onLobby: () => void) {
    this.root = document.createElement("div");
    this.root.className = "results hidden";
    this.root.innerHTML = `
      <div class="results-card">
        <div class="results-title">MATCH OVER</div>
        <div class="results-sub" data-q="sub"></div>
        <table><thead><tr><th></th><th>Kart</th><th class="num">Smashes</th><th class="num">Smashed</th></tr></thead><tbody data-q="body"></tbody></table>
        <div class="results-rewards hidden" data-q="rewards"></div>
        <div class="results-foot">
          <span data-q="next">Next match in 12</span>
          <button class="ghost" data-q="lobby">Back to garage</button>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelector("[data-q=lobby]")!.addEventListener("click", onLobby);
  }

  /** What the match paid, shown under the table until the board closes. */
  showRewards(rw: Rewards, levelBefore: number, levelAfter: number, title: string, total: number): void {
    const box = this.root.querySelector<HTMLElement>("[data-q=rewards]")!;
    const rows = rw.lines.map((l) => `<div class="rw-row"><span>${esc(l.label)}</span><span class="rw-coins">${l.coins ? `${ICON_COIN}+${l.coins}` : ""}</span><span class="rw-xp">+${l.xp} XP</span></div>`).join("");
    const up = levelAfter > levelBefore ? `<div class="rw-up">Level up! You are now level ${levelAfter}, ${esc(title)}.</div>` : "";
    box.innerHTML = `${rows}<div class="rw-row rw-total"><span>Total</span><span class="rw-coins">${rw.coins ? `${ICON_COIN}+${rw.coins}` : ""}</span><span class="rw-xp">+${rw.xp} XP</span></div>${up}<div class="rw-bank">${ICON_COIN}${total.toLocaleString()} Bridgeys in the garage</div>`;
    box.classList.remove("hidden");
  }

  update(s: HudState): void {
    const show = s.phase === "over" && s.joined;
    this.root.classList.toggle("hidden", !show);
    if (!show) {
      this.lastSig = "";
      this.root.querySelector("[data-q=rewards]")!.classList.add("hidden");
      return;
    }
    const next = this.root.querySelector("[data-q=next]")!;
    const n = Math.ceil(s.nextIn);
    const txt = `Next match in ${n}`;
    if (next.textContent !== txt) next.textContent = txt;
    const sig = s.standings.map((r) => `${r.id}:${r.kills}:${r.deaths}`).join("|");
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    const me = s.standings.find((r) => r.isPlayer);
    const rank = me ? s.standings.indexOf(me) + 1 : 0;
    this.root.querySelector("[data-q=sub]")!.textContent = rank === 1 ? `You won ${s.arenaName}` : `You placed ${rank} of ${s.standings.length} on ${s.arenaName}`;
    this.root.querySelector("[data-q=body]")!.innerHTML = s.standings
      .map(
        (r, i) =>
          `<tr class="${r.isPlayer ? "me" : ""}"><td class="pos">${i + 1}</td><td><span class="dot" style="background:${r.color}"></span>${esc(r.name)}</td><td class="num">${r.kills}</td><td class="num dim">${r.deaths}</td></tr>`,
      )
      .join("");
  }
}
