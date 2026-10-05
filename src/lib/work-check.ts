/**
 * Check my work, line by line, with no model and no cost.
 *
 * A student writes the problem's equation, then one line per step. Each line
 * is compared with the line above it: a step is sound when it keeps exactly
 * the same solutions (for an equation or an inequality) or the same value
 * everywhere (for an expression). That is the whole judgement. It never
 * looks at the answer key and it never says what the answer is.
 *
 * A line that pins the variable to a value ("x = 4", "4", "x > 3") is the
 * student's answer, and answers are graded by practice, where first tries
 * count. So those lines are not judged here at all, right or wrong; the pad
 * sends the student to the answer box instead. The same goes for a line with
 * no letters in it, such as "2(3) + 4 = 10": checking it would grade the
 * answer that was substituted in.
 *
 * Everything mathematical comes from mathexpr: the parser, root scans for
 * where two sides meet, and equivalence by sampling.
 */

import {
  difference,
  evalSafe,
  holds,
  normalizeMath,
  parseAnswerSet,
  parseChain,
  samplePoints,
  sameZeroSet,
  scanRoots,
  tryParseExpr,
  variablesOf,
  equivalentExpr,
  extractMath,
  isConstant,
  type Env,
  type Node,
  type RelOp,
} from "@/lib/mathexpr";

export type StepKind = "start" | "same" | "case" | "changed" | "final" | "unreadable" | "mismatch" | "empty";

export interface StepMark {
  kind: StepKind;
  /** One plain sentence for the student. Empty for "start" and "empty". */
  note: string;
}

export const NOTES = {
  sameRelation: "Same answer as the line above. Nice step.",
  case: "That case checks out. Work through each case.",
  sameExpr: "This equals the line above. Nice step.",
  changed: "This line changes the answer. Look at what you did to get here from the line above.",
  changedSign: "This line changes the answer. Check which way the inequality sign points.",
  changedExpr: "This line has a different value from the line above. Look at what you did to get here from the line above.",
  final: "That looks like your answer. Put it in the answer box to check it.",
  // No-break spaces keep the example equation on one line.
  unreadable: "Write this line in math, like 2x\u00a0+\u00a03\u00a0=\u00a011, and it gets checked.",
  mismatch: "Keep equations with equations and expressions with expressions, and this line gets checked against the one above.",
} as const;

/**
 * What the pad knows about the problem it sits under.
 *
 * `system`: the problem states other than exactly one equation or
 * inequality (two equations, or a word problem with none written out), so a
 * student may well write two different equations in x and y one under the
 * other. Two such lines are two equations of a system, and the second is a
 * fresh start rather than a slip.
 *
 * `choices`: a multiple-choice card's choices. A line that is one of them is
 * the student's answer, left for the card to check, so typing each choice
 * into the pad tells them nothing.
 */
export interface WorkContext {
  system?: boolean;
  choices?: string[];
}

// ---------------------------------------------------------------------------
// Reading a line
// ---------------------------------------------------------------------------

interface Rel {
  lhs: Node;
  rhs: Node;
  op: RelOp;
}

/** Relations that must all hold, as in a chain "-1 < x ≤ 4" or "x > 1 and x < 5". */
type Clause = Rel[];

export type ParsedLine =
  | { kind: "relation"; clauses: Clause[]; vars: string[] }
  | { kind: "expr"; node: Node; vars: string[] };

/** Splits at a separator that sits outside brackets. */
function splitTop(s: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let i = 0;
  const sticky = new RegExp(sep.source, "y");
  while (i < s.length) {
    const c = s[i];
    if (depth === 0) {
      sticky.lastIndex = i;
      const m = sticky.exec(s);
      if (m && m[0].length) {
        out.push(cur);
        cur = "";
        i += m[0].length;
        continue;
      }
    }
    if ("([{".includes(c)) depth += 1;
    else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
    cur += c;
    i += 1;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** One spelling, lower case, no lead-in word, no sentence punctuation at the end. */
function clean(text: string): string {
  return normalizeMath(String(text ?? ""))
    .toLowerCase()
    .replace(/^(?:so|then|now|thus|therefore|hence)\b\s*,?\s*/, "")
    .replace(/[.;!?]+$/, "")
    .trim();
}

const HAS_REL = /[=<>≤≥≠]/;

/** Names the parser reads as functions or constants rather than letters. */
const MATH_WORDS = new Set(["sqrt", "cbrt", "root", "abs", "log", "exp", "ln", "pi"]);

/**
 * A sentence is not maths, though the parser would happily read "then I
 * subtract" as a product of a dozen letters. Any run of three or more letters
 * that is not a function name means the line is words.
 */
function hasWords(s: string): boolean {
  const runs = s.replace(/\b(?:or|and)\b/g, " ").match(/[a-z]{3,}/g) ?? [];
  return runs.some((w) => !MATH_WORDS.has(w));
}

/** A line as math: a set of relations joined by "or" and "and", or one expression. Null when unreadable. */
export function parseLine(text: string): ParsedLine | null {
  const s = clean(text);
  if (!s || hasWords(s)) return null;
  if (!HAS_REL.test(s)) {
    const node = tryParseExpr(s);
    return node ? { kind: "expr", node, vars: variablesOf(node) } : null;
  }
  const clauses: Clause[] = [];
  for (const orPart of splitTop(s, /\s*(?:\bor\b|,|;)\s*/)) {
    if (!orPart) return null;
    const clause: Clause = [];
    for (const andPart of splitTop(orPart, /\s*(?:\band\b|&)\s*/)) {
      if (!andPart || !HAS_REL.test(andPart)) return null;
      const chain = parseChain(andPart);
      if (!chain) return null;
      for (let k = 0; k < chain.ops.length; k += 1) {
        clause.push({ lhs: chain.exprs[k], rhs: chain.exprs[k + 1], op: chain.ops[k] });
      }
    }
    clauses.push(clause);
  }
  const vars = new Set<string>();
  for (const c of clauses) for (const r of c) for (const v of [...variablesOf(r.lhs), ...variablesOf(r.rhs)]) vars.add(v);
  return { kind: "relation", clauses, vars: Array.from(vars).sort() };
}

/**
 * Is this line an answer rather than a step? "x = 4", "4 = x", "x = 8/2",
 * "x = -2 or x = 3", "x > 3", "-1 < x ≤ 4", "no solution", "all real
 * numbers", "(2, -1)", or anything with no letters at all.
 */
export function looksFinal(text: string): boolean {
  const s = clean(text);
  if (!s) return false;
  let answer = null;
  // "x(x − 2) = 0" is x times a bracket, which the answer reader takes for a
  // label like f(x) and reads as "0". A letter against a bracket that holds
  // more than one number or letter is algebra: judge it as a line.
  const product = /[a-z]\s*\(/.test(s) && !CALL.test(s);
  try {
    answer = product ? null : parseAnswerSet(s);
  } catch {
    answer = null;
  }
  // "Complex" is how the reader reports a lone i, which in Algebra 1 is the
  // word "I" in a sentence, not an answer.
  if (answer && answer.kind !== "expr" && answer.kind !== "equation" && answer.kind !== "complex") return true;
  const parsed = parseLine(s);
  if (!parsed) return false;
  if (parsed.vars.length === 0) return true;
  if (parsed.kind === "expr") return false;
  // Every relation sets one lone letter against a number.
  let letter: string | null = null;
  for (const clause of parsed.clauses) {
    for (const r of clause) {
      const lone = r.lhs.t === "var" ? r.lhs : r.rhs.t === "var" ? r.rhs : null;
      const other = lone === r.lhs ? r.rhs : r.lhs;
      if (!lone || lone.t !== "var") {
        // A chain "-1 < x ≤ 4" gives "-1 < x" and "x ≤ 4"; each has the letter alone.
        return false;
      }
      if (!isConstant(other)) return false;
      if (letter && letter !== lone.name) return false;
      letter = lone.name;
    }
  }
  return letter !== null;
}

// ---------------------------------------------------------------------------
// Truth and solution sets
// ---------------------------------------------------------------------------

const TOL = 1e-8;

function relHolds(r: Rel, env: Env): boolean | null {
  return holds(r.op, evalSafe(r.lhs, env), evalSafe(r.rhs, env), TOL);
}

/** Does the line hold at env? Null when it is undefined there (division by zero, a root of a negative). */
function truth(clauses: Clause[], env: Env): boolean | null {
  let unknown = false;
  for (const clause of clauses) {
    let all = true;
    let clauseUnknown = false;
    for (const r of clause) {
      const h = relHolds(r, env);
      if (h === null) clauseUnknown = true;
      else if (!h) all = false;
    }
    if (all && !clauseUnknown) return true;
    if (clauseUnknown && all) unknown = true;
  }
  return unknown ? null : false;
}

/** Where the two sides of any relation meet or break: the only places a solution set can change. */
function criticalPoints(clauses: Clause[], v: string): number[] {
  const out: number[] = [];
  for (const clause of clauses) {
    for (const r of clause) {
      const scan = scanRoots({ lhs: r.lhs, rhs: r.rhs }, v);
      if (scan.identity) continue;
      out.push(...scan.roots, ...scan.poles);
    }
  }
  return out;
}

const PROBES = [-2345.67, -98.7, -12.34, -3.21, -1.5, -0.37, 0, 0.29, 1, 1.73, 4.56, 13.7, 87.6, 3456.78];

const allEqual = (clauses: Clause[]) => clauses.every((c) => c.every((r) => r.op === "="));

/** Within a tolerance loose enough for a root found by a scan, tight enough to tell 3 from 3.01. */
function nearlyHolds(r: Rel, env: Env): boolean {
  const l = evalSafe(r.lhs, env);
  const rr = evalSafe(r.rhs, env);
  return Number.isFinite(l) && Number.isFinite(rr) && Math.abs(l - rr) <= 1e-6 * Math.max(1, Math.abs(l), Math.abs(rr));
}

/** The real solutions of a line made only of equations, or "all" for an identity. */
function rootSet(clauses: Clause[], v: string): number[] | "all" {
  const out: number[] = [];
  for (const clause of clauses) {
    const scans = clause.map((r) => scanRoots({ lhs: r.lhs, rhs: r.rhs }, v));
    const real = scans.findIndex((s) => !s.identity);
    if (real < 0) return "all";
    for (const x of scans[real].roots) {
      if (clause.every((r) => nearlyHolds(r, { [v]: x }))) out.push(x);
    }
  }
  out.sort((x, y) => x - y);
  const unique: number[] = [];
  for (const x of out) if (!unique.some((u) => Math.abs(u - x) <= 1e-6 * Math.max(1, Math.abs(x)))) unique.push(x);
  return unique;
}

/**
 * How two one-letter lines' solutions sit together: the same set, b's
 * solutions all inside a's (b is one case of a), or a's all inside b's (b is
 * one half of an "and"). Equations compare their solutions directly;
 * anything with an inequality is tested at the places either line can change
 * and between them, like sameSolutions.
 */
function solutionFit(a: Clause[], b: Clause[], v: string): "same" | "inside" | "around" | "other" {
  const near = (x: number, y: number) => Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x));
  if (allEqual(a) && allEqual(b)) {
    const ra = rootSet(a, v);
    const rb = rootSet(b, v);
    if (ra === "all" || rb === "all") return ra === rb ? "same" : ra === "all" && rb !== "all" && rb.length ? "inside" : "other";
    if (ra.length === rb.length && ra.every((x, k) => near(x, rb[k]))) return "same";
    if (rb.length && rb.every((x) => ra.some((y) => near(x, y)))) return "inside";
    return "other";
  }
  const crit = [...criticalPoints(a, v), ...criticalPoints(b, v)].sort((x, y) => x - y);
  const unique: number[] = [];
  for (const c of crit) if (!unique.some((u) => Math.abs(u - c) <= 1e-9 * Math.max(1, Math.abs(c)))) unique.push(c);
  const tests = [...PROBES];
  for (let k = 0; k < unique.length; k += 1) {
    const c = unique[k];
    const step = Math.max(1e-3, Math.abs(c) * 1e-6);
    tests.push(c, c - step, c + step);
    if (k + 1 < unique.length) tests.push((c + unique[k + 1]) / 2);
  }
  if (unique.length) tests.push(unique[0] - 1, unique[0] - 50.5, unique[unique.length - 1] + 1, unique[unique.length - 1] + 50.5);
  let same = true;
  let inside = true;
  let around = true;
  let someA = false;
  let someB = false;
  let compared = 0;
  for (const t of tests) {
    const ta = truth(a, { [v]: t });
    const tb = truth(b, { [v]: t });
    if (ta === null || tb === null) continue;
    compared += 1;
    if (ta) someA = true;
    if (tb) someB = true;
    if (ta !== tb) same = false;
    if (tb && !ta) inside = false;
    if (ta && !tb) around = false;
  }
  if (compared < 3) return "other";
  if (same) return "same";
  if (inside && someB) return "inside";
  if (around && someA) return "around";
  return "other";
}

/** Does a node hold an absolute value anywhere in it? */
function hasAbs(n: Node): boolean {
  switch (n.t) {
    case "fn":
      return n.name === "abs" || hasAbs(n.a);
    case "neg":
      return hasAbs(n.a);
    case "bin":
      return hasAbs(n.a) || hasAbs(n.b);
    case "root":
      return hasAbs(n.a);
    case "logb":
      return hasAbs(n.a);
    default:
      return false;
  }
}

const isZero = (n: Node) => n.t === "num" && n.v === 0;
const isProduct = (n: Node): boolean => (n.t === "bin" && n.op === "*") || (n.t === "neg" && isProduct(n.a));
const isSquare = (n: Node) => n.t === "bin" && n.op === "^" && n.b.t === "num" && n.b.v === 2;

/**
 * A line a student may split into cases, one per line: an absolute value
 * equal to or greater than a number, a product set to zero, a square set to
 * a number, or an "or". Each case has some of the line's solutions, none of
 * its own, so it is sound even though it is not the same answer.
 */
function splitsIntoCases(clauses: Clause[]): boolean {
  if (clauses.length > 1) return true;
  return clauses.some((c) =>
    c.some(
      (r) =>
        ((hasAbs(r.lhs) || hasAbs(r.rhs)) && (r.op === "=" || r.op === ">" || r.op === ">=" || r.op === "!=")) ||
        (r.op === "=" && ((isZero(r.rhs) && isProduct(r.lhs)) || (isZero(r.lhs) && isProduct(r.rhs)))) ||
        (r.op === "=" && ((isSquare(r.lhs) && isConstant(r.rhs)) || (isSquare(r.rhs) && isConstant(r.lhs))))
    )
  );
}

/** An absolute value kept under a number: |E| < c means E < c and E > −c, two halves a student may write apart. */
function splitsIntoHalves(clauses: Clause[]): boolean {
  return clauses.length === 1 && clauses[0].some((r) => (hasAbs(r.lhs) || hasAbs(r.rhs)) && (r.op === "<" || r.op === "<="));
}

/**
 * Do two one-letter lines hold at exactly the same values of v? Equations
 * compare their solutions directly. Anything with an inequality is tested
 * at every place either line can change (where its sides meet or break),
 * between those places, just beside them, and at spread-out probes.
 */
function sameSolutions(a: Clause[], b: Clause[], v: string): boolean {
  if (allEqual(a) && allEqual(b)) {
    const ra = rootSet(a, v);
    const rb = rootSet(b, v);
    if (ra === "all" || rb === "all") return ra === rb;
    return ra.length === rb.length && ra.every((x, k) => Math.abs(x - rb[k]) <= 1e-6 * Math.max(1, Math.abs(x)));
  }
  const crit = [...criticalPoints(a, v), ...criticalPoints(b, v)].sort((x, y) => x - y);
  const unique: number[] = [];
  for (const c of crit) if (!unique.some((u) => Math.abs(u - c) <= 1e-9 * Math.max(1, Math.abs(c)))) unique.push(c);
  const tests = [...PROBES];
  for (let k = 0; k < unique.length; k += 1) {
    const c = unique[k];
    const step = Math.max(1e-3, Math.abs(c) * 1e-6);
    tests.push(c, c - step, c + step);
    if (k + 1 < unique.length) tests.push((c + unique[k + 1]) / 2);
  }
  if (unique.length) tests.push(unique[0] - 1, unique[0] - 50.5, unique[unique.length - 1] + 1, unique[unique.length - 1] + 50.5);

  let compared = 0;
  for (const t of tests) {
    const ta = truth(a, { [v]: t });
    const tb = truth(b, { [v]: t });
    if (ta === null || tb === null) continue;
    if (ta !== tb) return false;
    compared += 1;
  }
  return compared >= 3;
}

/** The node with some letters replaced by numbers. */
function substitute(n: Node, env: Env): Node {
  switch (n.t) {
    case "num":
      return n;
    case "var":
      return n.name in env ? { t: "num", v: env[n.name] } : n;
    case "neg":
      return { t: "neg", a: substitute(n.a, env) };
    case "bin":
      return { t: "bin", op: n.op, a: substitute(n.a, env), b: substitute(n.b, env) };
    case "fn":
      return { t: "fn", name: n.name, a: substitute(n.a, env) };
    case "root":
      return { t: "root", n: substitute(n.n, env), a: substitute(n.a, env) };
    case "logb":
      return { t: "logb", base: substitute(n.base, env), a: substitute(n.a, env) };
  }
}

function substituteClauses(clauses: Clause[], env: Env): Clause[] {
  return clauses.map((c) => c.map((r) => ({ lhs: substitute(r.lhs, env), rhs: substitute(r.rhs, env), op: r.op })));
}

/** Same solution set, for relations in any number of letters. */
function sameRelation(a: Clause[], b: Clause[], vars: string[]): boolean {
  if (vars.length === 0) {
    const ta = truth(a, {});
    const tb = truth(b, {});
    return ta !== null && ta === tb;
  }
  if (vars.length === 1) return sameSolutions(a, b, vars[0]);

  // Two or more letters. A single equation on each side has the same
  // solutions when one is a constant multiple of the other (y = 2x + 1 and
  // 2x - y = -1); otherwise fix every letter but one at a few values and
  // compare the solutions in the one that is left.
  const single = (c: Clause[]) => c.length === 1 && c[0].length === 1 && c[0][0].op === "=";
  if (single(a) && single(b) && sameZeroSet(difference(a[0][0]), difference(b[0][0]))) return true;
  const main = vars.includes("x") ? "x" : vars[0];
  const others = vars.filter((v) => v !== main);
  for (const env of samplePoints(others, 3, 4242)) {
    if (!sameSolutions(substituteClauses(a, env), substituteClauses(b, env), main)) return false;
  }
  return true;
}

const FLIP: Partial<Record<RelOp, RelOp>> = { "<": ">", ">": "<", "<=": ">=", ">=": "<=" };

// ---------------------------------------------------------------------------
// Judging a line against the one above
// ---------------------------------------------------------------------------

/** How `next` follows from `prev`. Both are lines the student typed. */
export function compareLines(prev: string, next: string, ctx: WorkContext = {}): StepMark {
  if (!clean(next)) return { kind: "empty", note: "" };
  if (looksFinal(next)) return { kind: "final", note: NOTES.final };
  const b = parseLine(next);
  if (!b) return { kind: "unreadable", note: NOTES.unreadable };
  const a = parseLine(prev);
  if (!a || looksFinal(prev)) return { kind: "start", note: "" };
  // Different letters: a value put in for one of them ("y = 2x + 1", then
  // "7 = 2x + 1"), a formula filled in ("y = mx + b", then "5 = 2(3) + b"),
  // or one equation of a system put into the other. Each is a new start
  // rather than a step that can keep or change the answer.
  if (a.vars.join(",") !== b.vars.join(",")) return { kind: "start", note: "" };
  if (a.kind !== b.kind) return { kind: "mismatch", note: NOTES.mismatch };

  if (a.kind === "expr" && b.kind === "expr") {
    return equivalentExpr(a.node, b.node)
      ? { kind: "same", note: NOTES.sameExpr }
      : { kind: "changed", note: NOTES.changedExpr };
  }
  if (a.kind !== "relation" || b.kind !== "relation") return { kind: "mismatch", note: NOTES.mismatch };

  const vars = Array.from(new Set([...a.vars, ...b.vars])).sort();
  if (sameRelation(a.clauses, b.clauses, vars)) return { kind: "same", note: NOTES.sameRelation };
  // Two equations in x and y, one under the other, while solving a system.
  if (ctx.system && vars.length >= 2) return { kind: "start", note: "" };

  // One inequality to another: if turning the sign around would have made it
  // right, say so. That is the classic slip when dividing by a negative.
  const lone = (c: Clause[]) => (c.length === 1 && c[0].length === 1 ? c[0][0] : null);
  const ra = lone(a.clauses);
  const rb = lone(b.clauses);
  if (ra && rb && FLIP[ra.op] && FLIP[rb.op]) {
    const flipped: Clause[] = [[{ ...rb, op: FLIP[rb.op]! }]];
    if (sameRelation(a.clauses, flipped, vars)) return { kind: "changed", note: NOTES.changedSign };
  }
  return { kind: "changed", note: NOTES.changed };
}

/**
 * Marks for every line of the pad. Each line is compared with the nearest
 * line above it that is a readable step; the first such line is the start.
 * Unreadable lines and answers are skipped as a reference, so one typo does
 * not turn every line under it grey.
 */
export function checkWork(lines: string[], ctx: WorkContext = {}): StepMark[] {
  const marks: StepMark[] = [];
  const picks = new Set((ctx.choices ?? []).map(asTyped));
  let reference: string | null = null;
  /** Every line used as a reference so far: a case may come from any of them. */
  const earlier: string[] = [];
  for (const line of lines) {
    if (!clean(line)) {
      marks.push({ kind: "empty", note: "" });
      continue;
    }
    // f(3) = 11 − 3 reads as f times 3. Values of a function are left
    // unjudged rather than compared as something they are not.
    if (hasFunctionNotation(line)) {
      marks.push({ kind: "empty", note: "" });
      continue;
    }
    if (looksFinal(line) || picks.has(asTyped(line))) {
      marks.push({ kind: "final", note: NOTES.final });
      continue;
    }
    if (!parseLine(line)) {
      marks.push({ kind: "unreadable", note: NOTES.unreadable });
      continue;
    }
    let mark: StepMark = reference === null ? { kind: "start", note: "" } : compareLines(reference, line, ctx);
    if (mark.kind === "changed") {
      // One case of a split (|2x − 3| = 7 into 2x − 3 = 7, then 2x − 3 = −7),
      // or a line that matches one further up: sound work, not a slip.
      for (let k = earlier.length - 1; k >= 0; k -= 1) {
        const fit = caseFit(earlier[k], line);
        if (fit) {
          mark = fit;
          break;
        }
      }
    }
    marks.push(mark);
    reference = line;
    earlier.push(line);
  }
  return marks;
}

/** "f(3)", "g(x)", "C(n)": a single letter naming a function, with a number or a letter as its input. */
const CALL = /(?<![a-z])[a-z]\(\s*(?:-?\d+(?:\.\d+)?|[a-z])\s*\)/;

/** Does a line use function notation? */
export function hasFunctionNotation(text: string): boolean {
  return CALL.test(clean(text));
}

/** How a line sits under an earlier one, when it is not a plain next step: the same answer again, or one case of a split. */
function caseFit(prev: string, next: string): StepMark | null {
  const a = parseLine(prev);
  const b = parseLine(next);
  if (!a || !b || a.kind !== "relation" || b.kind !== "relation" || looksFinal(prev)) return null;
  if (a.vars.length !== 1 || a.vars.join() !== b.vars.join()) return null;
  const fit = solutionFit(a.clauses, b.clauses, a.vars[0]);
  if (fit === "same") return { kind: "same", note: NOTES.sameRelation };
  if (fit === "inside" && splitsIntoCases(a.clauses)) return { kind: "case", note: NOTES.case };
  if (fit === "around" && splitsIntoHalves(a.clauses)) return { kind: "case", note: NOTES.case };
  return null;
}

/** A line as typed, for matching a choice: one spelling, no spaces. */
function asTyped(text: string): string {
  return clean(text).replace(/\s+/g, "");
}

/** Does a line have a letter in it? A line of plain numbers is arithmetic, which the pad leaves unmarked. */
export function hasLetters(text: string): boolean {
  return /[a-z]/i.test(clean(text));
}

/** A root written with a raised index ("³√x") reads back as "^3√x", which is no line to start from. */
const MANGLED = /^\^|\^\d*√/;

/**
 * The equations and inequalities a problem states, as lines a student could
 * start from: "Solve: y = x + 2 and x + y = 8" gives both. A condition such
 * as "x = 3" or "x = k" is left out, and the two halves of an "or" compound
 * stay together as one line.
 */
export function givensOf(problem: string): string[] {
  const text = String(problem ?? "");
  if (!text.trim()) return [];
  let math;
  try {
    math = extractMath(text);
  } catch {
    return [];
  }
  const out: { text: string; vars: string[] }[] = [];
  for (const { chain, text: t } of math.chains) {
    const vars = Array.from(new Set(chain.exprs.flatMap((e) => variablesOf(e)))).sort();
    if (vars.length < 1 || vars.length > 2 || t.length > 60 || looksFinal(t) || MANGLED.test(t)) continue;
    // "the line x = k": a name, not something to work from.
    if (chain.exprs.length === 2 && chain.exprs.every((e) => e.t === "var")) continue;
    out.push({ text: t, vars });
  }
  // "3x + 10 < 7 OR 3x + 10 > 25" is one compound, in one letter.
  if (math.hasOr && out.length === 2 && out[0].vars.join() === out[1].vars.join() && out[0].vars.length === 1) {
    return [`${out[0].text} or ${out[1].text}`];
  }
  return out.map((g) => g.text);
}

/**
 * The lines a student starts the pad from: what the problem states (see
 * givensOf), or the expression to simplify. Empty when the problem has
 * neither (a unit conversion, a word problem with no equation written out).
 */
export function startingLines(problem: string): string[] {
  const givens = givensOf(problem);
  if (givens.length) return givens.slice(0, 3);
  const text = String(problem ?? "");
  if (!/\b(simplify|expand|factor|distribute|combine|rewrite|multiply|evaluate)\b/i.test(text)) return [];
  let math;
  try {
    math = extractMath(text);
  } catch {
    return [];
  }
  for (const { node, text: t } of math.exprs) {
    const vars = variablesOf(node);
    if (vars.length >= 1 && vars.length <= 2 && t.length <= 60 && !MANGLED.test(t)) return [t];
  }
  return [];
}

/** The first of the starting lines, or empty. */
export function startingLine(problem: string): string {
  return startingLines(problem)[0] ?? "";
}

/** How the pad reads this problem's work (see WorkContext). */
export function workContext(problem: string, choices?: string[]): WorkContext {
  return { system: givensOf(problem).length !== 1, choices };
}
