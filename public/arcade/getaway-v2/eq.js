// Equation engine for Getaway.
// A side is g(a x + b) + c x + d. g = 0 means no bracket.
// Every move keeps the equation balanced. dist() finds the fewest moves to x = n.

export const S = (g = 0, a = 0, b = 0, c = 0, d = 0) => norm({ g, a, b, c, d });
export const E = (L, R) => ({ L, R });
const cp = (e) => ({ L: { ...e.L }, R: { ...e.R } });

function norm(s) {
  if (s.g === 0 || (s.a === 0 && s.b === 0)) { s.g = 0; s.a = 0; s.b = 0; }
  else if (s.a === 0) { s.d += s.g * s.b; s.g = 0; s.a = 0; s.b = 0; }
  else if (s.g === 1) { s.c += s.a; s.d += s.b; s.g = 0; s.a = 0; s.b = 0; }
  return s;
}
const xc = (s) => s.g * s.a + s.c;
const key = (e) => [e.L.g, e.L.a, e.L.b, e.L.c, e.L.d, e.R.g, e.R.a, e.R.b, e.R.c, e.R.d].join(",");

function canDiv(s, n) {
  if (s.c % n || s.d % n) return false;
  if (s.g) return s.g % n === 0 || (s.a % n === 0 && s.b % n === 0);
  return true;
}

export function apply(e0, m) {
  const e = cp(e0);
  const both = (f) => { f(e.L); f(e.R); norm(e.L); norm(e.R); };
  switch (m.t) {
    case "dist": { const s = e[m.side]; s.c += s.g * s.a; s.d += s.g * s.b; s.g = s.a = s.b = 0; break; }
    case "div": both((s) => { if (s.g) { if (s.g % m.n === 0) s.g /= m.n; else { s.a /= m.n; s.b /= m.n; } } s.c /= m.n; s.d /= m.n; }); break;
    case "add": both((s) => { s.d += m.n; }); break;
    case "addx": both((s) => { s.c += m.n; }); break;
    case "mul": both((s) => { if (s.g) s.g *= m.n; s.c *= m.n; s.d *= m.n; }); break;
    case "flip": return { L: e.R, R: e.L };
  }
  // tidy -0
  for (const s of [e.L, e.R]) for (const k in s) if (Object.is(s[k], -0)) s[k] = 0;
  return e;
}

export function legal(e, m) {
  if (m.t === "div") return m.n !== 0 && m.n !== 1 && canDiv(e.L, m.n) && canDiv(e.R, m.n);
  if (m.t === "dist") return !!e[m.side].g;
  return true;
}

/** x = n or n = x. Returns n, or null. */
export function solved(e) {
  const one = (a, b) => a.g === 0 && a.c === 1 && a.d === 0 && b.g === 0 && b.c === 0;
  if (one(e.L, e.R)) return e.R.d;
  if (one(e.R, e.L)) return e.L.d;
  return null;
}

/** The moves a sensible solver would consider (no traps). */
export function moves(e) {
  const out = [], seen = new Set();
  const push = (m) => { const k = m.t + (m.side || "") + (m.n ?? ""); if (!seen.has(k) && legal(e, m)) { seen.add(k); out.push(m); } };
  for (const sd of ["L", "R"]) {
    const s = e[sd];
    if (s.g) push({ t: "dist", side: sd });
    if (s.d && (xc(s) !== 0 || xc(e[sd === "L" ? "R" : "L"]) === 0 || true)) push({ t: "add", n: -s.d });
    if (s.c) push({ t: "addx", n: -s.c });
  }
  const xs = [e.L.g, e.L.a, e.L.c, e.R.g, e.R.c].filter((v) => v);
  for (const v of xs) for (let n = 2; n <= Math.abs(v); n++) if (Math.abs(v) % n === 0) { push({ t: "div", n }); push({ t: "div", n: -n }); }
  if (xc(e.L) < 0 || xc(e.R) < 0) push({ t: "div", n: -1 });
  return out;
}

const memo = new Map();
/** Fewest moves to x = n (0 when solved). 99 if more than 7. */
export function dist(e) {
  const k0 = key(e);
  if (memo.has(k0)) return memo.get(k0);
  let frontier = [e], seen = new Set([k0]), d = 0, ans = 99;
  while (frontier.length && d <= 7) {
    if (frontier.some((f) => solved(f) !== null)) { ans = d; break; }
    const next = [];
    for (const f of frontier) for (const m of moves(f)) {
      const g = apply(f, m), k = key(g);
      if (!seen.has(k)) { seen.add(k); next.push(g); }
    }
    frontier = next.length > 4000 ? next.slice(0, 4000) : next;
    d++;
  }
  if (memo.size > 5000) memo.clear();
  memo.set(k0, ans);
  return ans;
}

// ---------- text ----------
const M = "−";
function lin(a, b) {
  let s = a === 1 ? "x" : a === -1 ? `${M}x` : `${a < 0 ? M : ""}${Math.abs(a)}x`;
  if (b) s += ` ${b < 0 ? M : "+"} ${Math.abs(b)}`;
  return s;
}
export function sideText(s) {
  const parts = [];
  if (s.g) parts.push({ neg: s.g < 0, t: `${Math.abs(s.g) === 1 ? "" : Math.abs(s.g)}(${lin(s.a, s.b)})` });
  if (s.c) parts.push({ neg: s.c < 0, t: Math.abs(s.c) === 1 ? "x" : `${Math.abs(s.c)}x` });
  if (s.d || !parts.length) parts.push({ neg: s.d < 0, t: String(Math.abs(s.d)) });
  return parts.map((p, i) => (i === 0 ? (p.neg ? M : "") + p.t : ` ${p.neg ? M : "+"} ${p.t}`)).join("");
}
export const text = (e) => `${sideText(e.L)} = ${sideText(e.R)}`;

export function cardOf(m, e) {
  const n = m.n, abs = Math.abs(n ?? 0);
  switch (m.t) {
    case "dist": { const s = e[m.side]; return { big: "Distribute", small: `open ${s.g}( )`, cost: 2 }; }
    case "div": return { big: `÷ ${n < 0 ? `(${M}${abs})` : n}`, small: "both sides", cost: 3 };
    case "add": return { big: `${n < 0 ? M : "+"} ${abs}`, small: "both sides", cost: m.trap ? 1 : 2 };
    case "addx": return { big: `${n < 0 ? M : "+"} ${abs === 1 ? "" : abs}x`, small: "both sides", cost: m.trap ? 1 : 2 };
    case "mul": return { big: `× ${n}`, small: "both sides", cost: 1 };
  }
}

// ---------- level generators ----------
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r, lo, hi) => { let v = 0; while (!v) v = ri(r, lo, hi); return v; };

export function make(tier, r = Math.random) {
  for (let tries = 0; tries < 200; tries++) {
    const x = nz(r, -6, 9);
    let e;
    if (tier === 0) { const a = ri(r, 2, 6), b = nz(r, -9, 12); e = E(S(0, 0, 0, a, b), S(0, 0, 0, 0, a * x + b)); }
    else if (tier === 1) { const g = ri(r, 2, 5), b = nz(r, -6, 8); e = E(S(g, 1, b), S(0, 0, 0, 0, g * (x + b))); }
    else if (tier === 2) { let a = ri(r, 2, 7), c = ri(r, 1, 6); if (a === c) continue; const b = nz(r, -9, 9), d = a * x + b - c * x; if (!d) continue; e = E(S(0, 0, 0, a, b), S(0, 0, 0, c, d)); }
    else { const g = ri(r, 2, 5), b = nz(r, -5, 6); let c = ri(r, 1, 6); if (c === g) continue; const d = g * (x + b) - c * x; if (!d) continue; e = E(S(g, 1, b), S(0, 0, 0, c, d)); }
    if (r() < 0.25) e = apply(e, { t: "flip" });
    const D = dist(e);
    if (D >= 2 && D <= 5) return { e, x, D };
  }
  return { e: E(S(0, 0, 0, 2, 3), S(0, 0, 0, 0, 11)), x: 4, D: 2 };
}

/** A hand of cards: real moves plus cheap traps. At least one card makes progress. */
export function hand(e, size, r = Math.random) {
  const D = dist(e);
  const real = moves(e).map((m) => ({ m, d: dist(apply(e, m)) }));
  const traps = [];
  traps.push({ t: "mul", n: ri(r, 2, 3), trap: true });
  traps.push({ t: "add", n: nz(r, -7, 7), trap: true });
  if (r() < 0.5) traps.push({ t: "addx", n: nz(r, -3, 3), trap: true });
  const tr = traps.map((m) => ({ m, d: dist(apply(e, m)) }));
  const good = real.filter((c) => c.d < D);
  const rest = [...real.filter((c) => c.d >= D), ...tr];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  shuffle(good); shuffle(rest);
  // one or two progress cards, the rest are wasted moves and traps
  const pick = [...good.slice(0, r() < 0.75 ? 1 : 2), ...rest].slice(0, size);
  while (pick.length < size && good.length > pick.filter((c) => c.d < D).length) pick.push(good[pick.filter((c) => c.d < D).length]);
  return shuffle(pick).map((c) => ({ ...c, ...cardOf(c.m, e), gain: D - c.d }));
}
