import type { PracticeProblem } from "@/types";
import {
  fillToCount,
  hashString,
  mcChoices,
  PROBLEMS_PER_SKILL,
  randInt,
  uniqueByPrompt,
  withSeededGeneration,
} from "@/lib/problem-utils";

function fmtSigned(n: number): string {
  return n >= 0 ? `${n}` : `${n}`;
}

type SkillGenerator = (seeds: PracticeProblem[]) => PracticeProblem[];

const generators: Record<string, SkillGenerator> = {
  "unit-basics": (seeds) =>
    fillToCount("unit-basics", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const miles = randInt(2, 12);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${miles} miles to feet. (1 mile = 5280 ft)`,
          hint: `Multiply ${miles} × 5280.`,
          answer: miles * 5280,
          explanation: `${miles} × 5280 = ${(miles * 5280).toLocaleString()} feet`,
        };
      }
      if (kind === 1) {
        const inches = randInt(12, 240);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${inches} inches to feet.`,
          hint: "Divide by 12.",
          answer: inches / 12,
          explanation: `${inches} ÷ 12 = ${inches / 12} feet`,
        };
      }
      if (kind === 2) {
        const km = randInt(2, 15);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${km} kilometers to meters.`,
          hint: "Multiply by 1000.",
          answer: km * 1000,
          explanation: `${km} × 1000 = ${km * 1000} meters`,
        };
      }
      const lbs = randInt(2, 20);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which conversion factor converts pounds to ounces? (1 lb = 16 oz)`,
        hint: "You need ounces on top to cancel pounds.",
        answer: "16 oz / 1 lb",
        choices: mcChoices("16 oz / 1 lb", ["1 lb / 16 oz", "16 lb / 1 oz", "1 oz / 16 lb"]),
        explanation: "Multiply by 16 oz / 1 lb to convert pounds to ounces.",
      };
    }),

  "dimensional-analysis": (seeds) =>
    fillToCount("dimensional-analysis", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 5;
      if (kind === 0) {
        const hours = randInt(1, 24);
        const half = randInt(0, 1) === 1;
        const total = half ? hours + 0.5 : hours;
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${total} hours to seconds.`,
          hint: "1 hour = 3600 seconds.",
          answer: total * 3600,
          explanation: `${total} × 3600 = ${total * 3600} seconds`,
        };
      }
      if (kind === 1) {
        const days = randInt(2, 30);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${days} days to hours.`,
          hint: "Multiply by 24.",
          answer: days * 24,
          explanation: `${days} × 24 = ${days * 24} hours`,
        };
      }
      if (kind === 2) {
        const km = randInt(2, 9);
        const wrongFactor = randInt(2, 9);
        return {
          id: "",
          type: "error-analysis",
          prompt: `Find the error converting ${km} km to centimeters.`,
          hint: "Check whether each conversion factor is inverted correctly.",
          wrongStepIndex: 1,
          steps: [
            `${km} km × 1000 m/km = ${km * 1000} m`,
            `${km * 1000} m × 1/${wrongFactor} m/cm = ${(km * 1000) / wrongFactor} cm`,
            "Done",
          ],
          explanation: `Should multiply by 100 cm/m, giving ${km * 1000 * 100} cm.`,
        };
      }
      if (kind === 3) {
        const kg = randInt(2, 25);
        return {
          id: "",
          type: "numeric",
          prompt: `Convert ${kg} kilograms to grams.`,
          hint: "1 kg = 1000 g.",
          answer: kg * 1000,
          explanation: `${kg} × 1000 = ${kg * 1000} grams`,
        };
      }
      const minutes = randInt(2, 20);
      return {
        id: "",
        type: "numeric",
        prompt: `Convert ${minutes} minutes to milliseconds.`,
        hint: "1 minute = 60 seconds = 60,000 milliseconds.",
        answer: minutes * 60000,
        explanation: `${minutes} × 60,000 = ${(minutes * 60000).toLocaleString()} milliseconds`,
      };
    }),

  "unit-word-problems": (seeds) =>
    fillToCount("unit-word-problems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const ml = randInt(2, 9) * 250;
        return {
          id: "",
          type: "numeric",
          prompt: `A recipe needs ${ml} mL of water. How many liters is that?`,
          hint: "1000 mL = 1 L",
          answer: ml / 1000,
          explanation: `${ml} ÷ 1000 = ${ml / 1000} liters`,
        };
      }
      if (kind === 1) {
        const miles = randInt(10, 30) * 5;
        const gallons = randInt(2, 8);
        const mpg = miles / gallons;
        return {
          id: "",
          type: "numeric",
          prompt: `You drive ${miles} miles using ${gallons} gallons of gas. How many miles per gallon?`,
          hint: "Divide miles by gallons.",
          answer: mpg,
          explanation: `${miles} ÷ ${gallons} = ${mpg} mpg`,
        };
      }
      const speed = randInt(40, 70);
      const hours = randInt(2, 6);
      return {
        id: "",
        type: "numeric",
        prompt: `A train travels ${speed} mph for ${hours} hours. How many miles?`,
        hint: "Distance = rate × time.",
        answer: speed * hours,
        explanation: `${speed} × ${hours} = ${speed * hours} miles`,
      };
    }),

  "one-step-equations": (seeds) =>
    fillToCount("one-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const x = randInt(2, 25);
        const a = randInt(3, 15);
        const c = x + a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x + ${a} = ${c}`,
          hint: `Subtract ${a} from both sides.`,
          answer: x,
          explanation: `x = ${c} − ${a} = ${x}`,
        };
      }
      if (kind === 1) {
        const x = randInt(2, 20);
        const a = randInt(3, 12);
        const c = x - a;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: x − ${a} = ${c}`,
          hint: `Add ${a} to both sides.`,
          answer: x,
          explanation: `x = ${c} + ${a} = ${x}`,
        };
      }
      if (kind === 2) {
        const x = randInt(2, 15);
        const a = randInt(2, 9);
        const c = a * x;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}x = ${c}`,
          hint: `Divide both sides by ${a}.`,
          answer: x,
          explanation: `x = ${c} ÷ ${a} = ${x}`,
        };
      }
      const x = randInt(2, 12);
      const a = randInt(2, 8);
      const c = a * x;
      const wrong = c + a;
      return {
        id: "",
        type: "error-analysis",
        prompt: `Find the error: ${a}x = ${c}`,
        hint: "Check whether the correct inverse operation was used.",
        wrongStepIndex: 1,
        steps: [`${a}x = ${c}`, `x = ${c} + ${a}`, `x = ${wrong}`],
        explanation: `Should divide: x = ${c} ÷ ${a} = ${x}.`,
      };
    }),

  "two-step-equations": (seeds) =>
    fillToCount("two-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a = randInt(2, 6);
      const x = randInt(2, 12);
      const b = randInt(1, 10);
      const c = a * x + b;
      if (i % 5 === 0) {
        return {
          id: "",
          type: "step-order",
          prompt: `Order the steps to solve ${a}x + ${b} = ${c}:`,
          hint: "Undo addition/subtraction before division.",
          correctOrder: [0, 1, 2],
          steps: [
            `Subtract ${b}: ${a}x = ${a * x}`,
            `Divide by ${a}: x = ${x}`,
            `Check: ${a}(${x}) + ${b} = ${c} ✓`,
          ],
          explanation: "Subtract the constant, then divide by the coefficient.",
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: ${a}x + ${b} = ${c}`,
        hint: `Subtract ${b}, then divide by ${a}.`,
        answer: x,
        explanation: `${a}x = ${a * x} → x = ${x}`,
      };
    }),

  "multi-step-equations": (seeds) =>
    fillToCount("multi-step-equations", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const x = randInt(2, 10);
        const a = randInt(2, 5);
        const b = randInt(1, 8);
        const c = a * (x + b);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}(x + ${b}) = ${c}`,
          hint: "Divide by the outside number first, or distribute.",
          answer: x,
          explanation: `x + ${b} = ${x + b} → x = ${x}`,
        };
      }
      if (kind === 1) {
        const x = randInt(2, 12);
        const a = randInt(2, 5);
        const b = randInt(1, 6);
        const c = a * x + b;
        return {
          id: "",
          type: "numeric",
          prompt: `Solve for x: ${a}x + ${b} = ${c}`,
          hint: "Isolate the x term first.",
          answer: x,
          explanation: `${a}x = ${a * x} → x = ${x}`,
        };
      }
      const x = randInt(3, 10);
      const left = 2 * x + 4;
      const right = x + x + 6;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: 3x + 2 = x + ${2 * x + 2}`,
        hint: "Move all x terms to one side.",
        answer: x,
        explanation: `2x = ${2 * x} → x = ${x}`,
      };
    }),

  "equations-with-fractions": (seeds) =>
    fillToCount("equations-with-fractions", seeds, PROBLEMS_PER_SKILL, (i) => {
      const d = [2, 3, 4, 6][i % 4];
      const x = randInt(3, 20);
      const b = randInt(1, 8);
      const c = x / d + b;
      if (i % 4 === 3) {
        const nums = [2, 3, 6];
        const lcd = 6;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the LCD of 1/2, 1/3, and 1/6?`,
          hint: "Find the least common multiple of the denominators.",
          answer: `${lcd}`,
          choices: mcChoices(`${lcd}`, ["3", "12", "18"]),
          explanation: `LCM of ${nums.join(", ")} is ${lcd}.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: x/${d} + ${b} = ${c}`,
        hint: `Subtract ${b}, then multiply by ${d}.`,
        answer: x,
        explanation: `x/${d} = ${x / d} → x = ${x}`,
      };
    }),

  "linear-inequalities": (seeds) =>
    fillToCount("linear-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      if (i % 7 === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `When do you flip the inequality sign? (Review ${Math.floor(i / 7) + 1})`,
          hint: "Think about multiplying or dividing by a negative.",
          answer: "When multiplying or dividing by a negative",
          choices: mcChoices("When multiplying or dividing by a negative", [
            "When adding a negative",
            "When subtracting",
            "Never",
          ]),
          explanation: "Multiplying/dividing by a negative reverses the inequality.",
        };
      }
      const a = randInt(2, 5);
      const x = randInt(2, 12);
      const b = randInt(1, 8);
      const boundary = a * x + b;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve for x: ${a}x + ${b} > ${boundary}. What number does x have to be greater than?`,
        hint: `Subtract ${b}, then divide by ${a}.`,
        answer: x,
        explanation: `${a}x > ${a * x} → x > ${x}`,
      };
    }),

  "coordinate-plane": (seeds) =>
    fillToCount("coordinate-plane", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x = randInt(-8, 8) || 1;
      const y = randInt(-8, 8) || 2;
      if (i % 2 === 0) {
        const quadrant =
          x > 0 && y > 0
            ? "Quadrant I"
            : x < 0 && y > 0
              ? "Quadrant II"
              : x < 0 && y < 0
                ? "Quadrant III"
                : "Quadrant IV";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `In which quadrant is the point (${fmtSigned(x)}, ${fmtSigned(y)})?`,
          hint: "Check the signs of x and y.",
          answer: quadrant,
          choices: mcChoices(quadrant, ["Quadrant I", "Quadrant II", "Quadrant III", "Quadrant IV"]),
          explanation: `(${fmtSigned(x)}, ${fmtSigned(y)}) is in ${quadrant}.`,
        };
      }
      const askX = i % 4 === 1;
      return {
        id: "",
        type: "numeric",
        prompt: askX
          ? `What is the x-coordinate of (${fmtSigned(x)}, ${fmtSigned(y)})?`
          : `What is the y-coordinate of (${fmtSigned(x)}, ${fmtSigned(y)})?`,
        hint: askX ? "x comes first in (x, y)." : "y comes second in (x, y).",
        answer: askX ? x : y,
        explanation: askX ? `The x-coordinate is ${x}.` : `The y-coordinate is ${y}.`,
      };
    }),

  slope: (seeds) =>
    fillToCount("slope", seeds, PROBLEMS_PER_SKILL, (i) => {
      if (i % 6 === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the slope of a horizontal line? (Review ${Math.floor(i / 6) + 1})`,
          hint: "No rise.",
          answer: "0",
          choices: mcChoices("0", ["1", "Undefined", "−1"]),
          explanation: "Horizontal lines have slope 0.",
        };
      }
      if (i % 6 === 1) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the slope of a vertical line? (Review ${Math.floor(i / 6) + 1})`,
          hint: "Run equals zero.",
          answer: "Undefined",
          choices: mcChoices("Undefined", ["0", "1", "−1"]),
          explanation: "Vertical lines have undefined slope.",
        };
      }
      const x1 = randInt(0, 4);
      const y1 = randInt(0, 4);
      const run = randInt(1, 6);
      const rise = randInt(1, 6);
      const x2 = x1 + run;
      const y2 = y1 + rise;
      return {
        id: "",
        type: "numeric",
        prompt: `Find the slope between (${x1}, ${y1}) and (${x2}, ${y2}).`,
        hint: "m = (y₂ − y₁) / (x₂ − x₁)",
        answer: rise / run,
        explanation: `m = (${y2} − ${y1}) / (${x2} − ${x1}) = ${rise / run}`,
      };
    }),

  "graphing-lines": (seeds) =>
    fillToCount("graphing-lines", seeds, PROBLEMS_PER_SKILL, (i) => {
      const m = randInt(-4, 4) || 2;
      const b = randInt(-6, 6);
      if (i % 2 === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the y-intercept of y = ${fmtSigned(m)}x ${b >= 0 ? "+ " + b : "− " + Math.abs(b)}?`,
          hint: "b in y = mx + b",
          answer: `${b}`,
          choices: mcChoices(`${b}`, [`${m}`, `${-b}`, `${m + b}`]),
          explanation: `The y-intercept is ${b}.`,
        };
      }
      const x = randInt(-4, 6);
      return {
        id: "",
        type: "numeric",
        prompt: `For y = ${m}x + ${b}, what is y when x = ${x}?`,
        hint: `Substitute x = ${x}.`,
        answer: m * x + b,
        explanation: `y = ${m}(${x}) + ${b} = ${m * x + b}`,
      };
    }),

  intercepts: (seeds) =>
    fillToCount("intercepts", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a = randInt(1, 5);
      const b = randInt(1, 5);
      const c = a * randInt(2, 10);
      if (i % 2 === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Find the x-intercept of ${a}x + y = ${c}.`,
          hint: "Set y = 0.",
          answer: c / a,
          explanation: `${a}x = ${c} → x = ${c / a}`,
        };
      }
      const d = randInt(1, 5);
      const e = randInt(1, 5);
      const f = e * randInt(2, 8);
      return {
        id: "",
        type: "numeric",
        prompt: `Find the y-intercept of ${d}x − ${e}y = ${f}.`,
        hint: "Set x = 0.",
        answer: -f / e,
        explanation: `−${e}y = ${f} → y = ${-f / e}`,
      };
    }),

  "slope-intercept": (seeds) =>
    fillToCount("slope-intercept", seeds, PROBLEMS_PER_SKILL, (i) => {
      const m = randInt(-5, 5) || 3;
      const b = randInt(-6, 6);
      if (i % 2 === 0) {
        const eq = `y = ${fmtSigned(m)}x ${b >= 0 ? "+ " + b : "− " + Math.abs(b)}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which equation has slope ${m} and y-intercept ${b}?`,
          hint: "Use y = mx + b.",
          answer: eq,
          choices: mcChoices(eq, [
            `y = ${fmtSigned(b)}x + ${m}`,
            `y = ${fmtSigned(-m)}x + ${b}`,
            `y = ${fmtSigned(m)}x + ${b + 2}`,
          ]),
          explanation: `${eq} has m = ${m} and b = ${b}.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `In y = ${fmtSigned(m)}x + ${b}, what is the slope?`,
        hint: "Slope is the coefficient of x.",
        answer: m,
        explanation: `The slope is ${m}.`,
      };
    }),

  "point-slope": (seeds) =>
    fillToCount("point-slope", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x1 = randInt(1, 6);
      const y1 = randInt(1, 10);
      const m = randInt(-4, 4) || 2;
      const correct = `y − ${y1} = ${fmtSigned(m)}(x − ${x1})`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Line through (${x1}, ${y1}) with slope ${m}. Which is point-slope form?`,
        hint: "Use y − y₁ = m(x − x₁).",
        answer: correct,
        choices: mcChoices(correct, [
          `y − ${x1} = ${fmtSigned(m)}(x − ${y1})`,
          `y = ${fmtSigned(m)}x + ${y1}`,
          `y = ${fmtSigned(m)}x − ${x1}`,
        ]),
        explanation: `${correct}`,
      };
    }),

  "standard-form": (seeds) =>
    fillToCount("standard-form", seeds, PROBLEMS_PER_SKILL, () => {
      const m = randInt(-4, 4) || 2;
      const b = randInt(-6, 6);
      const correct = `y = ${fmtSigned(m)}x ${b >= 0 ? "+ " + b : "− " + Math.abs(b)}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Convert ${fmtSigned(-m)}x + y = ${b} to slope-intercept form.`,
        hint: "Solve for y.",
        answer: correct,
        choices: mcChoices(correct, [
          `y = ${fmtSigned(-m)}x + ${b}`,
          `y = ${fmtSigned(m)}x − ${b}`,
          `y = ${b}x + ${m}`,
        ]),
        explanation: `Add ${fmtSigned(m)}x to both sides to get ${correct}.`,
      };
    }),

  "parallel-perpendicular": (seeds) =>
    fillToCount("parallel-perpendicular", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const m = randInt(2, 12) * (randInt(0, 1) === 1 ? -1 : 1) || 2;
        return {
          id: "",
          type: "numeric",
          prompt: `Line A has slope ${m}. What slope is perpendicular to A?`,
          hint: "Use the negative reciprocal.",
          answer: -1 / m,
          explanation: `Perpendicular slope = −1/${m} = ${-1 / m}`,
        };
      }
      if (kind === 1) {
        const m = randInt(2, 9);
        const b = randInt(1, 12);
        const parallel = `y = ${m}x − ${randInt(1, 10)}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which line is parallel to y = ${m}x + ${b}?`,
          hint: "Parallel lines have the same slope.",
          answer: parallel,
          choices: mcChoices(parallel, [
            `y = ${-m}x + ${b}`,
            `y = ${1 / m}x + ${b}`,
            `y = ${-1 / m}x + ${b + 4}`,
          ]),
          explanation: `${parallel} has the same slope ${m}.`,
        };
      }
      const m1 = randInt(2, 9);
      const m2 = randInt(2, 9);
      const other = `−1/${m1}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `A line has slope ${m1}. Which slope makes a line perpendicular to it?`,
        hint: "Perpendicular slopes are negative reciprocals of each other.",
        answer: other,
        choices: mcChoices(other, [`${m1}`, `${-m1}`, `${m2}`]),
        explanation: `Perpendicular slope = −1/${m1}.`,
      };
    }),

  "graphing-systems": (seeds) =>
    fillToCount("graphing-systems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x = randInt(1, 6);
      const y = randInt(1, 8);
      const b1 = y - x;
      const b2 = y + x;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Where do y = x + ${b1} and y = −x + ${b2} intersect?`,
        hint: "Set the equations equal.",
        answer: `(${x}, ${y})`,
        choices: mcChoices(`(${x}, ${y})`, [`(${y}, ${x})`, `(${x + 1}, ${y})`, `(0, ${b2})`]),
        explanation: `x + ${b1} = −x + ${b2} → x = ${x}, y = ${y}`,
      };
    }),

  substitution: (seeds) =>
    fillToCount("substitution", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x = randInt(2, 8);
      const m = randInt(1, 4);
      const b = randInt(1, 6);
      const y = m * x + b;
      const sum = x + y;
      if (i % 2 === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Solve: y = ${m}x + ${b} and x + y = ${sum}. What is x?`,
          hint: `Substitute y = ${m}x + ${b}.`,
          answer: x,
          explanation: `x + (${m}x + ${b}) = ${sum} → x = ${x}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Solve: y = ${m}x + ${b} and x + y = ${sum}. What is y?`,
        hint: "Find x first, then substitute.",
        answer: y,
        explanation: `x = ${x}, so y = ${y}`,
      };
    }),

  elimination: (seeds) =>
    fillToCount("elimination", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x = randInt(3, 10);
      const y = randInt(2, 9);
      const sum = x + y;
      const diff = x - y;
      if (i % 5 === 0) {
        return {
          id: "",
          type: "step-order",
          prompt: `Order the steps to solve: x + y = ${sum} and x − y = ${diff}`,
          hint: "Adding eliminates y.",
          correctOrder: [0, 1, 2, 3],
          steps: ["Add equations: 2x = " + 2 * x, `Solve: x = ${x}`, "Substitute x into first equation", `Solve for y: y = ${y}`],
          explanation: "Adding the equations eliminates y immediately.",
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Solve: x + y = ${sum} and x − y = ${diff}. What is x?`,
        hint: "Add the two equations.",
        answer: x,
        explanation: `2x = ${2 * x} → x = ${x}`,
      };
    }),

  "systems-word-problems": (seeds) =>
    fillToCount("systems-word-problems", seeds, PROBLEMS_PER_SKILL, (i) => {
      const adultPrice = randInt(6, 12);
      const childPrice = adultPrice - randInt(2, 4);
      const adults = randInt(3, 10);
      const children = randInt(3, 10);
      const totalTickets = adults + children;
      const totalCost = adultPrice * adults + childPrice * children;
      return {
        id: "",
        type: "numeric",
        prompt: `Tickets cost $${adultPrice} (adult) and $${childPrice} (child). ${totalTickets} tickets sold for $${totalCost}. How many adult tickets?`,
        hint: "Let a + c = total tickets and use the cost equation.",
        answer: adults,
        explanation: `${adults} adult and ${children} child tickets fit both conditions.`,
      };
    }),

  "graphing-inequalities": (seeds) =>
    fillToCount("graphing-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const strict = i % 2 === 0;
      const m = randInt(1, 4);
      const b = randInt(1, 6);
      const symbol = strict ? ">" : "≥";
      return {
        id: "",
        type: "multiple-choice",
        prompt: `y ${symbol} ${m}x + ${b}: solid or dashed boundary line?`,
        hint: strict ? "Strict inequality excludes the line." : "Non-strict includes the line.",
        answer: strict ? "Dashed" : "Solid",
        choices: mcChoices(strict ? "Dashed" : "Solid", ["Solid", "Dashed", "No line"]),
        explanation: `${symbol} uses a ${strict ? "dashed" : "solid"} boundary line.`,
      };
    }),

  "compound-inequalities": (seeds) =>
    fillToCount("compound-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      const a = randInt(2, 6);
      const c = randInt(1, 10);
      if (kind === 0) {
        const left = randInt(1, 6);
        const right = left + randInt(2, 8);
        const low = a * left + c;
        const high = a * right + c;
        const correct = `${left} < x < ${right}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve: ${low} < ${a}x + ${c} < ${high}`,
          hint: "Subtract the constant from all parts, then divide by the coefficient.",
          answer: correct,
          choices: mcChoices(correct, [
            `${left - 1} < x < ${right + 1}`,
            `${left} < x < ${right + 2}`,
            `x < ${right}`,
          ]),
          explanation: `${correct}`,
        };
      }
      if (kind === 1) {
        const bound = randInt(2, 12);
        const correct = `x < ${-bound} or x > ${bound}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Which describes the solution to x < ${-bound} OR x > ${bound}?`,
          hint: "OR compound inequalities describe two separate rays.",
          answer: correct,
          choices: mcChoices(correct, [
            `${-bound} < x < ${bound}`,
            `x > ${-bound}`,
            `x < ${bound}`,
          ]),
          explanation: "An OR inequality includes values satisfying either condition.",
        };
      }
      const left = randInt(-8, 0);
      const right = left + randInt(3, 10);
      const correct = `${left} ≤ x ≤ ${right}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which compound inequality matches: x is between ${left} and ${right}, inclusive?`,
        hint: "Inclusive means use ≤ on both sides.",
        answer: correct,
        choices: mcChoices(correct, [
          `${left} < x < ${right}`,
          `x ≤ ${left}`,
          `x ≥ ${right}`,
        ]),
        explanation: `Inclusive between ${left} and ${right} is written ${correct}.`,
      };
    }),

  "systems-inequalities": (seeds) =>
    fillToCount("systems-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const m = randInt(1, 6);
      const b = randInt(-6, 8);
      const floor = randInt(-6, 2);
      // Build one point guaranteed to satisfy both inequalities, and distractors that don't.
      const px = randInt(-3, 4);
      const py = Math.min(m * px + b, m * px + b) - randInt(1, 3);
      const validPoint = `(${px}, ${Math.max(py, floor + 1)})`;
      const badPoint1 = `(${px}, ${m * px + b + randInt(3, 8)})`;
      const badPoint2 = `(${px + randInt(2, 5)}, ${floor - randInt(1, 4)})`;
      const badPoint3 = `(0, ${m * 0 + b + randInt(4, 10)})`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Which point satisfies y ≤ ${m}x + ${b} AND y > ${floor}?`,
        hint: `Plug each point's x and y into both inequalities.`,
        answer: validPoint,
        choices: mcChoices(validPoint, [badPoint1, badPoint2, badPoint3]),
        explanation: `${validPoint} makes both y ≤ ${m}x + ${b} and y > ${floor} true.`,
      };
    }),

  "function-notation": (seeds) =>
    fillToCount("function-notation", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a = randInt(1, 5);
      const b = randInt(-6, 8);
      const x = randInt(-4, 6);
      if (i % 3 === 0) {
        const result = a * x * x + b;
        return {
          id: "",
          type: "numeric",
          prompt: `If g(x) = ${a}x² ${b >= 0 ? "+ " + b : "− " + Math.abs(b)}, find g(${fmtSigned(x)}).`,
          hint: `Replace x with ${fmtSigned(x)}.`,
          answer: result,
          explanation: `g(${fmtSigned(x)}) = ${result}`,
        };
      }
      const result = a * x + b;
      return {
        id: "",
        type: "numeric",
        prompt: `If f(x) = ${a}x ${b >= 0 ? "+ " + b : "− " + Math.abs(b)}, find f(${fmtSigned(x)}).`,
        hint: `Replace x with ${fmtSigned(x)}.`,
        answer: result,
        explanation: `f(${fmtSigned(x)}) = ${result}`,
      };
    }),

  "domain-range": (seeds) =>
    fillToCount("domain-range", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const excluded = randInt(1, 20);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the domain of f(x) = 1/(x − ${excluded})?`,
          hint: "Denominator cannot be zero.",
          answer: `All real numbers except ${excluded}`,
          choices: mcChoices(`All real numbers except ${excluded}`, [
            "All real numbers",
            `x > ${excluded}`,
            `x ≥ ${excluded}`,
          ]),
          explanation: `x = ${excluded} makes the denominator 0.`,
        };
      }
      if (kind === 1) {
        const excluded = randInt(1, 20);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the domain of f(x) = 1/(x + ${excluded})?`,
          hint: "Set the denominator equal to zero and exclude that x-value.",
          answer: `All real numbers except ${-excluded}`,
          choices: mcChoices(`All real numbers except ${-excluded}`, [
            `All real numbers except ${excluded}`,
            "All real numbers",
            `x ≠ 0`,
          ]),
          explanation: `x = ${-excluded} makes the denominator 0.`,
        };
      }
      if (kind === 2) {
        const boundary = randInt(1, 15);
        return {
          id: "",
          type: "multiple-choice",
          prompt: `What is the domain of f(x) = √(x − ${boundary})?`,
          hint: "The expression under a square root must be ≥ 0.",
          answer: `x ≥ ${boundary}`,
          choices: mcChoices(`x ≥ ${boundary}`, [
            `x ≤ ${boundary}`,
            `x > ${boundary}`,
            "All real numbers",
          ]),
          explanation: `x − ${boundary} ≥ 0 means x ≥ ${boundary}.`,
        };
      }
      const a = randInt(2, 9);
      const b = randInt(2, 9) + a;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `What is the domain of f(x) = 1/((x − ${a})(x − ${b}))?`,
        hint: "Exclude every x-value that makes any factor in the denominator zero.",
        answer: `All real numbers except ${a} and ${b}`,
        choices: mcChoices(`All real numbers except ${a} and ${b}`, [
          `All real numbers except ${a}`,
          `All real numbers except ${b}`,
          "All real numbers",
        ]),
        explanation: `Both x = ${a} and x = ${b} make a factor in the denominator zero.`,
      };
    }),

  "function-graphs": (seeds) =>
    fillToCount("function-graphs", seeds, PROBLEMS_PER_SKILL, (i) => {
      const x1 = 0;
      const y1 = randInt(1, 5);
      const x2 = randInt(2, 6);
      const y2 = y1 + randInt(2, 8);
      const rate = (y2 - y1) / (x2 - x1);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `A function graph passes through (${x1}, ${y1}) and (${x2}, ${y2}). What is the average rate of change?`,
        hint: "(change in y) / (change in x)",
        answer: `${rate}`,
        choices: mcChoices(`${rate}`, [`${y2}`, `${x2}`, `${y1 + y2}`]),
        explanation: `(${y2} − ${y1}) / (${x2} − ${x1}) = ${rate}`,
      };
    }),

  "arithmetic-sequences": (seeds) =>
    fillToCount("arithmetic-sequences", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a1 = randInt(1, 12);
      const d = randInt(2, 6);
      const n = randInt(5, 12);
      if (i % 2 === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Sequence: ${a1}, ${a1 + d}, ${a1 + 2 * d}, ${a1 + 3 * d}, ... What is the ${n}th term?`,
          hint: "aₙ = a₁ + (n − 1)d",
          answer: a1 + (n - 1) * d,
          explanation: `a_${n} = ${a1} + ${n - 1}(${d}) = ${a1 + (n - 1) * d}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `What is the common difference in ${a1}, ${a1 + d}, ${a1 + 2 * d}, ${a1 + 3 * d}, ...?`,
        hint: "Subtract consecutive terms.",
        answer: d,
        explanation: `Each term increases by ${d}.`,
      };
    }),

  "geometric-sequences": (seeds) =>
    fillToCount("geometric-sequences", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a1 = randInt(2, 5);
      const r = randInt(2, 4);
      const n = randInt(4, 6);
      if (i % 2 === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Sequence: ${a1}, ${a1 * r}, ${a1 * r * r}, ... What is the common ratio?`,
          hint: "Divide consecutive terms.",
          answer: r,
          explanation: `${a1 * r} / ${a1} = ${r}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `What is the ${n}th term of ${a1}, ${a1 * r}, ${a1 * r * r}, ${a1 * r ** 3}, ...?`,
        hint: "Multiply by the ratio each time.",
        answer: a1 * r ** (n - 1),
        explanation: `${a1} × ${r}^${n - 1} = ${a1 * r ** (n - 1)}`,
      };
    }),

  "exponent-rules": (seeds) =>
    fillToCount("exponent-rules", seeds, PROBLEMS_PER_SKILL, (i) => {
      const base = randInt(2, 5);
      const e1 = randInt(2, 5);
      const e2 = randInt(2, 5);
      if (i % 3 === 0) {
        return {
          id: "",
          type: "numeric",
          prompt: `Simplify: ${base}^${e1} × ${base}^${e2} (enter as a number)`,
          hint: "Add exponents when multiplying same base.",
          answer: base ** (e1 + e2),
          explanation: `${base}^${e1 + e2} = ${base ** (e1 + e2)}`,
        };
      }
      if (i % 3 === 1) {
        const exp = randInt(2, 4);
        const outer = randInt(2, 3);
        const product = exp * outer;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify: (x^${exp})^${outer}`,
          hint: "Multiply exponents.",
          answer: `x^${product}`,
          choices: mcChoices(`x^${product}`, [`x^${exp + outer}`, `x^${exp}`, `2x^${exp}`]),
          explanation: `(x^${exp})^${outer} = x^${product}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Simplify: ${base}^0`,
        hint: "Any nonzero number to the 0 power equals 1.",
        answer: 1,
        explanation: `${base}^0 = 1`,
      };
    }),

  "negative-fractional-exponents": (seeds) =>
    fillToCount("negative-fractional-exponents", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      if (kind === 0) {
        const base = randInt(2, 12);
        const exp = randInt(1, 4);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate: ${base}^(${-exp})`,
          hint: `1/${base}^${exp}`,
          answer: 1 / base ** exp,
          explanation: `${base}^(${-exp}) = 1/${base ** exp} = ${1 / base ** exp}`,
        };
      }
      if (kind === 1) {
        const n = [2, 3, 4, 5][i % 4];
        const root = n === 2 ? "√x" : n === 3 ? "³√x" : n === 4 ? "⁴√x" : "⁵√x";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Rewrite ${root} using a fractional exponent. (Variant ${Math.floor(i / 4) + 1})`,
          hint: "Use x^(1/n).",
          answer: `x^(1/${n})`,
          choices: mcChoices(`x^(1/${n})`, [`x^${n}`, `x^(-${n})`, `${n}x`]),
          explanation: `Root n corresponds to exponent 1/${n}.`,
        };
      }
      if (kind === 2) {
        const bases = [4, 9, 16, 25, 36, 49, 64];
        const base = bases[i % bases.length];
        const root = Math.sqrt(base);
        return {
          id: "",
          type: "numeric",
          prompt: `Evaluate: ${base}^(1/2)`,
          hint: "A power of 1/2 means square root.",
          answer: root,
          explanation: `${base}^(1/2) = √${base} = ${root}`,
        };
      }
      const cubeBases = [8, 27, 64, 125, 216];
      const base = cubeBases[i % cubeBases.length];
      const root = Math.round(Math.cbrt(base));
      const negative = i % 2 === 0;
      return {
        id: "",
        type: "numeric",
        prompt: negative
          ? `Evaluate: ${base}^(-1/3)`
          : `Evaluate: ${base}^(1/3)`,
        hint: negative ? `Take the cube root, then flip it.` : "A power of 1/3 means cube root.",
        answer: negative ? Math.round((1 / root) * 1000) / 1000 : root,
        explanation: negative
          ? `${base}^(-1/3) = 1/${root} ≈ ${Math.round((1 / root) * 1000) / 1000}`
          : `${base}^(1/3) = ³√${base} = ${root}`,
      };
    }),

  "scientific-notation": (seeds) =>
    fillToCount("scientific-notation", seeds, PROBLEMS_PER_SKILL, (i) => {
      const exp = randInt(3, 7);
      const coeff = randInt(12, 99) / 10;
      const number = coeff * 10 ** exp;
      const correct = `${coeff} × 10^${exp}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Write ${number.toLocaleString()} in scientific notation.`,
        hint: "Move the decimal so 1 ≤ a < 10.",
        answer: correct,
        choices: mcChoices(correct, [`${coeff * 10} × 10^${exp - 1}`, `${coeff / 10} × 10^${exp + 1}`, `${coeff} × 10^${exp + 1}`]),
        explanation: `${number.toLocaleString()} = ${correct}`,
      };
    }),

  "simplifying-radicals": (seeds) =>
    fillToCount("simplifying-radicals", seeds, PROBLEMS_PER_SKILL, (i) => {
      const squares = [4, 9, 16, 25, 36, 49, 64, 81, 100];
      const square = squares[i % squares.length];
      const root = Math.sqrt(square);
      const inside = square * randInt(2, 12);
      if (i % 3 !== 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Simplify √${inside}`,
          hint: `Factor out perfect squares from ${inside}.`,
          answer: `${root}√${inside / square}`,
          choices: mcChoices(`${root}√${inside / square}`, [
            `${inside}`,
            `√${inside}`,
            `${root + 1}√${inside / square}`,
          ]),
          explanation: `√${inside} = √(${square}·${inside / square}) = ${root}√${inside / square}`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Simplify √${square}`,
        hint: "What number squared equals this?",
        answer: root,
        explanation: `√${square} = ${root}`,
      };
    }),

  "exponential-functions": (seeds) =>
    fillToCount("exponential-functions", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a = randInt(2, 5);
      const b = randInt(2, 4);
      const x = randInt(1, 4);
      if (i % 2 === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: "Which is an exponential function?",
          hint: "Look for the variable in the exponent.",
          answer: `y = ${a}(${b})^x`,
          choices: mcChoices(`y = ${a}(${b})^x`, [`y = ${b}x + ${a}`, `y = x^${a}`, `y = ${a}/x`]),
          explanation: `y = ${a}(${b})^x has x in the exponent.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Evaluate f(x) = ${a}(${b})^x at x = ${x}.`,
        hint: `Compute ${b}^${x} first.`,
        answer: a * b ** x,
        explanation: `${a} × ${b}^${x} = ${a * b ** x}`,
      };
    }),

  "exponential-growth": (seeds) =>
    fillToCount("exponential-growth", seeds, PROBLEMS_PER_SKILL, (i) => {
      const principal = randInt(5, 20) * 100;
      const rate = [0.03, 0.04, 0.05, 0.06][i % 4];
      const years = randInt(2, 4);
      const value = principal * (1 + rate) ** years;
      return {
        id: "",
        type: "numeric",
        prompt: `$${principal} invested at ${rate * 100}% annual interest compounded annually. Value after ${years} years?`,
        hint: `Use ${principal}(1.${String(rate * 100).padStart(2, "0")})^${years}`,
        answer: Math.round(value * 100) / 100,
        explanation: `$${principal}(1 + ${rate})^${years} ≈ $${Math.round(value * 100) / 100}`,
      };
    }),

  "exponential-decay": (seeds) =>
    fillToCount("exponential-decay", seeds, PROBLEMS_PER_SKILL, (i) => {
      const value0 = randInt(10, 30) * 1000;
      const rate = [0.1, 0.12, 0.15, 0.2][i % 4];
      const years = randInt(1, 3);
      const value = value0 * (1 - rate) ** years;
      return {
        id: "",
        type: "numeric",
        prompt: `A car worth $${value0.toLocaleString()} depreciates ${rate * 100}% per year. Value after ${years} year(s)?`,
        hint: `Multiply by ${1 - rate} each year.`,
        answer: Math.round(value),
        explanation: `$${value0.toLocaleString()} × ${1 - rate}^${years} ≈ $${Math.round(value).toLocaleString()}`,
      };
    }),

  "multiplying-binomials": (seeds) =>
    fillToCount("multiplying-binomials", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      const b = randInt(2, 12);
      const c = randInt(2, 12);
      if (kind === 0) {
        const correct = `x² + ${b + c}x + ${b * c}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${b})(x + ${c})`,
          hint: "Use FOIL.",
          answer: correct,
          choices: mcChoices(correct, [
            `x² + ${b * c}x + ${b + c}`,
            `x² + ${b + c}`,
            `x² + ${b + c}x + ${b + c}`,
          ]),
          explanation: `(x + ${b})(x + ${c}) = ${correct}`,
        };
      }
      if (kind === 1) {
        const diff = b - c;
        const correct = `x² ${diff >= 0 ? "+" : "−"} ${Math.abs(diff)}x − ${b * c}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${b})(x − ${c})`,
          hint: "Use FOIL — the last term will be negative.",
          answer: correct,
          choices: mcChoices(correct, [
            `x² + ${b + c}x − ${b * c}`,
            `x² − ${b * c}`,
            `x² ${diff >= 0 ? "+" : "−"} ${Math.abs(diff)}x + ${b * c}`,
          ]),
          explanation: `(x + ${b})(x − ${c}) = ${correct}`,
        };
      }
      const a = randInt(2, 5);
      const correct = `${a}x² + ${a * c + b}x + ${b * c}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Expand (${a}x + ${b})(x + ${c})`,
        hint: "Distribute each term of the first binomial across the second.",
        answer: correct,
        choices: mcChoices(correct, [
          `${a}x² + ${b + c}x + ${b * c}`,
          `x² + ${a * c + b}x + ${b * c}`,
          `${a}x² + ${a * c + b}x + ${b + c}`,
        ]),
        explanation: `(${a}x + ${b})(x + ${c}) = ${correct}`,
      };
    }),

  "special-products": (seeds) =>
    fillToCount("special-products", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 4;
      const n = randInt(2, 16);
      if (kind === 0) {
        const correct = `x² + ${2 * n}x + ${n * n}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${n})²`,
          hint: "Don't forget the middle term.",
          answer: correct,
          choices: mcChoices(correct, [`x² + ${n * n}`, `x² + ${n}x + ${n * n}`, `x² + ${2 * n}`]),
          explanation: `(x + ${n})² = ${correct}`,
        };
      }
      if (kind === 1) {
        const correct = `x² − ${2 * n}x + ${n * n}`;
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x − ${n})²`,
          hint: "The middle term is negative.",
          answer: correct,
          choices: mcChoices(correct, [`x² − ${n * n}`, `x² − ${n}x + ${n * n}`, `x² + ${2 * n}x + ${n * n}`]),
          explanation: `(x − ${n})² = ${correct}`,
        };
      }
      if (kind === 2) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Expand (x + ${n})(x − ${n})`,
          hint: "Difference of squares.",
          answer: `x² − ${n * n}`,
          choices: mcChoices(`x² − ${n * n}`, [`x² + ${n * n}`, `x² − ${n}`, `x² − ${2 * n}`]),
          explanation: `(x + ${n})(x − ${n}) = x² − ${n * n}`,
        };
      }
      const a = randInt(2, 5);
      const correct = `${a * a}x² − ${n * n}`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Expand (${a}x + ${n})(${a}x − ${n})`,
        hint: "Difference of squares works with coefficients too.",
        answer: correct,
        choices: mcChoices(correct, [`${a}x² − ${n * n}`, `${a * a}x² + ${n * n}`, `${a * a}x² − ${n}`]),
        explanation: `(${a}x + ${n})(${a}x − ${n}) = ${correct}`,
      };
    }),

  "factoring-trinomials": (seeds) =>
    fillToCount("factoring-trinomials", seeds, PROBLEMS_PER_SKILL, (i) => {
      const r = randInt(2, 14);
      const s = randInt(2, 14);
      const b = r + s;
      const c = r * s;
      const correct = `(x + ${r})(x + ${s})`;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Factor x² + ${b}x + ${c}`,
        hint: `Find two numbers that multiply to ${c} and add to ${b}.`,
        answer: correct,
        choices: mcChoices(correct, [`(x + ${r + 1})(x + ${s - 1})`, `(x + 1)(x + ${c})`, `(x − ${r})(x − ${s})`]),
        explanation: `${r} × ${s} = ${c} and ${r} + ${s} = ${b}`,
      };
    }),

  "factoring-special": (seeds) =>
    fillToCount("factoring-special", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      const n = randInt(2, 20);
      if (kind === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor x² − ${n * n}`,
          hint: "Difference of squares.",
          answer: `(x + ${n})(x − ${n})`,
          choices: mcChoices(`(x + ${n})(x − ${n})`, [`(x − ${n})²`, `(x + ${n * n})(x − 1)`, "Cannot factor"]),
          explanation: `x² − ${n * n} = (x + ${n})(x − ${n})`,
        };
      }
      if (kind === 1) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Factor x² + ${2 * n}x + ${n * n}`,
          hint: "This is a perfect square trinomial.",
          answer: `(x + ${n})²`,
          choices: mcChoices(`(x + ${n})²`, [`(x − ${n})²`, `(x + ${n})(x − ${n})`, `(x + ${2 * n})(x + 1)`]),
          explanation: `x² + ${2 * n}x + ${n * n} = (x + ${n})²`,
        };
      }
      const a = randInt(2, 4);
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Factor ${a * a}x² − ${n * n}`,
        hint: "Difference of squares works with coefficients — factor out the square root of each term.",
        answer: `(${a}x + ${n})(${a}x − ${n})`,
        choices: mcChoices(`(${a}x + ${n})(${a}x − ${n})`, [
          `(${a}x − ${n})²`,
          `(${a}x + ${n})²`,
          "Cannot factor",
        ]),
        explanation: `${a * a}x² − ${n * n} = (${a}x + ${n})(${a}x − ${n})`,
      };
    }),

  "graphing-parabolas": (seeds) =>
    fillToCount("graphing-parabolas", seeds, PROBLEMS_PER_SKILL, (i) => {
      const a = randInt(1, 4) * (i % 2 === 0 ? -1 : 1);
      const h = randInt(1, 6);
      const k = randInt(1, 8);
      if (i % 2 === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Does y = ${fmtSigned(a)}x² + ${k} open up or down?`,
          hint: "Check the sign of a.",
          answer: a > 0 ? "Up" : "Down",
          choices: mcChoices(a > 0 ? "Up" : "Down", ["Up", "Down", "Left", "Right"]),
          explanation: `${a > 0 ? "Positive" : "Negative"} leading coefficient → opens ${a > 0 ? "up" : "down"}.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `What is the x-coordinate of the vertex of y = (x − ${h})² + ${k}?`,
        hint: "Vertex form (x − h)² + k",
        answer: h,
        explanation: `The vertex is (${h}, ${k}).`,
      };
    }),

  "solving-by-factoring": (seeds) =>
    fillToCount("solving-by-factoring", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const r = randInt(2, 15);
        const s = randInt(2, 15);
        const b = -(r + s);
        const c = r * s;
        const smaller = Math.min(r, s);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve x² ${b >= 0 ? "+" : "−"} ${Math.abs(b)}x + ${c} = 0. Smaller root?`,
          hint: `Factor: (x − ${r})(x − ${s}) = 0`,
          answer: smaller,
          explanation: `x = ${r} or x = ${s}. Smaller = ${smaller}.`,
        };
      }
      if (kind === 1) {
        const n = randInt(2, 15);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve x² − ${n * n} = 0. Positive root?`,
          hint: "Difference of squares.",
          answer: n,
          explanation: `x = ±${n}. Positive root = ${n}.`,
        };
      }
      const r = randInt(1, 10);
      const a = randInt(2, 6);
      return {
        id: "",
        type: "numeric",
        prompt: `Solve x(${a}x − ${a * r}) = 0. Positive root (other than 0)?`,
        hint: `Set each factor equal to zero: x = 0 or ${a}x = ${a * r}.`,
        answer: r,
        explanation: `x = 0 or x = ${r}. The nonzero root is ${r}.`,
      };
    }),

  "completing-square": (seeds) =>
    fillToCount("completing-square", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 2;
      const b = randInt(2, 40) * 2;
      const square = (b / 2) ** 2;
      if (kind === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Complete the square: x² + ${b}x + ___ = (x + ${b / 2})²`,
          hint: `(b/2)²`,
          answer: `${square}`,
          choices: mcChoices(`${square}`, [`${b}`, `${b / 2}`, `${b * b}`]),
          explanation: `(${b}/2)² = ${square}`,
        };
      }
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Complete the square: x² − ${b}x + ___ = (x − ${b / 2})²`,
        hint: `(b/2)²`,
        answer: `${square}`,
        choices: mcChoices(`${square}`, [`${-b}`, `${b / 2}`, `${b * b}`]),
        explanation: `(−${b}/2)² = ${square}`,
      };
    }),

  "quadratic-formula": (seeds) =>
    fillToCount("quadratic-formula", seeds, PROBLEMS_PER_SKILL, (i) => {
      const r = randInt(2, 11);
      const s = randInt(2, 11);
      const b = -(r + s);
      const c = r * s;
      if (i % 3 === 0) {
        const disc = b * b - 4 * c;
        const count = disc > 0 ? "2" : disc === 0 ? "1" : "0";
        return {
          id: "",
          type: "multiple-choice",
          prompt: `For x² ${b >= 0 ? "+" : "−"} ${Math.abs(b)}x + ${c} = 0, how many real solutions?`,
          hint: "Compute the discriminant b² − 4ac.",
          answer: count,
          choices: mcChoices(count, ["0", "1", "2", "Infinitely many"]),
          explanation: `Discriminant = ${disc}.`,
        };
      }
      return {
        id: "",
        type: "numeric",
        prompt: `Solve x² ${b >= 0 ? "+" : "−"} ${Math.abs(b)}x + ${c} = 0. Smaller root?`,
        hint: "Factor or use the quadratic formula.",
        answer: Math.min(r, s),
        explanation: `x = ${r} or x = ${s}.`,
      };
    }),

  "absolute-value": (seeds) =>
    fillToCount("absolute-value", seeds, PROBLEMS_PER_SKILL, (i) => {
      if (i % 2 === 0) {
        const a = randInt(3, 15);
        return {
          id: "",
          type: "numeric",
          prompt: `Solve |x| = ${a}. Positive solution?`,
          hint: "x = a or x = −a",
          answer: a,
          explanation: `x = ±${a}`,
        };
      }
      const h = randInt(1, 6);
      const a = randInt(3, 9);
      const x1 = h + a;
      const x2 = h - a;
      return {
        id: "",
        type: "numeric",
        prompt: `Solve |x − ${h}| = ${a}. Smaller solution?`,
        hint: "Set x − h = ±a.",
        answer: Math.min(x1, x2),
        explanation: `x = ${x1} or x = ${x2}.`,
      };
    }),

  "absolute-value-inequalities": (seeds) =>
    fillToCount("absolute-value-inequalities", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      const a = randInt(3, 20);
      if (kind === 0) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve |x| < ${a}`,
          hint: "Less than means between −a and a.",
          answer: `−${a} < x < ${a}`,
          choices: mcChoices(`−${a} < x < ${a}`, [`x < ${a}`, `x > −${a}`, `x < −${a} or x > ${a}`]),
          explanation: `|x| < ${a} means −${a} < x < ${a}.`,
        };
      }
      if (kind === 1) {
        return {
          id: "",
          type: "multiple-choice",
          prompt: `Solve |x| > ${a}`,
          hint: "Greater than splits into two rays.",
          answer: `x < −${a} or x > ${a}`,
          choices: mcChoices(`x < −${a} or x > ${a}`, [`−${a} < x < ${a}`, `x > ${a}`, `x < −${a}`]),
          explanation: `|x| > ${a} means x < −${a} or x > ${a}.`,
        };
      }
      const h = randInt(1, 10);
      const x1 = h - a;
      const x2 = h + a;
      return {
        id: "",
        type: "multiple-choice",
        prompt: `Solve |x − ${h}| ≤ ${a}`,
        hint: "Rewrite as −a ≤ x − h ≤ a, then add h to all parts.",
        answer: `${x1} ≤ x ≤ ${x2}`,
        choices: mcChoices(`${x1} ≤ x ≤ ${x2}`, [
          `${x1 - 1} ≤ x ≤ ${x2 + 1}`,
          `x ≤ ${x1}`,
          `x ≥ ${x2}`,
        ]),
        explanation: `|x − ${h}| ≤ ${a} means ${x1} ≤ x ≤ ${x2}.`,
      };
    }),

  "piecewise-functions": (seeds) =>
    fillToCount("piecewise-functions", seeds, PROBLEMS_PER_SKILL, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const c = randInt(1, 8);
        const x = randInt(-12, -1);
        const useFirst = x < 0;
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = { x + ${c} if x < 0; x² if x ≥ 0 }. Find f(${fmtSigned(x)}).`,
          hint: useFirst ? "Use the first rule since x < 0." : "Use the second rule.",
          answer: useFirst ? x + c : x * x,
          explanation: useFirst
            ? `f(${fmtSigned(x)}) = ${fmtSigned(x)} + ${c} = ${x + c}`
            : `f(${fmtSigned(x)}) = ${x}² = ${x * x}`,
        };
      }
      if (kind === 1) {
        const m = randInt(1, 5);
        const x = randInt(0, 12);
        return {
          id: "",
          type: "numeric",
          prompt: `f(x) = { −x if x < 0; ${m}x if x ≥ 0 }. Find f(${fmtSigned(x)}).`,
          hint: "Use the second rule since x ≥ 0.",
          answer: m * x,
          explanation: `f(${fmtSigned(x)}) = ${m}(${x}) = ${m * x}`,
        };
      }
      const boundary = randInt(1, 6);
      const x = randInt(-6, 10);
      const useFirst = x < boundary;
      const a = randInt(2, 6);
      const b = randInt(1, 10);
      return {
        id: "",
        type: "numeric",
        prompt: `f(x) = { ${a}x if x < ${boundary}; x + ${b} if x ≥ ${boundary} }. Find f(${fmtSigned(x)}).`,
        hint: useFirst
          ? `${x} < ${boundary}, so use the first rule.`
          : `${x} ≥ ${boundary}, so use the second rule.`,
        answer: useFirst ? a * x : x + b,
        explanation: useFirst
          ? `f(${fmtSigned(x)}) = ${a}(${x}) = ${a * x}`
          : `f(${fmtSigned(x)}) = ${x} + ${b} = ${x + b}`,
      };
    }),
};

function genericNumericGenerator(skillId: string, seeds: PracticeProblem[]): PracticeProblem[] {
  return fillToCount(skillId, seeds, PROBLEMS_PER_SKILL, (i) => {
    const a = randInt(2, 9);
    const b = randInt(2, 9);
    const x = randInt(2, 12);
    return {
      id: "",
      type: "numeric",
      prompt: `Solve for x: ${a}x + ${b} = ${a * x + b}`,
      hint: `Subtract ${b}, then divide by ${a}.`,
      answer: x,
      explanation: `${a}x = ${a * x} → x = ${x}`,
    };
  });
}

export function generateProblemBank(
  skillId: string,
  seedProblems: PracticeProblem[] = []
): PracticeProblem[] {
  return withSeededGeneration(hashString(skillId), () => {
    const generator = generators[skillId];
    if (generator) {
      return generator(seedProblems);
    }
    return genericNumericGenerator(skillId, seedProblems);
  });
}

export function getAllGeneratorSkillIds(): string[] {
  return Object.keys(generators);
}
