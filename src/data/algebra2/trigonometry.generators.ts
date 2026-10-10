import type { PracticeProblem, Trap } from "@/types";
import { PROBLEMS_PER_SKILL, fillToCount, fmtNum, frac, mcChoices, randInt, seededShuffle, trapsFor } from "@/lib/problem-utils";

function trap(value: number | string, why: string): Trap {
  return { value, why };
}

function pick<T>(items: readonly T[]): T {
  return items[randInt(0, items.length - 1)];
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

/** Degrees as a multiple of π: 150 → "5π/6", 180 → "π", 360 → "2π", 0 → "0". */
export function radText(deg: number): string {
  if (deg === 0) return "0";
  const g = gcd(deg, 180);
  const k = deg / g;
  const d = 180 / g;
  const sign = k < 0 ? "-" : "";
  const top = Math.abs(k) === 1 ? "π" : `${Math.abs(k)}π`;
  return d === 1 ? `${sign}${top}` : `${sign}${top}/${d}`;
}

const ROMAN = ["", "I", "II", "III", "IV"];

/** The exact values a unit-circle card can show, and what each is worth. */
const EXACT: [string, number][] = [
  ["0", 0],
  ["1", 1],
  ["−1", -1],
  ["1/2", 1 / 2],
  ["−1/2", -1 / 2],
  ["√2/2", Math.SQRT2 / 2],
  ["−√2/2", -Math.SQRT2 / 2],
  ["√3/2", Math.sqrt(3) / 2],
  ["−√3/2", -Math.sqrt(3) / 2],
  ["√3", Math.sqrt(3)],
  ["−√3", -Math.sqrt(3)],
  ["√3/3", Math.sqrt(3) / 3],
  ["−√3/3", -Math.sqrt(3) / 3],
];

/** The exact text for a value every special angle produces. */
function textOf(v: number): string {
  const hit = EXACT.find(([, x]) => Math.abs(x - v) < 1e-9);
  if (!hit) throw new Error(`no exact text for ${v}`);
  return hit[0];
}

type Fn = "sin" | "cos" | "tan";
const FNS: Fn[] = ["sin", "cos", "tan"];
function trig(fn: Fn, deg: number): number {
  const t = (deg * Math.PI) / 180;
  return fn === "sin" ? Math.sin(t) : fn === "cos" ? Math.cos(t) : Math.tan(t);
}
const flip = (t: string) => (t === "0" ? "0" : t.startsWith("−") ? t.slice(1) : `−${t}`);

/** Angles off the axes whose sin, cos and tan are all in EXACT. */
const SPECIAL = [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330];
const AXIS = [0, 90, 180, 270, 360];

const quadrantOf = (deg: number) => {
  const d = ((deg % 360) + 360) % 360;
  return d < 90 ? 1 : d < 180 ? 2 : d < 270 ? 3 : 4;
};
const refOf = (deg: number) => {
  const d = ((deg % 360) + 360) % 360;
  return d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d;
};
const signIn = (fn: Fn, q: number) => (fn === "sin" ? q <= 2 : fn === "cos" ? q === 1 || q === 4 : q === 1 || q === 3);

/** Three exact-value distractors for an answer: the sign flip, the cofunction's value, and a random other. */
function exactDistractors(answer: string, cofunction: string): string[] {
  const out: string[] = [];
  const add = (t: string) => {
    if (t !== answer && !out.includes(t)) out.push(t);
  };
  add(flip(answer));
  add(cofunction);
  add(flip(cofunction));
  for (const t of seededShuffle(EXACT.map(([s]) => s))) {
    if (out.length >= 3) break;
    add(t);
  }
  return out.slice(0, 3);
}

export const generators: Record<string, (seeds: PracticeProblem[]) => PracticeProblem[]> = {
  "radians-degrees": (seeds) =>
    fillToCount("radians-degrees", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0) {
        // Degrees to a multiple of π.
        const deg = pick([15, 20, 30, 36, 40, 45, 50, 60, 72, 75, 80, 90, 100, 105, 108, 120, 135, 140, 144, 150, 160, 180, 200, 210, 225, 240, 252, 270, 300, 315, 330, 360]);
        const answer = radText(deg);
        const cands = [deg * 2, deg / 2, 180 - deg, 360 - deg, deg + 30, deg + 180].filter((x) => Number.isInteger(x) && x > 0 && x !== deg);
        const wrong = [frac(deg, 180), ...seededShuffle(cands).slice(0, 2).map(radText)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Convert ${deg}° to radians.`,
          hint: `Multiply by π/180: ${deg}π/180, then reduce the fraction.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "Radians keep the π: the factor is π/180, not 1/180."),
            trap(wrong[1], `${deg}/180 does not reduce to that. Divide top and bottom by their greatest common factor, ${gcd(deg, 180)}.`),
            trap(wrong[2], `Start from ${deg}π/180 and reduce; check the fraction against ${deg}/180.`),
          ]),
          explanation: `${deg} × π/180 = ${deg}π/180 = ${answer}`,
        };
      }
      if (kind === 1) {
        // Radians to degrees.
        const d = pick([1, 2, 3, 4, 5, 6, 9, 10, 12, 18]);
        const k = d === 1 ? randInt(2, 4) : (() => {
          let v = randInt(1, 2 * d);
          while (gcd(v, d) !== 1) v = randInt(1, 2 * d);
          return v;
        })();
        const deg = (180 * k) / d;
        const text = radText(deg);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${text} radians to degrees.`,
          hint: `Replace π with 180°: ${k} × 180°${d === 1 ? "" : ` ÷ ${d}`}.`,
          answer: deg,
          traps: trapsFor(deg, [
            trap(d === 1 ? deg / 180 : (180 * d) / k, d === 1 ? "That drops the π. Each π is 180°." : `The fraction is ${k}/${d} of 180°, not ${d}/${k} of it.`),
            trap(k / d, "That drops the π. Each π is 180°."),
            trap((360 * k) / d, "Each π is 180°, not 360°."),
          ]),
          explanation: `${text} = ${k} × 180°${d === 1 ? "" : `/${d}`} = ${deg}°`,
        };
      }
      if (kind === 2) {
        // Arc length from a radian angle.
        const r = randInt(3, 20);
        const unit = pick(["cm", "inches", "meters", "feet"]);
        const d = pick([2, 3, 4, 5, 6]);
        let k = randInt(1, 2 * d - 1);
        while (gcd(k, d) !== 1) k = randInt(1, 2 * d - 1);
        const theta = (k * Math.PI) / d;
        const s = r * theta;
        const text = radText((180 * k) / d);
        return {
          id: "",
          type: "numeric",
          prompt: `A circle has radius ${r} ${unit}. Find the length of the arc cut off by a central angle of ${text} radians. (round to the nearest tenth)`,
          hint: "Arc length is s = rθ when θ is in radians. The angle is already in radians, so multiply.",
          answer: Math.round(s * 10) / 10,
          decimalPlaces: 1,
          traps: trapsFor(Math.round(s * 10) / 10, [
            trap(Math.round(((r * k) / d) * 10) / 10, "The π is part of the angle: θ = " + text + " ≈ " + fmtNum(Math.round(theta * 100) / 100) + "."),
            trap(Math.round((s / 2) * 10) / 10, "s = rθ uses the radius once; nothing is halved."),
            trap(Math.round(2 * s * 10) / 10, "s = rθ uses the radius, not the diameter."),
          ]),
          explanation: `s = rθ = ${r} × ${text} ≈ ${r} × ${fmtNum(Math.round(theta * 1000) / 1000)} ≈ ${fmtNum(Math.round(s * 10) / 10)} ${unit}`,
        };
      }
      if (kind === 3) {
        // Arc length from a degree angle.
        const r = randInt(4, 25);
        const unit = pick(["cm", "inches", "meters", "feet", "yards"]);
        const deg = 5 * randInt(4, 60);
        const theta = (deg * Math.PI) / 180;
        const s = r * theta;
        return {
          id: "",
          type: "numeric",
          prompt: `A circle has radius ${r} ${unit}. Find the length of the arc cut off by a central angle of ${deg}°. (round to the nearest tenth)`,
          hint: `s = rθ needs θ in radians: change ${deg}° to radians first (multiply by π/180).`,
          answer: Math.round(s * 10) / 10,
          decimalPlaces: 1,
          traps: trapsFor(Math.round(s * 10) / 10, [
            trap(r * deg, "s = rθ only works with θ in radians. Convert the degrees first."),
            trap(Math.round(((r * deg) / 180) * 10) / 10, "Converting to radians multiplies by π/180; the π is part of it."),
            trap(Math.round((s / 2) * 10) / 10, "s = rθ uses the radius once; nothing is halved."),
          ]),
          explanation: `θ = ${deg}π/180 ≈ ${fmtNum(Math.round(theta * 1000) / 1000)} → s = ${r} × ${fmtNum(Math.round(theta * 1000) / 1000)} ≈ ${fmtNum(Math.round(s * 10) / 10)} ${unit}`,
        };
      }
      if (kind === 4) {
        // Degrees to a decimal number of radians.
        const deg = 5 * randInt(2, 70);
        const rad = (deg * Math.PI) / 180;
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${deg}° to radians as a decimal. (round to the nearest hundredth)`,
          hint: "Multiply by π/180 and use π ≈ 3.1416.",
          answer: Math.round(rad * 100) / 100,
          decimalPlaces: 2,
          traps: trapsFor(Math.round(rad * 100) / 100, [
            trap(Math.round((deg / 180) * 100) / 100, "Radians are degrees × π/180; the π is part of the factor."),
            trap(Math.round(((deg * 180) / Math.PI) * 100) / 100, "180/π changes radians to degrees. Going the other way, multiply by π/180."),
            trap(Math.round(((deg * Math.PI) / 360) * 100) / 100, "A half turn, 180°, is π radians; the factor is π/180, not π/360."),
          ]),
          explanation: `${deg} × π/180 ≈ ${deg} × 0.01745 ≈ ${fmtNum(Math.round(rad * 100) / 100)}`,
        };
      }
      // Error analysis: a degree to radian conversion.
      const deg = pick([20, 30, 40, 45, 60, 75, 100, 105, 120, 135, 140, 150, 160, 210, 225, 240, 300, 315, 330]);
      const right = radText(deg);
      const slip = randInt(0, 1);
      const wrongDeg = deg + pick([30, 60, 45, -30].filter((x) => deg + x > 0 && deg + x !== deg));
      const wrongText = radText(wrongDeg);
      const approx = fmtNum(Math.round(((deg * 180) / Math.PI) * 10) / 10);
      const steps =
        slip === 0
          ? [`${deg}° × 180/π = ${deg * 180}/π`, `${deg * 180}/π ≈ ${approx}`, `So ${deg}° ≈ ${approx} radians.`]
          : [`${deg}° × π/180 = ${deg}π/180`, `${deg}π/180 = ${wrongText}`, `So ${deg}° = ${wrongText} radians.`];
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this conversion of ${deg}° to radians.`,
        hint: "Degrees to radians multiplies by π/180. Then reduce the fraction with the greatest common factor of the top and 180.",
        wrongStepIndex: slip,
        steps,
        explanation: slip === 0 ? `180/π takes radians to degrees. Degrees to radians multiplies by π/180: ${deg}π/180 = ${right}.` : `${deg}/180 reduces by ${gcd(deg, 180)} to ${frac(deg, 180)}, so ${deg}° = ${right}.`,
      };
    }),

  "unit-circle-values": (seeds) =>
    fillToCount("unit-circle-values", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0 || kind === 1) {
        // An exact value, in degrees or radians.
        const fn = pick(FNS);
        const pool = fn === "tan" ? [...SPECIAL, 0, 180] : [...SPECIAL, ...AXIS];
        const deg = pick(pool);
        const answer = textOf(trig(fn, deg));
        const co = fn === "sin" ? textOf(trig("cos", deg)) : fn === "cos" ? textOf(trig("sin", deg)) : textOf(trig("sin", deg));
        const wrong = exactDistractors(answer, co);
        const angle = kind === 0 ? `${deg}°` : radText(deg);
        const q = quadrantOf(deg);
        const onAxis = deg % 90 === 0;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Find the exact value of ${fn} ${angle}.`,
          hint: onAxis
            ? `${angle} lands on an axis. Use the point on the unit circle there: cos is its x-coordinate, sin is its y-coordinate, tan is y/x.`
            : `${kind === 1 ? `${angle} is ${deg}°. ` : ""}Find the quadrant for the sign, and the reference angle (${refOf(deg)}°) for the size.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(flip(answer), onAxis ? "Check the sign of the coordinate at that point on the circle." : `${fn === "sin" ? "Sine is the y-coordinate" : fn === "cos" ? "Cosine is the x-coordinate" : "Tangent is y/x"}, which is ${signIn(fn, q) ? "positive" : "negative"} in Quadrant ${ROMAN[q]}.`),
            trap(co, fn === "tan" ? "Tangent is sine divided by cosine, not sine alone." : `That is the ${fn === "sin" ? "cosine" : "sine"}. ${fn === "sin" ? "Sine is the y-coordinate." : "Cosine is the x-coordinate."}`),
            trap(flip(co), fn === "tan" ? "Tangent is sine divided by cosine." : `Check which coordinate you read: ${fn === "sin" ? "sine is y" : "cosine is x"}.`),
          ]),
          explanation: onAxis
            ? `${angle} is on the axis at the point (${textOf(Math.cos((deg * Math.PI) / 180))}, ${textOf(Math.sin((deg * Math.PI) / 180))}) → ${fn} ${angle} = ${answer}`
            : `Quadrant ${ROMAN[q]}, reference angle ${refOf(deg)}° → ${fn} ${angle} = ${signIn(fn, q) ? "+" : "−"}${fn} ${refOf(deg)}° = ${answer}`,
        };
      }
      if (kind === 2) {
        // Which quadrant: from the angle, or from the signs.
        if (randInt(0, 1) === 0) {
          let deg = randInt(1, 359);
          while (deg % 90 === 0) deg = randInt(1, 359);
          const shown = pick([deg, deg, -deg, deg + 360]);
          const q = quadrantOf(shown);
          return {
            id: "",
            type: "numeric",
            prompt: `In which quadrant does an angle of ${shown}° in standard position lie? (answer 1, 2, 3 or 4)`,
            hint: shown === deg ? "Quadrant I is 0° to 90°, II is 90° to 180°, III is 180° to 270°, IV is 270° to 360°." : `First find the coterminal angle between 0° and 360° by ${shown < 0 ? "adding" : "subtracting"} 360°.`,
            answer: q,
            traps: trapsFor(q, [
              trap((q % 4) + 1, `Compare the angle with the boundaries 90°, 180°, 270°: it has not passed ${q * 90}°.`),
              trap(((q + 2) % 4) + 1, shown < 0 ? "A negative angle turns clockwise. Add 360° to find where it lands." : `Compare the angle with the boundaries 90°, 180°, 270°.`),
              trap(quadrantOf(Math.abs(shown)), "A negative angle turns clockwise from the positive x-axis, so it does not land where the positive angle does."),
            ]),
            explanation: `${shown !== deg ? `${shown}° is coterminal with ${((shown % 360) + 360) % 360}°. ` : ""}${(q - 1) * 90}° < ${((shown % 360) + 360) % 360}° < ${q * 90}° → Quadrant ${ROMAN[q]}`,
          };
        }
        const [f1, f2] = seededShuffle(FNS).slice(0, 2) as [Fn, Fn];
        const q = randInt(1, 4);
        const s1 = signIn(f1, q);
        const s2 = signIn(f2, q);
        const other = [1, 2, 3, 4].filter((qq) => qq !== q);
        return {
          id: "",
          type: "numeric",
          prompt: `${f1} θ ${s1 ? ">" : "<"} 0 and ${f2} θ ${s2 ? ">" : "<"} 0. In which quadrant does θ lie? (answer 1, 2, 3 or 4)`,
          hint: "Sine is positive above the x-axis (I, II), cosine is positive right of the y-axis (I, IV), and tangent is positive where they agree (I, III).",
          answer: q,
          traps: trapsFor(
            q,
            other.map((qq) => trap(qq, `In Quadrant ${ROMAN[qq]}, ${signIn(f1, qq) === s1 ? `${f2} θ is ${signIn(f2, qq) ? "positive" : "negative"}` : `${f1} θ is ${signIn(f1, qq) ? "positive" : "negative"}`}.`)),
          ),
          explanation: `${f1} ${s1 ? "> 0" : "< 0"} in ${[1, 2, 3, 4].filter((qq) => signIn(f1, qq) === s1).map((qq) => ROMAN[qq]).join(", ")}; ${f2} ${s2 ? "> 0" : "< 0"} in ${[1, 2, 3, 4].filter((qq) => signIn(f2, qq) === s2).map((qq) => ROMAN[qq]).join(", ")} → Quadrant ${ROMAN[q]}`,
        };
      }
      if (kind === 3) {
        // The sign of a function in a quadrant.
        const fn = pick(FNS);
        const q = randInt(1, 4);
        const answer = signIn(fn, q) ? "Positive" : "Negative";
        const wrong = [signIn(fn, q) ? "Negative" : "Positive", "Zero", "It depends on the angle"];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the sign of ${fn} θ when θ is in Quadrant ${ROMAN[q]}?`,
          hint: `In Quadrant ${ROMAN[q]}, x is ${q === 1 || q === 4 ? "positive" : "negative"} and y is ${q <= 2 ? "positive" : "negative"}. cos is x, sin is y, tan is y/x.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], fn === "tan" ? `Tangent is y/x. In Quadrant ${ROMAN[q]} the signs of x and y ${q === 1 || q === 3 ? "agree" : "differ"}.` : `${fn === "sin" ? "Sine is the y-coordinate" : "Cosine is the x-coordinate"}; check its sign in Quadrant ${ROMAN[q]}.`),
            trap("Zero", "A trig value is zero only on an axis, and an angle inside a quadrant is off the axes."),
            trap("It depends on the angle", "Every angle inside one quadrant has the same sign for each function."),
          ]),
          explanation: `Quadrant ${ROMAN[q]}: x ${q === 1 || q === 4 ? "> 0" : "< 0"}, y ${q <= 2 ? "> 0" : "< 0"} → ${fn} θ is ${answer.toLowerCase()}`,
        };
      }
      if (kind === 4) {
        // The angle in a quadrant with a given exact value.
        const fn = pick(FNS);
        const base = pick([30, 45, 60]);
        const q = randInt(1, 4);
        const deg = q === 1 ? base : q === 2 ? 180 - base : q === 3 ? 180 + base : 360 - base;
        const v = textOf(trig(fn, deg));
        const others = [base, 180 - base, 180 + base, 360 - base].filter((a) => a !== deg);
        return {
          id: "",
          type: "numeric",
          prompt: `Find the angle θ with 0° ≤ θ < 360° in Quadrant ${ROMAN[q]} where ${fn} θ = ${v}.`,
          hint: `The size ${flip(v).startsWith("−") ? v : flip(v)} belongs to a ${base}° reference angle. Place that reference angle in Quadrant ${ROMAN[q]}.`,
          answer: deg,
          traps: trapsFor(deg, [
            trap(base, q === 1 ? "" : `${base}° is the reference angle. It sits in Quadrant I; move it to Quadrant ${ROMAN[q]}.`),
            ...others.filter((a) => a !== base).map((a) => trap(a, `${a}° is in Quadrant ${ROMAN[quadrantOf(a)]}, and the angle must be in Quadrant ${ROMAN[q]}.`)),
          ]),
          explanation: `reference angle ${base}° → Quadrant ${ROMAN[q]}: θ = ${q === 1 ? `${base}°` : q === 2 ? `180° − ${base}° = ${deg}°` : q === 3 ? `180° + ${base}° = ${deg}°` : `360° − ${base}° = ${deg}°`}`,
        };
      }
      // Error analysis: tangent from sine and cosine.
      const deg = pick(SPECIAL);
      const s = trig("sin", deg);
      const c = trig("cos", deg);
      const slip = randInt(0, 2);
      const shownS = slip === 0 ? -s : s;
      const shownC = slip === 1 ? (Math.abs(Math.abs(s) - Math.abs(c)) < 1e-9 ? -c : Math.sign(c) * Math.abs(s)) : c;
      // Dividing the wrong way round shows up only when the sizes differ; on the 45° family the slip is a sign error instead.
      const shownT = slip === 2 ? (Math.abs(Math.abs(s) - Math.abs(c)) < 1e-9 ? -s / c : c / s) : shownS / shownC;
      const steps = [`sin ${deg}° = ${textOf(shownS)}`, `cos ${deg}° = ${textOf(shownC)}`, `tan ${deg}° = sin ÷ cos = ${textOf(shownT)}`];
      const q = quadrantOf(deg);
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this evaluation of tan ${deg}° from sine and cosine.`,
        hint: `${deg}° is in Quadrant ${ROMAN[q]} with reference angle ${refOf(deg)}°. Check each value's size and sign, then the division.`,
        wrongStepIndex: slip,
        steps,
        explanation:
          slip === 0
            ? `Sine is the y-coordinate, ${signIn("sin", q) ? "positive" : "negative"} in Quadrant ${ROMAN[q]}: sin ${deg}° = ${textOf(s)}, so tan ${deg}° = ${textOf(s / c)}.`
            : slip === 1
              ? `cos ${refOf(deg)}° is ${textOf(Math.abs(c))} and cosine is ${signIn("cos", q) ? "positive" : "negative"} in Quadrant ${ROMAN[q]}: cos ${deg}° = ${textOf(c)}, so tan ${deg}° = ${textOf(s / c)}.`
              : Math.abs(Math.abs(s) - Math.abs(c)) < 1e-9
                ? `Tangent is y/x, ${signIn("tan", q) ? "positive" : "negative"} in Quadrant ${ROMAN[q]}: ${textOf(s)} ÷ ${textOf(c)} = ${textOf(s / c)}.`
                : `Tangent is sine divided by cosine, not cosine divided by sine: ${textOf(s)} ÷ ${textOf(c)} = ${textOf(s / c)}.`,
      };
    }),

  "reference-angles": (seeds) =>
    fillToCount("reference-angles", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 6;
      if (kind === 0 || kind === 1) {
        // A reference angle in degrees, of a plain angle or one off the first turn.
        let deg = randInt(91, 359);
        while (deg % 90 === 0) deg = randInt(91, 359);
        const shown = kind === 0 ? deg : pick([-deg, deg + 360, deg + 720, -(deg + 360)]);
        const ref = refOf(shown);
        const norm = ((shown % 360) + 360) % 360;
        const q = quadrantOf(norm);
        return {
          id: "",
          type: "numeric",
          prompt: kind === 0 ? `Find the reference angle of ${deg}°.` : `Find the reference angle of an angle measuring ${shown}°.`,
          hint: kind === 0 ? `${deg}° is in Quadrant ${ROMAN[q]}. Measure the acute angle to the nearest part of the x-axis (0°, 180° or 360°).` : `First find the coterminal angle between 0° and 360° (${shown < 0 ? "add" : "subtract"} 360° as needed), then measure to the x-axis.`,
          answer: ref,
          traps: trapsFor(ref, [
            trap(norm, "A reference angle is acute: the angle to the x-axis, not the whole angle."),
            trap(q === 3 ? 360 - norm : q === 2 ? norm - 90 : q === 4 ? norm - 180 : 90 - norm, "Measure to the x-axis, not to the y-axis or to the wrong end of the x-axis."),
            trap(Math.abs(shown) > 360 || shown < 0 ? refOf(Math.abs(shown) % 360 === 0 ? 1 : Math.abs(shown)) : 180 - norm, shown < 0 ? "A negative angle turns clockwise; add 360° first, then find the quadrant." : "Measure to the nearest end of the x-axis."),
            trap(Math.abs(shown) - 180, "Subtracting 180° only works for Quadrant III angles between 180° and 270°."),
          ]),
          explanation: `${shown !== norm ? `${shown}° is coterminal with ${norm}°. ` : ""}${norm}° is in Quadrant ${ROMAN[q]} → reference angle ${q === 2 ? `180° − ${norm}°` : q === 3 ? `${norm}° − 180°` : q === 4 ? `360° − ${norm}°` : `${norm}°`} = ${ref}°`,
        };
      }
      if (kind === 2) {
        // A reference angle in radians.
        const deg = pick([120, 135, 150, 210, 225, 240, 300, 315, 330, 390, 405, 420, 480, 495, 510, 570, 585, 600]);
        const norm = deg % 360;
        const ref = refOf(deg);
        const answer = radText(ref);
        const given = radText(deg);
        const pool = ["π/6", "π/4", "π/3", "2π/3", "3π/4", "5π/6", "π/2"].filter((t) => t !== answer);
        const wrong = [radText(norm) !== answer ? radText(norm) : "π/2", ...seededShuffle(pool).slice(0, 2)];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Find the reference angle of ${given}.`,
          hint: `${given} is ${deg}°${deg > 360 ? `, coterminal with ${norm}°` : ""}. Find the acute angle to the x-axis, then write it in radians.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], "A reference angle is acute, between 0 and π/2: measure from the terminal side to the x-axis."),
            trap(wrong[1], `${norm}° is in Quadrant ${ROMAN[quadrantOf(norm)]}; measure from ${quadrantOf(norm) === 2 || quadrantOf(norm) === 3 ? "π (180°)" : "2π (360°)"} to get the reference angle.`),
            trap(wrong[2], `Check in degrees: the reference angle of ${norm}° is ${ref}°.`),
          ]),
          explanation: `${given} = ${deg}°${deg > 360 ? ` → ${norm}°` : ""}, Quadrant ${ROMAN[quadrantOf(norm)]} → reference angle ${ref}° = ${answer}`,
        };
      }
      if (kind === 3) {
        // A coterminal angle in [0, 360).
        const base = randInt(1, 359);
        const shown = pick([-base, -base, base + 360, base + 720, -(base + 360), base + 1080]);
        const want = ((shown % 360) + 360) % 360;
        const turns = Math.abs(Math.floor(shown / 360));
        return {
          id: "",
          type: "numeric",
          prompt: `Find the angle between 0° and 360° that is coterminal with ${shown}°.`,
          hint: `${shown < 0 ? "Add" : "Subtract"} 360° ${turns === 1 ? "once" : `${turns} times`} to land between 0° and 360°.`,
          answer: want,
          traps: trapsFor(want, [
            trap(360 - want, shown < 0 ? "Changing the sign is a different angle. Add 360° instead." : "Subtract 360° to go around the circle, not 180°."),
            trap(shown < 0 ? shown + 360 * (turns - 1) : shown - 360 * (turns - 1), `One full turn of 360° is not enough here; keep going until the angle is between 0° and 360°.`),
            trap(shown < 0 ? want - 360 : want + 360, "That angle is coterminal, but it is outside 0° to 360°."),
            trap(want - 180 < 0 ? want + 180 : want - 180, "Adding or subtracting 180° points the angle the opposite way."),
          ]),
          explanation: `${shown}° ${shown < 0 ? "+" : "−"} ${turns} × 360° = ${want}°`,
        };
      }
      if (kind === 4) {
        // One trig value from another, with the quadrant setting the sign.
        const [a, b, c] = pick([
          [3, 4, 5],
          [4, 3, 5],
          [5, 12, 13],
          [12, 5, 13],
          [8, 15, 17],
          [15, 8, 17],
          [7, 24, 25],
          [24, 7, 25],
        ]);
        const given: Fn = pick(["sin", "cos"]);
        const wantFn: Fn = given === "sin" ? "cos" : "sin";
        const q = randInt(1, 4);
        const gSign = signIn(given, q) ? "" : "−";
        const wSign = signIn(wantFn, q) ? "" : "−";
        const givenText = `${gSign}${a}/${c}`;
        const answer = `${wSign}${b}/${c}`;
        const wrong = [`${wSign ? "" : "−"}${b}/${c}`, givenText, `${gSign ? "" : "−"}${a}/${c}`];
        return {
          id: "",
          type: "multiple-choice",
          prompt: `${given} θ = ${givenText} and θ is in Quadrant ${ROMAN[q]}. Find ${wantFn} θ.`,
          hint: `sin²θ + cos²θ = 1 gives the size: ${wantFn} θ = ±√(1 − ${a * a}/${c * c}). The quadrant decides the sign.`,
          answer,
          choices: mcChoices(answer, wrong),
          traps: trapsFor(answer, [
            trap(wrong[0], `${wantFn === "sin" ? "Sine is the y-coordinate" : "Cosine is the x-coordinate"}, which is ${signIn(wantFn, q) ? "positive" : "negative"} in Quadrant ${ROMAN[q]}.`),
            trap(wrong[1], `That is ${given} θ. Use sin²θ + cos²θ = 1 to find the other one.`),
            trap(wrong[2], `That is ${given} θ with its sign changed. Use sin²θ + cos²θ = 1.`),
          ]),
          explanation: `${wantFn}²θ = 1 − ${a * a}/${c * c} = ${b * b}/${c * c} → ${wantFn} θ = ±${b}/${c}; Quadrant ${ROMAN[q]} makes it ${answer}`,
        };
      }
      // Error analysis: a trig value by reference angle.
      const deg = pick(SPECIAL.filter((d) => d > 90));
      const fn = pick(FNS);
      const q = quadrantOf(deg);
      const ref = refOf(deg);
      const v = trig(fn, deg);
      const slip = randInt(0, 2);
      const badQ = (q % 4) + 1;
      const badRef = q === 4 ? deg - 180 : 360 - deg;
      const shownQ = slip === 0 ? badQ : q;
      const shownRef = slip === 1 ? badRef : ref;
      const shownRefExpr = slip === 1 ? (q === 4 ? `${deg}° − 180°` : `360° − ${deg}°`) : q === 2 ? `180° − ${deg}°` : q === 3 ? `${deg}° − 180°` : `360° − ${deg}°`;
      const sign = signIn(fn, q);
      const shownVal = slip === 2 ? -v : slip === 1 ? (sign ? 1 : -1) * Math.abs(trig(fn, badRef)) : v;
      const steps = [`${deg}° is in Quadrant ${ROMAN[shownQ]}.`, `Reference angle: ${shownRefExpr} = ${shownRef}°`, `${fn} is ${(slip === 2 ? !sign : sign) ? "positive" : "negative"} in Quadrant ${ROMAN[q]}, so ${fn} ${deg}° = ${textOf(shownVal)}`];
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error in this evaluation of ${fn} ${deg}° using a reference angle.`,
        hint: "Check the quadrant against 90°, 180°, 270°; the reference angle is measured to the x-axis; the sign comes from the quadrant.",
        wrongStepIndex: slip,
        steps,
        explanation:
          slip === 0
            ? `${(q - 1) * 90}° < ${deg}° < ${q * 90}°, so it is in Quadrant ${ROMAN[q]}. The rest follows: reference angle ${ref}°, ${fn} ${deg}° = ${textOf(v)}.`
            : slip === 1
              ? `In Quadrant ${ROMAN[q]} the reference angle is ${q === 2 ? `180° − ${deg}°` : q === 3 ? `${deg}° − 180°` : `360° − ${deg}°`} = ${ref}°, so ${fn} ${deg}° = ${textOf(v)}.`
              : `${fn === "sin" ? "Sine is the y-coordinate" : fn === "cos" ? "Cosine is the x-coordinate" : "Tangent is y/x"}, ${sign ? "positive" : "negative"} in Quadrant ${ROMAN[q]}: ${fn} ${deg}° = ${textOf(v)}.`,
      };
    }),
};
