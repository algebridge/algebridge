// Six Guess logic. Pure, no DOM, so node can test it.
// Symbols: 0-9 + - × ÷ =. Standard order of operations. Exact fractions, never eval.
import { int, pick, gcd } from "../kit/math.js";

export const OPS = "+-×÷";
const F = (n, d = 1) => {
  if (d < 0) { n = -n; d = -d; }
  const k = gcd(Math.abs(n), d) || 1;
  return { n: n / k, d: d / k };
};
export const show = (v) => (v.d === 1 ? String(v.n) : `${v.n}/${v.d}`);

/** Typed text to tile symbols: * and x become ×, / becomes ÷. */
export const normalize = (s) => s.replace(/[*xX]/g, "×").replace(/[/:]/g, "÷").replace(/[−–]/g, "-").replace(/\s+/g, "");

/** One side of an equation. Returns { ok, value } or { ok: false, msg }. */
export function evalSide(side) {
  if (!side) return { ok: false, msg: "Put something on both sides of the = sign." };
  if (OPS.includes(side[0]) || OPS.includes(side[side.length - 1])) return { ok: false, msg: "A side cannot start or end with a sign." };
  if (/[+\-×÷]{2}/.test(side)) return { ok: false, msg: "Two signs sit side by side. Put a number between them." };
  const nums = side.split(/[+\-×÷]/), ops = side.replace(/[0-9]/g, "").split("");
  if (nums.some((n) => n.length > 1 && n[0] === "0")) return { ok: false, msg: "Numbers cannot start with 0 here." };
  // × and ÷ first, left to right
  const terms = [F(Number(nums[0]))], adds = [];
  for (let i = 0; i < ops.length; i++) {
    const b = F(Number(nums[i + 1]));
    const last = terms[terms.length - 1];
    if (ops[i] === "×") terms[terms.length - 1] = F(last.n * b.n, last.d * b.d);
    else if (ops[i] === "÷") {
      if (b.n === 0) return { ok: false, msg: "Dividing by 0 does not work." };
      terms[terms.length - 1] = F(last.n * b.d, last.d * b.n);
    } else { adds.push(ops[i]); terms.push(b); }
  }
  let v = terms[0];
  for (let i = 0; i < adds.length; i++) {
    const b = terms[i + 1];
    v = adds[i] === "+" ? F(v.n * b.d + b.n * v.d, v.d * b.d) : F(v.n * b.d - b.n * v.d, v.d * b.d);
  }
  return { ok: true, value: v };
}

/** Is this guess a true equation that fits the row (blank tiles allowed)? { ok } or { ok: false, msg } with a kind reason. */
export function checkGuess(guess, len) {
  if (guess.length > len || /[^0-9+\-×÷= ]/.test(guess)) return { ok: false, msg: "Use only the tiles on the keypad." };
  // blank tiles are allowed anywhere and are ignored when the equation is checked
  guess = guess.replace(/ /g, "");
  if (guess.length < 3) return { ok: false, msg: "Type a true equation first. Blank tiles are fine." };
  const eq = guess.split("=").length - 1;
  if (eq === 0) return { ok: false, msg: "An equation needs an = sign." };
  if (eq > 1) return { ok: false, msg: "Use just one = sign." };
  const [l, r] = guess.split("=");
  const L = evalSide(l);
  if (!L.ok) return L;
  const R = evalSide(r);
  if (!R.ok) return R;
  if (!/[+\-×÷]/.test(guess)) return { ok: false, msg: `${l} and ${r} are plain numbers. Use an operation.` };
  if (L.value.n !== R.value.n || L.value.d !== R.value.d) return { ok: false, msg: `That does not balance: left side is ${show(L.value)}, right side is ${show(R.value)}.` };
  return { ok: true };
}

/** Per tile: "spot" (right symbol, right place), "near" (in the equation, other place), "miss". Repeats are counted correctly. A blank tile is always "miss". */
export function score(guess, answer) {
  const out = Array(guess.length).fill("miss");
  const left = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) out[i] = "spot";
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (out[i] === "spot") continue;
    if (left[guess[i]] > 0) { out[i] = "near"; left[guess[i]]--; }
  }
  return out;
}

/** Does a generated equation follow the house rules for a nice puzzle? Used by the generator and by tests. */
export function isNice(eq, len) {
  if (eq.length !== len || !checkGuess(eq, len).ok) return false;
  const [l, r] = eq.split("=");
  if (!/^[1-9][0-9]*$/.test(r)) return false; // right side: one positive number
  const nums = l.split(/[+\-×÷]/).map(Number), ops = l.replace(/[0-9]/g, "").split("");
  if (!ops.length || nums.some((n) => n < 1)) return false;
  // walk it the way a student would: × ÷ first, every step a whole number, never below zero
  const terms = [nums[0]], adds = [];
  for (let i = 0; i < ops.length; i++) {
    const b = nums[i + 1], a = terms[terms.length - 1];
    if (ops[i] === "×") { if (a === 1 || b === 1) return false; terms[terms.length - 1] = a * b; }
    else if (ops[i] === "÷") { if (b === 1 || a === b || a % b) return false; terms[terms.length - 1] = a / b; }
    else { adds.push(ops[i]); terms.push(b); }
  }
  let v = terms[0];
  for (let i = 0; i < adds.length; i++) {
    v = adds[i] === "+" ? v + terms[i + 1] : v - terms[i + 1];
    if (v < 1) return false;
  }
  return v === Number(r);
}

const digitsOf = (r, n) => int(r, n === 1 ? 1 : 10 ** (n - 1), 10 ** n - 1);
/** A random true equation with exactly len tiles (6 or 8). minResult keeps the right side big enough for the algebra bonus. */
export function generate(r, len, minResult = 1) {
  for (let outer = 0; outer < 400; outer++) {
    const nOps = len <= 6 ? 1 : r() < 0.55 ? 2 : 1;
    const ops = Array.from({ length: nOps }, () => pick(r, ["+", "-", "×", "÷"]));
    if (nOps === 2 && ops[0] === "÷" && ops[1] === "÷") continue;
    for (let t = 0; t < 300; t++) {
      const budget = len - nOps - 1; // digits to share between the operands and the result
      const lens = [];
      let used = 0;
      for (let i = 0; i <= nOps; i++) { const n = int(r, 1, nOps === 1 ? 3 : 2); lens.push(n); used += n; }
      if (budget - used < 1 || budget - used > 3) continue;
      const nums = lens.map((n) => digitsOf(r, n));
      // make divisions exact by building the dividend from the divisor
      for (let i = 0; i < nOps; i++) {
        if (ops[i] !== "÷" || (i > 0 && ops[i - 1] === "×")) continue;
        const q = int(r, 2, lens[i] === 1 ? 4 : lens[i] === 2 ? 49 : 99);
        nums[i] = nums[i + 1] * q;
      }
      const left = nums.map((n, i) => n + (ops[i] || "")).join("");
      const v = evalSide(left);
      if (!v.ok || v.value.d !== 1 || v.value.n < minResult) continue;
      const eq = `${left}=${v.value.n}`;
      if (isNice(eq, len)) return eq;
    }
  }
  return len <= 6 ? "3×4=12" : "12+35=47";
}

/** Algebra bonus: ax + b = R with a whole number x. */
export function bonus(r, R) {
  const as = [2, 3, 4, 5, 6, 7, 8, 9].filter((a) => a + 1 <= R);
  const a = pick(r, as.length ? as : [2]);
  const x = Math.max(1, Math.floor((R - 1) / a));
  const b = R - a * x;
  const text = `${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${R}`;
  const wrong = [...new Set([x + 1, x - 1, x + 2, R - b, x * a, x + a].filter((w) => w !== x && w >= 0))].slice(0, 3);
  const choices = [x, ...wrong];
  for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
  return { a, b, x, R, text, answer: x, choices, check: (v) => Number(v) === x };
}
