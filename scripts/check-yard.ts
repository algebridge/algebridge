/**
 * Checks the yard camera.
 *
 *   npm run check:yard
 *
 * The numbers in src/lib/yard-camera.ts are copies of the ones in
 * scripts/gen-turntable.ts, and nothing at runtime notices if they drift
 * apart — decorations just quietly land in the wrong place. These assertions
 * are what catch that.
 *
 * The load-bearing one is the centre check: the pad has to project to dead
 * centre at EVERY angle, because that is what makes a drag read as turning
 * one object rather than cutting between photographs.
 */
import { project, unproject, onPad, TURNTABLE_FRAMES } from "../src/lib/yard-camera.ts";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) { fails++; console.log("FAIL", name, detail); }
};

// 1 — project then unproject must return the same world point, at every angle.
for (let f = 0; f < TURNTABLE_FRAMES; f++) {
  for (const p of [{x:0,z:0},{x:3,z:-2},{x:-4.5,z:1.5},{x:1,z:5},{x:-2,z:-5}]) {
    const at = project(p, f);
    if (!at.visible) continue;
    const back = unproject(at.left, at.top, f);
    check(`roundtrip f=${f} (${p.x},${p.z})`,
      !!back && Math.abs(back.x - p.x) < 0.02 && Math.abs(back.z - p.z) < 0.02,
      back ? `got (${back.x.toFixed(2)},${back.z.toFixed(2)})` : "null");
  }
}

// 2 — the pad centre must sit dead centre horizontally in every frame, or the
//     house would appear to drift as the view spins.
for (let f = 0; f < TURNTABLE_FRAMES; f++) {
  const at = project({ x: 0, z: 0 }, f);
  check(`centre f=${f}`, Math.abs(at.left - 50) < 0.001, `left=${at.left}`);
  check(`scale f=${f}`, Math.abs(at.scale - 1) < 0.001, `scale=${at.scale}`);
}

// 3 — something nearer the camera must draw larger and later.
{
  const near = project({ x: 0, z: -5 }, 0);
  const far = project({ x: 0, z: 5 }, 0);
  check("near is larger", near.scale > far.scale, `${near.scale} vs ${far.scale}`);
  check("near is closer", near.depth < far.depth);
  check("near is lower on screen", near.top > far.top);
}

// 4 — above the horizon there is no ground.
check("sky unprojects to nothing", unproject(50, 10, 0) === null);

// 5 — the pad limit is enforced.
check("far point is off pad", !onPad({ x: 9, z: 9 }));
check("near point is on pad", onPad({ x: 2, z: 2 }));

// 6 — spinning a full circle returns to the same projection.
{
  const a = project({ x: 2.5, z: -1.5 }, 0);
  const b = project({ x: 2.5, z: -1.5 }, TURNTABLE_FRAMES);
  check("full turn is identity", Math.abs(a.left - b.left) < 0.001 && Math.abs(a.top - b.top) < 0.001);
}

if (fails > 0) {
  console.error(`${fails} yard-camera checks FAILED`);
  process.exit(1);
}
console.log("yard camera: all checks pass");
