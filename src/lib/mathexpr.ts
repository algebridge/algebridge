/**
 * School algebra as data.
 *
 * A tokenizer, a recursive-descent parser and an evaluator for the math a
 * student meets in Algebra 1 and Algebra 2: decimals and fractions, single
 * letter variables, implicit multiplication (2x, 3(x + 1), (x + 1)(x - 2),
 * 2πr), powers with negative, fractional and parenthesized exponents, square
 * and nth roots, absolute value bars, log, ln, log_b, e and π.
 *
 * Built for the extension's answer checks, so the rest of the file is about
 * comparing math: relations (= < > ≤ ≥ ≠), expression equivalence by
 * sampling, real roots by scanning, a reader for the many ways a student
 * writes an answer ("x = 4", "{-2, 3}", "x = ±2", "(2, -1)", "-1 < x ≤ 4",
 * "no solution"), and a reader that pulls the math out of a problem
 * statement.
 *
 * The imaginary unit is out of scope: an answer with i in it is reported as
 * complex and the caller skips the check. Nothing here uses eval or Function.
 */

export type RelOp = "=" | "<" | ">" | "<=" | ">=" | "!=";

export type FnName = "sqrt" | "cbrt" | "abs" | "log" | "ln" | "exp";

export type Node =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { t: "fn"; name: FnName; a: Node }
  | { t: "root"; n: Node; a: Node }
  | { t: "logb"; base: Node; a: Node };

export type Env = Record<string, number>;

export interface Relation {
  lhs: Node;
  rhs: Node;
  op: RelOp;
}

export interface Chain {
  exprs: Node[];
  ops: RelOp[];
}

export class MathSyntaxError extends Error {}
export class MathEvalError extends Error {}

// ---------------------------------------------------------------------------
// Normalizing what a page or a student typed
// ---------------------------------------------------------------------------

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁻": "-", "⁺": "+", "ⁿ": "n", "ˣ": "x", "⁽": "(", "⁾": ")",
};
const SUBSCRIPT: Record<string, string> = {
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
};

/**
 * One spelling for every symbol: typographic minus signs to "-", × and · to
 * "*", ÷ to "/", superscripts to "^", subscripts to "_", <= to ≤, >= to ≥,
 * != to ≠, ≈ to =, odd spaces to one space.
 */
export function normalizeMath(input: string): string {
  let s = String(input ?? "");
  s = s.replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000\t\r\n]/g, " ");
  s = s.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015\ufe63\uff0d]/g, "-");
  s = s.replace(/[\u00d7\u22c5\u00b7\u2219\u2715\u2716\u2217]/g, "*");
  s = s.replace(/[\u00f7]/g, "/").replace(/[∕⁄]/g, "/");
  s = s.replace(/\*\*/g, "^");
  s = s.replace(/<=|=</g, "≤").replace(/>=|=>/g, "≥").replace(/!=|=\/=|<>/g, "≠");
  s = s.replace(/\u2a7d/g, "≤").replace(/\u2a7e/g, "≥").replace(/[\u2248\u2245]/g, "=");
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿˣ⁽⁾]+/g, (run) => {
    const t = Array.from(run).map((c) => SUPERSCRIPT[c] ?? "").join("");
    return /^(\d+|[a-z])$/.test(t) ? `^${t}` : `^(${t})`;
  });
  s = s.replace(/[₀-₉]+/g, (run) => "_" + Array.from(run).map((c) => SUBSCRIPT[c] ?? "").join(""));
  // "+/-" and "+-" are how a keyboard writes ±. "x + -3", with a space, stays a sum.
  s = s.replace(/\+\/-|\+-(?=[\d(√a-z])/g, "±");
  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Tok =
  | { k: "num"; v: number; sp: boolean }
  | { k: "id"; v: string; sp: boolean }
  | { k: "op"; v: string; sp: boolean };

const FUNCTION_NAMES = ["infinity", "sqrt", "cbrt", "root", "abs", "log", "exp", "inf", "ln", "pi"];
const UNSUPPORTED = /^(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan)/;

/** Splits a run of letters into function names and single-letter variables. */
function splitWord(word: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < word.length) {
    const rest = word.slice(i).toLowerCase();
    if (UNSUPPORTED.test(rest)) throw new MathSyntaxError("trig is not supported");
    const name = FUNCTION_NAMES.find((n) => rest.startsWith(n));
    if (name) {
      out.push(name);
      i += name.length;
    } else {
      out.push(word[i]);
      i += 1;
    }
  }
  return out;
}

function tokenize(src: string): Tok[] {
  const s = src;
  const out: Tok[] = [];
  let i = 0;
  let sp = false;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      sp = true;
      i += 1;
      continue;
    }
    const num = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(s.slice(i));
    if (num) {
      out.push({ k: "num", v: Number(num[0]), sp });
      i += num[0].length;
      sp = false;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      const word = /^[a-zA-Z]+/.exec(s.slice(i))![0];
      splitWord(word).forEach((part, k) => out.push({ k: "id", v: part, sp: k === 0 ? sp : false }));
      i += word.length;
      sp = false;
      continue;
    }
    if (c === "π") {
      out.push({ k: "id", v: "pi", sp });
    } else if (c === "∞") {
      out.push({ k: "num", v: Infinity, sp });
    } else if ("+-*/^()[]{}|,_√∛∜".includes(c)) {
      out.push({ k: "op", v: c, sp });
    } else {
      throw new MathSyntaxError(`unexpected "${c}"`);
    }
    i += 1;
    sp = false;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const num = (v: number): Node => ({ t: "num", v });
const bin = (op: "+" | "-" | "*" | "/" | "^", a: Node, b: Node): Node => ({ t: "bin", op, a, b });
const fn = (name: FnName, a: Node): Node => ({ t: "fn", name, a });

const FN_IDS = new Set(["sqrt", "cbrt", "root", "abs", "log", "exp", "ln"]);

class Parser {
  private i = 0;
  private absDepth = 0;
  private readonly toks: Tok[];
  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  parse(): Node {
    if (!this.toks.length) throw new MathSyntaxError("empty");
    const n = this.expr();
    if (this.i < this.toks.length) throw new MathSyntaxError("trailing input");
    return n;
  }

  private peek(o = 0): Tok | undefined {
    return this.toks[this.i + o];
  }

  private isOp(t: Tok | undefined, v: string): boolean {
    return !!t && t.k === "op" && t.v === v;
  }

  private eat(v: string): boolean {
    if (this.isOp(this.peek(), v)) {
      this.i += 1;
      return true;
    }
    return false;
  }

  private expect(v: string): void {
    if (!this.eat(v)) throw new MathSyntaxError(`expected ${v}`);
  }

  private expr(): Node {
    let n = this.term();
    for (;;) {
      if (this.eat("+")) n = bin("+", n, this.term());
      else if (this.eat("-")) n = bin("-", n, this.term());
      else return n;
    }
  }

  /** Can the next token start a factor written right after another, as in 2x or 3(x + 1)? */
  private startsImplicit(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.k === "id") return true;
    if (t.k === "op") {
      if ("([{√∛∜".includes(t.v)) return true;
      if (t.v === "|") return this.absDepth === 0;
    }
    return false;
  }

  private term(): Node {
    let n = this.unary();
    for (;;) {
      if (this.eat("*")) n = bin("*", n, this.unary());
      else if (this.eat("/")) n = bin("/", n, this.unary());
      else if (this.startsImplicit()) n = bin("*", n, this.power());
      else return n;
    }
  }

  private unary(): Node {
    if (this.eat("-")) return { t: "neg", a: this.unary() };
    if (this.eat("+")) return this.unary();
    return this.power();
  }

  private power(): Node {
    const base = this.primary();
    if (this.eat("^")) return bin("^", base, this.exponent());
    return base;
  }

  /** Right of a caret: a signed power, so x^-2 and 2^3^2 read the usual way. */
  private exponent(): Node {
    if (this.eat("-")) return { t: "neg", a: this.exponent() };
    if (this.eat("+")) return this.exponent();
    const b = this.primary();
    if (this.eat("^")) return bin("^", b, this.exponent());
    return b;
  }

  private group(close: string): Node {
    const n = this.expr();
    this.expect(close);
    return n;
  }

  /** What a root sign applies to: a group, or the next power. √x^2 is √(x^2). */
  private radicand(): Node {
    if (this.eat("-")) return { t: "neg", a: this.radicand() };
    return this.power();
  }

  private primary(): Node {
    const t = this.peek();
    if (!t) throw new MathSyntaxError("unexpected end");
    if (t.k === "num") {
      this.i += 1;
      return num(t.v);
    }
    if (t.k === "id") return this.identifier();
    this.i += 1;
    switch (t.v) {
      case "(":
        return this.group(")");
      case "[":
        return this.group("]");
      case "{":
        return this.group("}");
      case "|": {
        this.absDepth += 1;
        const n = this.expr();
        this.absDepth -= 1;
        this.expect("|");
        return fn("abs", n);
      }
      case "√":
        return fn("sqrt", this.radicand());
      case "∛":
        return fn("cbrt", this.radicand());
      case "∜":
        return { t: "root", n: num(4), a: this.radicand() };
      case "^": {
        // "³√x" arrives as "^3√x": a root index written as a superscript.
        const n = this.peek();
        if (n?.k === "num" && this.isOp(this.peek(1), "√")) {
          this.i += 2;
          return { t: "root", n: num(n.v), a: this.radicand() };
        }
        break;
      }
    }
    throw new MathSyntaxError(`unexpected "${t.v}"`);
  }

  /** A function argument: a parenthesized group, or an implicit product such as log 2x. */
  private fnArg(): Node {
    if (this.eat("(")) return this.group(")");
    if (this.eat("{")) return this.group("}");
    let a = this.power();
    for (;;) {
      const t = this.peek();
      if (!this.startsImplicit() || (t?.k === "id" && FN_IDS.has(t.v))) return a;
      a = bin("*", a, this.power());
    }
  }

  private logBase(): Node {
    const t = this.peek();
    if (!t) throw new MathSyntaxError("missing log base");
    if (t.k === "num") {
      this.i += 1;
      return num(t.v);
    }
    if (t.k === "id" && t.v.length === 1) {
      this.i += 1;
      return { t: "var", name: t.v };
    }
    if (this.eat("(")) return this.group(")");
    if (this.eat("{")) return this.group("}");
    throw new MathSyntaxError("bad log base");
  }

  private identifier(): Node {
    const t = this.peek() as { k: "id"; v: string; sp: boolean };
    this.i += 1;
    switch (t.v) {
      case "pi":
        return num(Math.PI);
      case "e":
        return num(Math.E);
      case "inf":
      case "infinity":
        return num(Infinity);
      case "sqrt":
      case "cbrt":
      case "abs":
      case "ln":
      case "exp":
        return fn(t.v, this.fnArg());
      case "root": {
        this.expect("(");
        const n = this.expr();
        this.expect(",");
        const a = this.expr();
        this.expect(")");
        return { t: "root", n, a };
      }
      case "log": {
        let base: Node | null = null;
        if (this.eat("_")) base = this.logBase();
        else {
          // log2(x), written with no space, is log base 2.
          const n = this.peek();
          const p = this.peek(1);
          if (n?.k === "num" && !n.sp && p?.k === "op" && p.v === "(" && !p.sp) {
            this.i += 1;
            base = num(n.v);
          }
        }
        const a = this.fnArg();
        return base ? { t: "logb", base, a } : fn("log", a);
      }
      default:
        return { t: "var", name: t.v };
    }
  }
}

/** Parses an expression. Throws MathSyntaxError on anything it cannot read. */
export function parseExpr(source: string): Node {
  const s = normalizeMath(source);
  if (/[=<>≤≥≠]/.test(s)) throw new MathSyntaxError("a relation is not an expression");
  return new Parser(tokenize(s)).parse();
}

/** parseExpr that answers null instead of throwing. */
export function tryParseExpr(source: string): Node | null {
  try {
    return parseExpr(source);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** For a negative base: the odd denominator of a rational exponent, or 0. */
function oddDenominator(b: number): number {
  for (let q = 1; q <= 15; q += 2) {
    const p = b * q;
    if (Math.abs(p - Math.round(p)) < 1e-9) return q;
  }
  return 0;
}

function power(a: number, b: number): number {
  if (a === 0 && b < 0) return NaN;
  if (a < 0 && !Number.isInteger(b)) {
    // (-8)^(1/3) is -2 in a school classroom, and Math.pow says NaN.
    const q = oddDenominator(b);
    if (!q) return NaN;
    const p = Math.round(b * q);
    const r = Math.pow(-a, b);
    return Math.abs(p) % 2 === 0 ? r : -r;
  }
  return Math.pow(a, b);
}

function nthRoot(n: number, a: number): number {
  if (!Number.isInteger(n) || n < 1) return NaN;
  if (a < 0) return n % 2 === 1 ? -Math.pow(-a, 1 / n) : NaN;
  return Math.pow(a, 1 / n);
}

function ev(n: Node, env: Env): number {
  switch (n.t) {
    case "num":
      return n.v;
    case "var": {
      if (!Object.prototype.hasOwnProperty.call(env, n.name)) throw new MathEvalError(`unbound variable ${n.name}`);
      return env[n.name];
    }
    case "neg":
      return -ev(n.a, env);
    case "bin": {
      const a = ev(n.a, env);
      const b = ev(n.b, env);
      switch (n.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return b === 0 ? NaN : a / b;
        case "^":
          return power(a, b);
      }
      return NaN;
    }
    case "fn": {
      const a = ev(n.a, env);
      switch (n.name) {
        case "sqrt":
          if (a < 0 && a > -1e-12) return 0;
          return a < 0 ? NaN : Math.sqrt(a);
        case "cbrt":
          return Math.cbrt(a);
        case "abs":
          return Math.abs(a);
        case "ln":
          return a > 0 ? Math.log(a) : NaN;
        case "log":
          return a > 0 ? Math.log10(a) : NaN;
        case "exp":
          return Math.exp(a);
      }
      return NaN;
    }
    case "root":
      return nthRoot(ev(n.n, env), ev(n.a, env));
    case "logb": {
      const base = ev(n.base, env);
      const a = ev(n.a, env);
      if (!(base > 0) || base === 1 || !(a > 0)) return NaN;
      return Math.log(a) / Math.log(base);
    }
  }
}

/**
 * The value of an expression. Domain errors (√ of a negative, log of zero,
 * division by zero) give NaN; a variable missing from env throws.
 */
export function evaluate(expr: string | Node, env: Env = {}): number {
  return ev(typeof expr === "string" ? parseExpr(expr) : expr, env);
}

/** evaluate that gives NaN for anything unreadable or unbound. */
export function evalSafe(expr: Node, env: Env = {}): number {
  try {
    return ev(expr, env);
  } catch {
    return NaN;
  }
}

export function variablesOf(expr: string | Node): string[] {
  const node = typeof expr === "string" ? parseExpr(expr) : expr;
  const out = new Set<string>();
  const walk = (n: Node): void => {
    switch (n.t) {
      case "var":
        out.add(n.name);
        return;
      case "neg":
      case "fn":
        walk(n.a);
        return;
      case "bin":
        walk(n.a);
        walk(n.b);
        return;
      case "root":
        walk(n.n);
        walk(n.a);
        return;
      case "logb":
        walk(n.base);
        walk(n.a);
        return;
      default:
        return;
    }
  };
  walk(node);
  return Array.from(out).sort();
}

export function isConstant(n: Node): boolean {
  return variablesOf(n).length === 0;
}

/** Equal within a relative tolerance. */
export function close(a: number, b: number, tol = 1e-6): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

export function roundTo(n: number, places: number): number {
  const f = Math.pow(10, places);
  const x = Math.abs(n) * f;
  return (Math.sign(n) * Math.round(x + 1e-9 * Math.max(1, x))) / f;
}

/** A constant expression's value, or null. "3/4" is 0.75, "2√3" is 3.46..., "1 2/3" is 1.66... */
export function constValue(text: string): number | null {
  const s = normalizeMath(text).trim();
  const mixed = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(s);
  if (mixed) {
    const den = Number(mixed[4]);
    if (!den) return null;
    const v = Number(mixed[2]) + Number(mixed[3]) / den;
    return mixed[1] ? -v : v;
  }
  const node = tryParseExpr(s);
  if (!node || !isConstant(node)) return null;
  const v = evalSafe(node);
  return Number.isNaN(v) ? null : v;
}

/** Digits typed after the decimal point of a plain decimal, else 0. */
export function decimalsOf(text: string): number {
  const m = /^\s*[-+]?\d*\.(\d+)\s*$/.exec(normalizeMath(text).replace(/^[a-z]\s*=\s*/i, ""));
  return m ? m[1].length : 0;
}

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

const REL_CHARS: Record<string, RelOp> = { "=": "=", "<": "<", ">": ">", "≤": "<=", "≥": ">=", "≠": "!=" };

/** Splits at relation signs outside brackets. */
function splitRelational(s: string): { parts: string[]; ops: RelOp[] } {
  const parts: string[] = [];
  const ops: RelOp[] = [];
  let depth = 0;
  let cur = "";
  for (const c of s) {
    if ("([{".includes(c)) depth += 1;
    else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
    if (depth === 0 && REL_CHARS[c]) {
      parts.push(cur);
      ops.push(REL_CHARS[c]);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return { parts, ops };
}

/** "-1 < x ≤ 4" as its expressions and the signs between them. Null if any part is unreadable. */
export function parseChain(source: string): Chain | null {
  const s = normalizeMath(source);
  const { parts, ops } = splitRelational(s);
  if (!ops.length) return null;
  const exprs: Node[] = [];
  for (const p of parts) {
    if (!p.trim()) return null;
    const n = tryParseExpr(p);
    if (!n) return null;
    exprs.push(n);
  }
  return { exprs, ops };
}

/** A single relation, lhs op rhs. Null for a chain, a bare expression or anything unreadable. */
export function parseRelation(source: string): Relation | null {
  const c = parseChain(source);
  if (!c || c.ops.length !== 1) return null;
  return { lhs: c.exprs[0], rhs: c.exprs[1], op: c.ops[0] };
}

/** Does lhs op rhs hold, with equality judged within a tolerance? Null on a domain error. */
export function holds(op: RelOp, l: number, r: number, tol = 1e-9): boolean | null {
  if (!Number.isFinite(l) || !Number.isFinite(r)) return null;
  const eq = close(l, r, tol);
  switch (op) {
    case "=":
      return eq;
    case "!=":
      return !eq;
    case "<":
      return l < r && !eq;
    case "<=":
      return l < r || eq;
    case ">":
      return l > r && !eq;
    case ">=":
      return l > r || eq;
  }
}

export function relationHolds(rel: Relation, env: Env, tol = 1e-9): boolean | null {
  return holds(rel.op, evalSafe(rel.lhs, env), evalSafe(rel.rhs, env), tol);
}

/** lhs - rhs, with the size of the two sides for a relative tolerance. */
export function residual(rel: Relation, env: Env): { g: number; scale: number } {
  const l = evalSafe(rel.lhs, env);
  const r = evalSafe(rel.rhs, env);
  return { g: l - r, scale: Math.max(1, Math.abs(l), Math.abs(r)) };
}

// ---------------------------------------------------------------------------
// Equivalence by sampling
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample points for a set of variables: a mix of signed and positive values, never a whole number. */
export function* samplePoints(vars: string[], count = 60, seed = 20260930): Generator<Env> {
  const rand = mulberry32(seed);
  for (let k = 0; k < count; k += 1) {
    const env: Env = {};
    for (const v of vars) env[v] = k % 2 === 0 ? 0.05 + rand() * 5.9 : rand() * 9 - 4.5;
    yield env;
  }
}

function toNode(x: string | Node): Node | null {
  return typeof x === "string" ? tryParseExpr(x) : x;
}

/**
 * Are two expressions equal for every value of their variables? Checked at
 * sample points, skipping points where either side is undefined (so √x · √x
 * and x agree), and requiring at least five points where both are defined.
 */
export function equivalentExpr(a: string | Node, b: string | Node, vars?: string[]): boolean {
  const A = toNode(a);
  const B = toNode(b);
  if (!A || !B) return false;
  const names = Array.from(new Set([...(vars ?? []), ...variablesOf(A), ...variablesOf(B)])).sort();
  let valid = 0;
  for (const env of samplePoints(names, 80)) {
    const x = evalSafe(A, env);
    const y = evalSafe(B, env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!close(x, y, 1e-6)) return false;
    valid += 1;
    if (valid >= 10) break;
  }
  return valid >= 5;
}

/**
 * Do two equations have the same solutions, as in y = 2x + 1 and
 * 2x - y = -1? True when (lhs - rhs) of one is a constant, nonzero multiple
 * of the other's at every sample point.
 */
export function sameZeroSet(f: Node, g: Node): boolean {
  const names = Array.from(new Set([...variablesOf(f), ...variablesOf(g)])).sort();
  let ratio: number | null = null;
  let valid = 0;
  for (const env of samplePoints(names, 80, 77)) {
    const x = evalSafe(f, env);
    const y = evalSafe(g, env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) continue;
    if (Math.abs(y) < 1e-12 || Math.abs(x) < 1e-12) return false;
    const r = x / y;
    if (ratio === null) ratio = r;
    else if (!close(r, ratio, 1e-6)) return false;
    valid += 1;
    if (valid >= 10) break;
  }
  return valid >= 5 && ratio !== null && ratio !== 0;
}

export function difference(rel: { lhs: Node; rhs: Node }): Node {
  return bin("-", rel.lhs, rel.rhs);
}

// ---------------------------------------------------------------------------
// Real roots by scanning
// ---------------------------------------------------------------------------

export interface RootScan {
  roots: number[];
  /** Places where the sign changes across a break, such as x = 0 in 1/x. */
  poles: number[];
  /** True when both sides agree everywhere they are defined. */
  identity: boolean;
}

/**
 * Real solutions of lhs = rhs in one variable, found by scanning [-100, 100]
 * finely and out to ±10000 coarsely: a sign change is narrowed by bisection,
 * and a dip that touches zero without crossing (a double root) by golden
 * section search. A sign change that does not land on zero is a break, not
 * a root.
 */
export function scanRoots(rel: { lhs: Node; rhs: Node }, v: string): RootScan {
  const at = (x: number) => residual({ lhs: rel.lhs, rhs: rel.rhs, op: "=" }, { [v]: x });

  let defined = 0;
  let zero = 0;
  for (const env of samplePoints([v], 30, 5)) {
    const { g, scale } = at(env[v]);
    if (!Number.isFinite(g)) continue;
    defined += 1;
    if (Math.abs(g) <= 1e-9 * scale) zero += 1;
  }
  if (defined >= 5 && zero === defined) return { roots: [], poles: [], identity: true };

  const xs: number[] = [];
  for (let k = -10000; k < -100; k += 1) xs.push(k + 0.5);
  for (let k = -10000; k <= 10000; k += 1) xs.push(k / 100);
  for (let k = 101; k <= 10000; k += 1) xs.push(k - 0.5);
  const gs = xs.map((x) => {
    const { g, scale } = at(x);
    return Number.isFinite(g) ? { g, scale } : null;
  });

  const roots: number[] = [];
  const poles: number[] = [];
  const add = (list: number[], x: number) => {
    if (!list.some((r) => Math.abs(r - x) <= 1e-7 * Math.max(1, Math.abs(x)))) list.push(x);
  };

  for (let k = 0; k < xs.length; k += 1) {
    const cur = gs[k];
    if (cur && Math.abs(cur.g) <= 1e-12 * cur.scale) add(roots, xs[k]);
  }

  for (let k = 0; k + 1 < xs.length && roots.length + poles.length < 40; k += 1) {
    const p = gs[k];
    const q = gs[k + 1];
    if (!p || !q || p.g === 0 || q.g === 0 || Math.sign(p.g) === Math.sign(q.g)) continue;
    let lo = xs[k];
    let hi = xs[k + 1];
    let glo = p.g;
    let broke = false;
    for (let it = 0; it < 80; it += 1) {
      const mid = (lo + hi) / 2;
      const m = at(mid);
      if (!Number.isFinite(m.g)) {
        broke = true;
        break;
      }
      if (m.g === 0) {
        lo = hi = mid;
        break;
      }
      if (Math.sign(m.g) === Math.sign(glo)) {
        lo = mid;
        glo = m.g;
      } else hi = mid;
    }
    const c = (lo + hi) / 2;
    const end = at(c);
    if (!broke && Number.isFinite(end.g) && Math.abs(end.g) <= 1e-6 * end.scale) add(roots, c);
    else add(poles, c);
  }

  // Touching zero without crossing: x^2 - 4x + 4 = 0 between grid points.
  let dips = 0;
  for (let k = 1; k + 1 < xs.length && dips < 60; k += 1) {
    const a = gs[k - 1];
    const b = gs[k];
    const c = gs[k + 1];
    if (!a || !b || !c) continue;
    if (!(Math.abs(b.g) < Math.abs(a.g) && Math.abs(b.g) <= Math.abs(c.g))) continue;
    if (Math.sign(a.g) !== Math.sign(b.g) || Math.sign(b.g) !== Math.sign(c.g)) continue;
    dips += 1;
    let lo = xs[k - 1];
    let hi = xs[k + 1];
    const phi = (Math.sqrt(5) - 1) / 2;
    const f = (x: number) => {
      const r = at(x);
      return Number.isFinite(r.g) ? Math.abs(r.g) : Infinity;
    };
    for (let it = 0; it < 90; it += 1) {
      const x1 = hi - phi * (hi - lo);
      const x2 = lo + phi * (hi - lo);
      if (f(x1) < f(x2)) hi = x2;
      else lo = x1;
    }
    const m = (lo + hi) / 2;
    const r = at(m);
    if (Number.isFinite(r.g) && Math.abs(r.g) <= 1e-9 * r.scale) add(roots, m);
  }

  roots.sort((a, b) => a - b);
  poles.sort((a, b) => a - b);
  return { roots, poles, identity: false };
}

/**
 * Is x a solution of lhs = rhs? Exactly, within a relative 1e-6, or, for a
 * decimal typed to `decimals` places, when a true solution rounds to it.
 */
export function solvesEquation(rel: { lhs: Node; rhs: Node }, v: string, x: number, decimals = 0): boolean {
  const at = (t: number) => residual({ lhs: rel.lhs, rhs: rel.rhs, op: "=" }, { [v]: t });
  const r = at(x);
  if (!Number.isFinite(r.g)) return false;
  if (Math.abs(r.g) <= 1e-6 * r.scale) return true;
  if (decimals < 1) return false;
  const h = 0.5 * Math.pow(10, -decimals) * (1 + 1e-9);
  const a = at(x - h);
  const b = at(x + h);
  if (Number.isFinite(a.g) && Number.isFinite(b.g) && Math.sign(a.g) !== Math.sign(b.g)) {
    // A sign change inside the rounding window. Make sure it is a root and not a break.
    let lo = x - h;
    let hi = x + h;
    let glo = a.g;
    for (let it = 0; it < 70; it += 1) {
      const mid = (lo + hi) / 2;
      const m = at(mid);
      if (!Number.isFinite(m.g)) return false;
      if (Math.sign(m.g) === Math.sign(glo)) {
        lo = mid;
        glo = m.g;
      } else hi = mid;
    }
    const end = at((lo + hi) / 2);
    return Number.isFinite(end.g) && Math.abs(end.g) <= 1e-6 * end.scale;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

export interface Interval {
  lo: number;
  hi: number;
  loIn: boolean;
  hiIn: boolean;
}

const ALL: Interval = { lo: -Infinity, hi: Infinity, loIn: false, hiIn: false };

/** Sorted, merged, empty pieces dropped. */
export function normalizeIntervals(list: Interval[]): Interval[] {
  const pieces = list
    .map((iv) => ({
      lo: iv.lo,
      hi: iv.hi,
      loIn: Number.isFinite(iv.lo) && iv.loIn,
      hiIn: Number.isFinite(iv.hi) && iv.hiIn,
    }))
    .filter((iv) => iv.lo < iv.hi || (iv.lo === iv.hi && iv.loIn && iv.hiIn))
    .sort((a, b) => a.lo - b.lo || Number(b.loIn) - Number(a.loIn));
  const out: Interval[] = [];
  for (const iv of pieces) {
    const last = out[out.length - 1];
    if (last && (iv.lo < last.hi || (iv.lo === last.hi && (last.hiIn || iv.loIn)))) {
      if (iv.hi > last.hi || (iv.hi === last.hi && iv.hiIn)) {
        last.hi = iv.hi;
        last.hiIn = iv.hiIn;
      }
    } else out.push({ ...iv });
  }
  return out;
}

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) {
    for (const y of b) {
      let lo = x.lo;
      let loIn = x.loIn;
      if (y.lo > lo || (y.lo === lo && !y.loIn)) {
        lo = y.lo;
        loIn = y.lo === x.lo ? x.loIn && y.loIn : y.loIn;
      }
      let hi = x.hi;
      let hiIn = x.hiIn;
      if (y.hi < hi || (y.hi === hi && !y.hiIn)) {
        hi = y.hi;
        hiIn = y.hi === x.hi ? x.hiIn && y.hiIn : y.hiIn;
      }
      out.push({ lo, hi, loIn, hiIn });
    }
  }
  return normalizeIntervals(out);
}

export function inIntervals(x: number, list: Interval[]): boolean {
  return list.some((iv) => (x > iv.lo || (x === iv.lo && iv.loIn)) && (x < iv.hi || (x === iv.hi && iv.hiIn)));
}

function constraint(op: RelOp, c: number): Interval[] {
  switch (op) {
    case "<":
      return [{ lo: -Infinity, hi: c, loIn: false, hiIn: false }];
    case "<=":
      return [{ lo: -Infinity, hi: c, loIn: false, hiIn: true }];
    case ">":
      return [{ lo: c, hi: Infinity, loIn: false, hiIn: false }];
    case ">=":
      return [{ lo: c, hi: Infinity, loIn: true, hiIn: false }];
    case "!=":
      return normalizeIntervals([
        { lo: -Infinity, hi: c, loIn: false, hiIn: false },
        { lo: c, hi: Infinity, loIn: false, hiIn: false },
      ]);
    case "=":
      return [{ lo: c, hi: c, loIn: true, hiIn: true }];
  }
}

const FLIP: Record<RelOp, RelOp> = { "=": "=", "!=": "!=", "<": ">", ">": "<", "<=": ">=", ">=": "<=" };

// ---------------------------------------------------------------------------
// Reading a student's answer
// ---------------------------------------------------------------------------

export interface AnswerItem {
  value: number;
  /** Digits typed after the decimal point, for rounded answers. 0 for exact forms. */
  decimals: number;
}

export type AnswerSet =
  | { kind: "values"; values: number[]; items: AnswerItem[] }
  | { kind: "none" }
  | { kind: "all" }
  | { kind: "points"; points: number[][] }
  | { kind: "intervals"; intervals: Interval[]; decimals: number }
  | { kind: "expr"; expr: Node; of: string | null }
  | { kind: "equation"; lhs: Node; rhs: Node }
  | { kind: "complex" };

const NONE_RE =
  /^(?:[a-z]\s*=\s*)?(?:no\s+(?:real\s+)?(?:solutions?|roots?|answers?|values?|zeros?)|none|∅|\{\s*\}|(?:the\s+)?(?:empty|null)\s+set|there\s+(?:is|are)\s+no\s+(?:real\s+)?solutions?|it\s+has\s+no\s+solutions?|inconsistent(?:\s+system)?)$/;
const ALL_RE =
  /^(?:[a-z]\s*(?:=|∈|is|can\s+be)\s*)?(?:all\s+real(?:\s+numbers)?|all\s+reals|every\s+real\s+number|any\s+real\s+number|any\s+number|all\s+numbers|infinitely\s+many(?:\s+solutions)?|infinite(?:ly\s+many)?\s+solutions|an?\s+identity|identity|ℝ|\(\s*-\s*∞\s*,\s*∞\s*\)|-\s*∞\s*<\s*[a-z]\s*<\s*∞|dependent(?:\s+system)?|true\s+for\s+all(?:\s+[a-z])?(?:\s+values)?)$/;

/** Splits on separators that sit outside brackets. */
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
  return out.map((x) => x.trim()).filter((x) => x.length > 0);
}

const LIST_SEP = /\s*(?:,|;|&|\bor\b|\band\b)\s*/;

function stripBraces(s: string): string {
  const t = s.trim();
  if (/^\{.*\}$/.test(t)) {
    let depth = 0;
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] === "{") depth += 1;
      else if (t[i] === "}") {
        depth -= 1;
        if (depth === 0 && i < t.length - 1) return t;
      }
    }
    return t.slice(1, -1).trim();
  }
  return t;
}

/** Values from "4", "-2", "3/4", "±2", "(3 ± √5)/2". Null if not a constant. */
function itemValues(text: string): AnswerItem[] | null {
  const s = text.trim();
  if (!s) return null;
  if (s.includes("±")) {
    const plus = constValue(s.replace(/±/g, "+"));
    const minus = constValue(s.replace(/±/g, "-"));
    if (plus === null || minus === null || !Number.isFinite(plus) || !Number.isFinite(minus)) return null;
    return [
      { value: minus, decimals: 0 },
      { value: plus, decimals: 0 },
    ];
  }
  const v = constValue(s);
  if (v === null || !Number.isFinite(v)) return null;
  return [{ value: v, decimals: decimalsOf(s) }];
}

function uniqueSorted(items: AnswerItem[]): number[] {
  const out: number[] = [];
  for (const v of items.map((i) => i.value).sort((a, b) => a - b)) {
    if (!out.some((u) => close(u, v, 1e-9))) out.push(v);
  }
  return out;
}

function parseIntervalNotation(s: string): AnswerSet | null {
  const parts = splitTop(s, /\s*(?:∪|\bu\b|\bor\b)\s*/);
  const list: Interval[] = [];
  let decimals = 0;
  for (const part of parts) {
    const m = /^([[(])\s*(.+?)\s*,\s*(.+?)\s*([\])])$/.exec(part);
    if (!m) return null;
    const lo = constValue(m[2]);
    const hi = constValue(m[3]);
    if (lo === null || hi === null || lo > hi) return null;
    decimals = Math.max(decimals, decimalsOf(m[2]), decimalsOf(m[3]));
    list.push({ lo, hi, loIn: m[1] === "[", hiIn: m[4] === "]" });
  }
  return { kind: "intervals", intervals: normalizeIntervals(list), decimals };
}

/** "x > 2", "2 < x", "-1 < x ≤ 4", "x < -1 or x > 3", "x ≠ 3". */
function parseInequalityAnswer(s: string): AnswerSet | null {
  let union: Interval[] = [];
  let decimals = 0;
  let varName: string | null = null;
  for (const orPart of splitTop(s, /\s*(?:\bor\b|∪)\s*/)) {
    let set: Interval[] = [ALL];
    for (const part of splitTop(orPart, /\s*(?:\band\b|,|&)\s*/)) {
      const { parts, ops } = splitRelational(normalizeMath(part));
      if (!ops.length || ops.includes("=")) return null;
      const nodes = parts.map((p) => tryParseExpr(p));
      if (nodes.some((n) => !n)) return null;
      const idx = nodes.findIndex((n) => n!.t === "var");
      if (idx < 0 || nodes.some((n, k) => k !== idx && !isConstant(n!))) return null;
      const name = (nodes[idx] as { t: "var"; name: string }).name;
      if (varName && varName !== name) return null;
      varName = name;
      for (let k = 0; k < ops.length; k += 1) {
        if (k !== idx && k + 1 !== idx) continue;
        const otherIdx = k === idx ? k + 1 : k;
        const c = evalSafe(nodes[otherIdx]!);
        if (Number.isNaN(c)) return null;
        decimals = Math.max(decimals, decimalsOf(parts[otherIdx]));
        const op = k === idx ? ops[k] : FLIP[ops[k]];
        set = intersectIntervals(set, constraint(op, c));
      }
    }
    union = normalizeIntervals([...union, ...set]);
  }
  return { kind: "intervals", intervals: union, decimals };
}

function parsePoints(s: string): AnswerSet | null {
  const parts = splitTop(stripBraces(s), LIST_SEP);
  const points: number[][] = [];
  for (const part of parts) {
    const m = /^\((.*)\)$/.exec(part);
    if (!m) return null;
    const coords = splitTop(m[1], /\s*,\s*/);
    if (coords.length < 2 || coords.length > 3) return null;
    const vals = coords.map((c) => constValue(c));
    if (vals.some((v) => v === null || !Number.isFinite(v))) return null;
    points.push(vals as number[]);
  }
  return points.length ? { kind: "points", points } : null;
}

export interface AnswerOptions {
  /** Read "(2, 5)" as an open interval instead of a point. */
  prefer?: "interval" | "point";
}

/**
 * Reads an answer the many ways a student writes one. Equivalent forms come
 * out equal: "x = 4", "4", "x=4.0" and "x = 8/2" are all {4}; "x = -2, 3",
 * "{3, -2}" and "x = 3 or x = -2" are all {-2, 3}; "x > 2" and "2 < x" are
 * the same interval. Null when nothing readable is there.
 */
export function parseAnswerSet(text: string, variable?: string | null, opts: AnswerOptions = {}): AnswerSet | null {
  let s = normalizeMath(text).toLowerCase();
  s = s.replace(/^(?:so|thus|therefore|hence)\s*,?\s*/, "");
  s = s.replace(/^(?:the\s+)?(?:final\s+)?(?:answer|solution|result)s?\s*(?:is|are|:|=)\s*/, "");
  s = s.replace(/\s*\((?:approx[a-z]*|rounded|exact|to the nearest)[^)]*\)\s*$/, "");
  s = s.replace(/\b(?:approximately|approx\.?|about|roughly)\s*/g, "");
  s = s.replace(/[.;!]+$/, "").trim();
  if (!s) return null;
  if (NONE_RE.test(s)) return { kind: "none" };
  if (ALL_RE.test(s)) return { kind: "all" };
  s = s.replace(/\b(?:infinity|inf)\b/g, "∞");
  // Thousands separators: "1,000" is one number, "{-2,3}" is two.
  s = s.replace(/(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?![\d,]|\.\d)/g, (_m, a: string, b: string) => a + b.replace(/,/g, ""));
  const v = (variable ?? "").toLowerCase();
  if (/(?<![a-z])i(?![a-z])/.test(s) && v !== "i") return { kind: "complex" };

  const looksInterval =
    /[∞∪]/.test(s) ||
    (/[[\]]/.test(s) && /^[[(][^()[\]]*,[^()[\]]*[\])]/.test(s)) ||
    (opts.prefer === "interval" && /^\(\s*[^(),]+,\s*[^(),]+\)$/.test(s));
  if (looksInterval) {
    const iv = parseIntervalNotation(s);
    if (iv) return iv;
  }

  if (/[<>≤≥≠]/.test(s)) return parseInequalityAnswer(s);

  if (/^\{?\s*\(/.test(s) && /,/.test(s)) {
    const pts = parsePoints(s);
    if (pts) return pts;
  }

  const items = splitTop(stripBraces(s), LIST_SEP);
  if (!items.length) return null;

  // "x = 2, y = -1": one number for each of two or more letters is a point.
  const assigned = items.map((it) => /^([a-z])(?:_?\d{1,3})?\s*=\s*([^=]+)$/.exec(it));
  if (assigned.every(Boolean)) {
    const letters = assigned.map((m) => m![1]);
    const distinct = new Set(letters);
    if (distinct.size >= 2 && distinct.size === letters.length) {
      const order = [...letters].sort();
      const coords = order.map((l) => constValue(assigned[letters.indexOf(l)]![2]));
      if (coords.every((c) => c !== null && Number.isFinite(c))) return { kind: "points", points: [coords as number[]] };
    }
  }

  const all: AnswerItem[] = [];
  let readable = true;
  for (const item of items) {
    // "x = 4", "x_1 = 4" and "f(4) = 29" all give the number on the right.
    const rhs = item.replace(/^[a-z](?:_?\d{1,3})?\s*=\s*/, "").replace(/^[a-z]\s*\([^()]*\)\s*=\s*/, "");
    if (/[=<>≤≥≠]/.test(rhs)) {
      readable = false;
      break;
    }
    const vals = itemValues(rhs);
    if (!vals) {
      readable = false;
      break;
    }
    all.push(...vals);
  }
  if (readable && all.length) return { kind: "values", values: uniqueSorted(all), items: all };

  // An expression, or an equation such as y = 3x - 2.
  if (items.length !== 1 && !/^[a-z]\s*=/.test(s)) return null;
  const whole = s;
  const rel = parseRelation(whole);
  if (rel) {
    if (rel.op !== "=") return null;
    if (rel.lhs.t === "var" && !isConstant(rel.rhs) && !variablesOf(rel.rhs).includes(rel.lhs.name)) {
      return { kind: "expr", expr: rel.rhs, of: rel.lhs.name };
    }
    if (rel.rhs.t === "var" && !isConstant(rel.lhs) && !variablesOf(rel.lhs).includes(rel.rhs.name)) {
      return { kind: "expr", expr: rel.lhs, of: rel.rhs.name };
    }
    const fx = /^([a-z])\s*\(\s*([a-z])\s*\)\s*=\s*(.+)$/.exec(whole);
    if (fx) {
      const body = tryParseExpr(fx[3]);
      if (body) return { kind: "expr", expr: body, of: fx[1] };
    }
    return { kind: "equation", lhs: rel.lhs, rhs: rel.rhs };
  }
  if (/[<>≤≥≠=]/.test(whole)) return null;
  const node = tryParseExpr(whole);
  if (!node) return null;
  if (isConstant(node)) {
    const val = evalSafe(node);
    return Number.isFinite(val) ? { kind: "values", values: [val], items: [{ value: val, decimals: 0 }] } : null;
  }
  return { kind: "expr", expr: node, of: null };
}

/** A typed value matches a reference: exactly, or as the reference correctly rounded to the places typed. */
export function valueMatches(typed: AnswerItem, reference: number): boolean {
  if (close(typed.value, reference, 1e-6)) return true;
  if (typed.decimals >= 2 && roundTo(reference, typed.decimals) === roundTo(typed.value, typed.decimals)) return true;
  return false;
}

function asIntervals(a: AnswerSet): Interval[] | null {
  if (a.kind === "intervals") return a.intervals;
  if (a.kind === "none") return [];
  if (a.kind === "all") return [ALL];
  return null;
}

function endpointsMatch(x: number, y: number, decimals: number): boolean {
  if (x === y) return true;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return valueMatches({ value: x, decimals }, y) || close(x, y, 1e-6);
}

/** Are two answers the same answer? Order-free for sets, ordered inside a point. */
export function sameAnswer(a: AnswerSet, b: AnswerSet): boolean {
  if (a.kind === "complex" || b.kind === "complex") return false;
  if (a.kind === "none" && b.kind === "none") return true;
  if (a.kind === "all" && b.kind === "all") return true;
  const ia = asIntervals(a);
  const ib = asIntervals(b);
  if (ia && ib && (a.kind === "intervals" || b.kind === "intervals")) {
    if (ia.length !== ib.length) return false;
    const dec = Math.max(a.kind === "intervals" ? a.decimals : 0, b.kind === "intervals" ? b.decimals : 0);
    return ia.every((x, k) => {
      const y = ib[k];
      return endpointsMatch(x.lo, y.lo, dec) && endpointsMatch(x.hi, y.hi, dec) && x.loIn === y.loIn && x.hiIn === y.hiIn;
    });
  }
  if (a.kind === "values" && b.kind === "values") {
    if (a.values.length !== b.values.length) return false;
    const typedA = a.values.map((v) => a.items.find((it) => close(it.value, v, 1e-9)) ?? { value: v, decimals: 0 });
    return typedA.every((it, k) => valueMatches(it, b.values[k]) || valueMatches(b.items.find((x) => close(x.value, b.values[k], 1e-9)) ?? { value: b.values[k], decimals: 0 }, it.value));
  }
  if (a.kind === "points" && b.kind === "points") {
    if (a.points.length !== b.points.length) return false;
    return a.points.every((p) => b.points.some((q) => q.length === p.length && q.every((c, k) => close(c, p[k], 1e-6))));
  }
  if (a.kind === "points" && b.kind === "values") return sameAnswer(b, a);
  if (a.kind === "values" && b.kind === "points") {
    // "2, -1" typed without the parentheses, for a system with one solution.
    if (b.points.length !== 1 || a.items.length !== b.points[0].length) return false;
    return a.items.every((it, k) => valueMatches(it, b.points[0][k]));
  }
  const eqOf = (x: AnswerSet): Node | null => {
    if (x.kind === "equation") return difference(x);
    if (x.kind === "expr" && x.of) return bin("-", { t: "var", name: x.of }, x.expr);
    return null;
  };
  if (a.kind === "expr" && b.kind === "expr" && (!a.of || !b.of || a.of === b.of)) return equivalentExpr(a.expr, b.expr);
  const fa = eqOf(a);
  const fb = eqOf(b);
  if (fa && fb) return sameZeroSet(fa, fb);
  return false;
}

/** Parses several answer texts and joins them into one answer: ["x = -2", "x = 3"] is {-2, 3}. */
export function mergeAnswerSets(texts: string[], variable?: string | null, opts: AnswerOptions = {}): AnswerSet | null {
  const sets = texts.map((t) => parseAnswerSet(t, variable, opts)).filter((x): x is AnswerSet => !!x);
  if (!sets.length) return null;
  if (sets.length === 1) return sets[0];
  if (sets.every((x) => x.kind === "values")) {
    const items = sets.flatMap((x) => (x as { items: AnswerItem[] }).items);
    return { kind: "values", values: uniqueSorted(items), items };
  }
  if (sets.every((x) => x.kind === "points")) {
    const points: number[][] = [];
    for (const p of sets.flatMap((x) => (x as { points: number[][] }).points)) {
      if (!points.some((q) => q.length === p.length && q.every((c, k) => close(c, p[k], 1e-9)))) points.push(p);
    }
    return { kind: "points", points };
  }
  if (sets.every((x) => asIntervals(x))) {
    return {
      kind: "intervals",
      intervals: normalizeIntervals(sets.flatMap((x) => asIntervals(x)!)),
      decimals: Math.max(...sets.map((x) => (x.kind === "intervals" ? x.decimals : 0))),
    };
  }
  return sets[0];
}

// ---------------------------------------------------------------------------
// Complex numbers, for Algebra 2 answers that use i
// ---------------------------------------------------------------------------

export interface Complex {
  re: number;
  im: number;
}

type CEnv = Record<string, number | Complex>;

const cx = (re: number, im = 0): Complex => ({ re, im });
const cadd = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
const csub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
const cmul = (a: Complex, b: Complex): Complex => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
function cdiv(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return cx(NaN, NaN);
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}
const isReal = (z: Complex) => Math.abs(z.im) <= 1e-12 * Math.max(1, Math.abs(z.re));

function csqrt(z: Complex): Complex {
  if (isReal(z)) return z.re >= 0 ? cx(Math.sqrt(z.re)) : cx(0, Math.sqrt(-z.re));
  const r = Math.hypot(z.re, z.im);
  const re = Math.sqrt((r + z.re) / 2);
  const im = Math.sign(z.im) * Math.sqrt((r - z.re) / 2);
  return cx(re, im);
}

function cpow(a: Complex, b: Complex): Complex {
  if (!isReal(b)) return cx(NaN, NaN);
  const n = b.re;
  if (Number.isInteger(n) && Math.abs(n) <= 64) {
    let out = cx(1);
    for (let k = 0; k < Math.abs(n); k += 1) out = cmul(out, a);
    return n < 0 ? cdiv(cx(1), out) : out;
  }
  if (isReal(a)) {
    const r = evalSafe({ t: "bin", op: "^", a: { t: "num", v: a.re }, b: { t: "num", v: n } });
    if (Number.isFinite(r)) return cx(r);
    if (a.re < 0 && Math.abs(n - 0.5) < 1e-12) return cx(0, Math.sqrt(-a.re));
  }
  return cx(NaN, NaN);
}

function realOnly(z: Complex, f: (x: number) => number): Complex {
  return isReal(z) ? cx(f(z.re)) : cx(NaN, NaN);
}

function evc(n: Node, env: CEnv): Complex {
  switch (n.t) {
    case "num":
      return cx(n.v);
    case "var": {
      if (Object.prototype.hasOwnProperty.call(env, n.name)) {
        const v = env[n.name];
        return typeof v === "number" ? cx(v) : v;
      }
      if (n.name === "i") return cx(0, 1);
      throw new MathEvalError(`unbound variable ${n.name}`);
    }
    case "neg": {
      const a = evc(n.a, env);
      return cx(-a.re, -a.im);
    }
    case "bin": {
      const a = evc(n.a, env);
      const b = evc(n.b, env);
      switch (n.op) {
        case "+":
          return cadd(a, b);
        case "-":
          return csub(a, b);
        case "*":
          return cmul(a, b);
        case "/":
          return cdiv(a, b);
        case "^":
          return cpow(a, b);
      }
      return cx(NaN, NaN);
    }
    case "fn": {
      const a = evc(n.a, env);
      switch (n.name) {
        case "sqrt":
          return csqrt(a);
        case "abs":
          return cx(Math.hypot(a.re, a.im));
        default:
          return realOnly(a, (x) => evalSafe({ t: "fn", name: n.name, a: { t: "num", v: x } }));
      }
    }
    case "root": {
      const k = evc(n.n, env);
      const a = evc(n.a, env);
      if (isReal(k) && k.re === 2) return csqrt(a);
      if (!isReal(k) || !isReal(a)) return cx(NaN, NaN);
      return cx(evalSafe({ t: "root", n: { t: "num", v: k.re }, a: { t: "num", v: a.re } }));
    }
    case "logb": {
      const base = evc(n.base, env);
      const a = evc(n.a, env);
      if (!isReal(base) || !isReal(a)) return cx(NaN, NaN);
      return cx(evalSafe({ t: "logb", base: { t: "num", v: base.re }, a: { t: "num", v: a.re } }));
    }
  }
}

/**
 * The value of an expression over the complex numbers, with i as the
 * imaginary unit unless env binds it. Null for anything undefined.
 */
export function evalComplex(expr: Node, env: CEnv = {}): Complex | null {
  try {
    const z = evc(expr, env);
    return Number.isFinite(z.re) && Number.isFinite(z.im) ? z : null;
  } catch {
    return null;
  }
}

export function closeComplex(a: Complex, b: Complex, tol = 1e-6): boolean {
  const scale = Math.max(1, Math.hypot(a.re, a.im), Math.hypot(b.re, b.im));
  return Math.hypot(a.re - b.re, a.im - b.im) <= tol * scale;
}

/**
 * Complex values from an answer: "11 - 10i", "x = ±3i", "x = 3i or x = -3i",
 * "{2 + i, 2 - i}". Null when any part is something other than a number
 * that may use i.
 */
export function parseComplexValues(text: string, variable?: string | null): Complex[] | null {
  let s = normalizeMath(text).toLowerCase();
  s = s.replace(/^(?:the\s+)?(?:final\s+)?(?:answer|solution|result)s?\s*(?:is|are|:|=)\s*/, "").replace(/[.;!]+$/, "").trim();
  if (!s || /[<>≤≥≠]/.test(s)) return null;
  const v = (variable ?? "").toLowerCase();
  const items = splitTop(stripBraces(s), LIST_SEP);
  if (!items.length) return null;
  const out: Complex[] = [];
  for (const raw of items) {
    const item = raw.replace(/^([a-hj-z])(?:_?\d{1,3})?\s*=\s*/, (m, letter: string) => (!v || letter === v ? "" : m));
    if (/=/.test(item)) return null;
    const variants = item.includes("±") ? [item.replace(/±/g, "+"), item.replace(/±/g, "-")] : [item];
    for (const t of variants) {
      const node = tryParseExpr(t);
      if (!node || variablesOf(node).some((x) => x !== "i")) return null;
      const z = evalComplex(node);
      if (!z) return null;
      out.push(z);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The math inside a problem statement
// ---------------------------------------------------------------------------

export interface ExtractedMath {
  /** Every run that holds a relation, as a chain (most have a single sign). */
  chains: { chain: Chain; text: string }[];
  /** Runs with no relation sign that read as an expression. */
  exprs: { node: Node; text: string }[];
  /** f(x) = ... definitions. */
  defs: { name: string; arg: string; body: Node }[];
  /** f(3) style calls with a constant argument. */
  calls: { name: string; arg: Node }[];
  /** True when "or" joins parts of the statement. */
  hasOr: boolean;
}

const FN_WORDS = ["infinity", "sqrt", "cbrt", "root", "abs", "log", "exp", "inf", "ln", "pi"];
const SHORT_WORDS = new Set([
  "of", "or", "if", "is", "in", "to", "be", "by", "an", "at", "do", "so", "no", "on", "up", "as", "it",
  "we", "he", "me", "my", "us", "am", "go", "oh", "ok", "hi",
]);

function mathyRun(run: string): boolean {
  if (run.length === 1) return true;
  const fnWord = FN_WORDS.find((w) => run.startsWith(w));
  if (fnWord) return run.length - fnWord.length <= 2;
  return run.length === 2 && !SHORT_WORDS.has(run);
}

function wordy(piece: string): boolean {
  const core = piece.replace(/[.,;:?!'"]+$/, "");
  if (!core) return true;
  // "10th term", "2nd", "1st": an ordinal is a word, not 10 times t times h.
  if (/^\(?\d+(?:st|nd|rd|th)\)?$/.test(core)) return true;
  if (/[^0-9a-z+\-*/^().,|√∛∜π∞=<>≤≥≠±_{}[\] ]/.test(core)) return true;
  return (core.match(/[a-z]+/g) ?? []).some((run) => !mathyRun(run));
}

function meaningful(text: string): boolean {
  if (!/[\d=<>≤≥≠+\-*/^√∛∜|]/.test(text) && !FN_WORDS.some((w) => text.includes(w))) return false;
  if (/^[-+]?\d+(?:\.\d+)?$/.test(text)) return false;
  return true;
}

/** Splits a statement into clauses: lines, sentences, colons, semicolons, commas outside brackets. */
function clauses(problem: string): string[] {
  const out: string[] = [];
  for (const rawLine of String(problem ?? "").split(/\n+/)) {
    let line = normalizeMath(rawLine).toLowerCase();
    line = line.replace(/^\s*(?:q\s*\d+[.:)]?|#\d+|\(?\d{1,2}[.)]|\(?[a-h]\))\s+/, "");
    line = line.replace(/(^|\s)\(?[a-h]\)(?=\s)/g, "$1;");
    let depth = 0;
    let cur = "";
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if ("([{".includes(c)) depth += 1;
      else if (")]}".includes(c)) depth = Math.max(0, depth - 1);
      const sentenceEnd = c === "." && !/\d/.test(line[i + 1] ?? "") && (i + 1 >= line.length || line[i + 1] === " ");
      if (depth === 0 && (";:?!,".includes(c) || sentenceEnd)) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    out.push(cur);
  }
  return out.map((c) => c.trim()).filter(Boolean);
}

/** The runs of math in one clause, with the words around them dropped. */
function mathRuns(clause: string): string[] {
  const pieces = clause.split(" ").filter(Boolean);
  const runs: string[][] = [];
  let cur: string[] = [];
  for (const p of pieces) {
    if (wordy(p)) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) runs.push(cur);
  return runs
    .map((r) => r.join(" ").replace(/[.,;:?!]+$/, "").trim())
    .filter((r) => r.length > 0 && !/^[a-z]$/.test(r) && meaningful(r));
}

/**
 * Pulls the math out of a problem statement: "Solve for x: 2x + 3 = 11"
 * gives the relation 2x + 3 = 11; "Factor completely: x^2 + 7x + 12" gives
 * the expression. Words, list markers and answer-choice letters are dropped.
 * Everything is lowercased, so variables compare as lowercase letters.
 */
export function extractMath(problem: string): ExtractedMath {
  const out: ExtractedMath = { chains: [], exprs: [], defs: [], calls: [], hasOr: /\bor\b/i.test(problem) };
  for (const clause of clauses(problem)) {
    for (const run of mathRuns(clause)) {
      const tries = [run];
      const lead = /^[a-z] (.+)$/.exec(run);
      if (lead) tries.push(lead[1]);
      for (const text of tries) {
        const def = /^([a-z])\s*\(\s*([a-z])\s*\)\s*=\s*([^=<>≤≥≠]+)$/.exec(text);
        if (def) {
          const body = tryParseExpr(def[3]);
          if (body) {
            out.defs.push({ name: def[1], arg: def[2], body });
            break;
          }
        }
        const call = /^([a-z])\s*\(\s*([^()]+)\s*\)$/.exec(text);
        if (call) {
          const arg = tryParseExpr(call[2]);
          if (arg && isConstant(arg)) {
            out.calls.push({ name: call[1], arg });
            break;
          }
        }
        if (/[=<>≤≥≠]/.test(text)) {
          const chain = parseChain(text);
          if (chain) {
            out.chains.push({ chain, text });
            break;
          }
          continue;
        }
        const node = tryParseExpr(text);
        if (node) {
          out.exprs.push({ node, text });
          break;
        }
      }
    }
  }
  // A call only counts when something defines it.
  out.calls = out.calls.filter((c) => out.defs.some((d) => d.name === c.name));
  return out;
}

/** Degree of a polynomial in v by finite differences, or null if it is not one (up to degree 8). */
export function polynomialDegree(n: Node, v: string): number | null {
  const others = variablesOf(n).filter((x) => x !== v);
  if (others.length) return null;
  let diffs: number[] = [];
  for (let k = 0; k <= 10; k += 1) {
    const y = evalSafe(n, { [v]: k * 0.75 - 3.1 });
    if (!Number.isFinite(y)) return null;
    diffs.push(y);
  }
  for (let d = 0; d <= 8; d += 1) {
    const scale = Math.max(1, ...diffs.map(Math.abs));
    if (diffs.every((x) => Math.abs(x) <= 1e-7 * scale)) return Math.max(0, d - 1);
    diffs = diffs.slice(1).map((x, k) => x - diffs[k]);
    if (diffs.length < 2) return null;
  }
  return null;
}

/** Plain-text form of a number, as a student would type it back. */
export function formatValue(x: number): string {
  if (!Number.isFinite(x)) return x > 0 ? "∞" : "-∞";
  if (Number.isInteger(x)) return String(x);
  for (let d = 2; d <= 12; d += 1) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) return `${n}/${d}`;
  }
  return String(Math.round(x * 1e6) / 1e6);
}
