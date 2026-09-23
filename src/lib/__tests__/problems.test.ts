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
    .replace(/³/g, "^3");
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
    if ((m = p.prompt.match(/^Convert (\d+) kilograms to grams/))) return expectAnswer(p, +m[1] * 1000);
    if ((m = p.prompt.match(/^Convert (\d+) minutes to milliseconds/))) return expectAnswer(p, +m[1] * 60000);
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
    if ((m = p.prompt.match(/^A recipe needs (\d+) mL/))) return expectAnswer(p, +m[1] / 1000);
    if ((m = p.prompt.match(/^You drive (\d+) miles using (\d+) gallons/))) {
      if ((+m[1] / +m[2]) % 1 !== 0) return "miles per gallon is not whole";
      return expectAnswer(p, +m[1] / +m[2]);
    }
    if ((m = p.prompt.match(/^A train travels (\d+) mph for (\d+) hours/))) return expectAnswer(p, +m[1] * +m[2]);
    return "unread";
  },
  "one-step-equations": (p) => linearOrError(p),
  "two-step-equations": (p) => linearOrError(p),
  "multi-step-equations": (p) => linearOrError(p),
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
    if ((m = p.prompt.match(/^Solve: (.*) (>|<|≥|≤) (-?\d+)$/))) {
      const [left, op, c] = [m[1], m[2], +m[3]];
      const holds = (x: number) => {
        const v = evaluate(left, { x });
        return op === ">" ? v > c : op === "<" ? v < c : op === "≥" ? v >= c : v <= c;
      };
      return onlyRight(p, (choice) => {
        const f = setOf(choice);
        return !!f && sameSet(f, holds);
      });
    }
    return "unread";
  },
  "coordinate-plane": (p) => {
    let m;
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
    if ((m = p.prompt.match(/^Find the (x|y)-intercept of (.*) = (-?\d+)\. Type its/))) {
      const [which, left, c] = [m[1], m[2], +m[3]];
      const want = which === "x" ? solveLinear(left.replace(/y/g, "(0)"), String(c)) : solveLinear(left.replace(/x/g, "(0)").replace(/y/g, "x"), String(c));
      return expectAnswer(p, want);
    }
    return "unread";
  },
  "slope-intercept": (p) => {
    let m;
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
    const m = p.prompt.match(/^Which equation is the line through \((-?\d+), (-?\d+)\) with slope (-?\d+), written in point-slope form\?$/);
    if (!m) return "unread";
    const [x1, y1, s] = [+m[1], +m[2], +m[3]];
    const target = { m: s, b: y1 - s * x1 };
    return onlyRight(p, (c) => sameLine(lineOf(c), target));
  },
  "standard-form": (p) => {
    const m = p.prompt.match(/^Convert (.* = -?\d+) to slope-intercept form\.$/);
    if (!m) return "unread";
    const target = lineOf(m[1]);
    return onlyRight(p, (c) => sameLine(lineOf(c), target));
  },
  "parallel-perpendicular": (p) => {
    let m;
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
  substitution: (p) => systemCheck(p),
  elimination: (p) => {
    if (p.type === "step-order") {
      const m = p.prompt.match(/x \+ y = (-?\d+) and x − y = (-?\d+)/);
      if (!m) return "unread";
      const x = (+m[1] + +m[2]) / 2;
      const y = +m[1] - x;
      const ok = p.steps[0] === `Add the equations: 2x = ${2 * x}` && p.steps[1] === `Solve: x = ${x}` && p.steps[3] === `Solve for y: y = ${y}`;
      return ok && JSON.stringify(p.correctOrder) === "[0,1,2,3]" ? null : "step-order steps do not solve the system";
    }
    return systemCheck(p);
  },
  "systems-word-problems": (p) => {
    let m;
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
    if ((m = p.prompt.match(/^Solve: (-?\d+) < (.*) < (-?\d+)$/))) {
      const [lo, e, hi] = [+m[1], m[2], +m[3]];
      return pick((x) => lo < evaluate(e, { x }) && evaluate(e, { x }) < hi);
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
    const m = p.prompt.match(/^Which point satisfies y ≤ (.*) AND y > (-?\d+)\?$/);
    if (!m) return "unread";
    return onlyRight(p, (c) => {
      const q = point(c);
      return !!q && q.y <= evaluate(m[1], { x: q.x }) && q.y > +m[2];
    });
  },
  "function-notation": (p) => {
    const m = p.prompt.match(/^If ([fg])\(x\) = (.*), find [fg]\((-?\d+)\)\.$/);
    if (!m) return "unread";
    return expectAnswer(p, evaluate(m[2], { x: +m[3] }));
  },
  "domain-range": (p) => {
    let m;
    if ((m = p.prompt.match(/^What is the domain of f\(x\) = 1\/\(x (−|\+) (\d+)\)\?$/))) {
      const bad = m[1] === "−" ? +m[2] : -m[2];
      return onlyRight(p, (c) => c === `All real numbers except ${bad}`);
    }
    if ((m = p.prompt.match(/^What is the domain of f\(x\) = √\(x − (\d+)\)\?$/))) return onlyRight(p, (c) => c === `x ≥ ${m[1]}`);
    if ((m = p.prompt.match(/^What is the domain of f\(x\) = 1\/\(\(x − (\d+)\)\(x − (\d+)\)\)\?$/))) return onlyRight(p, (c) => c === `All real numbers except ${m[1]} and ${m[2]}`);
    return "unread";
  },
  "function-graphs": (p) => {
    const m = p.prompt.match(/passes through \((-?\d+), (-?\d+)\) and \((-?\d+), (-?\d+)\)\. What is its average rate of change/);
    if (!m) return "unread";
    const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
    return onlyRight(p, (c) => close(val(c), (y2 - y1) / (x2 - x1)));
  },
  "arithmetic-sequences": (p) => {
    let m;
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
    if ((m = p.prompt.match(/^(\d+)\^(\d+) × \1\^(\d+) = \1\^n\. What is n\?$/))) return expectAnswer(p, +m[2] + +m[3]);
    if ((m = p.prompt.match(/^(\d+)\^(\d+) ÷ \1\^(\d+) = \1\^n\. What is n\?$/))) return expectAnswer(p, +m[2] - +m[3]);
    if ((m = p.prompt.match(/^Simplify: \(x\^(\d+)\)\^(\d+)$/))) return onlyRight(p, (c) => c === `x^${+m[1] * +m[2]}`);
    if ((m = p.prompt.match(/^Simplify: \(?(\d+)x?\)?\^0/))) return expectAnswer(p, 1);
    if ((m = p.prompt.match(/^Simplify (\d+)\^(\d+) × \1\^(\d+), then write the answer as a number\.$/))) return expectAnswer(p, (+m[1]) ** (+m[2] + +m[3]));
    return "unread";
  },
  "negative-fractional-exponents": (p) => {
    let m;
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
    return "unread";
  },
  "simplifying-radicals": (p) => {
    let m;
    if ((m = p.prompt.match(/^Write √(\d+) in simplest radical form\.$/))) {
      const n = +m[1];
      return onlyRight(p, (c) => close(evaluate(c), Math.sqrt(n)));
    }
    if ((m = p.prompt.match(/^Simplify √(\d+)$/))) return expectAnswer(p, Math.sqrt(+m[1]));
    return "unread";
  },
  "exponential-functions": (p) => {
    let m;
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
  "multiplying-binomials": (p) => expandCheck(p),
  "special-products": (p) => expandCheck(p),
  "factoring-trinomials": (p) => factorCheck(p),
  "factoring-special": (p) => factorCheck(p),
  "graphing-parabolas": (p) => {
    let m;
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
  "solving-by-factoring": (p) => rootCheck(p),
  "completing-square": (p) => {
    const m = p.prompt.match(/^Complete the square: x² (\+|−) (\d+)x \+ ___ = \(x (\+|−) (\d+)\)²$/);
    if (!m) return "unread";
    if (+m[4] * 2 !== +m[2] || m[1] !== m[3]) return "the square shown does not match";
    return onlyRight(p, (c) => close(val(c), (+m[2] / 2) ** 2));
  },
  "quadratic-formula": (p) => {
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
    const m = p.prompt.match(/^f\(x\) = \{ (.*) if x < (-?\d+); (.*) if x ≥ \2 \}\. Find f\((-?\d+)\)\.$/);
    if (!m) return "unread";
    const [first, b, second, x] = [m[1], +m[2], m[3], +m[4]];
    return expectAnswer(p, evaluate(x < b ? first : second, { x }));
  },
};

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
  const m = p.prompt.match(/^Factor (.*)$/);
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
          if (p.type === "error-analysis" && !(p.wrongStepIndex >= 0 && p.wrongStepIndex < p.steps.length)) report(skill.id, "the wrong step is off the list", p.prompt);
          if (p.type === "step-order" && JSON.stringify([...p.correctOrder].sort()) !== JSON.stringify(p.steps.map((_: string, i: number) => i))) report(skill.id, "the step order is not a permutation", p.prompt);
        }
        if (bank.length < 40) report(skill.id, `only ${bank.length} distinct problems in a bank`, skill.id);
      }
    }
  }
  console.log(`hygiene: ${served} served problems read, ${problems.length ? "problems found" : "all clean"}`);
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
