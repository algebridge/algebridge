// Every generated problem, solved independently from its own prompt.
//
//   npm run test:problems
//
// The generators build a problem and its answer together, from the same
// numbers, so a slip in one template can key a wrong answer on thousands of
// cards and nothing notices (the car depreciation keys were a dollar off on
// every exact half-dollar for months). This file reads each prompt as a
// student would, works the math out on its own, and checks:
//   - the answer key is right;
//   - on a multiple-choice card, exactly one choice is right, and it is the key;
//   - no card goes unchecked: a prompt this file cannot read is itself a failure.

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} },
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});

const { units } = await import("../../data/curriculum.ts");
const { generateProblemBank } = await import("../../data/skill-problem-generators.ts");
const { answerIsRight } = await import("../grading.ts");

const SEEDS = Number(process.argv[2] ?? 12);

/* ── A small evaluator: numbers, x and y, + − × ÷ /, brackets, powers, |abs|, roots ── */

type Env = Record<string, number>;

function evaluate(source: string, env: Env = {}): number {
  const s = source
    .replace(/[−–]/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/³√/g, "@3")
    .replace(/⁴√/g, "@4")
    .replace(/⁵√/g, "@5")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/⁴/g, "^4");
  let i = 0;
  let absDepth = 0;
  const peek = () => {
    while (s[i] === " ") i++;
    return s[i];
  };
  const fail = (why: string): never => {
    throw new Error(`${why} at ${i} in "${source}"`);
  };
  const expr = (): number => {
    let v = term();
    for (;;) {
      const c = peek();
      if (c === "+") {
        i++;
        v += term();
      } else if (c === "-") {
        i++;
        v -= term();
      } else return v;
    }
  };
  const term = (): number => {
    let v = unary();
    for (;;) {
      const c = peek();
      if (c === "*") {
        i++;
        v *= unary();
      } else if (c === "/") {
        i++;
        v /= unary();
      } else if (c !== undefined && (/[0-9.a-z(√@]/.test(c) || (c === "|" && absDepth === 0))) {
        v *= power();
      } else return v;
    }
  };
  const unary = (): number => {
    const c = peek();
    if (c === "-") {
      i++;
      return -unary();
    }
    if (c === "+") {
      i++;
      return unary();
    }
    return power();
  };
  const power = (): number => {
    const base = primary();
    if (peek() === "^") {
      i++;
      return Math.pow(base, unary());
    }
    return base;
  };
  const primary = (): number => {
    const c = peek();
    if (c === undefined) return fail("unexpected end");
    if (c === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") fail("missing )");
      i++;
      return v;
    }
    if (c === "|") {
      i++;
      absDepth++;
      const v = expr();
      if (peek() !== "|") fail("missing |");
      i++;
      absDepth--;
      return Math.abs(v);
    }
    if (c === "√") {
      i++;
      return Math.sqrt(power());
    }
    if (c === "@") {
      i++;
      const n = Number(s[i]);
      i++;
      const v = power();
      return Math.sign(v) * Math.pow(Math.abs(v), 1 / n);
    }
    const num = s.slice(i).match(/^\d+(\.\d+)?|^\.\d+/);
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    if (/[a-z]/.test(c)) {
      i++;
      if (!(c in env)) fail(`unknown variable ${c}`);
      return env[c];
    }
    return fail(`unexpected "${c}"`);
  };
  const v = expr();
  if (peek() !== undefined) fail("trailing text");
  return v;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const num = (t: string) => evaluate(t);
/** A fraction, whole number or decimal written as text, as a value. */
const val = (t: string) => evaluate(t.trim());

/** ax² + bx + c from an expression in x. */
function quadCoeffs(expr: string): [number, number, number] {
  const f = (x: number) => evaluate(expr, { x });
  const c = f(0);
  const a = (f(1) + f(-1) - 2 * c) / 2;
  const b = (f(1) - f(-1)) / 2;
  if (!close(f(2), a * 4 + b * 2 + c) || !close(f(-3), a * 9 - b * 3 + c)) throw new Error(`not a quadratic: ${expr}`);
  return [a, b, c];
}

/** Two expressions in x are the same polynomial. */
function samePoly(p: string, q: string): boolean {
  return [-3, -1, 0, 1, 2, 5].every((x) => close(evaluate(p, { x }), evaluate(q, { x })));
}

/** An equation in x and y, as the line it draws: y = mx + b (or null for a vertical line). */
function lineOf(eq: string): { m: number; b: number } | null {
  const [l, r] = eq.split("=");
  const g = (x: number, y: number) => evaluate(l, { x, y }) - evaluate(r, { x, y });
  const yAt = (x: number) => {
    const g0 = g(x, 0);
    const slope = g(x, 1) - g0;
    if (close(slope, 0)) return NaN;
    return -g0 / slope;
  };
  const y0 = yAt(0);
  const y1 = yAt(1);
  if (Number.isNaN(y0)) return null;
  return { m: y1 - y0, b: y0 };
}

const sameLine = (a: { m: number; b: number } | null, b: { m: number; b: number } | null) =>
  !!a && !!b && close(a.m, b.m) && close(a.b, b.b);

/** The x that makes a linear equation in x true. */
function solveLinear(left: string, right: string): number {
  const g = (x: number) => evaluate(left, { x }) - evaluate(right, { x });
  const g0 = g(0);
  const slope = g(1) - g0;
  if (!close(g(7), g0 + 7 * slope)) throw new Error(`not linear: ${left} = ${right}`);
  return -g0 / slope;
}

/** A description of a set of x-values ("x < 3", "-2 ≤ x ≤ 5", "x < -1 or x > 4"), as a test. */
function setOf(text: string): ((x: number) => boolean) | null {
  const t = text.replace(/[−–]/g, "-").trim();
  const parts = t.split(/\s+or\s+/i);
  const tests = parts.map((part) => {
    let m = part.match(/^(-?[\d.]+)\s*(<|≤)\s*x\s*(<|≤)\s*(-?[\d.]+)$/);
    if (m) {
      const [lo, a, b, hi] = [Number(m[1]), m[2], m[3], Number(m[4])];
      return (x: number) => (a === "<" ? x > lo : x >= lo) && (b === "<" ? x < hi : x <= hi);
    }
    m = part.match(/^x\s*(<|>|≤|≥)\s*(-?[\d.]+)$/);
    if (m) {
      const [op, k] = [m[1], Number(m[2])];
      return (x: number) => (op === "<" ? x < k : op === ">" ? x > k : op === "≤" ? x <= k : x >= k);
    }
    return null;
  });
  if (tests.some((f) => !f)) return null;
  return (x: number) => tests.some((f) => f!(x));
}

function sameSet(f: (x: number) => boolean, g: (x: number) => boolean): boolean {
  for (let x = -40; x <= 40; x += 0.25) if (f(x) !== g(x)) return false;
  return true;
}

/** Of these choices, which are right? The key must be the only one. */
function onlyRight(p: any, isRight: (choice: string) => boolean): string | null {
  // Read each choice as the grader does: spacing is not part of the answer.
  const right = (p.choices as string[]).filter((c) => isRight(c.replace(/\s+/g, " ").trim()));
  if (right.length !== 1) return `${right.length} right choices: ${JSON.stringify(p.choices)} key ${JSON.stringify(p.answer)}`;
  if (!answerIsRight(p, right[0])) return `the right choice ${JSON.stringify(right[0])} is not the key ${JSON.stringify(p.answer)}`;
  return null;
}

function expectAnswer(p: any, want: number): string | null {
  const got = Number(p.answer);
  if (typeof p.decimalPlaces === "number") {
    const f = 10 ** p.decimalPlaces;
    // Half up, from the exact value, the way a student rounds.
    const r = Math.round(want * f + 1e-9) / f;
    return close(got, r) ? null : `key ${got}, should be ${r}`;
  }
  return close(got, want) ? null : `key ${got}, should be ${want}`;
}

const point = (t: string) => {
  const m = t.replace(/[−–]/g, "-").match(/^\((-?[\d.]+),\s*(-?[\d.]+)\)$/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};

/* ── The checks, by skill. Each returns null (right), a problem found, or "unread". ── */

type Check = (p: any) => string | null | "unread";
const UNITS_ABBR: Record<string, string> = { pounds: "lb", ounces: "oz", feet: "ft", inches: "in", hours: "h", minutes: "min", meters: "m", centimeters: "cm", kilograms: "kg", grams: "g", yards: "yd", gallons: "gal", quarts: "qt" };

const checks: Record<string, Check> = {
  "unit-basics": (p) => {
    let m;
    if ((m = p.prompt.match(/^A hiking trail is ([\d.]+) miles long\. You have walked ([\d,]+) feet of it\. How many feet are left\? \(1 mile = 5,280 ft\)$/))) return expectAnswer(p, +m[1] * 5280 - +m[2].replace(/,/g, ""));
    if ((m = p.prompt.match(/^A rug is (\d+) feet long and (\d+) feet wide\. What is its area in square yards\? \(1 yard = 3 feet\)$/))) return expectAnswer(p, (+m[1] * +m[2]) / 9);
    if ((m = p.prompt.match(/^One lap of a running track is 400 meters\. You run (\d+) laps\. How many kilometers is that\? Write your answer as a decimal\.$/))) return expectAnswer(p, (+m[1] * 400) / 1000);
    if ((m = p.prompt.match(/^A cyclist rides at (\d+) miles per hour\. How many feet per minute is that\? \(1 mile = 5,280 ft\)$/))) return expectAnswer(p, (+m[1] * 5280) / 60);
    if ((m = p.prompt.match(/^A cooler holds (\d+) liters of water\. How many (\d+)-milliliter bottles can you fill from it\? \(1 L = 1,000 mL\)$/))) {
      const n = (+m[1] * 1000) / +m[2];
      return Number.isInteger(n) ? expectAnswer(p, n) : "the bottles do not come out whole";
    }
    if ((m = p.prompt.match(/^Convert (\d+) miles to feet/))) return expectAnswer(p, +m[1] * 5280);
    if ((m = p.prompt.match(/^Convert (\d+) inches to feet/))) return expectAnswer(p, +m[1] / 12);
    if ((m = p.prompt.match(/^Convert (\d+) kilometers to meters/))) return expectAnswer(p, +m[1] * 1000);
    if ((m = p.prompt.match(/^Which conversion factor converts (\w+) to (\w+)\? \(1 (\w+) = (\d+) (\w+)\)/))) {
      const [from, to] = [UNITS_ABBR[m[1]], UNITS_ABBR[m[2]]];
      const [big, n, small] = [m[3], Number(m[4]), m[5]];
      return onlyRight(p, (c) => {
        const f = c.match(/^(\d+) (\w+) \/ (\d+) (\w+)$/);
        if (!f || f[2] !== to || f[4] !== from) return false;
        const [top, bottom] = [Number(f[1]), Number(f[3])];
        // top "to" = bottom "from" must be a true statement.
        return to === small ? top === n * bottom && from === big : bottom === n * top && to === big;
      });
    }
    return "unread";
  },
  "dimensional-analysis": (p) => {
    let m;
    if ((m = p.prompt.match(/^Convert ([\d.]+) hours to seconds/))) return expectAnswer(p, +m[1] * 3600);
    if ((m = p.prompt.match(/^Convert (\d+) days to hours/))) return expectAnswer(p, +m[1] * 24);
    if ((m = p.prompt.match(/^Convert (\d+) days to minutes\.$/))) return expectAnswer(p, +m[1] * 24 * 60);
    if ((m = p.prompt.match(/^A (\d+)-kilogram sack of rice is split evenly into (\d+) bags\. How many grams go in each bag\?$/))) {
      const g = (+m[1] * 1000) / +m[2];
      return Number.isInteger(g) ? expectAnswer(p, g) : "grams per bag are not whole";
    }
    if ((m = p.prompt.match(/^A box holds (\d+) cans of beans, and each can weighs (\d+) grams\. How many kilograms of beans are in the box\?( Write your answer as a decimal\.)?$/))) {
      const kg = (+m[1] * +m[2]) / 1000;
      if (!Number.isInteger(kg) && !m[3]) return "a decimal answer with no instruction";
      return expectAnswer(p, kg);
    }
    if ((m = p.prompt.match(/^A toy car rolls (\d+) centimeters per second\. How many meters per minute is that\?$/))) return expectAnswer(p, (+m[1] * 60) / 100);
    if ((m = p.prompt.match(/^Every song on a playlist is (\d+) seconds long\. How many songs fit in (\d+) hours?\?$/))) {
      const n = (+m[2] * 3600) / +m[1];
      return Number.isInteger(n) ? expectAnswer(p, n) : "the songs do not come out whole";
    }
    if ((m = p.prompt.match(/^Convert (\d+) kilograms to grams/))) return expectAnswer(p, +m[1] * 1000);
    if ((m = p.prompt.match(/^Convert (\d+) minutes to milliseconds/))) return expectAnswer(p, +m[1] * 60000);
    if ((m = p.prompt.match(/^Convert ([\d,]+) grams to kilograms\.( Write your answer as a decimal\.)?$/))) {
      const kg = +m[1].replace(/,/g, "") / 1000;
      if (!Number.isInteger(kg) && !m[2]) return "a decimal answer with no instruction";
      return expectAnswer(p, kg);
    }
    if ((m = p.prompt.match(/^Convert (\d+) weeks to hours/))) return expectAnswer(p, +m[1] * 7 * 24);
    if ((m = p.prompt.match(/^A cyclist rides at (\d+) kilometers per hour\. How many meters per second/))) {
      const v = (+m[1] * 1000) / 3600;
      return Number.isInteger(v) ? expectAnswer(p, v) : "meters per second is not whole";
    }
    if ((m = p.prompt.match(/^Convert (\d+) meters to millimeters/))) return expectAnswer(p, +m[1] * 1000);
    if ((m = p.prompt.match(/^A water tank leaks (\d+) liters per hour\. How many milliliters per minute/))) {
      const v = (+m[1] * 1000) / 60;
      return Number.isInteger(v) ? expectAnswer(p, v) : "milliliters per minute is not whole";
    }
    if ((m = p.prompt.match(/^Convert (\d+) yards to inches/))) return expectAnswer(p, +m[1] * 3 * 12);
    if ((m = p.prompt.match(/^Convert ([\d,]+) seconds to minutes/))) return expectAnswer(p, +m[1].replace(/,/g, "") / 60);
    if ((m = p.prompt.match(/^Find the error in this conversion of (\d+) km to centimeters/))) {
      const km = +m[1];
      const s1 = p.steps[1].replace(/,/g, "").match(/^(\d+) km × 1000 m\/km = (\d+) m$/);
      const s2 = p.steps[2].replace(/,/g, "").match(/= (\d+(\.\d+)?) cm$/);
      if (!s1 || +s1[2] !== km * 1000) return "step 2 should be right and is not";
      if (!s2 || +s2[1] === km * 100000) return "step 3 should be the mistake and is right";
      return p.wrongStepIndex === 2 ? null : `wrong step ${p.wrongStepIndex}, should be 2`;
    }
    return "unread";
  },
  "unit-word-problems": (p) => {
    let m;
    if ((m = p.prompt.match(/^A recipe makes (\d+) cookies with (\d+) cups of flour\. How many cups of flour do you need for (\d+) cookies\?$/))) return expectAnswer(p, (+m[2] * +m[3]) / +m[1]);
    if ((m = p.prompt.match(/^You drive (\d+) miles in a car that gets (\d+) miles per gallon\. Gas costs \$([\d.]+) a gallon\. How much does the gas for the trip cost\? \(round to the nearest cent\)$/))) return expectAnswer(p, (+m[1] / +m[2]) * +m[3]);
    if ((m = p.prompt.match(/^A train travels at (\d+) miles per hour\. How many minutes does it take to go (\d+) miles\?$/))) return expectAnswer(p, (+m[2] / +m[1]) * 60);
    if ((m = p.prompt.match(/^A runner finishes (\d+) kilometers in (\d+) minutes\. At the same pace, how many minutes would (\d+) kilometers take\?$/))) return expectAnswer(p, (+m[2] / +m[1]) * +m[3]);
    if ((m = p.prompt.match(/^A (\d+)-ounce bag of trail mix costs \$([\d.]+)\. A (\d+)-ounce bag costs \$([\d.]+)\. How many cents more per ounce does the small bag cost\?$/))) return expectAnswer(p, Math.round((+m[2] / +m[1] - +m[4] / +m[3]) * 100 * 1e6) / 1e6);
    if ((m = p.prompt.match(/^A leaky faucet drips (\d+) milliliters every minute\. How many liters does it waste in one week\? Write your answer as a decimal\.$/))) return expectAnswer(p, (+m[1] * 60 * 24 * 7) / 1000);
    if ((m = p.prompt.match(/^A recipe needs (\d+) mL/))) return expectAnswer(p, +m[1] / 1000);
    if ((m = p.prompt.match(/^You drive (\d+) miles using (\d+) gallons/))) {
      if ((+m[1] / +m[2]) % 1 !== 0) return "miles per gallon is not whole";
      return expectAnswer(p, +m[1] / +m[2]);
    }
    if ((m = p.prompt.match(/^A train travels (\d+) mph for (\d+) hours/))) return expectAnswer(p, +m[1] * +m[2]);
    return "unread";
  },
  "one-step-equations": (p) => wordOrLinear(p),
  "two-step-equations": (p) => wordOrLinear(p),
  "multi-step-equations": (p) => wordOrLinear(p),
  "equations-with-fractions": (p) => {
    const m = p.prompt.match(/^What is the least common denominator of (.*)\?$/);
    if (m) {
      const ds = [...m[1].matchAll(/1\/(\d+)/g)].map((d) => +d[1]);
      const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
      const lcd = ds.reduce((acc, d) => (acc * d) / g(acc, d), 1);
      return onlyRight(p, (c) => +c === lcd);
    }
    return linearOrError(p);
  },
  "linear-inequalities": (p) => {
    if (p.prompt === "When do you flip the inequality sign?") return p.answer === "When multiplying or dividing by a negative" ? null : "wrong key";
    let m;
    if ((m = p.prompt.match(/^Solve for x: (.*) (>|<) (-?\d+)\. What number does x have to be (greater|less) than\?/))) {
      const boundary = solveLinear(m[1], m[3]);
      const dir = evaluate(m[1], { x: boundary + 1 }) > +m[3] === (m[2] === ">") ? "greater" : "less";
      if (dir !== m[4]) return `the prompt says ${m[4]}, the solution is ${dir}`;
      return expectAnswer(p, boundary);
    }
    if ((m = p.prompt.match(/^Solve: (.*) (>|<|≥|≤) (.*)$/))) {
      const [left, op, right] = [m[1], m[2], m[3]];
      const holds = (x: number) => {
        const v = evaluate(left, { x });
        const c = evaluate(right, { x });
        return op === ">" ? v > c : op === "<" ? v < c : op === "≥" ? v >= c : v <= c;
      };
      return onlyRight(p, (choice) => {
        const f = setOf(choice);
        return !!f && sameSet(f, holds);
      });
    }
    if ((m = p.prompt.match(/^\w+ has \$(\d+) to spend on a \$(\d+) shirt and some pairs of socks at \$(\d+) a pair\. What is the greatest number of pairs of socks \w+ can buy\?$/))) return expectAnswer(p, Math.floor((+m[1] - +m[2]) / +m[3]));
    if ((m = p.prompt.match(/^A streaming plan costs \$(\d+) a month plus \$(\d+) for each movie rental\. \w+ can spend at most \$(\d+) a month\. What is the greatest number of movies \w+ can rent in a month\?$/))) return expectAnswer(p, Math.floor((+m[3] - +m[1]) / +m[2]));
    return "unread";
  },
  "coordinate-plane": (p) => {
    let m;
    const P = String.raw`\((-?\d+), (-?\d+)\)`;
    if ((m = p.prompt.match(new RegExp(`^How far apart are the points ${P} and ${P}\\?$`)))) {
      const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
      if (x1 !== x2 && y1 !== y2) return "the points are not on one grid line";
      return expectAnswer(p, Math.abs(x2 - x1) + Math.abs(y2 - y1));
    }
    if ((m = p.prompt.match(new RegExp(`^What is the midpoint of ${P} and ${P}\\?$`)))) {
      const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && close(q.x, (x1 + x2) / 2) && close(q.y, (y1 + y2) / 2);
      });
    }
    if ((m = p.prompt.match(new RegExp(`^Reflect the point ${P} across the (x|y)-axis\\. Where does it land\\?$`)))) {
      const [x, y] = [+m[1], +m[2]];
      const want = m[3] === "y" ? { x: -x, y } : { x, y: -y };
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && q.x === want.x && q.y === want.y;
      });
    }
    if ((m = p.prompt.match(new RegExp(`^Start at ${P}\\. Move (\\d+) units? (right|left) and (\\d+) units? (up|down)\\. Where do you land\\?$`)))) {
      const x = +m[1] + (m[4] === "right" ? +m[3] : -m[3]);
      const y = +m[2] + (m[6] === "up" ? +m[5] : -m[5]);
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && q.x === x && q.y === y;
      });
    }
    if ((m = p.prompt.match(new RegExp(`^Three corners of a rectangle are ${P}, ${P}, and ${P}\\. What is the (rectangle's area|fourth corner)\\?$`)))) {
      const pts = [0, 1, 2].map((k) => ({ x: +m[1 + 2 * k], y: +m[2 + 2 * k] }));
      const once = (vals: number[]) => vals.find((v) => vals.filter((w) => w === v).length === 1);
      const xs = pts.map((q) => q.x);
      const ys = pts.map((q) => q.y);
      if (new Set(xs).size !== 2 || new Set(ys).size !== 2) return "the three corners are not a grid rectangle's";
      if (m[7] === "rectangle's area") return expectAnswer(p, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)));
      const fx = once(xs)!;
      const fy = once(ys)!;
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && q.x === fx && q.y === fy;
      });
    }
    if ((m = p.prompt.match(/^In which quadrant is the point \((-?\d+), (-?\d+)\)\?$/))) {
      const [x, y] = [+m[1], +m[2]];
      const q = x > 0 && y > 0 ? "Quadrant I" : x < 0 && y > 0 ? "Quadrant II" : x < 0 && y < 0 ? "Quadrant III" : x > 0 && y < 0 ? "Quadrant IV" : "axis";
      return onlyRight(p, (c) => c === q);
    }
    if ((m = p.prompt.match(/^What is the (x|y)-coordinate of \((-?\d+), (-?\d+)\)\?$/))) return expectAnswer(p, m[1] === "x" ? +m[2] : +m[3]);
    return "unread";
  },
  slope: (p) => {
    let m;
    if ((m = p.prompt.match(/^A table lists points on a line\. When x is (.*), y is (.*)\. What is the slope\? Give it as a whole number or a fraction\.$/))) {
      const xs = m[1].split(", ").map(Number);
      const ys = m[2].split(", ").map(Number);
      const slope = (ys[1] - ys[0]) / (xs[1] - xs[0]);
      if (!xs.every((x, k) => close(ys[k], ys[0] + slope * (x - xs[0])))) return "the table is not a line";
      return expectAnswer(p, slope);
    }
    if ((m = p.prompt.match(/^A plant was ([\d.]+) cm tall on day (\d+) and ([\d.]+) cm tall on day (\d+)\. How many centimeters did it grow per day\?( Write your answer as a decimal\.)?$/))) {
      const rate = (+m[3] - +m[1]) / (+m[4] - +m[2]);
      if (!Number.isInteger(rate) && !m[5]) return "a decimal answer with no instruction";
      return expectAnswer(p, rate);
    }
    if ((m = p.prompt.match(/^The line through \((-?\d+), (-?\d+)\) and \((-?\d+), k\) has slope (-?[\d/]+)\. What is k\?$/))) return expectAnswer(p, +m[2] + val(m[4]) * (+m[3] - +m[1]));
    if ((m = p.prompt.match(/^The line through \((-?\d+), (-?\d+)\) and \(k, (-?\d+)\) has slope (-?\d+)\. What is k\?$/))) return expectAnswer(p, +m[1] + (+m[3] - +m[2]) / +m[4]);
    if ((m = p.prompt.match(/^A car's gas tank held (\d+) gallons at mile (\d+) and (\d+) gallons at mile (\d+)\. What is the rate of change of the gas, in gallons per mile\? Give it as a fraction\.$/))) return expectAnswer(p, (+m[3] - +m[1]) / (+m[4] - +m[2]));
    if ((m = p.prompt.match(/^Find the slope between \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)/))) {
      const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
      return expectAnswer(p, (y2 - y1) / (x2 - x1));
    }
    if ((m = p.prompt.match(/^What is the slope of the line through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)\?$/))) {
      const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
      const want = x1 === x2 ? "Undefined" : String((y2 - y1) / (x2 - x1));
      return onlyRight(p, (c) => (c === "Undefined" ? want === "Undefined" : want !== "Undefined" && close(val(c), +want)));
    }
    return "unread";
  },
  "graphing-lines": (p) => {
    let m;
    if ((m = p.prompt.match(/^The point \(a, (-?\d+)\) is on the line (y = .*)\. What is a\?$/))) {
      const line = lineOf(m[2])!;
      return expectAnswer(p, (+m[1] - line.b) / line.m);
    }
    if ((m = p.prompt.match(/^Where does the line (y = .*) cross the x-axis\? Type the x-value\.$/))) {
      const line = lineOf(m[1])!;
      return expectAnswer(p, -line.b / line.m);
    }
    if ((m = p.prompt.match(/^Start at the y-intercept of (y = .*) and follow the slope for two steps, each one (\d+) to the right and (\d+) (up|down)\. Where do you end up\?$/))) {
      const line = lineOf(m[1])!;
      const rise = m[4] === "up" ? +m[3] : -m[3];
      if (!close(line.m, rise / +m[2])) return "the steps described are not the line's slope";
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && close(q.x, 2 * +m[2]) && close(q.y, line.b + 2 * rise);
      });
    }
    if ((m = p.prompt.match(/^Which point is on the line (y = .*)\?$/))) {
      const line = lineOf(m[1])!;
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && close(q.y, line.m * q.x + line.b);
      });
    }
    if ((m = p.prompt.match(/^What is the y-intercept of (y = .*)\?$/))) {
      const line = lineOf(m[1])!;
      return onlyRight(p, (c) => close(val(c), line.b));
    }
    if ((m = p.prompt.match(/^For (y = .*), what is y when x = (-?\d+)\?$/))) {
      const line = lineOf(m[1])!;
      return expectAnswer(p, line.m * +m[2] + line.b);
    }
    return "unread";
  },
  intercepts: (p) => {
    let m;
    if ((m = p.prompt.match(/^The line (.*) = (-?\d+) makes a triangle with the x-axis and the y-axis\. What is the triangle's area\?$/))) {
      const xi = solveLinear(m[1].replace(/y/g, "(0)"), m[2]);
      const yi = solveLinear(m[1].replace(/x/g, "(0)").replace(/y/g, "x"), m[2]);
      return expectAnswer(p, Math.abs(xi * yi) / 2);
    }
    if ((m = p.prompt.match(/^A line crosses the x-axis at \((-?\d+), 0\) and the y-axis at \(0, (-?\d+)\)\. What is its slope\? Give it as a whole number or a fraction\.$/))) return expectAnswer(p, (+m[2] - 0) / (0 - +m[1]));
    if ((m = p.prompt.match(/^Find the (x|y)-intercept of (.*) = (-?\d+)\. Type its/))) {
      const [which, left, c] = [m[1], m[2], +m[3]];
      const want = which === "x" ? solveLinear(left.replace(/y/g, "(0)"), String(c)) : solveLinear(left.replace(/x/g, "(0)").replace(/y/g, "x"), String(c));
      return expectAnswer(p, want);
    }
    return "unread";
  },
  "slope-intercept": (p) => {
    let m;
    if ((m = p.prompt.match(/^A line has slope (-?\d+) and passes through \((-?\d+), (-?\d+)\)\. What is its y-intercept\?$/))) return expectAnswer(p, +m[3] - +m[1] * +m[2]);
    if ((m = p.prompt.match(/^A line passes through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)\. Which equation is it\?$/))) {
      const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
      const slope = (y2 - y1) / (x2 - x1);
      return onlyRight(p, (c) => sameLine(lineOf(c), { m: slope, b: y1 - slope * x1 }));
    }
    if ((m = p.prompt.match(/^Rewrite (.* = -?\d+) in slope-intercept form\. What is the slope\? Give it as a whole number or a fraction\.$/))) return expectAnswer(p, lineOf(m[1])!.m);
    if ((m = p.prompt.match(/^A pool holds ([\d,]+) gallons of water and drains (\d+) gallons each minute\. Which equation gives g, the gallons left after t minutes\?$/))) {
      const [start, rate] = [+m[1].replace(/,/g, ""), +m[2]];
      return onlyRight(p, (c) => {
        const f = c.match(/^g = (.*)$/);
        return !!f && [0, 1, 5].every((t) => close(evaluate(f[1], { t }), start - rate * t));
      });
    }
    if ((m = p.prompt.match(/^A ride-share charges a flat fee plus a price per mile\. A (\d+)-mile ride costs \$(\d+), and a (\d+)-mile ride costs \$(\d+)\. What is the flat fee, in dollars\?$/))) {
      const [d1, c1, d2, c2] = m.slice(1, 5).map(Number);
      const per = (c2 - c1) / (d2 - d1);
      return expectAnswer(p, c1 - per * d1);
    }
    if ((m = p.prompt.match(/^Which line has the same y-intercept as (y = .*) and passes through \((-?\d+), (-?\d+)\)\?$/))) {
      const b = lineOf(m[1])!.b;
      const slope = (+m[3] - b) / +m[2];
      return onlyRight(p, (c) => sameLine(lineOf(c), { m: slope, b }));
    }
    if ((m = p.prompt.match(/^Which equation has slope (-?\d+) and y-intercept (-?\d+)\?$/))) {
      const target = { m: +m[1], b: +m[2] };
      return onlyRight(p, (c) => sameLine(lineOf(c), target));
    }
    if ((m = p.prompt.match(/^In (y = .*), what is the (slope|y-intercept)\?$/))) {
      const line = lineOf(m[1])!;
      return expectAnswer(p, m[2] === "slope" ? line.m : line.b);
    }
    return "unread";
  },
  "point-slope": (p) => {
    let n;
    if ((n = p.prompt.match(/^Which equation is the line through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\), in point-slope form with the first point\?$/))) {
      const [x1, y1, x2, y2] = n.slice(1, 5).map(Number);
      const slope = (y2 - y1) / (x2 - x1);
      return onlyRight(p, (c) => sameLine(lineOf(c), { m: slope, b: y1 - slope * x1 }));
    }
    if ((n = p.prompt.match(/^A line is written (.*)\. What is its y-intercept\?$/))) return expectAnswer(p, lineOf(n[1])!.b);
    if ((n = p.prompt.match(/^A line is written (.*)\. What is y when x = (-?\d+)\?$/))) {
      const line = lineOf(n[1])!;
      return expectAnswer(p, line.m * +n[2] + line.b);
    }
    if ((n = p.prompt.match(/^A line passes through \((-?\d+), (-?\d+)\) with slope (-?\d+)\. Where does it cross the x-axis\? Type the x-value\.$/))) return expectAnswer(p, +n[1] - +n[2] / +n[3]);
    const m = p.prompt.match(/^Which equation is the line through \((-?\d+), (-?\d+)\) with slope (-?\d+), written in point-slope form\?$/);
    if (!m) return "unread";
    const [x1, y1, s] = [+m[1], +m[2], +m[3]];
    const target = { m: s, b: y1 - s * x1 };
    return onlyRight(p, (c) => sameLine(lineOf(c), target));
  },
  "standard-form": (p) => {
    let n;
    if ((n = p.prompt.match(/^What is the slope of the line (.* = -?\d+)\? Give it as a whole number or a fraction\.$/))) return expectAnswer(p, lineOf(n[1])!.m);
    if ((n = p.prompt.match(/^Adult tickets cost \$(\d+) and student tickets cost \$(\d+)\. Ticket sales came to \$(\d+), so (\d+)a \+ (\d+)s = \3\. If (\d+) adult tickets were sold, how many student tickets were sold\?$/))) {
      if (n[4] !== n[1] || n[5] !== n[2]) return "the equation does not match the prices";
      const s = (+n[3] - +n[1] * +n[6]) / +n[2];
      return Number.isInteger(s) && s >= 0 ? expectAnswer(p, s) : "no whole number of student tickets";
    }
    if ((n = p.prompt.match(/^Write (y = .*) in standard form, Ax \+ By = C, with whole numbers and A positive\.$/))) {
      const target = lineOf(n[1]);
      return onlyRight(p, (c) => /^\d*x [+−] \d*y = -?\d+$/.test(c) && sameLine(lineOf(c), target));
    }
    if ((n = p.prompt.match(/^The point \((-?\d+), k\) is on the line (.*) = (-?\d+)\. What is k\?$/))) {
      const left = n[2].replace(/x/g, `(${n[1]})`).replace(/y/g, "x");
      return expectAnswer(p, solveLinear(left, n[3]));
    }
    const m = p.prompt.match(/^Convert (.* = -?\d+) to slope-intercept form\.$/);
    if (!m) return "unread";
    const target = lineOf(m[1]);
    return onlyRight(p, (c) => sameLine(lineOf(c), target));
  },
  "parallel-perpendicular": (p) => {
    let m;
    if ((m = p.prompt.match(/^Which line is parallel to (.* = -?\d+) and passes through \((-?\d+), (-?\d+)\)\?$/))) {
      const slope = lineOf(m[1])!.m;
      return onlyRight(p, (c) => sameLine(lineOf(c), { m: slope, b: +m[3] - slope * +m[2] }));
    }
    if ((m = p.prompt.match(/^A line passes through \((-?\d+), (-?\d+)\) and is perpendicular to (y = .*)\. What is its y-intercept\?$/))) {
      const slope = -1 / lineOf(m[3])!.m;
      return expectAnswer(p, +m[2] - slope * +m[1]);
    }
    if ((m = p.prompt.match(/^Are the lines (y = .*) and (.* = -?\d+) parallel, perpendicular, or neither\?$/))) {
      const [a, b] = [lineOf(m[1])!, lineOf(m[2])!];
      const want = sameLine(a, b) ? "The same line" : close(a.m, b.m) ? "Parallel" : close(a.m * b.m, -1) ? "Perpendicular" : "Neither";
      return onlyRight(p, (c) => c === want);
    }
    if ((m = p.prompt.match(/^For what value of k is the line y = kx.* perpendicular to (y = .*)\? Give it as a whole number or a fraction\.$/))) return expectAnswer(p, -1 / lineOf(m[1])!.m);
    if ((m = p.prompt.match(/^Line A has slope (-?[\d/]+)\. What is the slope of a line perpendicular/))) return expectAnswer(p, -1 / val(m[1]));
    if ((m = p.prompt.match(/^Which line is parallel to (y = .*)\?$/))) {
      const given = lineOf(m[1])!;
      return onlyRight(p, (c) => {
        const l = lineOf(c.replace(/\((-?\d+)\/(\d+)\)x/, "($1/$2)x"));
        return !!l && close(l.m, given.m) && !close(l.b, given.b);
      });
    }
    if ((m = p.prompt.match(/^A line has slope (-?\d+)\. Which slope makes a line perpendicular to it\?$/))) {
      const want = -1 / +m[1];
      return onlyRight(p, (c) => close(val(c), want));
    }
    return "unread";
  },
  "graphing-systems": (p) => {
    let n;
    if ((n = p.prompt.match(/^Candle A is (\d+) cm tall and burns down (\d+) cm an hour\. Candle B is (\d+) cm tall and burns down (\d+) cm an hour\. After how many hours are they the same height\?$/))) {
      const [h1, r1, h2, r2] = n.slice(1, 5).map(Number);
      const t = (h1 - h2) / (r1 - r2);
      if (h1 - r1 * t <= 0) return "the candles are gone before they match";
      return expectAnswer(p, t);
    }
    if ((n = p.prompt.match(/^How many solutions does the system (y = .*) and (.* = -?\d+) have\?$/))) {
      const [a, b] = [lineOf(n[1])!, lineOf(n[2])];
      const want = !b ? "One" : sameLine(a, b) ? "Infinitely many" : close(a.m, b.m) ? "None" : "One";
      return onlyRight(p, (c) => c === want);
    }
    const m = p.prompt.match(/^Where do (y = .*) and (y = .*) intersect\?$/);
    if (!m) return "unread";
    const [a, b] = [lineOf(m[1])!, lineOf(m[2])!];
    const x = (b.b - a.b) / (a.m - b.m);
    const y = a.m * x + a.b;
    return onlyRight(p, (c) => {
      const q = point(c);
      return !!q && close(q.x, x) && close(q.y, y);
    });
  },
  substitution: (p) => {
    const m = p.prompt.match(/^(\w+) is (\d+) times as old as (\w+)\. In (\d+) years, their ages will add up to (\d+)\. How old is \1 now\?$/);
    if (m) {
      const [k, later, sum] = [+m[2], +m[4], +m[5]];
      const young = (sum - 2 * later) / (k + 1);
      return Number.isInteger(young) ? expectAnswer(p, k * young) : "the ages do not come out whole";
    }
    return systemCheck(p);
  },
  elimination: (p) => {
    if (p.type === "step-order") {
      const m = p.prompt.match(/x \+ y = (-?\d+) and x − y = (-?\d+)/);
      if (!m) return "unread";
      const x = (+m[1] + +m[2]) / 2;
      const y = +m[1] - x;
      const ok = p.steps[0] === `Add the equations: 2x = ${2 * x}` && p.steps[1] === `Solve: x = ${x}` && p.steps[3] === `Solve for y: y = ${y}`;
      return ok && JSON.stringify(p.correctOrder) === "[0,1,2,3]" ? null : "step-order steps do not solve the system";
    }
    const m = p.prompt.match(/^(\d+) pens and (\d+) notebooks cost \$(\d+)\. (\d+) pens? and \2 notebooks cost \$(\d+)\. How many dollars does one (notebook|pen) cost\?$/);
    if (m) {
      const [p1, n, t1, p2, t2] = m.slice(1, 6).map(Number);
      const pen = (t1 - t2) / (p1 - p2);
      const book = (t1 - p1 * pen) / n;
      return expectAnswer(p, m[6] === "pen" ? pen : book);
    }
    return systemCheck(p);
  },
  "systems-word-problems": (p) => {
    let m;
    if ((m = p.prompt.match(/^A coffee shop mixes beans that cost \$(\d+) a pound with beans that cost \$(\d+) a pound\. It makes (\d+) pounds of a blend worth \$([\d.]+) a pound\. How many pounds of the \$\1 beans go in\?$/))) {
      const [cheap, dear, pounds, price] = m.slice(1, 5).map(Number);
      const a = (pounds * (dear - price)) / (dear - cheap);
      return Number.isInteger(Math.round(a * 1e6) / 1e6) ? expectAnswer(p, a) : "the pounds do not come out whole";
    }
    if ((m = p.prompt.match(/^A boat travels (\d+) miles downstream in (\d+) hours? and the same \1 miles back upstream in (\d+) hours\. What is the speed of the (current|boat in still water), in miles per hour\?$/))) {
      const [d, t1, t2] = m.slice(1, 4).map(Number);
      const [down, up] = [d / t1, d / t2];
      return expectAnswer(p, m[4] === "current" ? (down - up) / 2 : (down + up) / 2);
    }
    if ((m = p.prompt.match(/^Tickets cost \$(\d+) \(adult\) and \$(\d+) \(child\)\. (\d+) tickets sold for \$(\d+)\. How many adult/))) {
      const [a, c, n, total] = m.slice(1, 5).map(Number);
      const adults = (total - c * n) / (a - c);
      if (adults % 1 || adults < 0 || adults > n) return "no whole answer";
      return expectAnswer(p, adults);
    }
    if ((m = p.prompt.match(/^A player made (\d+) baskets, all 2-pointers and 3-pointers, for (\d+) points\. How many 3-pointers\?$/))) {
      const [n, pts] = [+m[1], +m[2]];
      const threes = pts - 2 * n;
      if (threes < 0 || threes > n) return "no whole answer";
      return expectAnswer(p, threes);
    }
    if ((m = p.prompt.match(/^You have (\d+) coins, all quarters and dimes, worth \$([\d.]+)\. How many quarters\?$/))) {
      const [n, cents] = [+m[1], Math.round(+m[2] * 100)];
      const q = (cents - 10 * n) / 15;
      if (q % 1 || q < 0 || q > n) return "no whole answer";
      return expectAnswer(p, q);
    }
    return "unread";
  },
  "graphing-inequalities": (p) => {
    let m;
    const test = (op: string, a: number, b: number) => (op === "<" ? a < b : op === ">" ? a > b : op === "≤" ? a <= b : a >= b);
    if ((m = p.prompt.match(/^How do you graph y (<|>|≤|≥) (.*)\?$/))) {
      const want = `${m[1] === "<" || m[1] === ">" ? "Dashed" : "Solid"} line, shade ${m[1] === ">" || m[1] === "≥" ? "above" : "below"}`;
      return onlyRight(p, (c) => c === want);
    }
    if ((m = p.prompt.match(/^Which point is a solution of y (<|>|≤|≥) (.*)\?$/))) {
      const [op, e] = [m[1], m[2]];
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && test(op, q.y, evaluate(e, { x: q.x }));
      });
    }
    if ((m = p.prompt.match(/^Which inequality is (.*) (<|>|≤|≥) (-?\d+) solved for y\?$/))) {
      const [left, op, C] = [m[1], m[2], +m[3]];
      return onlyRight(p, (c) => {
        const f = c.match(/^y (<|>|≤|≥) (.*)$/);
        if (!f) return false;
        for (let x = -6; x <= 6; x += 1.5)
          for (let y = -9; y <= 9; y += 0.75) if (test(op, evaluate(left, { x, y }), C) !== test(f[1], y, evaluate(f[2], { x }))) return false;
        return true;
      });
    }
    if ((m = p.prompt.match(/^\w+ can spend at most \$(\d+) on snacks\. Chips cost \$(\d+) a bag and drinks cost \$(\d+) each\. Which inequality shows/))) {
      const [budget, chip, drink] = m.slice(1, 4).map(Number);
      return onlyRight(p, (c) => {
        const f = c.match(/^(\d+)x \+ (\d+)y (≤|<|≥|>) (\d+)$/);
        return !!f && +f[1] === chip && +f[2] === drink && f[3] === "≤" && +f[4] === budget;
      });
    }
    if ((m = p.prompt.match(/^\w+ can spend at most \$(\d+) on snacks\. Chips cost \$(\d+) a bag and drinks cost \$(\d+) each\. \w+ buys (\d+) bags of chips\. What is the greatest number of drinks/))) {
      const [budget, chip, drink, bags] = m.slice(1, 5).map(Number);
      return expectAnswer(p, Math.floor((budget - chip * bags) / drink));
    }
    if ((m = p.prompt.match(/^y (<|>|≤|≥) .*: solid or dashed boundary line\?$/))) return onlyRight(p, (c) => c === (m[1] === "<" || m[1] === ">" ? "Dashed" : "Solid"));
    if ((m = p.prompt.match(/^To graph y (<|>|≤|≥) .*, which side of the line do you shade\?$/))) return onlyRight(p, (c) => c === (m[1] === ">" || m[1] === "≥" ? "Above the line" : "Below the line"));
    return "unread";
  },
  "compound-inequalities": (p) => {
    let m;
    const pick = (holds: (x: number) => boolean) =>
      onlyRight(p, (c) => {
        const f = setOf(c);
        return !!f && sameSet(f, holds);
      });
    if ((m = p.prompt.match(/^Solve: (-?\d+) (<|≤) (.*) (<|≤) (-?\d+)$/))) {
      const [lo, o1, e, o2, hi] = [+m[1], m[2], m[3], m[4], +m[5]];
      return pick((x) => {
        const v = evaluate(e, { x });
        return (o1 === "<" ? lo < v : lo <= v) && (o2 === "<" ? v < hi : v <= hi);
      });
    }
    if ((m = p.prompt.match(/^To earn a B, the average of three test scores must be at least (\d+) and less than (\d+)\. You scored (\d+) and (\d+) on the first two tests\. Which scores x on the third test earn a B\?$/))) {
      const [lo, hi, s1, s2] = m.slice(1, 5).map(Number);
      const holds = (x: number) => lo <= (s1 + s2 + x) / 3 && (s1 + s2 + x) / 3 < hi;
      // Scores run past the usual -40..40 sweep, so sweep 0..300.
      return onlyRight(p, (c) => {
        const f = setOf(c);
        if (!f) return false;
        for (let x = 0; x <= 300; x += 0.25) if (f(x) !== holds(x)) return false;
        return true;
      });
    }
    if ((m = p.prompt.match(/^Solve: (.*) < (-?\d+) OR (.*) > (-?\d+)$/))) {
      const [e1, a, e2, b] = [m[1], +m[2], m[3], +m[4]];
      return pick((x) => evaluate(e1, { x }) < a || evaluate(e2, { x }) > b);
    }
    if ((m = p.prompt.match(/^Which compound inequality matches: x is between (-?\d+) and (-?\d+), inclusive\?$/))) {
      const [lo, hi] = [+m[1], +m[2]];
      return pick((x) => x >= lo && x <= hi);
    }
    return "unread";
  },
  "systems-inequalities": (p) => {
    let n;
    if ((n = p.prompt.match(/^Which point satisfies x \+ y < (\d+) AND y ≥ (.*)\?$/))) {
      const [s, e] = [+n[1], n[2]];
      return onlyRight(p, (c) => {
        const q = point(c);
        return !!q && q.x + q.y < s && q.y >= evaluate(e, { x: q.x });
      });
    }
    if ((n = p.prompt.match(/^A club sells cookies for \$(\d+) and brownies for \$(\d+)\. It wants to raise at least \$(\d+) and can bake at most (\d+) treats\. Which plan works\?$/))) {
      const [cookie, brownie, goal, most] = n.slice(1, 5).map(Number);
      return onlyRight(p, (c) => {
        const f = c.match(/^(\d+) cookies and (\d+) brownies$/);
        return !!f && +f[1] + +f[2] <= most && cookie * +f[1] + brownie * +f[2] >= goal;
      });
    }
    const m = p.prompt.match(/^Which point satisfies y ≤ (.*) AND y > (-?\d+)\?$/);
    if (!m) return "unread";
    return onlyRight(p, (c) => {
      const q = point(c);
      return !!q && q.y <= evaluate(m[1], { x: q.x }) && q.y > +m[2];
    });
  },
  "function-notation": (p) => {
    let n;
    if ((n = p.prompt.match(/^If h\(x\) = (.*), find h\((-?\d+)\)\.$/))) return expectAnswer(p, evaluate(n[1], { x: +n[2] }));
    if ((n = p.prompt.match(/^If f\(x\) = (.*), find f\((-?\d+)\) \+ f\((-?\d+)\)\.$/))) return expectAnswer(p, evaluate(n[1], { x: +n[2] }) + evaluate(n[1], { x: +n[3] }));
    if ((n = p.prompt.match(/^If f\(x\) = (.*), for what value of x is f\(x\) = (-?\d+)\?$/))) return expectAnswer(p, solveLinear(n[1], n[2]));
    if ((n = p.prompt.match(/^Concert tickets cost \$(\d+) each, plus a \$(\d+) fee for the whole order, so C\(n\) = \1n \+ \2\. For how many tickets is C\(n\) = (\d+)\?$/))) {
      const tickets = (+n[3] - +n[2]) / +n[1];
      return Number.isInteger(tickets) ? expectAnswer(p, tickets) : "no whole number of tickets";
    }
    const m = p.prompt.match(/^If ([fg])\(x\) = (.*), find [fg]\((-?\d+)\)\.$/);
    if (!m) return "unread";
    return expectAnswer(p, evaluate(m[2], { x: +m[3] }));
  },
  "domain-range": (p) => {
    let m;
    if ((m = p.prompt.match(/^f\(x\) = (.*) for (-?\d+) ≤ x ≤ (-?\d+)\. What is the range\?$/))) {
      const [e, lo, hi] = [m[1], +m[2], +m[3]];
      const ys = [evaluate(e, { x: lo }), evaluate(e, { x: hi })];
      return onlyRight(p, (c) => c === `${Math.min(...ys)} ≤ y ≤ ${Math.max(...ys)}`);
    }
    if ((m = p.prompt.match(/^f\(x\) = (.*) has the domain \{-2, -1, 0, 1, 2\}\. What is its range\?$/))) {
      const e = m[1];
      const want = Array.from(new Set([-2, -1, 0, 1, 2].map((x) => evaluate(e, { x })))).sort((a, b) => a - b);
      return onlyRight(p, (c) => c === `{${want.join(", ")}}`);
    }
    if ((m = p.prompt.match(/^A phone's battery starts at 100% and drops (\d+)% each hour, so B\(t\) = 100 − \1t\. The model makes sense until the battery is empty\. What is the greatest t in its domain, in hours\?( Write it as a decimal\.)?$/))) {
      const t = 100 / +m[1];
      if (!Number.isInteger(t) && !m[2]) return "a decimal answer with no instruction";
      return expectAnswer(p, t);
    }
    if ((m = p.prompt.match(/^What is the domain of f\(x\) = 1\/\(x (−|\+) (\d+)\)\?$/))) {
      const bad = m[1] === "−" ? +m[2] : -m[2];
      return onlyRight(p, (c) => c === `All real numbers except ${bad}`);
    }
    if ((m = p.prompt.match(/^What is the domain of f\(x\) = √\(x − (\d+)\)\?$/))) return onlyRight(p, (c) => c === `x ≥ ${m[1]}`);
    if ((m = p.prompt.match(/^What is the domain of f\(x\) = 1\/\(\(x − (\d+)\)\(x − (\d+)\)\)\?$/))) return onlyRight(p, (c) => c === `All real numbers except ${m[1]} and ${m[2]}`);
    return "unread";
  },
  "function-graphs": (p) => {
    let n;
    if ((n = p.prompt.match(/^f\(x\) = (.*)\. What is the average rate of change of f from x = (-?\d+) to x = (-?\d+)\?$/))) {
      const [e, a, b] = [n[1], +n[2], +n[3]];
      return expectAnswer(p, (evaluate(e, { x: b }) - evaluate(e, { x: a })) / (b - a));
    }
    if ((n = p.prompt.match(/^A ball's height is h\(t\) = (.*) feet after t seconds\. What is its average rate of change from t = (\d+) to t = (\d+), in feet per second\?$/))) {
      const [e, a, b] = [n[1], +n[2], +n[3]];
      return expectAnswer(p, (evaluate(e, { t: b }) - evaluate(e, { t: a })) / (b - a));
    }
    if ((n = p.prompt.match(/^Which function has the greater average rate of change from x = (-?\d+) to x = (-?\d+): f\(x\) = (.*) or g\(x\) = x²\?$/))) {
      const [a, b, e] = [+n[1], +n[2], n[3]];
      const rf = (evaluate(e, { x: b }) - evaluate(e, { x: a })) / (b - a);
      const rg = (b * b - a * a) / (b - a);
      const want = close(rf, rg) ? "They are equal" : rf > rg ? "f" : "g";
      return onlyRight(p, (c) => c === want);
    }
    const m = p.prompt.match(/passes through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)\. What is its average rate of change/);
    if (!m) return "unread";
    const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
    return onlyRight(p, (c) => close(val(c), (y2 - y1) / (x2 - x1)));
  },
  "arithmetic-sequences": (p) => {
    let m;
    const subNum = (t: string) => +[...t].map((ch) => "₀₁₂₃₄₅₆₇₈₉".indexOf(ch)).join("");
    if ((m = p.prompt.match(/^An arithmetic sequence has a₁ = (-?\d+) and d = (-?\d+)\. What is a([₀-₉]+)\?$/))) return expectAnswer(p, +m[1] + (subNum(m[3]) - 1) * +m[2]);
    if ((m = p.prompt.match(/^In an arithmetic sequence, the (\d+)(?:st|nd|rd|th) term is (-?\d+) and the (\d+)(?:st|nd|rd|th) term is (-?\d+)\. What is the (common difference|first term)\?$/))) {
      const [pp, tp, q, tq] = m.slice(1, 5).map(Number);
      const d = (tq - tp) / (q - pp);
      return expectAnswer(p, m[5] === "common difference" ? d : tp - (pp - 1) * d);
    }
    if ((m = p.prompt.match(/^Which term of (-?\d+), (-?\d+), (-?\d+), (-?\d+), \.\.\. is (-?\d+)\? Type its position n\.$/))) {
      const [a, b, , , t] = m.slice(1, 6).map(Number);
      const n = (t - a) / (b - a) + 1;
      return Number.isInteger(n) && n > 0 ? expectAnswer(p, n) : "that number is not in the sequence";
    }
    if ((m = p.prompt.match(/^Row 1 of a theater has (\d+) seats, and each row has (\d+) more seats than the row in front of it\. How many seats are in row (\d+)\?$/))) return expectAnswer(p, +m[1] + (+m[3] - 1) * +m[2]);
    if ((m = p.prompt.match(/^Sequence: (-?\d+), (-?\d+), (-?\d+), (-?\d+), \.\.\. What is the (\d+)(st|nd|rd|th) term\?$/))) {
      const [a, b, c, d, n] = m.slice(1, 6).map(Number);
      if (b - a !== c - b || c - b !== d - c) return "not arithmetic";
      if (["st", "nd", "rd"][n % 10 - 1] && !(n % 100 >= 11 && n % 100 <= 13) ? m[6] !== ["st", "nd", "rd"][n % 10 - 1] : m[6] !== "th") return "wrong ordinal";
      return expectAnswer(p, a + (n - 1) * (b - a));
    }
    if ((m = p.prompt.match(/^What is the common difference in (-?\d+), (-?\d+), (-?\d+), (-?\d+), \.\.\.\?$/))) return expectAnswer(p, +m[2] - +m[1]);
    return "unread";
  },
  "geometric-sequences": (p) => {
    let m;
    if ((m = p.prompt.match(/^Sequence: (-?\d+), (-?\d+), (-?\d+), (-?\d+), \.\.\. What is the (\d+)(?:st|nd|rd|th) term\?$/))) {
      const t = m.slice(1, 5).map(Number);
      const r = t[1] / t[0];
      if (!t.every((v, k) => k === 0 || close(v / t[k - 1], r))) return "not geometric";
      return expectAnswer(p, t[0] * r ** (+m[5] - 1));
    }
    if ((m = p.prompt.match(/^A geometric sequence has a₁ = (\d+) and r = (\d+)\. Which term is ([\d,]+)\? Type its position n\.$/))) {
      const [a, r, t] = [+m[1], +m[2], +m[3].replace(/,/g, "")];
      const n = Math.round(Math.log(t / a) / Math.log(r)) + 1;
      return close(a * r ** (n - 1), t) ? expectAnswer(p, n) : "that number is not in the sequence";
    }
    if ((m = p.prompt.match(/^A ball is dropped from (\d+) feet\. Each bounce reaches (\d+)\/(\d+) of the height before it\. How high, in feet, does it go on bounce (\d+)\?$/))) return expectAnswer(p, +m[1] * (+m[2] / +m[3]) ** +m[4]);
    if ((m = p.prompt.match(/^Sequence: ([\d, ]+?),? \.\.\. What is the common ratio\?/))) {
      const t = m[1].split(",").map((s) => +s.trim());
      const r = t[1] / t[0];
      if (!t.every((v, i) => i === 0 || close(v / t[i - 1], r))) return "not geometric";
      return expectAnswer(p, r);
    }
    if ((m = p.prompt.match(/^What is the (\d+)th term of ([\d, ]+), \.\.\.\?$/))) {
      const n = +m[1];
      const t = m[2].split(",").map((s) => +s.trim());
      const r = t[1] / t[0];
      if (n <= t.length) return "the term asked for is already shown";
      return expectAnswer(p, t[0] * r ** (n - 1));
    }
    return "unread";
  },
  "exponent-rules": (p) => {
    let m;
    if (p.type === "multiple-choice" && (m = p.prompt.match(/^Simplify: (.*[xy].*)$/)) && !/\^0/.test(m[1])) {
      const e = m[1].replace(/·/g, "*");
      const pts = [{ x: 1.3, y: 0.7 }, { x: 2, y: 1.5 }, { x: 0.6, y: 2.2 }];
      return onlyRight(p, (c) => pts.every((env) => close(evaluate(c, env), evaluate(e, env))));
    }
    if ((m = p.prompt.match(/^Simplify \((\d+)\^(\d+) × \1\^(\d+)\) ÷ \1\^(\d+), then write the answer as a number\.$/))) return expectAnswer(p, (+m[1]) ** (+m[2] + +m[3] - +m[4]));
    if ((m = p.prompt.match(/^\(x\^(\d+)\)\^(\d+) ÷ x\^(\d+) = x\^n\. What is n\?$/))) return expectAnswer(p, +m[1] * +m[2] - +m[3]);
    if ((m = p.prompt.match(/^Simplify (\d+)x\^0 \+ \(\1x\)\^0, for any x other than 0\.$/))) return expectAnswer(p, +m[1] + 1);
    if ((m = p.prompt.match(/^(\d+)\^(\d+) × \1\^(\d+) = \1\^n\. What is n\?$/))) return expectAnswer(p, +m[2] + +m[3]);
    if ((m = p.prompt.match(/^(\d+)\^(\d+) ÷ \1\^(\d+) = \1\^n\. What is n\?$/))) return expectAnswer(p, +m[2] - +m[3]);
    if ((m = p.prompt.match(/^Simplify: \(x\^(\d+)\)\^(\d+)$/))) return onlyRight(p, (c) => c === `x^${+m[1] * +m[2]}`);
    if ((m = p.prompt.match(/^Simplify: \(?(\d+)x?\)?\^0/))) return expectAnswer(p, 1);
    if ((m = p.prompt.match(/^Simplify (\d+)\^(\d+) × \1\^(\d+), then write the answer as a number\.$/))) return expectAnswer(p, (+m[1]) ** (+m[2] + +m[3]));
    return "unread";
  },
  "negative-fractional-exponents": (p) => {
    let m;
    if ((m = p.prompt.match(/^Evaluate \(1\/(\d+)\)\^\(-(\d+)\)\.$/))) return expectAnswer(p, (+m[1]) ** +m[2]);
    if ((m = p.prompt.match(/^x\^\((\d+)\/(\d+)\) · x\^\((\d+)\/\2\) = x\^n\. What is n\?$/))) return expectAnswer(p, (+m[1] + +m[3]) / +m[2]);
    if ((m = p.prompt.match(/^Evaluate (\d+)\^\((-?\d+(?:\/\d+)?)\)\./))) return expectAnswer(p, (+m[1]) ** val(m[2]));
    if ((m = p.prompt.match(/^Rewrite (√x|³√x|⁴√x|⁵√x) using a fractional exponent\.$/))) {
      const n = { "√x": 2, "³√x": 3, "⁴√x": 4, "⁵√x": 5 }[m[1]]!;
      return onlyRight(p, (c) => c === `x^(1/${n})`);
    }
    if ((m = p.prompt.match(/^Rewrite x\^\(1\/(\d)\) as a root\.$/))) {
      const want = { 2: "√x", 3: "³√x", 4: "⁴√x", 5: "⁵√x" }[+m[1] as 2 | 3 | 4 | 5];
      return onlyRight(p, (c) => c === want);
    }
    return "unread";
  },
  "scientific-notation": (p) => {
    let m;
    const sci = (c: string) => {
      const f = c.replace(/[−–]/g, "-").match(/^([\d.]+) × 10\^(-?\d+)$/);
      return f ? { coeff: +f[1], value: +f[1] * 10 ** +f[2] } : null;
    };
    if ((m = p.prompt.match(/^Write ([\d,.]+) in scientific notation\.$/))) {
      const n = +m[1].replace(/,/g, "");
      return onlyRight(p, (c) => {
        const s = sci(c);
        return !!s && s.coeff >= 1 && s.coeff < 10 && close(s.value, n);
      });
    }
    if ((m = p.prompt.match(/^Write ([\d.]+) × 10\^(\d+) as a regular number\.$/))) return expectAnswer(p, Math.round(+m[1] * 10 ** +m[2]));
    const proper = (value: number) =>
      onlyRight(p, (c) => {
        const s = sci(c);
        return !!s && s.coeff >= 1 && s.coeff < 10 && close(s.value, value);
      });
    if ((m = p.prompt.match(/^Multiply: \(([\d.]+) × 10\^(-?\d+)\)\(([\d.]+) × 10\^(-?\d+)\)\. Write the answer in scientific notation\.$/))) return proper(+m[1] * 10 ** +m[2] * +m[3] * 10 ** +m[4]);
    if ((m = p.prompt.match(/^Divide: \(([\d.]+) × 10\^(-?\d+)\) ÷ \(([\d.]+) × 10\^(-?\d+)\)\. Write the answer in scientific notation\.$/))) return proper((+m[1] * 10 ** +m[2]) / (+m[3] * 10 ** +m[4]));
    if ((m = p.prompt.match(/^Light travels about ([\d.]+) × 10\^(\d+) meters per second\. How far does it travel in ([\d,]+) seconds\?$/))) return proper(+m[1] * 10 ** +m[2] * +m[3].replace(/,/g, ""));
    return "unread";
  },
  "simplifying-radicals": (p) => {
    let m;
    const byValue = (want: number, env: Record<string, number> = {}) => onlyRight(p, (c) => close(evaluate(c, env), want));
    if ((m = p.prompt.match(/^Simplify (\d+)√(\d+)$/))) return byValue(+m[1] * Math.sqrt(+m[2]));
    if ((m = p.prompt.match(/^Simplify √(\d+) \+ √(\d+)$/))) return byValue(Math.sqrt(+m[1]) + Math.sqrt(+m[2]));
    if ((m = p.prompt.match(/^Simplify √(\d+) · √(\d+)$/))) return byValue(Math.sqrt(+m[1] * +m[2]));
    if ((m = p.prompt.match(/^Simplify √\((\d+)x²\), for x > 0$/))) {
      const n = +m[1];
      return onlyRight(p, (c) => [2, 3.5].every((x) => close(evaluate(c, { x }), Math.sqrt(n * x * x))));
    }
    if ((m = p.prompt.match(/^A square has an area of (\d+) square inches\. How long is each side, in inches\? Give it in simplest radical form\.$/))) return byValue(Math.sqrt(+m[1]));
    if ((m = p.prompt.match(/^Write √(\d+) in simplest radical form\.$/))) {
      const n = +m[1];
      return onlyRight(p, (c) => close(evaluate(c), Math.sqrt(n)));
    }
    if ((m = p.prompt.match(/^Simplify √(\d+)$/))) return expectAnswer(p, Math.sqrt(+m[1]));
    return "unread";
  },
  "exponential-functions": (p) => {
    let m;
    if ((m = p.prompt.match(/^Which exponential function passes through \(0, (\d+)\) and \(1, (\d+)\)\?$/))) {
      const [y0, y1] = [+m[1], +m[2]];
      return onlyRight(p, (c) => {
        const f = (x: number) => evaluate(c.replace(/^y = /, ""), { x });
        return close(f(0), y0) && close(f(1), y1);
      });
    }
    if ((m = p.prompt.match(/^For y = (\d+)\((\d+)\)\^x, what value of x gives y = ([\d,]+)\?$/))) {
      const [a, b, y] = [+m[1], +m[2], +m[3].replace(/,/g, "")];
      const x = Math.round(Math.log(y / a) / Math.log(b));
      return close(a * b ** x, y) ? expectAnswer(p, x) : "no whole x gives that y";
    }
    if ((m = p.prompt.match(/^f\(x\) = (\d+)\((\d+)\)\^x\. How many times bigger is f\((\d+)\) than f\((\d+)\)\?$/))) {
      const f = (x: number) => +m![1] * (+m![2]) ** x;
      return expectAnswer(p, f(+m[3]) / f(+m[4]));
    }
    if ((m = p.prompt.match(/^Which function starts at (\d+) and multiplies by (\d+) each time x goes up by 1\?$/))) {
      const [a, b] = [+m[1], +m[2]];
      return onlyRight(p, (c) => {
        const f = (x: number) => evaluate(c.replace(/^y = /, ""), { x });
        return [0, 1, 2, 3].every((x) => close(f(x), a * b ** x));
      });
    }
    if ((m = p.prompt.match(/^Is y = \d+\(([\d.]+)\)\^x exponential growth or decay\?$/))) return onlyRight(p, (c) => c === (+m[1] > 1 ? "Growth" : "Decay"));
    if ((m = p.prompt.match(/^What is the starting value \(the y-intercept\) of y = (.*)\?$/))) return expectAnswer(p, evaluate(m[1], { x: 0 }));
    if ((m = p.prompt.match(/^Evaluate f\(x\) = (.*) at x = (\d+)\.$/))) return expectAnswer(p, evaluate(m[1], { x: +m[2] }));
    return "unread";
  },
  "exponential-growth": (p) => {
    let n;
    if ((n = p.prompt.match(/^A colony of (\d+) bacteria doubles every (\d+) minutes\. How many bacteria are there after (\d+) hours?\?$/))) {
      const doublings = (+n[3] * 60) / +n[2];
      return Number.isInteger(doublings) ? expectAnswer(p, +n[1] * 2 ** doublings) : "the doublings do not come out whole";
    }
    if ((n = p.prompt.match(/^A town of ([\d,]+) people grows by (\d+)% each year\. About how many people live there after (\d+) years\? \(round to the nearest whole number\)$/))) {
      const [P, r, y] = [BigInt(n[1].replace(/,/g, "")), BigInt(n[2]), Number(n[3])];
      let v = P;
      for (let k = 0; k < y; k++) v = v * (100n + r);
      const den = 100n ** BigInt(y);
      const people = (v * 2n + den) / (2n * den);
      return Number(p.answer) === Number(people) ? null : `key ${p.answer}, should be ${people}`;
    }
    if ((n = p.prompt.match(/^\$(\d+) is invested at (\d+)% annual interest compounded annually\. How much interest does it earn in (\d+) years\?/))) {
      const [P, r, y] = [BigInt(n[1]), BigInt(n[2]), Number(n[3])];
      let v = P * 100n;
      for (let k = 0; k < y; k++) v = v * (100n + r);
      const den = 100n ** BigInt(y);
      const cents = (v * 2n + den) / (2n * den) - P * 100n;
      return close(Number(p.answer), Number(cents) / 100) ? null : `key ${p.answer}, should be ${Number(cents) / 100}`;
    }
    const m = p.prompt.match(/^\$(\d+) invested at (\d+)% annual interest compounded annually\. Value after (\d+) years\?/);
    if (!m) return "unread";
    const [P, r, y] = [BigInt(m[1]), BigInt(m[2]), Number(m[3])];
    // Exact, in hundred-thousandths of a cent, then half up.
    let v = P * 100n;
    for (let i = 0; i < y; i++) v = v * (100n + r);
    const den = 100n ** BigInt(y);
    const cents = (v * 2n + den) / (2n * den);
    return close(Number(p.answer), Number(cents) / 100) ? null : `key ${p.answer}, should be ${Number(cents) / 100}`;
  },
  "exponential-decay": (p) => {
    let n;
    if ((n = p.prompt.match(/^A (\d+) mg dose of medicine is half gone every (\d+) hours\. How many mg are left after (\d+) hours\?( Write your answer as a decimal\.)?$/))) {
      const left = +n[1] / 2 ** (+n[3] / +n[2]);
      if (!Number.isInteger(left) && !n[4]) return "a decimal answer with no instruction";
      return expectAnswer(p, left);
    }
    if ((n = p.prompt.match(/^A phone worth \$([\d,]+) loses (\d+)% of its value each year\. How much value has it lost after (\d+) years\? \(round to the nearest whole dollar\)$/))) {
      const [V, r, y] = [BigInt(n[1].replace(/,/g, "")), BigInt(n[2]), Number(n[3])];
      let kept = V;
      for (let k = 0; k < y; k++) kept = kept * (100n - r);
      const den = 100n ** BigInt(y);
      const lostNum = V * den - kept;
      const lost = (lostNum * 2n + den) / (2n * den);
      return Number(p.answer) === Number(lost) ? null : `key ${p.answer}, should be ${lost}`;
    }
    if ((n = p.prompt.match(/^A car that cost \$([\d,]+) loses (\d+)% of its value each year\. After how many full years is it first worth less than half of what it cost\?$/))) {
      const keep = 100n - BigInt(n[2]);
      let years = 0;
      let num = 1n;
      let den = 1n;
      while (2n * num >= den) {
        years++;
        num *= keep;
        den *= 100n;
      }
      return expectAnswer(p, years);
    }
    const m = p.prompt.replace(/,/g, "").match(/^A car worth \$(\d+) loses (\d+)% of its value each year\. What is it worth after (\d+) years?\?/);
    if (!m) return "unread";
    const [V, r, y] = [BigInt(m[1]), BigInt(m[2]), Number(m[3])];
    let v = V;
    for (let i = 0; i < y; i++) v = v * (100n - r);
    const den = 100n ** BigInt(y);
    const dollars = (v * 2n + den) / (2n * den);
    if ((y === 1) !== / year\?/.test(p.prompt)) return "year/years does not match the count";
    return Number(p.answer) === Number(dollars) ? null : `key ${p.answer}, should be ${dollars}`;
  },
  "multiplying-binomials": (p) => {
    let m;
    if ((m = p.prompt.match(/^When (.*) is multiplied out, what is the coefficient of x\?$/))) {
      const [, b] = quadCoeffs(m[1]);
      return expectAnswer(p, b);
    }
    if ((m = p.prompt.match(/^A garden is (\(.*\)) feet long and (\(.*\)) feet wide\. Which expression gives its area, in square feet\?$/))) {
      const area = `${m[1]}${m[2]}`;
      return onlyRight(p, (c) => samePoly(c, area));
    }
    return expandCheck(p);
  },
  "special-products": (p) => {
    let m;
    if ((m = p.prompt.match(/^Use \(a − b\)\(a \+ b\) = a² − b² to work out (\d+) × (\d+) without a calculator\.$/))) return expectAnswer(p, +m[1] * +m[2]);
    if ((m = p.prompt.match(/^Use \(a [+−] b\)² = a² [+−] 2ab \+ b² to work out (\d+)² without a calculator\.$/))) return expectAnswer(p, +m[1] * +m[1]);
    return expandCheck(p);
  },
  "factoring-trinomials": (p) => {
    const m = p.prompt.match(/^A rectangle has area (.*) and width (\(x [+−] \d+\))\. Which expression is its length\?$/);
    if (m) return onlyRight(p, (c) => samePoly(`${m[2]}${c}`, m[1]));
    return factorCheck(p);
  },
  "factoring-special": (p) => factorCheck(p),
  "graphing-parabolas": (p) => {
    let m;
    if ((m = p.prompt.match(/^What is the vertex of y = (.*)\?$/))) {
      const [a, b, c] = quadCoeffs(m[1]);
      const h = -b / (2 * a);
      return onlyRight(p, (ch) => {
        const q = point(ch);
        return !!q && close(q.x, h) && close(q.y, a * h * h + b * h + c);
      });
    }
    if ((m = p.prompt.match(/^The parabola y = (.*) crosses the x-axis twice\. What is the (larger|smaller) x-intercept\?$/))) {
      const roots: number[] = [];
      for (let x = -60; x <= 60; x++) if (close(evaluate(m[1], { x }), 0)) roots.push(x);
      if (roots.length !== 2) return `${roots.length} whole x-intercepts`;
      return expectAnswer(p, m[2] === "larger" ? Math.max(...roots) : Math.min(...roots));
    }
    if ((m = p.prompt.match(/^A ball's height is h = (.*) feet after t seconds\. What is its greatest height, in feet\?$/))) {
      const [a, b, c] = quadCoeffs(m[1].replace(/t/g, "x"));
      const t = -b / (2 * a);
      return expectAnswer(p, a * t * t + b * t + c);
    }
    if ((m = p.prompt.match(/^Does y = (.*) open up or down\?$/))) {
      const [a] = quadCoeffs(m[1]);
      return onlyRight(p, (c) => c === (a > 0 ? "Up" : "Down"));
    }
    if ((m = p.prompt.match(/^What is the (x|y)-coordinate of the vertex of y = (.*)\?$/))) {
      const [a, b, c] = quadCoeffs(m[2]);
      const h = -b / (2 * a);
      return expectAnswer(p, m[1] === "x" ? h : a * h * h + b * h + c);
    }
    if ((m = p.prompt.match(/^The axis of symmetry of y = (.*) is the line x = k\. What is k\?$/))) {
      const [a, b] = quadCoeffs(m[1]);
      return expectAnswer(p, -b / (2 * a));
    }
    return "unread";
  },
  "solving-by-factoring": (p) => {
    let m;
    if ((m = p.prompt.match(/^Solve (.*) = (-?\d+x?)\. What is the (positive|nonzero) root\?$/))) {
      const [l, r] = [m[1], m[2]];
      const roots: number[] = [];
      for (let x = -60; x <= 60; x++) if (close(evaluate(l, { x }), evaluate(r, { x }))) roots.push(x);
      const want = m[3] === "positive" ? roots.filter((x) => x > 0) : roots.filter((x) => x !== 0);
      if (want.length !== 1) return `${want.length} ${m[3]} roots`;
      return expectAnswer(p, want[0]);
    }
    if ((m = p.prompt.match(/^Solve (.*) = 0\. One root is a fraction\. What is that root\? Give it as a fraction\.$/))) {
      const [a, b, c] = quadCoeffs(m[1]);
      const d = Math.sqrt(b * b - 4 * a * c);
      const roots = [(-b + d) / (2 * a), (-b - d) / (2 * a)];
      const fracs = roots.filter((x) => !close(x, Math.round(x)));
      if (fracs.length !== 1) return `${fracs.length} fraction roots`;
      return expectAnswer(p, fracs[0]);
    }
    if ((m = p.prompt.match(/^A rectangle's length is (\d+) meters more than its width\. Its area is (\d+) square meters\. What is its width, in meters\?$/))) {
      const [d, area] = [+m[1], +m[2]];
      const w = (-d + Math.sqrt(d * d + 4 * area)) / 2;
      return Number.isInteger(w) ? expectAnswer(p, w) : "the width is not whole";
    }
    return rootCheck(p);
  },
  "completing-square": (p) => {
    let n;
    if ((n = p.prompt.match(/^Solve (.*) = 0 by completing the square\. What is the (larger|smaller) root\?$/))) {
      const roots: number[] = [];
      for (let x = -60; x <= 60; x++) if (close(evaluate(n[1], { x }), 0)) roots.push(x);
      if (roots.length !== 2) return `${roots.length} whole roots`;
      return expectAnswer(p, n[2] === "larger" ? Math.max(...roots) : Math.min(...roots));
    }
    if ((n = p.prompt.match(/^Write (.*) in the form \(x − h\)² \+ k\. What is k\?$/)) || (n = p.prompt.match(/^What is the minimum value of y = (.*)\?$/))) {
      const [a, b, c] = quadCoeffs(n[1]);
      if (a <= 0) return "no minimum";
      const h = -b / (2 * a);
      return expectAnswer(p, a * h * h + b * h + c);
    }
    if ((n = p.prompt.match(/^Which is (.*) written in vertex form\?$/))) {
      const target = n[1];
      return onlyRight(p, (c) => /^\(x [+−] \d+\)²( [+−] \d+)?$/.test(c) && samePoly(c, target));
    }
    const m = p.prompt.match(/^Complete the square: x² (\+|−) (\d+)x \+ ___ = \(x (\+|−) (\d+)\)²$/);
    if (!m) return "unread";
    if (+m[4] * 2 !== +m[2] || m[1] !== m[3]) return "the square shown does not match";
    return onlyRight(p, (c) => close(val(c), (+m[2] / 2) ** 2));
  },
  "quadratic-formula": (p) => {
    let n;
    if ((n = p.prompt.match(/^Solve (.*) = 0 with the quadratic formula\. What is the (larger|smaller) root\? \(round to the hundredths place\)$/))) {
      const [a, b, c] = quadCoeffs(n[1]);
      const d = Math.sqrt(b * b - 4 * a * c);
      const roots = [(-b + d) / (2 * a), (-b - d) / (2 * a)];
      return expectAnswer(p, n[2] === "larger" ? Math.max(...roots) : Math.min(...roots));
    }
    if ((n = p.prompt.match(/^What is the discriminant of (.*) = 0\?$/))) {
      const [a, b, c] = quadCoeffs(n[1]);
      return expectAnswer(p, b * b - 4 * a * c);
    }
    if ((n = p.prompt.match(/^A ball is thrown upward from (\d+) feet with a speed of (\d+) feet per second, so its height is h = (.*)\. After how many seconds does it hit the ground\? \(round to the hundredths place\)$/))) {
      const [a, b, c] = quadCoeffs(n[3].replace(/t/g, "x"));
      if (c !== +n[1] || b !== +n[2]) return "the equation does not match the story";
      const d = Math.sqrt(b * b - 4 * a * c);
      return expectAnswer(p, Math.max((-b + d) / (2 * a), (-b - d) / (2 * a)));
    }
    const m = p.prompt.match(/^For (.*) = 0, how many real solutions\?$/);
    if (m) {
      const [a, b, c] = quadCoeffs(m[1]);
      const d = b * b - 4 * a * c;
      return onlyRight(p, (ch) => ch === (d > 0 ? "2" : d === 0 ? "1" : "0"));
    }
    return rootCheck(p);
  },
  "absolute-value": (p) => {
    let m;
    const absRoots = (inside: string, target: number) => {
      const out: number[] = [];
      for (let x = -60; x <= 60; x += 0.25) if (close(Math.abs(evaluate(inside, { x })), target)) out.push(x);
      return out;
    };
    if ((m = p.prompt.match(/^Solve (-?\d+)\|(.*)\| ([+−]) (\d+) = (-?\d+)\. What is the (larger|smaller) solution\?$/))) {
      const [k, inside, sign, mm, n] = [+m[1], m[2], m[3], +m[4], +m[5]];
      const A = (n - (sign === "+" ? mm : -mm)) / k;
      const sols = absRoots(inside, A);
      if (sols.length !== 2) return `${sols.length} solutions`;
      return expectAnswer(p, m[6] === "larger" ? Math.max(...sols) : Math.min(...sols));
    }
    if ((m = p.prompt.match(/^Solve \|(.*)\| = (\d+)\. What is the (smaller|larger) solution\? Give it as a whole number or a fraction\.$/))) {
      const sols = [solveLinear(m[1], m[2]), solveLinear(m[1], String(-m[2]))];
      return expectAnswer(p, m[3] === "larger" ? Math.max(...sols) : Math.min(...sols));
    }
    if ((m = p.prompt.match(/^How many solutions does (\d+)\|(.*)\| \+ (\d+) = (-?\d+) have\?$/))) {
      const A = (+m[4] - +m[3]) / +m[1];
      const count = A < 0 ? 0 : A === 0 ? 1 : 2;
      return onlyRight(p, (c) => c === String(count));
    }
    if ((m = p.prompt.match(/^Solve \|(.*)\| = (\d+)\. What is the (positive|negative|larger|smaller) solution\?$/))) {
      const sols: number[] = [];
      for (let x = -60; x <= 60; x++) if (close(Math.abs(evaluate(m[1], { x })), +m[2])) sols.push(x);
      if (sols.length !== 2) return `${sols.length} whole solutions`;
      const want = m[3] === "positive" || m[3] === "larger" ? Math.max(...sols) : Math.min(...sols);
      if (m[3] === "positive" && want <= 0) return "no positive solution";
      if (m[3] === "negative" && want >= 0) return "no negative solution";
      return expectAnswer(p, want);
    }
    if ((m = p.prompt.match(/^How many solutions does \|(.*)\| = (-?\d+) have\?$/))) {
      const rhs = +m[2];
      const count = rhs < 0 ? 0 : rhs === 0 ? 1 : 2;
      return onlyRight(p, (c) => c === String(count));
    }
    return "unread";
  },
  "absolute-value-inequalities": (p) => {
    let n;
    if ((n = p.prompt.match(/^Solve (\d+)\|(.*)\| − (\d+) > (-?\d+)$/))) {
      const [k, e, mm, rhs] = [+n[1], n[2], +n[3], +n[4]];
      const holds = (x: number) => k * Math.abs(evaluate(e, { x })) - mm > rhs;
      return onlyRight(p, (c) => {
        const f = setOf(c);
        return !!f && sameSet(f, holds);
      });
    }
    if ((n = p.prompt.match(/^A machine fills bags with (\d+) grams of rice, give or take (\d+) grams\. Which inequality shows the weights w that pass\?$/))) {
      const [t, tol] = [+n[1], +n[2]];
      return onlyRight(p, (c) => {
        const f = c.match(/^\|w ([+−]) (\d+)\| (≤|≥|<|>) (\d+)$/);
        if (!f) return false;
        const shiftBy = (f[1] === "+" ? -1 : 1) * +f[2];
        const test = (w: number) => {
          const d = Math.abs(w - shiftBy);
          return f[3] === "≤" ? d <= +f[4] : f[3] === "≥" ? d >= +f[4] : f[3] === "<" ? d < +f[4] : d > +f[4];
        };
        for (let w = 0; w <= 2000; w += 0.5) if (test(w) !== (Math.abs(w - t) <= tol)) return false;
        return true;
      });
    }
    const m = p.prompt.match(/^Solve \|(.*)\| (<|>|≤|≥) (\d+)$/);
    if (!m) return "unread";
    const [e, op, a] = [m[1], m[2], +m[3]];
    const holds = (x: number) => {
      const v = Math.abs(evaluate(e, { x }));
      return op === "<" ? v < a : op === ">" ? v > a : op === "≤" ? v <= a : v >= a;
    };
    return onlyRight(p, (c) => {
      const f = setOf(c);
      return !!f && sameSet(f, holds);
    });
  },
  "piecewise-functions": (p) => {
    let n;
    if ((n = p.prompt.match(/^f\(x\) = \{ (.*) if x < (-?\d+); (.*) if \2 ≤ x ≤ (-?\d+); (.*) if x > \4 \}\. Find f\((-?\d+)\)\.$/))) {
      const [p1, lo, p2, hi, p3, x] = [n[1], +n[2], n[3], +n[4], n[5], +n[6]];
      return expectAnswer(p, evaluate(x < lo ? p1 : x <= hi ? p2 : p3, { x }));
    }
    if ((n = p.prompt.match(/^f\(x\) = \{ (.*) if x < (-?\d+); (.*) if x ≥ \2 \}\. Find f\((-?\d+)\) \+ f\((-?\d+)\)\.$/))) {
      const [p1, b, p2] = [n[1], +n[2], n[3]];
      const f = (x: number) => evaluate(x < b ? p1 : p2, { x });
      return expectAnswer(p, f(+n[4]) + f(+n[5]));
    }
    const m = p.prompt.match(/^f\(x\) = \{ (.*) if x < (-?\d+); (.*) if x ≥ \2 \}\. Find f\((-?\d+)\)\.$/);
    if (!m) return "unread";
    const [first, b, second, x] = [m[1], +m[2], m[3], +m[4]];
    return expectAnswer(p, evaluate(x < b ? first : second, { x }));
  },
  "center-spread": (p) => {
    let m;
    const nums = (t: string) => (t.match(/-?\d+/g) ?? []).map(Number);
    const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
    const median = (a: number[]) => {
      const s = sorted(a);
      const n = s.length;
      return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    };
    // Quartiles with the median left out of both halves.
    const quartiles = (a: number[]) => {
      const s = sorted(a);
      return [median(s.slice(0, Math.floor(s.length / 2))), median(s.slice(Math.ceil(s.length / 2)))];
    };
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    if ((m = p.prompt.match(/^Find the median of ([\d, ]+)\.( Write your answer as a decimal\.)?$/))) {
      const v = median(nums(m[1]));
      if (!Number.isInteger(v) && !m[2]) return "a decimal answer with no instruction";
      return expectAnswer(p, v);
    }
    if ((m = p.prompt.match(/^(Four|Five|Six) quiz scores are (.*)\. What is the mean score\?$/))) {
      const v = nums(m[2]);
      if (v.length !== { Four: 4, Five: 5, Six: 6 }[m[1] as "Four"]) return "the count in words does not match the scores";
      return expectAnswer(p, mean(v));
    }
    if ((m = p.prompt.match(/^Find the interquartile range \(IQR\) of ([\d, ]+)\.$/))) {
      const [q1, q3] = quartiles(nums(m[1]));
      return expectAnswer(p, q3 - q1);
    }
    if ((m = p.prompt.match(/^For the data ([\d, ]+), what is the upper fence: Q3 plus 1\.5 times the IQR\? Values above it count as outliers\.( Write your answer as a decimal\.)?$/))) {
      const [q1, q3] = quartiles(nums(m[1]));
      const fence = q3 + 1.5 * (q3 - q1);
      if (!Number.isInteger(fence) && !m[2]) return "a decimal answer with no instruction";
      return expectAnswer(p, fence);
    }
    if ((m = p.prompt.match(/^The data set is ([\d, ]+)\. How much does the mean go down when the outlier, (\d+), is removed\?$/))) {
      const v = nums(m[1]);
      const at = v.indexOf(+m[2]);
      if (at < 0 || +m[2] !== Math.max(...v)) return "the outlier named is not the data's largest value";
      return expectAnswer(p, mean(v) - mean(v.filter((_, k) => k !== at)));
    }
    if ((m = p.prompt.match(/^Four test scores are (.*)\. What score on the fifth test makes the mean exactly (\d+)\?$/))) {
      const v = nums(m[1]);
      return expectAnswer(p, 5 * +m[2] - v.reduce((x, y) => x + y, 0));
    }
    return "unread";
  },
  "trend-lines": (p) => {
    let m;
    const n = (t: string) => +t.replace(/,/g, "");
    if ((m = p.prompt.match(/^A line of fit for .+, x, and .+, y, is y = (.*)\. What does the line predict when x = (-?\d+)\?( Write your answer as a decimal\.)?$/))) {
      const y = evaluate(m[1], { x: +m[2] });
      if (!Number.isInteger(Math.round(y * 1e9) / 1e9) && !m[3]) return "a decimal answer with no instruction";
      return expectAnswer(p, y);
    }
    if ((m = p.prompt.match(/^A line of fit for .+, x, and .+, y, is y = (.*)\. For what value of x does the line predict y = (-?[\d,.]+)\?$/))) return expectAnswer(p, solveLinear(m[1], String(n(m[2]))));
    if ((m = p.prompt.match(/^A line of fit for .+, x, and .+, y, is y = (.*)\. What does the slope, (-?[\d,.]+), mean\?$/))) {
      const slope = lineOf(`y = ${m[1]}`)!.m;
      if (!close(slope, n(m[2]))) return "the slope named is not the line's";
      return onlyRight(p, (c) => {
        const f = c.match(/goes (up|down) about ([\d,.]+) .+ for each extra/);
        return !!f && (f[1] === "up") === slope > 0 && close(n(f[2]), Math.abs(slope));
      });
    }
    if ((m = p.prompt.match(/^A line of fit for .+, x, and .+, y, is y = (.*)\. When x = (-?\d+), the actual value was (-?[\d,.]+)\. What is the residual, actual minus predicted\?$/))) return expectAnswer(p, n(m[3]) - evaluate(m[1], { x: +m[2] }));
    if ((m = p.prompt.match(/^Which correlation coefficient shows the strongest linear relationship: (.*)\?$/))) {
      const rs = (m[1].match(/-?\d*\.\d+/g) ?? []).map(Number);
      const best = rs.reduce((b, r) => (Math.abs(r) > Math.abs(b) ? r : b));
      if (rs.filter((r) => Math.abs(r) === Math.abs(best)).length !== 1) return "two coefficients tie for strongest";
      return onlyRight(p, (c) => c === `r = ${best}`);
    }
    if ((m = p.prompt.match(/^The correlation coefficient between .+ is r = (-?[\d.]+)\. What does it show\?$/))) {
      const r = +m[1];
      const want = `A ${Math.abs(r) >= 0.7 ? "strong" : "weak"} ${r > 0 ? "positive" : "negative"} linear relationship`;
      return onlyRight(p, (c) => c === want);
    }
    if ((m = p.prompt.match(/^In a data set, .+ and .+ have r = ([\d.]+)\. Which conclusion is sound\?$/))) return onlyRight(p, (c) => /may drive both/.test(c));
    return "unread";
  },
  "two-way-tables": (p) => {
    const m = p.prompt.match(/^A survey asked (.+?) and (.+?) whether .+?\. (\d+) of the \1 (.+?) and (\d+) (.+?); (\d+) of the \2 \4 and (\d+) \6\. (.*)$/);
    if (!m) return "unread";
    const [g0, g1, a, , b, , c, d, q] = [m[1], m[2], +m[3], m[4], +m[5], m[6], +m[7], +m[8], m[9]];
    const T = a + b + c + d;
    let k;
    if ((k = q.match(new RegExp(`^What fraction of all the students surveyed are ${g1} who .+\\? Give it as a fraction\\.$`)))) return expectAnswer(p, c / T);
    if ((k = q.match(/^What fraction of all the students surveyed .+\? Give it as a fraction\.$/))) return expectAnswer(p, (a + c) / T);
    if ((k = q.match(new RegExp(`^What fraction of the ${g0} .+\\? Give it as a fraction\\.$`)))) return expectAnswer(p, a / (a + b));
    if ((k = q.match(new RegExp(`^Of the students who .+, what fraction are ${g1}\\? Give it as a fraction\\.$`)))) return expectAnswer(p, c / (a + c));
    if ((k = q.match(/^Which group has the greater share of students who .+\?$/))) {
      const [r0, r1] = [a / (a + b), c / (c + d)];
      if (close(r0, r1)) return "the shares are equal";
      return onlyRight(p, (ch) => ch === `The ${r0 > r1 ? g0 : g1}`);
    }
    return "unread";
  },
  "literal-equations": (p) => {
    let m;
    const n = (t: string) => +t.replace(/,/g, "");
    if ((m = p.prompt.match(/^The volume of a box is V = lwh\. Solve for h, then find h when V = (\d+), l = (\d+) and w = (\d+)\.$/))) return expectAnswer(p, +m[1] / (+m[2] * +m[3]));
    if ((m = p.prompt.match(/^F = 1\.8C \+ 32 changes Celsius to Fahrenheit\. Solve it for C, then find C when F = (-?\d+)\.$/))) return expectAnswer(p, (+m[1] - 32) / 1.8);
    if ((m = p.prompt.match(/^Simple interest is I = Prt\. Solve for t, then find how many years \$([\d,]+) takes to earn \$([\d,]+) at (\d+)% simple interest\.$/))) return expectAnswer(p, n(m[2]) / ((n(m[1]) * +m[3]) / 100));
    if ((m = p.prompt.match(/^Distance is d = rt\. Solve for r, then find the average speed in miles per hour for ([\d.]+) miles in ([\d.]+) hours\.$/))) return expectAnswer(p, +m[1] / +m[2]);
    if ((m = p.prompt.match(/^A rectangle's perimeter is P = 2l \+ 2w\. Solve for w, then find w when P = (\d+) and l = (\d+)\.$/))) return expectAnswer(p, (+m[1] - 2 * +m[2]) / 2);
    if ((m = p.prompt.match(/^Solve (.+) for ([a-zA-Z])\.$/))) {
      // Any rearrangement is right if, with the other letters set, it makes the original formula true.
      const eq = m[1].toLowerCase();
      const v = m[2].toLowerCase();
      const [L, R] = eq.split("=");
      const letters = [...new Set(eq.match(/[a-z]/g) ?? [])].filter((l) => l !== v);
      return onlyRight(p, (c) => {
        const f = c.toLowerCase().match(/^([a-z]) = (.*)$/);
        if (!f || f[1] !== v) return false;
        return [1, 2, 3].every((t) => {
          const env: Record<string, number> = Object.fromEntries(letters.map((l, j) => [l, 1.3 + t * 0.7 + j * 0.9]));
          env[v] = evaluate(f[2], env);
          return close(evaluate(L, env), evaluate(R, env));
        });
      });
    }
    return "unread";
  },
  "function-transformations": (p) => {
    let m;
    const base = (s: string) => (s === "x²" ? (x: number) => x * x : (x: number) => Math.abs(x));
    const same = (c: string, g: (x: number) => number) => {
      const f = c.match(/^y = (.*)$/);
      // Wide on both sides of any corner: |x − 5| + 6 and |x − 6| + 5 agree everywhere left of 5.
      return !!f && [-13, -7.5, -3.5, -1, 0, 0.5, 2, 4.25, 7.5, 9, 13.5].every((x) => close(evaluate(f[1], { x }), g(x)));
    };
    // The turning point of an upward (or, with min = false, downward) V or U, found by sweeping.
    const turn = (e: string, min = true) => {
      let best = { x: 0, y: min ? Infinity : -Infinity };
      for (let x = -30; x <= 30; x += 0.5) {
        const y = evaluate(e, { x });
        if (min ? y < best.y : y > best.y) best = { x, y };
      }
      return best;
    };
    const dir = (v: number, pos: string, neg: string) => `${v > 0 ? pos : neg} ${Math.abs(v)} ${Math.abs(v) === 1 ? "unit" : "units"}`;
    if ((m = p.prompt.match(/^Move y = (x²|\|x\|) (right|left) (\d+) units? and (up|down) (\d+) units?\. Which equation is the result\?$/))) {
      const S = base(m[1]);
      const h = m[2] === "right" ? +m[3] : -m[3];
      const k = m[4] === "up" ? +m[5] : -m[5];
      return onlyRight(p, (c) => same(c, (x) => S(x - h) + k));
    }
    if ((m = p.prompt.match(/^y = (.*) is y = (x²|\|x\|) moved\. Where is its (?:vertex|corner point)\? Type its (x|y)-coordinate\.$/))) {
      const t = turn(m[1]);
      return expectAnswer(p, m[3] === "x" ? t.x : t.y);
    }
    if ((m = p.prompt.match(/^How does y = -(.*) compare with y = (x²|\|x\|)\?$/))) {
      const t = turn(`-(${m[1].replace(/ ([+−]) (\d+)$/, "")})`, false);
      const k = (() => {
        const f = m![1].match(/ ([+−]) (\d+)$/);
        return f ? (f[1] === "+" ? +f[2] : -f[2]) : 0;
      })();
      const want = `Flipped over the x-axis, moved ${dir(t.x, "right", "left")} and ${dir(k, "up", "down")}`;
      return onlyRight(p, (c) => c === want);
    }
    if ((m = p.prompt.match(/^f\(x\) = (.*)\. If g\(x\) = f\(([^)]*)\)((?: [+−] \d+)?), find g\((-?\d+)\)\.$/))) {
      const x = +m[4];
      const inner = evaluate(m[2], { x });
      const outer = m[3] ? evaluate(`0${m[3]}`) : 0;
      return expectAnswer(p, evaluate(m[1], { x: inner }) + outer);
    }
    if ((m = p.prompt.match(/^Which function is y = (x²|\|x\|) stretched by a factor of (\d+) and then moved down (\d+) units?\?$/))) {
      const S = base(m[1]);
      return onlyRight(p, (c) => same(c, (x) => +m![2] * S(x) - +m![3]));
    }
    if ((m = p.prompt.match(/^The point \((-?\d+), (\d+)\) is on y = (x²|\|x\|)\. Where does it land on y = (.*)\? Type its new (x|y)-coordinate\.$/))) {
      const [px, py] = [+m[1], +m[2]];
      if (base(m[3])(px) !== py) return "the point is not on the parent function";
      const t = turn(m[4]);
      if (!close(evaluate(m[4], { x: px + t.x }), py + t.y)) return "the moved point is not on the new function";
      return expectAnswer(p, m[5] === "x" ? px + t.x : py + t.y);
    }
    return "unread";
  },
  "linear-vs-exponential": (p) => {
    let m;
    const n = (t: string) => +t.replace(/,/g, "");
    const kindOf = (ys: number[]) => {
      const diffs = ys.slice(1).map((y, k) => y - ys[k]);
      const ratios = ys.slice(1).map((y, k) => y / ys[k]);
      if (diffs.every((d) => close(d, diffs[0]))) return "Linear";
      if (ratios.every((r) => close(r, ratios[0]))) return "Exponential";
      return "Neither";
    };
    if ((m = p.prompt.match(/^When x is 0, 1, 2, 3, y is (.*)\. Is the relationship linear, exponential, or neither\?$/))) {
      const want = kindOf(m[1].split(", ").map(n));
      return onlyRight(p, (c) => c === want);
    }
    if ((m = p.prompt.match(/^When x is 0, 1, 2, 3, y is (.*)\. If the pattern continues, what is y when x = (\d+)\?$/))) {
      const ys = m[1].split(", ").map(n);
      const at = +m[2];
      const kind = kindOf(ys);
      if (kind === "Neither") return "the table follows neither pattern";
      return expectAnswer(p, kind === "Linear" ? ys[0] + (ys[1] - ys[0]) * at : ys[0] * (ys[1] / ys[0]) ** at);
    }
    if ((m = p.prompt.match(/^Which situation is modeled by (an exponential|a linear) function\?$/))) {
      const wantExp = m[1] === "an exponential";
      const isExp = (c: string) => /%|double|triple|halve/.test(c);
      return onlyRight(p, (c) => isExp(c) === wantExp);
    }
    if ((m = p.prompt.match(/^Job A pays \$([\d,]+) a day\. Job B pays \$1 on day 1 and doubles its pay each day\. On which day does Job B first pay more than Job A\?$/))) {
      let day = 1;
      while (2 ** (day - 1) <= n(m[1])) day++;
      return expectAnswer(p, day);
    }
    if ((m = p.prompt.match(/^y is (\d+) when x = 0 and (\d+) when x = 2\. If y grows (exponentially|linearly), what is y when x = 3\?$/))) {
      const [y0, y2] = [+m[1], +m[2]];
      return expectAnswer(p, m[3] === "linearly" ? y0 + ((y2 - y0) / 2) * 3 : y0 * Math.sqrt(y2 / y0) ** 3);
    }
    if ((m = p.prompt.match(/^Two towns each have ([\d,]+) people\. Town A gains ([\d,]+) people a year\. Town B grows (\d+)% a year\. How many more people does Town B have after (\d+) years\? \(round to the nearest whole number\)$/))) {
      const [P, add, r, y] = [BigInt(n(m[1])), n(m[2]), BigInt(m[3]), Number(m[4])];
      let v = P;
      for (let k = 0; k < y; k++) v = v * (100n + r);
      const den = 100n ** BigInt(y);
      const townB = Number((v * 2n + den) / (2n * den));
      return expectAnswer(p, townB - (Number(P) + add * y));
    }
    return "unread";
  },
};

/** Word problems that are one equation in disguise: worked out from the story's numbers. Null when the prompt is not one. */
function wordEquation(p: any): string | null | "unread" | undefined {
  let m;
  if ((m = p.prompt.match(/^(\w+) bought a video game for \$(\d+) and snacks for \$(\d+), and has \$(\d+) left\. How many dollars did \1 have before shopping\?$/))) return expectAnswer(p, +m[2] + +m[3] + +m[4]);
  if ((m = p.prompt.match(/^(\d+) friends split a dinner bill evenly\. Each of them paid \$(\d+)\. How many dollars was the whole bill\?$/))) return expectAnswer(p, +m[1] * +m[2]);
  if ((m = p.prompt.match(/^A gym charges a \$(\d+) sign-up fee plus \$(\d+) a month\. (\w+) has paid \$(\d+) in all\. How many months has \3 been a member\?$/))) {
    const months = (+m[4] - +m[1]) / +m[2];
    return Number.isInteger(months) ? expectAnswer(p, months) : "the months do not come out whole";
  }
  if ((m = p.prompt.match(/^A taxi charges \$(\d+) to start plus \$(\d+) for each mile\. A ride cost \$(\d+)\. How many miles long was the ride\?$/))) {
    const miles = (+m[3] - +m[1]) / +m[2];
    return Number.isInteger(miles) ? expectAnswer(p, miles) : "the miles do not come out whole";
  }
  if ((m = p.prompt.match(/^A rectangle's length is (\d+) cm more than twice its width\. Its perimeter is (\d+) cm\. What is its width, in cm\?$/))) return expectAnswer(p, (+m[2] / 2 - +m[1]) / 3);
  if ((m = p.prompt.match(/^The sum of three consecutive integers is (-?\d+)\. What is the (smallest|largest) of the three\?$/))) {
    const n = (+m[1] - 3) / 3;
    if (!Number.isInteger(n)) return "no three consecutive integers have that sum";
    return expectAnswer(p, m[2] === "smallest" ? n : n + 2);
  }
  if ((m = p.prompt.match(/^Phone plan A costs \$(\d+) a month plus \$(\d+) per GB of data\. Plan B costs \$(\d+) a month plus \$(\d+) per GB\. For how many GB do the plans cost the same\?$/))) return expectAnswer(p, (+m[3] - +m[1]) / (+m[2] - +m[4]));
  return undefined;
}

/** A word problem if it is one, else an equation or an error to find. (wordEquation's null means right, so ?? will not do.) */
function wordOrLinear(p: any): string | null | "unread" {
  const w = wordEquation(p);
  return w === undefined ? linearOrError(p) : w;
}

function linearOrError(p: any): string | null | "unread" {
  if (p.type === "error-analysis") {
    const m = p.prompt.match(/^Find the error in this solution of (.*) = (-?\d+)\.$/);
    if (!m) return "unread";
    const x = solveLinear(m[1], m[2]);
    // Each step before the mistake is true of the real solution; the marked one is not.
    const stepTrue = (s: string) => {
      const [l, r] = s.split("=");
      try {
        return close(evaluate(l, { x }), evaluate(r, { x }));
      } catch {
        return false;
      }
    };
    const firstFalse = p.steps.findIndex((s: string) => !stepTrue(s));
    return firstFalse === p.wrongStepIndex ? null : `the first false step is ${firstFalse}, the key says ${p.wrongStepIndex}`;
  }
  if (p.type === "step-order") {
    const m = p.prompt.match(/^Order the steps to solve (.*) = (-?\d+):$/);
    if (!m) return "unread";
    const x = solveLinear(m[1], m[2]);
    const last = p.steps[p.correctOrder[p.correctOrder.length - 2]];
    return last.includes(`x = ${x}`) ? null : `the order does not reach x = ${x}`;
  }
  const m = p.prompt.match(/^Solve for x: (.*) = (-?\d+)$/) ?? p.prompt.match(/^Solve for x: (.*) = (.*)$/);
  if (!m) return "unread";
  return expectAnswer(p, solveLinear(m[1], m[2]));
}

function systemCheck(p: any): string | null | "unread" {
  const m = p.prompt.match(/^Solve: (.*) and (.*)\. What is (x|y)\?$/);
  if (!m) return "unread";
  const eqs = [m[1], m[2]].map((e) => {
    const [l, r] = e.split("=");
    const g = (x: number, y: number) => evaluate(l, { x, y }) - evaluate(r, { x, y });
    const c0 = g(0, 0);
    return { a: g(1, 0) - c0, b: g(0, 1) - c0, c: -c0 };
  });
  const [e1, e2] = eqs;
  const det = e1.a * e2.b - e2.a * e1.b;
  if (close(det, 0)) return "the system has no single solution";
  const x = (e1.c * e2.b - e2.c * e1.b) / det;
  const y = (e1.a * e2.c - e2.a * e1.c) / det;
  return expectAnswer(p, m[3] === "x" ? x : y);
}

function expandCheck(p: any): string | null | "unread" {
  const m = p.prompt.match(/^Expand (.*)$/);
  if (!m) return "unread";
  return onlyRight(p, (c) => samePoly(c, m[1]));
}

function factorCheck(p: any): string | null | "unread" {
  const m = p.prompt.match(/^Factor (?:completely: )?(.*)$/);
  if (!m) return "unread";
  return onlyRight(p, (c) => c !== "Cannot factor" && samePoly(c, m[1]));
}

function rootCheck(p: any): string | null | "unread" {
  let m;
  if ((m = p.prompt.match(/^Solve (.*) = 0\. What is the (smaller|larger|positive|negative|nonzero) root\?$/))) {
    const roots: number[] = [];
    for (let x = -60; x <= 60; x++) if (close(evaluate(m[1], { x }), 0)) roots.push(x);
    if (roots.length !== 2) return `${roots.length} whole roots`;
    const [lo, hi] = [Math.min(...roots), Math.max(...roots)];
    const want = { smaller: lo, larger: hi, positive: hi, negative: lo, nonzero: roots.find((r) => r !== 0) }[m[2] as "smaller"];
    if (m[2] === "positive" && hi <= 0) return "no positive root";
    if (m[2] === "negative" && lo >= 0) return "no negative root";
    if (m[2] === "nonzero" && !roots.includes(0)) return "no zero root to set aside";
    return expectAnswer(p, want!);
  }
  return "unread";
}

/* ── The checker checks itself: planted mistakes must be caught ─────────── */

{
  let planted = 0;
  let caught = 0;
  const missed: string[] = [];
  for (const unit of units) {
    for (const skill of unit.skills) {
      const staticIds = new Set(skill.problems.map((s: any) => s.id));
      const bank = generateProblemBank(skill.id, skill.problems, 424242).filter((p) => !staticIds.has(p.id));
      for (const p of bank.slice(0, 12)) {
        const variants: any[] = [];
        if (p.type === "numeric") variants.push({ ...p, answer: Number(p.answer) + 1 });
        if (p.type === "multiple-choice" && p.choices && p.choices.length > 1) {
          const other = p.choices.find((c: string) => !answerIsRight(p, c));
          if (other) variants.push({ ...p, answer: other });
          // A second right answer smuggled in among the choices.
          variants.push({ ...p, choices: [...p.choices.filter((c: string) => c !== other), p.answer + " "] });
        }
        if (p.type === "error-analysis") variants.push({ ...p, wrongStepIndex: (p.wrongStepIndex + 1) % p.steps.length });
        for (const v of variants) {
          planted++;
          let r: string | null | "unread";
          try {
            r = checks[skill.id](v);
          } catch {
            r = "threw";
          }
          if (r !== null) caught++;
          else if (missed.length < 6) missed.push(`[${skill.id}] ${p.prompt}`);
        }
      }
    }
  }
  console.log(`self-test: ${caught} of ${planted} planted mistakes caught`);
  if (caught !== planted) {
    for (const m of missed) console.log("  MISSED", m);
    process.exit(1);
  }
}

/* ── How every served problem reads: formatting and structure ──────────── */

{
  const { canonicalPrompt } = await import("../problem-utils.ts");
  const RULES: [string, RegExp][] = [
    ["a coefficient of 1 written out (1x)", /(?<![\d.,/^a-zA-Z])-?1(x|y)(?![a-z0-9^²])/],
    ["adding a negative (+ -3)", /\+\s*[−-]\s*\d/],
    ["subtracting a negative written bare (− -3)", /[−-]\s[−-]\d/],
    ["a zero term (+ 0, 0x)", /[+−-]\s0(?![\d.,)])(?!\s*[<>≤≥])|(?<![\d.^])\b0(x|y)\b/],
    // Float garbage runs past six places (0.3333333333333333, 0.27999999999999997); the
    // smallest real decimal on a card, 0.000018, has six.
    ["a raw float (0.3333333)", /\d\.\d{7,}/],
    ["a leftover copy tag", /\((Set|Review|Variant) \d+\)/],
    ["junk", /NaN|Infinity|\[object|\bnull\b|(?<!is |an )undefined(?! slope)/],
  ];
  let served = 0;
  let withTraps = 0;
  let trapAnswerMentions = 0;
  const problems: string[] = [];
  const report = (skill: string, what: string, text: string) => {
    if (problems.length < 12) problems.push(`[${skill}] ${what}: ${text.slice(0, 120)}`);
  };
  for (const unit of units) {
    for (const skill of unit.skills) {
      for (let seed = 1; seed <= 6; seed++) {
        const bank = generateProblemBank(skill.id, skill.problems, seed * 104729);
        const keys = new Set<string>();
        for (const p of bank as any[]) {
          served++;
          const key = canonicalPrompt(p.prompt);
          if (keys.has(key)) report(skill.id, "the same card twice in one bank", p.prompt);
          keys.add(key);
          // What a student reads. A numeric key is a stored number (shown as a fraction when it is one).
          const texts = [p.prompt, p.hint, p.explanation, ...(p.choices ?? []), ...(p.steps ?? [])];
          for (const t of texts) for (const [what, re] of RULES) if (re.test(t)) report(skill.id, what, t);
          if (!p.hint?.trim() || !p.explanation?.trim()) report(skill.id, "no hint or explanation", p.prompt);
          if (p.type === "numeric" && !Number.isFinite(Number(p.answer))) report(skill.id, "a numeric answer that is not a number", `${p.prompt} -> ${p.answer}`);
          if (p.type === "multiple-choice") {
            const norm = (c: string) => c.replace(/\s+/g, "").replace(/[−–]/g, "-").toLowerCase();
            if ((p.choices?.length ?? 0) < 3) report(skill.id, "fewer than 3 choices", JSON.stringify(p.choices));
            if (new Set(p.choices.map(norm)).size !== p.choices.length) report(skill.id, "a repeated choice", JSON.stringify(p.choices));
            if (p.choices.filter((c: string) => answerIsRight(p, c)).length !== 1) report(skill.id, "the key is not exactly one choice", `${p.prompt} ${JSON.stringify(p.choices)}`);
          }
          // A trap is a wrong answer with a reason. One that grades right is not a slip, and its reason must not hand over the key.
          for (const t of p.traps ?? []) {
            if (answerIsRight(p, String(t.value))) report(skill.id, "a trap that is the right answer", `${p.prompt} -> ${t.value}`);
            if (!t.why?.trim() || /→|\[object|NaN|(?<!is |an )undefined(?! slope)/.test(t.why)) report(skill.id, "a trap without a reason", `${p.prompt} -> ${t.value}: ${t.why}`);
            if (p.type === "numeric" && Number.isInteger(Number(p.answer)) && Math.abs(Number(p.answer)) >= 10 && new RegExp(`(^|[^\\d.\\-−/^])${Number(p.answer)}(?![\\d.])`).test(t.why)) trapAnswerMentions++;
            if (typeof t.value === "number" && !Number.isFinite(t.value)) report(skill.id, "a trap that is not a number", p.prompt);
          }
          if (p.traps?.length) withTraps++;
          if (p.type === "error-analysis" && !(p.wrongStepIndex >= 0 && p.wrongStepIndex < p.steps.length)) report(skill.id, "the wrong step is off the list", p.prompt);
          if (p.type === "step-order" && JSON.stringify([...p.correctOrder].sort()) !== JSON.stringify(p.steps.map((_: string, i: number) => i))) report(skill.id, "the step order is not a permutation", p.prompt);
        }
        if (bank.length < 40) report(skill.id, `only ${bank.length} distinct problems in a bank`, skill.id);
      }
    }
  }
  const trapShare = Math.round((100 * withTraps) / served);
  console.log(`hygiene: ${served} served problems read, ${problems.length ? "problems found" : "all clean"}; ${trapShare}% carry named traps (${trapAnswerMentions} trap reasons mention the key's number)`);
  if (trapShare < 75) report("course", `only ${trapShare}% of served problems carry named traps`, "add traps to the generators that lost them");
  if (problems.length) {
    for (const line of problems) console.log("  FAIL", line);
    process.exit(1);
  }
}

/* ── Run ───────────────────────────────────────────────────────────────── */

let checked = 0;
let failures = 0;
let unread = 0;
const shown = new Map<string, number>();
for (const unit of units) {
  for (const skill of unit.skills) {
    const check = checks[skill.id];
    if (!check) {
      console.log("  FAIL: no checker for", skill.id);
      failures++;
      continue;
    }
    const staticIds = new Set(skill.problems.map((s: any) => s.id));
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const p of generateProblemBank(skill.id, skill.problems, seed * 7919)) {
        if (staticIds.has(p.id)) continue; // hand-written: reviewed by people, see curriculum.ts
        checked++;
        let result: string | null | "unread";
        try {
          result = check(p);
        } catch (e) {
          result = `could not be worked out: ${(e as Error).message}`;
        }
        if (result === null) continue;
        const key = `${skill.id}:${result === "unread" ? "unread" : result.slice(0, 40)}`;
        shown.set(key, (shown.get(key) ?? 0) + 1);
        if (result === "unread") unread++;
        else failures++;
        if ((shown.get(key) ?? 0) <= 2) console.log(`  ${result === "unread" ? "UNREAD" : "FAIL"} [${skill.id}] ${p.prompt}${result === "unread" ? "" : ` -- ${result}`}`);
      }
    }
  }
}
console.log(`\n${checked} generated problems worked out independently: ${failures} wrong, ${unread} unread`);
if (failures || unread) process.exit(1);
