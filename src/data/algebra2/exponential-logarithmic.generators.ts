import type { PracticeProblem, Trap } from "@/types";
import { fillToCount, fmtNum, frac, lin, mcChoices, PROBLEMS_PER_SKILL, randInt, trapsFor } from "@/lib/problem-utils";

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}
function trap(value: number | string, why: string, step?: number): Trap {
  return step === undefined ? { value, why } : { value, why, step };
}
function usNum(n: number): string {
  return n.toLocaleString("en-US");
}
/** log₂, log₁₀: the base as subscript digits. */
function logb(b: number): string {
  return "log" + String(b).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
}
/** A whole exponent as a superscript: 2⁵. */
function sup(n: number): string {
  return String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]);
}
/** A signed number the way printed math writes it: −3, 4. */
function signed(n: number): string {
  return n < 0 ? `−${-n}` : String(n);
}
/** ASCII minus signs as true minus signs: "-2/3" → "−2/3". */
function tm(s: string): string {
  return s.replace(/-/g, "−");
}
/** b written out as a product k times: 2 × 2 × 2. */
function times(b: number, k: number): string {
  return Array(k).fill(b).join(" × ");
}
/** Rounded half up, like a student with a calculator. */
function roundTo(x: number, places: number): number {
  const f = 10 ** places;
  return Math.round(x * f + 1e-9) / f;
}

const BASES = [2, 3, 4, 5, 6, 10];
/** The largest exponent that keeps b^k at or under 1024. */
function maxExp(b: number): number {
  let k = 0;
  while (b ** (k + 1) <= 1024) k += 1;
  return k;
}

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "log-basics": (seeds) =>
    fillToCount("log-basics", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // log_b of an exact power, sometimes a unit fraction.
        const b = pick(BASES);
        const neg = randInt(0, 3) === 0;
        const k = randInt(neg ? 1 : 0, Math.min(maxExp(b), neg ? 4 : 10));
        const n = b ** k;
        const want = neg ? -k : k;
        const inside = neg ? `1/${n}` : String(n);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${logb(b)}(${inside}).`,
          hint: neg ? `${b} to what power gives 1/${n}? A fraction like this needs a negative exponent.` : `${b} to what power gives ${n}?`,
          answer: want,
          traps: trapsFor(want, [
            trap(neg ? k : -k, neg ? `1/${n} is less than 1, so the exponent is negative: ${b}^(−k) = 1/${b}^k.` : `${n} is bigger than 1, so the exponent is positive.`, 2),
            k > 0 ? trap(neg ? -(n / b) : n / b, "A logarithm is an exponent, not a quotient. Count how many factors of " + b + " make the number.", 0) : null,
            k > 1 ? trap(neg ? -(k - 1) : k - 1, `${b}${sup(k - 1)} = ${b ** (k - 1)}, which is not ${n}. One more factor of ${b} is needed.`, 1) : null,
            k === 0 ? trap(1, "Any base to the power 0 is 1, so the log of 1 is 0.", 1) : null,
          ]),
          explanation: (neg
            ? [
                `${logb(b)}(1/${n}) asks: ${b} to what power gives 1/${n}?`,
                `${b}${sup(k)} = ${n}`,
                `1/${n} = 1/${b}${sup(k)} = ${b}^(−${k})`,
                `so ${logb(b)}(1/${n}) = −${k}`,
              ]
            : [`${logb(b)}(${n}) asks: ${b} to what power gives ${n}?`, `${b}${sup(k)} = ${n}`, `so ${logb(b)}(${n}) = ${k}`]
          ).join(" → "),
        };
      }
      if (kind === 1) {
        // Exponential form to log form.
        const b = pick(BASES);
        const k = randInt(2, Math.min(maxExp(b), 5));
        if (k === b) return { id: "", type: "numeric", prompt: `Evaluate ${logb(b)}(${b ** 3}).`, hint: `${b} to what power gives ${b ** 3}?`, answer: 3, traps: trapsFor(3, [trap(b ** 2, "A logarithm is an exponent, not a quotient.", 0)]), explanation: `${logb(b)}(${b ** 3}) asks: ${b} to what power gives ${b ** 3}? → ${b}³ = ${times(b, 3)} = ${b ** 3} → so ${logb(b)}(${b ** 3}) = 3` };
        const n = b ** k;
        const answer = `${logb(b)}(${n}) = ${k}`;
        const wrong = [`${logb(k)}(${n}) = ${b}`, `${logb(b)}(${k}) = ${n}`, `${logb(n)}(${b}) = ${k}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write ${b}^${k} = ${n} in logarithmic form.`,
          hint: "The base of the power is the base of the log, and the log equals the exponent.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The base of the log is the base of the power, ${b}, not the exponent.`, 1),
            trap(wrong[1], "A log equals the exponent. The number inside the log is the result of the power.", 1),
            trap(wrong[2], "The base of the log is the base of the power, not the result of the power.", 1),
          ]),
          explanation: [
            `in ${b}^${k} = ${n}, the base is ${b}, the exponent is ${k}, and the result is ${n}`,
            `the log has the same base, the result goes inside, and the log equals the exponent`,
            answer,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Log form to exponential form.
        const b = pick(BASES);
        const k = randInt(2, Math.min(maxExp(b), 5));
        if (k === b) return { id: "", type: "numeric", prompt: `Evaluate ${logb(b)}(${b ** 4}).`, hint: `${b} to what power gives ${b ** 4}?`, answer: 4, traps: trapsFor(4, [trap(b ** 3, "A logarithm is an exponent, not a quotient.", 0)]), explanation: `${logb(b)}(${b ** 4}) asks: ${b} to what power gives ${b ** 4}? → ${b}⁴ = ${times(b, 4)} = ${b ** 4} → so ${logb(b)}(${b ** 4}) = 4` };
        const n = b ** k;
        const answer = `${b}^${k} = ${n}`;
        const wrong = [`${k}^${b} = ${n}`, `${b}^${n} = ${k}`, `${n}^${b} = ${k}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write ${logb(b)}(${n}) = ${k} in exponential form.`,
          hint: "The base of the log is the base of the power, and the value of the log is the exponent.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `The base stays ${b}. The value of the log, ${k}, is the exponent.`, 1),
            trap(wrong[1], "The value of the log is the exponent, and the number inside the log is the result.", 1),
            trap(wrong[2], "The base of the log is the base of the power, not the number inside the log.", 1),
          ]),
          explanation: [
            `in ${logb(b)}(${n}) = ${k}, the base is ${b}, the value ${k} is the exponent, and ${n} is the result`,
            `base to the exponent gives the result: ${b} to the power ${k} is ${n}`,
            answer,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // ln and e, log and 10, as inverses.
        const form = randInt(0, 3);
        const k = pick([-4, -3, -2, 2, 3, 4, 5, 6, 7]);
        const c = randInt(2, 30);
        const prompt = form === 0 ? `Evaluate ln(e^(${signed(k)})).` : form === 1 ? `Evaluate log(10^(${signed(k)})).` : form === 2 ? `Evaluate e^(ln ${c}).` : `Evaluate 10^(log ${c}).`;
        const want = form < 2 ? k : c;
        return {
          id: "",
          type: "numeric",
          prompt,
          hint: form === 0 ? "ln is the log with base e, so ln(e^k) asks: e to what power gives e^k?" : form === 1 ? "log with no base written is base 10, so log(10^k) asks: 10 to what power gives 10^k?" : form === 2 ? `ln ${c} is the exponent that e needs to make ${c}. Raising e to that exponent gives back ${c}.` : `log ${c} is the exponent that 10 needs to make ${c}. Raising 10 to that exponent gives back ${c}.`,
          answer: want,
          traps: trapsFor(want, [
            form < 2 ? trap(-k, "The exponent comes out exactly as written, sign included.", 1) : trap(Math.round(Math.log(c) * 100) / 100, "That is the natural log on its own. The power undoes the log and leaves the original number.", 1),
            form < 2 ? trap(form === 0 ? Math.round(Math.E ** k * 1000) / 1000 : 10 ** k, "ln and log undo the power: the answer is the exponent, not the value of the power.", 0) : trap(Math.round(Math.log10(c) * 100) / 100, "That is the log on its own. The power undoes the log and leaves the original number.", 1),
            form < 2 ? trap(1, "A log of a power equals the exponent, which here is not 1.", 1) : trap(form === 2 ? 2.718 : 10, "The base and its log cancel each other and leave the number inside.", 1),
          ]),
          explanation: (form === 0
            ? [`ln is the log with base e, so ln(e^(${signed(k)})) asks: e to what power gives e^(${signed(k)})?`, `that power is the exponent, ${signed(k)}`, `ln(e^(${signed(k)})) = ${signed(k)}`]
            : form === 1
              ? [`log with no base is base 10, so log(10^(${signed(k)})) asks: 10 to what power gives 10^(${signed(k)})?`, `that power is the exponent, ${signed(k)}`, `log(10^(${signed(k)})) = ${signed(k)}`]
              : form === 2
                ? [`ln ${c} is the exponent e needs to make ${c}`, `raising e to that exponent gives back ${c}`, `e^(ln ${c}) = ${c}`]
                : [`log ${c} is the exponent 10 needs to make ${c}`, `raising 10 to that exponent gives back ${c}`, `10^(log ${c}) = ${c}`]
          ).join(" → "),
        };
      }
      if (kind === 4) {
        // Find the base.
        const b = randInt(2, 9);
        const k = b >= 6 ? randInt(2, 3) : randInt(2, 4);
        const n = b ** k;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for the base b: log_b(${n}) = ${k}.`,
          hint: `Rewrite in exponential form: b^${k} = ${n}. Which positive number to the ${k}${k === 2 ? "nd" : k === 3 ? "rd" : "th"} power gives ${n}?`,
          answer: b,
          traps: trapsFor(b, [
            trap(n / k, `b^${k} = ${n} is a power, not a product. Take the ${k}${k === 2 ? "nd" : k === 3 ? "rd" : "th"} root of ${n}.`, 1),
            trap(n - k, "Rewrite as a power equation first: b to the power " + k + " equals " + n + ".", 0),
            trap(-b, "The base of a logarithm is positive.", 2),
          ]),
          explanation: [
            `rewrite in exponential form: b^${k} = ${n}`,
            `look for the number used ${k} times as a factor: ${times(b, k)} = ${n}`,
            `a log base is positive, so b = ${b}`,
          ].join(" → "),
        };
      }
      // Solve a simple log equation for x.
      const b = pick(BASES);
      const k = randInt(1, Math.min(maxExp(b), 6));
      const x = b ** k;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve ${logb(b)}(x) = ${k}.`,
        hint: `The log is ${k}, so ${b} to the power ${k} gives x. Rewrite as x = ${b}^${k}.`,
        answer: x,
        traps: trapsFor(x, [
          trap(b * k, `${b}^${k} means ${b} multiplied by itself ${k} times, not ${b} × ${k}.`, 1),
          trap(k ** b, `The base is ${b} and the exponent is ${k}: ${b}^${k}, not ${k}^${b}.`, 0),
          trap(k / b, "A log equals an exponent, so x is the base raised to that exponent.", 0),
        ]),
        explanation: [
          `rewrite in exponential form: x = ${b}^${k}`,
          k === 1 ? `${b}^1 = ${b}` : `${b}^${k} = ${times(b, k)} = ${x}`,
          `x = ${x}`,
        ].join(" → "),
      };
    }),

  "log-properties": (seeds) =>
    fillToCount("log-properties", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // Expand a product or quotient of powers.
        const p = randInt(2, 7);
        let q = randInt(2, 7);
        if (q === p) q = p === 7 ? 6 : p + 1;
        const quotient = randInt(0, 1) === 0;
        const inside = quotient ? `x${sup(p)}/y${sup(q)}` : `x${sup(p)}y${sup(q)}`;
        const answer = quotient ? `${p} log x − ${q} log y` : `${p} log x + ${q} log y`;
        const wrong = quotient
          ? [`${p} log x + ${q} log y`, `(${p} log x)/(${q} log y)`, `log(${p}x) − log(${q}y)`]
          : [`${p} log x − ${q} log y`, `${p} log x × ${q} log y`, `log(${p}x) + log(${q}y)`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand log(${inside}).`,
          hint: quotient ? "Division inside a log becomes subtraction outside, and each power becomes a coefficient." : "Multiplication inside a log becomes addition outside, and each power becomes a coefficient.",
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], quotient ? "The powers are divided, and a log turns dividing into subtracting." : "The powers are multiplied, and a log turns multiplying into adding, not subtracting.", 0),
            trap(wrong[1], quotient ? "A quotient inside the log becomes a difference of logs, not a quotient of logs." : "A product inside the log becomes a sum of logs, not a product of logs.", 0),
            trap(wrong[2], "A power inside the log becomes a coefficient in front of the log, not a factor inside it.", 1),
          ]),
          explanation: [
            quotient ? `division inside becomes subtraction: log(${inside}) = log(x${sup(p)}) − log(y${sup(q)})` : `multiplication inside becomes addition: log(${inside}) = log(x${sup(p)}) + log(y${sup(q)})`,
            `each power comes out front: log(x${sup(p)}) = ${p} log x and log(y${sup(q)}) = ${q} log y`,
            `log(${inside}) = ${answer}`,
          ].join(" → "),
        };
      }
      if (kind === 1) {
        // Condense a sum or difference into one log.
        const p = randInt(2, 7);
        let q = randInt(2, 7);
        if (q === p) q = p === 7 ? 6 : p + 1;
        const minus = randInt(0, 1) === 0;
        const answer = minus ? `log(x${sup(p)}/y${sup(q)})` : `log(x${sup(p)}y${sup(q)})`;
        const wrong = minus
          ? [`log(x${sup(p)} − y${sup(q)})`, `log(${p}x − ${q}y)`, `log(y${sup(q)}/x${sup(p)})`]
          : [`log(x${sup(p)} + y${sup(q)})`, `log(${p}x + ${q}y)`, `log(x${sup(q)}y${sup(p)})`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Write ${p} log x ${minus ? "−" : "+"} ${q} log y as a single logarithm.`,
          hint: "Move each coefficient up as a power first, then " + (minus ? "a difference of logs is the log of a quotient." : "a sum of logs is the log of a product."),
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], minus ? "A difference of logs is the log of a quotient, not of a difference." : "A sum of logs is the log of a product, not of a sum.", 1),
            trap(wrong[1], "A coefficient in front of a log becomes a power inside it, not a multiplier.", 0),
            trap(wrong[2], minus ? "The log that is subtracted goes in the denominator." : `${p} is the power on x and ${q} is the power on y.`, minus ? 1 : 0),
          ]),
          explanation: [
            `each coefficient moves up as a power: ${p} log x = log(x${sup(p)}) and ${q} log y = log(y${sup(q)})`,
            minus ? `a difference of logs is the log of a quotient: log(x${sup(p)}) − log(y${sup(q)}) = ${answer}` : `a sum of logs is the log of a product: log(x${sup(p)}) + log(y${sup(q)}) = ${answer}`,
            `${p} log x ${minus ? "−" : "+"} ${q} log y = ${answer}`,
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Evaluate from given approximate values.
        const base = pick([5, 6, 7, 8, 9, 11, 12, 15]);
        const P = roundTo(Math.log(2) / Math.log(base), 2);
        const Q = roundTo(Math.log(3) / Math.log(base), 2);
        const targets: [number, number][] = [[1, 1], [2, 1], [1, 2], [3, 0], [0, 2], [2, 0], [3, 1], [-1, 1], [1, -1], [-1, 0], [0, -1], [0, 3], [2, 2], [1, 3], [4, 0], [-2, 1], [-1, 2]];
        const [u, v] = pick(targets);
        const n = 2 ** u * 3 ** v;
        const nText = Number.isInteger(n) ? String(n) : frac(2 ** Math.max(u, 0) * 3 ** Math.max(v, 0), 2 ** Math.max(-u, 0) * 3 ** Math.max(-v, 0));
        const want = roundTo(u * P + v * Q, 2);
        const term = (coef: number, name: string) => (Math.abs(coef) === 1 ? name : `${Math.abs(coef)} ${name}`);
        const shown = [u ? `${u < 0 ? "−" : ""}${term(u, "log_b(2)")}` : "", v ? `${u ? (v < 0 ? " − " : " + ") : v < 0 ? "−" : ""}${term(v, "log_b(3)")}` : ""].join("");
        const termN = (coef: number, val: number) => (Math.abs(coef) === 1 ? String(val) : `${Math.abs(coef)}(${val})`);
        const shownN = [u ? `${u < 0 ? "−" : ""}${termN(u, P)}` : "", v ? `${u ? (v < 0 ? " − " : " + ") : v < 0 ? "−" : ""}${termN(v, Q)}` : ""].join("");
        const fac = (e: number, p: number) => (e === 1 ? String(p) : `${p}${sup(e)}`);
        const top = [u > 0 ? fac(u, 2) : "", v > 0 ? fac(v, 3) : ""].filter(Boolean);
        const bottom = [u < 0 ? fac(-u, 2) : "", v < 0 ? fac(-v, 3) : ""].filter(Boolean);
        const factored = `${top.join(" · ") || "1"}${bottom.length ? `/${bottom.length > 1 ? `(${bottom.join(" · ")})` : bottom[0]}` : ""}`;
        return {
          id: "",
          type: "numeric",
          prompt: `Given log_b(2) ≈ ${P} and log_b(3) ≈ ${Q}, find log_b(${nText}). (round to the nearest hundredth)`,
          hint: `Write ${nText} using only 2s and 3s${u < 0 || v < 0 ? ", with division where needed" : ""}, then turn products into sums and powers into coefficients.`,
          answer: want,
          decimalPlaces: 2,
          traps: trapsFor(want, [
            u && v ? trap(roundTo(u * P * v * Q, 2), "A log of a product is a sum of logs, not a product of them.", 1) : null,
            u && v ? trap(roundTo(P + Q, 2), `${nText} is not 2 × 3. Count how many factors of 2 and of 3 it has.`, 0) : null,
            u < 0 || v < 0 ? trap(roundTo(Math.abs(u) * P + Math.abs(v) * Q, 2), "Division inside the log subtracts that log. Watch the sign.", 1) : null,
            trap(roundTo(Math.log10(n), 2), "The base is b, not 10. Build the answer from the two given values.", 2),
            !u || !v ? trap(roundTo((u || v) * (u ? P : Q) / Math.abs(u || v), 2), "A power inside the log becomes a coefficient: multiply the given value by the exponent.", 1) : null,
          ]),
          explanation: [
            `write ${nText} with 2s and 3s: ${nText} = ${factored}`,
            `products become sums, quotients differences, powers coefficients: log_b(${nText}) = ${shown}`,
            `put in the given values: ${shownN}`,
            `≈ ${tm(String(want))}`,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // A sum of logs that condenses to an exact power.
        const b = pick([6, 10, 12, 15]);
        const k = b === 6 || b === 10 ? randInt(2, 3) : 2;
        const n = b ** k;
        const isPow = (v: number) => {
          for (let e = 0; e <= 6; e += 1) if (b ** e === v) return true;
          return false;
        };
        const splits: number[] = [];
        for (let u = 2; u * u <= n; u += 1) if (n % u === 0 && !isPow(u) && !isPow(n / u)) splits.push(u);
        const u = pick(splits);
        const v = n / u;
        const [first, second] = randInt(0, 1) === 0 ? [u, v] : [v, u];
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${logb(b)}(${first}) + ${logb(b)}(${second}).`,
          hint: `Neither number is a power of ${b} on its own. A sum of logs with the same base is the log of the product.`,
          answer: k,
          traps: trapsFor(k, [
            trap(n, `${first} × ${second} = ${n} is what sits inside the single log. Then ask: ${b} to what power gives it?`, 3),
            trap(first + second, "Adding logs means multiplying the numbers inside, not adding them.", 0),
            trap(k + 1, `${b}${sup(k + 1)} = ${b ** (k + 1)}, which is more than ${first} × ${second}.`, 2),
          ]),
          explanation: [
            `same base, so a sum of logs is the log of the product: ${logb(b)}(${first} × ${second})`,
            `${first} × ${second} = ${n}`,
            `${b}${sup(k)} = ${n}`,
            `so ${logb(b)}(${n}) = ${k}`,
          ].join(" → "),
        };
      }
      if (kind === 4) {
        // A difference of logs that condenses to an exact power.
        const b = pick([2, 3, 5, 10]);
        const k = randInt(1, Math.min(maxExp(b), 4));
        const m = pick([3, 5, 6, 7, 9, 11, 12, 13].filter((v) => v % b !== 0 || v === 6 || v === 12));
        const big = b ** k * m;
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate ${logb(b)}(${big}) − ${logb(b)}(${m}).`,
          hint: `${big} is not a power of ${b}, but a difference of logs with the same base is the log of the quotient.`,
          answer: k,
          traps: trapsFor(k, [
            trap(b ** k, `${big} ÷ ${m} = ${b ** k} is what sits inside the single log. Then ask: ${b} to what power gives it?`, 3),
            trap(big - m, "Subtracting logs means dividing the numbers inside, not subtracting them.", 0),
            trap(k + 1, `${b}${sup(k + 1)} = ${b ** (k + 1)}, which is not ${big} ÷ ${m}.`, 2),
          ]),
          explanation: [
            `same base, so a difference of logs is the log of the quotient: ${logb(b)}(${big} ÷ ${m})`,
            `${big} ÷ ${m} = ${b ** k}`,
            `${b}${sup(k)} = ${b ** k}`,
            `so ${logb(b)}(${b ** k}) = ${k}`,
          ].join(" → "),
        };
      }
      // The power property with a root inside.
      const b = pick([2, 3, 5, 10]);
      const cube = randInt(0, 2) === 0;
      const k = cube ? pick([2, 3, 4, 6].filter((e) => e <= maxExp(b))) : randInt(1, Math.min(maxExp(b), 7));
      const n = b ** k;
      const want = cube ? k / 3 : k / 2;
      const sym = cube ? "∛" : "√";
      return {
        id: "",
        type: "numeric",
        prompt: `Evaluate ${logb(b)}(${sym}${n}).${Number.isInteger(want) ? "" : " (write as a fraction or decimal)"}`,
        hint: `A ${cube ? "cube" : "square"} root is a power of ${cube ? "1/3" : "1/2"}, and a power inside a log becomes a multiplier: ${logb(b)}(${sym}${n}) = ${cube ? "1/3" : "1/2"} × ${logb(b)}(${n}).`,
        answer: want,
        traps: trapsFor(want, [
          trap(k, `That is ${logb(b)}(${n}). The root still has to be applied: it ${cube ? "divides by 3" : "halves"} the log.`, 3),
          trap(cube ? k * 3 : k * 2, `A root is a fractional power, so it ${cube ? "divides" : "halves"} the log, not multiplies it.`, 1),
          trap(Math.round((cube ? Math.cbrt(n) : Math.sqrt(n)) * 100) / 100, `That is ${sym}${n} itself. The question asks for its log in base ${b}.`, 0),
        ]),
        explanation: [
          `a ${cube ? "cube" : "square"} root is a power of ${cube ? "1/3" : "1/2"}: ${sym}${n} = ${n}^(${cube ? "1/3" : "1/2"})`,
          `the power comes out front: ${logb(b)}(${n}^(${cube ? "1/3" : "1/2"})) = ${cube ? "1/3" : "1/2"} × ${logb(b)}(${n})`,
          `${b}${sup(k)} = ${n}, so ${logb(b)}(${n}) = ${k}`,
          `${cube ? "1/3" : "1/2"} × ${k} = ${frac(k, cube ? 3 : 2)}`,
        ].join(" → "),
      };
    }),

  "solve-exponential-equations": (seeds) =>
    fillToCount("solve-exponential-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 7;
      if (kind === 0) {
        // Same base already: read off the exponent.
        const b = pick(BASES);
        const neg = randInt(0, 2) === 0;
        const k = randInt(1, Math.min(maxExp(b), neg ? 4 : 10));
        const n = b ** k;
        const want = neg ? -k : k;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${b}^x = ${neg ? `1/${n}` : n}.`,
          hint: neg ? `1/${n} is 1 over a power of ${b}, so the exponent is negative.` : `Write ${n} as a power of ${b}, then match the exponents.`,
          answer: want,
          traps: trapsFor(want, [
            trap(neg ? k : -k, neg ? "A fraction less than 1 needs a negative exponent." : `${n} is bigger than 1, so the exponent is positive.`, 1),
            trap(neg ? -(n / b) : n / b, `x is an exponent: count the factors of ${b}, do not divide by ${b}.`, 0),
            k > 1 ? trap(neg ? -(k - 1) : k - 1, `${b}${sup(k - 1)} = ${b ** (k - 1)}, which is not ${n}.`, 0) : null,
          ]),
          explanation: (neg
            ? [`write ${n} as a power of ${b}: ${n} = ${b}${sup(k)}`, `1/${n} = ${b}^(−${k})`, `${b}^x = ${b}^(−${k}), so x = −${k}`]
            : [`write ${n} as a power of ${b}: ${n} = ${b}${sup(k)}`, `${b}^x = ${b}${sup(k)}, so x = ${k}`]
          ).join(" → "),
        };
      }
      if (kind === 1) {
        // A linear exponent: b^(mx + a) = n.
        const b = pick(BASES);
        const m = randInt(1, 3);
        const a = pick([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
        // Exponents that make x a whole number.
        const ks: number[] = [];
        for (let e = 0; e <= maxExp(b); e += 1) if ((e - a) % m === 0) ks.push(e);
        const k = ks.length ? pick(ks) : a;
        const x = (k - a) / m;
        const n = b ** k;
        const expo = lin(m, a);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${b}^(${expo}) = ${n}.`,
          hint: `${n} = ${b}${sup(k)}, so the exponents match: ${expo} = ${k}.`,
          answer: x,
          traps: trapsFor(x, [
            trap(k, `${k} is the whole exponent, ${expo}. Solve that equation for x.`, 2),
            trap((n - a) / m, `Match the bases first: ${n} is a power of ${b}. Set ${expo} equal to that power, not to ${n}.`, 1),
            trap((k + a) / m, a < 0 ? `To undo subtracting ${-a}, add ${-a}.` : `To undo adding ${a}, subtract ${a}.`, 2),
            m > 1 ? trap(k - a, `After moving ${Math.abs(a)} across, divide by ${m}.`, 3) : null,
          ]),
          explanation: [
            `write ${n} as a power of ${b}: ${n} = ${b}${sup(k)}`,
            `same base, so the exponents match: ${tm(expo)} = ${k}`,
            `${a < 0 ? `add ${-a}` : `subtract ${a}`}: ${m === 1 ? "x" : `${m}x`} = ${k} ${a < 0 ? "+" : "−"} ${Math.abs(a)} = ${signed(k - a)}`,
            ...(m > 1 ? [`divide by ${m}: x = ${signed(k - a)}/${m} = ${signed(x)}`] : []),
          ].join(" → "),
        };
      }
      if (kind === 2) {
        // Different bases that share a prime: a fraction answer.
        const base = pick([2, 3, 5]);
        const e1 = randInt(2, base === 5 ? 3 : 5);
        let e2 = randInt(1, base === 5 ? 3 : 5);
        if (e2 === e1) e2 = e1 === 1 ? 2 : e1 - 1;
        const neg = randInt(0, 2) === 0;
        const L = base ** e1;
        const R = base ** e2;
        const want = (neg ? -e2 : e2) / e1;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${L}^x = ${neg ? `1/${R}` : R}.${Number.isInteger(want) ? "" : " (write as a fraction or decimal)"}`,
          hint: `Both ${L} and ${R} are powers of ${base}: ${L} = ${base}${sup(e1)} and ${R} = ${base}${sup(e2)}. Rewrite both sides with base ${base}.`,
          answer: want,
          traps: trapsFor(want, [
            trap(-want, neg ? "1 over a power needs a negative exponent." : "Both sides are above 1, so the exponent is positive.", neg ? 1 : 3),
            trap(neg ? -e1 / e2 : e1 / e2, `(${base}${sup(e1)})^x = ${base}^(${e1}x), so ${e1}x = ${neg ? "−" : ""}${e2}. Divide by ${e1}, not by ${e2}.`, 3),
            trap(neg ? -(R / L) : R / L, "x is an exponent, not a quotient of the two numbers. Rewrite both sides with the same base.", 0),
          ]),
          explanation: [
            `both are powers of ${base}: ${L} = ${base}${sup(e1)} and ${R} = ${base}${e2 === 1 ? "¹" : sup(e2)}`,
            `rewrite: (${base}${sup(e1)})^x = ${neg ? `${base}^(−${e2})` : `${base}${e2 === 1 ? "¹" : sup(e2)}`}`,
            `a power of a power multiplies: ${base}^(${e1}x), so ${e1}x = ${neg ? `−${e2}` : e2}`,
            `divide by ${e1}: x = ${tm(frac(neg ? -e2 : e2, e1))}`,
          ].join(" → "),
        };
      }
      if (kind === 3) {
        // b^x = c with no common base: a log.
        const b = pick([2, 3, 4, 5, 6, 7]);
        const isPower = (v: number, base: number) => Math.abs(Math.log(v) / Math.log(base) - Math.round(Math.log(v) / Math.log(base))) < 1e-9;
        let c = randInt(5, 300);
        while (isPower(c, b)) c += 1;
        const x = Math.log(c) / Math.log(b);
        const want = roundTo(x, 2);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${b}^x = ${c} for x. (round to the nearest hundredth)`,
          hint: `${c} is not a whole power of ${b}. Take the log of both sides: x = log(${c})/log(${b}).`,
          answer: want,
          decimalPlaces: 2,
          traps: trapsFor(want, [
            trap(roundTo(c / b, 2), `Dividing ${c} by ${b} is not the same as asking ${b} to what power gives ${c}. Use a logarithm.`, 0),
            trap(roundTo(Math.log(b) / Math.log(c), 2), `That is log(${b})/log(${c}), upside down. The log of the number on the right goes on top.`, 1),
            trap(roundTo(Math.log10(c), 2), `log(${c}) alone is base 10. Divide by log(${b}) to change to base ${b}.`, 1),
          ]),
          explanation: [
            `take the log of both sides: x · log(${b}) = log(${c})`,
            `divide by log(${b}): x = log(${c})/log(${b})`,
            `≈ ${fmtNum(roundTo(Math.log10(c), 4))}/${fmtNum(roundTo(Math.log10(b), 4))}`,
            `x ≈ ${want}`,
          ].join(" → "),
        };
      }
      if (kind === 4) {
        // a·b^x = c: divide first, then a log.
        const a = pick([2, 3, 4, 5, 6, 8, 10, 12, 20, 25, 50]);
        const b = pick([2, 3, 4, 5, 6, 1.5, 1.2, 1.08, 1.05]);
        const c = a * randInt(3, 60) + randInt(1, a - 1);
        const x = Math.log(c / a) / Math.log(b);
        const want = roundTo(x, 2);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve ${a} · ${fmtNum(b)}^x = ${c} for x. (round to the nearest hundredth)`,
          hint: `Divide both sides by ${a} first, then take the log of both sides: x = log(${c}/${a})/log(${fmtNum(b)}).`,
          answer: want,
          decimalPlaces: 2,
          traps: trapsFor(want, [
            trap(roundTo(Math.log(c) / Math.log(a * b), 2), `${a} multiplies the power; it is not part of the base. Divide by ${a} before taking logs.`, 0),
            trap(roundTo(Math.log(c) / Math.log(b), 2), `Divide both sides by ${a} first: the power alone equals ${fmtNum(c / a)}.`, 0),
            trap(roundTo(Math.log(c - a) / Math.log(b), 2), `${a} multiplies the power, so divide by it rather than subtracting it.`, 0),
          ]),
          explanation: [
            `divide both sides by ${a}: ${fmtNum(b)}^x = ${c}/${a} = ${fmtNum(roundTo(c / a, 4))}`,
            `take the log of both sides: x = log(${fmtNum(roundTo(c / a, 4))})/log(${fmtNum(b)})`,
            `≈ ${fmtNum(roundTo(Math.log10(c / a), 4))}/${fmtNum(roundTo(Math.log10(b), 4))}`,
            `x ≈ ${want}`,
          ].join(" → "),
        };
      }
      if (kind === 5) {
        // Doubling or tripling time.
        const triple = randInt(0, 2) === 0;
        const f = triple ? 3 : 2;
        const P = pick([50, 100, 200, 250, 400, 500, 800, 1000, 2000, 5000]);
        const h = pick([2, 3, 4, 5, 6, 8, 12]);
        let mult = randInt(3, 40);
        while (Math.abs(Math.log(mult) / Math.log(f) - Math.round(Math.log(mult) / Math.log(f))) < 1e-9) mult += 1;
        const N = P * mult;
        const t = (h * Math.log(mult)) / Math.log(f);
        const want = roundTo(t, 1);
        return {
          id: "",
          type: "numeric",
          prompt: `A culture of ${usNum(P)} bacteria ${triple ? "triples" : "doubles"} every ${h} hours. After how many hours will there be ${usNum(N)} bacteria? (round to the nearest tenth)`,
          hint: `The count is ${usNum(P)} · ${f}^(t/${h}). Divide both sides by ${usNum(P)}, then take a log: t/${h} = log(${mult})/log(${f}).`,
          answer: want,
          decimalPlaces: 1,
          traps: trapsFor(want, [
            trap(roundTo(Math.log(mult) / Math.log(f), 1), `That is how many ${triple ? "triplings" : "doublings"} it takes. Each one takes ${h} hours.`, 3),
            trap(roundTo(Math.log(N) / Math.log(f), 1), `Divide by the starting count ${usNum(P)} before taking the log.`, 1),
            trap(roundTo((h * (mult - 1)) / (f - 1), 1), `The growth is not linear: the count multiplies by ${f} every ${h} hours.`, 0),
          ]),
          explanation: [
            `the count after t hours is ${usNum(P)} · ${f}^(t/${h}), so ${usNum(P)} · ${f}^(t/${h}) = ${usNum(N)}`,
            `divide by ${usNum(P)}: ${f}^(t/${h}) = ${mult}`,
            `take logs: t/${h} = log(${mult})/log(${f}) ≈ ${fmtNum(roundTo(Math.log(mult) / Math.log(f), 3))}`,
            `multiply by ${h}: t ≈ ${want} hours`,
          ].join(" → "),
        };
      }
      // Error analysis: matching bases.
      const b = pick([2, 3, 5]);
      const a = pick([-4, -3, -2, -1, 1, 2, 3, 4]);
      const k = randInt(1, maxExp(b));
      const x = k - a;
      const n = b ** k;
      const expo = lin(1, a);
      const slip = randInt(0, 2);
      const steps =
        slip === 0
          ? [`${b}^(${expo}) = ${n}`, `${b}^(${expo}) = ${b}^${k + 1}`, `${expo} = ${k + 1}`, `x = ${k + 1 - a}`]
          : slip === 1
            ? [`${b}^(${expo}) = ${n}`, `${b}^(${expo}) = ${b}^${k}`, `${expo} = ${n}`, `x = ${n - a}`]
            : [`${b}^(${expo}) = ${n}`, `${b}^(${expo}) = ${b}^${k}`, `${expo} = ${k}`, `x = ${k + a}`];
      const why =
        slip === 0
          ? `${b}^${k} = ${n}, not ${b}^${k + 1}: the power of ${b} was miscounted.`
          : slip === 1
            ? `Once both sides are powers of ${b}, the exponents are equal: ${expo} = ${k}, not ${n}.`
            : a < 0
              ? `To undo subtracting ${-a}, add ${-a} to both sides.`
              : `To undo adding ${a}, subtract ${a} from both sides.`;
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this solution of ${b}^(${expo}) = ${n}.`,
        hint: `Check the power of ${b} first, then whether the exponents were set equal, then the last step.`,
        wrongStepIndex: slip === 0 ? 1 : slip === 1 ? 2 : 3,
        steps,
        explanation: `${why} The solution is x = ${x}.`,
      };
    }),
};
