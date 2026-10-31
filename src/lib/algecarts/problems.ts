import { units } from "@/data/curriculum";
import { currentUnit, type RinkProblem } from "@/lib/rink";
import type { PracticeProblem, UserProgress } from "@/types";

/**
 * The questions a `?` box asks on the track: bare numbers and symbols, no
 * sentences, made up on the spot from the unit the student is on and paid
 * as that skill. "3x + 5 = 20" asks for x; "(1, 2), (3, 8): m = ?" asks for
 * the slope; every answer is a whole number that fits in the head. A form
 * is never ahead of the student's unit, and a unit with no form of its own
 * (Unit 1) gets the equations of Unit 2.
 */

interface Made {
  prompt: string;
  answer: number;
  /** Worked steps, split on → for the wrong-answer note. */
  explanation: string;
  hint: string;
}

interface Form {
  unit: number;
  skill: string;
  make: () => Made;
}

const ri = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
/** A number as it reads in a prompt: a real minus sign. */
const num = (v: number) => (v < 0 ? `−${-v}` : `${v}`);
/** "+ 3" or "− 3" after a term. */
const plus = (v: number) => (v < 0 ? `− ${-v}` : `+ ${v}`);
/** "2x", "x", "−x", "−3x". */
const term = (m: number, v = "x") => (m === 1 ? v : m === -1 ? `−${v}` : `${num(m)}${v}`);
/** "2x + 3", "x − 4", "−3x + 1". */
const line = (m: number, b: number) => (b === 0 ? term(m) : `${term(m)} ${plus(b)}`);
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (n: number) => String(n).split("").map((c) => SUP[c] ?? c).join("");
const nonZero = (lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = ri(lo, hi);
  return v;
};

const FORMS: Form[] = [
  // Unit 2: one step.
  {
    unit: 2,
    skill: "one-step-equations",
    make: () => {
      const kind = ri(0, 3);
      if (kind === 0) {
        const x = ri(1, 30);
        const a = ri(1, 20);
        return { prompt: `x + ${a} = ${x + a}`, answer: x, explanation: `Subtract ${a} from both sides → x = ${x + a} − ${a} = ${x}`, hint: `Undo the + ${a}.` };
      }
      if (kind === 1) {
        const a = ri(1, 20);
        const x = ri(a + 1, 40);
        return { prompt: `x − ${a} = ${x - a}`, answer: x, explanation: `Add ${a} to both sides → x = ${x - a} + ${a} = ${x}`, hint: `Undo the − ${a}.` };
      }
      if (kind === 2) {
        const a = ri(2, 12);
        const x = ri(2, 12);
        return { prompt: `${a}x = ${a * x}`, answer: x, explanation: `Divide both sides by ${a} → x = ${a * x} ÷ ${a} = ${x}`, hint: `${a} times what is ${a * x}?` };
      }
      const a = ri(2, 10);
      const k = ri(2, 10);
      return { prompt: `x/${a} = ${k}`, answer: a * k, explanation: `Multiply both sides by ${a} → x = ${k} × ${a} = ${a * k}`, hint: `Undo the ÷ ${a}.` };
    },
  },
  // Unit 2: two steps.
  {
    unit: 2,
    skill: "two-step-equations",
    make: () => {
      const kind = ri(0, 2);
      const a = ri(2, 9);
      const x = ri(1, 12);
      if (kind === 0) {
        const b = ri(1, 15);
        return { prompt: `${a}x + ${b} = ${a * x + b}`, answer: x, explanation: `Subtract ${b}: ${a}x = ${a * x} → Divide by ${a}: x = ${x}`, hint: `Undo the + ${b} first, then the × ${a}.` };
      }
      if (kind === 1) {
        const b = ri(1, 15);
        return { prompt: `${a}x − ${b} = ${num(a * x - b)}`, answer: x, explanation: `Add ${b}: ${a}x = ${a * x} → Divide by ${a}: x = ${x}`, hint: `Undo the − ${b} first, then the × ${a}.` };
      }
      const k = ri(2, 9);
      const b = ri(1, 12);
      return { prompt: `x/${a} + ${b} = ${k + b}`, answer: a * k, explanation: `Subtract ${b}: x/${a} = ${k} → Multiply by ${a}: x = ${a * k}`, hint: `Undo the + ${b} first, then the ÷ ${a}.` };
    },
  },
  // Unit 2: distribute, or x on both sides.
  {
    unit: 2,
    skill: "multi-step-equations",
    make: () => {
      if (ri(0, 1) === 0) {
        const a = ri(2, 6);
        const b = ri(1, 9);
        const x = ri(1, 10);
        return { prompt: `${a}(x + ${b}) = ${a * (x + b)}`, answer: x, explanation: `Divide by ${a}: x + ${b} = ${x + b} → Subtract ${b}: x = ${x}`, hint: `Divide both sides by ${a} first.` };
      }
      const a = ri(3, 8);
      const c = ri(1, a - 1);
      const x = ri(1, 9);
      const b = ri(1, 10);
      const d = (a - c) * x + b;
      const left = term(a - c);
      const last = a - c === 1 ? "" : ` → Divide by ${a - c}: x = ${x}`;
      return { prompt: `${a}x + ${b} = ${c}x + ${d}`, answer: x, explanation: `Subtract ${c}x: ${left} + ${b} = ${d} → Subtract ${b}: ${left} = ${d - b}${last}`, hint: `Get the x terms on one side first.` };
    },
  },
  // Unit 3: slope from two points.
  {
    unit: 3,
    skill: "slope",
    make: () => {
      const m = nonZero(-4, 4);
      const x1 = ri(-5, 5);
      const dx = ri(1, 5);
      const y1 = ri(-9, 9);
      const y2 = y1 + m * dx;
      return { prompt: `(${num(x1)}, ${num(y1)}), (${num(x1 + dx)}, ${num(y2)}): m = ?`, answer: m, explanation: `Rise ${num(y2)} − ${num(y1)} = ${num(y2 - y1)} → Run ${num(x1 + dx)} − ${num(x1)} = ${dx} → m = ${num(y2 - y1)} ÷ ${dx} = ${num(m)}`, hint: `Rise over run.` };
    },
  },
  // Unit 3: an intercept.
  {
    unit: 3,
    skill: "intercepts",
    make: () => {
      const a = ri(2, 9);
      const b = ri(2, 9);
      const x = ri(1, 10);
      const c = a * x;
      return { prompt: `${a}x + ${b}y = ${c}, y = 0, x = ?`, answer: x, explanation: `y = 0 leaves ${a}x = ${c} → x = ${c} ÷ ${a} = ${x}`, hint: `Put 0 in for y.` };
    },
  },
  // Unit 4: y from a line.
  {
    unit: 4,
    skill: "slope-intercept",
    make: () => {
      const m = nonZero(-5, 5);
      const b = ri(-9, 9);
      const x = ri(-5, 8);
      const y = m * x + b;
      return { prompt: `y = ${line(m, b)}, x = ${num(x)}, y = ?`, answer: y, explanation: `y = ${num(m)} × ${num(x)} ${plus(b)} → y = ${num(m * x)} ${plus(b)} = ${num(y)}`, hint: `Put ${num(x)} in for x.` };
    },
  },
  // Unit 5: a system, by adding or subtracting.
  {
    unit: 5,
    skill: "elimination",
    make: () => {
      const x = ri(1, 12);
      const y = ri(1, 12);
      if (ri(0, 1) === 0) {
        return { prompt: `x + y = ${x + y}, x − y = ${num(x - y)}, x = ?`, answer: x, explanation: `Add the equations: 2x = ${2 * x} → x = ${x}`, hint: `Add the two equations.` };
      }
      return { prompt: `2x + y = ${2 * x + y}, x + y = ${x + y}, x = ?`, answer: x, explanation: `Subtract the second from the first: x = ${2 * x + y} − ${x + y} = ${x}`, hint: `Subtract one equation from the other.` };
    },
  },
  // Unit 7: function notation.
  {
    unit: 7,
    skill: "function-notation",
    make: () => {
      const k = ri(-6, 8);
      if (ri(0, 1) === 0) {
        const m = nonZero(-5, 6);
        const b = ri(-9, 9);
        return { prompt: `f(x) = ${line(m, b)}, f(${num(k)}) = ?`, answer: m * k + b, explanation: `f(${num(k)}) = ${num(m)} × ${num(k)} ${plus(b)} → ${num(m * k)} ${plus(b)} = ${num(m * k + b)}`, hint: `Put ${num(k)} in for x.` };
      }
      const b = ri(-9, 9);
      return { prompt: `f(x) = x² ${plus(b)}, f(${num(k)}) = ?`, answer: k * k + b, explanation: `f(${num(k)}) = (${num(k)})² ${plus(b)} → ${k * k} ${plus(b)} = ${num(k * k + b)}`, hint: `Square ${num(k)} first.` };
    },
  },
  // Unit 8: the next term.
  {
    unit: 8,
    skill: "arithmetic-sequences",
    make: () => {
      const d = nonZero(-9, 12);
      const a = ri(-10, 20);
      const t = [a, a + d, a + 2 * d, a + 3 * d];
      return { prompt: `${t.map(num).join(", ")}, ?`, answer: a + 4 * d, explanation: `Each term adds ${num(d)} → ${num(a + 3 * d)} ${plus(d)} = ${num(a + 4 * d)}`, hint: `What is added each time?` };
    },
  },
  {
    unit: 8,
    skill: "geometric-sequences",
    make: () => {
      const r = pick([2, 3]);
      const a = r === 2 ? ri(1, 12) : ri(1, 3);
      const t = [a, a * r, a * r * r];
      return { prompt: `${t.join(", ")}, ?`, answer: a * r * r * r, explanation: `Each term is × ${r} → ${a * r * r} × ${r} = ${a * r * r * r}`, hint: `What is each term multiplied by?` };
    },
  },
  // Unit 9: powers and roots.
  {
    unit: 9,
    skill: "exponent-rules",
    make: () => {
      const kind = ri(0, 2);
      if (kind === 0) {
        const [b, e] = pick([[2, 3], [2, 4], [2, 5], [2, 6], [3, 2], [3, 3], [3, 4], [4, 2], [4, 3], [5, 2], [6, 2], [7, 2], [10, 2]]);
        return { prompt: `${b}${sup(e)} = ?`, answer: b ** e, explanation: `${Array(e).fill(b).join(" × ")} = ${b ** e}`, hint: `${b} multiplied by itself ${e} times.` };
      }
      if (kind === 1) {
        const b = ri(2, 9);
        const p = ri(1, 6);
        const q = ri(1, 6);
        return { prompt: `${b}${sup(p)} × ${b}${sup(q)} = ${b}ⁿ, n = ?`, answer: p + q, explanation: `Same base, so the exponents add → n = ${p} + ${q} = ${p + q}`, hint: `Same base: add the exponents.` };
      }
      const b = ri(2, 9);
      const q = ri(1, 5);
      const p = q + ri(1, 5);
      return { prompt: `${b}${sup(p)} ÷ ${b}${sup(q)} = ${b}ⁿ, n = ?`, answer: p - q, explanation: `Same base, so the exponents subtract → n = ${p} − ${q} = ${p - q}`, hint: `Same base: subtract the exponents.` };
    },
  },
  {
    unit: 9,
    skill: "simplifying-radicals",
    make: () => {
      const a = ri(2, 10);
      if (ri(0, 1) === 0) return { prompt: `√${a * a} = ?`, answer: a, explanation: `${a} × ${a} = ${a * a} → √${a * a} = ${a}`, hint: `What times itself is ${a * a}?` };
      const b = ri(2, 9);
      return { prompt: `√${a * a} + √${b * b} = ?`, answer: a + b, explanation: `√${a * a} = ${a} → √${b * b} = ${b} → ${a} + ${b} = ${a + b}`, hint: `Take each root first.` };
    },
  },
  // Unit 11: the middle term of a product.
  {
    unit: 11,
    skill: "multiplying-binomials",
    make: () => {
      const a = ri(1, 9);
      const b = ri(1, 9);
      if (ri(0, 1) === 0) {
        return { prompt: `(x + ${a})(x + ${b}) = x² + ?x + ${a * b}`, answer: a + b, explanation: `Outer ${b}x + inner ${a}x → ${a + b}x`, hint: `Add the outer and inner products.` };
      }
      return { prompt: `(x − ${a})(x + ${b}) = x² + ?x − ${a * b}`, answer: b - a, explanation: `Outer ${b}x + inner −${a}x → ${num(b - a)}x`, hint: `Add the outer and inner products, signs and all.` };
    },
  },
  // Unit 12: a root.
  {
    unit: 12,
    skill: "solving-by-factoring",
    make: () => {
      const a = ri(2, 10);
      if (ri(0, 1) === 0) return { prompt: `x² = ${a * a}, x > 0`, answer: a, explanation: `x = ±√${a * a} = ±${a} → the positive one is ${a}`, hint: `Which positive number squares to ${a * a}?` };
      const b = ri(1, 9);
      return { prompt: `(x − ${a})(x + ${b}) = 0, x > 0`, answer: a, explanation: `A product is 0 when a factor is 0 → x = ${a} or x = −${b} → the positive one is ${a}`, hint: `Set each factor to 0.` };
    },
  },
  // Unit 13: absolute value, one side picked out.
  {
    unit: 13,
    skill: "absolute-value",
    make: () => {
      const a = ri(1, 12);
      const k = ri(1, 12);
      if (ri(0, 1) === 0) return { prompt: `|x − ${a}| = ${k}, x > ${a}`, answer: a + k, explanation: `x − ${a} = ${k} or x − ${a} = −${k} → x = ${a + k} or x = ${num(a - k)} → the one above ${a} is ${a + k}`, hint: `Inside the bars is ${k} or −${k}.` };
      return { prompt: `|x + ${a}| = ${k}, x < −${a}`, answer: -a - k, explanation: `x + ${a} = ${k} or x + ${a} = −${k} → x = ${num(k - a)} or x = ${num(-a - k)} → the one below −${a} is ${num(-a - k)}`, hint: `Inside the bars is ${k} or −${k}.` };
    },
  },
];

const SKILL_HOME = new Map<string, { unitId: string; unitNumber: number; title: string }>();
for (const u of units) for (const s of u.skills) SKILL_HOME.set(s.id, { unitId: u.id, unitNumber: u.number, title: s.title });

/** A fresh bare problem for the unit the student is on; `avoid` holds prompts already asked. */
export function pickCartsProblem(progress: UserProgress, avoid = new Set<string>()): RinkProblem | null {
  const n = Math.max(2, currentUnit(progress).number);
  const eligible = FORMS.filter((f) => f.unit <= n && SKILL_HOME.has(f.skill));
  if (!eligible.length) return null;
  const here = eligible.filter((f) => f.unit === n);
  const pool = here.length && Math.random() < 0.6 ? here : eligible;
  let form = pick(pool);
  let made = form.make();
  for (let i = 0; i < 12 && avoid.has(made.prompt); i++) {
    form = pick(pool);
    made = form.make();
  }
  const home = SKILL_HOME.get(form.skill)!;
  const problem: PracticeProblem = {
    id: `carts-${form.skill}-${made.prompt}`,
    type: "numeric",
    prompt: made.prompt,
    hint: made.hint,
    answer: made.answer,
    explanation: made.explanation,
  };
  return { skillId: form.skill, skillTitle: home.title, unitId: home.unitId, unitNumber: home.unitNumber, problem };
}
