// The levels. Each is one gag built from the parts kit in sim.js. B is the builder; the cursor starts at (0, 0) with the buggy on it.
// v: vehicle, th: theme, hint: one short line drawn in the world until the level is first beaten, bv: the test driver's top speed.
const TAU = Math.PI * 2;
const cyc = (L, per, ph = 0) => (((L.pt / per + ph) % 1) + 1) % 1;
/** A swinging hammer at the cursor, plus a stop for the test driver, which waits until its own run-up clears the swing. */
const ham = (B, o) => {
  const px = B.x, per = o.per, ph = o.ph || 0, amp = o.amp || 1.1, len = o.len || 5.2, py = o.py || 6.2, r = o.r || 0.9;
  const ok = (L) => {
    const c = L.car.chassis, acc = L.car.sp.acc * (L.car.key === "mini" ? 0.68 : 0.85), vm = L.car.sp.maxV;
    for (let t = 0; t < 2.6; t += 0.04) {
      const tv = vm / acc, x = c.x + (t < tv ? 0.5 * acc * t * t : 0.5 * acc * tv * tv + vm * (t - tv));
      const a = amp * Math.sin((TAU * (L.pt + t)) / per + ph), hx = px + len * Math.sin(a), hb = py - len * Math.cos(a) - r;
      if (hb < 1.7 && Math.abs(x - hx) < r + L.car.sp.hull[1][0] + 0.5) return false;
      if (x > px + 8) break;
    }
    return true;
  };
  return B.bot(-13, -9, { v: 3 }).bot(-9, -7.5, { wait: ok }).hammer(0, py, len, { per, ph, amp, r });
};
/** A ferry: a platform that carries the buggy up across a pit. Drive on, stop, ride, drive off. Driving straight through drops you in. */
const ferry = (B, gap = 10, dy = 3, per = 7, w = 6) => {
  B.bot(-18, -6.5, { v: 3 }).bot(-6.5, -1.4, { v: 6, wait: (L) => cyc(L, per) > 0.93 || cyc(L, per) < 0.02 });
  B.lift(w / 2 + 0.1, -0.18, w, gap - w - 0.2, dy, per);
  const lift = B.L.movers[B.L.movers.length - 1].b;
  B.bot(-1.4, 1.6, { v: 4.5 }).bot(1.6, gap + 0.4, { on: lift, wait: (L) => { const u = cyc(L, per); return u > 0.5 && u < 0.6; } });
  return B.gap(gap, dy);
};
/** A hole in the road and a boulder up the hill that rolls down to fill it. Wait for it, then drive over. */
const trap = (B, up = 2.2) => {
  const x0 = B.x, y0 = B.y, r = 1.6;
  B.bot(-18, -5.5, { v: 2.5 }).bot(-5.5, -0.4, { v: 6, wait: (L) => L.world.bodies.some((q) => q.tag === "boulder" && !q.hold && Math.abs(q.x - x0 - 1.72) < 0.5 && q.y < y0 - 0.9 && q.vx * q.vx + q.vy * q.vy < 0.2) });
  B.to(0.1, -2.9).flat(3.25).to(0.1, 2.9).flat(2).ease(8, up).flat(4);
  return B.boulder(-2, 0, r, x0 - 7 - B.x, -4).flat(4);
};
/** A hole in the road and a boulder hanging over it. It drops when you come close: stop short, let it plug the hole, drive over. */
const drop = (B, h = 8) => {
  const x0 = B.x, y0 = B.y, r = 1.6;
  B.bot(-18, -6, { v: 2.5 }).bot(-6, -0.4, { v: 6, wait: (L) => L.world.bodies.some((q) => q.tag === "boulder" && !q.hold && Math.abs(q.x - x0 - 1.72) < 0.5 && q.y < y0 - 0.9 && q.vx * q.vx + q.vy * q.vy < 1) });
  B.to(0.1, -2.9).flat(1.625);
  B.L.pivots.push({ x: B.x, y: y0 + h + 2 * r + 0.45, h: 0, post: true });
  return B.boulder(0, h + 2.9, r, x0 - 7.5 - B.x, 0).flat(1.625).to(0.1, 2.9);
};
const seesawDy = (len, tilt) => (len / 2) * Math.sin(tilt) + 0.16;

export const LEVELS = [
  // 1 to 6: learn to drive and balance
  { n: "Hold the gas", th: 0, hint: "Hold to drive", f: (B) => B.flat(14).coins(-10, 1, -2, 1, 5).hump(10, 1.2).flat(8).coins(-6, 1, 0, 1, 4).finish() },
  { n: "Bumpy road", th: 0, f: (B) => B.flat(8).hump(10, 0.6).hump(10, 0.7).coins(-14, 1.7, -6, 1.7, 5).hump(12, 0.9).flat(4).hump(12, 1.0).coins(-8, 2, -4, 2, 3).finish() },
  { n: "First jump", th: 0, hint: "Left tips the nose down", f: (B) => B.flat(12).kick(7, 1.0).to(0.5, -1.0).coins(1, 1.6, 8, 0.8, 6, 0.6).flat(20).finish() },
  { n: "See-saw", th: 0, f: (B) => B.flat(8).seesaw(6, seesawDy(10, 0.24), 10, 0.24).coins(1.5, 1.2, 10.5, 1.2, 5, 1.2).flat(22).finish() },
  { n: "Crate wall", th: 0, f: (B) => B.flat(16).crates(-5, 2, 4).coins(-12, 1, -6.5, 1, 4).flat(10).crates(-4, 1, 6).finish() },
  { n: "Tiny car, big hills", v: "mini", th: 0, bv: 9, f: (B) => B.flat(6).ease(9, 3).flat(2).ease(9, -3).coins(-11, 4, -9, 4, 3).flat(4).ease(7, 2.4).ease(7, -2.4).flat(3).hump(8, 1.6).flat(6).ease(5, 1.9).flat(1).ease(5, -1.9).flat(7).finish() },
  // 7 to 12
  { n: "Pick the ramp", th: 0, hint: "Tap the ramp that fits", f: (B) => { B.flat(18).math({ B: [4, 2], opts: [[0.5, 0], [3, 0], [-1, 0]] }).flat(10); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Wobbly bridge", th: 1, f: (B) => { B.flat(10).bridge(13, 11).coins(-11, 1, -2, 1, 6, -0.5).flat(8); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Trampoline", th: 1, bv: 7, f: (B) => { B.flat(10).tramp(3.5, 15).coins(-1.5, 2, 3.5, 5.5, 5).to(1.5, 0).to(0.4, 4).flat(12); B.flat(18); ferry(B, 12, 4, 9).flat(8); return B.finish(); } },
  { n: "Flat or steep", th: 1, f: (B) => { B.flat(18).math({ A: [0, 1], B: [4, 1], opts: [[0, 1], [1, 1], [-1, 1]], order: [0, 2, 1] }).flat(10); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "The long bus", v: "bus", th: 1, f: (B) => { B.flat(10).hump(7, 1.3).flat(5).hump(5, 1.0).flat(4).ease(8, 2.5).flat(3).ease(8, -2.5); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Hammer time", th: 1, f: (B) => { B.flat(14); ham(B, { per: 3.4 }).flat(18).coins(-12, 1, -7, 1, 4); ham(B, { per: 3, ph: 1 }).flat(10); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  // 13 to 18
  { n: "Downhill line", th: 1, f: (B) => { B.flat(18).math({ A: [0, 3], B: [3, 0], opts: [[-1, 3], [1, 3], [-3, 3]], order: [2, 1, 0] }).flat(12); B.flat(18); trap(B, 2.2).flat(4); return B.finish(); } },
  { n: "Monster truck", v: "monster", th: 1, f: (B) => { B.flat(14).crates(-7, 2, 3, 1.5, 0.07).flat(24); ferry(B, 12, 4, 6).flat(8); return B.finish(); } },
  { n: "Log pit", th: 2, bv: 9, f: (B) => { B.flat(10).to(0.2, -2.02).flat(6.2).logs(-6.15, 0, 12, 0.5, 6).to(0.2, 2.02).coins(-6, 1.2, -1, 1.2, 4).flat(8); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "How steep", th: 2, f: (B) => { B.flat(18).math({ B: [4, 1], opts: [[0.25, 0], [1, 0], [0.5, 0]], order: [1, 2, 0] }).flat(10); B.flat(18); trap(B, 2.2).flat(4); return B.finish(); } },
  { n: "Going up", th: 2, f: (B) => { B.flat(18); ferry(B, 11, 3.5, 6).flat(12).coins(-9, 1, -3, 1, 4); return B.finish(); } },
  { n: "Ice valley", th: 2, f: (B) => { B.flat(8).ice().ease(12, -3.5).flat(5).coins(-5, 1, 0, 1, 4).ease(12, 2.6).ice(false).flat(8); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  // 19 to 24
  { n: "Mind the start", th: 2, f: (B) => { B.flat(18).math({ A: [0, 1], B: [4, 3], opts: [[0.5, 1], [0.5, 0], [2, 1]], order: [1, 0, 2] }).flat(10); B.flat(18); ferry(B, 12, 4, 9).flat(8); return B.finish(); } },
  { n: "Big wheel", v: "penny", th: 2, f: (B) => B.flat(8).hump(4, 0.7).hump(4, 0.7).hump(4, 0.7).flat(8).crates(-4, 2, 2).ease(8, 2).flat(5).flat(6).ease(6, 2.2).flat(1).ease(6, -2.2).flat(7).finish() },
  { n: "Boulder run", th: 2, f: (B) => { B.boulder(-6.5, 0, 1.6, 2.5, 6).flat(6).ease(30, -7).coins(-26, 1, -4, 1, 8).hump(8, 0.8).ease(22, -5).flat(4).kick(6, 2).gap(7, -1).flat(6); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Third of a slope", th: 3, f: (B) => { B.flat(18).math({ B: [3, -1], unit: 2.4, opts: [[-1 / 3, 0], [1 / 3, 0], [-3, 0]], order: [1, 2, 0] }).flat(10); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Loop the loop", v: "rocket", th: 3, f: (B) => { B.flat(26).coins(-20, 1, -4, 1, 6).loop(4.2).flat(22).bot(0, 30, { v: 6 }).flat(30); ferry(B, 15, 4, 7, 9).flat(8); return B.finish(); } },
  { n: "The big gear", th: 3, f: (B) => { B.flat(10).spinner(3.2, -8.02, 8, -0.9).gap(6.4).flat(8); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  // 25 to 30
  { n: "Half a ghost", th: 3, f: (B) => { B.flat(18).math({ A: [0, 2], B: [4, 0], ghost: "stub", opts: [[-0.5, 2], [-0.5, 1], [-2, 2]], order: [2, 0, 1] }).flat(10); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Bus on a see-saw", v: "bus", th: 3, f: (B) => { B.flat(9).seesaw(8, seesawDy(14, 0.2), 14, 0.2, { d: 0.7 }).flat(28); B.flat(18); trap(B, 2.2).flat(4); return B.finish(); } },
  { n: "Bounce stairs", th: 3, bv: 7, f: (B) => { B.flat(8).tramp(3.5, 13.5).to(1.2, 0).to(0.4, 3).flat(2).tramp(4, 13.5).to(0.5, 0).to(0.4, 2).flat(14); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Below zero", th: 3, f: (B) => { B.flat(18).math({ A: [0, -1], B: [4, 1], ghost: "stub", opts: [[0.5, -1], [0.5, 1], [-0.5, -1]], order: [0, 1, 2] }).flat(10); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Falling planks", th: 0, f: (B) => { B.flat(10).drops(6).coins(-12, 1, -2, 1, 6).flat(8); B.flat(18); ferry(B, 12, 4, 9).flat(8); return B.finish(); } },
  { n: "Fill the hole", th: 0, bv: 6, f: (B) => B.flat(12).ball(-5, 0, 1.6, 0.3).to(0.1, -2.9).flat(3.25).to(0.1, 2.9).flat(10).finish() },
  // 31 to 36
  { n: "Easy down", th: 0, f: (B) => { B.flat(18).math({ B: [4, -2], ghost: "stub", opts: [[-0.5, 0], [-2, 0], [0.5, 0]], order: [1, 0, 2] }).flat(10); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Mini and the hammers", v: "mini", th: 0, f: (B) => { B.flat(14); for (const [per, ph] of [[3, 0], [2.8, 2], [2.6, 4]]) ham(B, { per, ph, r: 0.8 }).flat(15); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Monster stairs", v: "monster", th: 1, bv: 9, f: (B) => { B.flat(8); for (let i = 0; i < 5; i++) B.to(0.8, 0.8).flat(4.5); return B.coins(-4, 1.5, 6, -2, 5, 1).ease(10, -4).flat(8).kick(7, 2).to(0.5, -2).coins(1, 2.8, 6, 1, 4, 0.8).flat(12).finish(); } },
  { n: "No ghosts", th: 1, f: (B) => { B.flat(18).math({ A: [0, 1], B: [4, 3], ghost: "none", opts: [[0.5, 1], [2, 1], [0.5, 3]], order: [2, 1, 0] }).flat(10); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Crates on ice", th: 2, f: (B) => { B.flat(6).ice().flat(8).crates(-3, 2, 3).flat(10).crates(-4, 3, 2).hump(8, 1).flat(6).ice(false); B.flat(34); ferry(B, 12, 4, 9).flat(8); return B.finish(); } },
  { n: "Rocket jump", v: "rocket", th: 1, f: (B) => B.flat(30).kick(10, 3.6).coins(2, 2.5, 22, 0, 9, 3).gap(24, -3).land(10, -2).flat(14).bot(0, 14, { v: 6 }).flat(8).tramp(3.5, 13.5).to(1.2, 0).to(0.4, 3).flat(10).finish() },
  // 37 to 42
  { n: "Two thirds", th: 2, f: (B) => { B.flat(18).math({ A: [0, 3], B: [3, 1], unit: 2.4, ghost: "none", opts: [[-2 / 3, 3], [2 / 3, 3], [-3 / 2, 3]], order: [1, 2, 0] }).flat(10); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Swing planks", th: 3, f: (B) => { B.flat(8).gondola(3, -0.14, 5.2).gondola(9, -0.14, 5.2).coins(1, 1, 11, 1, 6).gap(12).flat(8); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Bus on the bridge", v: "bus", th: 3, f: (B) => { B.flat(10).bridge(16, 12, { d: 1.2 }).flat(6).hump(7, 1.2); B.flat(18); ferry(B, 12, 4, 9).flat(8); return B.finish(); } },
  { n: "Two in a row", th: 3, f: (B) => { B.flat(18).math({ B: [4, 2], ghost: "none", opts: [[0.5, 0], [2, 0], [0.25, 0]], order: [2, 0, 1] }).flat(20).math({ A: [0, 2], B: [4, 0], ghost: "none", opts: [[-0.5, 2], [0.5, 2], [-0.5, 0]], order: [0, 2, 1] }).flat(10); B.flat(18); drop(B, 6).flat(6); return B.finish(); } },
  { n: "Rock and roll", th: 3, f: (B) => { B.boulder(-7, 0, 1.9, 2.5, 6).flat(6).ease(24, -6).coins(-20, 1, -4, 1, 6).flat(4).bridge(10, 8, { d: 1.2 }).ease(20, -5).flat(8); B.flat(8).kick(6, 1.8).coins(1, 1.6, 7, 0.6, 4, 1).gap(6, -0.6).flat(20); drop(B, 6).flat(6); return B.finish(); } },
  { n: "The grand tour", th: 0, bv: 12, f: (B) => B.flat(10).hump(8, 1).flat(12).seesaw(6, seesawDy(10, 0.24), 10, 0.24).flat(20).crates(-4, 2, 3).flat(6).bridge(10, 8).flat(16).math({ B: [4, 2], ghost: "stub", opts: [[0.5, 0], [-0.5, 0], [2, 0]], order: [2, 1, 0] }).flat(14).kick(8, 1.6).coins(1, 1.5, 7, 0, 5, 1).gap(6, -1.5).flat(10).flat(6).ease(8, 3.2).flat(1).ease(8, -3.2).flat(7).finish() },
  // 43 to 48: the hard ones
  { n: "Rock drop", th: 1, f: (B) => { B.flat(10).hump(8, 1).flat(20); drop(B, 6).flat(10).kick(7, 2.2).coins(1, 1.6, 8, 0.6, 5, 1).gap(7, -1).flat(22); drop(B, 5).flat(6); return B.finish(); } },
  { n: "Hammer ferry", th: 2, f: (B) => { B.flat(14); ham(B, { per: 3.2 }).flat(24); ferry(B, 11, 3.5, 6).flat(18); ham(B, { per: 3, ph: 2 }).flat(10); return B.finish(); } },
  { n: "Three steps", th: 3, f: (B) => { B.flat(18).math({ B: [4, -1], ghost: "none", opts: [[-0.25, 0], [0.25, 0], [-4, 0]], order: [1, 0, 2] }).flat(22); trap(B, 2.2).flat(14).math({ A: [0, -1], B: [3, 1], unit: 2.4, ghost: "none", opts: [[2 / 3, -1], [3 / 2, -1], [2 / 3, 1]], order: [2, 0, 1] }).flat(10); return B.finish(); } },
  { n: "Bus stop", v: "bus", th: 0, f: (B) => { B.flat(12).hump(7, 1.2).flat(22); drop(B, 6).flat(8).bridge(14, 11, { d: 1.2 }).flat(24); ferry(B, 12, 4, 6).flat(8); return B.finish(); } },
  { n: "Slippery rocks", th: 2, f: (B) => { B.flat(10).ice().flat(6).ease(10, -3).flat(6).ice(false).flat(20); drop(B, 6).flat(10).kick(7, 2.4).coins(1, 1.6, 9, 0.6, 5, 1).gap(8, -1.4).flat(24); trap(B, 2.2).flat(4); return B.finish(); } },
  { n: "The long way home", th: 3, bv: 12, f: (B) => { B.flat(10).seesaw(6, seesawDy(10, 0.24), 10, 0.24).flat(36); drop(B, 6).flat(16).math({ B: [4, 2], ghost: "none", opts: [[0.5, 0], [2, 0], [-0.5, 0]], order: [1, 2, 0] }).flat(28); ferry(B, 12, 4, 6).flat(20); ham(B, { per: 3.1, ph: 1 }).flat(12).kick(8, 1.6).coins(1, 1.5, 7, 0, 5, 1).gap(6, -1.5).flat(10); return B.finish(); } },
];
/** Seconds the test driver needs per level (from the level checker). Star times are set from these. */
export const BOT_T = [3.47, 5.17, 3.78, 3.98, 3.23, 9.65, 8.93, 10.58, 16.15, 8.02, 11.23, 16.12, 12.62, 11.15, 9.43, 13.03, 11.23, 11.23, 15.43, 16.47, 15.02, 10.75, 12.3, 8.55, 10.62, 15.67, 13.02, 10.82, 15.43, 9.65, 10.62, 15.07, 11.58, 8.93, 16.32, 7.82, 7.88, 9.93, 15.57, 10.08, 12.83, 15.58, 15.3, 12.77, 14.8, 17.05, 20.35, 27.45];
/** Which bodies (as indexes into the vehicle list) the test driver can finish each open-road level with. Levels with their own car are empty. */
export const ALLOW = ["012345","012345","012345","012345","02345","","0234","013","01345","01234","","0134","0124","","01234","0124","01345","01234","0234","","0134","0123","","0123","01234","","01345","01234","01234","02","01234","","","0234","0345","","01234","01234","","01234","0123","0","035","05","01234","","035","01234"];
