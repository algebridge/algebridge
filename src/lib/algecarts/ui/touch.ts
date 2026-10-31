import type { InputSource, InputState } from "../engine/types";

/** On-screen pads for phones and tablets: steer on the left, gas, brake and fire on the right. */
export class TouchInput implements InputSource {
  readonly root: HTMLDivElement;
  private readonly held = new Set<string>();
  private pressedFire = false;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "touch hidden";
    this.root.innerHTML = `
      <div class="touch-left">
        <button class="pad" data-k="left" aria-label="Steer left">&#9664;</button>
        <button class="pad" data-k="right" aria-label="Steer right">&#9654;</button>
      </div>
      <div class="touch-right">
        <button class="pad pad-fire" data-k="fire" aria-label="Fire">FIRE</button>
        <button class="pad pad-brake" data-k="brake" aria-label="Brake">BRAKE</button>
        <button class="pad pad-gas" data-k="gas" aria-label="Gas">GAS</button>
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>(".pad").forEach((b) => {
      const k = b.dataset.k!;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        if (!this.held.has(k) && k === "fire") this.pressedFire = true;
        this.held.add(k);
        b.classList.add("down");
      };
      const up = () => {
        this.held.delete(k);
        b.classList.remove("down");
      };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("lostpointercapture", up);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    });
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.held.clear();
  }

  read(): InputState {
    const h = this.held;
    return {
      throttle: (h.has("gas") ? 1 : 0) - (h.has("brake") ? 1 : 0),
      steer: (h.has("right") ? 1 : 0) - (h.has("left") ? 1 : 0),
      fire: h.has("fire"),
      firePressed: this.pressedFire,
    };
  }

  endFrame(): void {
    this.pressedFire = false;
  }

  dispose(): void {
    this.root.remove();
  }
}
