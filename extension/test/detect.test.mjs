// Run: npm run test:detect   (plain Node, no dependencies)
import { createRequire } from "node:module";
import { BASES, NEGATIVES, REAL_NEGATIVES, REAL_POSITIVES, buildPositives } from "./corpus.mjs";

const require = createRequire(import.meta.url);
const D = require("../src/detect.js");
const VERBOSE = process.argv.includes("--verbose");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.log("FAIL " + name + "\n     " + (e && e.message ? e.message : e));
  }
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg ? msg + ": " : "") + "expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

// ---------------------------------------------------------------- API shape
test("exports the documented API", () => {
  for (const k of ["normalizeMath", "texToText", "mathmlToText", "scoreText", "extractProblems", "findProblems", "hash"]) {
    eq(typeof D[k], "function", k);
  }
  eq(globalThis.AlgeBridgeDetect, D, "globalThis.AlgeBridgeDetect");
});

// ---------------------------------------------------------------- normalizeMath
const NORMALIZE = [
  ["x\u00B2 \u2212 5x + 6 = 0", "x^2 - 5x + 6 = 0"],
  ["x\u207B\u00B9", "x^-1"],
  ["x\u207F\u207A\u00B9", "x^(n+1)"],
  ["a\u2081 + a\u2082", "a_1 + a_2"],
  ["3 \u00D7 4 \u00F7 2", "3 * 4 / 2"],
  ["2\u00B7x", "2*x"],
  ["x \u2264 5", "x \u2264 5"],
  ["x \u2265 5 and y \u2260 2", "x \u2265 5 and y \u2260 2"],
  ["\u221A 49", "\u221A49"],
  ["x\u00A0+\u2009y\u202F=\u20037", "x + y = 7"],
  ["  a   b \n c ", "a b c"],
  ["x\u2013y", "x-y"],
  ["\uD835\uDC65 + \uD835\uDC66 = 5", "x + y = 5"],
  ["2\u00BD + \u00BE", "2 1/2 + 3/4"],
  ["x\u2062y", "xy"],
  ["5 \u2014 3", "5 - 3"],
  ["\u2018quoted\u2019", "'quoted'"]
];
for (const [input, expected] of NORMALIZE) {
  test("normalizeMath " + JSON.stringify(input), () => eq(D.normalizeMath(input), expected));
}
test("normalizeMath handles empty and non-string input", () => {
  eq(D.normalizeMath(""), "");
  eq(D.normalizeMath(null), "");
  eq(D.normalizeMath(42), "42");
});

// ---------------------------------------------------------------- texToText
const TEX = [
  ["\\frac{x+1}{2} = 3", "(x + 1)/(2) = 3"],
  ["\\dfrac{3}{4}x", "(3)/(4)x"],
  ["\\frac12", "(1)/(2)"],
  ["\\frac{\\frac{1}{x}}{2}", "((1)/(x))/(2)"],
  ["\\sqrt{x+1}", "\u221A(x + 1)"],
  ["\\sqrt[3]{x+1} = 2", "\u221B(x + 1) = 2"],
  ["\\sqrt[4]{16x^{2}}", "\u221C(16x^2)"],
  ["\\sqrt[5]{x-1}", "root(5, x - 1)"],
  ["\\sqrt[n]{a}", "root(n, a)"],
  ["\\sqrt[2]{x}", "\u221A(x)"],
  ["2\\sqrt[3]{x}", "2\u221B(x)"],
  ["\\log_{10}10", "log_10 10"],
  ["\\log _{b}x", "log_b x"],
  ["\\sqrt{\\frac{a}{b}}", "\u221A((a)/(b))"],
  ["\\left( x+1 \\right)^{2}", "(x + 1)^2"],
  ["\\left| 2x - 3 \\right| = 7", "|2x - 3| = 7"],
  ["\\left[ x \\right]", "[x]"],
  ["\\left. x \\right|_{0}", "x|_0"],
  ["2x \\le 6", "2x \u2264 6"],
  ["2x \\leq 6", "2x \u2264 6"],
  ["x \\ge -1", "x \u2265 -1"],
  ["x \\neq 0", "x \u2260 0"],
  ["\\log_{2}(x) = 5", "log_2(x) = 5"],
  ["\\log_2 8", "log_2 8"],
  ["\\ln x + \\ln 2", "ln x + ln 2"],
  ["x^{2} - 5x + 6 = 0", "x^2 - 5x + 6 = 0"],
  ["x^{n+1}", "x^(n + 1)"],
  ["e^{2x}", "e^(2x)"],
  ["x^{-1}", "x^-1"],
  ["x^{{2}}", "x^2"],
  ["a_{n-1}", "a_(n - 1)"],
  ["3 \\cdot 4 \\times 5 \\div 2", "3 * 4 * 5 / 2"],
  ["\\pi r^2", "\u03C0 r^2"],
  ["\\text{Solve for } x", "Solve for x"],
  ["\\displaystyle \\frac{1}{2}", "(1)/(2)"],
  ["x\\,+\\;y\\quad=\\!7", "x + y = 7"],
  ["{{x}}+{1}", "x + 1"],
  ["\\pm 3", "\u00B1 3"],
  ["90^{\\circ}", "90\u00B0"],
  ["\\begin{cases} 2x + y = 7 \\\\ x - y = 2 \\end{cases}", "{ 2x + y = 7; x - y = 2 }"],
  ["\\begin{aligned} y &= 3x \\\\ x &= 2 \\end{aligned}", "y = 3x; x = 2"],
  ["\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}", "[1, 2; 3, 4]"],
  ["\\sum_{k=1}^{5} k^2", "\u03A3_(k = 1)^5 k^2"],
  ["$x^2$", "x^2"],
  ["\\mathbb{R}", "\u211D"],
  ["\\color{red}{x} + 1", "x + 1"],
  ["\\operatorname{lcm}(a, b)", "lcm(a, b)"]
];
for (const [input, expected] of TEX) {
  test("texToText " + JSON.stringify(input), () => eq(D.texToText(input), expected));
}
test("texToText survives unbalanced input", () => {
  ok(typeof D.texToText("\\frac{1}{") === "string");
  ok(typeof D.texToText("x^{") === "string");
  ok(typeof D.texToText("\\begin{cases} x") === "string");
  eq(D.texToText(""), "");
});

// ---------------------------------------------------------------- hash
test("hash is stable FNV-1a hex", () => {
  eq(D.hash(""), "811c9dc5");
  eq(D.hash("a"), "e40c292c");
  eq(D.hash("x^2 - 5x + 6 = 0"), D.hash("x^2 - 5x + 6 = 0"));
  ok(/^[0-9a-f]{8}$/.test(D.hash("Solve for x: 3x + 5 = 20")), "8 hex chars");
  ok(D.hash("3x + 5 = 20") !== D.hash("3x + 5 = 21"), "different text, different hash");
});

// ---------------------------------------------------------------- extractProblems
test("extractProblems splits a numbered worksheet on one line", () => {
  const ps = D.extractProblems("1. 2x + 3 = 7 2. 5x - 1 = 9 3. x/2 + 4 = 10");
  eq(ps.length, 3, "count");
  eq(ps[0].text, "2x + 3 = 7");
  eq(ps[1].text, "5x - 1 = 9");
  eq(ps[2].text, "x/2 + 4 = 10");
  for (const p of ps) eq(p.kind, "linear-equation");
});
test("extractProblems carries the instruction header into each problem", () => {
  const ps = D.extractProblems("Factor completely.\n1) x^2 + 5x + 6\n2) x^2 - 16\n3) 2x^2 + 7x + 3");
  eq(ps.length, 3, "count");
  eq(ps[0].text, "Factor completely.\nx^2 + 5x + 6");
  for (const p of ps) eq(p.kind, "factoring");
});
test("extractProblems splits lettered parts", () => {
  const ps = D.extractProblems("Solve each equation. a) 3x - 4 = 11 b) 2(x + 1) = 10 c) x^2 = 81");
  eq(ps.length, 3, "count");
  eq(ps[2].kind, "quadratic");
});
test("extractProblems keeps a parenthesized product intact", () => {
  const ps = D.extractProblems("1. Multiply (x + 3)(x - 2) 2. Expand (2x + 1)^2");
  eq(ps.length, 2, "count");
  eq(ps[0].text, "Multiply (x + 3)(x - 2)");
});
test("extractProblems merges a system written on two lines", () => {
  const ps = D.extractProblems("Solve the system.\n2x + y = 7\nx - y = 2");
  eq(ps.length, 1, "count");
  eq(ps[0].kind, "system");
  ok(ps[0].text.indexOf("x - y = 2") >= 0, "second equation kept");
});
test("extractProblems on ten numbered lines", () => {
  const lines = [];
  for (let n = 1; n <= 10; n++) lines.push(n + ". " + n + "x + " + (n + 2) + " = " + (3 * n + 2));
  const ps = D.extractProblems("Solve each equation.\n" + lines.join("\n"));
  eq(ps.length, 10, "count");
});
test("extractProblems ignores prose and code", () => {
  eq(D.extractProblems("We met on 2026-09-30 at 3:30 p.m. and the score was 3-2.").length, 0);
  eq(D.extractProblems("let y = x * 2;\nconsole.log(y);").length, 0);
});
test("extractProblems caps text at 600 characters", () => {
  const filler = "This paragraph talks about the history of the town and the people who live there. ".repeat(12);
  const ps = D.extractProblems(filler + "Solve 3x + 5 = 20 to find the number of hours. " + filler);
  eq(ps.length, 1, "count");
  ok(ps[0].text.length <= 600, "length " + ps[0].text.length);
  ok(ps[0].text.indexOf("3x + 5 = 20") >= 0, "keeps the math");
});

test("extractProblems: (3) after a function name is math, not a list marker", () => {
  const ps = D.extractProblems("Solve each of the following equations.\nlog (6x) - log (4 - x) = log (3)");
  eq(ps.length, 1, "count");
  eq(ps[0].expr, "log (6x) - log (4 - x) = log (3)");
});
test("extractProblems: a part letter before an equation is a label", () => {
  const a = D.extractProblems("Example 1 Solve each of the following equations.\na 3(x + 5) = 2(- 6 - x) - 2x");
  const b = D.extractProblems("Example 1 Solve each of the following equations.\n3(x + 5) = 2(- 6 - x) - 2x");
  eq(a.length, 1, "count");
  eq(a[0].text, b[0].text, "same text as the unlabeled item");
  eq(a[0].kind, "linear-equation");
});
test("extractProblems: a short verbal item takes the directions above it", () => {
  const ps = D.extractProblems("146. u divided by 7 is equal to -49.", { header: "In the following exercises, translate to an equation and solve." });
  eq(ps.length, 1, "count");
  eq(ps[0].kind, "linear-equation");
});

// ---------------------------------------------------------------- evaluator
const I = D._internal;
test("identity check: true for identities, false for equations", () => {
  eq(I.isIdentity("(a+b)(a-b) = a^2 - b^2"), true);
  eq(I.isIdentity("2y + 6 = 2(y + 3)"), true);
  eq(I.isIdentity("(c)/(d) = cd^-1"), true);
  eq(I.isIdentity("log_2(x^2) = 2log_2|x|"), true);
  eq(I.isIdentity("x^2 = 3x - 1"), false);
  eq(I.isIdentity("2x + 3 = 7"), false);
  eq(I.isIdentity("x! = 3"), null, "unreadable means unknown");
});
test("same-equation check: rewrites match, different problems do not", () => {
  eq(I.sameEquation("x^2 + 5x + 6 = 0", "(x + 2)(x + 3) = 0"), true);
  eq(I.sameEquation("2x + 3(x - 3) = 6", "5x - 15 = 0", true), true);
  eq(I.sameEquation("7 - 10/x = 2 + 15/x", "5 = 25/x"), true);
  eq(I.sameEquation("2x^2 + 4x - 4 = 0", "x^2 + 2x - 2 = 0"), true);
  // same answer (x = 3) but a different problem: only the loose test says yes
  eq(I.sameEquation("5x - 2 = 13", "7x + 1 = 22", true), false);
  eq(I.sameEquation("5x - 2 = 13", "7x + 1 = 22", false), true);
  eq(I.sameEquation("y = 2x + 7", "y = -x + 1"), false);
  eq(I.sameEquation("x^2 = 9", "x = 3"), false);
});

// ---------------------------------------------------------------- cache safety
test("scoreText returns a copy: editing it does not change later answers", () => {
  const a = D.scoreText("Solve for x: 3x + 5 = 20");
  a.kind = "changed"; a.reasons.push("changed"); a.score = 0;
  const b = D.scoreText("Solve for x: 3x + 5 = 20");
  eq(b.kind, "linear-equation");
  eq(b.score > 0.5, true);
  eq(b.reasons.indexOf("changed"), -1);
});

// ---------------------------------------------------------------- scoreText shape
test("scoreText returns the documented shape", () => {
  const r = D.scoreText("Solve for x: 3x + 5 = 20");
  eq(r.isAlgebra, true);
  ok(r.score > 0 && r.score <= 1, "score in (0, 1]");
  eq(r.kind, "linear-equation");
  eq(r.level, 1);
  eq(r.expr, "3x + 5 = 20");
  ok(Array.isArray(r.reasons), "reasons array");
  const n = D.scoreText("");
  eq(n.isAlgebra, false);
  eq(n.score, 0);
});

// ---------------------------------------------------------------- corpus metrics
const positives = buildPositives(D.texToText);
test("corpus size", () => {
  ok(positives.length >= 220, "positives " + positives.length);
  ok(NEGATIVES.length >= 170, "negatives " + NEGATIVES.length);
  ok(positives.filter((p) => p.level === 1).length >= 100, "algebra 1 positives");
  ok(positives.filter((p) => p.level === 2).length >= 100, "algebra 2 positives");
});

const misses = [];
const kindMiss = [];
const levelMiss = [];
let hit = 0, hit1 = 0, hit2 = 0, n1 = 0, n2 = 0, kindOk = 0, levelOk = 0;
for (const p of positives) {
  const r = D.scoreText(p.text);
  if (p.level === 1) n1++; else n2++;
  if (r.isAlgebra) {
    hit++;
    if (p.level === 1) hit1++; else hit2++;
  } else misses.push(p.text + "  [score " + r.score + " " + r.reasons.join(",") + "]");
  if (r.kind === p.kind) kindOk++; else kindMiss.push(p.text + "  [want " + p.kind + ", got " + r.kind + "]");
  if (r.level === p.level) levelOk++; else levelMiss.push(p.text + "  [want L" + p.level + ", got L" + r.level + "]");
}
const fps = [];
for (const [cat, text] of NEGATIVES) {
  const r = D.scoreText(text);
  if (r.isAlgebra) fps.push("[" + cat + "] " + text + "  [score " + r.score + " " + r.reasons.join(",") + "]");
}
const recall = hit / positives.length;
const recall1 = hit1 / n1;
const recall2 = hit2 / n2;
const fpr = fps.length / NEGATIVES.length;
const kindAcc = kindOk / positives.length;
const levelAcc = levelOk / positives.length;
const pct = (x) => (x * 100).toFixed(1) + "%";
console.log(
  "corpus: " + positives.length + " positives (" + BASES.length + " base problems, A1 " + n1 + ", A2 " + n2 + "), " +
  NEGATIVES.length + " negatives"
);
console.log(
  "recall " + pct(recall) + " (A1 " + pct(recall1) + ", A2 " + pct(recall2) + "), false positive rate " + pct(fpr) +
  ", kind accuracy " + pct(kindAcc) + ", level accuracy " + pct(levelAcc)
);
const show = (title, list) => {
  if (!list.length) return;
  console.log(title + " (" + list.length + "):");
  for (const line of VERBOSE ? list : list.slice(0, 15)) console.log("   " + line);
};
show("missed positives", misses);
show("false positives", fps);
show("kind mismatches", kindMiss);
show("level mismatches", levelMiss);

// ---------------------------------------------------------------- real-web cases
test("real-web corpus size", () => {
  ok(REAL_NEGATIVES.length >= 50, "real negatives " + REAL_NEGATIVES.length);
  ok(REAL_POSITIVES.length >= 15, "real positives " + REAL_POSITIVES.length);
});
for (const [src, text] of REAL_NEGATIVES) {
  test("real-web negative stays quiet [" + src + "] " + JSON.stringify(text.slice(0, 60)), () => {
    const r = D.scoreText(text);
    ok(!r.isAlgebra, "flagged: score " + r.score + " " + r.reasons.join(","));
    eq(D.extractProblems(text).length, 0, "extractProblems count");
  });
}
for (const p of REAL_POSITIVES) {
  test("real-web positive is found [" + p.src + "] " + JSON.stringify(p.text.slice(0, 60)), () => {
    const ps = D.extractProblems(p.text);
    eq(ps.length, 1, "count");
    eq(ps[0].kind, p.k, "kind");
    eq(ps[0].level, p.l, "level");
    ok(D.hasMathSeed(D.normalizeMath(p.text)), "math seed");
  });
}
test("every corpus positive passes the cheap math seed findProblems uses", () => {
  const miss = positives.filter((p) => !D.hasMathSeed(D.normalizeMath(p.text)));
  eq(miss.length, 0, miss.map((p) => p.text).join(" | "));
});

test("recall >= 0.95 overall", () => ok(recall >= 0.95, pct(recall)));
test("recall >= 0.90 on Algebra 1", () => ok(recall1 >= 0.9, pct(recall1)));
test("recall >= 0.90 on Algebra 2", () => ok(recall2 >= 0.9, pct(recall2)));
test("false positive rate <= 0.02", () => ok(fpr <= 0.02, pct(fpr)));
test("kind accuracy >= 0.85", () => ok(kindAcc >= 0.85, pct(kindAcc)));
test("level accuracy >= 0.90", () => ok(levelAcc >= 0.9, pct(levelAcc)));

console.log(passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
