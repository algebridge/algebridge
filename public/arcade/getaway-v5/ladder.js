// The topic ladder for Getaway. Each rung is one kind of equation.
// Every problem comes with wrong answers that are real mistakes, so a guess is a trap.

const M = "−";
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const nz = (r, lo, hi) => { let v = 0; while (!v) v = ri(r, lo, hi); return v; };
const num = (n) => (n < 0 ? M + Math.abs(n) : String(n));
const xt = (a) => (a === 1 ? "x" : a === -1 ? M + "x" : num(a) + "x");
const plus = (n) => (n < 0 ? ` ${M} ${Math.abs(n)}` : ` + ${n}`);
const isInt = (v) => Number.isInteger(v);

export const TOPICS = [
  { name: "x + a = b", gen(r) { const x = ri(r, 1, 12), a = ri(r, 2, 12); return { text: `x + ${a} = ${x + a}`, x, mist: [x + 2 * a] }; } },
  { name: "x − a = b", gen(r) {
    const x = ri(r, -3, 15), a = ri(r, 2, 12);
    if (r() < 0.5) return { text: `x ${M} ${a} = ${num(x - a)}`, x, mist: [x - 2 * a] };
    return { text: `${a} + x = ${num(a + x)}`, x, mist: [x + 2 * a] };
  } },
  { name: "ax = b", gen(r) { const a = ri(r, 2, 9), x = nz(r, -6, 12); return { text: `${a}x = ${num(a * x)}`, x, mist: [a * x - a, a * x + a] }; } },
  { name: "x / a = b", gen(r) { const a = ri(r, 2, 8), b = nz(r, -6, 9), x = a * b; return { text: `x/${a} = ${num(b)}`, x, mist: [b - a, b + a, isInt(b / a) ? b / a : -x] }; } },
  { name: "ax + b = c", gen(r) { const a = ri(r, 2, 7), b = ri(r, 1, 15), x = ri(r, 1, 10), c = a * x + b; return { text: `${a}x + ${b} = ${c}`, x, mist: [c - b, isInt((c + b) / a) ? (c + b) / a : x + 2] }; } },
  { name: "ax − b = c", gen(r) { const a = ri(r, 2, 7), b = ri(r, 1, 15), x = nz(r, -6, 10), c = a * x - b; return { text: `${a}x ${M} ${b} = ${num(c)}`, x, mist: [c + b, isInt((c - b) / a) ? (c - b) / a : -x] }; } },
  { name: "a(x + b) = c", gen(r) { const a = ri(r, 2, 6), b = nz(r, -6, 8), x = nz(r, -5, 9), c = a * (x + b); return { text: `${a}(x${plus(b)}) = ${num(c)}`, x, mist: [c / a, c / a + b, c - b] }; } },
  { name: "x / a + b = c", gen(r) { const a = ri(r, 2, 6), q = nz(r, -5, 8), b = nz(r, -9, 9), x = a * q, c = q + b; return { text: `x/${a}${plus(b)} = ${num(c)}`, x, mist: [c - b, a * c - b, a * (c + b)] }; } },
  { name: "ax + b = cx + d", gen(r) {
    for (;;) { const a = ri(r, 3, 9), c = ri(r, 1, a - 1), x = nz(r, -6, 9), b = nz(r, -12, 12), d = a * x + b - c * x; if (!d) continue;
      return { text: `${xt(a)}${plus(b)} = ${xt(c)}${plus(d)}`, x, mist: [isInt((d - b) / (a + c)) ? (d - b) / (a + c) : -x, isInt((d + b) / (a - c)) ? (d + b) / (a - c) : x + 1] }; }
  } },
  { name: "a(x + b) = cx + d", gen(r) {
    for (;;) { const a = ri(r, 2, 6), b = nz(r, -5, 6), c = ri(r, 1, 7), x = nz(r, -6, 9); if (c === a) continue; const d = a * (x + b) - c * x; if (!d) continue;
      return { text: `${a}(x${plus(b)}) = ${xt(c)}${plus(d)}`, x, mist: [isInt((d - b) / (a - c)) ? (d - b) / (a - c) : -x, isInt((d - a * b) / (a + c)) ? (d - a * b) / (a + c) : x - 1] }; }
  } },
];

/** A problem at a rung. Past the top rung, numbers keep getting bigger. */
export function problem(level, r = Math.random) {
  const top = TOPICS.length - 1;
  // past the top rung: a mix of the hardest four
  const t = level > top ? TOPICS[top - Math.floor(r() * 4)] : TOPICS[level];
  const p = t.gen(r);
  // two wrong answers: real mistakes first, then near misses
  const wrong = [];
  const add = (v) => { if (isInt(v) && v !== p.x && !wrong.includes(v) && Math.abs(v) < 200) wrong.push(v); };
  for (const v of p.mist) add(v);
  for (const v of [-p.x, p.x + 1, p.x - 1, p.x + 2, p.x * 2]) add(v);
  const pick = [wrong[0], wrong[1]];
  const choices = [p.x, ...pick];
  for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { text: p.text, x: p.x, choices, topic: Math.min(level, top), name: level > top ? "Mixed" : t.name };
}

/** Check: plug x back in. Used by the test script. */
export function checks(p) {
  const expr = p.text.replaceAll(M, "-").replace(/(\d)\(/g, "$1*(").replace(/(\d)x/g, "$1*x");
  const [L, R] = expr.split("=");
  const f = (s, x) => Function("x", `return ${s}`)(x);
  return Math.abs(f(L, p.x) - f(R, p.x)) < 1e-9 && !p.choices.filter((c) => c !== p.x).some((c) => Math.abs(f(L, c) - f(R, c)) < 1e-9);
}
