import type {
  CoordinateSpec,
  DiagramSpec,
  GraphLine,
  NumberLineMark,
  VisualExercise,
  VisualOption,
} from "@/types";
import { createSeededRng, hashString, shuffleArray } from "@/lib/problem-utils";

type Rng = () => number;

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randNonZero(rng: Rng, min: number, max: number): number {
  let v = 0;
  while (v === 0) v = randInt(rng, min, max);
  return v;
}

function pick<T>(rng: Rng, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function makeOptions(correct: DiagramSpec, distractors: DiagramSpec[], rng: Rng): { options: VisualOption[]; correctOptionId: string } {
  const all = [correct, ...distractors].map((diagram, i) => ({ id: `opt-${i}`, diagram }));
  const shuffled = shuffleArray(all, rng);
  const correctOptionId = shuffled.find((o) => o.diagram === correct)!.id;
  return { options: shuffled, correctOptionId };
}

// ---------------------------------------------------------------------------
// Category: plot a numeric answer on a number line
// ---------------------------------------------------------------------------

interface PointScenario {
  prompt: string;
  hint: string;
  explanation: string;
  answer: number;
  range: number;
}

function equationScenario(rng: Rng): PointScenario {
  const a = randNonZero(rng, 2, 9);
  const x = randInt(rng, -10, 10);
  const b = randInt(rng, -12, 12);
  const c = a * x + b;
  const bStr = b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`;
  return {
    prompt: `Which number line shows the solution to ${a}x ${bStr} = ${c}?`,
    hint: `Undo the ${b >= 0 ? "addition" : "subtraction"} first, then divide by ${a}.`,
    explanation: `${a}x ${bStr} = ${c} → ${a}x = ${c - b} → x = ${x}`,
    answer: x,
    range: Math.max(10, Math.abs(x) + 4),
  };
}

function functionEvalScenario(rng: Rng): PointScenario {
  const a = randNonZero(rng, -4, 4);
  const b = randInt(rng, -6, 6);
  const x = randInt(rng, -5, 5);
  const answer = a * x + b;
  return {
    prompt: `If f(x) = ${a}x ${b >= 0 ? "+" : "−"} ${Math.abs(b)}, which number line shows f(${x})?`,
    hint: `Substitute x = ${x} into the function and simplify.`,
    explanation: `f(${x}) = ${a}(${x}) ${b >= 0 ? "+" : "−"} ${Math.abs(b)} = ${answer}`,
    answer,
    range: Math.max(10, Math.abs(answer) + 4),
  };
}

function sequenceScenario(rng: Rng, kind: "arithmetic" | "geometric"): PointScenario {
  const first = randInt(rng, 1, 6);
  const n = randInt(rng, 4, 7);
  if (kind === "arithmetic") {
    const d = randNonZero(rng, -4, 4);
    const answer = first + (n - 1) * d;
    return {
      prompt: `Sequence: ${first}, ${first + d}, ${first + 2 * d}, ... Which number line shows the ${n}th term?`,
      hint: `Use aₙ = a₁ + (n − 1)d with d = ${d}.`,
      explanation: `a${n} = ${first} + ${n - 1}(${d}) = ${answer}`,
      answer,
      range: Math.max(10, Math.abs(answer) + 4),
    };
  }
  const r = pick(rng, [2, 3, -2]);
  const answer = first * r ** (Math.min(n, 4) - 1);
  return {
    prompt: `Sequence: ${first}, ${first * r}, ${first * r * r}, ... Which number line shows the 4th term?`,
    hint: `Multiply by the common ratio ${r} each time.`,
    explanation: `a₄ = ${first} × ${r}³ = ${answer}`,
    answer,
    range: Math.max(10, Math.abs(answer) + 4),
  };
}

function exponentScenario(rng: Rng): PointScenario {
  const base = randInt(rng, 2, 4);
  const exp = randInt(rng, 2, 3);
  const answer = base ** exp;
  return {
    prompt: `Which number line shows the value of ${base}^${exp}?`,
    hint: `Multiply ${base} by itself ${exp} times.`,
    explanation: `${base}^${exp} = ${answer}`,
    answer,
    range: Math.max(10, answer + 4),
  };
}

function radicalScenario(rng: Rng): PointScenario {
  const root = randInt(rng, 3, 10);
  const answer = root * root;
  return {
    prompt: `Which number line shows the value of √${answer}?`,
    hint: `What number times itself equals ${answer}?`,
    explanation: `√${answer} = ${root} because ${root} × ${root} = ${answer}`,
    answer: root,
    range: Math.max(10, root + 4),
  };
}

function conversionScenario(rng: Rng): PointScenario {
  const perUnit = pick(rng, [12, 3, 60, 100]);
  const count = randInt(rng, 2, 8);
  const answer = perUnit * count;
  const unitLabel = perUnit === 12 ? "feet → inches" : perUnit === 3 ? "yards → feet" : perUnit === 60 ? "minutes → seconds" : "meters → centimeters";
  return {
    prompt: `Convert ${count} using ${unitLabel} (×${perUnit}). Which number line shows the result?`,
    hint: `Multiply ${count} × ${perUnit}.`,
    explanation: `${count} × ${perUnit} = ${answer}`,
    answer,
    range: Math.max(20, answer * 1.3),
  };
}

function polynomialEvalScenario(rng: Rng): PointScenario {
  const p = randInt(rng, -5, 5);
  const q = randInt(rng, -5, 5);
  const x = randInt(rng, -3, 3);
  const answer = (x + p) * (x + q);
  const pStr = p >= 0 ? `+ ${p}` : `− ${Math.abs(p)}`;
  const qStr = q >= 0 ? `+ ${q}` : `− ${Math.abs(q)}`;
  return {
    prompt: `For (x ${pStr})(x ${qStr}), which number line shows the value when x = ${x}?`,
    hint: `Substitute x = ${x} into each factor, then multiply.`,
    explanation: `(${x} ${pStr})(${x} ${qStr}) = ${answer}`,
    answer,
    range: Math.max(15, Math.abs(answer) + 6),
  };
}

function absoluteValueScenario(rng: Rng): PointScenario {
  const shift = randInt(rng, -5, 5);
  const dist = randInt(rng, 2, 9);
  const answer = shift + dist;
  const shiftStr = shift >= 0 ? `− ${shift}` : `+ ${Math.abs(shift)}`;
  return {
    prompt: `Solve |x ${shiftStr}| = ${dist}. Which number line shows the larger solution?`,
    hint: `x − ${shift} = ${dist} or x − ${shift} = −${dist}.`,
    explanation: `The larger solution is x = ${shift} + ${dist} = ${answer}`,
    answer,
    range: Math.max(12, Math.abs(answer) + 6),
  };
}

function exponentialScenario(rng: Rng): PointScenario {
  const a = randInt(rng, 1, 4);
  const b = pick(rng, [2, 3]);
  const x = randInt(rng, 1, 3);
  const answer = a * b ** x;
  return {
    prompt: `For f(x) = ${a}(${b})ˣ, which number line shows f(${x})?`,
    hint: `Raise ${b} to the power ${x}, then multiply by ${a}.`,
    explanation: `f(${x}) = ${a} × ${b}^${x} = ${answer}`,
    answer,
    range: Math.max(15, answer + 6),
  };
}

function piecewiseScenario(rng: Rng): PointScenario {
  const threshold = randInt(rng, -2, 2);
  const isLow = pick(rng, [true, false]);
  const a1 = randNonZero(rng, 1, 3);
  const b1 = randInt(rng, -3, 3);
  const a2 = randInt(rng, 2, 3);
  const x = isLow ? threshold - randInt(rng, 1, 3) : threshold + randInt(rng, 0, 3);
  const answer = x < threshold ? a1 * x + b1 : a2 * x * x;
  return {
    prompt: `f(x) = { ${a1}x ${b1 >= 0 ? "+" : "−"} ${Math.abs(b1)} if x < ${threshold}; ${a2}x² if x ≥ ${threshold} }. Which number line shows f(${x})?`,
    hint: x < threshold ? "Use the first rule since x is below the threshold." : "Use the second rule since x meets or exceeds the threshold.",
    explanation: x < threshold ? `f(${x}) = ${a1}(${x}) ${b1 >= 0 ? "+" : "−"} ${Math.abs(b1)} = ${answer}` : `f(${x}) = ${a2}(${x})² = ${answer}`,
    answer,
    range: Math.max(12, Math.abs(answer) + 6),
  };
}

const POINT_FLAVORS: Record<string, (rng: Rng) => PointScenario> = {
  "unit-basics": conversionScenario,
  "dimensional-analysis": conversionScenario,
  "unit-word-problems": conversionScenario,
  "one-step-equations": equationScenario,
  "two-step-equations": equationScenario,
  "multi-step-equations": equationScenario,
  "equations-with-fractions": equationScenario,
  "solving-by-factoring": equationScenario,
  "completing-square": equationScenario,
  "quadratic-formula": equationScenario,
  "function-notation": functionEvalScenario,
  "arithmetic-sequences": (rng) => sequenceScenario(rng, "arithmetic"),
  "geometric-sequences": (rng) => sequenceScenario(rng, "geometric"),
  "exponent-rules": exponentScenario,
  "negative-fractional-exponents": exponentScenario,
  "scientific-notation": exponentScenario,
  "simplifying-radicals": radicalScenario,
  "multiplying-binomials": polynomialEvalScenario,
  "special-products": polynomialEvalScenario,
  "factoring-trinomials": polynomialEvalScenario,
  "factoring-special": polynomialEvalScenario,
  "absolute-value": absoluteValueScenario,
  "exponential-functions": exponentialScenario,
  "exponential-growth": exponentialScenario,
  "exponential-decay": exponentialScenario,
  "piecewise-functions": piecewiseScenario,
};

function buildPointExercise(skillId: string, rng: Rng): VisualExercise {
  const flavor = POINT_FLAVORS[skillId] ?? equationScenario;
  const scenario = flavor(rng);
  const range = Math.round(scenario.range);
  const correct: DiagramSpec = { type: "number-line", min: -range, max: range, mark: { kind: "point", value: scenario.answer } };

  const usedOffsets = new Set<number>([0]);
  const distractors: DiagramSpec[] = [];
  const spread = Math.max(3, Math.round(range / 3));
  let attempts = 0;
  while (distractors.length < 3 && attempts < 200) {
    attempts += 1;
    const offset = randNonZero(rng, -spread, spread);
    if (usedOffsets.has(offset)) continue;
    usedOffsets.add(offset);
    const value = scenario.answer + offset;
    if (value < -range || value > range) continue;
    distractors.push({ type: "number-line", min: -range, max: range, mark: { kind: "point", value } });
  }
  // Fallback in the unlikely event the spread couldn't produce 3 valid, in-range distractors.
  // Alternates direction and grows in magnitude so it can't get stuck re-clamping to one edge.
  let guard = 0;
  while (distractors.length < 3 && guard < 500) {
    guard += 1;
    const direction = guard % 2 === 0 ? 1 : -1;
    const magnitude = Math.ceil(guard / 2);
    const value = Math.max(-range, Math.min(range, scenario.answer + direction * magnitude));
    const isDuplicate =
      value === scenario.answer ||
      distractors.some((d) => d.type === "number-line" && d.mark.kind === "point" && d.mark.value === value);
    if (!isDuplicate) {
      distractors.push({ type: "number-line", min: -range, max: range, mark: { kind: "point", value } });
    }
  }

  const { options, correctOptionId } = makeOptions(correct, distractors, rng);
  return {
    skillId,
    prompt: scenario.prompt,
    hint: scenario.hint,
    explanation: scenario.explanation,
    options,
    correctOptionId,
  };
}

// ---------------------------------------------------------------------------
// Category: shade the correct region for an inequality
// ---------------------------------------------------------------------------

function buildInequalityExercise(skillId: string, rng: Rng): VisualExercise {
  const range = 10;

  if (skillId === "compound-inequalities" || skillId === "absolute-value-inequalities") {
    const isAbsValue = skillId === "absolute-value-inequalities";
    const center = randInt(rng, -3, 3);
    const dist = randInt(rng, 3, 7);
    const low = isAbsValue ? center - dist : randInt(rng, -6, 0);
    const high = isAbsValue ? center + dist : low + randInt(rng, 3, 8);
    const prompt = isAbsValue
      ? `Solve |x ${center >= 0 ? "−" : "+"} ${Math.abs(center)}| < ${dist}. Which number line shows the solution?`
      : `Which number line shows the solution set ${low} < x < ${high}?`;
    const correct: DiagramSpec = {
      type: "number-line",
      min: -range - Math.abs(low), max: range + Math.abs(high),
      mark: { kind: "segment", low, high, inclusiveLow: false, inclusiveHigh: false },
    };
    const distractors: DiagramSpec[] = [
      { type: "number-line", min: correct.min, max: correct.max, mark: { kind: "segment", low, high, inclusiveLow: true, inclusiveHigh: true } },
      { type: "number-line", min: correct.min, max: correct.max, mark: { kind: "segment", low: high, high: high + (high - low), inclusiveLow: false, inclusiveHigh: false } },
      { type: "number-line", min: correct.min, max: correct.max, mark: { kind: "ray", boundary: low, direction: "right", inclusive: false } },
    ];
    const { options, correctOptionId } = makeOptions(correct, distractors, rng);
    return {
      skillId,
      prompt,
      hint: isAbsValue
        ? "|x − c| < d means x is within d units of c on both sides."
        : "The solution is between two numbers — use open circles since it's a strict inequality (<).",
      explanation: isAbsValue
        ? `|x ${center >= 0 ? "−" : "+"} ${Math.abs(center)}| < ${dist} means ${low} < x < ${high}.`
        : `Both endpoints are open circles because the inequality is strict, and only values strictly between ${low} and ${high} work.`,
      options,
      correctOptionId,
    };
  }

  const a = randNonZero(rng, 2, 5);
  const boundaryRaw = randInt(rng, -6, 6);
  const useGreater = pick(rng, [true, false]);
  const inclusive = pick(rng, [true, false]);
  const b = randInt(rng, -8, 8);
  const c = a * boundaryRaw + b;
  const symbol = useGreater ? (inclusive ? "≥" : ">") : inclusive ? "≤" : "<";

  const correct: DiagramSpec = {
    type: "number-line",
    min: -range - Math.abs(boundaryRaw), max: range + Math.abs(boundaryRaw),
    mark: { kind: "ray", boundary: boundaryRaw, direction: useGreater ? "right" : "left", inclusive },
  };
  const distractors: DiagramSpec[] = [
    { type: "number-line", min: correct.min, max: correct.max, mark: { kind: "ray", boundary: boundaryRaw, direction: useGreater ? "left" : "right", inclusive } },
    { type: "number-line", min: correct.min, max: correct.max, mark: { kind: "ray", boundary: boundaryRaw, direction: useGreater ? "right" : "left", inclusive: !inclusive } },
    { type: "number-line", min: correct.min, max: correct.max, mark: { kind: "ray", boundary: boundaryRaw + (useGreater ? 2 : -2), direction: useGreater ? "right" : "left", inclusive } },
  ];
  const { options, correctOptionId } = makeOptions(correct, distractors, rng);
  return {
    skillId,
    prompt: `Which number line shows the solution to ${a}x ${b >= 0 ? "+" : "−"} ${Math.abs(b)} ${symbol} ${c}?`,
    hint: `Isolate x just like an equation — remember to flip the sign only if you divide by a negative.`,
    explanation: `Solving gives x ${symbol} ${boundaryRaw}. Use a ${inclusive ? "closed" : "open"} circle at ${boundaryRaw} and shade ${useGreater ? "right" : "left"}.`,
    options,
    correctOptionId,
  };
}

// ---------------------------------------------------------------------------
// Category: identify the point / quadrant on the coordinate plane
// ---------------------------------------------------------------------------

function buildQuadrantExercise(skillId: string, rng: Rng): VisualExercise {
  const range = 8;
  const x = randNonZero(rng, -6, 6);
  const y = randNonZero(rng, -6, 6);
  const correct: DiagramSpec = { type: "coordinate", range, points: [{ x, y, label: `(${x}, ${y})` }] };
  const distractors: DiagramSpec[] = [
    { type: "coordinate", range, points: [{ x: -x, y, label: `(${-x}, ${y})` }] },
    { type: "coordinate", range, points: [{ x, y: -y, label: `(${x}, ${-y})` }] },
    { type: "coordinate", range, points: [{ x: -x, y: -y, label: `(${-x}, ${-y})` }] },
  ];
  const { options, correctOptionId } = makeOptions(correct, distractors, rng);
  return {
    skillId,
    prompt: `Which graph correctly plots the point (${x}, ${y})?`,
    hint: "The first number moves left/right (x-axis), the second moves up/down (y-axis).",
    explanation: `(${x}, ${y}) means move ${Math.abs(x)} ${x >= 0 ? "right" : "left"} and ${Math.abs(y)} ${y >= 0 ? "up" : "down"} from the origin.`,
    options,
    correctOptionId,
  };
}

// ---------------------------------------------------------------------------
// Category: identify the correct line on a coordinate plane
// ---------------------------------------------------------------------------

function lineDiagram(range: number, line: GraphLine, extra?: Partial<CoordinateSpec>): DiagramSpec {
  return { type: "coordinate", range, lines: [line], ...extra };
}

function buildLineExercise(skillId: string, rng: Rng): VisualExercise {
  const range = 8;
  const slope = randNonZero(rng, -3, 3);
  const intercept = randInt(rng, -5, 5);

  if (skillId === "parallel-perpendicular") {
    const wantParallel = pick(rng, [true, false]);
    const refLine: GraphLine = { slope, intercept, color: "#94a3b8", dashed: true };
    const correctSlope = wantParallel ? slope : Math.abs(slope) < 0.01 ? 1 : -1 / slope;
    const correctIntercept = intercept + randNonZero(rng, -4, 4);

    const seen = new Set<string>([`${correctSlope}:${correctIntercept}`]);
    const slopeCandidates = shuffleArray(
      [slope, -slope, correctSlope, -correctSlope, slope + 2, slope - 2, correctSlope + 2, correctSlope - 2],
      rng
    );
    const interceptCandidates = shuffleArray(
      [intercept, correctIntercept, correctIntercept + 2, correctIntercept - 2, intercept + 3, intercept - 3],
      rng
    );

    const distractorLines: GraphLine[] = [];
    for (const s of slopeCandidates) {
      if (distractorLines.length >= 3) break;
      for (const b of interceptCandidates) {
        if (distractorLines.length >= 3) break;
        const key = `${s}:${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        distractorLines.push({ slope: s, intercept: b });
      }
    }
    // Guaranteed fallback fill (candidate pool above is large enough this should never trigger).
    let fallbackOffset = 5;
    while (distractorLines.length < 3) {
      const s = correctSlope + fallbackOffset;
      const b = correctIntercept + fallbackOffset;
      const key = `${s}:${b}`;
      if (!seen.has(key)) {
        seen.add(key);
        distractorLines.push({ slope: s, intercept: b });
      }
      fallbackOffset += 1;
    }

    const correct = lineDiagram(range, { slope: correctSlope, intercept: correctIntercept }, { lines: [refLine, { slope: correctSlope, intercept: correctIntercept }] });
    const distractors: DiagramSpec[] = distractorLines.map((line) => lineDiagram(range, line, { lines: [refLine, line] }));
    const { options, correctOptionId } = makeOptions(correct, distractors, rng);
    return {
      skillId,
      prompt: `The gray dashed line is y = ${slope}x ${intercept >= 0 ? "+" : "−"} ${Math.abs(intercept)}. Which solid line is ${wantParallel ? "PARALLEL" : "PERPENDICULAR"} to it?`,
      hint: wantParallel ? "Parallel lines have the exact same slope." : "Perpendicular lines have slopes that are negative reciprocals of each other.",
      explanation: wantParallel
        ? `A parallel line must also have slope ${slope}, just a different y-intercept.`
        : `A perpendicular line has slope ${correctSlope} (the negative reciprocal of ${slope}).`,
      options,
      correctOptionId,
    };
  }

  if (["graphing-systems", "substitution", "elimination", "systems-word-problems"].includes(skillId)) {
    const slope2 = randNonZero(rng, -3, 3);
    const intercept2 = intercept + randNonZero(rng, 2, 6) * pick(rng, [1, -1]);
    const ix = (intercept2 - intercept) / (slope - slope2 || 1);
    const iy = slope * ix + intercept;
    const correctLines: GraphLine[] = [
      { slope, intercept, color: "#0f172a" },
      { slope: slope2, intercept: intercept2, color: "#64748b" },
    ];
    const correct: DiagramSpec = { type: "coordinate", range, lines: correctLines, points: [{ x: Math.round(ix), y: Math.round(iy) }] };
    const distractors: DiagramSpec[] = [
      { type: "coordinate", range, lines: [{ slope: slope2, intercept, color: "#0f172a" }, { slope, intercept: intercept2, color: "#64748b" }] },
      { type: "coordinate", range, lines: [{ slope, intercept: intercept2, color: "#0f172a" }, { slope: slope2, intercept, color: "#64748b" }] },
      { type: "coordinate", range, lines: [{ slope: -slope, intercept, color: "#0f172a" }, { slope: slope2, intercept: intercept2, color: "#64748b" }] },
    ];
    const { options, correctOptionId } = makeOptions(correct, distractors, rng);
    return {
      skillId,
      prompt: `Which graph shows the two lines y = ${slope}x ${intercept >= 0 ? "+" : "−"} ${Math.abs(intercept)} and y = ${slope2}x ${intercept2 >= 0 ? "+" : "−"} ${Math.abs(intercept2)}, with their intersection marked?`,
      hint: "Graph each line using its slope and y-intercept, then find where they cross.",
      explanation: "The solution to a system is exactly the point where both lines intersect.",
      options,
      correctOptionId,
    };
  }

  // Default: single line recognition (slope, graphing-lines, intercepts, slope-intercept, point-slope, standard-form, function-graphs, domain-range)
  const correct = lineDiagram(range, { slope, intercept });
  const distractors: DiagramSpec[] = [
    lineDiagram(range, { slope: -slope, intercept }),
    lineDiagram(range, { slope, intercept: intercept + randNonZero(rng, -4, 4) }),
    lineDiagram(range, { slope: slope === 0 ? 1 : (slope > 0 ? slope + 2 : slope - 2), intercept }),
  ];
  const { options, correctOptionId } = makeOptions(correct, distractors, rng);
  const eqStr = `y = ${slope}x ${intercept >= 0 ? "+" : "−"} ${Math.abs(intercept)}`;
  return {
    skillId,
    prompt: `Which graph shows the line ${eqStr}?`,
    hint: `Start at the y-intercept (${intercept}), then use the slope (${slope}) to find the next point.`,
    explanation: `For ${eqStr}: cross the y-axis at ${intercept}, then move right 1 and ${slope >= 0 ? "up" : "down"} ${Math.abs(slope)} to plot more points.`,
    options,
    correctOptionId,
  };
}

// ---------------------------------------------------------------------------
// Category: shaded half-plane for a 2D inequality
// ---------------------------------------------------------------------------

function buildHalfPlaneExercise(skillId: string, rng: Rng): VisualExercise {
  const range = 8;
  const slope = randNonZero(rng, -3, 3);
  const intercept = randInt(rng, -4, 4);
  const shade = pick<"above" | "below">(rng, ["above", "below"]);
  const line: GraphLine = { slope, intercept };

  const correct: DiagramSpec = { type: "coordinate", range, lines: [line], shade };
  const distractors: DiagramSpec[] = [
    { type: "coordinate", range, lines: [line], shade: shade === "above" ? "below" : "above" },
    { type: "coordinate", range, lines: [{ slope: -slope, intercept }], shade },
    { type: "coordinate", range, lines: [{ slope, intercept: intercept + randNonZero(rng, 2, 4) }], shade },
  ];
  const { options, correctOptionId } = makeOptions(correct, distractors, rng);
  const symbol = shade === "above" ? "y > mx + b" : "y < mx + b";
  return {
    skillId,
    prompt: `Which graph correctly shades the region for y ${shade === "above" ? ">" : "<"} ${slope}x ${intercept >= 0 ? "+" : "−"} ${Math.abs(intercept)}?`,
    hint: `If y is greater than the line (${symbol}), shade above it. If less than, shade below.`,
    explanation: `Since the inequality is "${shade === "above" ? "greater than" : "less than"}", shade the region ${shade} the boundary line.`,
    options,
    correctOptionId,
  };
}

// ---------------------------------------------------------------------------
// Category: parabola shape recognition
// ---------------------------------------------------------------------------

function buildParabolaExercise(skillId: string, rng: Rng): VisualExercise {
  const range = 8;
  const opensUp = pick(rng, [true, false]);
  const a = (opensUp ? 1 : -1) * pick(rng, [0.5, 1]);
  const h = randInt(rng, -3, 3);
  const k = randInt(rng, -3, 3);

  const correct: DiagramSpec = { type: "coordinate", range, parabola: { a, h, k }, points: [{ x: h, y: k, label: `(${h}, ${k})` }] };
  const distractors: DiagramSpec[] = [
    { type: "coordinate", range, parabola: { a: -a, h, k }, points: [{ x: h, y: k, label: `(${h}, ${k})` }] },
    { type: "coordinate", range, parabola: { a, h: -h || 2, k }, points: [{ x: -h || 2, y: k, label: `(${-h || 2}, ${k})` }] },
    { type: "coordinate", range, parabola: { a, h, k: -k || 2 }, points: [{ x: h, y: -k || 2, label: `(${h}, ${-k || 2})` }] },
  ];
  const { options, correctOptionId } = makeOptions(correct, distractors, rng);
  return {
    skillId,
    prompt: `Which graph shows y = ${a === 1 ? "" : a}(x ${h >= 0 ? "−" : "+"} ${Math.abs(h)})² ${k >= 0 ? "+" : "−"} ${Math.abs(k)}?`,
    hint: `The vertex is at (${h}, ${k}). The parabola opens ${opensUp ? "up" : "down"} because a is ${opensUp ? "positive" : "negative"}.`,
    explanation: `Vertex form (x − h)² + k has vertex (${h}, ${k}); the sign of a controls whether it opens up or down.`,
    options,
    correctOptionId,
  };
}

// ---------------------------------------------------------------------------
// Skill → category dispatch
// ---------------------------------------------------------------------------

type Category = "point" | "inequality" | "quadrant" | "line" | "half-plane" | "parabola";

const CATEGORY_BY_SKILL: Record<string, Category> = {
  "unit-basics": "point",
  "dimensional-analysis": "point",
  "unit-word-problems": "point",
  "one-step-equations": "point",
  "two-step-equations": "point",
  "multi-step-equations": "point",
  "equations-with-fractions": "point",
  "linear-inequalities": "inequality",
  "coordinate-plane": "quadrant",
  slope: "line",
  "graphing-lines": "line",
  intercepts: "line",
  "slope-intercept": "line",
  "point-slope": "line",
  "standard-form": "line",
  "parallel-perpendicular": "line",
  "graphing-systems": "line",
  substitution: "line",
  elimination: "line",
  "systems-word-problems": "line",
  "graphing-inequalities": "half-plane",
  "compound-inequalities": "inequality",
  "systems-inequalities": "half-plane",
  "function-notation": "point",
  "domain-range": "line",
  "function-graphs": "line",
  "arithmetic-sequences": "point",
  "geometric-sequences": "point",
  "exponent-rules": "point",
  "negative-fractional-exponents": "point",
  "scientific-notation": "point",
  "simplifying-radicals": "point",
  "exponential-functions": "point",
  "exponential-growth": "point",
  "exponential-decay": "point",
  "multiplying-binomials": "point",
  "special-products": "point",
  "factoring-trinomials": "point",
  "factoring-special": "point",
  "graphing-parabolas": "parabola",
  "solving-by-factoring": "point",
  "completing-square": "point",
  "quadratic-formula": "point",
  "absolute-value": "point",
  "absolute-value-inequalities": "inequality",
  "piecewise-functions": "point",
};

/** Generates a fresh, randomized "Visualize It" exercise for a skill. Pass a
 * nonce (e.g. attempt count) to get a different variation each time. */
export function getVisualExercise(skillId: string, nonce = 0): VisualExercise {
  const rng = createSeededRng(hashString(`${skillId}::visual::${nonce}`));
  const category = CATEGORY_BY_SKILL[skillId] ?? "point";
  switch (category) {
    case "point":
      return buildPointExercise(skillId, rng);
    case "inequality":
      return buildInequalityExercise(skillId, rng);
    case "quadrant":
      return buildQuadrantExercise(skillId, rng);
    case "line":
      return buildLineExercise(skillId, rng);
    case "half-plane":
      return buildHalfPlaneExercise(skillId, rng);
    case "parabola":
      return buildParabolaExercise(skillId, rng);
    default:
      return buildPointExercise(skillId, rng);
  }
}
