// The slack check: a stage is fair only if its solution still wins when every jump press comes 3 frames late and
// when it comes 3 frames early (about a twentieth of a second each way). Movement keys stay as they are.
// Run: node public/arcade/sneaky-floors/slack.mjs      lists any stage that fails
import { compile, newSim, step } from "./sim.js";
export const SLACK = 3, PAD = 45, MACRO = 5;
// shift > 0: jumps late. shift < 0: jumps early. After the script ends, the last direction is held for PAD frames.
export function slackRun(c, attempt, keys, shift) {
  const d = [], j = [];
  for (const ch of keys) for (let f = 0; f < MACRO; f++) { d.push(ch === "r" || ch === "R" ? 1 : ch === "l" || ch === "L" ? -1 : 0); j.push(ch < "a"); }
  const s = newSim(c, attempt), n = d.length;
  for (let f = 0; f < n + PAD && !s.won && !s.dead; f++) { const k = f - shift; step(s, d[Math.min(f, n - 1)], k >= 0 && k < n ? j[k] : false); }
  return !!s.won;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const { STAGES, ROOMS } = await import("./stages.js"), { SOLUTIONS } = await import("./solutions.js");
  const bad = [];
  STAGES.forEach((st, i) => {
    const sol = SOLUTIONS[i], c = compile(st, ROOMS), name = `${Math.floor(i / 5) + 1}-${(i % 5) + 1}`;
    if (!sol) return bad.push(name + ":unsolved");
    const on = slackRun(c, sol.try, sol.keys, 0), late = slackRun(c, sol.try, sol.keys, SLACK), early = slackRun(c, sol.try, sol.keys, -SLACK);
    if (!on || !late || !early) bad.push(name + ":" + (on ? "" : "plain ") + (late ? "" : "late ") + (early ? "" : "early"));
  });
  console.log(`slack (jumps ${SLACK} frames late and ${SLACK} early): ${STAGES.length - bad.length}/${STAGES.length} stages pass`, bad.length ? "| fail: " + bad.join(" ") : "");
  process.exit(bad.length ? 1 : 0);
}
