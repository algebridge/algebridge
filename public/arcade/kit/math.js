// AlgeBridge Arcade math: short problems a player can answer in a few seconds.
// Every problem is { text, answer, choices, topic, check(input) }.
// text is at most ~22 characters, no words, safe to draw on a tile, a sign or a ball.

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same number for everyone on the same calendar day (local time). */
export function dailySeed(salt = 0) {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + salt * 1000003;
}

export const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function shuffle(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const nz = (r, lo, hi) => {
  let v = 0;
  while (v === 0) v = int(r, lo, hi);
  return v;
};
/** "3x", "-x", "x" */
export const term = (c, v = "x") => (c === 1 ? v : c === -1 ? "-" + v : c + v);
/** " + 4" or " - 4" */
export const plus = (n) => (n < 0 ? " - " + -n : " + " + n);
export const MINUS = "-";

// Each maker returns [text, answer, nearMisses[]] at a level 1..3.
const MAKERS = {
  add(r, L) {
    const a = int(r, 2, L === 1 ? 12 : L === 2 ? 40 : 99);
    const b = int(r, 2, L === 1 ? 12 : L === 2 ? 40 : 99);
    return [`${a} + ${b}`, a + b, [a + b + 1, a + b - 1, a + b + 10, a + b - 2]];
  },
  subtract(r, L) {
    const a = int(r, 5, L === 1 ? 20 : 60);
    const b = int(r, 1, L === 3 ? 80 : a);
    return [`${a} - ${b}`, a - b, [a - b + 1, a - b - 1, b - a, a + b]];
  },
  multiply(r, L) {
    const a = int(r, 2, L === 1 ? 9 : 12);
    const b = int(r, 2, L === 3 ? 15 : 9);
    return [`${a} × ${b}`, a * b, [a * b + a, a * b - b, a * (b + 1) + 1, a + b]];
  },
  divide(r, L) {
    const b = int(r, 2, L === 1 ? 9 : 12);
    const q = int(r, 2, L === 3 ? 15 : 9);
    return [`${b * q} ÷ ${b}`, q, [q + 1, q - 1, q + 2, b]];
  },
  integers(r, L) {
    const a = nz(r, -9 * L, 9 * L);
    const b = nz(r, -9 * L, 9 * L);
    if (r() < 0.5) return [`${a} + ${b < 0 ? `(${b})` : b}`, a + b, [a - b, -(a + b), a + b + 2, a + b - 1]];
    return [`${a} - ${b < 0 ? `(${b})` : b}`, a - b, [a + b, -(a - b), a - b + 2, a - b - 1]];
  },
  oneStep(r, L) {
    const x = nz(r, L === 1 ? 1 : -12, 12);
    const k = int(r, 2, 9);
    const form = int(r, 0, L === 1 ? 1 : 3);
    if (form === 0) return [`x + ${k} = ${x + k}`, x, [x + k, x + 1, x - 1, x + 2 * k]];
    if (form === 1) return [`${k}x = ${k * x}`, x, [k * x, x + 1, x - 1, x + k]];
    if (form === 2) return [`x - ${k} = ${x - k}`, x, [x - k, x - 2 * k, x + 1, x - 1]];
    return [`x ÷ ${k} = ${x}`, x * k, [x, x + k, x * k + k, x * k - k]];
  },
  twoStep(r, L) {
    const x = nz(r, L === 1 ? 1 : -9, 9);
    const a = int(r, 2, L === 3 ? 9 : 5);
    const b = nz(r, L === 1 ? 1 : -9, 9);
    return [`${a}x${plus(b)} = ${a * x + b}`, x, [x + 1, x - 1, -x || 2, x + b]];
  },
  evaluate(r, L) {
    const x = nz(r, L === 1 ? 1 : -6, 6);
    const a = int(r, 2, 6);
    const b = nz(r, -9, 9);
    if (L === 3 && r() < 0.5) return [`x² ${plus(b).trim()}, x = ${x}`, x * x + b, [x * 2 + b, -x * x + b, x * x - b, x * x + b + 1]];
    return [`${a}x${plus(b)}, x = ${x}`, a * x + b, [a + x + b, a * x - b, a * x + b + a, a * x]];
  },
  likeTerms(r, L) {
    const a = nz(r, L === 1 ? 1 : -9, 9);
    const b = nz(r, L === 1 ? 1 : -9, 9);
    const s = a + b === 0 ? a + b + 1 : a + b;
    const bb = s - a;
    const fmt = (c) => (c === 0 ? "0" : term(c));
    return [`${term(a)}${bb < 0 ? " - " + term(-bb) : " + " + term(bb)}`, fmt(s), [fmt(a - bb || 2), fmt(s + 1), fmt(a * bb), `${s}x²`]];
  },
  exponents(r, L) {
    const b = int(r, 2, L === 1 ? 5 : 10);
    const e = b > 5 ? 2 : int(r, 2, L === 3 ? 4 : 3);
    const sup = { 2: "²", 3: "³", 4: "⁴" }[e];
    return [`${b}${sup}`, b ** e, [b * e, b ** e + b, b ** (e - 1) || b + 1, b ** e - 1]];
  },
  slope(r) {
    const m = nz(r, -4, 4);
    const x1 = int(r, -4, 3);
    const dx = int(r, 1, 3);
    const y1 = int(r, -5, 5);
    return [`(${x1},${y1}) (${x1 + dx},${y1 + m * dx}) m=?`, m, [-m, m + 1, m - 1, m * dx]];
  },
  percent(r, L) {
    const p = pick(r, L === 1 ? [10, 50, 25] : [10, 20, 25, 50, 75, 5]);
    const base = int(r, 1, 12) * (p === 25 || p === 75 ? 4 : p === 5 ? 20 : 10);
    const ans = (p * base) / 100;
    return [`${p}% of ${base}`, ans, [ans * 2, ans + 5, base - ans, ans / 2]];
  },
  squares(r, L) {
    const n = int(r, 2, L === 1 ? 9 : 15);
    return [`√${n * n}`, n, [n + 1, n - 1, n * 2, n + 2]];
  },
};

export const TOPICS = Object.keys(MAKERS);
/** Mixes that fit a game's pace. */
export const MIX = {
  quick: ["add", "subtract", "multiply", "divide"],
  prealgebra: ["integers", "multiply", "divide", "exponents", "percent", "squares"],
  algebra: ["oneStep", "twoStep", "evaluate", "likeTerms", "integers", "slope"],
  all: TOPICS,
};

/** What the player chose to practice. "auto" lets each game pick. Saved for the whole arcade. */
export const TOPIC_CHOICES = [
  { id: "auto", label: "Mixed", note: "The game picks" },
  { id: "arith", label: "Arithmetic", note: "Add, subtract, multiply, divide", topics: ["add", "subtract", "multiply", "divide"] },
  { id: "integers", label: "Integers", note: "Negative numbers", topics: ["integers"] },
  { id: "equations", label: "Equations", note: "Solve for x", topics: ["oneStep", "twoStep"] },
  { id: "expressions", label: "Expressions", note: "Evaluate and combine like terms", topics: ["evaluate", "likeTerms"] },
  { id: "slope", label: "Slope", note: "Slope between two points", topics: ["slope"] },
  { id: "powers", label: "Exponents and roots", note: "Powers and square roots", topics: ["exponents", "squares"] },
  { id: "percent", label: "Percents", note: "Percent of a number", topics: ["percent"] },
];
let chosen = "auto";
try { chosen = localStorage.getItem("arcade:topic") || "auto"; } catch {}
export const getTopic = () => chosen;
export function setTopic(id) { chosen = TOPIC_CHOICES.some((c) => c.id === id) ? id : "auto"; try { localStorage.setItem("arcade:topic", chosen); } catch {} }

/**
 * One problem.
 *   problem({ topic: "oneStep" | [..topics] | "algebra" (a MIX name), level: 1..3, random })
 * choices always holds 4 distinct values with the answer among them, shuffled.
 */
export function problem({ topic = "algebra", level = 1, random = Math.random } = {}) {
  const pickd = TOPIC_CHOICES.find((c) => c.id === chosen);
  const list = pickd && pickd.topics ? pickd.topics : Array.isArray(topic) ? topic : MIX[topic] || [topic];
  const name = pick(random, list);
  const L = Math.max(1, Math.min(3, Math.round(level)));
  const [text, answer, misses] = MAKERS[name](random, L);
  const seen = new Set([String(answer)]);
  const wrong = [];
  for (const m of shuffle(random, misses)) {
    const k = String(m);
    if (!seen.has(k) && wrong.length < 3) {
      seen.add(k);
      wrong.push(m);
    }
  }
  let bump = 1;
  while (wrong.length < 3) {
    const m = typeof answer === "number" ? answer + (bump % 2 ? bump + 1 : -(bump + 1)) : `${bump + 2}x`;
    bump++;
    if (!seen.has(String(m))) {
      seen.add(String(m));
      wrong.push(m);
    }
  }
  const choices = shuffle(random, [answer, ...wrong]);
  return {
    text,
    answer,
    choices,
    topic: name,
    level: L,
    check: (input) => normalize(input) === normalize(answer),
  };
}

function normalize(v) {
  return String(v).trim().toLowerCase().replace(/\s+/g, "").replace(/−/g, "-").replace(/^\+/, "");
}

/** All positive factors of n, ascending. */
export function factors(n) {
  const out = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      out.push(i);
      if (i * i !== n) out.push(n / i);
    }
  }
  return out.sort((a, b) => a - b);
}
export const isPrime = (n) => n > 1 && factors(n).length === 2;
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
