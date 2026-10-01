// Real-web check for extension/src/detect.js.
// Run: node extension/test/realweb.mjs [--only id1,id2] [--out file.json] [--dump dir]
//
// Loads real public pages in headless Google Chrome (no extension, no sign in,
// no form submits, no cookie banners clicked), injects detect.js with
// Runtime.evaluate and runs findProblems(document, { visibleOnly: true }) the
// way content.js does. For every page it records what was found, how long a
// scan takes, and compares the finds with hand judgments below:
//   - "neg" pages should report nothing (or only the few real problems listed
//     in `ok`), every other find is a false positive;
//   - "pos" pages list `want`: problems that are on the page and should be
//     found (substring of the found text), and `wrong`: finds judged wrong.
// Pages change over time, so this is a report, not a gate. Real failures it
// found live on as plain text in corpus.mjs and as DOM fixtures in
// dom-fixtures/, which npm run test:detect and test:detect:dom do gate.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DETECT = path.join(HERE, "..", "src", "detect.js");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BUDGET_MS = 60; // content.js BUDGET_MS

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const ONLY = (arg("--only") || "").split(",").filter(Boolean);
const OUT = arg("--out") || path.join(os.tmpdir(), "algebridge-realweb.json");
const DUMP = arg("--dump");

// type: "pos" = a page with algebra problems (practice sets, exercises, worked
//                 examples), "neg" = a page that should report no problems.
// Hand judgments, all matched whitespace-insensitive and case-insensitive
// against the found problem text:
//   want  - problems on the page that should be found (coverage)
//   wantSel - CSS selector of the page's own problem containers; every one
//           that holds math notation should contain a find (coverage), and a
//           find inside one counts as right
//   wantSkip - containers left out of coverage (a conceptual question, an
//           arithmetic readiness check)
//   right - other finds judged right (a concrete problem a student could be set)
//   wrong - finds judged wrong (worked-solution steps, formulas, identities,
//           explanations, comments)
//   ok    - on a "neg" page, finds that are real problems after all
// Judging rule: right = a concrete problem statement (a practice item, an
// exercise, an "Example: Solve ..." line, a concrete equation a lesson sets
// up). Wrong = a step or answer inside a worked solution, a general formula
// or identity, an explanation that mentions math, a reader comment.
export const PAGES = [
  // ------------------------------------------------------------ positive
  { id: "lamar-linear", type: "pos", url: "https://tutorial.math.lamar.edu/Problems/Alg/SolveLinearEqns.aspx", wantSel: "ol.practice-problems > li" },
  { id: "lamar-quadratic", type: "pos", url: "https://tutorial.math.lamar.edu/Problems/Alg/SolveQuadraticEqnsI.aspx", wantSel: "ol.practice-problems > li" },
  { id: "lamar-log", type: "pos", url: "https://tutorial.math.lamar.edu/Problems/Alg/SolveLogEqns.aspx", wantSel: "ol.practice-problems > li" },
  { id: "lamar-factoring", type: "pos", url: "https://tutorial.math.lamar.edu/Problems/Alg/Factoring.aspx", wantSel: "ol.practice-problems > li" },
  { id: "lamar-radical", type: "pos", url: "https://tutorial.math.lamar.edu/Problems/Alg/SolveRadicalEqns.aspx", wantSel: "ol.practice-problems > li" },
  { id: "lamar-systems", type: "pos", url: "https://tutorial.math.lamar.edu/Problems/Alg/SystemsTwoVrble.aspx", wantSel: "ol.practice-problems > li" },
  { id: "lamar-exp", type: "pos", url: "https://tutorial.math.lamar.edu/Problems/Alg/SolveExpEqns.aspx", wantSel: "ol.practice-problems > li" },
  {
    id: "lamar-notes-linear", type: "pos", url: "https://tutorial.math.lamar.edu/Classes/Alg/SolveLinearEqns.aspx",
    want: ["3(x + 5) = 2(- 6 - x) - 2x", "(m - 2)/(3) + 1 = (2m)/(7)", "(5)/(2y - 6) = (10 - y)/(y^2 - 6y + 9)", "(2z)/(z + 3) = (3)/(z - 10) + 2",
      "(2)/(x + 2) = (- x)/(x^2 + 5x + 6)", "(2)/(x + 1) = 4 - (2x)/(x + 1)"],
    wrong: ["if a = b then"]
  },
  {
    id: "mathsisfun-quadratic", type: "pos", url: "https://www.mathsisfun.com/algebra/quadratic-equation.html",
    want: ["2x^2 + 5x + 3 = 0", "x^2 - 3x = 0", "5x - 3 = 0", "x^2 = 3x - 1", "2(w^2 - 2w) = 5", "z(z-1) = 3", "Solve 5x^2 + 6x + 1 = 0",
      "Solve 5x^2 + 2x + 1 = 0", "Solve x^2 - 4x + 6.25 = 0"],
    wrong: ["ax^2 + bx + c", "answer:", "b^2 - 4ac", "quadratic formula:", "use the quadratic formula:", "we see them on this graph", "move 5 to left", "move 3 to left"]
  },
  {
    id: "mathsisfun-solving", type: "pos", url: "https://www.mathsisfun.com/algebra/equations-solving.html",
    want: ["x - 2 = 4", "(x-3)(x-2) = 0", "Solve 3x-6 = 9", "Solve 5x = 2x + 9", "Solve 3(x + 2) = 15", "Solve √(x/2) = 3", "(2x)/(x - 3) + 3 = (6)/(x - 3)"],
    wrong: ["calculate 3^2 = 9", "and solve:\nx - 3 = 0", "2x + 3(x-3) = 6", "2x + 3(x-3) - 6 = 0", "start with:", "both sides", "sin(-θ)"]
  },
  {
    id: "mathsisfun-log", type: "pos", url: "https://www.mathsisfun.com/algebra/logarithms.html",
    want: ["log_5(625)", "log_2(64)", "log_10(100)", "log_3(81)", "log_10(26)", "log_8(0.125)", "log_5(0.008)"],
    wrong: ["log(1000) =", "ln(7.389)", "2s", "5s"]
  },
  {
    id: "mathsisfun-factoring", type: "pos", url: "https://www.mathsisfun.com/algebra/factoring.html",
    want: ["factor 2y + 6", "factor 3y^2 + 12y", "Factor 4x^2 - 9", "Example: w^4 - 16", "Example: 3u^4 - 24uv^3", "Example: z^3 - z^2 - 9z + 9"],
    wrong: ["common factor of", "2(y+3)", "3y(y + 4)", "(a+b)", "a^2", "a^3", "(2x+3)(2x-3)", "(w^2+ 4)", "3u(u", "(z-1)", "(z-3)"]
  },
  { id: "openstax-ca-linear", type: "pos", url: "https://openstax.org/books/college-algebra-2e/pages/2-2-linear-equations-in-one-variable", wantSel: "[data-type=problem]",
    right: ["0.537x - 2.19y = 100", "4,500x - 200y = 9,528", "(200 - 30y)/(x) = 70", "parallel to y = 2x + 5", "perpendicular to 3 y = x - 4", "the slope is undefined", "the slope equals zero", "the slope is (3)/(4)", "when solving the following equation", "if we are to solve 5x - 15", "rental car", "renting a car"],
    wantSkip: ["how do we recognize"],
    wrong: ["3x = 2x + x", "a common mistake", "x(x - 1)3", "how do we recognize", "given the slope and one point on a line", "m = (y_2", "5x + 2 = 3x - 6; 2x", "y - (- 3) = (7)/(3)(x - 0); y + 3"] },
  { id: "openstax-at-linear", type: "pos", url: "https://openstax.org/books/algebra-and-trigonometry-2e/pages/2-2-linear-equations-in-one-variable", wantSel: "[data-type=problem]",
    right: ["0.537x - 2.19y = 100", "4,500x - 200y = 9,528", "(200 - 30y)/(x) = 70", "parallel to y = 2x + 5", "perpendicular to 3 y = x - 4", "the slope is undefined", "the slope equals zero", "the slope is (3)/(4)", "when solving the following equation", "if we are to solve 5x - 15", "rental car", "renting a car"],
    wantSkip: ["how do we recognize"],
    wrong: ["3x = 2x + x", "a common mistake", "x(x - 1)3", "how do we recognize", "given the slope and one point on a line", "m = (y_2", "5x + 2 = 3x - 6; 2x", "y - (- 3) = (7)/(3)(x - 0); y + 3"] },
  { id: "openstax-ea-division", type: "pos", url: "https://openstax.org/books/elementary-algebra-2e/pages/2-2-solve-equations-using-the-division-and-multiplication-properties-of-equality", wantSel: "[data-type=problem]",
    // "Be Prepared" readiness check: arithmetic, not algebra
    wantSkip: ["simplify: −7"],
    right: ["translate and solve", "translate to an equation", "(3)/(8)y = - (1)/(4)", "(7)/(12) = - (3)/(4)p", "(11)/(18) = - (5)/(6)q", "- (5)/(18) = - (10)/(9)u", "- (7)/(20) = - (7)/(4)v", "consider the equation (x)/(4) = 3", "evaluate 9x + 2 when x = -3"],
    wrong: ["of the form x + a = b", "for any real numbers a,b"] },
  {
    id: "purplemath-linear", type: "pos", url: "https://www.purplemath.com/modules/solvelin.htm",
    want: ["Solve x + 6 = -3", "Solve x - 3 = -5", "Solve 4 = x - 3", "Solve 2 = -x"],
    wrong: ["in x + 3 = 5, this would be", "kind-of think"]
  },
  {
    id: "purplemath-quadratic", type: "pos", url: "https://www.purplemath.com/modules/solvquad.htm",
    want: ["Solve (x - 3)(x - 4) = 0", "Solve x^2 + 5x + 6 = 0", "Solve x^2 - 3 = 2x", "Solve (x + 2)(x + 3) = 12", "Solve x^2 + 5x = 0", "Solve x^2 - 4 = 0"],
    wrong: ["a very common mistake", "the first thing i", "now i can solve", "instead, i first", "x - 3 = 0 or", "x - 2 = 0, x + 2 = 0"]
  },
  {
    id: "khan-exercise", type: "pos", url: "https://www.khanacademy.org/math/get-ready-for-algebra-i/x127ac35e11aba30e:get-ready-for-equations-inequalities/x127ac35e11aba30e:two-step-equations/e/linear_equations_2",
    // the practice item is drawn at random on each load, so any "Solve for" find counts
    right: ["solve for"]
  },
  {
    id: "khan-video", type: "pos", url: "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:solve-equations-inequalities/x2f8bb11595b61c86:linear-equations-variables-both-sides/v/ex-2-multi-step-equation",
    want: ["7-10/x=2+15/x"],
    wrong: ["the fastest way", "can't we just", "did you mean", "distribute the x", "right-hand side by x", "7=2+25/x", "5=25/x", "7+10/x-10/x"]
  },
  { id: "libretexts-quadratic-ex", type: "pos", url: "https://math.libretexts.org/Bookshelves/Algebra/Algebra_and_Trigonometry_1e_(OpenStax)/02:_Equations_and_Inequalities/2.05:_Quadratic_Equations/2.5.00:_Quadratic_Equations_(Exercises)" },
  { id: "libretexts-sqrt-ex", type: "pos", url: "https://math.libretexts.org/Bookshelves/Algebra/Intermediate_Algebra_(OpenStax)/09:_Quadratic_Equations_and_Functions/902:_Solve_Quadratic_Equations_Using_the_Square_Root_Property/9.2E:_Exercises" },
  {
    id: "wiki-quadratic", type: "pos", url: "https://en.wikipedia.org/wiki/Quadratic_equation",
    want: ["2x^2 + 4x - 4 = 0", "x^2 - x - 1 = 0", "4.16130x^2 + 9.15933x - 11.4207 = 0"],
    wrong: ["x + 1 = ± √(3)", "x^2 + 2x - 2 = 0", "x^2 + 2x = 2", "(x + 1)^2 = 3", "log a =", "log √(c/a)", "ax^2", "b^2 - 4ac", "x^2 - x - 2 = 0, the points", "x^2 + 2hx"]
  },
  {
    id: "wiki-logarithm", type: "pos", url: "https://en.wikipedia.org/wiki/Logarithm",
    // a reference article: formulas and identities, no problems set for a reader
    want: [],
    wrong: ["defining equation", "log _10 (10 x)", "log_10 (10 x)", "c^d =", "x 2^m", "(c)/(d) =", "ln(z)", "ln(n", "Σ", "log_b b = 1", "f(x) = 1/x", "slope of the tangent"]
  },
  {
    id: "onemathcat-fractions", type: "pos", url: "https://www.onemathematicalcat.org/algebra_book/online_problems/solve_lin_fracs.htm",
    // the second "Solve:" item is drawn at random on each load
    want: ["(2)/(3)x + 6 = 1"], right: ["solve:"],
    wrong: ["3((2)/(3)x + 6) = 3(1)", "18(", "graph of y ="]
  },
  { id: "opentextbc-fractions", type: "pos", url: "https://opentextbc.ca/intermediatealgebraberg/chapter/fractional-linear-equations/" },
  // a blog lesson that solves its examples in first-person prose: no practice problems on it
  { id: "storyofmath-fractions", type: "pos", url: "https://www.storyofmathematics.com/how-to-solve-linear-equations-with-fractions/", want: [] },
  {
    id: "ncl-linear", type: "pos", url: "https://www.mas.ncl.ac.uk/ask/numeracy-maths-statistics/core-mathematics/pure-maths/algebra/solving-linear-equations-in-one-variable.html",
    want: ["Solve 4x - 1 = (1)/(3)(2 + 2x)", "Solve (3)/(3 - a) + (4)/(2a + 1) = 0"],
    // video captions that name the equation the video solves
    right: ["robin johnson solves"]
  },
  // ------------------------------------------------------------ negative
  // math beyond Algebra 2 (a spline derivation): should stay quiet too
  { id: "mathse-bspline", type: "neg", url: "https://math.stackexchange.com/questions/1349960/solving-a-quadratic-equation" },
  // this URL now lands on a study hub with no math on it
  { id: "varsity-hub", type: "neg", url: "https://www.varsitytutors.com/hotmath/hotmath_help/topics/solving-multi-step-linear-equations-with-fractions" },
  { id: "github-react", type: "neg", url: "https://github.com/facebook/react" },
  { id: "github-express", type: "neg", url: "https://github.com/expressjs/express" },
  { id: "so-sorted-array", type: "neg", url: "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array" },
  { id: "mdn-precedence", type: "neg", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_precedence" },
  { id: "mdn-math", type: "neg", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math" },
  { id: "python-intro", type: "neg", url: "https://docs.python.org/3/tutorial/introduction.html" },
  { id: "w3s-js-operators", type: "neg", url: "https://www.w3schools.com/js/js_operators.asp" },
  { id: "npr-text", type: "neg", url: "https://text.npr.org/" },
  { id: "bbc-news", type: "neg", url: "https://www.bbc.com/news" },
  { id: "hn-front", type: "neg", url: "https://news.ycombinator.com/" },
  { id: "recipe-cookies", type: "neg", url: "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/" },
  { id: "recipe-goodfood", type: "neg", url: "https://www.bbcgoodfood.com/recipes/chewy-chocolate-chip-cookies" },
  { id: "bref-boxscore", type: "neg", url: "https://www.basketball-reference.com/boxscores/202406170BOS.html" },
  { id: "wiki-philadelphia", type: "neg", url: "https://en.wikipedia.org/wiki/Philadelphia" },
  { id: "wiki-chem-equation", type: "neg", url: "https://en.wikipedia.org/wiki/Chemical_equation" },
  { id: "wiki-combustion", type: "neg", url: "https://en.wikipedia.org/wiki/Combustion" },
  { id: "wiki-ohms-law", type: "neg", url: "https://en.wikipedia.org/wiki/Ohm%27s_law" },
  { id: "amazon-product", type: "neg", url: "https://www.amazon.com/dp/B0BSHF7WHW" },
  { id: "allbirds-product", type: "neg", url: "https://www.allbirds.com/products/mens-tree-runners" },
  { id: "fed-rates", type: "neg", url: "https://www.federalreserve.gov/releases/h15/" },
  { id: "wiki-world-series", type: "neg", url: "https://en.wikipedia.org/wiki/2024_World_Series" },
  { id: "wiki-newton", type: "neg", url: "https://en.wikipedia.org/wiki/Newton%27s_laws_of_motion" },
  { id: "wiki-python", type: "neg", url: "https://en.wikipedia.org/wiki/Python_(programming_language)" },
  { id: "ms-excel-sum", type: "neg", url: "https://support.microsoft.com/en-us/office/sum-function-043e1c7d-7726-4e80-8f32-07b23e057f89" },
  { id: "nws-forecast", type: "neg", url: "https://forecast.weather.gov/MapClick.php?lat=39.68&lon=-75.75" }
];

const BLOCKED_RE = /just a moment|access denied|are you a robot|verify you are human|unusual traffic|attention required|enable javascript and cookies|request blocked|captcha|press (?:and|&) hold|403 forbidden|pardon our interruption|click the button below to continue|request could not be satisfied/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const squash = (s) => String(s).replace(/\s+/g, "").toLowerCase();

async function connect(port, chrome) {
  let pageInfo = null;
  for (let i = 0; i < 120 && !pageInfo; i++) {
    if (chrome.exitCode !== null) throw new Error("Chrome exited early");
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      pageInfo = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) || null;
    } catch { /* not up yet */ }
    if (!pageInfo) await sleep(150);
  }
  if (!pageInfo) throw new Error("DevTools endpoint did not come up");
  const ws = new WebSocket(pageInfo.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error("WebSocket error")); });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners.slice()) l(msg);
    }
  };
  const send = (method, params = {}, timeoutMs = 60000) => new Promise((resolve, reject) => {
    const id = nextId++;
    const t = setTimeout(() => { pending.delete(id); reject(new Error(method + " timed out")); }, timeoutMs);
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const waitFor = (method, timeoutMs) => new Promise((resolve) => {
    const l = (msg) => { if (msg.method === method) { done(msg.params); } };
    const t = setTimeout(() => done(null), timeoutMs);
    function done(v) { clearTimeout(t); const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); resolve(v); }
    listeners.push(l);
  });
  const on = (fn) => listeners.push(fn);
  return { ws, send, waitFor, on };
}

const SCAN = (wantSel, wantSkip) => `(() => {
  const D = globalThis.AlgeBridgeDetect;
  const times = [];
  let out = [];
  for (let r = 0; r < 6; r++) {
    const t0 = performance.now();
    out = D.findProblems(document, { visibleOnly: true });
    times.push(performance.now() - t0);
  }
  // warm code, empty text cache: what a scan costs when every block changed
  const fresh = [];
  for (let r = 0; r < 3; r++) {
    D._internal.clearCache();
    const t0 = performance.now();
    D.findProblems(document, { visibleOnly: true });
    fresh.push(performance.now() - t0);
  }
  const rest = times.slice(1).sort((a, b) => a - b);
  const round = (x) => Math.round(x * 10) / 10;
  // most of the page hidden from the accessibility tree (a modal sets
  // aria-hidden on everything behind it): nothing to judge
  let masked = 0;
  for (const el of document.querySelectorAll("body > [aria-hidden=true], body > * > [aria-hidden=true]")) masked += (el.innerText || "").length;
  const total = (document.body && document.body.innerText || "").length;
  const sel = ${JSON.stringify(wantSel || "")};
  const skip = ${JSON.stringify((wantSkip || []).map((x) => x.toLowerCase()))};
  const containers = sel ? [...document.querySelectorAll(sel)].filter((c) => c.querySelector("mjx-container, math, .katex, script[type^='math/tex']") &&
    !skip.some((k) => (c.innerText || "").toLowerCase().replace(/\\s+/g, " ").includes(k))) : [];
  const inside = (c, el) => c === el || c.contains(el) || (el.contains(c) && el.querySelectorAll(sel).length === 1);
  return {
    firstMs: round(times[0]),
    medianMs: round(rest[Math.floor(rest.length / 2)]),
    maxMs: round(Math.max.apply(null, times)),
    freshMs: round(fresh.sort((a, b) => a - b)[1]),
    elements: document.getElementsByTagName("*").length,
    textLength: total,
    masked: total > 0 && masked / total > 0.5,
    math: {
      mjx3: document.querySelectorAll("mjx-container").length,
      mj2: document.querySelectorAll("script[type^='math/tex'], .MathJax, .MathJax_CHTML, .MathJax_SVG").length,
      katex: document.querySelectorAll(".katex").length,
      mathml: document.querySelectorAll("math").length
    },
    containers: containers.length,
    containersCovered: containers.filter((c) => out.some((p) => p.element && inside(c, p.element))).length,
    containersMissed: containers.filter((c) => !out.some((p) => p.element && inside(c, p.element))).map((c) => (c.innerText || "").replace(/\\s+/g, " ").slice(0, 160)),
    found: out.map((p) => ({
      text: p.text, expr: p.expr, kind: p.kind, level: p.level, score: p.score,
      tag: p.element && p.element.tagName,
      inContainer: !!(sel && p.element && containers.some((c) => inside(c, p.element))),
      html: p.element ? p.element.outerHTML.slice(0, 2500) : ""
    }))
  };
})()`;

const SETTLE = `(() => {
  const n = document.querySelectorAll("mjx-container, .MathJax, .MathJax_CHTML, .katex, math").length;
  const pending = document.querySelectorAll(".MathJax_Preview:not(:empty), .MathJax_Processing").length;
  const mj3 = !!(window.MathJax && window.MathJax.startup && window.MathJax.startup.promise);
  return { n, pending, len: (document.body && document.body.innerText || "").length, ready: document.readyState, mj3 };
})()`;

async function loadPage(cdp, url) {
  const loaded = cdp.waitFor("Page.loadEventFired", 35000);
  let navErr = null;
  try {
    const r = await cdp.send("Page.navigate", { url }, 40000);
    if (r && r.errorText) navErr = r.errorText;
  } catch (e) { navErr = e.message; }
  if (navErr) return { error: navErr };
  const ev = await loaded;
  // let MathJax / KaTeX / client-side rendering finish: wait until the page
  // stops changing for 1.5 s (12 s at most)
  let last = null, stable = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    await sleep(500);
    let s;
    try { s = (await cdp.send("Runtime.evaluate", { expression: SETTLE, returnByValue: true }, 10000)).result.value; } catch { continue; }
    if (s.mj3) {
      try { await cdp.send("Runtime.evaluate", { expression: "Promise.race([MathJax.startup.promise, new Promise(r => setTimeout(r, 5000))]).then(() => 1)", awaitPromise: true, returnByValue: true }, 8000); } catch { /* ignore */ }
    }
    const key = s.n + ":" + s.len + ":" + s.pending;
    if (key === last && s.pending === 0) { stable++; if (stable >= 3) break; } else stable = 0;
    last = key;
  }
  return { loadFired: !!ev };
}

function judgePage(page, res) {
  const has = (list, t) => (list || []).some((s) => t.includes(squash(s)));
  const verdicts = res.found.map((p) => {
    const t = squash(p.text);
    if (page.type === "neg") return has(page.ok, t) ? "right" : "wrong";
    if (has(page.wrong, t)) return "wrong";
    if (p.inContainer || has(page.right, t) || has(page.want, t)) return "right";
    return "unjudged";
  });
  const want = page.want || [];
  const coveredWant = want.filter((w) => res.found.some((p) => squash(p.text).includes(squash(w))));
  const missed = want.filter((w) => !coveredWant.includes(w)).concat(res.containersMissed || []);
  return {
    verdicts,
    want: want.length + (res.containers || 0),
    covered: coveredWant.length + (res.containersCovered || 0),
    missed
  };
}

async function main() {
  const pages = ONLY.length ? PAGES.filter((p) => ONLY.includes(p.id)) : PAGES;
  const port = 9600 + Math.floor(Math.random() * 300);
  const profile = await mkdtemp(path.join(os.tmpdir(), "algebridge-realweb-"));
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-gpu",
    "--disable-sync", "--mute-audio", "--window-size=1280,900", "--lang=en-US", "about:blank"
  ], { stdio: ["ignore", "ignore", "ignore"] });
  const killAll = () => { try { chrome.kill("SIGKILL"); } catch { /* ignore */ } };
  process.on("SIGINT", () => { killAll(); process.exit(130); });
  const detectSource = await readFile(DETECT, "utf8");
  const results = [];
  try {
    const cdp = await connect(port, chrome);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Network.setBlockedURLs", { urls: ["*.mp4", "*.webm", "*.m3u8", "*doubleclick*", "*googlesyndication*", "*adservice*"] });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    cdp.on((msg) => {
      if (msg.method === "Page.javascriptDialogOpening") cdp.send("Page.handleJavaScriptDialog", { accept: false }).catch(() => {});
    });
    if (DUMP) await mkdir(DUMP, { recursive: true });

    for (const page of pages) {
      const rec = { id: page.id, type: page.type, url: page.url };
      try {
        const ld = await loadPage(cdp, page.url);
        if (ld.error) throw new Error("navigation: " + ld.error);
        const info = (await cdp.send("Runtime.evaluate", { expression: "({ title: document.title, url: location.href, head: (document.body && document.body.innerText || '').slice(0, 400), len: (document.body && document.body.innerText || '').length })", returnByValue: true })).result.value;
        rec.title = info.title;
        rec.finalUrl = info.url;
        if (BLOCKED_RE.test(info.title + " " + info.head) && info.len < 1500) rec.blocked = true;
        const inj = await cdp.send("Runtime.evaluate", { expression: detectSource + "\n;typeof AlgeBridgeDetect", returnByValue: true });
        if (!inj.result || inj.result.value !== "object") throw new Error("detect.js did not load");
        const r = await cdp.send("Runtime.evaluate", { expression: SCAN(page.wantSel, page.wantSkip), returnByValue: true }, 60000);
        if (r.exceptionDetails) throw new Error("scan threw: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
        Object.assign(rec, r.result.value);
        if (DUMP) {
          const txt = (await cdp.send("Runtime.evaluate", { expression: "document.body ? document.body.innerText : ''", returnByValue: true })).result.value;
          await writeFile(path.join(DUMP, page.id + ".txt"), txt);
        }
        rec.judge = judgePage(page, rec);
      } catch (e) {
        rec.error = String(e && e.message || e);
      }
      results.push(rec);
      printPage(rec);
    }
  } finally {
    killAll();
    await sleep(300);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  await writeFile(OUT, JSON.stringify(results, null, 2));
  summarize(results);
  console.log("details: " + OUT);
}

function printPage(rec) {
  const head = "[" + rec.type + "] " + rec.id;
  if (rec.error) { console.log(head + ": ERROR " + rec.error); return; }
  if (rec.blocked) { console.log(head + ": BLOCKED (" + rec.title + ")"); return; }
  const m = rec.math;
  console.log(head + ": " + rec.found.length + " found" + (rec.masked ? " (MASKED: most of the page is aria-hidden behind a dialog)" : "") + "; " +
    rec.elements + " elements, " + rec.textLength + " chars; math mjx3 " + m.mjx3 + " mj2 " + m.mj2 + " katex " + m.katex + " mathml " + m.mathml +
    "; scan first " + rec.firstMs + " ms, repeat " + rec.medianMs + " ms, uncached " + rec.freshMs + " ms");
  rec.found.forEach((p, i) => {
    const v = rec.judge ? rec.judge.verdicts[i] : "";
    console.log("   " + (v === "wrong" ? "x" : v === "right" ? "+" : "?") + " " + JSON.stringify(p.text.length > 160 ? p.text.slice(0, 160) + "..." : p.text) +
      " [" + p.kind + ", L" + p.level + ", " + p.score + ", <" + p.tag + ">]");
  });
  if (rec.judge && rec.judge.want) console.log("   coverage " + rec.judge.covered + "/" + rec.judge.want);
  if (rec.judge && rec.judge.missed.length) console.log("   missed: " + rec.judge.missed.map((s) => JSON.stringify(s)).join("\n           "));
}

function summarize(results) {
  const ok = results.filter((r) => !r.error && !r.blocked && !r.masked);
  const neg = ok.filter((r) => r.type === "neg");
  const pos = ok.filter((r) => r.type === "pos");
  const sum = (list, f) => list.reduce((a, r) => a + f(r), 0);
  const count = (r, v) => r.judge.verdicts.filter((x) => x === v).length;
  const negFound = sum(neg, (r) => r.found.length);
  const negWrong = sum(neg, (r) => count(r, "wrong"));
  const negClean = neg.filter((r) => count(r, "wrong") === 0).length;
  const posFound = sum(pos, (r) => r.found.length);
  const posRight = sum(pos, (r) => count(r, "right"));
  const posWrong = sum(pos, (r) => count(r, "wrong"));
  const posUnj = sum(pos, (r) => count(r, "unjudged"));
  const want = sum(pos, (r) => r.judge.want);
  const covered = sum(pos, (r) => r.judge.covered);
  const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + "%" : "n/a");
  const slowFirst = ok.slice().sort((a, b) => b.firstMs - a.firstMs)[0];
  const slowFresh = ok.slice().sort((a, b) => b.freshMs - a.freshMs)[0];
  const biggest = ok.slice().sort((a, b) => b.elements - a.elements)[0];
  console.log("\n==== summary ====");
  console.log("pages loaded " + ok.length + "/" + results.length + " (blocked " + results.filter((r) => r.blocked).length +
    ", masked " + results.filter((r) => r.masked).length + ", errors " + results.filter((r) => r.error).length + ")");
  console.log("negative pages: " + neg.length + ", clean " + negClean + "/" + neg.length + ", finds " + negFound + ", false positives " + negWrong);
  console.log("positive pages: " + pos.length + ", finds " + posFound + ": right " + posRight + ", wrong " + posWrong + ", unjudged " + posUnj +
    "; precision " + pct(posRight, posRight + posWrong) + "; coverage of listed problems " + covered + "/" + want + " (" + pct(covered, want) + ")");
  console.log("all pages: " + (posWrong + negWrong) + " wrong finds out of " + (posFound + negFound) + " (precision " + pct(posRight, posRight + posWrong + negWrong) + ")");
  if (biggest) console.log("biggest page: " + biggest.id + " " + biggest.elements + " elements: first scan " + biggest.firstMs + " ms, repeat " + biggest.medianMs + " ms, uncached " + biggest.freshMs + " ms (budget " + BUDGET_MS + " ms)");
  if (slowFirst) console.log("slowest first scan: " + slowFirst.id + " " + slowFirst.firstMs + " ms; slowest uncached scan: " + slowFresh.id + " " + slowFresh.freshMs + " ms");
  const over = ok.filter((r) => r.freshMs > BUDGET_MS || r.medianMs > BUDGET_MS);
  console.log("pages over the " + BUDGET_MS + " ms budget (repeat or uncached): " + (over.length ? over.map((r) => r.id).join(", ") : "none"));
}

main().catch((e) => { console.error(e); process.exit(1); });
