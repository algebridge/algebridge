import type { Pose } from "@/lib/gait";

/**
 * The court rig: the joints of a teammate's drawing (see Players.tsx), found
 * once, and a running pose written straight onto them from the game loop.
 * Shared by the courts and by the rink, where a teammate joins Veronica in a
 * two-player match.
 */

/** The joints the game loop poses while a player moves, found once per drawing. */
export interface Joints {
  svg: SVGSVGElement;
  flip: SVGElement | null;
  all: SVGElement | null;
  legF: SVGElement | null;
  legB: SVGElement | null;
  shinF: SVGElement | null;
  shinB: SVGElement | null;
  armF: SVGElement | null;
  armB: SVGElement | null;
  foreF: SVGElement | null;
  foreB: SVGElement | null;
  bodies: SVGElement[];
}

export function jointsOf(svg: SVGSVGElement): Joints {
  const q = (sel: string) => svg.querySelector<SVGElement>(sel);
  return {
    svg,
    flip: q(".p-flip"),
    all: q(".p-all"),
    legF: q(".p-leg-front"),
    legB: q(".p-leg-back"),
    shinF: q(".p-shin-front"),
    shinB: q(".p-shin-back"),
    armF: q(".p-arm-front"),
    armB: q(".p-arm-back"),
    foreF: q(".p-fore-front"),
    foreB: q(".p-fore-back"),
    bodies: [...svg.querySelectorAll<SVGElement>(".p-body, .p-skirt")],
  };
}

/**
 * Writes a running pose onto the joints, or hands them back to the CSS
 * stance (which they ease into) when `pose` is null. The facing turns
 * through `fx` either way, so a turn reads as a turn rather than a snap.
 */
export function writePose(j: Joints, pose: Pose | null, fx: number): void {
  if (j.flip) j.flip.style.transform = `scale(${Math.abs(fx) > 0.995 ? Math.sign(fx) : fx.toFixed(3)}, 1)`;
  const parts = [j.all, j.legF, j.legB, j.shinF, j.shinB, j.armF, j.armB, j.foreF, j.foreB, ...j.bodies];
  if (!pose) {
    if (j.svg.classList.contains("player-gait")) {
      j.svg.classList.remove("player-gait");
      for (const el of parts) if (el) el.style.transform = "";
    }
    return;
  }
  j.svg.classList.add("player-gait");
  const set = (el: SVGElement | null, t: string) => {
    if (el) el.style.transform = t;
  };
  set(j.all, `translateY(${pose.bob}px)`);
  set(j.legF, `rotate(${pose.thighF}deg) scale(1, ${pose.liftF})`);
  set(j.legB, `rotate(${pose.thighB}deg) scale(1, ${pose.liftB})`);
  set(j.shinF, `rotate(${pose.shinF}deg)`);
  set(j.shinB, `rotate(${pose.shinB}deg)`);
  set(j.armF, `rotate(${pose.armF}deg)`);
  set(j.armB, `rotate(${pose.armB}deg)`);
  set(j.foreF, `rotate(${pose.foreF}deg)`);
  set(j.foreB, `rotate(${pose.foreB}deg)`);
  for (const b of j.bodies) b.style.transform = `rotate(${pose.body}deg)`;
}
