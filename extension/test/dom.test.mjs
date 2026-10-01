// DOM-level tests for AlgeBridgeDetect.findProblems in real headless Google Chrome.
// Run: node extension/test/dom.test.mjs
// Spawns Chrome with a throwaway profile, talks CDP over WebSocket (Node's global
// WebSocket and fetch), loads each fixture from file://, injects detect.js and
// checks what findProblems(document) returns. Chrome is always killed at the end.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "dom-fixtures");
const DETECT = path.join(HERE, "..", "src", "detect.js");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// expected problems per fixture, in document order. text: exact match, has: substring checks
const CASES = [
  {
    file: "katex.html",
    expect: [
      { text: "Solve by factoring: x^2 - 5x + 6 = 0", kind: "quadratic", level: 1 },
      { text: "Find the vertex of the parabola.\ny = x^2 - 4x + 3", kind: "quadratic", level: 1 },
      { text: "Solve (3)/(x) + 1 = 4 and check your answer.", kind: "rational", level: 2 }
    ]
  },
  {
    file: "mathjax3.html",
    expect: [
      { text: "Solve for x: 2x + 3 = 11", kind: "linear-equation", level: 1 },
      { text: "Simplify \u221A(50x^3).", kind: "radical", level: 1 },
      { text: "Solve the equation.\n(x + 1)/(x - 2) = 3", kind: "rational", level: 2 }
    ]
  },
  {
    file: "mathjax2.html",
    expect: [
      { text: "Solve 2x - 7 = 9", kind: "linear-equation", level: 1 },
      { text: "Factor completely: x^2 + 7x + 12", kind: "factoring", level: 1 },
      { text: "Solve for x.\nlog_3(x) = 4", kind: "logarithmic", level: 2 }
    ]
  },
  {
    file: "mathml.html",
    expect: [
      { text: "Solve \u221A(x + 7) = x - 5 and check for extraneous solutions.", kind: "radical", level: 2 },
      { text: "Evaluate log_2 32.", kind: "logarithmic", level: 2 },
      { text: "Simplify (x^2 - 9)/(x + 3)", kind: "rational", level: 2 },
      // an index-3 root must read as a cube root, not 3 times a square root
      { text: "Solve \u221B(x - 2) = 3", kind: "radical", level: 2 },
      { text: "Simplify root(5, 32x^5)", kind: "radical", level: 1 }
    ]
  },
  {
    file: "google-forms.html",
    expect: [
      { text: "Solve for x: 4x - 9 = 3x + 2", kind: "linear-equation", level: 1, role: "heading" },
      { text: "Factor x^2 + 5x + 6", kind: "factoring", level: 1, role: "heading" },
      { text: "Which expression is equivalent to 3(x + 4) - 2x?", kind: "expression", level: 1, role: "heading" }
    ]
  },
  {
    file: "canvas-quiz.html",
    expect: [
      { text: "Solve the inequality.\n-2x + 7 < 15", kind: "linear-inequality", level: 1, tag: "P" },
      { text: "Factor completely: x^2 - 16", kind: "factoring", level: 1, tag: "P" },
      { text: "If f(x) = 2x^2 + 1, what is f(3)?", kind: "function", level: 1, tag: "P" }
    ]
  },
  {
    file: "worksheet.html",
    expect: [
      { has: "3x + 4 = 19", kind: "linear-equation", tag: "LI" },
      { has: "5(n - 2) = 3n + 6", kind: "linear-equation", tag: "LI" },
      { has: "x/4 - 3 = 2", kind: "linear-equation", tag: "LI" },
      { has: "x^2 - 9 = 0", kind: "quadratic", tag: "LI" },
      { has: "2x^2 + 5x - 3 = 0", kind: "quadratic", tag: "LI" },
      { has: "-7y + 12 = 3y - 8", kind: "linear-equation", tag: "LI" },
      { has: "|x - 3| = 10", kind: "absolute-value", tag: "LI" },
      { has: "\u221A(x + 1) = 4", kind: "radical", tag: "LI" },
      { has: "log_2(x) = 6", kind: "logarithmic", tag: "LI" },
      { has: "4^x = 64", kind: "exponential", tag: "LI" }
    ],
    allHave: "Solve each equation."
  },
  { file: "blog.html", expect: [] },
  {
    // shapes copied from real pages where the detector used to be wrong (see realweb.mjs)
    file: "realweb.html",
    expect: [
      { text: "Solve each of the following equations and check your answer.\n4x - 7(2 - x) = 3x + 2", kind: "linear-equation", id: "lamar-1" },
      { text: "Solve each of the following equations and check your answer.\nlog(6x) - log(4 - x) = log(3)", kind: "logarithmic", level: 2, id: "lamar-2" },
      { text: "Example 1 Solve each of the following equations.\n3(x + 5) = 2(-6 - x) - 2x", kind: "linear-equation", id: "notes-a" },
      { text: "Example: solve for x: (2x)/(x-3) + 3 = (6)/(x-3)", kind: "rational", level: 2, id: "mif-fraction" },
      { text: "Example: Solve 3(x + 2) = 15", kind: "linear-equation", id: "mif-solve" },
      { text: "2(w^2 - 2w) = 5", kind: "quadratic", id: "mif-disguise" },
      { has: "log_5(625)", kind: "logarithmic", level: 2, id: "mif-log" },
      { text: "The golden ratio is found as the positive solution of the quadratic equation x^2 - x - 1 = 0.", kind: "quadratic", id: "wiki-golden" },
      { text: "Solve x^2 + 5x + 6 = 0, and check.", kind: "quadratic", id: "pm-1" },
      { text: "In the following exercises, translate to an equation and solve.\nu divided by 7 is equal to -49.", kind: "linear-equation", id: "os-146" },
      { text: "In the following exercises, translate to an equation and solve.\nThe quotient of b and -6 is 18.", kind: "linear-equation", id: "os-150" },
      { text: "7-10/x=2+15/x", kind: "rational", level: 2, id: "khan-problem" }
    ]
  },
  {
    file: "hidden.html",
    expect: [
      { text: "Solve 5x - 2 = 13", kind: "linear-equation", id: "visible" },
      { text: "Solve 6x = 42", kind: "linear-equation", id: "with-answer" }
    ],
    // with visibleOnly: false the CSS hidden ones come back, the hidden attribute,
    // aria-hidden, template, noscript, form fields and contenteditable never do
    hiddenToo: {
      has: ["7x + 1 = 22", "2x + 9 = 1", "4x + 4 = 20", "3x + 3 = 9", "8x - 8 = 40", "11x = 33"],
      never: ["x^2 - 64", "9x + 2 = 29", "6x + 6 = 18", "10x = 70", "9x = 27", "2x + 1 = 5", "x + 11 = 20"]
    }
  },
  {
    file: "misc.html",
    expect: [
      { text: "Solve for x: (x)/(2) + 5 = 11", kind: "linear-equation" },
      { text: "Solve x^2 + 3x - 10 = 0 by factoring.", kind: "quadratic" },
      { text: "Simplify (2x^3)^2 * x^4.", kind: "expression" }
    ]
  }
];

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else {
    failed++;
    console.log("FAIL " + name + (detail ? "\n     " + detail : ""));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const port = 9200 + Math.floor(Math.random() * 400);
  const profile = await mkdtemp(path.join(os.tmpdir(), "algebridge-detect-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-sync",
    "--mute-audio",
    "--window-size=1280,900",
    "about:blank"
  ], { stdio: ["ignore", "ignore", "ignore"] });
  let chromeExited = false;
  chrome.on("exit", () => { chromeExited = true; });
  const killTimer = setTimeout(() => { console.log("FAIL timeout after 90 s"); chrome.kill("SIGKILL"); process.exit(1); }, 90000);

  let ws = null;
  try {
    // wait for the DevTools endpoint
    let pageInfo = null;
    for (let i = 0; i < 100 && !pageInfo; i++) {
      if (chromeExited) throw new Error("Chrome exited early; is it installed at " + CHROME + "?");
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        pageInfo = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) || null;
      } catch { /* not up yet */ }
      if (!pageInfo) await sleep(150);
    }
    if (!pageInfo) throw new Error("DevTools endpoint did not come up on port " + port);

    ws = new WebSocket(pageInfo.webSocketDebuggerUrl);
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
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const waitFor = (method) => new Promise((resolve) => {
      const l = (msg) => { if (msg.method === method) { listeners.splice(listeners.indexOf(l), 1); resolve(msg.params); } };
      listeners.push(l);
    });
    const evaluate = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("page error: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
      return r.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const detectSource = await readFile(DETECT, "utf8");

    const RUN = (opts) => `(() => {
      const out = AlgeBridgeDetect.findProblems(document, ${JSON.stringify(opts)});
      return out.map((p) => ({
        id: p.id, text: p.text, expr: p.expr, kind: p.kind, level: p.level, score: p.score,
        tag: p.element && p.element.tagName, elId: p.element && p.element.id,
        role: p.element && p.element.getAttribute("role"),
        isElement: p.element instanceof Element
      }));
    })()`;

    for (const c of CASES) {
      const url = pathToFileURL(path.join(FIXTURES, c.file)).href;
      const loaded = waitFor("Page.loadEventFired");
      await send("Page.navigate", { url });
      await loaded;
      await evaluate(detectSource + "\n;void 0");
      const ready = await evaluate("typeof AlgeBridgeDetect === 'object' && typeof AlgeBridgeDetect.findProblems === 'function'");
      check(c.file + ": detect.js injected", ready === true);
      const t0 = Date.now();
      const found = await evaluate(RUN({}));
      const ms = Date.now() - t0;
      const summary = found.map((p) => "    " + JSON.stringify(p.text) + " [" + p.kind + ", L" + p.level + ", " + p.score + ", <" + p.tag + ">]").join("\n");
      console.log(c.file + ": " + found.length + " found in " + ms + " ms" + (found.length ? "\n" + summary : ""));
      check(c.file + ": count", found.length === c.expect.length, "expected " + c.expect.length + ", got " + found.length);
      const ids = new Set();
      found.forEach((p) => {
        check(c.file + ": id is 8 hex", /^[0-9a-f]{8}$/.test(p.id), p.id);
        check(c.file + ": element is an Element", p.isElement === true);
        check(c.file + ": text <= 600", p.text.length <= 600);
        check(c.file + ": unique id", !ids.has(p.id), p.id);
        ids.add(p.id);
      });
      c.expect.forEach((e, i) => {
        const p = found[i];
        const label = c.file + " #" + (i + 1);
        if (!p) { check(label + ": present", false, "missing " + JSON.stringify(e.text || e.has)); return; }
        if (e.text) check(label + ": text", p.text === e.text, "expected " + JSON.stringify(e.text) + ", got " + JSON.stringify(p.text));
        if (e.has) check(label + ": contains", p.text.includes(e.has), JSON.stringify(e.has) + " not in " + JSON.stringify(p.text));
        if (e.kind) check(label + ": kind", p.kind === e.kind, "expected " + e.kind + ", got " + p.kind);
        if (e.level) check(label + ": level", p.level === e.level, "expected " + e.level + ", got " + p.level);
        if (e.tag) check(label + ": element tag", p.tag === e.tag, "expected " + e.tag + ", got " + p.tag);
        if (e.role) check(label + ": element role", p.role === e.role, "expected " + e.role + ", got " + p.role);
        if (e.id) check(label + ": element id", p.elId === e.id, "expected #" + e.id + ", got #" + p.elId);
      });
      if (c.allHave) found.forEach((p, i) => check(c.file + " #" + (i + 1) + ": carries the directions", p.text.includes(c.allHave), JSON.stringify(p.text)));
      if (c.file === "hidden.html") {
        check("hidden.html: answer text stays out", found.every((p) => !/Answer/.test(p.text)));
        const all = await evaluate(RUN({ visibleOnly: false }));
        const joined = all.map((p) => p.text).join(" | ");
        for (const h of c.hiddenToo.has) check("hidden.html visibleOnly:false finds " + h, joined.includes(h), joined);
        for (const h of c.hiddenToo.never) check("hidden.html never finds " + h, !joined.includes(h), joined);
      }
      // the KaTeX visual copy and the MathJax glyph spans must not add duplicates
      if (c.file === "katex.html") {
        check(c.file + ": no doubled math", found.every((p) => {
          const t = p.text.replace(/\s/g, "");
          return !/x2\u2212?5x/.test(t) && (t.match(/x\^2-5x\+6=0/g) || []).length <= 1;
        }));
      }
      if (c.file === "mathjax2.html") {
        check(c.file + ": no doubled math", found.every((p) => {
          const t = p.text.replace(/\s/g, "");
          return !/2x\u22127=9/.test(t) && (t.match(/2x-7=9/g) || []).length <= 1 && !/x2\+7x/.test(t);
        }));
      }
      // repeated scans give the same ids
      const again = await evaluate(RUN({}));
      check(c.file + ": stable ids", JSON.stringify(again.map((p) => p.id)) === JSON.stringify(found.map((p) => p.id)));
    }

    // a long noisy page: thousands of prose paragraphs with numbers, 40 real problems
    {
      const loaded = waitFor("Page.loadEventFired");
      await send("Page.navigate", { url: "about:blank" });
      await loaded;
      await evaluate(detectSource + "\n;void 0");
      const big = await evaluate(`(() => {
        const noise = [
          "Posted on 2026-09-30 at 10:45 AM. 24 comments, 1,204 views.",
          "Tickets are $12.50 each or 3 x $10 = $30 for the family pack.",
          "Call (555) 123-4567 or visit www.example.com/help?id=42 for support.",
          "Version 2.3.1 fixes the 1920x1080 layout bug on Chrome 154.",
          "Final score: Eagles 24-17. Next game is Friday at 7:30 p.m.",
          "Plan A = the safe option, Plan B = the fast option.",
          "Our algebra club meets in Room 214 every Tuesday after school.",
          "Mix 2 cups of flour with 1/2 c sugar and bake at 350 degrees for 25 min."
        ];
        const parts = ["<main><h1>Long page</h1>"];
        for (let i = 0; i < 3000; i++) {
          parts.push("<p>" + noise[i % noise.length] + " <span>Item " + i + "</span> <code>x = " + i + ";</code></p>");
          if (i % 75 === 0) parts.push("<ol start='" + i + "'><li>Solve " + (i % 9 + 2) + "x + " + (i % 7 + 1) + " = " + (i % 50 + 20) + "</li></ol>");
        }
        parts.push("</main>");
        document.body.innerHTML = parts.join("");
        const t0 = performance.now();
        const out = AlgeBridgeDetect.findProblems(document);
        const ms = performance.now() - t0;
        // later scans of the same page (content.js rescans after every change)
        const again = [];
        for (let r = 0; r < 5; r++) {
          const t1 = performance.now();
          AlgeBridgeDetect.findProblems(document);
          again.push(performance.now() - t1);
        }
        again.sort((a, b) => a - b);
        return { ms: Math.round(ms), repeatMs: Math.round(again[2]), count: out.length, nodes: document.getElementsByTagName("*").length };
      })()`);
      console.log("long page: " + big.nodes + " elements, " + big.count + " found in " + big.ms + " ms, repeat scans " + big.repeatMs + " ms");
      check("long page finds the 40 problems and nothing else", big.count === 40, "got " + big.count);
      check("long page scans in under 2 s", big.ms < 2000, big.ms + " ms");
      check("long page repeat scan fits the 60 ms page budget", big.repeatMs < 60, big.repeatMs + " ms");
    }

    // maxNodes limits the walk
    {
      const url = pathToFileURL(path.join(FIXTURES, "worksheet.html")).href;
      const loaded = waitFor("Page.loadEventFired");
      await send("Page.navigate", { url });
      await loaded;
      await evaluate(detectSource + "\n;void 0");
      const few = await evaluate(RUN({ maxNodes: 12 }));
      check("maxNodes caps the walk", few.length < 10, "got " + few.length);
      const scoped = await evaluate("AlgeBridgeDetect.findProblems(document.querySelector('ol.problems li:nth-child(4)')).map(p => p.kind)");
      check("findProblems(element) scans only that subtree", JSON.stringify(scoped) === JSON.stringify(["quadratic"]), JSON.stringify(scoped));
    }
  } finally {
    clearTimeout(killTimer);
    try { if (ws) ws.close(); } catch { /* ignore */ }
    if (!chromeExited) {
      chrome.kill("SIGTERM");
      for (let i = 0; i < 40 && !chromeExited; i++) await sleep(50);
      if (!chromeExited) chrome.kill("SIGKILL");
    }
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

main()
  .catch((e) => { failed++; console.log("FAIL " + (e && e.stack ? e.stack : e)); })
  .finally(() => {
    console.log(passed + " passed, " + failed + " failed");
    process.exit(failed > 0 ? 1 : 0);
  });
