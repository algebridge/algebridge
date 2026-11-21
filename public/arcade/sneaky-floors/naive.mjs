// A first-time player who trusts the board: holds right, jumps visible gaps, spikes and walls, steps only
// on numbers the rule holds. Reports which stages catch that player on the first try (the trolls landing).
// Run: node public/arcade/sneaky-floors/naive.mjs
import { compile, newSim, step, T, PW, PH } from "./sim.js";
import { STAGES, ROOMS } from "./stages.js";
const caught = [], idle = [];
STAGES.forEach((st, i) => {
  const c = compile(st, ROOMS), s = newSim(c, 0), name = `${Math.floor(i / 5) + 1}-${(i % 5) + 1}`;
  const solidAt = (x, y) => c.rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ||
    s.objs.some((o) => o.k === "b" && !o.hidden && !o.falling && !(o.fake && o.seen) && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && !(o.n != null && s.rule && !s.rule.test(o.n)));
  const spikeAt = (x, y) => s.objs.some((o) => o.k === "s" && !o.hidden && x >= o.x && x < o.x + o.w && y >= o.y - 4 && y < o.y + o.h + 4);
  let f = 0;
  for (; f < 60 * 25 && !s.dead && !s.won; f++) {
    const p = s.p, feet = p.g > 0 ? p.y + PH + 3 : p.y - 3, mid = p.y + PH / 2, ahead = p.x + PW + 14;
    const jump = p.ground ? !solidAt(ahead, feet) || solidAt(ahead + 6, mid) || spikeAt(ahead + 16, mid) : p.vy * p.g < 0;
    step(s, 1, jump);
  }
  if (!s.won) caught.push(name + (s.dead ? ":" + s.dead : ":stuck"));
  const q = newSim(c, 0); for (let k = 0; k < 300; k++) step(q, 0, false); if (q.dead) idle.push(name);
});
console.log(`trusting player caught on first try in ${caught.length}/${STAGES.length} stages:`, caught.join(" "));
console.log("idle for 5 s dies in:", idle.join(" ") || "none");
