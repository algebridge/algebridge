import type { InputSource, InputState } from "../types";

/**
 * WASD or arrows to drive, Space (or the mouse's primary button on the
 * canvas) to fire. Shift fires too, for laptops whose Space scrolls.
 */
export class KeyboardInput implements InputSource {
  private down = new Set<string>();
  private pressedFire = false;
  private mouseFire = false;
  private readonly target: HTMLElement;

  constructor(target: HTMLElement) {
    this.target = target;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    target.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    const k = codeOf(e);
    if (DRIVE_KEYS.has(k)) e.preventDefault();
    if (!this.down.has(k) && (k === "Space" || k === "ShiftLeft" || k === "ShiftRight")) this.pressedFire = true;
    this.down.add(k);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(codeOf(e));
  };

  private onBlur = () => {
    this.down.clear();
    this.mouseFire = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.mouseFire = true;
    this.pressedFire = true;
  };

  private onPointerUp = () => {
    this.mouseFire = false;
  };

  has(code: string): boolean {
    return this.down.has(code);
  }

  read(): InputState {
    const d = this.down;
    let throttle = 0;
    if (d.has("KeyW") || d.has("ArrowUp")) throttle += 1;
    if (d.has("KeyS") || d.has("ArrowDown")) throttle -= 1;
    let steer = 0;
    if (d.has("KeyD") || d.has("ArrowRight")) steer += 1;
    if (d.has("KeyA") || d.has("ArrowLeft")) steer -= 1;
    const fire = d.has("Space") || d.has("ShiftLeft") || d.has("ShiftRight") || this.mouseFire;
    return { throttle, steer, fire, firePressed: this.pressedFire };
  }

  endFrame(): void {
    this.pressedFire = false;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.target.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
  }
}

/** Some synthetic key events carry only e.key; map those back to codes. */
function codeOf(e: KeyboardEvent): string {
  if (e.code) return e.code;
  const k = e.key;
  if (k === " ") return "Space";
  if (k.length === 1 && /[a-z]/i.test(k)) return `Key${k.toUpperCase()}`;
  return k;
}

const DRIVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

/** Several sources (keys and touch pads) folded into one: the strongest input wins. */
export function mergeInputs(sources: InputSource[]): InputState {
  let throttle = 0;
  let steer = 0;
  let fire = false;
  let firePressed = false;
  for (const s of sources) {
    const i = s.read();
    if (Math.abs(i.throttle) > Math.abs(throttle)) throttle = i.throttle;
    if (Math.abs(i.steer) > Math.abs(steer)) steer = i.steer;
    fire = fire || i.fire;
    firePressed = firePressed || i.firePressed;
  }
  return { throttle: clamp(throttle), steer: clamp(steer), fire, firePressed };
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
