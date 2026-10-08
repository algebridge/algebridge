// The rules of a two-player match (lib/match-rules.ts): who attacks which
// goal, the boxes, the halves of the volleyball court, who shot in, and the
// judges' marks.
//
//   npm run test:match

const M = await import("../match-rules.ts");

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass += 1;
  else {
    fail += 1;
    console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  }
}
/** A repeatable random, so a failure can be run again. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Perspective.
check("persp is 1 at the front", Math.abs(M.persp(765) - 1) < 1e-9);
check("persp shrinks with depth", M.persp(440) < M.persp(612) && M.persp(612) < 1);
check("lineX meets the vanishing point", Math.abs(M.lineX(150, M.VP.y) - M.VP.x) < 1e-9);

// Soccer: opposite goals.
check("blue attacks right, orange left", M.attacking(0) === "right" && M.attacking(1) === "left");
for (const end of ["left", "right"] as const) {
  const y = 610;
  const line = M.goalLineX(end, y);
  const inward = end === "left" ? 1 : -1;
  check(`${end} box just inside the line`, M.inBox(end, line + inward * 20, y));
  check(`${end} box ends`, !M.inBox(end, line + inward * (M.BOX_DEPTH * M.persp(y) + 20), y));
  check(`${end} box is not past the line`, !M.inBox(end, line - inward * 10, y));
  check(`${end} box is not the other end`, !M.inBox(end === "left" ? "right" : "left", line + inward * 20, y));
  const r = seeded(7);
  for (let i = 0; i < 50; i += 1) {
    const t = M.shotTarget(end, r);
    if (t.y < M.GOAL_MOUTH.y0 || t.y > M.GOAL_MOUTH.y1 || (end === "left" ? t.x > M.goalLineX(end, t.y) : t.x < M.goalLineX(end, t.y))) {
      check(`${end} shot goes in the mouth`, false, JSON.stringify(t));
      break;
    }
  }
}
check("kickoff is on the pitch, out of both boxes", M.inTrap(M.PITCH, M.KICKOFF.ball.x, M.KICKOFF.ball.y) && !M.inBox("left", M.KICKOFF.ball.x, M.KICKOFF.ball.y) && !M.inBox("right", M.KICKOFF.ball.x, M.KICKOFF.ball.y));
for (const side of [0, 1] as const) {
  const x = 600 + (side === 0 ? -1 : 1) * M.KICKOFF.gap * M.persp(M.KICKOFF.y);
  check(`side ${side} kicks off on the pitch, out of the boxes`, M.inTrap(M.PITCH, x, M.KICKOFF.y, 20) && !M.inBox("left", x, M.KICKOFF.y) && !M.inBox("right", x, M.KICKOFF.y));
}
{
  const c = M.clampToTrap(M.PITCH, -500, 2000, 20);
  check("clamp lands inside", M.inTrap(M.PITCH, c.x, c.y, 19.99), JSON.stringify(c));
}

// Soccer halves: each side keeps to its own, and shoots from the halfway line.
for (const y of [450, 612, 770]) {
  const a = M.clampToTrap(M.SOCCER_HALF[0], 2000, y, 20);
  const b = M.clampToTrap(M.SOCCER_HALF[1], -2000, y, 20);
  check(`soccer halves stay apart at depth ${y}`, a.x < 600 && b.x > 600 && b.x - a.x >= 39, `${a.x} ${b.x}`);
  check(`left side can shoot from the line at ${y}`, M.inShotZone(0, a.x, y) && !M.inShotZone(1, a.x - 200, y));
  check(`right side can shoot from the line at ${y}`, M.inShotZone(1, b.x, y) && !M.inShotZone(0, b.x + 200, y));
  check(`kickoff spots are out of the shot zone at ${y}`, !M.inShotZone(0, 600 - M.KICKOFF.gap * M.persp(y), y));
}

// Volleyball from the sideline: a side each, the net between, every landing spot on the receiver's side.
for (const y of [M.VCOURT.y0, (M.VCOURT.y0 + M.VCOURT.y1) / 2, M.VCOURT.y1]) {
  const a = M.clampToTrap(M.HALF[0], 2000, y);
  const b = M.clampToTrap(M.HALF[1], -2000, y);
  const net = M.NET.far + ((M.NET.near - M.NET.far) * (y - M.VCOURT.y0)) / (M.VCOURT.y1 - M.VCOURT.y0);
  check(`volleyball halves are either side of the net at ${y}`, a.x < net - 20 && b.x > net + 20, `${a.x} ${net} ${b.x}`);
}
{
  const r = seeded(11);
  let ok = true;
  for (let i = 0; i < 200 && ok; i += 1) {
    const side = (i % 2) as 0 | 1;
    const s = M.spotInTrap(M.HALF[side], { x: side === 0 ? 380 : 820, y: 640 }, r);
    ok = M.inTrap(M.HALF[side], s.x, s.y) && (side === 0 ? s.x < 600 : s.x > 600);
  }
  check("landing spots stay in the receiver's half", ok);
}
check("the net top is above the floor", M.netTop(600) < 600 - 100);

// Wrestling.
const at = (x: number, vx: number) => ({ pos: { x, y: 600 }, vel: { x: vx, y: 0 } });
check("the one moving in shot", M.shooter(at(500, 300), at(560, 0)) === 0 && M.shooter(at(500, 0), at(560, -300)) === 1);
check("backing away is not a shot", M.shooter(at(500, -300), at(560, 0)) === null);
check("a bump standing still is nobody's", M.shooter(at(500, 0), at(560, 0)) === null);

// Judges.
{
  const r = seeded(3);
  let ok = true;
  for (let i = 0; i < 500 && ok; i += 1) {
    const right = i % 2 === 0;
    const c = M.judgeCards({ right, seconds: (i % 30) * 0.7 }, r);
    ok = c.every((v) => (right ? v >= 8.6 && v <= 9.9 : v >= 5.4 && v <= 6.8) && Math.round(v * 10) === v * 10);
    if (!ok) console.log(right, c);
  }
  check("cards stay in their bands, one decimal", ok);
  const mid = () => 0.5;
  check("quicker marks higher", M.cardsTotal(M.judgeCards({ right: true, seconds: 3 }, mid)) > M.cardsTotal(M.judgeCards({ right: true, seconds: 12 }, mid)));
  check("any right beats any wrong", M.cardsTotal(M.judgeCards({ right: true, seconds: 60 }, () => 0)) > M.cardsTotal(M.judgeCards({ right: false, seconds: 0 }, () => 0.999)));
}
check("cardsTotal sums to one decimal", M.cardsTotal([9.1, 9.2, 9.3]) === 27.6);
check("higher total takes the round", M.roundWinner({ total: 27.6, seconds: 9 }, { total: 27.5, seconds: 2 }) === 0);
check("a tie goes to the quicker", M.roundWinner({ total: 27.6, seconds: 9 }, { total: 27.6, seconds: 4 }) === 1);
check("a full tie is nobody's", M.roundWinner({ total: 27.6, seconds: 4 }, { total: 27.6, seconds: 4 }) === null);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
