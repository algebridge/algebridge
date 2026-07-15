// A small, safe arithmetic expression evaluator for the on-screen calculator.
// It intentionally does NOT use eval()/Function() — it tokenizes the input,
// converts it to Reverse Polish Notation with a shunting-yard algorithm, and
// evaluates that. This keeps kid-typed input from ever running as code.

export type CalcToken =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "unary"; value: "-" }
  | { type: "func"; value: "sqrt" }
  | { type: "const"; value: "pi" | "e" }
  | { type: "lparen" }
  | { type: "rparen" };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

/** Tokenize an expression string, inserting implicit-multiplication ops so that
 *  inputs like "2(3)", "2√9", "3π", or ")(" behave the way a kid expects. */
export function tokenize(input: string): CalcToken[] {
  const tokens: CalcToken[] = [];
  // Normalize the pretty math symbols the UI uses into plain ASCII operators.
  const s = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-") // U+2212 minus sign
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .trim();

  let i = 0;

  // Does an implicit "*" belong before the value we're about to read?
  const prevIsValue = (): boolean => {
    const p = tokens[tokens.length - 1];
    return !!p && (p.type === "num" || p.type === "const" || p.type === "rparen");
  };

  while (i < s.length) {
    const ch = s[i];

    if (ch === " ") {
      i += 1;
      continue;
    }

    // Numbers (with optional decimal point).
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dotCount = 0;
      while (j < s.length && /[0-9.]/.test(s[j])) {
        if (s[j] === ".") dotCount += 1;
        j += 1;
      }
      const raw = s.slice(i, j);
      if (dotCount > 1) throw new CalcError(`Too many decimal points in "${raw}"`);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new CalcError(`Not a number: "${raw}"`);
      if (prevIsValue()) tokens.push({ type: "op", value: "*" });
      tokens.push({ type: "num", value });
      i = j;
      continue;
    }

    // Identifiers: functions (sqrt) and constants (pi, e).
    if (/[a-z]/i.test(ch)) {
      let j = i;
      while (j < s.length && /[a-z]/i.test(s[j])) j += 1;
      const word = s.slice(i, j).toLowerCase();
      if (word === "sqrt") {
        if (prevIsValue()) tokens.push({ type: "op", value: "*" });
        tokens.push({ type: "func", value: "sqrt" });
      } else if (word === "pi" || word === "e") {
        if (prevIsValue()) tokens.push({ type: "op", value: "*" });
        tokens.push({ type: "const", value: word });
      } else {
        throw new CalcError(`Unknown symbol: "${word}"`);
      }
      i = j;
      continue;
    }

    if (ch === "(") {
      if (prevIsValue()) tokens.push({ type: "op", value: "*" });
      tokens.push({ type: "lparen" });
      i += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i += 1;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      // Decide whether a "-" (or "+") is unary based on what came before it.
      const prev = tokens[tokens.length - 1];
      const isUnaryContext =
        !prev || prev.type === "op" || prev.type === "unary" || prev.type === "lparen" || prev.type === "func";
      if (ch === "-" && isUnaryContext) {
        tokens.push({ type: "unary", value: "-" });
      } else if (ch === "+" && isUnaryContext) {
        // Unary plus is a no-op — just skip it.
      } else {
        tokens.push({ type: "op", value: ch });
      }
      i += 1;
      continue;
    }

    throw new CalcError(`Unexpected character: "${ch}"`);
  }

  return tokens;
}

export class CalcError extends Error {}

interface OpInfo {
  prec: number;
  rightAssoc: boolean;
}

const OP_INFO: Record<string, OpInfo> = {
  "+": { prec: 1, rightAssoc: false },
  "-": { prec: 1, rightAssoc: false },
  "*": { prec: 2, rightAssoc: false },
  "/": { prec: 2, rightAssoc: false },
  // Unary minus sits between +/- and ^ so that -3^2 = -(3^2) = -9.
  "u-": { prec: 3, rightAssoc: true },
  "^": { prec: 4, rightAssoc: true },
};

/** Convert an infix token list to RPN (shunting-yard). */
function toRpn(tokens: CalcToken[]): CalcToken[] {
  const output: CalcToken[] = [];
  const stack: CalcToken[] = [];

  const opKey = (t: CalcToken): string =>
    t.type === "unary" ? "u-" : t.type === "op" ? t.value : "";

  for (const token of tokens) {
    switch (token.type) {
      case "num":
      case "const":
        output.push(token);
        break;
      case "func":
        stack.push(token);
        break;
      case "unary":
        // A prefix operator binds to the operand that FOLLOWS it, so it must
        // never pop a pending operator sitting to its left (that operator is
        // still waiting for its own right-hand operand). Just push it.
        stack.push(token);
        break;
      case "op": {
        const info = OP_INFO[token.value];
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.type === "func") {
            output.push(stack.pop()!);
            continue;
          }
          if (top.type === "op" || top.type === "unary") {
            const topInfo = OP_INFO[opKey(top)];
            const shouldPop = info.rightAssoc
              ? topInfo.prec > info.prec
              : topInfo.prec >= info.prec;
            if (shouldPop) {
              output.push(stack.pop()!);
              continue;
            }
          }
          break;
        }
        stack.push(token);
        break;
      }
      case "lparen":
        stack.push(token);
        break;
      case "rparen": {
        let foundParen = false;
        while (stack.length) {
          const top = stack.pop()!;
          if (top.type === "lparen") {
            foundParen = true;
            break;
          }
          output.push(top);
        }
        if (!foundParen) throw new CalcError("Mismatched parentheses");
        // If a function immediately precedes the group, pop it too.
        const maybeFunc = stack[stack.length - 1];
        if (maybeFunc && maybeFunc.type === "func") output.push(stack.pop()!);
        break;
      }
    }
  }

  while (stack.length) {
    const top = stack.pop()!;
    if (top.type === "lparen" || top.type === "rparen") {
      throw new CalcError("Mismatched parentheses");
    }
    output.push(top);
  }

  return output;
}

function evalRpn(rpn: CalcToken[]): number {
  const stack: number[] = [];
  for (const token of rpn) {
    if (token.type === "num") {
      stack.push(token.value);
    } else if (token.type === "const") {
      stack.push(CONSTANTS[token.value]);
    } else if (token.type === "func") {
      const a = stack.pop();
      if (a === undefined) throw new CalcError("Not enough values");
      if (token.value === "sqrt") {
        if (a < 0) throw new CalcError("Can't take √ of a negative number");
        stack.push(Math.sqrt(a));
      }
    } else if (token.type === "unary") {
      const a = stack.pop();
      if (a === undefined) throw new CalcError("Not enough values");
      stack.push(-a);
    } else if (token.type === "op") {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new CalcError("Not enough values");
      switch (token.value) {
        case "+":
          stack.push(a + b);
          break;
        case "-":
          stack.push(a - b);
          break;
        case "*":
          stack.push(a * b);
          break;
        case "/":
          if (b === 0) throw new CalcError("Can't divide by zero");
          stack.push(a / b);
          break;
        case "^":
          stack.push(Math.pow(a, b));
          break;
      }
    }
  }
  if (stack.length !== 1) throw new CalcError("Incomplete expression");
  return stack[0];
}

/** Evaluate an arithmetic expression string. Throws CalcError on bad input. */
export function evaluate(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new CalcError("Empty expression");
  const result = evalRpn(toRpn(tokenize(trimmed)));
  if (!Number.isFinite(result)) throw new CalcError("Result is undefined");
  return result;
}

/** Format a numeric result for display: trims floating-point fuzz and keeps it
 *  short enough to fit the calculator screen. */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  if (Number.isInteger(n)) return String(n);
  // Round to 10 significant digits to kill 0.1+0.2 = 0.30000000000000004 noise,
  // then drop trailing zeros.
  const rounded = Number(n.toPrecision(10));
  let str = String(rounded);
  if (str.includes("e")) return rounded.toExponential(6).replace(/\.?0+e/, "e");
  if (str.includes(".")) str = str.replace(/0+$/, "").replace(/\.$/, "");
  return str;
}
