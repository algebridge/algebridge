// Sum Blocks rules, with no DOM in sight so node can unit-check them.
// Board: array of 64, null or { d: digit 1..9 or XT (an x tile), c: color index }. Index = row * 8 + col.

export const N = 8;
/** The digit value of a wildcard tile marked x. */
export const XT = -1;

// ---------- shapes (no rotation in play, so each turn of a shape is its own entry) ----------
const DEFS = [
  // id, rows, weight, color
  ["dot", ["#"], 5, 2],
  ["h2", ["##"], 6, 9], ["v2", ["#", "#"], 6, 9],
  ["h3", ["###"], 8, 3], ["v3", ["#", "#", "#"], 8, 3],
  ["h4", ["####"], 6, 5], ["v4", ["#", "#", "#", "#"], 6, 5],
  ["h5", ["#####"], 3.5, 0], ["v5", ["#", "#", "#", "#", "#"], 3.5, 0],
  ["sq2", ["##", "##"], 9, 6],
  ["sq3", ["###", "###", "###"], 3.5, 7],
  ["r32", ["###", "###"], 3.5, 4], ["r23", ["##", "##", "##"], 3.5, 4],
  ["c1", ["#.", "##"], 4, 1], ["c2", [".#", "##"], 4, 1], ["c3", ["##", "#."], 4, 1], ["c4", ["##", ".#"], 4, 1],
  ["L1", ["#..", "#..", "###"], 1.8, 5], ["L2", ["..#", "..#", "###"], 1.8, 5], ["L3", ["###", "#..", "#.."], 1.8, 5], ["L4", ["###", "..#", "..#"], 1.8, 5],
  ["j1", ["#.", "#.", "##"], 1.5, 8], ["j2", [".#", ".#", "##"], 1.5, 8], ["j3", ["##", "#.", "#."], 1.5, 8], ["j4", ["##", ".#", ".#"], 1.5, 8],
  ["j5", ["###", "#.."], 1.5, 8], ["j6", ["###", "..#"], 1.5, 8], ["j7", ["#..", "###"], 1.5, 8], ["j8", ["..#", "###"], 1.5, 8],
  ["t1", ["###", ".#."], 2, 6], ["t2", [".#.", "###"], 2, 6], ["t3", ["#.", "##", "#."], 2, 6], ["t4", [".#", "##", ".#"], 2, 6],
  ["s1", [".##", "##."], 1.5, 7], ["s2", ["##.", ".##"], 1.5, 7], ["s3", ["#.", "##", ".#"], 1.5, 7], ["s4", [".#", "##", "#."], 1.5, 7],
];
export const SHAPES = DEFS.map(([id, rows, weight, color]) => {
  const cells = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "#") cells.push([x, y]); }));
  return { id, cells, w: rows[0].length, h: rows.length, weight, color, size: cells.length };
});
export const SHAPE = Object.fromEntries(SHAPES.map((s) => [s.id, s]));

// ---------- board basics ----------
export const emptyBoard = () => new Array(N * N).fill(null);
export const filledCount = (b) => { let n = 0; for (let i = 0; i < 64; i++) if (b[i]) n++; return n; };

/** Works on a board of cells or on any array where truthy means filled. */
export function canPlace(occ, shape, col, row) {
  if (col < 0 || row < 0 || col + shape.w > N || row + shape.h > N) return false;
  for (const [x, y] of shape.cells) if (occ[(row + y) * N + col + x]) return false;
  return true;
}
export function fitsAnywhere(occ, shape) {
  for (let r = 0; r <= N - shape.h; r++) for (let c = 0; c <= N - shape.w; c++) if (canPlace(occ, shape, c, r)) return true;
  return false;
}
export function allFits(occ, shape) {
  const out = [];
  for (let r = 0; r <= N - shape.h; r++) for (let c = 0; c <= N - shape.w; c++) if (canPlace(occ, shape, c, r)) out.push([c, r]);
  return out;
}
/** True when none of the pieces still in the tray can go anywhere. */
export function isStuck(occ, tray) {
  const left = tray.filter(Boolean);
  if (!left.length) return false;
  return !left.some((p) => fitsAnywhere(occ, p.shape || p));
}

/** Lines that would be complete if this piece were dropped at (col, row). Does not change the board.
 *  sum adds the digits only; xs counts the x tiles on the line. */
export function previewLines(board, shape, digits, col, row) {
  const ov = new Map();
  shape.cells.forEach(([x, y], k) => ov.set((row + y) * N + col + x, digits[k]));
  const rows = new Set(), cols = new Set();
  for (const [x, y] of shape.cells) { rows.add(row + y); cols.add(col + x); }
  const out = [];
  const scan = (type, index) => {
    let sum = 0, xs = 0;
    for (let k = 0; k < N; k++) {
      const i = type === "row" ? index * N + k : k * N + index;
      const d = ov.has(i) ? ov.get(i) : board[i] ? board[i].d : 0;
      if (!d) return;
      if (d === XT) xs++; else sum += d;
    }
    out.push({ type, index, sum, xs });
  };
  for (const r of rows) scan("row", r);
  for (const c of cols) scan("col", c);
  return out;
}
export function writePiece(board, piece, col, row, extra) {
  piece.shape.cells.forEach(([x, y], k) => { board[(row + y) * N + col + x] = { d: piece.digits[k], c: piece.color ?? piece.shape.color, ...extra }; });
}
export function clearLines(board, lines) {
  for (const l of lines) for (let k = 0; k < N; k++) board[l.type === "row" ? l.index * N + k : k * N + l.index] = null;
}

// ---------- scoring ----------
export const LINE_POINTS = 100;
export const BOARD_CLEAR = 500;
export const streakMult = (streak) => 1 + 0.5 * (Math.min(Math.max(streak, 1), 6) - 1);
/** lines: [{ sum, magic }], streak: the streak count including this move. Adds .pts to each line, returns the total. */
export function scoreMove(cells, lines, streak, boardCleared) {
  let pts = cells;
  for (const l of lines) {
    l.pts = Math.round(LINE_POINTS * lines.length * streakMult(streak) * (l.magic ? 3 : 1));
    pts += l.pts;
  }
  if (boardCleared) pts += BOARD_CLEAR;
  return pts;
}

// ---------- the magic rule: an equation the line sum has to satisfy ----------
// { kind: "mult", a }      line sum = a n          (n is any whole number)
// { kind: "lin", a, b }    line sum = a n + b
// { kind: "dbl", x }       line sum = x + x        (x is printed on the badge)
// { kind: "gt", x }        line sum > 2x
export const RULE = {
  mult: (a) => ({ kind: "mult", a }),
  lin: (a, b) => ({ kind: "lin", a, b }),
  dbl: (x) => ({ kind: "dbl", x }),
  gt: (x) => ({ kind: "gt", x }),
};
export function ruleTest(r, sum) {
  if (r.kind === "mult") return sum > 0 && sum % r.a === 0;
  if (r.kind === "lin") return sum >= r.b && (sum - r.b) % r.a === 0;
  if (r.kind === "dbl") return sum === 2 * r.x;
  return sum > 2 * r.x;
}
/** The right-hand side, as printed: "5n", "3n + 1", "x + x", "2x". */
export const ruleRhs = (r) => (r.kind === "mult" ? `${r.a}n` : r.kind === "lin" ? `${r.a}n + ${r.b}` : r.kind === "dbl" ? "x + x" : "2x");
export const ruleOp = (r) => (r.kind === "gt" ? ">" : "=");
/** "sum = 5n", "sum > 2x" */
export const ruleText = (r) => `sum ${ruleOp(r)} ${ruleRhs(r)}`;
/** The first few line sums that pay (a line of 8 tiles adds to 8 at least, so the list starts there for a n + b). */
export function ruleSamples(r, count = 3) {
  const out = [];
  if (r.kind === "mult") for (let k = 1; k <= count + 1; k++) out.push(r.a * k);
  else if (r.kind === "lin") for (let s = 8; out.length < count; s++) { if (ruleTest(r, s)) out.push(s); }
  else if (r.kind === "dbl") out.push(2 * r.x);
  else for (let k = 1; k <= count; k++) out.push(2 * r.x + k);
  return out;
}
/** One short line that says which sums pay triple. */
export function ruleHint(r) {
  if (r.kind === "dbl") return `x = ${r.x}. Lines that add to ${2 * r.x} pay triple`;
  if (r.kind === "gt") return `x = ${r.x}. Lines that add to more than ${2 * r.x} pay triple`;
  return `Lines that add to ${ruleSamples(r).join(", ")}... pay triple`;
}
/** The one-line example shown when a rule first appears. */
export function ruleIntro(r) {
  if (r.kind === "dbl") return `New rule: sum = x + x. Here x = ${r.x}, so ${2 * r.x} pays`;
  if (r.kind === "gt") return `New rule: sum > 2x. Here x = ${r.x}, so ${2 * r.x + 1} and up pay`;
  return `New rule: sum = ${ruleRhs(r)}, so ${ruleSamples(r, 3).slice(0, 3).join(", ")}...`;
}
/** The solved form for a sum that pays: "30 = 5n, so n = 6". */
export function ruleSolved(r, sum) {
  if (r.kind === "mult") return `${sum} = ${r.a}n, so n = ${sum / r.a}`;
  if (r.kind === "lin") return `${sum} = ${r.a}n + ${r.b}, so n = ${(sum - r.b) / r.a}`;
  if (r.kind === "dbl") return `${sum} = x + x, so x = ${r.x}`;
  return `${sum} > 2x, since 2x = ${2 * r.x}`;
}
/** The slow, first-time version: "30 = 5 × 6, a multiple of 5. Triple points!" */
export function ruleTeach(r, sum) {
  if (r.kind === "mult") return `${sum} = ${r.a} × ${sum / r.a}, a multiple of ${r.a}. Triple points!`;
  if (r.kind === "lin") return `${sum} = ${r.a} × ${(sum - r.b) / r.a} + ${r.b}. Triple points!`;
  if (r.kind === "dbl") return `${sum} = ${r.x} + ${r.x}. Triple points!`;
  return `${sum} is more than 2 × ${r.x}. Triple points!`;
}
/** Why a sum does not pay. long: a full sentence for the first time, else a compact tag. */
export function ruleMiss(r, sum, long = false) {
  if (r.kind === "mult") return long ? `${sum} is not a multiple of ${r.a}.` : `${sum} is not ${r.a}n`;
  if (r.kind === "lin") return long ? `${sum} is not ${r.a}n + ${r.b} for a whole n.` : `${sum} is not ${r.a}n + ${r.b}`;
  if (r.kind === "dbl") return long ? `${sum} is not x + x. That is ${2 * r.x}.` : `${sum} is not ${2 * r.x}`;
  return long ? `${sum} is not more than 2x. That is ${2 * r.x}.` : `${sum} is not over ${2 * r.x}`;
}
/** How much more the line would need to pay (1..max), or 0 when it already pays or is too far. */
export function ruleNeed(r, sum, max = 3) {
  if (ruleTest(r, sum)) return 0;
  for (let k = 1; k <= max; k++) if (ruleTest(r, sum + k)) return k;
  return 0;
}
/** The smallest whole x from 1 to 9 that makes a line with xs x tiles satisfy the rule, or 0 when none does. */
export function solveX(r, sum, xs) {
  for (let v = 1; v <= 9; v++) if (ruleTest(r, sum + xs * v)) return v;
  return 0;
}
/** Does this line pay? line: { sum, xs }. Returns { ok, total, x }: x is the value the x tiles take (0 without x tiles or when none works). */
export function judge(r, line) {
  if (!line.xs) return { ok: ruleTest(r, line.sum), total: line.sum, x: 0 };
  const x = solveX(r, line.sum, line.xs);
  return { ok: x > 0, total: line.sum + line.xs * x, x };
}
export const RULE_SEQ = [
  RULE.mult(5), RULE.lin(3, 1), RULE.mult(4), RULE.dbl(20), RULE.gt(22),
  RULE.mult(6), RULE.lin(4, 3), RULE.mult(7), RULE.dbl(19), RULE.gt(23), RULE.mult(9), RULE.lin(5, 2),
];
export const ruleFor = (idx) => RULE_SEQ[idx % RULE_SEQ.length];
const MAGIC_AT = [1500, 4000, 7000, 10500, 14500];
/** Score needed to leave magic step idx (0-based). */
export const magicThreshold = (idx) => (idx < MAGIC_AT.length ? MAGIC_AT[idx] : 14500 + (idx - 4) * 4500);

// ---------- the piece generator ----------
function toOcc(board) { const o = new Uint8Array(64); for (let i = 0; i < 64; i++) o[i] = board[i] ? 1 : 0; return o; }
function occDrop(occ, s, col, row) {
  const o = occ.slice();
  for (const [x, y] of s.cells) o[(row + y) * N + col + x] = 1;
  const rows = [], cols = [];
  for (let r = 0; r < N; r++) { let f = true; for (let c = 0; c < N; c++) if (!o[r * N + c]) { f = false; break; } if (f) rows.push(r); }
  for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (!o[r * N + c]) { f = false; break; } if (f) cols.push(c); }
  for (const r of rows) for (let c = 0; c < N; c++) o[r * N + c] = 0;
  for (const c of cols) for (let r = 0; r < N; r++) o[r * N + c] = 0;
  return o;
}
/** Can every shape be placed, in some order, with clears along the way? Budgeted search. */
export function solvable(occ, shapes, budget = { n: 6000 }) {
  if (!shapes.length) return true;
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    if (shapes.indexOf(s) < i) continue;
    const rest = shapes.filter((_, j) => j !== i);
    for (let r = 0; r <= N - s.h; r++) for (let c = 0; c <= N - s.w; c++) {
      if (!canPlace(occ, s, c, r)) continue;
      if (budget.n-- <= 0) return false;
      if (solvable(occDrop(occ, s, c, r), rest, budget)) return true;
    }
  }
  return false;
}
function weightFor(s, crowd, difficulty) {
  let w = s.weight;
  const k = Math.max(0, crowd - 0.45) / 0.55; // 0 on an open board, 1 when full
  if (s.size <= 3) w *= 1 + 2.2 * k - 0.35 * difficulty;
  else if (s.size >= 5) w *= Math.max(0.2, 1 - 1.3 * k) * (1 + 0.7 * difficulty);
  return Math.max(0.05, w);
}
function pickWeighted(list, weights, rnd) {
  let total = 0;
  for (const w of weights) total += w;
  let t = rnd() * total;
  for (let i = 0; i < list.length; i++) { t -= weights[i]; if (t <= 0) return list[i]; }
  return list[list.length - 1];
}
/**
 * Deal three pieces for this board.
 * Always: at least one of them fits. Usually (within `tries` resamples): all three can be placed in some order.
 * o: { difficulty 0..1, tries, pool (shape ids to draw from), want(sum) => bool, luck 0..1, xChance 0..1 (per piece: one tile is an x) }
 */
export function deal(board, rnd = Math.random, o = {}) {
  const { difficulty = 0, tries = 10, pool = null, want = null, luck = 0.45, xChance = 0 } = o;
  const occ = toOcc(board);
  const crowd = filledCount(board) / 64;
  const list = pool ? pool.map((id) => SHAPE[id]) : SHAPES;
  const weights = list.map((s) => weightFor(s, crowd, difficulty));
  let best = null, bestFits = 0;
  for (let t = 0; t < Math.max(1, tries); t++) {
    const set = [0, 1, 2].map(() => pickWeighted(list, weights, rnd));
    if (set[0] === set[1] && set[1] === set[2]) continue;
    const fits = set.filter((s) => fitsAnywhere(occ, s)).length;
    if (!fits) continue;
    if (solvable(occ, set)) { best = set; bestFits = 4; break; }
    if (fits > bestFits) { best = set; bestFits = fits; }
  }
  if (!best) {
    // The board is tight. Hand out something that fits for sure, plus two small pieces.
    const fitting = list.filter((s) => fitsAnywhere(occ, s));
    const smalls = list.filter((s) => s.size <= 3);
    const pickFrom = (arr) => pickWeighted(arr, arr.map((s) => s.weight), rnd);
    const sure = fitting.length ? pickFrom(fitting) : SHAPE.dot;
    best = [sure, pickFrom(smalls.length ? smalls : list), pickFrom(fitting.length ? fitting : list)];
    const k = Math.floor(rnd() * 3);
    [best[0], best[k]] = [best[k], best[0]];
  }
  const pieces = best.map((shape) => ({ shape, color: shape.color, digits: shape.cells.map(() => 1 + Math.floor(rnd() * 9)) }));
  if (xChance > 0) for (const p of pieces) if (rnd() < xChance) p.digits[Math.floor(rnd() * p.digits.length)] = XT;
  if (want && rnd() < luck) tune(board, pieces, rnd, want);
  return pieces;
}
/**
 * Quietly set the digits of one piece so that at least one line-completing drop gives a sum the player wants
 * (a multiple of the magic number, or the level's target). Returns true if it found one.
 */
export function tune(board, pieces, rnd, want) {
  const order = pieces.map((_, i) => i).sort(() => rnd() - 0.5);
  for (const pi of order) {
    const p = pieces[pi];
    if (p.digits.includes(XT)) continue; // an x tile solves itself
    const spots = allFits(board, p.shape).sort(() => rnd() - 0.5);
    let looked = 0;
    for (const [col, row] of spots) {
      const lines = previewLines(board, p.shape, p.digits, col, row);
      if (!lines.length) continue;
      if (looked++ > 16) break;
      const l = lines[Math.floor(rnd() * lines.length)];
      if (l.xs) continue;
      // which of the piece's cells sit on this line, and what the rest of the line adds to
      const mine = [];
      p.shape.cells.forEach(([x, y], k) => { if ((l.type === "row" ? row + y : col + x) === l.index) mine.push(k); });
      let fixed = l.sum;
      for (const k of mine) fixed -= p.digits[k];
      const options = [];
      for (let s = fixed + mine.length; s <= fixed + 9 * mine.length; s++) if (want(s)) options.push(s);
      if (!options.length) continue;
      let need = options[Math.floor(rnd() * options.length)] - fixed;
      mine.forEach((k, j) => {
        const after = mine.length - j - 1;
        const lo = Math.max(1, need - 9 * after), hi = Math.min(9, need - after);
        const d = lo + Math.floor(rnd() * (hi - lo + 1));
        p.digits[k] = d;
        need -= d;
      });
      return true;
    }
  }
  return false;
}

// ---------- Target mode ----------
const G = (type, n, value) => ({ type, n, value });
const M = RULE.mult, LIN = RULE.lin, DBL = RULE.dbl, GT = RULE.gt;
export const LEVELS = [
  { goal: G("lines", 2), rule: M(5), pieces: 10, prefill: { kind: "rows", rows: [7, 6], gap: 3 } },
  { goal: G("lines", 4), rule: M(5), pieces: 14, prefill: { kind: "rows", rows: [7], gap: 2 } },
  { goal: G("magic", 1), rule: M(5), pieces: 14, prefill: { kind: "rows", rows: [7, 5], gap: 2 } },
  { goal: G("score", 1, 600), rule: M(5), pieces: 14 },
  { goal: G("combo", 1), rule: M(5), pieces: 14, prefill: { kind: "rows", rows: [7, 6], gap: 2, same: true } },
  { goal: G("magic", 2), rule: M(5), pieces: 18, prefill: { kind: "rows", rows: [7], gap: 3 } },
  { goal: G("atLeast", 1, 45), rule: M(5), pieces: 16, prefill: { kind: "rows", rows: [6], gap: 3 } },
  { goal: G("streak", 1, 3), rule: LIN(3, 1), pieces: 16, prefill: { kind: "rows", rows: [7, 6, 5], gap: 3 } },
  { goal: G("magic", 2), rule: LIN(3, 1), pieces: 14 },
  { goal: G("exact", 1, 40), rule: M(4), pieces: 18, prefill: { kind: "rows", rows: [7, 4], gap: 2 } },
  { goal: G("score", 1, 1200), rule: LIN(3, 1), pieces: 18 },
  { goal: G("atMost", 1, 32), rule: M(4), pieces: 16, prefill: { kind: "cols", rows: [0, 7], gap: 3 } },
  { goal: G("magic", 3), rule: M(4), pieces: 20, xs: true, prefill: { kind: "scatter", pct: 0.22 } },
  { goal: G("lines", 8), rule: M(4), pieces: 22, xs: true, prefill: { kind: "cols", rows: [1, 6], gap: 2 } },
  { goal: G("clearBoard", 1), rule: GT(20), pieces: 14, pool: ["h2", "h3", "h4", "h5", "sq2", "dot", "r32"], prefill: { kind: "rows", rows: [7], gap: 4 } },
  { goal: G("magic", 1), rule: DBL(18), pieces: 18, prefill: { kind: "scatter", pct: 0.25 } },
  { goal: G("magic", 3), rule: GT(21), pieces: 26, xs: true },
  { goal: G("combo", 2), rule: M(6), pieces: 28, xs: true, prefill: { kind: "rows", rows: [7, 6], gap: 2, same: true } },
  { goal: G("streak", 1, 4), rule: M(6), pieces: 20, prefill: { kind: "rows", rows: [7, 6, 5, 4], gap: 3 } },
  { goal: G("score", 1, 2000), rule: GT(22), pieces: 22, xs: true },
  { goal: G("magic", 3), rule: LIN(4, 1), pieces: 28, xs: true, prefill: { kind: "scatter", pct: 0.2 } },
  { goal: G("magic", 2), rule: DBL(21), pieces: 24, xs: true, prefill: { kind: "cols", rows: [0, 3], gap: 2 } },
  { goal: G("odd", 4), rule: M(7), pieces: 18, prefill: { kind: "scatter", pct: 0.25 } },
  { goal: G("lines", 12), rule: M(7), pieces: 34, xs: true },
  { goal: G("magic", 4), rule: LIN(5, 2), pieces: 34, xs: true, prefill: { kind: "rows", rows: [7, 3], gap: 3 } },
  { goal: G("clearBoard", 1), rule: M(9), pieces: 16, pool: ["v2", "v3", "v4", "v5", "h2", "h3", "h4", "sq2", "dot"], prefill: { kind: "cols", rows: [0], gap: 4 } },
  { goal: G("exact", 2, 42), rule: M(7), pieces: 24, prefill: { kind: "scatter", pct: 0.3 } },
  { goal: G("magic", 5), rule: M(4), pieces: 30, xs: true, prefill: { kind: "scatter", pct: 0.3 } },
  { goal: G("streak", 1, 5), rule: M(5), pieces: 24, prefill: { kind: "rows", rows: [7, 6, 5, 4, 3], gap: 3 } },
  { goal: G("score", 1, 3500), rule: GT(22), pieces: 30, xs: true },
];
const s = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
export function goalText(lv) {
  const { type, n, value } = lv.goal;
  switch (type) {
    case "lines": return `Clear ${s(n, "a line", "lines")}`;
    case "magic": return lv.rule.kind === "dbl" || lv.rule.kind === "gt"
      ? `Clear ${s(n, "a line", "lines")} where ${ruleText(lv.rule)}, with x = ${lv.rule.x}`
      : `Clear ${s(n, "a line", "lines")} where ${ruleText(lv.rule)}`;
    case "score": return `Score ${value}`;
    case "combo": return n === 1 ? "Clear 2 lines with one piece" : `Clear 2 lines with one piece, ${n} times`;
    case "streak": return `Build a streak of ${value}`;
    case "exact": return `Clear ${s(n, "a line", "lines")} where sum = ${value}`;
    case "atLeast": return `Clear ${s(n, "a line", "lines")} where sum ≥ ${value}`;
    case "atMost": return `Clear ${s(n, "a line", "lines")} where sum ≤ ${value}`;
    case "clearBoard": return "Clear the whole board";
    case "odd": return `Clear ${s(n, "a line", "lines")} where sum = 2n + 1`;
  }
  return "";
}
/** Which line sums help this level (drives the gold preview and the lucky digits). */
export function wantFor(lv) {
  const { type, value } = lv.goal;
  if (type === "exact") return (x) => x === value;
  if (type === "atLeast") return (x) => x >= value;
  if (type === "atMost") return (x) => x <= value;
  if (type === "odd") return (x) => x % 2 === 1;
  return (x) => ruleTest(lv.rule, x);
}
export const goalTarget = (lv) => (lv.goal.type === "score" || lv.goal.type === "streak" ? lv.goal.value : lv.goal.n);
/** Fold one move into the progress count. move: { lines: [{ sum, xs?, magic? }], streak, score, boardEmpty }. Returns the new count.
 *  A line's magic flag (set by the game from judge) wins; without it the plain sum is tested. */
export function goalProgress(lv, count, move) {
  const { type, value } = lv.goal;
  const hit = (f) => count + move.lines.filter((l) => f(l.sum)).length;
  switch (type) {
    case "lines": return count + move.lines.length;
    case "magic": return count + move.lines.filter((l) => l.magic ?? judge(lv.rule, { sum: l.sum, xs: l.xs || 0 }).ok).length;
    case "score": return move.score;
    case "combo": return count + (move.lines.length >= 2 ? 1 : 0);
    case "streak": return Math.max(count, move.streak);
    case "exact": return hit((x) => x === value);
    case "atLeast": return hit((x) => x >= value);
    case "atMost": return hit((x) => x <= value);
    case "clearBoard": return move.boardEmpty && move.lines.length ? 1 : count;
    case "odd": return hit((x) => x % 2 === 1);
  }
  return count;
}
export function starsFor(lv, used) {
  const f = used / lv.pieces;
  return f <= 0.6 ? 3 : f <= 0.85 ? 2 : 1;
}
/** The starting board of a level. Never contains a full line. */
export function buildPrefill(lv, rnd) {
  const b = emptyBoard();
  const pf = lv.prefill;
  if (!pf) return b;
  const cell = () => ({ d: 1 + Math.floor(rnd() * 9), c: Math.floor(rnd() * 10) });
  if (pf.kind === "rows" || pf.kind === "cols") {
    let start = Math.floor(rnd() * (N - pf.gap + 1));
    for (const line of pf.rows) {
      if (!pf.same) start = Math.floor(rnd() * (N - pf.gap + 1));
      for (let k = 0; k < N; k++) {
        if (k >= start && k < start + pf.gap) continue;
        b[pf.kind === "rows" ? line * N + k : k * N + line] = cell();
      }
    }
  } else if (pf.kind === "scatter") {
    // small clumps, kept low on the board, never a full line
    const want = Math.round(64 * pf.pct);
    let n = 0, guard = 0;
    while (n < want && guard++ < 400) {
      const r = N - 1 - Math.floor(rnd() * rnd() * N), c0 = Math.floor(rnd() * N), len = 1 + Math.floor(rnd() * 3);
      for (let c = c0; c < Math.min(N, c0 + len) && n < want; c++) {
        const i = r * N + c;
        if (b[i]) continue;
        b[i] = cell();
        let rowFull = true, colFull = true;
        for (let k = 0; k < N; k++) { if (!b[r * N + k]) rowFull = false; if (!b[k * N + c]) colFull = false; }
        if (rowFull || colFull) b[i] = null; else n++;
      }
    }
  }
  return b;
}
