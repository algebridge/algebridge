/**
 * The tutor check's answer key, worked out again here from scratch, so a
 * wrong key can never mark a tutor wrong for being right.
 */
import { QUESTIONS, SECTIONS, isRight, scoreTest, passMark, type TutorQuestion } from "../tutor-test.ts";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) pass++;
  else { fail++; console.log("  FAIL:", name, extra); }
};
const q = (id: string): TutorQuestion => {
  const found = QUESTIONS.find((x) => x.id === id);
  if (!found) throw new Error(`no question ${id}`);
  return found;
};
const key = (id: string) => {
  const x = q(id);
  return x.kind === "choice" ? x.choices[x.answer] : x.answer;
};
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const xs = [-3, -1.5, 0, 0.5, 2, 7];

// --- shape ------------------------------------------------------------------
ok("ids unique", new Set(QUESTIONS.map((x) => x.id)).size === QUESTIONS.length);
for (const s of SECTIONS) ok(`section ${s.id} has questions`, QUESTIONS.some((x) => x.section === s.id));
for (const x of QUESTIONS) {
  if (x.kind !== "choice") continue;
  ok(`${x.id} answer in range`, x.answer >= 0 && x.answer < x.choices.length);
  ok(`${x.id} choices distinct`, new Set(x.choices).size === x.choices.length);
}
// The right choice should not always sit in the same spot.
const spots = new Set(QUESTIONS.filter((x) => x.kind === "choice").map((x) => (x as { answer: number }).answer));
ok("right answers spread over spots", spots.size === 4);

// --- the math, worked again ---------------------------------------------------
ok("ex-distribute", xs.every((x) => near(3 * (2 * x - 4) - 2 * (x - 5), 4 * x - 2)) && key("ex-distribute") === "4x − 2");
{ const x = -2; ok("ex-negative-square", key("ex-negative-square") === -(x ** 2) + 3 * x); }
ok("ex-order", key("ex-order") === (18 / 3) * 2 - 4 ** 2);
{ const x = key("eq-both-sides") as number; ok("eq-both-sides", near(5 - 2 * (x - 3), 3 * x - 9)); }
{ const x = key("eq-fractions") as number; ok("eq-fractions", near((2 / 3) * x - 1 / 2, 5 / 6)); }
ok("eq-inequality-flip", [-10, -5, -4.01].every((x) => -3 * x + 7 > 19) && [-4, 0, 3].every((x) => !(-3 * x + 7 > 19)) && key("eq-inequality-flip") === "x < −4");
ok("eq-identity", xs.every((x) => near(4 * (x - 2), 4 * x - 8)) && key("eq-identity") === "Infinitely many");
ok("eq-absolute", Math.abs(2 * 5 - 3) === 7 && Math.abs(2 * -2 - 3) === 7 && key("eq-absolute") === "x = 5 or x = −2");
{ const A = 30, b1 = 4, b2 = 8, h = (2 * A) / (b1 + b2); ok("eq-literal", near(0.5 * h * (b1 + b2), A) && key("eq-literal") === "h = 2A / (b₁ + b₂)"); }
ok("fn-slope", key("fn-slope") === (-7 - 5) / (4 - -2));
ok("fn-intercept", near(1 - (2 / 3) * 3, key("fn-intercept") as number));
ok("fn-perpendicular", near(4 * -0.25, -1) && near(-0.25 * 8 + 5, 3) && key("fn-perpendicular") === "y = −¼x + 5");
ok("fn-input", 3 * (key("fn-input") as number) - 7 === 11);
ok("fn-not-function", key("fn-not-function") === "{(2, 1), (2, 5), (3, 0)}");
ok("sys-solve", 2 * 3 + 1 === 7 && 3 - 1 === 2 && key("sys-solve") === "(3, 1)");
{ const a = key("sys-tickets") as number, s = 40 - a; ok("sys-tickets", 8 * a + 5 * s === 260); }
ok("exp-rules", xs.filter((x) => x !== 0).every((x) => near((2 * x ** 3) ** 2 * x ** -4, 4 * x ** 2)) && key("exp-rules") === "4x²");
ok("exp-rational", near(16 ** 0.75, key("exp-rational") as number));
ok("exp-growth", key("exp-growth") === "500(1.06)ᵗ");
ok("exp-radical", near(Math.sqrt(72), 6 * Math.SQRT2) && key("exp-radical") === "6√2");
ok("poly-multiply", xs.every((x) => near((x + 5) * (2 * x - 3), 2 * x * x + 7 * x - 15)) && key("poly-multiply") === "2x² + 7x − 15");
ok("poly-factor-simple", xs.every((x) => near(x * x - x - 12, (x - 4) * (x + 3))) && key("poly-factor-simple") === "(x − 4)(x + 3)");
ok("poly-factor-gcf", xs.every((x) => near(3 * x * x - 48, 3 * (x - 4) * (x + 4))) && key("poly-factor-gcf") === "3(x − 4)(x + 4)");
ok("poly-factor-ac", xs.every((x) => near(6 * x * x + 7 * x - 3, (3 * x - 1) * (2 * x + 3))) && key("poly-factor-ac") === "(3x − 1)(2x + 3)");
// The wrong factorings really are wrong.
ok("poly-factor-ac distractors wrong", [(x: number) => (3 * x + 1) * (2 * x - 3), (x: number) => (6 * x - 1) * (x + 3), (x: number) => (2 * x - 1) * (3 * x + 3)].every((f) => xs.some((x) => !near(f(x), 6 * x * x + 7 * x - 3))));
ok("quad-factor-solve", [3, -5].every((x) => x * x + 2 * x - 15 === 0) && key("quad-factor-solve") === "x = 3 or x = −5");
ok("quad-vertex", 3 * 3 - 6 * 3 + 5 === -4 && key("quad-vertex") === "(3, −4)");
ok("quad-discriminant", 16 - 4 * 2 * 5 < 0 && key("quad-discriminant") === 0);
ok("quad-formula", [2 + Math.sqrt(5), 2 - Math.sqrt(5)].every((x) => near(x * x - 4 * x - 1, 0)) && key("quad-formula") === "x = 2 ± √5");
{ const t = -64 / (2 * -16); ok("quad-max", -16 * t * t + 64 * t === key("quad-max")); }
ok("mis-step", 12 * 3 - 5 === 2 * 12 + 7 && key("mis-step") === "Step 3");
ok("mis-slope", (10 - 4) / (3 - 1) === 3);
ok("mis-neg-power", -(3 ** 2) === -9);

// --- grading -----------------------------------------------------------------
ok("typed −10 with a typographic minus", isRight(q("ex-negative-square"), "−10"));
ok("typed x = 4", isRight(q("eq-both-sides"), "x = 4"));
ok("typed 64 feet", isRight(q("quad-max"), "64 feet"));
ok("typed wrong", !isRight(q("ex-order"), "4"));
ok("blank is wrong", !isRight(q("ex-order"), ""));
ok("choice right", isRight(q("ex-distribute"), "1"));
ok("choice wrong", !isRight(q("ex-distribute"), "0"));

const all: Record<string, string> = {};
for (const x of QUESTIONS) all[x.id] = String(x.answer);
const full = scoreTest(all);
ok("full marks pass", full.score === QUESTIONS.length && full.passed);
const none = scoreTest({});
ok("blank fails", none.score === 0 && !none.passed);
const justEnough: Record<string, string> = {};
QUESTIONS.slice(0, passMark()).forEach((x) => (justEnough[x.id] = String(x.answer)));
ok("pass mark passes", scoreTest(justEnough).passed);
delete justEnough[QUESTIONS[0].id];
ok("one under fails", !scoreTest(justEnough).passed);

console.log(`tutor-test: ${pass} passed, ${fail} failed (${QUESTIONS.length} questions, pass at ${passMark()})`);
if (fail) process.exit(1);
