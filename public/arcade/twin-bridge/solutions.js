// Scripted solutions, used only by the test hooks (g.debug.solve) to prove every span can be finished.
// Tokens: a = Archie, b = Amber, l = the first lift. Positions are in tiles.
//   a>5.6  walk right until x passes 5.6      a<3  walk left
//   a^>9   jump and steer right until x passes 9 and the twin has landed
//   a!     use a lever      w0.5  wait      a?y<7.2  wait for a condition (x or y, < or >)
export const SOLUTIONS = [
  "a>5.6 a^>9 a^>12 a^>14.5 a^>18 a>20.5 b>5.6 b^>9 b^>12 b^>14.5 b^>18 b>22.5",
  "a>4 a^>6 a^>9 a>10.6 a^>14 a>15.6 a^>18.5 a>21.5 b>4 b^>6 b>6.6 b^>10 b>11.6 b^>14.5 b>15.6 b^>18 b>21.5",
  "a>7.5 b>14.5 a>15.6 a^>18.5 a>19.5 b>15.6 b^>18.5 b>21.5",
  "b>9.6 a>8.2 a^>9.6 a^>12.5 a! b?y<7.05 b>14 a>18.5 b>20.5",
  "a>5.5 b>10.3 b^>13.5 w0.6 a>15.6 a^>18.5 a>21.5 b>15.6 b^>18.5 b>23.5",
  "a>8.7 a^<6.5 a>6.7 a^<3.5 b>9.3 b^>12.5 w0.6 a>21.5 b>23.5",
  "a>5 a^>6.5 b>4.6 b^>7.6 b>8.3 b^>10.3 b^>12.6 b^>16.5 w0.6 a>8.3 a^>10.3 a^>12.6 a^>15.4 a^>17.5 a>21.5 b>23.5",
  "a>9.7 a^>12 b>8.3 b^>12 b>18.3 a>16.5 a! a>17.6 a?y<6.05 a>20.5 b>22.5",
  "b>4.7 b^<1.5 a>12 a^>13.5 w0.6 a>21.5 b>11.6 b^>14.6 b>23.5",
  "a>9.5 b>8.7 l?y<9 l?y>9.95 a>10.6 b>11.4 a?y<6.05 a<7.5 b>14.5 w0.6 l?y>7 l?y<6.02 a>21.5 b>23.5",
  "b>8.3 a>6.9 a^>8.3 a^>10 a>16.5 b<5.5 w0.6 a>21.5 b>23.5",
  "a>5.6 a^>8.5 b>5.6 b^>9 b>10 b^>11.5 w0.6 a>9.8 a^>12.8 a>18.5 b>21.3 b^>24.5 w0.6 a>29.5 b>31.5",
  "a<9.4 a^<7.5 a>12.7 b>18.6 b^>20.6 b<15.8 w1.8 a^>16.5 a>29.5 b>21.3 b^>23.6 b>31.5",
  "b>17.3 a>15.9 a^>17.3 a^>19 b>19 a>20.4 a^>23.2 a<18.2 w0.8 b>19.4 b^>21.8 b<15.6 w1.8 a>29.5 b>31.5",
  "a<9.4 a^<7.5 a>14.2 a<5.5 a^<3.5 a>12.7 b>18.5 b^>20.6 b<17 w1.8 a^>13.6 a>29.5 b>21.3 b^>23.6 b>31.5",
  "a>6.7 a^<3.5 b>5.5 w0.6 a>15.6 a^>18.5 b>15.6 b^>18.5 b>20.3 a>18.9 a^>20.3 a^>22.5 b>21.5 w0.6 a>29.5 b>31.5",
  "a>8.7 a^<6.5 a>6.7 a^<3.5 b>9.3 b^>12.5 b<12.3 b^>15.5 w0.6 a>21.5 b>23.5",
  "a>9.5 b>8.7 l?y<9 l?y>9.95 a>10.6 b>11.4 a?y<6.05 a<7.5 b>14.5 w0.6 l?y>7 l?y<6.02 a>21.5 b>23.5",
  "a>7 a^>8.5 b>5.3 w0.6 a>11.3 a^>14.5 b>7 b^>9.5 b>17.3 w0.6 b>22.3 b^>25.5 a>24.3 w0.6 a>29.5 b>31.5",
  "a<9.4 a^<7.5 a>14.2 a<5.5 a^<3.5 a>12.7 b>18.5 b^>20.6 b<17 w1.8 a^>13.6 a>29.5 b>21.3 b^>23.6 b>31.5",
  "b>8.3 a>6.9 a^>8.3 a^>10 a>14.3 b<5.5 w0.6 a>21.5 b>23.5",
  "a>7 a^>8.5 b>7.3 w0.6 a>12.6 a^>15.5 b^>9.5 b>12.3 w0.6 b>12.6 b^>15.5 b>22.3 b^>25.5 a>24.3 w0.6 a>29.5 b>31.5",
  "a>9.7 a^>12 b>8.3 b^>12 b>18.3 a>16.5 a! a>17.6 a?y<6.05 a>20.3 b>22.3 w0.6 a>29.5 b>31.5",
  "b>9.6 a>8.2 a^>9.6 a^>12.5 a! b?y<7.05 b>16.3 a>14.3 w0.6 a>25.3 b>27.3 w0.6 a>29.5 b>31.5",
];

const KEYS = [{ l: "KeyA", r: "KeyD", j: "KeyW", u: "KeyS" }, { l: "ArrowLeft", r: "ArrowRight", j: "ArrowUp", u: "ArrowDown" }];
const T = 40;

export function solve(g, n, script = SOLUTIONS[n - 1]) {
  const d = g.debug;
  d.set2p(true);
  d.goto(n);
  const step = () => g.advance(1 / 60);
  const all = ["KeyA", "KeyD", "KeyW", "KeyS", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  const toks = script.trim().split(/\s+/);
  const fail = (i, why) => { all.forEach((k) => g.keys.release(k)); return { n, ok: false, at: i, tok: toks[i], why, info: d.info }; };
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok[0] === "w") { for (let f = Math.round(parseFloat(tok.slice(1)) * 60); f > 0; f--) step(); continue; }
    const who = tok[0], rest = tok.slice(1);
    const ent = () => (who === "l" ? d.L.lifts[0] : d.P[who === "a" ? 0 : 1]);
    const K = KEYS[who === "b" ? 1 : 0];
    let m;
    if (rest === "!") { g.keys.press(K.u); step(); g.keys.release(K.u); step(); continue; }
    if ((m = rest.match(/^\?([xy])([<>])([\d.]+)$/))) {
      const v = parseFloat(m[3]) * T;
      let f = 0;
      for (; f < 900; f++) { const q = ent()[m[1]]; if (m[2] === "<" ? q < v : q > v) break; step(); }
      if (f >= 900) return fail(i, "timeout");
      continue;
    }
    if ((m = rest.match(/^(\^?)([<>])([\d.]+)$/))) {
      const jump = !!m[1], right = m[2] === ">", target = parseFloat(m[3]) * T, dir = right ? K.r : K.l;
      g.keys.press(dir);
      if (jump) g.keys.press(K.j);
      let f = 0, there = false;
      for (; f < 480; f++) {
        step();
        const p = ent();
        if (p.dead > 0) return fail(i, "fell in the water");
        if (!there && (right ? p.x >= target : p.x <= target)) { there = true; g.keys.release(dir); }
        if (there && (!jump || (f > 6 && p.grounded))) break;
      }
      g.keys.release(dir); g.keys.release(K.j);
      if (f >= 480) return fail(i, "timeout");
      for (let s = 0; s < 6; s++) step();
      continue;
    }
    return fail(i, "bad token");
  }
  for (let f = 0; f < 60 && d.info.phase !== "won"; f++) step();
  const info = d.info;
  return info.phase === "won" ? { n, ok: true, time: info.time, falls: info.falls } : fail(toks.length - 1, "not finished");
}
