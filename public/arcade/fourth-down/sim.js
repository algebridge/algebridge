// Fourth Down: the other team's drive, played down by down with real rules, all in one call.
// The player never waits through it: the game shows a few seconds of it and one line of result.
// pos is the offense's own yard line (1 to 99, 100 is the goal line they attack).
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function simDrive(o) {
  const R = o.rnd || Math.random, r = clamp(o.rating, -0.3, 1.3), qlen = o.qlen;
  let pos = o.pos, clock = o.clock, quarter = o.quarter;
  const start = pos;
  let down = 1, togo = Math.min(10, 100 - pos), plays = 0, qx = 0, firsts = 0;
  const out = (result, x = {}) => ({ result, plays, firsts, yards: pos - start, pos, clock: Math.max(0, clock), quarter, qx, pts: 0, ...x });
  // Quarters 1 and 3 roll over in the middle of a drive. Quarters 2, 4 and overtime end it.
  const tick = (s) => { clock -= s; if (clock <= 0 && (quarter === 1 || quarter === 3)) { quarter++; qx++; clock = qlen; } return clock <= 0; };
  const iR = 0.024 - 0.008 * r, sackR = 0.05 - 0.02 * r;
  for (;;) {
    if (down === 4) {
      const dist = 100 - pos + 17;
      if (dist <= 52 && !(o.mustGo && o.need > 3)) {
        plays++; tick(2);
        const p = dist < 30 ? 0.97 : dist < 40 ? 0.88 : dist < 47 ? 0.74 : 0.55;
        return R() < p ? out("fg", { pts: 3, dist }) : out("fgMiss", { dist, myBall: Math.max(20, 107 - pos) });
      }
      if (!(o.mustGo || (pos >= 55 && togo <= 2))) {
        plays++; tick(2.5);
        const land = pos + 34 + Math.floor(R() * 16);
        if (land >= 100) return out("punt", { touchback: true, myBall: 20, net: 100 - pos });
        const ret = Math.floor(R() * 9);
        return out("punt", { myBall: clamp(100 - land + ret, 1, 99), net: land - pos - ret });
      }
    }
    plays++;
    const p = R();
    let gain = 0, stop = false;
    if (p < sackR) gain = -(4 + Math.floor(R() * 5));
    else if (p < sackR + iR) {
      const spot = pos + 6 + Math.floor(R() * 18);
      tick(2);
      if (spot >= 100) return out("int", { touchback: true, myBall: 20 });
      return out("int", { myBall: clamp(100 - spot + Math.floor(R() * 10), 1, 99) });
    } else if (p < sackR + iR + 0.012) {
      pos = clamp(pos + Math.floor(R() * 6), 1, 99); tick(3);
      return out("fumble", { myBall: 100 - pos });
    } else if (p < 0.5) {
      gain = Math.round((R() + R()) * (5.2 + 1.6 * r) - 1.2);
      if (R() < 0.07) gain += 8 + Math.floor(R() * 28);
    } else if (R() < 0.62 + 0.12 * r) {
      gain = 4 + Math.floor(R() * R() * 30 * (0.8 + 0.4 * r));
      stop = R() < 0.15;
    } else stop = true;
    pos += gain;
    if (pos >= 100) { pos = 100; tick(3); const xp = R() < 0.94; return out("td", { pts: xp ? 7 : 6, xp }); }
    if (pos <= 0) { pos = 0; tick(3); return out("safety"); }
    if (tick(stop ? 1.5 : 4.2)) return out("clock");
    togo -= gain;
    if (togo <= 0) { down = 1; firsts++; togo = Math.min(10, 100 - pos); }
    else if (++down > 4) return out("downs", { myBall: clamp(100 - pos, 1, 99) });
  }
}
