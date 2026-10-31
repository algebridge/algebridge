/**
 * The rest of the pictures: every problem shape lib/pictures.ts had nothing
 * for. A balance for any equation, fraction strips for a common denominator,
 * repeated factors for exponent rules, a ladder of powers for zero, negative
 * and fractional exponents, the decimal point hopping for scientific
 * notation, a square grid for a radical, scatter plots for a correlation,
 * tables and bars for the stories, and a board of what is known and what is
 * asked for anything left.
 *
 * Same rules as lib/pictures.ts: pure, built from the prompt, `reveals` when
 * the drawing would hand over the answer.
 */

import { evalSafe, extractMath } from "@/lib/mathexpr";
import {
  UNIT_NAMES,
  conversionPath,
  features,
  fmt,
  niceRange,
  plain,
  plane,
  pointsIn,
  pointsPicture,
  qty,
  snap,
  toNum,
  type Picture,
  type PlaneCurve,
  type PlanePoint,
  type PlaneSegment,
  type PlaneVLine,
  type TapePart,
  type Tone,
} from "@/lib/pictures";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** "x^2" written as "x²", "10^-5" as "10⁻⁵". */
export function sup(s: string): string {
  return s.replace(/\^\(?(-?\d+)\)?/g, (_, n: string) => [...n].map((c) => (c === "-" ? "⁻" : SUPS[Number(c)])).join(""));
}
/** "x²" written as "x^2", so one regex reads both spellings. */
function caret(s: string): string {
  return s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => "^" + [...m].map((c) => (c === "⁻" ? "-" : String(SUPS.indexOf(c)))).join(""));
}
const SUBS = "₀₁₂₃₄₅₆₇₈₉";
/** "a₂₉" read as "a29". */
function unsub(s: string): string {
  return s.replace(/[₀-₉]/g, (c) => String(SUBS.indexOf(c)));
}

// Built lazily: this module and lib/pictures.ts import each other, so nothing here may read it while loading.
let shortUnits: Set<string> | null = null;
/** A unit word in any spelling ("kilogram", "kilograms", "kg") as its short name, or null. */
function unitOf(word: string): string | null {
  shortUnits ??= new Set(Object.values(UNIT_NAMES));
  const w = word.replace(/[.,?]$/, "");
  if (shortUnits.has(w)) return w;
  const lower = w.toLowerCase();
  return UNIT_NAMES[lower] ?? UNIT_NAMES[`${lower}s`] ?? UNIT_NAMES[lower.replace(/s$/, "")] ?? null;
}

type Factor = { top: string; bottom: string };
/** The factors of one unit to another turned over, for a unit that sits underneath (per hour to per second). */
const flip = (path: Factor[]) => path.map((f) => ({ top: f.bottom, bottom: f.top }));

function chainPic(title: string, start: string, factors: Factor[], result: string, startBottom?: string): Picture | null {
  if (!factors.length || factors.length > 6) return null;
  return { kind: "chain", title, reveals: false, start, startBottom, factors, result };
}

/** A ratio table: two quantities that scale together, with the asked one blank. */
function ratio(title: string, rows: string[], cells: (string | null)[][], cols?: string[]): Picture {
  return { kind: "table", title, reveals: false, corner: "", cols: cols ?? cells[0].map(() => ""), rows, cells, totals: false };
}

const num = (s: string) => toNum(s);
const money = (v: number) => `$${v % 1 ? v.toFixed(2) : v.toLocaleString("en-US")}`;

/** Two points and the rise and run between them, with the story's own axes. */
function triangle(title: string, a: [number, number], b: [number, number], axes: [string, string], reveals = false): Picture {
  const segments: PlaneSegment[] = [
    { from: a, to: b, tone: 0 },
    { from: a, to: [b[0], a[1]], tone: 2, dashed: true, label: "run" },
    { from: [b[0], a[1]], to: b, tone: 2, dashed: true, label: "rise" },
  ];
  const points: PlanePoint[] = [
    { x: a[0], y: a[1], tone: 0, label: `(${fmt(a[0])}, ${fmt(a[1])})` },
    { x: b[0], y: b[1], tone: 0, label: `(${fmt(b[0])}, ${fmt(b[1])})` },
  ];
  return plane(title, reveals, { points, segments, axes }, { xs: [0, a[0], b[0]], ys: [0, a[1], b[1]] });
}

/** Where g crosses zero, found on a grid then narrowed, or null. */
function rootOf(g: (x: number) => number, lo = -60, hi = 60): number | null {
  let prev = g(lo);
  for (let x = lo + 0.25; x <= hi; x += 0.25) {
    const y = g(x);
    if (Number.isFinite(prev) && Number.isFinite(y) && (y === 0 || Math.sign(y) !== Math.sign(prev))) {
      let a = x - 0.25;
      let b = x;
      for (let k = 0; k < 50; k++) {
        const m = (a + b) / 2;
        if (Math.sign(g(m)) === Math.sign(g(a))) a = m;
        else b = m;
      }
      return snap((a + b) / 2);
    }
    prev = y;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Equations: a balance
// ---------------------------------------------------------------------------

/** The two sides of the equation a prompt is about. */
function sidesOf(prompt: string): [string, string] | null {
  const p = plain(prompt).replace(/\s+/g, " ").trim();
  let eq: string | null = null;
  const solve = p.match(/Solve for [a-z]: (.+)$/);
  if (solve) eq = solve[1].replace(/[.?]$/, "");
  else {
    const m = p.match(/([^=,?!;]*?)\s=\s([^=,?!;]*?)(?=\s*(?:[,?!;]|\.(?!\d)|$|\bfor\b|\bchanges\b|\bgives\b|\bso\b))/);
    if (!m) return null;
    // The equation's left side is the math at the end of the words before "=": "Simple interest is I".
    const run = m[1].match(/([A-Za-z0-9^()/.|]+(?:\s[+-]\s[A-Za-z0-9^()/.|]+)*)$/);
    if (!run) return null;
    eq = `${run[1]} = ${m[2].trim()}`;
  }
  const parts = eq.split(" = ");
  if (parts.length !== 2 || !/[a-zA-Z]/.test(eq)) return null;
  return [parts[0].trim(), parts[1].trim()];
}

/** One side split into its terms at the top level, each with its sign. */
function termsOf(side: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < side.length; i++) {
    const ch = side[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && (ch === "+" || ch === "-") && side[i - 1] === " " && side[i + 1] === " ") {
      out.push(cur.trim());
      // "+ 5x", "- 6x": the sign and a space, so a chip reads like the equation and its number stays positive.
      cur = `${ch} `;
      i++;
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

function balanceFor(prompt: string): Picture | null {
  const sides = sidesOf(prompt);
  if (!sides) return null;
  const left = termsOf(sides[0]);
  const right = termsOf(sides[1]);
  if (!left.length || !right.length || left.length + right.length > 8) return null;
  const f = plain(prompt).match(/Solve(?: it)? for ([a-zA-Z])\b/) ?? plain(prompt).match(/\bfor ([a-zA-Z])\s*[.,]/);
  const focus = f ? f[1] : "x";
  if (!`${sides[0]} ${sides[1]}`.includes(focus)) return null;
  return {
    kind: "balance",
    title: `Both sides balance. Undo what is around ${focus}, one step at a time, on both sides.`,
    reveals: false,
    left,
    right,
    focus,
  };
}

/** A rectangle formula with its numbers: the rectangle itself. */
function literalRect(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/area is A = lw\. Solve for w, then find w when A = (\d+) and l = (\d+)/))) {
    return { kind: "rect", title: "The rectangle: its length is known, and its area.", reveals: false, width: `l = ${m[2]}`, height: "w", inside: `A = ${m[1]}` };
  }
  if ((m = p.match(/perimeter is P = 2l \+ 2w\. Solve for w, then find w when P = (\d+) and l = (\d+)/))) {
    return { kind: "rect", title: "The rectangle: its length is known, and the distance all the way around.", reveals: false, width: `l = ${m[2]}`, height: "w", inside: `P = ${m[1]}` };
  }
  if ((m = p.match(/A square has an area of (\d+) square (\w+)/))) {
    return { kind: "rect", title: "The square. Its side times itself is the area.", reveals: false, width: "s", height: "s", inside: `Area = ${m[1]} sq ${m[2]}` };
  }
  return null;
}

/** "What is the LCD of 1/2, 1/3, and 1/6?": strips of halves, thirds and sixths. */
function stripsFor(prompt: string): Picture | null {
  const m = plain(prompt).match(/(?:LCD|least common denominator) of ((?:1\/\d+,? (?:and )?)*1\/\d+)/i);
  if (!m) return null;
  const denominators = [...m[1].matchAll(/1\/(\d+)/g)].map((x) => Number(x[1]));
  if (denominators.length < 2 || denominators.some((d) => d > 16)) return null;
  return {
    kind: "strips",
    title: "Each strip is one whole, cut into equal parts. The common denominator is the smallest cut every strip shares.",
    reveals: false,
    denominators,
  };
}

/** "If f(x) = -6x + 7, for what value of x is f(x) = -35?": the graph, and the level it has to reach. */
function levelFor(prompt: string): Picture | null {
  const p = plain(prompt);
  const m = p.match(/(?:for what value of \w+|for how many \w+) is (\w)\((\w)\) = (-?\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const def = extractMath(p).defs.find((d) => d.name === m[1]);
  let f: (x: number) => number;
  if (def) f = (x: number) => evalSafe(def.body, { [def.arg]: x });
  else {
    const written = p.match(new RegExp(`${m[1]}\\(${m[2]}\\) = ([^.]+?)\\.`));
    const body = written && extractMath(`y = ${written[1]}`).chains[0]?.chain.exprs[1];
    if (!body) return null;
    f = (x: number) => evalSafe(body, { [m[2]]: x });
  }
  const k = Number(m[3]);
  const x0 = rootOf((x) => f(x) - k, -200, 200);
  const points: PlanePoint[] = x0 !== null ? [{ x: x0, y: k, tone: 2 }] : [];
  const feat = features(f, -10, 10);
  const name = `${m[1]}(${m[2]})`;
  return plane(
    `The graph of ${name}, and the height ${fmt(k)}. The answer is the ${m[2]} where they meet.`,
    true,
    { curves: [{ f, tone: 0, label: name }, { f: () => k, tone: 1, dashed: true, label: `${name} = ${fmt(k)}` }], points, axes: m[2] === "x" ? undefined : [m[2], name] },
    { xs: [0, ...(x0 !== null ? [x0] : []), ...feat.xs], ys: [0, k, ...feat.ys] }
  );
}

/** "How many solutions does 5|x + 5| + 7 = -18 have?": the V, and the level that may never reach it. */
function absLevelFor(prompt: string): Picture | null {
  const p = plain(prompt);
  if (!/How many solutions/i.test(p) || !p.includes("|")) return null;
  const chain = extractMath(p).chains.find((c) => c.chain.exprs.length === 2 && c.chain.ops[0] === "=");
  if (!chain) return null;
  const [lhs, rhs] = chain.chain.exprs;
  const k = evalSafe(rhs);
  if (!Number.isFinite(k)) return null;
  const f = (x: number) => evalSafe(lhs, { x });
  const feat = features(f, -20, 20);
  const text = chain.text.split(" = ")[0];
  return plane(
    "The left side graphed, and the level the right side asks for. Solutions are where they meet.",
    true,
    { curves: [{ f, tone: 0, label: `y = ${text}` }, { f: () => k, tone: 1, dashed: true, label: `y = ${fmt(k)}` }] },
    { xs: [0, ...feat.xs], ys: [0, k, ...feat.ys] }
  );
}

// ---------------------------------------------------------------------------
// Exponents
// ---------------------------------------------------------------------------

interface FactorItem {
  text: string;
  struck?: boolean;
}
interface FactorGroup {
  label: string;
  items: FactorItem[];
}

function groupOf(atom: string): FactorGroup | null {
  const a = atom.trim();
  let m: RegExpMatchArray | null;
  if ((m = a.match(/^\((.+)\)\^(\d+)$/))) {
    const k = Number(m[2]);
    if (k < 1 || k > 14) return null;
    return { label: sup(a), items: Array.from({ length: k }, () => ({ text: sup(m![1]) })) };
  }
  if ((m = a.match(/^([a-z]|\d+(?:\.\d+)?|[a-z]+)\^(\d+)$/))) {
    const k = Number(m[2]);
    if (k < 1 || k > 14) return null;
    return { label: sup(a), items: Array.from({ length: k }, () => ({ text: m![1] })) };
  }
  if ((m = a.match(/^\(([a-z0-9.^]+)\)$/i))) return { label: sup(a), items: [{ text: sup(m[1]) }] };
  if (/^[a-z0-9.]+$/i.test(a)) return { label: a, items: [{ text: a }] };
  return null;
}

/** Items like x² opened out to x · x, when every item is a power of the same base. */
function flatten(groups: FactorGroup[]): FactorGroup[] {
  return groups.map((g) => {
    const items: FactorItem[] = [];
    for (const it of g.items) {
      const m = caret(it.text).match(/^([a-z]|\d+)\^(\d)$/);
      if (m && Number(m[2]) <= 4) for (let i = 0; i < Number(m[2]); i++) items.push({ text: m[1] });
      else items.push(it);
    }
    return { label: g.label, items };
  });
}

/** The product or quotient a Simplify prompt is about, with its superscripts written as ^. */
function exprOf(prompt: string): string | null {
  let p = caret(plain(prompt)).replace(/\s+/g, " ").trim();
  p = p.replace(/\s*\((?:enter|write) (?:it )?as a number\)/i, "").replace(/, then write.*$/i, "").replace(/, for any x.*$/i, "");
  let m = p.match(/^Simplify:? (.+?)\.?$/);
  if (m) return m[1];
  m = p.match(/^(.+?) = [a-z0-9]+\^n\. What is n\?$/);
  if (m) return m[1];
  return null;
}

/** 2³ × 2⁴, (x³)², (2xy)² ÷ (2xy): every factor written out, matching ones struck through. */
function factorsFor(prompt: string): Picture | null {
  const expr = exprOf(prompt);
  if (!expr) return null;
  if (/\^0\b/.test(expr)) return zeroLadder(expr);
  if (/[+-]/.test(expr.replace(/\^-/g, ""))) return null;
  const [numText, denText] = expr.split(" ÷ ");
  const unwrap = (s: string) => {
    const t = s.trim();
    const m = t.match(/^\((.+)\)$/);
    return m && /[×·]/.test(m[1]) ? m[1] : t;
  };
  const parts = (s: string) => unwrap(s).split(/ [×·] /).map(groupOf);
  const top = parts(numText);
  const bottom = denText ? parts(denText) : undefined;
  if (top.some((g) => !g) || bottom?.some((g) => !g)) return null;
  let topG = top as FactorGroup[];
  let botG = bottom as FactorGroup[] | undefined;
  if (botG) {
    const base = (g: FactorGroup[]) => new Set(g.flatMap((x) => x.items.map((i) => caret(i.text).replace(/\^\d$/, ""))));
    const bases = new Set([...base(topG), ...base(botG)]);
    if (bases.size === 1) {
      topG = flatten(topG);
      botG = flatten(botG);
    }
    // Cancel: each item on top strikes one matching item underneath.
    for (const t of topG.flatMap((g) => g.items)) {
      const match = botG.flatMap((g) => g.items).find((b) => !b.struck && b.text === t.text);
      if (match) {
        match.struck = true;
        t.struck = true;
      }
    }
  }
  const count = topG.reduce((n, g) => n + g.items.length, 0) + (botG?.reduce((n, g) => n + g.items.length, 0) ?? 0);
  if (count > 30) return null;
  return {
    kind: "factors",
    title: botG
      ? "Every factor written out, on top and underneath. A factor on top cancels the same one below."
      : "Every factor written out. Count them up to find the power.",
    reveals: false,
    top: topG,
    bottom: botG,
  };
}

/** 5⁰, or 4x⁰: the powers of the base counting down, each row one division more. */
function zeroLadder(expr: string): Picture | null {
  const m = expr.match(/([a-z]|\d+)\^0/);
  if (!m) return null;
  const b = m[1];
  const numeric = /^\d+$/.test(b);
  const v = Number(b);
  const rows = [3, 2, 1, 0].map((k) => ({
    power: `${b}${sup(`^${k}`)}`,
    value: k === 0 ? null : numeric ? fmt(Math.pow(v, k)) : Array.from({ length: k }, () => b).join(" · "),
  }));
  return { kind: "ladder", title: `Each row down divides by ${b} once more. Keep the pattern going one more row.`, reveals: false, rows, step: `÷ ${b}` };
}

/** 2⁻³, (1/5)⁻³, 81^(3/4), 16^(−3/2): the ladder of powers the answer is one more rung of. */
function ladderFor(prompt: string): Picture | null {
  const p = caret(plain(prompt)).replace(/\s+/g, " ");
  let m: RegExpMatchArray | null;
  if ((m = p.match(/Evaluate (\d+)\^\(?-(\d+)\)?[.?]/))) {
    const b = Number(m[1]);
    const k = Number(m[2]);
    if (k > 4) return null;
    const rows = [];
    for (let e = k; e >= -k; e--) rows.push({ power: `${b}${sup(`^${e}`)}`, value: e === -k ? null : e >= 0 ? fmt(Math.pow(b, e)) : `1/${fmt(Math.pow(b, -e))}` });
    return { kind: "ladder", title: `Each row down divides by ${b}. Past ${b}⁰ = 1, dividing again gives fractions.`, reveals: false, rows, step: `÷ ${b}` };
  }
  if ((m = p.match(/Evaluate \(1\/(\d+)\)\^\(?-(\d+)\)?/))) {
    const b = Number(m[1]);
    const k = Number(m[2]);
    if (k > 4) return null;
    const rows = [];
    for (let e = 1; e >= -k; e--) rows.push({ power: `(1/${b})${sup(`^${e}`)}`, value: e === -k ? null : e === 1 ? `1/${b}` : e === 0 ? "1" : fmt(Math.pow(b, -e)) });
    return { kind: "ladder", title: `Each row down multiplies by ${b}: dividing by 1/${b} is multiplying by ${b}.`, reveals: false, rows, step: `× ${b}` };
  }
  if ((m = p.match(/Evaluate (\d+)\^\((-?)(\d+)\/(\d+)\)/))) {
    const b = Number(m[1]);
    const neg = m[2] === "-";
    const top = Number(m[3]);
    const q = Number(m[4]);
    const r = Math.round(Math.pow(b, 1 / q));
    if (Math.pow(r, q) !== b || top > 5) return null;
    const rows = [];
    for (let k = 1; k <= top; k++) rows.push({ power: `${b}^(${k}/${q})`, value: !neg && k === top ? null : fmt(Math.pow(r, k)) });
    if (neg) rows.push({ power: `${b}^(-${top}/${q})`, value: null });
    const rootName = q === 2 ? "square root" : q === 3 ? "cube root" : `${q}th root`;
    return {
      kind: "ladder",
      title: neg
        ? `${b}^(1/${q}) is the ${rootName} of ${b}. Each row multiplies by it again; the minus sign flips the last one over.`
        : `${b}^(1/${q}) is the ${rootName} of ${b}. Each row down multiplies by it once more.`,
      reveals: false,
      rows,
      step: `× ${r}`,
    };
  }
  return null;
}

/** Roots and fractional exponents side by side, with the asked one blank. */
function rootTableFor(prompt: string): Picture | null {
  const p = plain(prompt);
  const toExp = p.match(/Rewrite ([²³⁴⁵]?)√x (?:as|using) an? (?:fractional )?exponent/);
  const toRoot = p.match(/Rewrite x\^\(1\/(\d)\) as a root/) ?? caret(p).match(/Rewrite x\^\(1\/(\d)\) as a root/);
  if (!toExp && !toRoot) return null;
  const n = toExp ? (toExp[1] ? ["²", "³", "⁴", "⁵"].indexOf(toExp[1]) + 2 : 2) : Number(toRoot![1]);
  const rows = [2, 3, 4, 5].map((k) => ({ k, root: k === 2 ? "√x" : `${["", "", "²", "³", "⁴", "⁵"][k]}√x`, exp: `x^(1/${k})` }));
  return {
    kind: "table",
    title: "A root is a fractional exponent: the index of the root is the bottom of the fraction.",
    reveals: false,
    corner: "",
    cols: ["As a root", "As an exponent"],
    rows: rows.map((r) => `n = ${r.k}`),
    cells: rows.map((r) => [toRoot && r.k === n ? null : r.root, toExp && r.k === n ? null : r.exp]),
    totals: false,
  };
}

/** x^(3/4) · x^(1/4): the exponents added on a number line. */
function addExponentsFor(prompt: string): Picture | null {
  const m = caret(plain(prompt)).match(/x\^\((\d)\/(\d)\) · x\^\((\d)\/(\d)\) = x\^n/);
  if (!m) return null;
  const a = Number(m[1]) / Number(m[2]);
  const b = Number(m[3]) / Number(m[4]);
  const sum = a + b;
  return {
    kind: "numberline",
    title: "Multiplying powers of the same base adds the exponents: start at the first, step the second.",
    reveals: true,
    min: 0,
    max: Math.max(2, Math.ceil(sum)),
    marks: [
      { x: a, label: `${m[1]}/${m[2]}`, tone: 0 },
      { x: sum, label: fmt(sum), tone: 2 },
    ],
    spans: [],
    arcs: [{ from: a, to: sum, label: `+ ${m[3]}/${m[4]}` }],
  };
}

// ---------------------------------------------------------------------------
// Scientific notation
// ---------------------------------------------------------------------------

function digitsFor(prompt: string): Picture | null {
  const p = caret(plain(prompt)).replace(/\s+/g, " ");
  let m: RegExpMatchArray | null;
  if ((m = p.match(/Write ([\d,]+(?:\.\d+)?) in scientific notation/))) {
    const s = m[1].replace(/,/g, "");
    const dot = s.indexOf(".");
    const digits = s.replace(".", "");
    const from = dot === -1 ? digits.length : dot;
    const first = digits.search(/[1-9]/);
    if (first === -1) return null;
    const to = first + 1;
    if (to === from) return null;
    return { kind: "digits", title: "Hop the decimal point until one digit is left in front of it. Each hop is one power of 10.", reveals: true, digits, from, to };
  }
  if ((m = p.match(/Write ([\d.]+) × 10\^(-?\d+) as a regular number/))) {
    const s = m[1];
    const e = Number(m[2]);
    let digits = s.replace(".", "");
    let from = s.indexOf(".") === -1 ? digits.length : s.indexOf(".");
    if (e < 0) {
      digits = "0".repeat(-e) + digits;
      from += -e;
    }
    let to = from + e;
    while (to > digits.length) digits += "0";
    if (e > 0 && to === digits.length) digits += "";
    return { kind: "digits", title: `× 10${sup(`^${e}`)} hops the decimal point ${Math.abs(e)} place${Math.abs(e) === 1 ? "" : "s"} to the ${e > 0 ? "right" : "left"}.`, reveals: true, digits, from, to };
  }
  if ((m = p.match(/(Multiply|Divide): \(([\d.]+) × 10\^(-?\d+)\)(?: ÷ )?\(([\d.]+) × 10\^(-?\d+)\)/))) {
    const divide = m[1] === "Divide";
    const [a, b, c, d] = [m[2], m[3], m[4], m[5]];
    const grp = (label: string, items: string[]): FactorGroup => ({ label, items: items.map((text) => ({ text })) });
    return {
      kind: "factors",
      title: divide
        ? "The number parts divide, and the powers of 10 divide: subtract the exponents."
        : "Group the number parts together and the powers of 10 together: multiply the numbers, add the exponents.",
      reveals: false,
      top: divide ? [grp("number", [a]), grp("power of 10", [sup(`10^${b}`)])] : [grp("the numbers", [a, c]), grp("the powers of 10", [sup(`10^${b}`), sup(`10^${d}`)])],
      bottom: divide ? [grp("number", [c]), grp("power of 10", [sup(`10^${d}`)])] : undefined,
    };
  }
  if ((m = p.match(/(\d) × 10\^(\d+) meters per second\. How far does it travel in ([\d,]+) seconds/))) {
    const grp = (label: string, items: string[]): FactorGroup => ({ label, items: items.map((text) => ({ text })) });
    return {
      kind: "factors",
      title: "Distance is speed × time. Multiply the number parts, and count the powers of 10.",
      reveals: false,
      top: [grp("speed, m/s", [m[1], sup(`10^${m[2]}`)]), grp("seconds", [m[3]])],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Radicals
// ---------------------------------------------------------------------------

function bigSquare(n: number): [number, number] {
  let best = 1;
  for (let s = 2; s * s <= n; s++) if (n % (s * s) === 0) best = s * s;
  return [best, n / best];
}

/** √72 as the biggest square inside it and what is left over. */
function squaresFor(prompt: string): Picture | null {
  const p = plain(prompt);
  if (!/√/.test(p) || /square (inches|feet|centimeters|meters)/.test(p)) return null;
  const terms = [...p.matchAll(/(\d*)√\(?(\d+)(x²)?\)?/g)].map((m) => ({ coef: m[1] || "", n: Number(m[2]), extra: m[3] ?? "" }));
  if (!terms.length || terms.length > 2 || terms.some((t) => t.n > 1000)) return null;
  const op = p.includes(" + ") ? "+" : p.includes(" · ") ? "·" : p.includes(" − ") ? "−" : null;
  let list = terms;
  if (op === "·" && terms.length === 2) list = [{ coef: "", n: terms[0].n * terms[1].n, extra: "" }];
  const parts = list.map((t) => {
    const [square, rest] = bigSquare(t.n);
    return { coef: t.coef, n: t.n, square, rest, extra: t.extra };
  });
  if (parts.every((q) => q.square === 1)) return null;
  return {
    kind: "squares",
    title:
      op === "·"
        ? `√${terms[0].n} · √${terms[1].n} is √${list[0].n}. The biggest square inside it comes out as a whole number.`
        : "Each number as the biggest perfect square inside it, with what is left over. The square's side comes out of the root.",
    reveals: true,
    parts,
    op: op === "·" ? null : op,
  };
}

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

function scattersFor(prompt: string): Picture | null {
  const p = plain(prompt);
  const rs = [...p.matchAll(/r = (-?\d?\.\d+)/g)].map((m) => Number(m[1]));
  if (!rs.length || rs.length > 4) return null;
  const pair = p.match(/between (.+?) and (.+?) in a data set/) ?? p.match(/, (.+?) and (.+?) have r =/);
  const axes: [string, string] | undefined = pair ? [pair[1], pair[2]] : undefined;
  return {
    kind: "scatters",
    title:
      rs.length > 1
        ? "A scatter plot for each r. The closer the points sit to a line, the closer r is to 1 or −1."
        : `Data with r = ${fmt(rs[0])}: how closely the points follow a line, and which way it tilts.`,
    reveals: rs.length > 1,
    panels: rs.map((r) => ({ r, label: `r = ${fmt(r)}`, axes })),
  };
}

// ---------------------------------------------------------------------------
// Rates and conversions
// ---------------------------------------------------------------------------

function ratesFor(prompt: string): Picture | null {
  const p = plain(prompt).replace(/\s*\(1 [^)]+\)/g, "");
  let m: RegExpMatchArray | null;
  if ((m = p.match(/Which conversion factor converts (\w+) to (\w+)/))) {
    const a = unitOf(m[1]);
    const b = unitOf(m[2]);
    if (!a || !b) return null;
    return chainPic(`A conversion factor equals 1: the unit you have underneath, the unit you want on top.`, qty(1, a), [{ top: `? ${b}`, bottom: `? ${a}` }], `? ${b}`);
  }
  // "60 miles in 1 hour", "24 miles per hour": a rate to another rate.
  if ((m = p.match(/(\d[\d,]*(?:\.\d+)?) (\w+) (?:per|an?|in 1|every) (\w+)\b.*?How many (\w+) per (\w+)/i))) {
    const [n, u1, u2, u3, u4] = [m[1], unitOf(m[2]), unitOf(m[3]), unitOf(m[4]), unitOf(m[5])];
    if (!u1 || !u2 || !u3 || !u4) return null;
    const p1 = u1 === u3 ? [] : conversionPath(u1, u3);
    const p2 = u2 === u4 ? [] : conversionPath(u2, u4);
    if (!p1 || !p2) return null;
    return chainPic(`${n} ${u1} every ${u2}, times factors that each equal 1, until only ${u3} and ${u4} are left.`, qty(n, u1), [...p1, ...flip(p2)], `? ${u3}/${u4}`, qty(1, u2));
  }
  if ((m = p.match(/A ([\d.]+)-(\w+) sack .*? split evenly into (\d+) bags\. How many (\w+) go in each bag/))) {
    const a = unitOf(m[2]);
    const b = unitOf(m[4]);
    if (!a || !b) return null;
    const path = conversionPath(a, b);
    if (!path) return null;
    return chainPic("The whole sack in the unit asked for, then shared out over the bags.", qty(m[1], a), [...path, { top: "1", bottom: `${m[3]} bags` }], `? ${b}/bag`);
  }
  if ((m = p.match(/A box holds (\d+) cans of beans, and each can weighs (\d+) grams\. How many kilograms/))) {
    return chainPic("Cans to grams, then grams to kilograms.", `${m[1]} cans`, [{ top: `${m[2]} g`, bottom: "1 can" }, ...(conversionPath("g", "kg") ?? [])], "? kg");
  }
  if ((m = p.match(/Every song on a playlist is (\d+) seconds long\. How many songs fit in (\d+) hours/))) {
    return chainPic("Hours to seconds, then seconds to songs.", qty(m[2], "h"), [...(conversionPath("h", "s") ?? []), { top: "1 song", bottom: `${m[1]} s` }], "? songs");
  }
  if ((m = p.match(/One lap of a running track is (\d+) meters\. You run (\d+) laps\. How many kilometers/))) {
    return chainPic("Laps to meters, then meters to kilometers.", `${m[2]} laps`, [{ top: `${m[1]} m`, bottom: "1 lap" }, ...(conversionPath("m", "km") ?? [])], "? km");
  }
  if ((m = p.match(/A cooler holds (\d+) liters of water\. How many (\d+)-milliliter bottles/))) {
    return chainPic("Liters to milliliters, then milliliters to bottles.", qty(m[1], "L"), [...(conversionPath("L", "mL") ?? []), { top: "1 bottle", bottom: `${m[2]} mL` }], "? bottles");
  }
  if ((m = p.match(/A hiking trail is ([\d.]+) miles long\. You have walked ([\d,]+) feet of it\. How many feet are left/))) {
    const total = Number(m[1]) * 5280;
    const walked = num(m[2]);
    if (walked >= total) return null;
    const parts: TapePart[] = [
      { label: `${m[2]} ft walked`, size: walked, kind: "known" },
      { label: "? ft left", size: total - walked, kind: "unknown" },
    ];
    return { kind: "tape", title: `The whole trail is ${m[1]} miles, in feet. Part is walked, the rest is left.`, reveals: false, rows: [{ parts, total: `${m[1]} mi = ? ft` }] };
  }
  if ((m = p.match(/drips (\d+) milliliters every minute\. How many liters does it waste in one week/))) {
    return chainPic("A week to minutes, then the drips, then liters.", "1 week", [...(conversionPath("week", "min") ?? []), { top: `${m[1]} mL`, bottom: "1 min" }, ...(conversionPath("mL", "L") ?? [])], "? L");
  }
  if ((m = p.match(/You drive (\d+) miles in a car that gets (\d+) miles per gallon\. Gas costs \$([\d.]+) a gallon/))) {
    return chainPic("Miles to gallons, then gallons to dollars.", `${m[1]} mi`, [{ top: "1 gal", bottom: `${m[2]} mi` }, { top: `$${m[3]}`, bottom: "1 gal" }], "$?");
  }
  if ((m = p.match(/You drive (\d+) miles using (\d+) gallons of gas/))) {
    return ratio("Miles and gallons scale together. Bring the gallons down to 1.", ["Miles", "Gallons"], [[m[1], null], [m[2], "1"]]);
  }
  if ((m = p.match(/A recipe makes (\d+) cookies with (\d+) cups of flour\. How many cups of flour do you need for (\d+) cookies/))) {
    return ratio("Cookies and cups scale together.", ["Cookies", "Cups of flour"], [[m[1], m[3]], [m[2], null]]);
  }
  if ((m = p.match(/A train travels at (\d+) miles per hour\. How many minutes does it take to go (\d+) miles/))) {
    return ratio("Miles and minutes scale together: the first column is one hour.", ["Miles", "Minutes"], [[m[1], m[2]], ["60", null]]);
  }
  if ((m = p.match(/A runner finishes (\d+) kilometers in (\d+) minutes\. At the same pace, how many minutes would (\d+) kilometers take/))) {
    return ratio("Same pace: kilometers and minutes scale together.", ["Kilometers", "Minutes"], [[m[1], m[3]], [m[2], null]]);
  }
  if ((m = p.match(/A (\d+)-ounce bag of trail mix costs \$([\d.]+)\. A (\d+)-ounce bag costs \$([\d.]+)/))) {
    return {
      kind: "table",
      title: "Each bag's price per ounce, then the difference between them.",
      reveals: false,
      corner: "",
      cols: ["Ounces", "Price", "Per ounce"],
      rows: ["Small bag", "Large bag"],
      cells: [
        [m[1], `$${m[2]}`, null],
        [m[3], `$${m[4]}`, null],
      ],
      totals: false,
    };
  }
  // "A recipe needs 750 mL of milk. How many liters is that?"
  if ((m = p.match(/(\d[\d,]*(?:\.\d+)?) (\w+) of .*?How many (\w+) is that/))) {
    const a = unitOf(m[2]);
    const b = unitOf(m[3]);
    if (!a || !b || a === b) return null;
    const path = conversionPath(a, b);
    if (!path) return null;
    return chainPic(`${qty(m[1], a)} times a factor equal to 1. The ${a} cancels, leaving ${b}.`, qty(m[1], a), path, `? ${b}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stories: tables, bars and lines
// ---------------------------------------------------------------------------

function systemTableFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  const table = (title: string, cols: string[], rows: string[], cells: (string | null)[][]): Picture => ({ kind: "table", title, reveals: false, corner: "", cols, rows, cells });
  if ((m = p.match(/Tickets cost \$(\d+) \(adult\) and \$(\d+) \(child\)\. (\d+) tickets sold for \$(\d+)/))) {
    return table("Two things to count: tickets, and the money they brought in. Each row is one kind of ticket.", ["Tickets", "$ each", "Money"], ["Adult", "Child", "Total"], [["a", `$${m[1]}`, `${m[1]}a`], ["c", `$${m[2]}`, `${m[2]}c`], [m[3], "", `$${m[4]}`]]);
  }
  if ((m = p.match(/made (\d+) baskets, all 2-pointers and 3-pointers, for (\d+) points/))) {
    return table("Two things to count: baskets, and points. Each row is one kind of shot.", ["Baskets", "Points each", "Points"], ["2-pointers", "3-pointers", "Total"], [["x", "2", "2x"], ["y", "3", "3y"], [m[1], "", m[2]]]);
  }
  if ((m = p.match(/have (\d+) coins, all quarters and dimes, worth \$([\d.]+)/))) {
    const cents = Math.round(Number(m[2]) * 100);
    return table("Two things to count: coins, and cents. Each row is one kind of coin.", ["Coins", "¢ each", "Cents"], ["Quarters", "Dimes", "Total"], [["q", "25", "25q"], ["d", "10", "10d"], [m[1], "", String(cents)]]);
  }
  if ((m = p.match(/mixes beans that cost \$(\d+) a pound with beans that cost \$(\d+) a pound\. It makes (\d+) pounds of a blend worth \$([\d.]+) a pound/))) {
    const total = Number(m[3]) * Number(m[4]);
    return table("Two things to count: pounds, and what they cost. Each row is one kind of bean.", ["Pounds", "$ per lb", "Cost"], [`$${m[1]} beans`, `$${m[2]} beans`, "Blend"], [["x", `$${m[1]}`, `${m[1]}x`], ["y", `$${m[2]}`, `${m[2]}y`], [m[3], `$${m[4]}`, money(total)]]);
  }
  if ((m = p.match(/A boat travels (\d+) miles downstream in (\d+) hours? and the same \d+ miles back upstream in (\d+) hours?/))) {
    const d = Number(m[1]);
    const down = d / Number(m[2]);
    const up = d / Number(m[3]);
    return {
      kind: "table",
      title: "Downstream the current pushes the boat along; upstream it holds it back. Speed is miles over hours.",
      reveals: false,
      corner: "",
      cols: ["Miles", "Hours", "Speed (mi/h)", "Boat and current"],
      rows: ["Downstream", "Upstream"],
      cells: [
        [m[1], m[2], fmt(down), "b + c"],
        [m[1], m[3], fmt(up), "b − c"],
      ],
      totals: false,
    };
  }
  if ((m = p.match(/Adult tickets cost \$(\d+) and student tickets cost \$(\d+)\. Ticket sales came to \$(\d+).*?If (\d+) adult tickets were sold/))) {
    return table("Each row is one kind of ticket: how many, the price, the money.", ["Tickets", "Price", "Money"], ["Adult", "Student", "Total"], [[m[4], `$${m[1]}`, null], [null, `$${m[2]}`, null], ["", "", `$${m[3]}`]]);
  }
  return null;
}

function tapeStoryFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/(\w+) is (\d+) times as old as (\w+)\. In (\d+) years, their ages will add up to (\d+)/))) {
    const [older, k, younger, wait, sum] = [m[1], Number(m[2]), m[3], Number(m[4]), Number(m[5])];
    const young = (sum - 2 * wait) / (k + 1);
    if (!(young > 0) || k > 6) return null;
    const unit = (): TapePart => ({ label: younger, size: young, kind: "unknown" });
    const more = (): TapePart => ({ label: `+${wait}`, size: wait, kind: "known" });
    return {
      kind: "tape",
      title: `${older}'s age is ${k} of ${younger}'s. In ${wait} years each is ${wait} older, and together they make ${sum}.`,
      reveals: false,
      rows: [
        { parts: Array.from({ length: k }, unit) },
        { parts: [unit()] },
        { parts: [...Array.from({ length: k }, unit), more(), unit(), more()], total: `${sum} in ${wait} years` },
      ],
    };
  }
  if ((m = p.match(/(\d+) pens? and (\d+) notebooks? cost \$(\d+)\. (\d+) pens? and (\d+) notebooks? cost \$(\d+)/))) {
    const [p1, n1, c1, p2, n2, c2] = m.slice(1, 7).map(Number);
    const det = p1 * n2 - p2 * n1;
    if (det === 0 || p1 > 8 || p2 > 8 || n1 > 8 || n2 > 8) return null;
    const pen = (c1 * n2 - c2 * n1) / det;
    const note = (p1 * c2 - p2 * c1) / det;
    if (!(pen > 0) || !(note > 0)) return null;
    const row = (pens: number, notes: number, cost: number) => ({
      parts: [...Array.from({ length: pens }, (): TapePart => ({ label: "p", size: pen, kind: "unknown" })), ...Array.from({ length: notes }, (): TapePart => ({ label: "n", size: note, kind: "unknown" }))],
      total: `$${cost}`,
    });
    return {
      kind: "tape",
      title: "Two bars. Whatever both have in common costs the same in both, so the difference in price comes from the difference in pens.",
      reveals: false,
      rows: [row(p1, n1, c1), row(p2, n2, c2)],
    };
  }
  if ((m = p.match(/has \$(\d+) to spend on a \$(\d+) shirt and some pairs of socks at \$(\d+) a pair/))) {
    const [budget, shirt, pair] = m.slice(1, 4).map(Number);
    if (shirt >= budget) return null;
    return {
      kind: "tape",
      title: `$${budget} at most: the shirt first, then as many $${pair} pairs as fit in what is left.`,
      reveals: false,
      rows: [{ parts: [{ label: `$${shirt} shirt`, size: shirt, kind: "known" }, { label: `$${pair} × ? pairs`, size: budget - shirt, kind: "unknown" }], total: `≤ $${budget}` }],
    };
  }
  if ((m = p.match(/plan costs \$(\d+) a month plus \$(\d+) for each movie rental\. \w+ can spend at most \$(\d+)/))) {
    const [plan, movie, budget] = m.slice(1, 4).map(Number);
    if (plan >= budget) return null;
    return {
      kind: "tape",
      title: `$${budget} at most: the plan first, then as many $${movie} movies as fit in what is left.`,
      reveals: false,
      rows: [{ parts: [{ label: `$${plan} plan`, size: plan, kind: "known" }, { label: `$${movie} × ? movies`, size: budget - plan, kind: "unknown" }], total: `≤ $${budget}` }],
    };
  }
  return null;
}

function linesStoryFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/can spend at most \$(\d+) on snacks\. Chips cost \$(\d+) a bag and drinks cost \$(\d+) each\.(?: \w+ buys (\d+) bags)?/))) {
    const [budget, chips, drinks] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const f = (x: number) => (budget - chips * x) / drinks;
    const vlines: PlaneVLine[] = [];
    const points: PlanePoint[] = [];
    if (m[4]) {
      const bags = Number(m[4]);
      vlines.push({ x: bags, tone: 2, dashed: true, label: `${bags} bags` });
      points.push({ x: bags, y: snap(f(bags)), tone: 2 });
    }
    const xMax = budget / chips;
    const yMax = budget / drinks;
    return {
      kind: "plane",
      title: m[4]
        ? "Every point under the line is a way to spend at most the budget. Go up from the bags bought to the line."
        : "Every point under the line is a way to spend at most the budget: bags of chips across, drinks up.",
      reveals: true,
      x: [0, niceRange([xMax], 4)[1]],
      y: [0, niceRange([yMax], 4)[1]],
      curves: [{ f, tone: 0, shade: "below", from: 0, label: `${chips}x + ${drinks}y ≤ ${budget}` }],
      vlines,
      points,
      segments: [],
      axes: ["bags of chips", "drinks"],
    };
  }
  if ((m = p.match(/sells cookies for \$(\d+) and brownies for \$(\d+)\. It wants to raise at least \$(\d+) and can bake at most (\d+) treats/))) {
    const [c, b, goal, most] = m.slice(1, 5).map(Number);
    const sales = (x: number) => (goal - c * x) / b;
    const count = (x: number) => most - x;
    return {
      kind: "plane",
      title: "Cookies across, brownies up. The money line is shaded above (at least), the treats line below (at most). A plan that works sits in both.",
      reveals: true,
      x: [0, niceRange([most, goal / c], 4)[1]],
      y: [0, niceRange([most, goal / b], 4)[1]],
      curves: [
        { f: sales, tone: 1, shade: "above", from: 0, label: `${c}x + ${b}y ≥ ${goal}` },
        { f: count, tone: 0, shade: "below", from: 0, label: `x + y ≤ ${most}` },
      ],
      vlines: [],
      points: [],
      segments: [],
      axes: ["cookies", "brownies"],
    };
  }
  if ((m = p.match(/A plant was ([\d.]+) cm tall on day (\d+) and ([\d.]+) cm tall on day (\d+)/))) {
    return triangle("Height against day. The slope of the line through the two readings is the growth per day.", [Number(m[2]), Number(m[1])], [Number(m[4]), Number(m[3])], ["day", "cm"]);
  }
  if ((m = p.match(/gas tank held (\d+) gallons at mile (\d+) and (\d+) gallons at mile (\d+)/))) {
    return triangle("Gallons against miles. The line falls: the rate of change is the drop over the distance.", [Number(m[2]), Number(m[1])], [Number(m[4]), Number(m[3])], ["miles", "gallons"]);
  }
  if ((m = p.match(/A (\d+)-mile ride costs \$(\d+), and a (\d+)-mile ride costs \$(\d+)/))) {
    return triangle("Cost against miles. The slope is the price per mile; where the line meets the cost axis is the flat fee.", [Number(m[1]), Number(m[2])], [Number(m[3]), Number(m[4])], ["miles", "$"]);
  }
  if ((m = p.match(/holds ([\d,]+) gallons of water and drains (\d+) gallons each minute/))) {
    const g = num(m[1]);
    const rate = Number(m[2]);
    const f = (t: number) => g - rate * t;
    return {
      kind: "plane",
      title: `Gallons left against minutes: it starts at ${fmt(g)} and falls ${rate} every minute.`,
      reveals: true,
      x: [0, niceRange([g / rate], 4)[1]],
      y: [0, niceRange([g], 4)[1]],
      curves: [{ f, tone: 0, from: 0, label: `g = ${fmt(g)} − ${rate}t` }],
      vlines: [],
      points: [{ x: 0, y: g, tone: 2 }],
      segments: [],
      axes: ["t (minutes)", "g (gallons)"],
    };
  }
  if ((m = p.match(/Job A pays \$([\d,]+) a day\. Job B pays \$1 on day 1 and doubles/))) {
    const a = num(m[1]);
    const fb = (x: number) => Math.pow(2, x - 1);
    let day = 1;
    while (fb(day) <= a && day < 30) day++;
    return {
      kind: "plane",
      title: "Pay against the day. Job A is a flat line; Job B doubles, so it starts tiny and then shoots past.",
      reveals: true,
      x: [0, day + 2],
      y: [0, niceRange([fb(day + 1)], 4)[1]],
      curves: [
        { f: () => a, tone: 0, from: 0, label: "Job A" },
        { f: fb, tone: 1, from: 1, label: "Job B" },
      ],
      vlines: [],
      points: [{ x: day, y: fb(day), tone: 2 }],
      segments: [],
      axes: ["day", "$"],
    };
  }
  if ((m = p.match(/Two towns each have ([\d,]+) people\. Town A gains ([\d,]+) people a year\. Town B grows (\d+)% a year\. .*?after (\d+) years/))) {
    const start = num(m[1]);
    const gain = num(m[2]);
    const rate = 1 + Number(m[3]) / 100;
    const n = Number(m[4]);
    const fa = (t: number) => start + gain * t;
    const fb = (t: number) => start * Math.pow(rate, t);
    const top = Math.max(fa(n + 1), fb(n + 1));
    return {
      kind: "plane",
      title: "People against years. Town A climbs by the same amount each year; Town B by a percent, so its curve bends upward.",
      reveals: true,
      x: [0, n + 1],
      y: [niceRange([start * 0.98], 4)[0], niceRange([top], 4)[1]],
      curves: [
        { f: fa, tone: 0, from: 0, label: "Town A" },
        { f: fb, tone: 1, from: 0, label: "Town B" },
      ],
      vlines: [{ x: n, tone: 2, dashed: true, label: `${n} years` }],
      points: [
        { x: n, y: fa(n), tone: 2 },
        { x: n, y: fb(n), tone: 2 },
      ],
      segments: [],
      axes: ["years", "people"],
    };
  }
  if ((m = p.match(/y is (-?\d+) when x = 0 and (-?\d+) when x = 2\. If y grows (linearly|exponentially), what is y when x = (\d+)/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const c = Number(m[4]);
    return plane(
      m[3] === "linearly" ? "The two readings. Linear growth adds the same amount each step." : "The two readings. Exponential growth multiplies by the same factor each step.",
      false,
      { points: [{ x: 0, y: a, tone: 0, label: `(0, ${a})` }, { x: 2, y: b, tone: 0, label: `(2, ${b})` }], vlines: [{ x: c, tone: 2, dashed: true, label: `x = ${c}` }] },
      { xs: [0, 2, c], ys: [0, a, b] }
    );
  }
  if ((m = p.match(/Line A has slope (-?\d+(?:\/\d+)?)/))) {
    const [t, u] = m[1].split("/").map(Number);
    const s = u ? t / u : t;
    return plane("Line A through the origin. A perpendicular line would cross it at a right angle.", false, { curves: [{ f: (x) => s * x, tone: 0, label: `A: slope ${m[1]}` }] }, { xs: [0, 4], ys: [0, 4 * s] });
  }
  if ((m = p.match(/slope of a (horizontal|vertical) line/))) {
    const horizontal = m[1] === "horizontal";
    return plane(
      horizontal ? "A horizontal line: it runs across and never rises." : "A vertical line: it rises and never runs across.",
      false,
      horizontal ? { curves: [{ f: () => 3, tone: 0, label: "y = 3" }] } : { vlines: [{ x: 3, tone: 0, label: "x = 3" }] },
      { xs: [0, 3], ys: [0, 3] }
    );
  }
  if ((m = p.match(/starts at (\d+) and multiplies by (\d+) each time x goes up by 1/))) {
    const a = Number(m[1]);
    const r = Number(m[2]);
    const values = [0, 1, 2, 3].map((k) => a * Math.pow(r, k));
    return { kind: "bars", title: `Each bar is the one before it times ${r}.`, reveals: false, labels: values.map((_, i) => `x = ${i}`), values, money: false };
  }
  if (/Which (?:is an exponential function|situation is modeled by an? (?:exponential|linear) function)/.test(p)) {
    return plane(
      "Linear adds the same amount each step and makes a straight line. Exponential multiplies by the same factor and bends upward.",
      false,
      { curves: [{ f: (x) => 2 * x, tone: 0, dashed: true, label: "linear: + 2 each step" }, { f: (x) => Math.pow(2, x), tone: 1, label: "exponential: × 2 each step" }] },
      { xs: [0, 5], ys: [0, 32] }
    );
  }
  return null;
}

function numberLineStoryFor(prompt: string): Picture | null {
  const p = plain(prompt);
  let m: RegExpMatchArray | null;
  if (/When do you flip the inequality sign/.test(p)) {
    return {
      kind: "numberline",
      title: "2 < 4. Multiply both by −1 and they land on the other side of zero in the opposite order, so the sign flips.",
      reveals: true,
      min: -6,
      max: 6,
      marks: [
        { x: 2, label: "2", tone: 0 },
        { x: 4, label: "4", tone: 0 },
        { x: -2, label: "−2", tone: 1 },
        { x: -4, label: "−4", tone: 1 },
      ],
      spans: [],
      arcs: [
        { from: 2, to: -2, label: "× −1" },
        { from: 4, to: -4, label: "× −1" },
      ],
    };
  }
  if ((m = p.match(/average of three test scores must be at least (\d+) and less than (\d+)/))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return {
      kind: "numberline",
      title: "Where the average has to land: from the low mark, included, up to the high one, not included.",
      reveals: false,
      min: a - 10,
      max: b + 10,
      marks: [
        { x: a, label: String(a), tone: 0 },
        { x: b, label: String(b), open: true, tone: 0 },
      ],
      spans: [{ from: a, to: b, tone: 0 }],
      arcs: [],
    };
  }
  if ((m = p.match(/x is between (-?\d+) and (-?\d+), inclusive/))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [min, max] = niceRange([a, b], 10);
    return { kind: "numberline", title: "The numbers from one end to the other, both ends included.", reveals: false, min, max, marks: [{ x: a, label: fmt(a), tone: 0 }, { x: b, label: fmt(b), tone: 0 }], spans: [{ from: a, to: b, tone: 0 }], arcs: [] };
  }
  if ((m = p.match(/fills bags with (\d+) grams of rice, give or take (\d+) grams/))) {
    const c = Number(m[1]);
    const d = Number(m[2]);
    return {
      kind: "numberline",
      title: `Weights within ${d} of ${c} pass: the same distance either side of the center.`,
      reveals: false,
      min: c - 3 * d,
      max: c + 3 * d,
      marks: [
        { x: c, label: String(c), tone: 1 },
        { x: c - d, label: String(c - d), tone: 0 },
        { x: c + d, label: String(c + d), tone: 0 },
      ],
      spans: [{ from: c - d, to: c + d, tone: 0 }],
      arcs: [
        { from: c, to: c - d, label: String(d) },
        { from: c, to: c + d, label: String(d) },
      ],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

function sequenceFor(skillId: string, prompt: string): Picture | null {
  const p = unsub(plain(prompt));
  let m: RegExpMatchArray | null;
  type Term = { label: string; value: string | null };
  if ((m = p.match(/a1 = (-?\d+) and d = (-?\d+)\. What is a(\d+)\?/))) {
    const a = Number(m[1]);
    const d = Number(m[2]);
    const n = Number(m[3]);
    if (n <= 4) return null;
    const terms: Term[] = [0, 1, 2, 3].map((i) => ({ label: `term ${i + 1}`, value: fmt(a + i * d) }));
    const steps: (string | null)[] = [1, 2, 3].map(() => (d >= 0 ? `+ ${d}` : `− ${-d}`));
    terms.push({ label: "...", value: "..." }, { label: `term ${n}`, value: null });
    steps.push(null, null);
    return { kind: "terms", title: `Each term is the one before it plus ${d}. Term ${n} is ${n - 1} steps from the first.`, reveals: false, terms, steps };
  }
  if ((m = p.match(/the (\d+)(?:st|nd|rd|th) term is (-?\d+) and the (\d+)(?:st|nd|rd|th) term is (-?\d+)\. What is the (common difference|first term)/))) {
    const i = Number(m[1]);
    const vi = m[2];
    const j = Number(m[3]);
    const vj = m[4];
    if (j <= i || j - i > 8) return null;
    const terms: Term[] = [];
    const steps: (string | null)[] = [];
    if (m[5] === "first term") {
      terms.push({ label: "term 1", value: null });
      if (i > 2) {
        terms.push({ label: "...", value: "..." });
        steps.push(null);
      }
      steps.push(null);
    }
    terms.push({ label: `term ${i}`, value: fmt(Number(vi)) });
    for (let k = i + 1; k < j; k++) {
      terms.push({ label: `term ${k}`, value: null });
      steps.push(null);
    }
    terms.push({ label: `term ${j}`, value: fmt(Number(vj)) });
    steps.push(null);
    return {
      kind: "terms",
      title: `${j - i} equal steps take term ${i} to term ${j}.${m[5] === "first term" ? " The same step, backwards, leads to the first term." : ""}`,
      reveals: false,
      terms,
      steps,
    };
  }
  if ((m = p.match(/Row 1 of a theater has (\d+) seats, and each row has (\d+) more seats than the row in front of it\. How many seats are in row (\d+)/))) {
    const a = Number(m[1]);
    const d = Number(m[2]);
    const n = Number(m[3]);
    if (n <= 4) return null;
    const terms: Term[] = [0, 1, 2, 3].map((i) => ({ label: `row ${i + 1}`, value: fmt(a + i * d) }));
    const steps: (string | null)[] = [1, 2, 3].map(() => `+ ${d}`);
    terms.push({ label: "...", value: "..." }, { label: `row ${n}`, value: null });
    steps.push(null, null);
    return { kind: "terms", title: `Each row has ${d} more seats than the one in front.`, reveals: false, terms, steps };
  }
  if ((m = p.match(/a1 = (\d+) and r = (\d+)\. Which term is ([\d,]+)\?/))) {
    const a = Number(m[1]);
    const r = Number(m[2]);
    const target = num(m[3]);
    const terms: Term[] = [0, 1, 2].map((i) => ({ label: `term ${i + 1}`, value: fmt(a * Math.pow(r, i)) }));
    const steps: (string | null)[] = [`× ${r}`, `× ${r}`];
    terms.push({ label: "...", value: "..." }, { label: "term ?", value: fmt(target) });
    steps.push(null, null);
    return { kind: "terms", title: `Each term is the one before it times ${r}. Keep multiplying until you reach ${fmt(target)}, and count the terms.`, reveals: false, terms, steps };
  }
  if ((m = p.match(/dropped from (\d+) feet\. Each bounce reaches (\d+)\/(\d+) of the height before it\. How high.*?on bounce (\d+)/))) {
    const h = Number(m[1]);
    const f = Number(m[2]) / Number(m[3]);
    const n = Number(m[4]);
    if (n > 6) return null;
    const values = Array.from({ length: n + 1 }, (_, i) => h * Math.pow(f, i));
    return { kind: "bars", title: `Each bounce is ${m[2]}/${m[3]} of the one before.`, reveals: true, labels: values.map((_, i) => (i === 0 ? "Drop" : `Bounce ${i}`)), values, money: false };
  }
  void skillId;
  return null;
}

// ---------------------------------------------------------------------------
// Products, factoring, parabolas, transformations
// ---------------------------------------------------------------------------

function areaMoreFor(prompt: string): Picture | null {
  const p = caret(plain(prompt));
  let m: RegExpMatchArray | null;
  const sgn = (s: string) => (s === "-" ? "−" : "+");
  if ((m = p.match(/Expand \((\d*)x ([+-]) (\d+)\)\((\d*)x\^2 ([+-]) (\d*)x ([+-]) (\d+)\)/))) {
    const cols = [`${m[4]}x²`, `${sgn(m[5])}${m[6]}x`, `${sgn(m[7])}${m[8]}`];
    const rows = [`${m[1]}x`, `${sgn(m[2])}${m[3]}`];
    return { kind: "area", title: "Each part of the binomial times each part of the trinomial: six boxes, then add them up.", reveals: false, cols, rows, cells: rows.map(() => cols.map(() => null)) };
  }
  if ((m = p.match(/work out (\d+) × (\d+) without/))) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const mid = (a + b) / 2;
    const d = (b - a) / 2;
    if (mid % 1 || d % 1) return null;
    return { kind: "area", title: `${a} is ${mid} − ${d} and ${b} is ${mid} + ${d}. The two middle boxes cancel.`, reveals: false, cols: [String(mid), `+${d}`], rows: [String(mid), `−${d}`], cells: [[null, null], [null, null]] };
  }
  if ((m = p.match(/work out (\d+)\^2 without/))) {
    const n = Number(m[1]);
    const ten = Math.round(n / 10) * 10;
    const d = n - ten;
    if (d === 0) return null;
    const side = `${ten}${d < 0 ? ` − ${-d}` : ` + ${d}`}`;
    return { kind: "area", title: `${n} is ${side}. Square it as four boxes.`, reveals: false, cols: [String(ten), `${d < 0 ? "−" : "+"}${Math.abs(d)}`], rows: [String(ten), `${d < 0 ? "−" : "+"}${Math.abs(d)}`], cells: [[null, null], [null, null]] };
  }
  if ((m = p.match(/^Factor (?:completely: )?(\d*)x\^(2|4) - (\d+)$/))) {
    const a = Number(m[1] || 1);
    const pow = m[2];
    const c = Number(m[3]);
    const g = gcd(a, c);
    const sq = pow === "4" ? "x²" : "x";
    if (g > 1) {
      return { kind: "area", title: `Take out the common factor ${g} first, then factor what is inside.`, reveals: true, cols: [`${a / g === 1 ? "" : a / g}${sq}²`.replace("x²²", "x⁴"), `−${c / g}`], rows: [String(g)], cells: [[`${a === 1 ? "" : a}${pow === "4" ? "x⁴" : "x²"}`, `−${c}`]] };
    }
    return { kind: "area", title: `A difference of squares: the corners are known, the middle boxes cancel, and the sides are what is asked.`, reveals: false, cols: [sq, "?"], rows: [sq, "?"], cells: [[`${a === 1 ? "" : a}${pow === "4" ? "x⁴" : "x²"}`, null], [null, `−${c}`]] };
  }
  return null;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

/** The parabola, with its axis of symmetry drawn through the turn. */
function axisFor(prompt: string): Picture | null {
  const m = plain(prompt).match(/axis of symmetry of y = (.+?) is the line x = k/);
  if (!m) return null;
  const expr = extractMath(`y = ${m[1]}`).chains[0]?.chain.exprs[1];
  if (!expr) return null;
  const f = (x: number) => evalSafe(expr, { x });
  const a = (f(2) - 2 * f(1) + f(0)) / 2;
  const b = f(1) - f(0) - a;
  if (!Number.isFinite(a) || Math.abs(a) < 1e-9) return null;
  const vx = snap(-b / (2 * a));
  const feat = features(f, vx - 12, vx + 12);
  return plane(
    "The parabola and its axis of symmetry: the dashed line through the turn, with a mirror image on each side.",
    true,
    { curves: [{ f, tone: 0, label: `y = ${m[1]}` }], vlines: [{ x: vx, tone: 2, dashed: true }], points: [{ x: vx, y: f(vx), tone: 2 }] },
    { xs: [vx - 4, vx + 4, 0], ys: [f(vx), f(vx + 4), ...feat.ys] }
  );
}

function transformMoreFor(prompt: string): Picture | null {
  const p = caret(plain(prompt));
  let m: RegExpMatchArray | null;
  const parentOf = (s: string): [(x: number) => number, string] => (s.includes("|") ? [(x) => Math.abs(x), "y = |x|"] : [(x) => x * x, "y = x²"]);
  const show = (parent: PlaneCurve, moved: PlaneCurve, points: PlanePoint[], title: string, xs: number[], ys: number[]) => plane(title, true, { curves: [parent, moved], points }, { xs, ys });
  if ((m = p.match(/Move y = (x\^2|\|x\|) (right|left) (\d+) units? and (up|down) (\d+)/))) {
    const [pf, name] = parentOf(m[1]);
    const h = (m[2] === "right" ? 1 : -1) * Number(m[3]);
    const v = (m[4] === "up" ? 1 : -1) * Number(m[5]);
    const g = (x: number) => pf(x - h) + v;
    return show({ f: pf, tone: 1, dashed: true, label: name }, { f: g, tone: 0, label: "moved" }, [{ x: h, y: v, tone: 2 }], `${name} dashed, and the same shape moved ${m[2]} ${m[3]} and ${m[4]} ${m[5]}. Its turn lands at (${h}, ${v}).`, [0, h, h - 3, h + 3], [0, v, g(h + 3)]);
  }
  if ((m = p.match(/y = (x\^2|\|x\|) stretched by a factor of (\d+) and then moved (up|down) (\d+)/))) {
    const [pf, name] = parentOf(m[1]);
    const a = Number(m[2]);
    const v = (m[3] === "up" ? 1 : -1) * Number(m[4]);
    const g = (x: number) => a * pf(x) + v;
    return show({ f: pf, tone: 1, dashed: true, label: name }, { f: g, tone: 0, label: "stretched and moved" }, [{ x: 0, y: v, tone: 2 }], `${name} dashed. Stretching by ${a} makes it ${a} times as steep; then the whole thing moves ${m[3]} ${m[4]}.`, [-3, 0, 3], [0, v, g(2)]);
  }
  if ((m = p.match(/g\(x\) = f\(x ([+-]) (\d+)\) ([+-]) (\d+), find g\((-?\d+)\)/))) {
    const def = extractMath(p).defs.find((d) => d.name === "f");
    if (!def) return null;
    const f = (x: number) => evalSafe(def.body, { [def.arg]: x });
    const h = (m[1] === "-" ? 1 : -1) * Number(m[2]);
    const v = (m[3] === "+" ? 1 : -1) * Number(m[4]);
    const g = (x: number) => f(x - h) + v;
    const c = Number(m[5]);
    return show({ f, tone: 1, dashed: true, label: "f" }, { f: g, tone: 0, label: "g" }, [{ x: c, y: g(c), tone: 2 }], `f dashed, and g: f moved ${h >= 0 ? "right" : "left"} ${Math.abs(h)} and ${v >= 0 ? "up" : "down"} ${Math.abs(v)}. The dot is g at x = ${c}.`, [0, c, h, h - 3, h + 3], [0, g(c), f(0), g(h + 3)]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// What is known, and what is asked: the last resort
// ---------------------------------------------------------------------------

function givensFor(prompt: string): Picture | null {
  const p = plain(prompt).replace(/\s+/g, " ");
  const known: { value: string; label: string }[] = [];
  for (const m of p.matchAll(/(\$?\d[\d,]*(?:\.\d+)?%?)(?:-| )([a-zA-Z][a-zA-Z-]*(?: [a-z]+)?)/g)) {
    const value = m[1];
    const label = m[2].replace(/\b(a|an|the|of|in|for|and|to|at|is|are|per|each|every)\b.*$/, "").trim();
    if (!label || /^(and|to|in|for|is|are|of|at|on|per|each)$/.test(label)) continue;
    if (known.some((k) => k.value === value && k.label === label)) continue;
    known.push({ value, label });
    if (known.length === 6) break;
  }
  if (known.length < 2) return null;
  const q = p.split(/(?<=[.!?])\s+/).find((s) => s.includes("?")) ?? "";
  const want = q.replace(/^(?:How (?:many|much|far|high|long|old)|What(?: is| are)?|Which|Find|For how many|At what)\s*/i, "").replace(/\?.*$/, "").replace(/^(the|a|an)\s+/i, "").trim();
  return { kind: "givens", title: "What the problem gives, and what it asks for.", reveals: false, known, want: want ? want.charAt(0).toUpperCase() + want.slice(1) : "the answer" };
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** A picture for a problem the base set left blank, or null. */
export function morePictures(skillId: string, prompt: string): Picture | null {
  switch (skillId) {
    case "unit-basics":
    case "dimensional-analysis":
    case "unit-word-problems":
      return ratesFor(prompt) ?? givensFor(prompt);
    case "one-step-equations":
    case "two-step-equations":
    case "multi-step-equations":
      return balanceFor(prompt) ?? givensFor(prompt);
    case "equations-with-fractions":
      return stripsFor(prompt) ?? balanceFor(prompt);
    case "literal-equations":
      return literalRect(prompt) ?? balanceFor(prompt);
    case "function-notation":
      return levelFor(prompt) ?? balanceFor(prompt);
    case "absolute-value":
      return absLevelFor(prompt);
    case "exponent-rules":
      return factorsFor(prompt);
    case "negative-fractional-exponents":
      return ladderFor(prompt) ?? rootTableFor(prompt) ?? addExponentsFor(prompt) ?? factorsFor(prompt);
    case "scientific-notation":
      return digitsFor(prompt);
    case "simplifying-radicals":
      return squaresFor(prompt) ?? literalRect(prompt);
    case "trend-lines":
      return scattersFor(prompt);
    case "linear-inequalities":
    case "compound-inequalities":
    case "absolute-value-inequalities":
      return numberLineStoryFor(prompt) ?? tapeStoryFor(prompt) ?? givensFor(prompt);
    case "slope":
    case "intercepts":
    case "slope-intercept":
    case "point-slope":
    case "parallel-perpendicular":
    case "function-graphs":
      return linesStoryFor(prompt) ?? slopeTriangleFor(prompt) ?? pointsPicture(prompt, "The points on the grid.");
    case "standard-form":
    case "substitution":
    case "elimination":
    case "systems-word-problems":
      return systemTableFor(prompt) ?? tapeStoryFor(prompt) ?? givensFor(prompt);
    case "graphing-inequalities":
    case "systems-inequalities":
      return linesStoryFor(prompt) ?? givensFor(prompt);
    case "arithmetic-sequences":
    case "geometric-sequences":
      return sequenceFor(skillId, prompt) ?? givensFor(prompt);
    case "exponential-functions":
    case "linear-vs-exponential":
      return linesStoryFor(prompt) ?? pointsPicture(prompt, "The points the function passes through.") ?? givensFor(prompt);
    case "multiplying-binomials":
    case "special-products":
    case "factoring-special":
      return areaMoreFor(prompt);
    case "graphing-parabolas":
      return axisFor(prompt);
    case "function-transformations":
      return transformMoreFor(prompt);
    default:
      return balanceFor(prompt) ?? givensFor(prompt);
  }
}

/** Two points written as (a, b), with the rise and run between them. */
function slopeTriangleFor(prompt: string): Picture | null {
  const pts = pointsIn(prompt);
  if (pts.length !== 2 || pts[0][0] === pts[1][0]) return null;
  return triangle("The two points, with the run across and the rise up between them.", pts[0], pts[1], ["x", "y"]);
}
