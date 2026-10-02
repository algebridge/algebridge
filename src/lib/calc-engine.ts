/**
 * The maths behind AlgeBridge's own calculators (components/calc): a reader
 * for what a student types into a row, the layout that draws it the way a
 * math book does (x², √ with its bar, log₂, ³√), the edits the keys make, and
 * an evaluator for a whole list of rows, where a row can use the answer
 * above it (ans), any row's answer (ans_3), and letters and functions that
 * other rows define (a = 3, f(x) = x² + 1).
 *
 * Nothing here uses eval or Function: what a student types is read token by
 * token and turned into closures, so it never runs as code. Results are
 * shown with formatResult from lib/calculator.ts, so there is never an "e"
 * in a result: big and small numbers read 6.02×10^23, as on the keypad.
 *
 * The graphing calculator's maths is in lib/calc-graph.ts, built on this.
 */

import { CalcError, formatResult, power } from "./calculator";

export { CalcError };

/** An expression that is not finished yet ("3 +", "√()"): the row says nothing while it is being typed. */
export class Incomplete extends CalcError {}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type TokKind =
  | "num"
  | "var"
  | "const"
  | "fn"
  | "ans"
  | "op"
  | "caret"
  | "lp"
  | "rp"
  | "lb"
  | "rb"
  | "bar"
  | "comma"
  | "rel"
  | "bang"
  | "pct"
  | "under"
  | "sqrt"
  | "bad";

/** A token and the characters it came from, [s, e). A superscript digit ("x²") is `sup`. */
export interface Tok {
  k: TokKind;
  v: string;
  s: number;
  e: number;
  sup?: boolean;
}

/** sin^-1 means the inverse function; any other power of a function is a power of its value. */
const INVERTIBLE = new Set(["sin", "cos", "tan"]);
/** The function names a row understands. Every other letter is a variable of its own: ab is a times b. */
const FUNCTIONS = [
  "arcsin",
  "arccos",
  "arctan",
  "nthroot",
  "median",
  "floor",
  "round",
  "stdev",
  "sqrt",
  "ceil",
  "asin",
  "acos",
  "atan",
  "root",
  "mean",
  "sin",
  "cos",
  "tan",
  "csc",
  "sec",
  "cot",
  "exp",
  "abs",
  "min",
  "max",
  "mod",
  "log",
  "nCr",
  "nPr",
  "ncr",
  "npr",
  "gcd",
  "gcf",
  "lcm",
  "ln",
];
const WORDS = [...FUNCTIONS, "ans", "pi"].sort((a, b) => b.length - a.length);

const SINGLE: Record<string, [TokKind, string]> = {
  "+": ["op", "+"],
  "-": ["op", "-"],
  "−": ["op", "-"],
  "–": ["op", "-"],
  "*": ["op", "*"],
  "×": ["op", "*"],
  "·": ["op", "*"],
  "⋅": ["op", "*"],
  "∙": ["op", "*"],
  "/": ["op", "/"],
  "÷": ["op", "/"],
  "^": ["caret", "^"],
  "(": ["lp", "("],
  ")": ["rp", ")"],
  "[": ["lb", "["],
  "]": ["rb", "]"],
  "|": ["bar", "|"],
  ",": ["comma", ","],
  "!": ["bang", "!"],
  "%": ["pct", "%"],
  _: ["under", "_"],
  "√": ["sqrt", "√"],
  "π": ["const", "pi"],
  "=": ["rel", "="],
  "≤": ["rel", "<="],
  "≥": ["rel", ">="],
  "<": ["rel", "<"],
  ">": ["rel", ">"],
};

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "-",
};

const isDigit = (c: string | undefined) => !!c && c >= "0" && c <= "9";
const isLetter = (c: string | undefined) => !!c && /^[A-Za-z]$/.test(c);
const isSpace = (c: string | undefined) => c === " " || c === " " || c === "\t";

/** Whether a known word ("sin", "pi", "ans") starts anywhere in src[i, j). */
function hasWord(src: string, i: number, j: number): boolean {
  for (let p = i; p < j; p += 1) if (WORDS.some((w) => p + w.length <= j && src.startsWith(w, p))) return true;
  return false;
}

/** How a row is read. Scientific reads 5,280 as one number (thousands); Graphing reads it as a list. */
export interface Reading {
  thousands?: boolean;
}

export function tokenize(src: string, how: Reading = {}): Tok[] {
  const out: Tok[] = [];
  const n = src.length;
  const grouped = how.thousands && src.includes(",") ? thousandsCommas(src) : null;
  let i = 0;
  while (i < n) {
    const ch = src[i];
    if (isSpace(ch)) {
      i += 1;
      continue;
    }
    if (isDigit(ch) || ch === ".") {
      let j = i;
      while (j < n && (isDigit(src[j]) || src[j] === "." || grouped?.has(j))) j += 1;
      out.push({ k: "num", v: src.slice(i, j).replace(/,/g, ""), s: i, e: j });
      i = j;
      continue;
    }
    if (isLetter(ch)) {
      let j = i;
      while (j < n && isLetter(src[j])) j += 1;
      let p = i;
      // "20% of 50": of right after a percent means times.
      const last = out[out.length - 1];
      if (last?.k === "pct" && src.startsWith("of", i)) {
        out.push({ k: "op", v: "*", s: i, e: i + 2 });
        p = i + 2;
      }
      // Three or more letters with no known word in them, written like a
      // function (sum(...), average(...)), are a name this calculator does
      // not have: said so, instead of reading s times u times m.
      if (p === i && j - i >= 3 && src[j] === "(" && !hasWord(src, i, j)) {
        out.push({ k: "fn", v: src.slice(i, j), s: i, e: j });
        i = j;
        continue;
      }
      // A run of letters is read as known words where they fit ("sin",
      // "ans", "pi") and single-letter variables everywhere else.
      while (p < j) {
        const word = WORDS.find((w) => p + w.length <= j && src.startsWith(w, p));
        if (word) {
          const k: TokKind = word === "ans" ? "ans" : word === "pi" ? "const" : "fn";
          out.push({ k, v: word, s: p, e: p + word.length });
          p += word.length;
        } else {
          const c = src[p];
          out.push(c === "e" ? { k: "const", v: "e", s: p, e: p + 1 } : { k: "var", v: c, s: p, e: p + 1 });
          p += 1;
        }
      }
      i = j;
      continue;
    }
    if (ch in SUPERSCRIPT) {
      // "x²" pasted from elsewhere means x^2. The digits are already drawn
      // raised, so the layout leaves them alone.
      let j = i;
      while (j < n && src[j] in SUPERSCRIPT) j += 1;
      out.push({ k: "caret", v: "^", s: i, e: i, sup: true });
      let p = i;
      if (src[p] === "⁻") {
        out.push({ k: "op", v: "-", s: p, e: p + 1, sup: true });
        p += 1;
      }
      if (p < j) {
        const digits = [...src.slice(p, j)].map((c) => SUPERSCRIPT[c]).join("");
        out.push(/^\d+$/.test(digits) ? { k: "num", v: digits, s: p, e: j, sup: true } : { k: "bad", v: src.slice(p, j), s: p, e: j });
      }
      i = j;
      continue;
    }
    if ((ch === "<" || ch === ">") && src[i + 1] === "=") {
      out.push({ k: "rel", v: `${ch}=`, s: i, e: i + 2 });
      i += 2;
      continue;
    }
    const single = SINGLE[ch];
    out.push(single ? { k: single[0], v: single[1], s: i, e: i + 1 } : { k: "bad", v: ch, s: i, e: i + 1 });
    i += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

export type RelOp = "=" | "<" | "<=" | ">" | ">=";

export type Node = { s: number; e: number } & (
  | { k: "num"; v: number; raw: string }
  | { k: "var"; name: string }
  | { k: "const"; name: "pi" | "e" }
  | { k: "ans"; row: Node | null }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "post"; op: "!" | "%"; a: Node }
  | { k: "call"; name: string; args: Node[]; base: Node | null; pow: Node | null; inv: boolean }
  | { k: "apply"; name: string; args: Node[] }
  | { k: "sqrt"; a: Node }
  | { k: "abs"; a: Node }
  | { k: "group"; a: Node; open: number; close: number | null }
  | { k: "point"; x: Node; y: Node }
  | { k: "list"; items: Node[]; brackets: boolean }
  | { k: "hole" }
);

export type RowTree =
  | { kind: "empty" }
  | { kind: "expr"; node: Node }
  | { kind: "rel"; lhs: Node; op: RelOp; rhs: Node };

/**
 * How a row is drawn. A group is a run of characters drawn raised (sup),
 * lowered (sub), under a radical's bar (rad) or as a root's small index
 * (idx), or a stacked fraction (frac) made of its numerator (num) and
 * denominator (den). A `run` group is one that was never bracketed, "x^2"
 * rather than "x^(2)": it ends where its number or letter ends. Hidden
 * characters (the ^ itself, the / of a fraction, brackets that only mark a
 * group) take no room; `sign` marks the characters drawn as a radical sign.
 */
export interface Group {
  s: number;
  e: number;
  t: "sup" | "sub" | "rad" | "idx" | "frac" | "num" | "den";
  run: boolean;
  /** For a fraction and its two parts: where its / is, which ties them together. */
  bar?: number;
}

export interface Layout {
  groups: Group[];
  hidden: Set<number>;
  sign: Set<number>;
  /** Where a minus is a sign, not a subtraction: drawn without the spaces around it. */
  unary: Set<number>;
}

export interface ParsedRow {
  text: string;
  tokens: Tok[];
  tree: RowTree;
  errors: string[];
  layout: Layout;
}

interface Parens {
  items: Node[];
  open: number;
  close: number | null;
  commas: number[];
  s: number;
  e: number;
}

const isMinusOne = (n: Node) => n.k === "neg" && n.a.k === "num" && n.a.v === 1;

/**
 * A forgiving recursive-descent reader. Half-typed rows still read: a
 * missing number is a "hole" (drawn as an empty box where it is a group, an
 * Incomplete when evaluated) and an unclosed bracket closes itself at the
 * end, so the layout is always there to draw.
 *
 * Order of operations is the textbook one, with juxtaposition counted as
 * plain multiplication, left to right: 1/2x is (1/2)x, the way the line
 * reads, so y = 1/2x + 3 is the line with slope 1/2. -3^2 is -9.
 */
class Parser {
  t: Tok[];
  n: number;
  src: string;
  i = 0;
  /** How many | bars are open: inside one, a bar closes instead of starting another. */
  abs = 0;
  errors: string[] = [];
  lay: Layout = { groups: [], hidden: new Set(), sign: new Set(), unary: new Set() };

  constructor(t: Tok[], src: string) {
    this.t = t;
    this.n = src.length;
    this.src = src;
  }

  is(k: TokKind, v?: string): boolean {
    const c = this.t[this.i];
    return !!c && c.k === k && (v === undefined || c.v === v);
  }

  take(): Tok {
    return this.t[this.i++];
  }

  pos(): number {
    return this.t[this.i]?.s ?? this.n;
  }

  hole(): Node {
    const p = this.pos();
    return { k: "hole", s: p, e: p };
  }

  hide(s: number, e: number) {
    for (let j = s; j < e; j += 1) this.lay.hidden.add(j);
  }

  /** Records `x` as a raised, lowered or radical group, hiding the token that made it and any brackets that only mark it. */
  wrap(tok: Tok | null, x: Node, t: Group["t"]) {
    if (tok?.sup) return;
    if (tok) this.hide(tok.s, tok.e);
    if (x.k === "group") {
      this.lay.hidden.add(x.open);
      if (x.close !== null) this.lay.hidden.add(x.close);
      this.lay.groups.push({ s: x.open, e: x.close ?? x.e, t, run: false });
    } else {
      this.lay.groups.push({ s: x.s, e: x.e, t, run: true });
    }
  }

  /**
   * "5 280" is not 5 × 280: a space between two numbers is almost always a
   * number typed with a space in it (or a mixed number, 3 1/2), so it is
   * said, not worked out. A space that ends a power, a root or a fraction
   * ("x^2 3", made by the right arrow) is fine: it only leaves the group.
   */
  spacedNumbers() {
    const prev = this.t[this.i - 1];
    const next = this.t[this.i];
    if (!prev || !next || prev.k !== "num" || next.k !== "num" || prev.sup || next.sup || next.s === prev.e) return;
    if (this.lay.groups.some((g) => g.run && g.s < g.e && g.e === prev.e)) return;
    const over = this.t[this.i + 1];
    const den = this.t[this.i + 2];
    if (over?.k === "op" && over.v === "/" && den?.k === "num") {
      this.errors.push(`For a mixed number, write ${prev.v} + ${next.v}/${den.v}`);
    } else {
      this.errors.push(`Remove the space: ${prev.v}${next.v}`);
    }
  }

  /**
   * Records a/b as a fraction: a over b, the / hidden, and brackets that only
   * wrap one part hidden too, so (x+1)/(x-1) is drawn as a book prints it.
   * 1/2x is (1/2)x, as it is worked out, so it is drawn ½x. A leading minus
   * stays in front of the bar (−5/2): the same value either way.
   */
  fraction(a: Node, bar: Tok, b: Node) {
    let top = a;
    while (top.k === "neg" && this.lay.unary.has(top.s)) top = top.a;
    const part = (x: Node, t: "num" | "den"): Group => {
      if (x.k === "group" && x.s === x.open) {
        this.lay.hidden.add(x.open);
        if (x.close !== null) this.lay.hidden.add(x.close);
        return { s: x.open, e: x.close ?? x.e, t, run: false, bar: bar.s };
      }
      return { s: x.s, e: x.e, t, run: true, bar: bar.s };
    };
    const num = part(top, "num");
    const den = part(b, "den");
    this.lay.hidden.add(bar.s);
    this.lay.groups.push({ s: num.s, e: den.e, t: "frac", run: false, bar: bar.s }, num, den);
  }

  row(): RowTree {
    if (!this.t.length) return { kind: "empty" };
    const lhs = this.list();
    let tree: RowTree = { kind: "expr", node: lhs };
    if (this.is("rel")) {
      const op = this.take().v as RelOp;
      const rhs = this.list();
      tree = { kind: "rel", lhs, op, rhs };
      if (this.is("rel")) this.errors.push("Use one =, < or > at a time");
    }
    while (this.i < this.t.length) {
      const tok = this.take();
      if (tok.k === "rp" || tok.k === "rb") this.errors.push(`There is an extra ${tok.v}`);
      else if (tok.k === "bad") this.errors.push(`The calculator can't read "${tok.v}"`);
      else if (tok.k !== "rel") this.errors.push(`Something is missing before ${tok.v}`);
      // Whatever follows is still read, so it is still drawn properly.
      if (this.i < this.t.length) this.list();
    }
    return tree;
  }

  list(): Node {
    const first = this.expr();
    if (!this.is("comma")) return first;
    const items = [first];
    while (this.is("comma")) {
      this.i += 1;
      items.push(this.expr());
    }
    return { k: "list", items, brackets: false, s: first.s, e: items[items.length - 1].e };
  }

  expr(): Node {
    let a = this.term();
    while (this.is("op", "+") || this.is("op", "-")) {
      const op = this.take().v as "+" | "-";
      const b = this.term();
      a = { k: "bin", op, a, b, s: a.s, e: b.e };
    }
    return a;
  }

  term(): Node {
    let a = this.unary();
    for (;;) {
      if (this.is("op", "*") || this.is("op", "/")) {
        const tok = this.take();
        const op = tok.v as "*" | "/";
        const b = this.unary();
        // A typed / is drawn as a stacked fraction; the ÷ key stays a ÷.
        if (op === "/" && this.src[tok.s] === "/") this.fraction(a, tok, b);
        a = { k: "bin", op, a, b, s: a.s, e: b.e };
      } else if (this.startsValue()) {
        this.spacedNumbers();
        const b = this.power();
        a = { k: "bin", op: "*", a, b, s: a.s, e: b.e };
      } else {
        return a;
      }
    }
  }

  unary(): Node {
    if (this.is("op", "-") || this.is("op", "+")) {
      const tok = this.take();
      this.lay.unary.add(tok.s);
      const a = this.unary();
      return tok.v === "-" ? { k: "neg", a, s: tok.s, e: a.e } : { ...a, s: tok.s };
    }
    return this.power();
  }

  power(): Node {
    const base = this.post();
    if (!this.is("caret")) return base;
    const c = this.take();
    const ex = this.exponent();
    this.wrap(c, ex, "sup");
    return { k: "bin", op: "^", a: base, b: ex, s: base.s, e: Math.max(ex.e, c.e) };
  }

  /** What follows ^: a signed power, so 2^-3 and 2^3^2 (= 2^9) read the usual way. */
  exponent(): Node {
    if (this.is("op", "-") || this.is("op", "+")) {
      const tok = this.take();
      this.lay.unary.add(tok.s);
      const a = this.exponent();
      return tok.v === "-" ? { k: "neg", a, s: tok.s, e: a.e } : { ...a, s: tok.s };
    }
    return this.power();
  }

  post(): Node {
    let a = this.primary();
    while (this.is("bang") || this.is("pct")) {
      const tok = this.take();
      a = { k: "post", op: tok.v as "!" | "%", a, s: a.s, e: tok.e };
    }
    return a;
  }

  startsValue(): boolean {
    const c = this.t[this.i];
    if (!c) return false;
    switch (c.k) {
      case "num":
      case "var":
      case "const":
      case "ans":
      case "fn":
      case "lp":
      case "lb":
      case "sqrt":
        return true;
      case "bar":
        return this.abs === 0;
      default:
        return false;
    }
  }

  parens(): Parens {
    const o = this.take();
    const closer: TokKind = o.k === "lp" ? "rp" : "rb";
    const outerAbs = this.abs;
    this.abs = 0;
    const items: Node[] = [];
    const commas: number[] = [];
    if (!this.is(closer)) {
      items.push(this.expr());
      while (this.is("comma")) {
        commas.push(this.take().s);
        items.push(this.expr());
      }
    }
    this.abs = outerAbs;
    let close: number | null = null;
    let e = items.length ? items[items.length - 1].e : o.e;
    if (this.is(closer)) {
      const c = this.take();
      close = c.s;
      e = c.e;
    }
    return { items, open: o.s, close, commas, s: o.s, e };
  }

  /** A bracketed group: one value, a point (a, b), or a list. */
  group(): Node {
    const brackets = this.is("lb");
    const p = this.parens();
    if (brackets) return { k: "list", items: p.items, brackets: true, s: p.s, e: p.e };
    if (p.items.length <= 1) {
      const a: Node = p.items[0] ?? { k: "hole", s: p.open + 1, e: p.open + 1 };
      return { k: "group", a, open: p.open, close: p.close, s: p.s, e: p.e };
    }
    if (p.items.length === 2) return { k: "point", x: p.items[0], y: p.items[1], s: p.s, e: p.e };
    return { k: "list", items: p.items, brackets: false, s: p.s, e: p.e };
  }

  /** The small number after _ in log_2 or ans_3: one number or letter, or a bracketed group. */
  subscript(): Node {
    if (this.is("lp")) return this.group();
    const c = this.t[this.i];
    if (c && (c.k === "num" || c.k === "var" || c.k === "const")) return this.primary();
    return this.hole();
  }

  primary(): Node {
    const c = this.t[this.i];
    if (!c) return this.hole();
    switch (c.k) {
      case "num": {
        this.i += 1;
        const v = Number(c.v);
        if (Number.isNaN(v)) this.errors.push(c.v === "." ? "A decimal point needs a number" : `Too many decimal points in ${c.v}`);
        return { k: "num", v, raw: c.v, s: c.s, e: c.e };
      }
      case "const":
        this.i += 1;
        return { k: "const", name: c.v as "pi" | "e", s: c.s, e: c.e };
      case "var": {
        this.i += 1;
        const next = this.t[this.i];
        // f(2) right after a letter is a call when f is a function, and a
        // times 2 when a is a number: which one is known when it is worked out.
        if (next && next.k === "lp" && next.s === c.e) {
          const p = this.parens();
          return { k: "apply", name: c.v, args: p.items, s: c.s, e: p.e };
        }
        return { k: "var", name: c.v, s: c.s, e: c.e };
      }
      case "ans": {
        this.i += 1;
        let row: Node | null = null;
        let e = c.e;
        if (this.is("under")) {
          const u = this.take();
          row = this.subscript();
          this.wrap(u, row, "sub");
          e = Math.max(row.e, u.e);
        }
        return { k: "ans", row, s: c.s, e };
      }
      case "fn":
        return this.call();
      case "sqrt": {
        this.i += 1;
        this.lay.sign.add(c.s);
        const a = this.is("lp") ? this.group() : this.startsValue() ? this.post() : this.hole();
        this.wrap(null, a, "rad");
        return { k: "sqrt", a, s: c.s, e: Math.max(a.e, c.e) };
      }
      case "lp":
      case "lb":
        return this.group();
      case "bar": {
        this.i += 1;
        this.abs += 1;
        const a = this.expr();
        this.abs -= 1;
        let e = a.e;
        if (this.is("bar")) e = this.take().e;
        return { k: "abs", a, s: c.s, e };
      }
      default:
        return this.hole();
    }
  }

  call(): Node {
    const f = this.take();
    let pow: Node | null = null;
    let inv = false;
    let base: Node | null = null;
    if (this.is("caret")) {
      // sin^2(x) is (sin x)^2; sin^-1(x) is the inverse, as on a calculator.
      const c = this.take();
      const ex = this.exponent();
      this.wrap(c, ex, "sup");
      if (isMinusOne(ex) && INVERTIBLE.has(f.v)) inv = true;
      else pow = ex;
    }
    if (this.is("under")) {
      const u = this.take();
      base = this.subscript();
      this.wrap(u, base, "sub");
    }
    let args: Node[];
    let e: number;
    if (this.is("lp")) {
      const p = this.parens();
      args = p.items;
      e = p.e;
      if ((f.v === "root" || f.v === "nthroot") && p.commas.length >= 1) {
        // root(3, 8) is drawn ³√8: the name and brackets hide, the index is
        // small, and the comma is drawn as the radical sign.
        this.hide(f.s, f.e);
        this.lay.hidden.add(p.open);
        if (p.close !== null) this.lay.hidden.add(p.close);
        this.lay.groups.push({ s: p.open, e: p.commas[0], t: "idx", run: false });
        this.lay.sign.add(p.commas[0]);
        this.lay.groups.push({ s: p.commas[0] + 1, e: p.close ?? p.e, t: "rad", run: false });
      }
    } else {
      // No brackets: sin 30 and sin 2x take the product that follows.
      let a: Node = this.startsValue() && !this.is("fn") ? this.power() : this.hole();
      while (this.startsValue() && !this.is("fn")) {
        const b = this.power();
        a = { k: "bin", op: "*", a, b, s: a.s, e: b.e };
      }
      args = [a];
      e = a.e;
    }
    return { k: "call", name: f.v, args, base, pow, inv, s: f.s, e: Math.max(e, f.e) };
  }
}

export function parseRow(text: string, how: Reading = {}): ParsedRow {
  const tokens = tokenize(text, how);
  const p = new Parser(tokens, text);
  const tree = p.row();
  return { text, tokens, tree, errors: p.errors, layout: p.lay };
}

// ---------------------------------------------------------------------------
// Drawing a row
// ---------------------------------------------------------------------------

export type LayoutItem =
  | { t: "ch"; i: number }
  | { t: "grp"; g: Group; items: LayoutItem[]; empty: boolean };

/**
 * The row as a tree of characters and groups, in reading order. An empty
 * group (nothing visible inside) is where the empty box goes.
 */
export function layoutTree(n: number, lay: Layout): LayoutItem[] {
  // Outer groups first. Two with the same span (a fraction that is the
  // numerator of another) are nested in the order they were read: the
  // parser records an inner group before the one around it.
  const groups = lay.groups
    .map((g, k) => ({ g, k }))
    .filter(({ g }) => g.s >= 0 && g.s <= g.e && g.e <= n)
    .sort((a, b) => a.g.s - b.g.s || b.g.e - a.g.e || b.k - a.k)
    .map(({ g }) => g);
  const root: LayoutItem[] = [];
  const stack: { g: Group; items: LayoutItem[] }[] = [];
  const top = () => (stack.length ? stack[stack.length - 1].items : root);
  const visible = (items: LayoutItem[]): boolean =>
    items.some((it) => (it.t === "ch" ? !lay.hidden.has(it.i) : visible(it.items)));
  const pop = () => {
    const f = stack.pop()!;
    top().push({ t: "grp", g: f.g, items: f.items, empty: !visible(f.items) });
  };
  let gi = 0;
  for (let i = 0; i <= n; i += 1) {
    // An empty group where an open one ends is that group's last part: the
    // empty denominator of "1/", the empty power of "√(2^)".
    while (gi < groups.length && groups[gi].s === i && groups[gi].e === i && stack.length && stack[stack.length - 1].g.e === i) {
      top().push({ t: "grp", g: groups[gi++], items: [], empty: true });
    }
    while (stack.length && stack[stack.length - 1].g.e <= i) pop();
    while (gi < groups.length && groups[gi].s === i) {
      const g = groups[gi++];
      if (g.e === g.s) top().push({ t: "grp", g, items: [], empty: true });
      else stack.push({ g, items: [] });
    }
    if (i < n) top().push({ t: "ch", i });
  }
  while (stack.length) pop();
  return root;
}

export type CharKind = "num" | "var" | "const" | "fn" | "op" | "word" | "sign" | "rel" | "paren" | "punct" | "space" | "bad";

/** What each character is, for drawing it: variables italic, names upright, spaces around + and =. */
export function charKinds(p: ParsedRow): CharKind[] {
  const kinds: CharKind[] = Array.from({ length: p.text.length }, () => "space");
  for (const t of p.tokens) {
    let k: CharKind;
    switch (t.k) {
      case "num":
        k = "num";
        break;
      case "var":
        k = "var";
        break;
      case "const":
        k = t.v === "e" ? "var" : "const";
        break;
      case "fn":
      case "ans":
        k = "fn";
        break;
      case "op":
        k = t.e - t.s > 1 ? "word" : p.layout.unary.has(t.s) || t.sup ? "sign" : "op";
        break;
      case "rel":
        k = "rel";
        break;
      case "lp":
      case "rp":
      case "lb":
      case "rb":
      case "bar":
        k = "paren";
        break;
      case "bad":
        k = "bad";
        break;
      default:
        k = "punct";
    }
    for (let j = t.s; j < t.e; j += 1) kinds[j] = k;
  }
  return kinds;
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/** A row being edited: its text and selection. `start` is where the selection began, `end` where the caret is. */
export interface EditState {
  text: string;
  start: number;
  end: number;
}

const lo = (s: EditState) => Math.min(s.start, s.end);
const hi = (s: EditState) => Math.max(s.start, s.end);

/** Typed words that become their symbol, as they would in a math book. */
const REPLACE: [string, string][] = [
  ["sqrt", "√"],
  ["pi", "π"],
  ["<=", "≤"],
  [">=", "≥"],
];

/** A bracket closes itself when nothing follows it that it could wrap. */
const CLOSABLE_BEFORE = /^(|\s|[)\]+\-−*×·/÷=<>≤≥,^|!%])$/;
/** An operator typed on an empty row works on the answer above, as on a calculator. */
const OPERATOR_START = /^[+*/^×÷·]/;

export function insertText(st: EditState, raw: string, opts: { caret?: number; ansFirst?: boolean } = {}): EditState {
  let text = st.text;
  const a = lo(st);
  const b = hi(st);
  let s = raw;
  let caret = opts.caret ?? s.length;
  const next = text[b] ?? "";
  // Typing a closing bracket over one that is already there steps past it.
  if ((s === ")" || s === "]") && a === b && next === s) return { text, start: b + 1, end: b + 1 };
  if (s === "|" && a === b && next === "|" && (text.slice(0, b).split("|").length - 1) % 2 === 1) {
    return { text, start: b + 1, end: b + 1 };
  }
  if ((s === "(" || s === "[") && CLOSABLE_BEFORE.test(next)) {
    s = s === "(" ? "()" : "[]";
    caret = 1;
  }
  // / over a selection makes the selection the numerator.
  if (s === "/" && a < b) {
    s = `(${text.slice(a, b)})/`;
    caret = s.length;
  }
  if (opts.ansFirst && text.trim() === "" && OPERATOR_START.test(s)) {
    s = `ans${s}`;
    caret += 3;
  }
  text = text.slice(0, a) + s + text.slice(b);
  let pos = a + caret;
  for (const [word, sym] of REPLACE) {
    if (text.slice(0, pos).endsWith(word)) {
      text = text.slice(0, pos - word.length) + sym + text.slice(pos);
      pos += sym.length - word.length;
      break;
    }
  }
  return { text, start: pos, end: pos };
}

/** The text with the selection removed. */
export function cut(st: EditState): EditState {
  const a = lo(st);
  return { text: st.text.slice(0, a) + st.text.slice(hi(st)), start: a, end: a };
}

const WORD_KINDS = new Set<TokKind>(["fn", "ans", "const", "rel"]);
/** A token that is one word on screen: "sin", "ans", "<=", "of". The caret never stops inside it and backspace takes it whole. */
const isWord = (t: Tok) => t.e - t.s > 1 && (WORD_KINDS.has(t.k) || t.k === "op");

/** Where the caret may stop: never inside a word like "sin" or "ans", which go as one. */
export function caretStops(text: string): boolean[] {
  const stops = Array.from({ length: text.length + 1 }, () => true);
  for (const t of tokenize(text)) {
    if (isWord(t)) for (let j = t.s + 1; j < t.e; j += 1) stops[j] = false;
  }
  return stops;
}

/**
 * Backspace, as on a math keyboard: words like "sin" go in one press, an
 * empty pair of brackets goes together, a press just inside a radical or an
 * exponent takes the radical or exponent off and keeps what was in it, and a
 * press just after one steps inside it rather than deleting a bracket that is
 * not drawn.
 */
export function backspace(st: EditState, how: Reading = {}): EditState {
  if (st.start !== st.end) return cut(st);
  const { text } = st;
  const k = st.end;
  if (k <= 0) return st;
  const p = parseRow(text, how);
  const word = p.tokens.find((t) => isWord(t) && t.s < k && k <= t.e);
  if (word) return { text: text.slice(0, word.s) + text.slice(word.e), start: word.s, end: word.s };
  const c = k - 1;
  const { hidden, sign, groups } = p.layout;

  // Just inside a root's radicand: back into its index.
  if (sign.has(c) && text[c] === ",") return { text, start: c, end: c };

  // Fractions. The bar is drawn, not typed over: at the start of a
  // denominator a press goes to the end of the numerator. When one part is
  // empty, the press takes the bar away with that empty part.
  const isGap = (j: number) => hidden.has(j) || isSpace(text[j]);
  const shows = (from: number, to: number) => {
    for (let j = from; j < to; j += 1) if (!isGap(j)) return true;
    return false;
  };
  for (const f of groups) {
    if (f.t !== "frac" || f.bar === undefined) continue;
    const bar = f.bar;
    const num = groups.find((q) => q.t === "num" && q.bar === bar);
    const den = groups.find((q) => q.t === "den" && q.bar === bar);
    if (!num || !den) continue;
    if (k > bar && k <= Math.max(den.e, bar + 1) && !shows(bar, k)) {
      if (!shows(den.s, den.e)) {
        const end = den.e < text.length && hidden.has(den.e) && /[)\]]/.test(text[den.e]) ? den.e + 1 : Math.max(den.e, k);
        return { text: text.slice(0, bar) + text.slice(end), start: bar, end: bar };
      }
      if (!shows(num.s, num.e)) return { text: text.slice(0, num.s) + text.slice(bar + 1), start: num.s, end: num.s };
      return { text, start: bar, end: bar };
    }
    // Just inside a numerator's hidden bracket: taking the bracket would change what is divided.
    if (!num.run && c === num.s && hidden.has(c) && text[c] === "(" && text[k] !== ")") return { text, start: c, end: c };
  }

  // Just inside a bracketed group, or right after the ^ or √ that starts one.
  const g = groups.find(
    (g) =>
      !g.run &&
      g.t !== "frac" &&
      g.t !== "num" &&
      g.t !== "den" &&
      ((g.s === c && hidden.has(c)) || (g.s === c + 1 && hidden.has(c + 1) && (hidden.has(c) || sign.has(c))))
  );
  if (g) {
    const close = g.e < text.length && hidden.has(g.e) && /[)\]]/.test(text[g.e]) ? g.e : null;
    const after = close !== null ? text.slice(close + 1) : text.slice(g.e);
    if (g.t === "idx") {
      // root(3, 8) loses its index and becomes the 8 it was a root of.
      const root = p.tokens.find((t) => t.k === "fn" && t.e === g.s);
      const comma = text.indexOf(",", g.s);
      const radicand = groups.find((r) => r.t === "rad" && r.s === comma + 1);
      if (root && comma >= 0 && radicand) {
        const rClose = radicand.e < text.length && hidden.has(radicand.e) ? radicand.e : null;
        const rest = rClose !== null ? text.slice(rClose + 1) : text.slice(radicand.e);
        return { text: text.slice(0, root.s) + text.slice(comma + 1, radicand.e) + rest, start: root.s, end: root.s };
      }
    }
    const from = g.s === c ? (hidden.has(c - 1) || sign.has(c - 1) ? c - 1 : c) : c;
    return { text: text.slice(0, from) + text.slice(g.s + 1, close ?? g.e) + after, start: from, end: from };
  }

  // Just after a group's hidden closing bracket: step inside.
  if (hidden.has(c) && /[)\]]/.test(text[c])) return { text, start: c, end: c };

  // An empty pair of brackets goes together.
  const pair = text[c] + (text[k] ?? "");
  if (pair === "()" || pair === "[]" || pair === "||") return { text: text.slice(0, c) + text.slice(k + 1), start: c, end: c };

  return { text: text.slice(0, c) + text.slice(k), start: c, end: c };
}

export function deleteForward(st: EditState): EditState {
  if (st.start !== st.end) return cut(st);
  const { text } = st;
  const k = st.end;
  if (k >= text.length) return st;
  const word = tokenize(text).find((t) => isWord(t) && t.s <= k && k < t.e);
  if (word) return { text: text.slice(0, word.s) + text.slice(word.e), start: word.s, end: word.s };
  return { text: text.slice(0, k) + text.slice(k + 1), start: k, end: k };
}

/**
 * Right arrow at the very end of a row leaves the innermost thing the caret
 * is in, as math keyboards do: a raised exponent or an unclosed
 * bracket. Returns the text to append (a space ends "x^2" so the next digit
 * is not part of the exponent; ")" closes a bracket), or "" when there is
 * nothing to leave.
 */
export function exitAtEnd(text: string, how: Reading = {}): string {
  const p = parseRow(text, how);
  const n = text.length;
  const inner = p.layout.groups
    .filter((g) => g.e === n && g.s < n)
    .sort((a, b) => b.s - a.s)[0];
  if (inner?.run) return " ";
  let depth = 0;
  for (const t of p.tokens) {
    if (t.k === "lp" || t.k === "lb") depth += 1;
    else if ((t.k === "rp" || t.k === "rb") && depth > 0) depth -= 1;
  }
  if (depth > 0) {
    const opens: string[] = [];
    for (const t of p.tokens) {
      if (t.k === "lp" || t.k === "lb") opens.push(t.v);
      else if ((t.k === "rp" || t.k === "rb") && opens.length) opens.pop();
    }
    return opens[opens.length - 1] === "[" ? "]" : ")";
  }
  return "";
}

/** One step of the caret left or right (with Shift, the selection grows). */
export function stepCaret(st: EditState, dir: -1 | 1, extend: boolean, how: Reading = {}): EditState {
  const { text } = st;
  if (!extend && st.start !== st.end) {
    const k = dir < 0 ? lo(st) : hi(st);
    return { text, start: k, end: k };
  }
  let k = st.end;
  if (dir > 0 && k >= text.length) {
    if (extend) return st;
    const add = exitAtEnd(text, how);
    if (!add) return st;
    return { text: text + add, start: text.length + add.length, end: text.length + add.length };
  }
  if (dir < 0 && k <= 0) return extend ? st : { text, start: 0, end: 0 };
  const stops = caretStops(text);
  k += dir;
  while (k > 0 && k < text.length && !stops[k]) k += dir;
  return extend ? { text, start: st.start, end: k } : { text, start: k, end: k };
}

// ---------------------------------------------------------------------------
// Working things out
// ---------------------------------------------------------------------------

export type Fn2 = (x: number, y: number) => number;

/** A function a row defines: f(x) = x^2 + 1. */
export interface FuncDef {
  name: string;
  row: number;
  params: string[];
  body: Node;
}

export const LOOP_MESSAGE = "This uses itself in a loop";

const DEG = Math.PI / 180;

/** sin(180°) is 0, not 1.2×10^−16. */
const tidyTrig = (v: number) => (Math.abs(v) < 1e-14 ? 0 : v);

/** 0.1 + 0.2 − 0.3 is 0: a sum that cancels to rounding noise is zero. */
function tidySum(p: number, q: number): number {
  const r = p + q;
  return r !== 0 && Math.abs(r) < 4e-16 * Math.max(Math.abs(p), Math.abs(q)) ? 0 : r;
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** The gamma function (Lanczos), so 0.5! works as it does on a scientific calculator. */
export function gamma(z: number): number {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const x = z - 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < LANCZOS.length; i += 1) a += LANCZOS[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}

export function factorial(v: number): number {
  if (Number.isInteger(v)) {
    if (v < 0) return NaN;
    if (v > 170) return Infinity;
    let r = 1;
    for (let k = 2; k <= v; k += 1) r *= k;
    return r;
  }
  return gamma(v + 1);
}

/** Rounds half away from zero, to `places` decimal places. round(2.675, 2) is 2.68. */
export function roundTo(v: number, places = 0): number {
  const m = Math.pow(10, places);
  return (Math.sign(v) * Math.round(Number((Math.abs(v) * m).toPrecision(15)))) / m;
}

const NAME_OF: Record<string, string> = { asin: "arcsin", acos: "arccos", atan: "arctan", nthroot: "root", ncr: "nCr", npr: "nPr", gcf: "gcd" };
/** Functions of any number of numbers, which also take a list: mean(1, 2, 3) or mean([1, 2, 3]). */
const OF_LIST = new Set(["mean", "median", "stdev", "min", "max", "gcd", "lcm"]);

const gcd2 = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/** n choose r (or n permute r): whole numbers, worked out step by step so 52C5 stays exact. */
function choose(n: number, r: number, order: boolean): number {
  if (r > n) return 0;
  let v = 1;
  for (let k = 1; k <= r; k += 1) v = order ? v * (n - r + k) : (v * (n - r + k)) / k;
  return Math.round(v);
}
const SHOWN_AS: Record<string, string> = { arcsin: "sin⁻¹", arccos: "cos⁻¹", arctan: "tan⁻¹" };

/** Everything a compile needs from the rows around it. */
interface Env {
  strict: boolean;
  degrees: boolean;
  /** In Graphing, x and y are the graph's own variables. */
  graph: boolean;
  value(name: string): number | null;
  func(name: string): FuncDef | null;
  ans(row: Node | null): number;
  missing: Set<string>;
  uses: { x: boolean; y: boolean };
}

const check = (strict: boolean, ok: boolean, message: string) => {
  if (strict && !ok) throw new CalcError(message);
};

function compile(n: Node, env: Env, locals: Map<string, Fn2> | null, stack: string[]): Fn2 {
  const c = (m: Node) => compile(m, env, locals, stack);
  const { strict } = env;
  switch (n.k) {
    case "num": {
      const v = n.v;
      if (Number.isNaN(v)) throw new CalcError(n.raw === "." ? "A decimal point needs a number" : `Too many decimal points in ${n.raw}`);
      return () => v;
    }
    case "const": {
      const v = n.name === "pi" ? Math.PI : Math.E;
      return () => v;
    }
    case "var":
      return variable(n.name, env, locals);
    case "ans": {
      const v = env.ans(n.row);
      return () => v;
    }
    case "hole":
      throw new Incomplete("Finish the expression");
    case "neg": {
      const a = c(n.a);
      return (x, y) => -a(x, y);
    }
    case "group":
      return c(n.a);
    case "post": {
      const a = c(n.a);
      if (n.op === "%") return (x, y) => a(x, y) / 100;
      return (x, y) => {
        const v = a(x, y);
        const r = factorial(v);
        check(strict, !Number.isNaN(r), "! needs a whole number 0 or more");
        return r;
      };
    }
    case "bin": {
      const a = c(n.a);
      const b = c(n.b);
      switch (n.op) {
        case "+":
          return strict ? (x, y) => tidySum(a(x, y), b(x, y)) : (x, y) => a(x, y) + b(x, y);
        case "-":
          return strict ? (x, y) => tidySum(a(x, y), -b(x, y)) : (x, y) => a(x, y) - b(x, y);
        case "*":
          return (x, y) => a(x, y) * b(x, y);
        case "/":
          return strict
            ? (x, y) => {
                const d = b(x, y);
                if (d === 0) throw new CalcError("Can't divide by zero");
                return a(x, y) / d;
              }
            : (x, y) => a(x, y) / b(x, y);
        case "^":
          return (x, y) => {
            const p = a(x, y);
            const r = power(p, b(x, y));
            check(strict, !Number.isNaN(r) || Number.isNaN(p), "A negative number can't take that power");
            check(strict, !(p === 0 && r === Infinity), "Can't divide by zero");
            return r;
          };
      }
      break;
    }
    case "sqrt": {
      const a = c(n.a);
      return (x, y) => {
        const v = a(x, y);
        check(strict, !(v < 0), "Can't take √ of a negative number");
        return Math.sqrt(v);
      };
    }
    case "abs": {
      const a = c(n.a);
      return (x, y) => Math.abs(a(x, y));
    }
    case "call":
      return callFunction(n, env, c);
    case "apply": {
      const def = env.func(n.name);
      if (def) {
        if (stack.includes(def.name)) throw new CalcError(`${def.name} uses itself`);
        if (!n.args.length) throw new Incomplete("Finish the expression");
        if (n.args.length !== def.params.length) {
          throw new CalcError(`${def.name} takes ${def.params.length === 1 ? "one number" : `${def.params.length} numbers`}`);
        }
        const args = n.args.map(c);
        const inner = new Map<string, Fn2>();
        def.params.forEach((p, i) => inner.set(p, args[i]));
        return compile(def.body, env, inner, [...stack, def.name]);
      }
      // a(2) where a is a number is a times 2.
      if (!n.args.length) throw new Incomplete("Finish the expression");
      if (n.args.length > 1) throw new CalcError(`${n.name} is not a function`);
      const a = variable(n.name, env, locals);
      const b = c(n.args[0]);
      return (x, y) => a(x, y) * b(x, y);
    }
    case "point":
    case "list":
      throw new CalcError(env.graph ? "A point can't be used in a calculation" : "Points and lists work in Graphing");
  }
  throw new CalcError("Something went wrong");
}

function variable(name: string, env: Env, locals: Map<string, Fn2> | null): Fn2 {
  const local = locals?.get(name);
  if (local) return local;
  if (env.graph && name === "x") {
    env.uses.x = true;
    return (x) => x;
  }
  if (env.graph && name === "y") {
    env.uses.y = true;
    return (_x, y) => y;
  }
  const v = env.value(name);
  if (v !== null) return () => v;
  if (env.func(name)) throw new CalcError(`${name} is a function: write ${name}(2)`);
  env.missing.add(name);
  if (env.strict) throw new CalcError(`Give ${name} a value first, like ${name} = 3`);
  return () => NaN;
}

const ONE_NUMBER = new Set(["sin", "cos", "tan", "csc", "sec", "cot", "arcsin", "arccos", "arctan", "ln", "log", "exp", "abs", "sqrt", "floor", "ceil"]);

function callFunction(n: Extract<Node, { k: "call" }>, env: Env, c: (m: Node) => Fn2): Fn2 {
  const { strict, degrees } = env;
  let name = NAME_OF[n.name] ?? n.name;
  if (n.inv) name = `arc${name}`;
  const shown = SHOWN_AS[name] ?? name;
  const nodes = OF_LIST.has(name) ? n.args.flatMap((a) => (a.k === "list" ? a.items : [a])) : n.args;
  if (nodes.some((a) => a.k === "hole") || !nodes.length) throw new Incomplete("Finish the expression");
  if (n.base && name !== "log") throw new CalcError(`Only log takes a small base number, like log₂(8)`);
  const args = nodes.map(c);
  const count = args.length;
  const needs = (ok: boolean, what: string) => {
    if (!ok) throw new CalcError(`${shown} takes ${what}`);
  };
  const toRad = degrees ? (v: number) => v * DEG : (v: number) => v;
  const fromRad = degrees ? (v: number) => v / DEG : (v: number) => v;

  let f: Fn2;
  if (ONE_NUMBER.has(name)) {
    needs(count === 1, "one number");
    const a = args[0];
    switch (name) {
      case "sin":
        f = (x, y) => tidyTrig(Math.sin(toRad(a(x, y))));
        break;
      case "cos":
        f = (x, y) => tidyTrig(Math.cos(toRad(a(x, y))));
        break;
      case "tan":
      case "sec":
      case "csc":
      case "cot":
        f = (x, y) => {
          const r = toRad(a(x, y));
          const s = tidyTrig(Math.sin(r));
          const co = tidyTrig(Math.cos(r));
          const den = name === "tan" || name === "sec" ? co : s;
          check(strict, den !== 0, "Undefined");
          if (den === 0) return NaN;
          return name === "tan" ? s / co : name === "sec" ? 1 / co : name === "csc" ? 1 / s : co / s;
        };
        break;
      case "arcsin":
      case "arccos":
        f = (x, y) => {
          const v = a(x, y);
          check(strict, !(Math.abs(v) > 1), `${shown} takes a number from −1 to 1`);
          return fromRad(name === "arcsin" ? Math.asin(v) : Math.acos(v));
        };
        break;
      case "arctan":
        f = (x, y) => fromRad(Math.atan(a(x, y)));
        break;
      case "ln":
      case "log": {
        const b = n.base ? c(n.base) : null;
        f = (x, y) => {
          const v = a(x, y);
          check(strict, !(v <= 0), `${shown} takes a number greater than 0`);
          if (!b) return name === "ln" ? Math.log(v) : Math.log10(v);
          const base = b(x, y);
          check(strict, base > 0 && base !== 1, "The base of a log is above 0 and not 1");
          return Math.log(v) / Math.log(base);
        };
        break;
      }
      case "exp":
        f = (x, y) => Math.exp(a(x, y));
        break;
      case "abs":
        f = (x, y) => Math.abs(a(x, y));
        break;
      case "sqrt":
        f = (x, y) => {
          const v = a(x, y);
          check(strict, !(v < 0), "Can't take √ of a negative number");
          return Math.sqrt(v);
        };
        break;
      case "floor":
        f = (x, y) => Math.floor(a(x, y));
        break;
      default:
        f = (x, y) => Math.ceil(a(x, y));
    }
  } else if (name === "round") {
    needs(count === 1 || count === 2, "a number, and how many decimal places if you like");
    const [a, p] = args;
    f = p
      ? (x, y) => {
          const places = p(x, y);
          check(strict, Number.isInteger(places) && places >= 0 && places <= 12, "round takes 0 to 12 decimal places");
          return roundTo(a(x, y), places);
        }
      : (x, y) => roundTo(a(x, y));
  } else if (name === "root") {
    needs(count === 2, "an index and a number, like root(3, 8)");
    const [i, a] = args;
    f = (x, y) => {
      const k = i(x, y);
      check(strict, k !== 0, "A root's index can't be 0");
      const r = power(a(x, y), 1 / k);
      check(strict, !Number.isNaN(r), "Can't take an even root of a negative number");
      return r;
    };
  } else if (name === "min" || name === "max") {
    needs(count >= 1, "one or more numbers");
    const pick = name === "min" ? Math.min : Math.max;
    f = (x, y) => pick(...args.map((a) => a(x, y)));
  } else if (name === "mean") {
    f = (x, y) => args.reduce((sum, a) => sum + a(x, y), 0) / count;
  } else if (name === "median") {
    f = (x, y) => {
      const v = args.map((a) => a(x, y)).sort((p, q) => p - q);
      const m = Math.floor(count / 2);
      return count % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
    };
  } else if (name === "stdev") {
    // The sample standard deviation (dividing by n − 1), as most statistics classes use.
    needs(count >= 2, "two or more numbers");
    f = (x, y) => {
      const v = args.map((a) => a(x, y));
      const mean = v.reduce((p, q) => p + q, 0) / count;
      return Math.sqrt(v.reduce((p, q) => p + (q - mean) ** 2, 0) / (count - 1));
    };
  } else if (name === "gcd" || name === "lcm") {
    needs(count >= 1, "whole numbers, like gcd(12, 18)");
    f = (x, y) => {
      const v = args.map((a) => a(x, y));
      check(strict, v.every(Number.isInteger), `${name} takes whole numbers, like ${name}(12, 18)`);
      if (name === "gcd") return v.reduce(gcd2);
      return v.reduce((p, q) => (p === 0 || q === 0 ? 0 : Math.abs(p * q) / gcd2(p, q)));
    };
  } else if (name === "nCr" || name === "nPr") {
    needs(count === 2, `two whole numbers, like ${name}(5, 2)`);
    const [a, b] = args;
    f = (x, y) => {
      const nn = a(x, y);
      const r = b(x, y);
      const ok = Number.isInteger(nn) && Number.isInteger(r) && nn >= 0 && r >= 0;
      check(strict, ok, `${name} takes two whole numbers, like ${name}(5, 2)`);
      return ok ? choose(nn, r, name === "nPr") : NaN;
    };
  } else if (name === "mod") {
    needs(count === 2, "two numbers, like mod(7, 3)");
    const [a, m] = args;
    f = (x, y) => {
      const d = m(x, y);
      check(strict, d !== 0, "Can't divide by zero");
      return ((a(x, y) % d) + d) % d;
    };
  } else {
    throw new CalcError(`${n.name} isn't on this calculator`);
  }
  if (n.pow) {
    const p = c(n.pow);
    const g = f;
    f = (x, y) => power(g(x, y), p(x, y));
  }
  return f;
}

/** A plain number as typed, which needs no "= 42" beside it. */
export const isLiteral = (n: Node) => n.k === "num" || (n.k === "neg" && n.a.k === "num");

export interface Compiled {
  fn: Fn2;
  uses: { x: boolean; y: boolean };
  missing: string[];
}

/**
 * A list of rows that can use each other: letters and functions defined in
 * one row work in every other row, in any order, and loops are caught.
 * Scientific and Graphing both use it; in Graphing, x and y belong to the
 * graph, so "x = 3" is a line, not a definition.
 */
export class Sheet {
  rows: ParsedRow[];
  graph: boolean;
  degrees: boolean;
  /** Which row defines each letter. */
  consts = new Map<string, number>();
  funcs = new Map<string, FuncDef>();
  /** Letters defined in more than one row, which none of those rows can use. */
  dup = new Set<string>();
  private values = new Map<number, number | CalcError>();
  private visiting = new Set<number>();

  constructor(texts: string[], opts: { graph: boolean; degrees: boolean }) {
    // Scientific reads 5,280 as a number; in Graphing a comma makes points and lists.
    this.rows = texts.map((t) => parseRow(t, { thousands: !opts.graph }));
    this.graph = opts.graph;
    this.degrees = opts.degrees;
    const seen = new Map<string, number>();
    const claim = (name: string, row: number) => {
      if (seen.has(name)) this.dup.add(name);
      else seen.set(name, row);
    };
    this.rows.forEach((p, i) => {
      if (p.errors.length || p.tree.kind !== "rel" || p.tree.op !== "=") return;
      const { lhs, rhs } = p.tree;
      if (lhs.k === "var" && !(this.graph && (lhs.name === "x" || lhs.name === "y"))) {
        claim(lhs.name, i);
        if (!this.consts.has(lhs.name)) this.consts.set(lhs.name, i);
      } else if (
        lhs.k === "apply" &&
        !(this.graph && (lhs.name === "x" || lhs.name === "y")) &&
        lhs.args.length > 0 &&
        lhs.args.every((a) => a.k === "var") &&
        new Set(lhs.args.map((a) => (a.k === "var" ? a.name : ""))).size === lhs.args.length
      ) {
        claim(lhs.name, i);
        if (!this.funcs.has(lhs.name)) this.funcs.set(lhs.name, {
          name: lhs.name,
          row: i,
          params: lhs.args.map((a) => (a.k === "var" ? a.name : "")),
          body: rhs,
        });
      }
    });
  }

  /** Row `i` defines a letter (a = 3). */
  definesConst(i: number): string | null {
    const t = this.rows[i]?.tree;
    return t && t.kind === "rel" && t.lhs.k === "var" && this.consts.get(t.lhs.name) === i ? t.lhs.name : null;
  }

  /** Row `i` defines a function (f(x) = x^2). */
  definesFunc(i: number): FuncDef | null {
    const t = this.rows[i]?.tree;
    if (!t || t.kind !== "rel" || t.lhs.k !== "apply") return null;
    const def = this.funcs.get(t.lhs.name);
    return def && def.row === i ? def : null;
  }

  private env(row: number, strict: boolean): Env {
    return {
      strict,
      degrees: this.degrees,
      graph: this.graph,
      missing: new Set(),
      uses: { x: false, y: false },
      value: (name) => this.constValue(name),
      func: (name) => {
        const def = this.funcs.get(name);
        if (def && this.dup.has(name)) throw new CalcError(`${name} is defined more than once`);
        return def ?? null;
      },
      ans: (node) => this.ans(row, node),
    };
  }

  /** Compiles `node` as part of row `row`. Strict (Scientific) throws at the first problem; Graphing collects missing letters instead. */
  compile(row: number, node: Node, opts: { strict?: boolean; locals?: Map<string, Fn2> } = {}): Compiled {
    const env = this.env(row, opts.strict ?? !this.graph);
    const fn = compile(node, env, opts.locals ?? null, []);
    // In the order they appear: y = mx + b offers m, then b.
    return { fn, uses: env.uses, missing: [...env.missing] };
  }

  private constValue(name: string): number | null {
    const row = this.consts.get(name);
    if (row === undefined) return null;
    if (this.dup.has(name)) throw new CalcError(`${name} is defined more than once`);
    try {
      return this.valueOf(row);
    } catch (e) {
      if (e instanceof CalcError && e.message === LOOP_MESSAGE) throw e;
      throw new CalcError(`${name} has no value yet`);
    }
  }

  private ans(row: number, node: Node | null): number {
    if (node) {
      const r = this.compile(row, node, { strict: true }).fn(NaN, NaN);
      if (!Number.isInteger(r) || r < 1 || r > this.rows.length) throw new CalcError(`There is no row ${formatResult(r)}`);
      if (r - 1 === row) throw new CalcError("A row can't use its own answer");
      try {
        return this.valueOf(r - 1);
      } catch {
        throw new CalcError(`Row ${r} has no answer yet`);
      }
    }
    for (let j = row - 1; j >= 0; j -= 1) {
      if (this.rows[j].tree.kind === "empty") continue;
      try {
        return this.valueOf(j);
      } catch {
        throw new CalcError("The row above has no answer yet");
      }
    }
    throw new CalcError("There is no answer above yet");
  }

  /**
   * The value of row `i`: its expression, or what it gives its letter.
   * Throws CalcError (Incomplete while a row is half typed).
   */
  valueOf(i: number): number {
    const cached = this.values.get(i);
    if (cached !== undefined) {
      if (cached instanceof CalcError) throw cached;
      return cached;
    }
    if (this.visiting.has(i)) throw new CalcError(LOOP_MESSAGE);
    this.visiting.add(i);
    try {
      const v = this.compute(i);
      this.values.set(i, v);
      return v;
    } catch (e) {
      const err = e instanceof CalcError ? e : new CalcError("Something went wrong");
      this.values.set(i, err);
      throw err;
    } finally {
      this.visiting.delete(i);
    }
  }

  private compute(i: number): number {
    const p = this.rows[i];
    if (p.errors.length) throw new CalcError(p.errors[0]);
    const t = p.tree;
    let node: Node;
    if (t.kind === "empty") throw new Incomplete("Empty row");
    if (t.kind === "expr") node = t.node;
    else if (this.definesConst(i)) node = t.rhs;
    else throw new CalcError("This row has no single value");
    const name = this.definesConst(i);
    if (name && this.dup.has(name)) throw new CalcError(`${name} is defined more than once`);
    if (node.k === "point" || node.k === "list") throw new CalcError(this.graph ? "A point is not a number" : "Points and lists work in Graphing");
    const c = this.compile(i, node);
    if (c.uses.x || c.uses.y) throw new CalcError(name ? `${name} can't depend on x or y` : "This depends on x or y");
    if (c.missing.length) throw new CalcError(`${c.missing.join(", ")} ${c.missing.length === 1 ? "has" : "have"} no value yet`);
    const v = c.fn(NaN, NaN);
    if (Number.isNaN(v)) throw new CalcError("Undefined");
    if (!Number.isFinite(v)) throw new CalcError("Too big to show");
    return v;
  }
}

// ---------------------------------------------------------------------------
// Scientific
// ---------------------------------------------------------------------------

export interface SciResult {
  kind: "empty" | "value" | "define" | "error";
  value?: number;
  /** The value as shown: 42, −12, 6.02×10^23. */
  text?: string;
  /** The value as a fraction ("5/2", "−1/3") when it is exactly one with a small bottom, for the fraction toggle. */
  fraction?: string;
  /** Whether "= value" is worth showing (not beside a number that is already just that number). */
  show?: boolean;
  error?: string;
  /** Half typed: the row shows nothing until it is finished. */
  incomplete?: boolean;
}

/**
 * The fraction a number is, by continued fractions: the first n/d with d up
 * to 10000 that matches it to within rounding (1e-12). 0.75 is 3/4, 1/3 is
 * 1/3; π has none. Whole numbers have none either: there is nothing to show.
 */
export function toFraction(v: number): { n: number; d: number } | null {
  if (!Number.isFinite(v) || Number.isInteger(v) || Math.abs(v) >= 1e12) return null;
  const a = Math.abs(v);
  const tol = 1e-12 * Math.max(1, a);
  let [h0, h1] = [0, 1];
  let [k0, k1] = [1, 0];
  let x = a;
  for (let step = 0; step < 40; step += 1) {
    const q = Math.floor(x);
    [h0, h1] = [h1, q * h1 + h0];
    [k0, k1] = [k1, q * k1 + k0];
    if (k1 > 10000) return null;
    if (Math.abs(a - h1 / k1) <= tol) return k1 === 1 ? null : { n: Math.sign(v) * h1, d: k1 };
    const rest = x - q;
    if (rest < 1e-15) return null;
    x = 1 / rest;
  }
  return null;
}

/** toFraction as the row shows it: 5/2, −1/3. */
export function fractionText(v: number): string | undefined {
  const f = toFraction(v);
  return f ? `${f.n < 0 ? "−" : ""}${Math.abs(f.n)}/${f.d}` : undefined;
}

const failure = (e: unknown): SciResult => ({
  kind: "error",
  error: e instanceof CalcError ? e.message : "Something went wrong",
  incomplete: e instanceof Incomplete,
});

/**
 * Commas that group thousands, as a word problem prints a number: 5,280 or
 * 1,000,000.5. Only outside brackets, where Scientific has no other use for
 * a comma (inside, they separate a function's numbers: round(2.675, 2)).
 * Scientific reads such a number whole (tokenize with `thousands`).
 */
export function thousandsCommas(text: string): Set<number> {
  const out = new Set<number>();
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth || !isDigit(ch) || isDigit(text[i - 1]) || text[i - 1] === "." || text[i - 1] === ",") continue;
    let j = i;
    while (isDigit(text[j])) j += 1;
    const commas: number[] = [];
    if (j - i <= 3) {
      while (text[j] === "," && isDigit(text[j + 1]) && isDigit(text[j + 2]) && isDigit(text[j + 3]) && !isDigit(text[j + 4])) {
        commas.push(j);
        j += 4;
      }
    }
    // 1,000,00 is not a number written with commas: none of its commas count.
    if (commas.length && text[j] !== ",") commas.forEach((k) => out.add(k));
    i = Math.max(i, j - 1);
  }
  return out;
}

/** Works out every row of the Scientific calculator. Degrees by default, as most school calculators are. */
export function evaluateScientific(texts: string[], degrees = true): SciResult[] {
  const sheet = new Sheet(texts, { graph: false, degrees });
  return sheet.rows.map((p, i): SciResult => {
    if (p.tree.kind === "empty" && !p.errors.length) return { kind: "empty" };
    if (p.errors.length) return { kind: "error", error: p.errors[0] };
    const t = p.tree;
    if (t.kind === "rel") {
      const named = t.op === "=" && (t.lhs.k === "var" || t.lhs.k === "apply") ? t.lhs.name : null;
      if (named && sheet.dup.has(named)) return { kind: "error", error: `${named} is defined more than once` };
      if (t.lhs.k === "const") return { kind: "error", error: `${t.lhs.name === "pi" ? "π" : "e"} already has a value. Pick another letter` };
      const def = sheet.definesFunc(i);
      if (def) {
        try {
          const locals = new Map<string, Fn2>(def.params.map((q) => [q, () => NaN]));
          sheet.compile(i, def.body, { locals });
          return { kind: "define" };
        } catch (e) {
          return failure(e);
        }
      }
      if (!sheet.definesConst(i)) {
        return {
          kind: "error",
          error: t.op === "=" ? "To give a letter a value, write it first, like a = 3" : "Comparisons with < and > work in Graphing",
        };
      }
    }
    try {
      const value = sheet.valueOf(i);
      const node = t.kind === "rel" ? t.rhs : t.kind === "expr" ? t.node : null;
      return { kind: "value", value, text: formatResult(value), fraction: fractionText(value), show: !!node && !isLiteral(node) };
    } catch (e) {
      return failure(e);
    }
  });
}
