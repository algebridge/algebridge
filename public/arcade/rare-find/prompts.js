// Rare Find math prompts. Pure logic, no DOM, so node can test it. The general prompts live in bank.js.
// Every prompt has many right answers. Rarity is computed from the math itself with an
// "ease" model per prompt type (how quickly a typical person would land on that answer),
// never from player data. ease 1 = the first thing anyone would say, ease 0 = well hidden.
import { rng, int, pick, shuffle, factors, isPrime, gcd } from "../kit/math.js";
import { pickBank } from "./bank.js";

// ---------- exact fractions ----------
const LIMIT = 1e15;
const F = (n, d = 1) => {
  if (d < 0) { n = -n; d = -d; }
  const k = gcd(Math.abs(n), d) || 1;
  return { n: n / k, d: d / k };
};
const fAdd = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
const fSub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
const fMul = (a, b) => F(a.n * b.n, a.d * b.d);
const fDiv = (a, b) => F(a.n * b.d, a.d * b.n);
const fEq = (a, b) => a.n === b.n && a.d === b.d;
const isInt = (a) => a.d === 1;
const num = (a) => a.n / a.d;
const tooBig = (a) => !Number.isFinite(a.n) || !Number.isFinite(a.d) || Math.abs(a.n) > LIMIT || a.d > LIMIT;
export function fmt(a) {
  if (a.d === 1) return String(a.n);
  const dec = a.n / a.d;
  const s = String(Math.round(dec * 1000) / 1000);
  return Math.abs(dec * 1000 - Math.round(dec * 1000)) < 1e-9 ? s : `${a.n}/${a.d}`;
}

// ---------- a small safe expression parser: + - × * / ÷ ^ and parentheses ----------
class Oops extends Error {}
const bad = (m) => { throw new Oops(m); };
function tokenize(src) {
  const s = src.replace(/[×xX·*]/g, "*").replace(/[÷:]/g, "/").replace(/[−–]/g, "-");
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const t = s.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) bad(`I could not read the number ${t}.`);
      if (t.replace(".", "").length > 12) bad("That number is too long for me.");
      const [whole, frac = ""] = t.split(".");
      out.push({ t: "n", v: F(Number((whole || "0") + frac), 10 ** frac.length), dec: frac.length > 0 });
      i = j;
      continue;
    }
    if ("+-*/^()".includes(c)) { out.push({ t: c }); i++; continue; }
    bad(`I do not know the symbol ${c}. Use numbers and + - × / ^ ( ).`);
  }
  return out;
}
/**
 * parseExpr("2^3 + 4") gives { ok, value: {n, d}, ops: [{ op, trivial }], parens, fancy }.
 * fancy is true when a negative number or a decimal is used. Never uses eval.
 */
export function parseExpr(src) {
  try {
    if (src.length > 40) bad("Keep it under 40 characters.");
    const toks = tokenize(src);
    if (!toks.length) bad("Type an answer first.");
    let p = 0;
    const ops = [];
    let parens = 0, fancy = false;
    const peek = () => toks[p]?.t;
    const guard = (v) => (tooBig(v) ? bad("That number gets too big for me.") : v);
    const record = (op, a, b) => {
      const A = num(a), B = num(b);
      const trivial = op === "+" ? A === 0 || B === 0 : op === "-" ? B === 0 : op === "*" ? A === 1 || B === 1 : op === "/" ? B === 1 : B === 1 || A === 1 || A === 0;
      ops.push({ op, trivial });
    };
    const expr = () => {
      let a = term();
      while (peek() === "+" || peek() === "-") {
        const op = toks[p++].t;
        const b = term();
        record(op, a, b);
        a = guard(op === "+" ? fAdd(a, b) : fSub(a, b));
      }
      return a;
    };
    const term = () => {
      let a = unary();
      for (;;) {
        let op = peek();
        if (op === "(" || op === "n") op = "implicit";
        else if (op !== "*" && op !== "/") break;
        if (op === "implicit") {
          if (peek() === "n") bad("Put an operation between the two numbers.");
          const b = unary();
          record("*", a, b);
          a = guard(fMul(a, b));
          continue;
        }
        p++;
        const b = unary();
        if (op === "/" && b.n === 0) bad("Dividing by 0 does not work.");
        record(op, a, b);
        a = guard(op === "*" ? fMul(a, b) : fDiv(a, b));
      }
      return a;
    };
    const unary = () => {
      if (peek() === "-") { p++; fancy = true; const v = unary(); return F(-v.n, v.d); }
      if (peek() === "+") { p++; return unary(); }
      return power();
    };
    const power = () => {
      const base = atom();
      if (peek() !== "^") return base;
      p++;
      const e = unary();
      if (!isInt(e)) bad("Powers need a whole number on top.");
      if (Math.abs(e.n) > 12) bad("That power is too big for me.");
      if (base.n === 0 && e.n <= 0) bad("0 to that power does not work.");
      record("^", base, e);
      let v = F(1);
      for (let i = 0; i < Math.abs(e.n); i++) v = guard(fMul(v, base));
      return e.n < 0 ? fDiv(F(1), v) : v;
    };
    const atom = () => {
      const t = toks[p];
      if (!t) bad("It looks like something is missing at the end.");
      if (t.t === "n") { p++; if (t.dec) fancy = true; return t.v; }
      if (t.t === "(") {
        p++;
        parens++;
        const v = expr();
        if (peek() !== ")") bad("A ( needs a matching ).");
        p++;
        return v;
      }
      bad(t.t === ")" ? "There is a ) without a (." : `The ${t.t === "*" ? "×" : t.t} needs a number before it.`);
    };
    const value = expr();
    if (p < toks.length) bad(toks[p].t === ")" ? "There is a ) without a (." : "I could not read that all the way through.");
    return { ok: true, value, ops, parens, fancy };
  } catch (e) {
    if (e instanceof Oops) return { ok: false, error: e.message };
    throw e;
  }
}
/** A plain number: 12, -2.5, or a fraction like -5/2. Returns { v, kind: "int" | "dec" | "frac", places } or null. */
function readNumber(text) {
  const s = text.trim().replace(/[−–]/g, "-").replace(/\s+/g, "");
  let m = /^(-?)(\d{1,12})(?:\.(\d{1,9}))?$/.exec(s);
  if (m) {
    const frac = m[3] || "";
    const v = F(Number(m[2] + frac) * (m[1] ? -1 : 1), 10 ** frac.length);
    return { v, kind: frac ? "dec" : "int", places: frac.replace(/0+$/, "").length };
  }
  m = /^(-?\d{1,9}(?:\.\d{1,6})?)\/(-?\d{1,9}(?:\.\d{1,6})?)$/.exec(s);
  if (m) {
    const a = readNumber(m[1]), b = readNumber(m[2]);
    if (!a || !b || b.v.n === 0) return b && b.v.n === 0 ? { zero: true } : null;
    return { v: fDiv(a.v, b.v), kind: "frac", top: a, bottom: b };
  }
  return null;
}
const readWhole = (text) => {
  const s = text.trim().replace(/[−–]/g, "-").replace(/[\s,]/g, "");
  return /^-?\d{1,15}$/.test(s) ? Number(s) : null;
};

// ---------- rarity ----------
export const TIERS = ["Common", "Uncommon", "Rare", "Very rare"];
export const tierOf = (pts) => (pts >= 85 ? 3 : pts >= 60 ? 2 : pts >= 35 ? 1 : 0);
const pts = (ease) => Math.round(10 + 90 * (1 - Math.max(0, Math.min(1, ease))));
/** For a finite answer list: the easiest answer scores 10 and the best hidden one scores 100. */
function spread(answers, easeOf) {
  const e = answers.map(easeOf);
  const lo = Math.min(...e), hi = Math.max(...e);
  const map = new Map();
  answers.forEach((a, i) => map.set(a, hi === lo ? 55 : Math.round(10 + (90 * (hi - e[i])) / (hi - lo))));
  return map;
}
const reject = (msg) => ({ status: "reject", msg });
const wrong = (shown, msg) => ({ status: "wrong", shown, msg, points: 0 });
const ok = (shown, points, why) => ({ status: "ok", shown, points, why, tier: tierOf(points) });
const WHOLE = "Type a positive whole number.";

// How quickly a number comes to mind as a factor or a divisor.
function smallEase(k) {
  if (k <= 2) return 1;
  if (k === 3 || k === 5 || k === 10) return 0.85;
  if (k === 4 || k === 6) return 0.7;
  if (k <= 9) return 0.55;
  if (k <= 12) return 0.4;
  if (k % 10 === 0 && k <= 100) return k === 100 ? 0.5 : 0.45;
  if (k <= 15) return 0.28;
  if (k <= 20) return 0.18;
  if (k <= 30) return 0.1;
  return 0.04;
}

const MAKERS = {
  factor(r) {
    const N = pick(r, [360, 240, 180, 420, 144, 210, 300, 336, 120, 96, 480, 504, 600, 252]);
    const all = factors(N);
    const table = spread(all, (f) => (f === N ? 0.9 : Math.max(smallEase(f), 0.75 * smallEase(N / f))));
    return {
      text: `Name a factor of ${N}`, hint: "A whole number that divides it evenly.", sample: "like 2",
      all: all.map(String),
      judge(input) {
        const v = readWhole(input);
        if (v == null || v <= 0) return reject(WHOLE);
        if (N % v) return wrong(v, v > N ? `${v} is bigger than ${N}, so it cannot divide it.` : `${N} ÷ ${v} leaves a remainder of ${N % v}.`);
        const p = table.get(v);
        return ok(v, p, v === N ? `${N} is a factor of itself. Easy to spot.` : `${v} × ${N / v} = ${N}.` + (p >= 60 ? " A middle factor hides well." : ""));
      },
    };
  },
  prime(r) {
    const [a, b] = pick(r, [[30, 80], [20, 60], [40, 100], [50, 100], [10, 50], [60, 110], [70, 120]]);
    const all = [];
    for (let v = a + 1; v < b; v++) if (isPrime(v)) all.push(v);
    const table = spread(all, (v) => {
      const i = all.indexOf(v), j = all.length - 1 - i;
      return Math.max(0.9 * Math.exp(-i / 2.5), 0.55 * Math.exp(-j / 2)) * (v % 10 === 7 || v % 10 === 9 ? 0.85 : 1);
    });
    return {
      text: `Name a prime between ${a} and ${b}`, hint: "Only 1 and itself divide a prime.", sample: "a whole number",
      all: all.map(String),
      judge(input) {
        const v = readWhole(input);
        if (v == null || v <= 0) return reject(WHOLE);
        if (v <= a || v >= b) return wrong(v, `${v} is not between ${a} and ${b}.`);
        if (!isPrime(v)) { const f = factors(v)[1]; return wrong(v, `${v} = ${f} × ${v / f}, so it is not prime.`); }
        const p = table.get(v);
        return ok(v, p, p >= 60 ? `${v} is prime, and it sits deep inside the range.` : `${v} is prime. It is near an end of the range, where the eye goes first.`);
      },
    };
  },
  multiple(r) {
    const k = pick(r, [6, 7, 8, 9, 12, 13, 14]);
    const L = pick(r, [100, 120, 150, 200]);
    const all = [];
    for (let v = k; v < L; v += k) all.push(v);
    const top = all[all.length - 1];
    const table = spread(all, (v) => {
      const j = v / k;
      const e = j === 1 ? 1 : j === 2 || j === 10 ? 0.9 : j === 3 ? 0.75 : j === 5 ? 0.7 : j === 4 ? 0.6 : j <= 9 ? 0.45 : j === 11 ? 0.4 : j === 12 ? 0.35 : 0.3 * Math.exp(-(j - 12) / 6);
      return v === top ? Math.max(e, 0.3) : e;
    });
    return {
      text: `Name a positive multiple of ${k} under ${L}`, hint: `${k} times a whole number.`, sample: `like ${k}`,
      all: all.map(String),
      judge(input) {
        const v = readWhole(input);
        if (v == null || v <= 0) return reject(WHOLE);
        if (v % k) return wrong(v, `${v} ÷ ${k} leaves a remainder of ${v % k}.`);
        if (v >= L) return wrong(v, `${v} is a multiple of ${k}, but it is not under ${L}.`);
        return ok(v, table.get(v), `${k} × ${v / k} = ${v}.`);
      },
    };
  },
  square(r) {
    const L = pick(r, [300, 400, 500, 700, 1000]);
    const all = [];
    for (let q = 0; q * q < L; q++) all.push(q * q);
    const table = spread(all, (v) => {
      const q = Math.round(Math.sqrt(v));
      if (q === 0) return 0.12;
      if (q === 1) return 0.7;
      if (q <= 5 || q === 10) return q <= 3 ? 0.95 : 0.9;
      if (q <= 9) return 0.7;
      if (q <= 12) return 0.5;
      if (q === 20 || q === 30) return 0.42;
      if (q === 25 || q === 15) return 0.33;
      if (q <= 15) return 0.3;
      if (q <= 20) return 0.2;
      return 0.1;
    });
    return {
      text: `Name a perfect square under ${L}`, hint: "A whole number times itself.", sample: "like 4",
      all: all.map(String),
      judge(input) {
        const v = readWhole(input);
        if (v == null || v < 0) return reject("Type a whole number.");
        const q = Math.floor(Math.sqrt(v));
        if (q * q !== v) return wrong(v, `${v} sits between ${q} × ${q} = ${q * q} and ${q + 1} × ${q + 1} = ${(q + 1) * (q + 1)}.`);
        if (v >= L) return wrong(v, `${v} is a perfect square, but it is not under ${L}.`);
        return ok(v, table.get(v), v === 0 ? "0 × 0 = 0. Zero counts, and it is easy to forget." : `${q} × ${q} = ${v}.`);
      },
    };
  },
  pair(r) {
    const [a, b] = pick(r, [[2, 1], [1, 1], [3, 1], [1, 2], [2, 3], [3, 2], [1, 3], [4, 1]]);
    const c = (a * b) / gcd(a, b) * int(r, 2, 6);
    const eq = `${a === 1 ? "" : a}x + ${b === 1 ? "" : b}y = ${c}`;
    const judge = (input) => {
      const s = input.replace(/[xXyY]\s*=/g, "").replace(/[()\[\]]/g, "").trim();
      let parts = s.split(/[;,]/).map((t) => t.trim()).filter(Boolean);
      if (parts.length !== 2) parts = s.split(/\s+/).filter(Boolean);
      if (parts.length !== 2) return reject("Type two numbers with a comma, like 2, 6.");
      const X = readNumber(parts[0]), Y = readNumber(parts[1]);
      if (!X?.v || !Y?.v) return reject("Type two numbers with a comma, like 2, 6.");
      const x = X.v, y = Y.v;
      const shown = `(${fmt(x)}, ${fmt(y)})`;
      const got = fAdd(fMul(F(a), x), fMul(F(b), y));
      if (!fEq(got, F(c))) return wrong(shown, `${a === 1 ? "" : a + " × "}${fmt(x)} + ${b === 1 ? "" : b + " × "}${fmt(y)} = ${fmt(got)}, not ${c}.`);
      const whole = isInt(x) && isInt(y), neg = x.n < 0 || y.n < 0;
      let e, why;
      if (!whole) { e = neg ? 0.03 : 0.12; why = neg ? "A fraction and a negative together. That is far off the usual path." : "Fractions and decimals work too. That is off the usual path."; }
      else if (x.n === 0 || y.n === 0) { e = 0.95; why = "That is an intercept. It is the first point to try."; }
      else if (neg) { e = Math.max(Math.abs(x.n), Math.abs(y.n)) <= 20 ? 0.3 : 0.18; why = "The line keeps going past the axes, so negatives work."; }
      else { e = x.n === 1 || y.n === 1 || x.n === y.n ? 0.8 : 0.65; why = "Small positive whole numbers are easy to find by counting up."; }
      return ok(shown, pts(e), why);
    };
    const xs = [F(0), F(c, a), F(1), F(2), F(-1), F(-3), F(c / a + 2), F(1, 2), F(-1, 2), F(3, 2), F(25)];
    return {
      text: `Give a pair (x, y) that solves ${eq}`, hint: "Type x, then a comma, then y.", sample: "like 2, 6",
      all: xs.map((x) => `${fmt(x)}, ${fmt(fDiv(fSub(F(c), fMul(F(a), x)), F(b)))}`),
      judge,
    };
  },
  expression(r) {
    const T = pick(r, [12, 24, 18, 20, 36, 16, 30, 40, 48]);
    const W = { "+": 8, "*": 14, "-": 20, "/": 32, "^": 45 };
    const NAME = { "+": "+", "*": "×", "-": "-", "/": "÷", "^": "^" };
    const judge = (input) => {
      const res = parseExpr(input);
      if (!res.ok) return reject(res.error);
      if (!res.ops.length) return reject("Use at least one operation, like 3 × 4.");
      const shown = input.trim().replace(/\s+/g, " ").replace(/\*/g, "×");
      if (!fEq(res.value, F(T))) return wrong(shown, `That equals ${fmt(res.value)}, not ${T}.`);
      const real = res.ops.filter((o) => !o.trivial);
      const kinds = [...new Set(real.map((o) => o.op))];
      let p = 10;
      for (const k of kinds) p += W[k];
      p += 6 * Math.min(3, real.length - kinds.length);
      if (res.parens && real.length >= 2) p += 8;
      if (res.fancy && real.length) p += 8;
      p = Math.min(100, p);
      const why = !real.length ? "Adding 0 or multiplying by 1 changes nothing, so this is the plain number in disguise."
        : kinds.length === 1 && real.length === 1 ? `One ${NAME[kinds[0]]} step. ${W[kinds[0]] >= 32 ? "That operation is a less obvious pick." : "That is the most obvious kind."}`
        : `${real.length} steps using ${kinds.map((k) => NAME[k]).join(" and ")}. More steps and less common operations are rarer.`;
      return ok(shown, p, why);
    };
    const sq = Math.ceil(Math.sqrt(T + 1));
    const all = [`${T - 2} + 2`, `${T / 2} × 2`, `${T + 5} - 5`, `${T * 3} / 3`, `2 × ${T / 2 - 1} + 2`, `(${T / 2 - 3} + 3) × 2`, `${sq}^2 - ${sq * sq - T}`, `${T * 2} / 4 × 2`, `2^3 + ${T - 8}`, `(${sq}^2 - ${sq * sq - T}) × 6 / 6`, `${sq}^2 - ${(sq * sq - T) * 2} / 2`];
    return { text: `Write an expression equal to ${T}`, hint: "Use + - × / ^ and ( ).", sample: "like 3 × 4", all, judge };
  },
  digits(r) {
    const S = pick(r, [9, 10, 12, 15, 7, 8, 11]);
    const judge = (input) => {
      const s = input.trim().replace(/[\s,]/g, "");
      if (!/^\d{1,15}$/.test(s) || /^0+$/.test(s)) return reject(WHOLE);
      const t = s.replace(/^0+/, "");
      const ds = [...t].map(Number);
      const sum = ds.reduce((a, b) => a + b, 0);
      if (sum !== S) return wrong(t, `${ds.join(" + ")} = ${sum}, not ${S}.`);
      const d = ds.length, noZero = !ds.includes(0);
      const e = d === 1 ? 0.95 : d === 2 ? 0.75 : d === 3 ? (noZero ? 0.35 : 0.48) : Math.max(0.04, 0.28 - 0.06 * (d - 4) - (noZero ? 0.08 : 0));
      return ok(t, pts(e), d <= 2 ? `${ds.join(" + ")} = ${S}. Short numbers come to mind first.` : `${ds.join(" + ")} = ${S}. Longer numbers work too, and they hide better.`);
    };
    const hi = Math.min(9, S), two = S <= 9 ? `${S}0` : `${hi}${S - hi}`;
    const all = [S <= 9 ? String(S) : two, two, `${Math.min(9, S - 1)}${S - Math.min(9, S - 1)}`.replace(/^(\d)0$/, "1$1"), `${hi}0${S - hi || ""}`.padEnd(3, "0"), `1${Math.min(9, S - 2)}${S - 1 - Math.min(9, S - 2)}`, `1${hi - 1}0${S - hi}`, `10${Math.min(9, S - 1)}0${S - 1 - Math.min(9, S - 1)}`, "1".repeat(S), `2${"1".repeat(S - 2)}`];
    return { text: `Name a number whose digits add to ${S}`, hint: "Add up every digit.", sample: "a whole number", all, judge };
  },
  fraction(r) {
    const [p, q] = pick(r, [[1, 2], [2, 3], [3, 4], [1, 3], [3, 5], [1, 4], [2, 5]]);
    const target = F(p, q);
    const judge = (input) => {
      const got = readNumber(input);
      if (got?.zero) return reject("The bottom of a fraction cannot be 0.");
      if (!got || got.kind !== "frac") return reject(`Write a fraction with a slash, like ${p * 2}/${q * 2}.`);
      const a = got.top, b = got.bottom;
      const shown = `${fmt(a.v)}/${fmt(b.v)}`;
      if (a.kind === "int" && b.kind === "int" && a.v.n === p && b.v.n === q) return reject("That is the same fraction. Find a different one that equals it.");
      if (!fEq(got.v, target)) {
        const simple = isInt(got.v) ? String(got.v.n) : `${got.v.n}/${got.v.d}`;
        return wrong(shown, simple === shown ? `${shown} does not equal ${p}/${q}.` : got.v.d <= 100 ? `${shown} simplifies to ${simple}, not ${p}/${q}.` : `${shown} is about ${fmt(got.v)}, not ${p}/${q}.`);
      }
      const k = a.v.n / p;
      let e, why;
      if (a.kind !== "int" || b.kind !== "int") { e = 0.05; why = "A decimal inside a fraction. Almost nobody tries that."; }
      else if (k < 0) { e = 0.05; why = "Two negatives cancel. That is a well hidden one."; }
      else {
        e = k === 2 ? 0.95 : k === 3 || k === 10 ? 0.85 : k === 5 ? 0.8 : k === 4 ? 0.75 : k <= 9 ? 0.55 : k <= 12 ? 0.45 : k <= 20 ? 0.3 : k <= 99 ? 0.15 : 0.08;
        if (k > 10 && (b.v.n === 100 || b.v.n === 1000 || a.v.n === 100 || a.v.n === 1000)) e = 0.6;
        else if (k > 10 && (a.v.n % 10 === 0 || b.v.n % 10 === 0)) e = Math.max(e, 0.4);
        why = `Top and bottom of ${p}/${q} are both multiplied by ${k}.` + (e < 0.4 ? " Big or odd multipliers are rare." : "");
      }
      return ok(shown, pts(e), why);
    };
    const all = [2, 3, 5, 10, 4, 7, 12, 25, 13, 37, 250].map((k) => `${p * k}/${q * k}`).concat([`${p / 2}/${q / 2}`, `-${p * 3}/-${q * 3}`, `${p * 1.5}/${q * 1.5}`]);
    return { text: `Name a different fraction equal to ${p}/${q}`, hint: "Multiply the top and bottom by the same number.", sample: "like a/b", all, judge };
  },
  between(r) {
    const a = int(r, -9, -1);
    const lo = F(a), hi = F(a + 1);
    const judge = (input) => {
      const got = readNumber(input);
      if (got?.zero) return reject("The bottom of a fraction cannot be 0.");
      if (!got) return reject("Type a decimal like -2.5 or a fraction like -5/2.");
      const v = got.v;
      const shown = got.kind === "frac" ? `${fmt(got.top.v)}/${fmt(got.bottom.v)}` : fmt(v);
      if (!(num(v) > a && num(v) < a + 1)) {
        const flip = num(v) > -(a + 1) && num(v) < -a;
        return wrong(shown, fEq(v, lo) || fEq(v, hi) ? `${shown} is an end of the range. Between means strictly inside.` : flip ? `${shown} is positive. Watch the negative sign.` : `${shown} is not between ${a} and ${a + 1}.`);
      }
      const part = fSub(v, lo);
      const half = part.n === 1 && part.d === 2;
      let e, why;
      if (got.kind === "frac") {
        e = half ? 0.5 : part.d <= 4 ? 0.3 : 0.12;
        why = half ? "The midpoint, written as a fraction." : "A fraction that is not the midpoint. That takes real number sense.";
      } else {
        e = got.places <= 1 ? (half ? 0.95 : 0.7) : got.places === 2 ? (part.d === 4 ? 0.6 : 0.4) : 0.15;
        why = half ? "The midpoint. It is the first number to spot." : got.places <= 1 ? "A tenth. Easy to reach by nudging the midpoint." : "More decimal places means more room to hide.";
      }
      return ok(shown, pts(e), why);
    };
    const w = a + 1 === 0 ? "-0" : String(a + 1);
    const all = [`${w}.5`, `${w}.1`, `${w}.9`, `${w}.25`, `${w}.75`, `${w}.37`, `${2 * a + 1}/2`, `${3 * a + 1}/3`, `${4 * a + 3}/4`, `${w}.125`, `${7 * a + 3}/7`];
    return { text: `Name a number between ${a} and ${a + 1}`, hint: "Decimals and fractions both work.", sample: "like -2.5 or -5/2", all, judge };
  },
  common(r) {
    const [a, b] = pick(r, [[4, 6], [6, 8], [3, 5], [6, 9], [4, 10], [2, 7], [8, 12], [5, 6], [3, 4], [6, 10]]);
    const lcm = (a * b) / gcd(a, b);
    const judge = (input) => {
      const v = readWhole(input);
      if (v == null || v <= 0) return reject(WHOLE);
      if (v % a || v % b) { const m = v % a ? a : b; return wrong(v, `${v} ÷ ${m} leaves a remainder of ${v % m}.`); }
      const k = v / lcm;
      let e = v === a * b ? 0.95 : k === 1 ? 0.8 : k === 2 || k === 10 ? 0.6 : k <= 9 ? 0.4 : k <= 20 ? 0.25 : 0.12;
      if (k === 1 && lcm === a * b) e = 0.95;
      if (k > 10 && (k === 100 || k === 1000 || (k % 10 === 0 && k <= 100))) e = 0.45;
      const why = v === a * b ? `${a} × ${b} = ${v}. Multiplying the two numbers is the quickest way.` : k === 1 ? `${v} is the least common multiple.` : `${v} = ${lcm} × ${k}, and ${lcm} is the least common multiple.`;
      return ok(v, pts(e), why);
    };
    const all = [a * b, lcm, lcm * 2, lcm * 3, lcm * 5, lcm * 7, lcm * 10, lcm * 13, lcm * 17, lcm * 23, lcm * 100].map(String);
    return { text: `Name a common multiple of ${a} and ${b}`, hint: `Both ${a} and ${b} divide it evenly.`, sample: "a whole number", all, judge };
  },
};
export const TYPES = Object.keys(MAKERS);

export function makePrompt(type, r) {
  const p = MAKERS[type](r);
  p.type = type;
  /** A few right answers at different rarities, for the reveal. skip is the player's own answer. */
  p.examples = (skip) => {
    const seen = new Set(), byTier = [[], [], [], []];
    for (const text of p.all) {
      const j = p.judge(text);
      if (j.status !== "ok" || seen.has(String(j.shown)) || String(j.shown) === String(skip)) continue;
      seen.add(String(j.shown));
      byTier[j.tier].push({ text: String(j.shown), points: j.points, tier: j.tier });
    }
    const out = [];
    byTier.forEach((list, t) => {
      if (!list.length) return;
      list.sort((x, y) => x.points - y.points);
      out.push(t === 3 ? list[list.length - 1] : list[Math.floor((list.length - 1) / 2)]);
    });
    return out;
  };
  return p;
}
/**
 * One game: about 3 math prompts (each a different type) and 4 general ones from the hand-written bank
 * (each from a different category), general first and then taking turns.
 */
export function makeGame(seed, count = 7) {
  const r = rng(seed);
  const nMath = Math.floor((count * 3) / 7);
  const maths = shuffle(r, TYPES).slice(0, nMath).map((t) => makePrompt(t, r));
  const general = pickBank(r, count - nMath, shuffle);
  const out = [];
  while (maths.length || general.length) {
    if (general.length) out.push(general.shift());
    if (maths.length) out.push(maths.shift());
  }
  return out;
}
export const RANKS = [[600, "Legend of the Odd Answer"], [480, "Rare Hunter"], [340, "Deep Digger"], [200, "Sharp Eye"], [1, "Warming Up"], [0, "Empty Net"]];
export const rankOf = (total) => RANKS.find(([min]) => total >= min)[1];
