// Roll On: a scripted player. It looks ahead by running copies of the sim, so it plays by the same rules and inputs as a person.
import { step, clone, target } from "./sim.js";
const TG = { x: 0, y: 0 };

// [dir, jump hold frames (-1 = hop whenever grounded), delay frames]
const ACTS = [
  [1, 0, 0], [1, 6, 0], [1, 26, 0], [1, 26, 4], [1, 26, 8], [1, 26, 16], [1, 26, 28], [1, 26, 40], [1, -1, 0], [1, 6, 12],
  [-1, 0, 0], [-1, 26, 0], [-1, -1, 0], [0, 0, 0], [0, 26, 0],
];
const H = 96, K = 4;
const jumpAt = (a, f, s) => (a[1] < 0 ? (s.b.coy > 0 ? !s.b.jh : s.b.vy < 0) : f >= a[2] && f < a[2] + a[1]);
const dirAt = (a) => a[0];

function score(L, c, s0) {
  if (c.fail) return -1e6;
  target(L, c, TG);
  let v = c.ti * 20000 - Math.abs(c.b.x - TG.x) + TG.bonus - (TG.y == null ? 0 : Math.abs(c.b.y + 17 - TG.y) * 0.8) - (c.hurt - s0.hurt) * 2500 - (c.wrong - s0.wrong) * 600 + c.nstar * 14 + c.stomps * 40;
  if (c.boss) v += (3 - c.boss.hp) * 6000;
  if (c.done) v += 1e6 - c.t * 100;
  if (c.b.y > c._gy0 + 400) v -= 1500; // falling into a pit at the end of the look-ahead
  return v;
}
export function makeBot(L) {
  let cur = 13, f = 0, n = 0;
  return function (s) {
    if (n++ % K === 0) {
      let best = -Infinity, bi = cur, bf = f;
      for (let i = -1; i < ACTS.length; i++) {
        const a = ACTS[i < 0 ? cur : i], f0 = i < 0 ? f : 0, c = clone(s);
        c._gy0 = s.b.y;
        for (let k = 0; k < H && !c.fail && !c.done; k++) step(L, c, dirAt(a, f0 + k), jumpAt(a, f0 + k, c));
        const v = score(L, c, s) + (i < 0 ? 3 : 0);
        if (v > best) { best = v; bi = i < 0 ? cur : i; bf = f0; }
      }
      cur = bi; f = bf;
    }
    const a = ACTS[cur], out = { dir: dirAt(a, f), jump: jumpAt(a, f, s) };
    f++;
    return out;
  };
}
/** Run a level to the end. Returns { done, t, hearts, stars, wrong, hurt }. */
export function runBot(L, s, maxT = 240) {
  const bot = makeBot(L);
  let stuckX = s.b.x, stuckT = 0;
  while (!s.done && !s.fail && s.t < maxT) {
    const a = bot(s); step(L, s, a.dir, a.jump); s.ev.length = 0;
    if (Math.abs(s.b.x - stuckX) > 60) { stuckX = s.b.x; stuckT = s.t; }
    if (s.t - stuckT > 40 && !(s.boss && s.boss.on && s.boss.mode !== "dead")) break;
  }
  return { done: s.done, fail: s.fail, t: +s.t.toFixed(1), x: Math.round(s.b.x / 40), hearts: s.hearts, stars: s.nstar, wrong: s.wrong, hurt: s.hurt };
}
