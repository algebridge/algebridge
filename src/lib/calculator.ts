// A small, safe arithmetic expression evaluator for the on-screen calculator.
// It intentionally does NOT use eval()/Function(), it tokenizes the input,
// converts it to Reverse Polish Notation with a shunting-yard algorithm, and
// evaluates that. This keeps kid-typed input from ever running as code.
//
// Expressions are written the way the keypad shows them: − for minus (as a
// sign too), × ÷ π √ and %, and big or tiny results as "6.02×10^23", which
// reads back in as the same number. There is no "e": results used to show as
// "1e+21", and reading that back treated the e as 2.718.

export type CalcToken =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | { type: "unary"; value: "-" }
  | { type: "func"; value: "sqrt" }
  | { type: "percent" }
  | { type: "lparen" }
  | { type: "rparen" };

export class CalcError extends Error {}

/** Tokenize an expression string, inserting implicit-multiplication ops so that
 *  inputs like "2(3)", "2√9", "3π", "ππ" or ")(" behave the way a kid expects. */
export function tokenize(input: string): CalcToken[] {
  const tokens: CalcToken[] = [];
  const s = input.replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").trim();

  // Does an implicit "*" belong before the value we're about to read?
  const prevIsValue = (): boolean => {
    const p = tokens[tokens.length - 1];
    return !!p && (p.type === "num" || p.type === "rparen" || p.type === "percent");
  };
  const value = (v: number) => {
    if (prevIsValue()) tokens.push({ type: "op", value: "*" });
    tokens.push({ type: "num", value: v });
  };

  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    if (ch === " ") {
      i += 1;
      continue;
    }

    // Numbers (with optional decimal point).
    if (/[0-9.]/.test(ch)) {
      let j = i;
      let dots = 0;
      while (j < s.length && /[0-9.]/.test(s[j])) {
        if (s[j] === ".") dots += 1;
        j += 1;
      }
      const raw = s.slice(i, j);
      if (dots > 1) throw new CalcError(`Too many decimal points in "${raw}"`);
      if (raw === ".") throw new CalcError("A decimal point needs a number");
      value(Number(raw));
      i = j;
      continue;
    }

    if (ch === "π") {
      value(Math.PI);
      i += 1;
      continue;
    }

    if (ch === "√") {
      if (prevIsValue()) tokens.push({ type: "op", value: "*" });
      tokens.push({ type: "func", value: "sqrt" });
      i += 1;
      continue;
    }

    if (ch === "%") {
      const p = tokens[tokens.length - 1];
      if (!p || !(p.type === "num" || p.type === "rparen" || p.type === "percent")) {
        throw new CalcError("% goes after a number");
      }
      tokens.push({ type: "percent" });
      i += 1;
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
        // Unary plus is a no-op, just skip it.
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

  const opKey = (t: CalcToken): string => (t.type === "unary" ? "u-" : t.type === "op" ? t.value : "");

  for (const token of tokens) {
    switch (token.type) {
      case "num":
        output.push(token);
        break;
      case "percent":
        // Postfix: it applies to the value just read, which is complete.
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
            const shouldPop = info.rightAssoc ? topInfo.prec > info.prec : topInfo.prec >= info.prec;
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

/**
 * a^b, including odd roots of negative numbers: (−8)^(1/3) is −2, which
 * Math.pow calls NaN. Any exponent that is a fraction with an odd bottom
 * (up to 15) counts, since there is no cube-root key and this is how a
 * student types one.
 */
export function power(a: number, b: number): number {
  const direct = Math.pow(a, b);
  if (!Number.isNaN(direct) || a >= 0) return direct;
  for (let q = 1; q <= 15; q += 2) {
    const p = b * q;
    if (Math.abs(p - Math.round(p)) < 1e-9) {
      const magnitude = Math.pow(-a, b);
      return Math.abs(Math.round(p)) % 2 === 1 ? -magnitude : magnitude;
    }
  }
  return NaN;
}

function evalRpn(rpn: CalcToken[]): number {
  const stack: number[] = [];
  for (const token of rpn) {
    if (token.type === "num") {
      stack.push(token.value);
    } else if (token.type === "percent") {
      const a = stack.pop();
      if (a === undefined) throw new CalcError("% goes after a number");
      stack.push(a / 100);
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
          stack.push(power(a, b));
          break;
      }
    }
  }
  if (stack.length !== 1) throw new CalcError("Incomplete expression");
  return stack[0];
}

/**
 * The last result, as shown and as it really is. Continuing a calculation
 * from a result ("= × 3") uses the real value, not the 10 digits on screen:
 * 1 ÷ 3 = × 3 = is 1, not 0.9999999999.
 */
export interface Carry {
  text: string;
  value: number;
}

/** Evaluate an arithmetic expression string. Throws CalcError on bad input. */
export function evaluate(input: string, carry?: Carry | null): number {
  const trimmed = input.trim();
  if (!trimmed) throw new CalcError("Empty expression");
  let tokens: CalcToken[];
  if (carry && trimmed.startsWith(carry.text)) {
    const rest = tokenize(trimmed.slice(carry.text.length));
    const first = rest[0];
    const joins = first && (first.type === "num" || first.type === "lparen" || first.type === "func");
    tokens = [{ type: "num", value: carry.value }, ...(joins ? [{ type: "op", value: "*" } as CalcToken] : []), ...rest];
  } else {
    tokens = tokenize(trimmed);
  }
  const result = evalRpn(toRpn(tokens));
  if (!Number.isFinite(result)) throw new CalcError("Result is undefined");
  return result;
}

/**
 * Format a result for the screen: floating-point fuzz trimmed to 10
 * significant digits, and very big or very small numbers in scientific
 * notation the way the course writes it ("6.02×10^23"), which the calculator
 * can read back in. Negatives use the − the keypad types.
 */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  if (n === 0) return "0";
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e12 || a < 1e-6) {
    const [mantissa, exp] = a.toExponential(6).split("e");
    const m = mantissa.includes(".") ? mantissa.replace(/0+$/, "").replace(/\.$/, "") : mantissa;
    const e = Number(exp);
    return `${sign}${m}×10^${e < 0 ? `−${-e}` : e}`;
  }
  let str = String(Number(a.toPrecision(10)));
  if (str.includes(".")) str = str.replace(/0+$/, "").replace(/\.$/, "");
  return sign + str;
}

/** Auto-close any parentheses the student left open, so tapping √9 = just works. */
export function balanceParens(s: string): string {
  let open = 0;
  for (const ch of s) {
    if (ch === "(") open += 1;
    else if (ch === ")") open = Math.max(0, open - 1);
  }
  return s + ")".repeat(open);
}

/**
 * Where the last term of an expression starts: the number, π, bracket group,
 * √(...) or power ("5^2", "10^−7") that ± should negate. Returns the length
 * when the expression ends in an operator, so there is no term yet.
 */
function lastTermStart(s: string): number {
  let i = s.length;
  if (i === 0 || /[+−×÷^(√]$/.test(s)) return i;
  while (i > 0) {
    const ch = s[i - 1];
    if (/[0-9.π%]/.test(ch)) {
      i -= 1;
      continue;
    }
    if (ch === ")") {
      let depth = 0;
      let j = i - 1;
      for (; j >= 0; j -= 1) {
        if (s[j] === ")") depth += 1;
        else if (s[j] === "(" && --depth === 0) break;
      }
      if (j < 0) return i;
      i = j;
      if (i > 0 && s[i - 1] === "√") i -= 1;
      continue;
    }
    // A power belongs to its term, and so does a negative exponent.
    if (ch === "^") {
      i -= 1;
      continue;
    }
    if (ch === "−" && i >= 2 && s[i - 2] === "^") {
      i -= 1;
      continue;
    }
    break;
  }
  return i;
}

/**
 * The ± key: negates the last term. "3+4" becomes "3−4" and back, "−5"
 * becomes "5", "5^2" becomes "−5^2" (−25, which is what a student means after
 * x²), "(2+3)" becomes "−(2+3)", and after an operator it starts a negative
 * number: "3×" becomes "3×−".
 */
export function toggleSign(s: string): string {
  const start = lastTermStart(s);
  if (start === s.length) return `${s}−`;
  const before = s[start - 1];
  const head = s.slice(0, start - 1);
  const term = s.slice(start);
  if (before === "+") return `${head}−${term}`;
  if (before === "−") {
    // A minus after a value is subtraction: flip it to +. At the start or
    // after an operator or "(", it is the term's own sign: remove it.
    const prior = s[start - 2];
    const isSign = start - 1 === 0 || /[+−×÷^(√]/.test(prior ?? "");
    return isSign ? `${head}${term}` : `${head}+${term}`;
  }
  return `${s.slice(0, start)}−${term}`;
}
