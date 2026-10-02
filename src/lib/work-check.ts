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

export type StepKind = "start" | "same" | "changed" | "final" | "unreadable" | "mismatch" | "empty";

export interface StepMark {
  kind: StepKind;
  /** One plain sentence for the student. Empty for "start" and "empty". */
  note: string;
}

export const NOTES = {
  sameRelation: "Same answer as the line above. Nice step.",
  sameExpr: "This equals the line above. Nice step.",
  changed: "This line changes the answer. Look at what you did to get here from the line above.",
  changedSign: "This line changes the answer. Check which way the inequality sign points.",
  changedExpr: "This line is not equal to the line above. Look at what you did to get here from the line above.",
  final: "That looks like your answer. Put it in the answer box to check it.",
  // No-break spaces keep the example equation on one line.
  unreadable: "I can't read this line. Try writing it like 2x\u00a0+\u00a03\u00a0=\u00a011.",
  mismatch: "I can't compare this with the line above. Keep equations with equations and expressions with expressions.",
} as const;

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
  try {
    answer = parseAnswerSet(s);
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
export function compareLines(prev: string, next: string): StepMark {
  if (!clean(next)) return { kind: "empty", note: "" };
  if (looksFinal(next)) return { kind: "final", note: NOTES.final };
  const b = parseLine(next);
  if (!b) return { kind: "unreadable", note: NOTES.unreadable };
  const a = parseLine(prev);
  if (!a || looksFinal(prev)) return { kind: "start", note: "" };
  if (a.kind !== b.kind) return { kind: "mismatch", note: NOTES.mismatch };

  if (a.kind === "expr" && b.kind === "expr") {
    return equivalentExpr(a.node, b.node)
      ? { kind: "same", note: NOTES.sameExpr }
      : { kind: "changed", note: NOTES.changedExpr };
  }
  if (a.kind !== "relation" || b.kind !== "relation") return { kind: "mismatch", note: NOTES.mismatch };

  const vars = Array.from(new Set([...a.vars, ...b.vars])).sort();
  if (sameRelation(a.clauses, b.clauses, vars)) return { kind: "same", note: NOTES.sameRelation };

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
export function checkWork(lines: string[]): StepMark[] {
  const marks: StepMark[] = [];
  let reference: string | null = null;
  for (const line of lines) {
    if (!clean(line)) {
      marks.push({ kind: "empty", note: "" });
      continue;
    }
    if (looksFinal(line)) {
      marks.push({ kind: "final", note: NOTES.final });
      continue;
    }
    if (!parseLine(line)) {
      marks.push({ kind: "unreadable", note: NOTES.unreadable });
      continue;
    }
    marks.push(reference === null ? { kind: "start", note: "" } : compareLines(reference, line));
    reference = line;
  }
  return marks;
}

/**
 * The line a student starts the pad from: the equation or inequality in the
 * problem, or the expression to simplify. Empty when the problem has neither
 * (a unit conversion, a word problem with no equation written out).
 */
export function startingLine(problem: string): string {
  const text = String(problem ?? "");
  if (!text.trim()) return "";
  let math;
  try {
    math = extractMath(text);
  } catch {
    return "";
  }
  for (const { chain, text: t } of math.chains) {
    const vars = new Set(chain.exprs.flatMap((e) => variablesOf(e)));
    if (vars.size >= 1 && vars.size <= 2 && t.length <= 60 && !looksFinal(t)) return t;
  }
  if (/\b(simplify|expand|factor|distribute|combine|rewrite|multiply|evaluate)\b/i.test(text)) {
    for (const { node, text: t } of math.exprs) {
      const vars = variablesOf(node);
      if (vars.length >= 1 && vars.length <= 2 && t.length <= 60) return t;
    }
  }
  return "";
}
