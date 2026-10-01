#!/usr/bin/env node
/*
 * UI harness for the AlgeBridge Hints content script.
 *
 *   node extension/test/ui-harness.mjs
 *
 * Starts real headless Google Chrome, opens each fixture page over file://
 * (and, for the cross-origin frames flow, over http://127.0.0.1 with frames
 * from http://localhost, served by this script), and runs a fake chrome.* shim, src/detect.js, src/mascot.js and
 * src/content.js in an isolated world (the same kind of world Chrome gives
 * content scripts), in every frame. Then it drives the page with real mouse
 * and keyboard input over the DevTools protocol, asserts what the UI shows
 * (the Knowt style card at the top right, the hint view it grows into, the
 * round button it shrinks to), and saves screenshots to extension/test/shots/.
 *
 *   node extension/test/ui-harness.mjs katex phone    (run only some flows)
 *
 * Exit code 0 when every check passes.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, "..");
const FIX = path.join(HERE, "fixtures");
const SHOTS = path.join(HERE, "shots");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WORLD = "algebridge-ext";
const VIEW = { width: 1280, height: 800 };
const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* The fake extension runtime (runs in the isolated world)             */
/* ------------------------------------------------------------------ */

function shimSource(css) {
  const EXT_BASE = pathToFileURL(EXT).href + "/";
  return `(() => {
  const CSS = ${JSON.stringify(css)};
  const EXT_BASE = ${JSON.stringify(EXT_BASE)};
  const H = (globalThis.__harness = {
    log: [],
    listeners: [],
    delay: 250,
    failNext: null,
    settings: { enabled: true, mode: "popup", pausedSites: [], apiBase: "https://learn.algebridge.org" },
  });

  const LINEAR = [
    "Start by getting the x terms together. What could you do to both sides so x only shows up on one side?",
    "Now look at the plain number sitting next to the x term. Which operation undoes it, and what happens when you do that to both sides?",
    "One move left: x is being multiplied or divided by a number. What undoes that, and what do you get when you apply it to both sides?",
  ];
  const QUAD = [
    "This is a quadratic, so get everything on one side with 0 on the other. Is it already in the form ax^2 + bx + c = 0?",
    "Look for two numbers that multiply to c and add to b. Which pair of factors of c works here?",
    "Write it as two binomials and use the zero product rule. What value makes each factor equal 0?",
  ];
  const FIX_ANSWERS = ["x=15", "15"];

  function hint(p) {
    if (H.failNext) { const f = H.failNext; H.failNext = null; return f; }
    const quad = /\\^\\s*2|\\u00b2/.test(p.problem);
    const steps = quad ? QUAD : LINEAR;
    const kind = quad ? "quadratic" : "linear-equation";
    const sealed = "sealed-" + p.problem.length + "-" + (p.hints ? p.hints.length : 0);
    const base = { sealed, steps: steps.length, kind, level: 1, source: "ai" };
    if (p.action === "first" || p.action === "next") {
      const i = p.action === "first" ? 0 : p.hints.length;
      if (i >= steps.length) {
        return { ok: true, data: { ...base, reply: "You have a hint for every step. Work it through, then use Check my answer.", step: -1, done: true } };
      }
      return { ok: true, data: { ...base, reply: steps[i], step: i, done: i === steps.length - 1 } };
    }
    if (p.action === "concept") {
      return { ok: true, data: { ...base, step: -1, done: false, reply: "This problem turns on inverse operations. Whatever was done to x, undo it in reverse order and keep both sides balanced. What was the last thing done to x?" } };
    }
    if (p.action === "ask") {
      return { ok: true, data: { ...base, step: -1, done: false, reply: "Good question. The fraction bar means x is being divided by 3. Which operation undoes dividing by 3?" } };
    }
    if (p.action === "check") {
      const a = String(p.answer || "").replace(/\\s+/g, "").toLowerCase();
      const good = FIX_ANSWERS.includes(a);
      return { ok: true, data: { ...base, step: -1, done: false, verdict: good ? "correct" : "incorrect", reply: good ? "That checks out. Nice work keeping both sides balanced." : "Not quite. It looks like the 2 was added instead of subtracted. Plug it back into the original problem to see which side is off." } };
    }
    return { ok: false, error: "bad-request", message: "Something in that request did not work." };
  }

  function reply(msg) {
    switch (msg.type) {
      case "settings:get": return { ...H.settings, pausedSites: H.settings.pausedSites.slice() };
      case "settings:set": Object.assign(H.settings, msg.patch || {}); return { ...H.settings };
      case "problems:count": return null;
      case "stats:bump": return null;
      case "hint": return hint(msg.payload);
      default: return undefined;
    }
  }

  const runtime = {
    id: "harnessextensionidaaaaaaaaaaaaaa",
    lastError: undefined,
    getURL: (p) => EXT_BASE + String(p).replace(/^\\//, ""),
    sendMessage(msg, cb) {
      H.log.push(JSON.parse(JSON.stringify(msg)));
      const wait = msg && msg.type === "hint" ? H.delay : 0;
      const out = new Promise((res) => setTimeout(() => res(reply(msg)), wait));
      if (typeof cb === "function") { out.then((r) => cb(r)); return undefined; }
      return out;
    },
    onMessage: {
      addListener(fn) { H.listeners.push(fn); },
      removeListener(fn) { H.listeners = H.listeners.filter((f) => f !== fn); },
      hasListener(fn) { return H.listeners.includes(fn); },
    },
  };
  Object.defineProperty(globalThis, "chrome", { value: { runtime }, configurable: true, writable: true });

  // Messages from the background, the way chrome.tabs.sendMessage delivers them.
  H.dispatch = (msg) => new Promise((resolve) => {
    let done = false;
    const respond = (r) => { if (!done) { done = true; resolve(r === undefined ? null : r); } };
    let keep = false;
    for (const fn of H.listeners) { if (fn(msg, { id: runtime.id }, respond) === true) keep = true; }
    setTimeout(() => respond(keep ? "no-response" : undefined), keep ? 3000 : 50);
  });

  // In the real extension, fetch(chrome-extension://.../src/ui.css) works because
  // ui.css is web accessible. file:// fetch does not, so serve it from here.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts) => {
    if (String(url).startsWith(EXT_BASE + "src/ui.css")) {
      return Promise.resolve(new Response(CSS, { status: 200, headers: { "content-type": "text/css" } }));
    }
    return realFetch(url, opts);
  };

  // Test helpers for reaching into our closed shadow root.
  const T = (globalThis.__t = {
    root() { return globalThis.__algebridgeHints ? globalThis.__algebridgeHints.root : null; },
    q(sel) { const r = T.root(); return r ? r.querySelector(sel) : null; },
    qa(sel) { const r = T.root(); return r ? [...r.querySelectorAll(sel)] : []; },
    shown(el) {
      if (!el || !el.isConnected) return false;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.95) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    },
    isShown(sel) { return T.shown(T.q(sel)); },
    rect(el) { if (typeof el === "string") el = T.q(el); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; },
    byLabel(label, sel) { return T.qa(sel || "button, input, textarea").find((el) => (el.getAttribute("aria-label") || "") === label || el.textContent.trim() === label) || null; },
    at(label, sel) { const el = T.byLabel(label, sel); if (!el || !T.shown(el)) return null; el.scrollIntoView({ block: "nearest" }); return T.rect(el); },
    text(sel) { const el = T.q(sel); return el ? el.textContent.replace(/\\s+/g, " ").trim() : null; },
    active() {
      const r = T.root();
      const a = r && r.activeElement;
      if (!a) return null;
      return { tag: a.tagName, cls: typeof a.className === "string" ? a.className : "", label: a.getAttribute("aria-label") || "", text: a.textContent.trim().slice(0, 40) };
    },
    hintsLog() { return H.log.filter((m) => m.type === "hint").map((m) => m.payload); },
  });
})();`;
}

/* ------------------------------------------------------------------ */
/* Chrome + CDP                                                        */
/* ------------------------------------------------------------------ */

async function freePort() {
  for (let i = 0; i < 40; i++) {
    const port = 9600 + Math.floor(Math.random() * 301);
    const ok = await new Promise((resolve) => {
      const srv = net.createServer();
      srv.once("error", () => resolve(false));
      srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
    });
    if (ok) return port;
  }
  throw new Error("no free port in 9600-9900");
}

async function launchChrome() {
  await access(CHROME).catch(() => {
    throw new Error(`Chrome not found at ${CHROME}. Set CHROME_PATH.`);
  });
  const port = await freePort();
  const dir = await mkdtemp(path.join(tmpdir(), "algebridge-ui-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-component-update",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--hide-scrollbars",
      "--mute-audio",
      `--window-size=${VIEW.width},${VIEW.height}`,
      "--allow-file-access-from-files",
      // Keep cross-site frames in the page's process, so the content script
      // world reaches them the same way it reaches same-site frames.
      "--disable-site-isolation-trials",
      "--disable-features=IsolateOrigins,site-per-process",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr = (stderr + d).slice(-4000)));
  let wsUrl = null;
  // A busy machine can take well over 10 s to bring Chrome up.
  for (let i = 0; i < 300 && !wsUrl; i++) {
    await sleep(100);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
  }
  if (!wsUrl) {
    proc.kill("SIGKILL");
    throw new Error("Chrome did not start: " + stderr);
  }
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  return {
    port,
    dir,
    proc,
    wsUrl,
    version: version.Browser,
    async close() {
      try {
        proc.kill("SIGTERM");
      } catch {
        /* gone */
      }
      await sleep(300);
      try {
        proc.kill("SIGKILL");
      } catch {
        /* gone */
      }
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

class CDP {
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = (e) => reject(new Error("websocket error " + (e.message || "")));
    });
    return new CDP(ws);
  }
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.handlers = new Set();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString());
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers) h(msg);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("CDP timeout: " + method));
      }, 30000);
      this.pending.set(id, { resolve, reject, method, timer });
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(fn) {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

class Page {
  static async open(cdp, scripts, opts = {}) {
    // opts.viewport: { width, height, mobile } for phone-sized runs.
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(cdp, targetId, sessionId);
    await page.init(scripts, opts);
    return page;
  }
  constructor(cdp, targetId, sessionId) {
    this.cdp = cdp;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.contexts = new Map(); // frameId -> { iso, main }
    this.errors = [];
    this.consoleErrors = [];
    this.mainFrame = null;
    this.off = cdp.on((m) => {
      if (m.sessionId === this.sessionId) this.onEvent(m);
    });
  }
  send(method, params) {
    return this.cdp.send(method, params, this.sessionId);
  }
  onEvent(m) {
    const p = m.params || {};
    if (m.method === "Runtime.executionContextCreated") {
      const c = p.context;
      const fid = c.auxData && c.auxData.frameId;
      if (!fid) return;
      const rec = this.contexts.get(fid) || {};
      if (c.name === WORLD) rec.iso = c.id;
      else if (c.auxData.isDefault) rec.main = c.id;
      this.contexts.set(fid, rec);
    } else if (m.method === "Runtime.executionContextDestroyed") {
      for (const rec of this.contexts.values()) {
        if (rec.iso === p.executionContextId) rec.iso = null;
        if (rec.main === p.executionContextId) rec.main = null;
      }
    } else if (m.method === "Runtime.executionContextsCleared") {
      this.contexts.clear();
    } else if (m.method === "Runtime.exceptionThrown") {
      const d = p.exceptionDetails || {};
      this.errors.push(`${(d.exception && d.exception.description) || d.text} @ ${d.url || ""}:${d.lineNumber}`);
    } else if (m.method === "Runtime.consoleAPICalled" && p.type === "error") {
      this.consoleErrors.push((p.args || []).map((a) => a.value || a.description || "").join(" "));
    } else if (m.method === "Page.loadEventFired" && this._onLoad) {
      const f = this._onLoad;
      this._onLoad = null;
      f();
    }
  }
  async init(scripts, opts) {
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    const vp = opts.viewport || VIEW;
    this.view = { width: vp.width, height: vp.height };
    await this.send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 2, mobile: !!vp.mobile });
    await this.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    if (opts.reducedMotion) {
      await this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    }
    for (const source of scripts) {
      await this.send("Page.addScriptToEvaluateOnNewDocument", { source, worldName: WORLD });
    }
    await this.send("Page.bringToFront");
  }
  async goto(file, settings) {
    const url = /^https?:/.test(file) ? file : pathToFileURL(path.join(FIX, file)).href;
    if (settings) {
      // Applied before the content script asks for settings.
      await this.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `globalThis.__harness && Object.assign(globalThis.__harness.settings, ${JSON.stringify(settings)});`,
        worldName: WORLD,
      });
    }
    const loaded = new Promise((r) => (this._onLoad = r));
    const res = await this.send("Page.navigate", { url });
    if (res.errorText) throw new Error(`navigate ${file}: ${res.errorText}`);
    this.mainFrame = res.frameId;
    await Promise.race([loaded, sleep(10000)]);
    await this.waitForContext(this.mainFrame);
  }
  async waitForContext(frameId, timeout = 5000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const rec = this.contexts.get(frameId);
      if (rec && rec.iso) return rec.iso;
      await sleep(50);
    }
    throw new Error("isolated world never appeared in frame " + frameId);
  }
  async evalIn(frameId, expression) {
    const ctx = await this.waitForContext(frameId);
    const r = await this.send("Runtime.evaluate", { expression, contextId: ctx, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error("eval failed: " + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.value;
  }
  ext(expression, frameId) {
    return this.evalIn(frameId || this.mainFrame, expression);
  }
  // The page's own world (what page scripts see), for playing a hostile page.
  async inPage(expression, frameId) {
    const fid = frameId || this.mainFrame;
    const t0 = Date.now();
    let rec = this.contexts.get(fid);
    while ((!rec || !rec.main) && Date.now() - t0 < 5000) {
      await sleep(50);
      rec = this.contexts.get(fid);
    }
    if (!rec || !rec.main) throw new Error("page world never appeared in frame " + fid);
    const r = await this.send("Runtime.evaluate", { expression, contextId: rec.main, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error("page eval failed: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
    return r.result.value;
  }
  async waitFor(body, opts = {}) {
    const timeout = opts.timeout || 6000;
    const t0 = Date.now();
    let last;
    while (Date.now() - t0 < timeout) {
      try {
        last = await this.ext(`(() => { ${body} })()`, opts.frame);
        if (last) return last;
      } catch (e) {
        last = e.message;
      }
      await sleep(80);
    }
    throw new Error(`timed out (${timeout} ms) waiting for: ${body.slice(0, 160)}  last=${JSON.stringify(last)}`);
  }
  async move(x, y, buttons = 0) {
    await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons, button: buttons ? "left" : "none" });
  }
  async click(pt) {
    if (!pt) throw new Error("click target not found or hidden");
    const { cx: x, cy: y } = pt;
    await this.move(x, y);
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    await sleep(60);
  }
  async drag(from, to) {
    await this.move(from.x, from.y);
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", buttons: 1, clickCount: 1 });
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      await this.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, 1);
    }
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", buttons: 0, clickCount: 1 });
    await sleep(60);
  }
  async type(text) {
    await this.send("Input.insertText", { text });
  }
  async key(name) {
    const keys = {
      Enter: { code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
      Escape: { code: "Escape", windowsVirtualKeyCode: 27 },
      Tab: { code: "Tab", windowsVirtualKeyCode: 9 },
      ArrowLeft: { code: "ArrowLeft", windowsVirtualKeyCode: 37 },
      ArrowRight: { code: "ArrowRight", windowsVirtualKeyCode: 39 },
    };
    const k = keys[name];
    // No nativeVirtualKeyCode: on macOS those are a different table.
    await this.send("Input.dispatchKeyEvent", { type: k.text ? "keyDown" : "rawKeyDown", key: name, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode, text: k.text, unmodifiedText: k.text });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode });
    await sleep(60);
  }
  async selectAllInFocused() {
    await this.ext(`(() => { const r = __t.root(); const a = r && r.activeElement; if (a && a.select) a.select(); return true; })()`);
  }
  async shot(name) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(SHOTS, name), Buffer.from(r.data, "base64"));
    shots.push(name);
  }
  // A close-up of one part of the page, zoomed (on top of the 2x device scale).
  async shotClip(name, box, zoom = 2) {
    const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.w, height: box.h, scale: zoom };
    const r = await this.send("Page.captureScreenshot", { format: "png", clip });
    await writeFile(path.join(SHOTS, name), Buffer.from(r.data, "base64"));
    shots.push(name);
  }
  async frameTree() {
    const { frameTree } = await this.send("Page.getFrameTree");
    return frameTree;
  }
  async close() {
    this.off();
    await this.cdp.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Tiny test runner                                                    */
/* ------------------------------------------------------------------ */

const results = [];
const shots = [];
let checks = 0;

function check(cond, msg, detail) {
  checks++;
  if (!cond) {
    const e = new Error(msg + (detail !== undefined ? `  got: ${JSON.stringify(detail)}` : ""));
    e.isCheck = true;
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Static checks on the files this harness covers                      */
/* ------------------------------------------------------------------ */

async function staticChecks() {
  const files = ["src/content.js", "src/mascot.js", "src/ui.css", "test/ui-harness.mjs"];
  const fixtures = ["worksheet", "katex", "mathjax", "forms", "spa", "negatives", "dark", "frames", "frames-cross", "tiny"].map((f) => `test/fixtures/${f}.html`);
  const problems = [];
  for (const rel of [...files, ...fixtures]) {
    const text = await readFile(path.join(EXT, rel), "utf8");
    if (text.includes("\u2014")) problems.push(`${rel}: em dash`);
    if (/\p{Extended_Pictographic}/u.test(text.replace(/[©®™]/g, ""))) problems.push(`${rel}: emoji`);
  }
  for (const rel of ["src/content.js", "src/mascot.js"]) {
    const code = await readFile(path.join(EXT, rel), "utf8");
    for (const bad of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function"]) {
      if (code.includes(bad)) problems.push(`${rel} uses ${bad}`);
    }
  }
  const manifest = JSON.parse(await readFile(path.join(EXT, "manifest.json"), "utf8"));
  const order = (manifest.content_scripts && manifest.content_scripts[0] && manifest.content_scripts[0].js) || [];
  if (order.join(",") !== "src/detect.js,src/mascot.js,src/content.js") problems.push(`manifest content script order is ${order.join(",")}`);
  return problems;
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

const STATE = "globalThis.__algebridgeHints.state()";
const visibleShown = (sel) => `return __t.isShown(${JSON.stringify(sel)});`;
const VIEWPORTS = { phone: { width: 390, height: 844, mobile: true } };

const SHEET = ".ab-sheet";
const PREVIEWS = ".ab-preview-well .ab-pcard";
const PAGE_ROWS = ".ab-page-well .ab-pcard";
const HINTS = ".ab-thread .ab-hint";

async function waitCard(page, frame) {
  await page.waitFor(`return globalThis.__algebridgeHints && __t.isShown(".ab-sheet") && __t.isShown(".ab-found");`, { timeout: 8000, frame });
  await sleep(300); // let the slide-in and Archie's pop finish
}

async function waitHints(page, n, frame) {
  await page.waitFor(`return __t.qa(${JSON.stringify(HINTS)}).length === ${n} && !__t.isShown(".ab-status");`, { timeout: 3000, frame });
  await sleep(160); // buttons finish their color change from the busy state
}

// Everything inside the sheet stays inside it (no text or button pokes out),
// and the sheet itself stays inside the viewport with the given margin.
async function fitCheck(page, label, margin) {
  const r = await page.ext(`(() => {
    const sheet = __t.q(".ab-sheet");
    const s = sheet.getBoundingClientRect();
    const out = [];
    for (const el of sheet.querySelectorAll("*")) {
      if (el.closest("[hidden]") || el.closest(".ab-sr")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      // Scrolled content may sit below the fold; only sideways overflow counts.
      if (b.left < s.left - 0.5 || b.right > s.right + 0.5) out.push((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) + " " + Math.round(b.left) + ".." + Math.round(b.right));
    }
    const wide = [...sheet.querySelectorAll(".ab-tabs, .ab-actions, .ab-hero-text, .ab-problem-main, .ab-foot")]
      .filter((el) => !el.closest("[hidden]") && el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.className + " " + el.scrollWidth + ">" + el.clientWidth);
    return { sheet: { x: s.left, y: s.top, w: s.width, h: s.height, right: s.right, bottom: s.bottom }, vw: document.documentElement.clientWidth, vh: innerHeight, out: out.slice(0, 6), wide, pageScroll: document.documentElement.scrollWidth };
  })()`);
  check(r.out.length === 0, `${label}: nothing pokes out of the card sideways`, r.out);
  check(r.wide.length === 0, `${label}: tabs, buttons and text rows fit without hidden overflow`, r.wide);
  check(r.sheet.x >= margin - 0.5 && r.sheet.right <= r.vw - margin + 0.5, `${label}: card sits within ${margin} px of each side`, r.sheet);
  check(r.sheet.y >= 7.5 && r.sheet.bottom <= r.vh - 7.5, `${label}: card fits the viewport height`, { sheet: r.sheet, vh: r.vh });
  check(r.pageScroll <= r.vw, `${label}: no sideways page scroll`, { scroll: r.pageScroll, vw: r.vw });
  return r.sheet;
}

const FRAME_KEYS = ["source", "type", "req", "nonce", "count", "area"];

// Every frame records the AlgeBridge messages it receives (in the content
// script's world, which sees the same message events as the page).
const RECORDER = `(() => {
  globalThis.__frameMsgs = [];
  addEventListener("message", (e) => {
    const d = e.data;
    if (d && typeof d === "object" && d.source === "algebridge-hints") __frameMsgs.push({ data: JSON.parse(JSON.stringify(d)), origin: e.origin });
  });
  return true;
})()`;

// A hostile page script in the small frame: on each "who" it forges a
// candidate with a wrong nonce and one with a stale request id.
const FORGER = `(() => {
  window.__forged = 0;
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "algebridge-hints" || d.type !== "who" || e.source !== parent) return;
    window.__forged++;
    parent.postMessage({ source: "algebridge-hints", type: "candidate", req: d.req, nonce: "0".repeat(32), count: 99, area: 1e7 }, "*");
    parent.postMessage({ source: "algebridge-hints", type: "candidate", req: "w999999.000000000000", nonce: d.nonce, count: 99, area: 1e7 }, "*");
  });
  return true;
})()`;

// A hostile page script in each child frame: on each "who" from the top it
// passes a copy to every sibling it can reach, as if it were the top.
// (window.frames leaves out frames inside shadow roots, so what each frame
// can reach is recorded.)
const SIBLING_FORGER = `(() => {
  window.__reach = 0;
  for (let i = 0; i < parent.length; i++) if (parent.frames[i] !== window) window.__reach++;
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.source !== "algebridge-hints" || d.type !== "who" || e.source !== parent) return;
    for (let i = 0; i < parent.length; i++) if (parent.frames[i] !== window) parent.frames[i].postMessage({ source: "algebridge-hints", type: "who", req: d.req, nonce: d.nonce }, "*");
  });
  return true;
})()`;

async function framesFlow(page, url, label, cross) {
  await page.goto(url);
  let kids = [];
  for (let i = 0; i < 60; i++) {
    const tree = await page.frameTree();
    kids = (tree.childFrames || []).map((c) => c.frame);
    if (kids.some((f) => /spa\.html$/.test(f.url)) && kids.some((f) => /tiny\.html$/.test(f.url))) break;
    await sleep(100);
  }
  const big = kids.find((f) => /spa\.html$/.test(f.url));
  const tiny = kids.find((f) => /tiny\.html$/.test(f.url));
  check(big && tiny, `${label}: both iframes loaded`, kids.map((k) => k.url));
  const topOrigin = cross ? new URL(url).origin : null;
  const childOrigin = cross ? new URL(big.url).origin : null;
  if (cross) check(topOrigin !== childOrigin, `${label}: the quiz frame is on another origin`, { topOrigin, childOrigin });
  await waitCard(page, big.id);
  const tinyState = await page.ext(STATE, tiny.id);
  check(!tinyState.running && tinyState.cardState === "hidden", `${label}: a 260x150 frame shows nothing`, tinyState);
  const tinyHost = await page.ext(`document.querySelectorAll("algebridge-hints").length`, tiny.id);
  check(tinyHost === 0, `${label}: no host element in the small frame`, tinyHost);
  const topState = await page.ext(STATE);
  check(topState.problems.length === 0, `${label}: top page has no problems`, topState.problems);

  for (const f of [page.mainFrame, big.id, tiny.id]) await page.ext(RECORDER, f);
  await page.inPage(FORGER, tiny.id);
  await page.inPage(SIBLING_FORGER, tiny.id);
  await page.inPage(SIBLING_FORGER, big.id);
  // The top page's own scripts post a well-formed candidate to the top window.
  await page.inPage(`window.postMessage({ source: "algebridge-hints", type: "candidate", req: "w1.abcdefabcdef", nonce: "a".repeat(32), count: 99, area: 1e7 }, "*"); true`);
  await sleep(150);

  // Toolbar popup or shortcut: the top frame hands the hint view to the frame with the problem.
  const resp = await page.ext(`__harness.dispatch({ type: "open-panel" })`);
  check(resp && resp.ok, `${label}: top frame answers open-panel`, resp);
  await page.waitFor(`return __t.isShown(".ab-sheet") && ${STATE}.view === "panel";`, { timeout: 3000, frame: big.id });
  await sleep(200);
  const topPanel = await page.ext(`__t.isShown(".ab-sheet")`);
  check(!topPanel, `${label}: only one hint view opens`, topPanel);
  const text = await page.ext(`__t.text(".ab-problem-math")`, big.id);
  check(/7x - 4 = 3x \+ 12/.test(text), `${label}: the embedded problem is in the hint view`, text);

  // The hardening, from the outside.
  const forged = await page.inPage(`window.__forged`, tiny.id);
  check(forged === 1, `${label}: the small frame's page got one "who" to play with`, forged);
  const topLog = (await page.ext(STATE)).frames;
  const bigLog = (await page.ext(STATE, big.id)).frames;
  const tinyLog = (await page.ext(STATE, tiny.id)).frames;
  check(topLog.accepted === 1, `${label}: the top accepts only the real candidate`, topLog);
  check(topLog.badNonce === 1 && topLog.stale === 1 && topLog.badSource === 1, `${label}: forged candidates are dropped (wrong nonce, stale request, not one of the page's iframes)`, topLog);
  const reach = { fromTiny: await page.inPage(`window.__reach`, tiny.id), fromBig: await page.inPage(`window.__reach`, big.id) };
  check(reach.fromBig >= 1 && tinyLog.badSource === reach.fromBig && bigLog.badSource === reach.fromTiny, `${label}: a "who" passed on by a sibling frame is ignored`, { reach, big: bigLog, tiny: tinyLog });
  check(bigLog.accepted === 2 && tinyLog.accepted === 0, `${label}: the quiz frame answers the top once and opens once`, { big: bigLog, tiny: tinyLog });
  if (cross) check(reach.fromTiny === 0, `${label}: the quiz frame inside a shadow root is not in window.frames, and the top still finds it`, reach);

  const msgs = [];
  for (const [at, f] of [["top", page.mainFrame], ["big", big.id], ["tiny", tiny.id]]) {
    for (const m of await page.ext(`globalThis.__frameMsgs`, f)) msgs.push({ at, ...m });
  }
  const tokenish = (k, v) => k === "source" || k === "type" || /^[0-9a-f]{32}$/.test(v) || /^w\d+\.[0-9a-f]{12}$/.test(v);
  const bad = msgs.filter(
    (m) =>
      Object.keys(m.data).some((k) => !FRAME_KEYS.includes(k)) ||
      Object.entries(m.data).some(([k, v]) => (typeof v === "string" ? !tokenish(k, v) : typeof v !== "number")),
  );
  check(msgs.length >= 6 && bad.length === 0, `${label}: frame messages carry only ids, the nonce and numbers, never page text`, bad.length ? bad : msgs.length);
  const whos = msgs.filter((m) => m.data.type === "who");
  const nonce = whos.length ? whos[0].data.nonce : null;
  check(/^[0-9a-f]{32}$/.test(nonce || "") && whos.every((m) => m.data.nonce === nonce), `${label}: every "who" carries the top's nonce`, whos.map((m) => m.data.nonce));
  const real = msgs.filter((m) => m.at === "top" && m.data.type === "candidate" && m.data.count < 99);
  check(real.length === 1 && real[0].data.nonce === nonce && real[0].data.count === 1, `${label}: the quiz frame echoes the nonce and sends only a count`, real);
  if (cross) check(real[0].origin === childOrigin, `${label}: the candidate arrives from the quiz frame's origin`, real[0].origin);
  const openHere = msgs.filter((m) => m.at === "big" && m.data.type === "open-here");
  check(openHere.length === 1 && openHere[0].data.nonce === nonce, `${label}: the go-ahead carries the nonce too`, openHere);
  await sleep(260); // the card's contents finish fading in
  await page.shot(cross ? "frames-cross.png" : "frames.png");
}

let SERVER = null;

// Serves the fixtures over http for the cross-origin frames flow.
async function startServer() {
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://x");
      const name = path.basename(decodeURIComponent(u.pathname)) || "index.html";
      const body = await readFile(path.join(FIX, name));
      res.writeHead(200, { "content-type": types[path.extname(name)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: server.address().port };
}

const tests = {
  async worksheet(page) {
    await page.goto("worksheet.html");
    await waitCard(page);
    const st = await page.ext(STATE);
    check(st.problems.length >= 8, "worksheet: at least 8 of 10 problems detected", st.problems.map((p) => p.text));
    const visible = st.problems.filter((p) => p.visible);
    check(visible.length >= 3, "worksheet: several problems on screen at the top", visible.length);
    check(st.view === "card" && st.tab === "hints", "worksheet: the card opens on the Hints tab", { view: st.view, tab: st.tab });
    const title = await page.ext(`__t.text(".ab-hero-title")`);
    check(title === `Archie found ${st.problems.length} algebra problems`, "worksheet: Archie counts the problems on the page", title);
    const art = await page.ext(`!!__t.q(".ab-hero-art svg.ab-mascot.ab-pose-idle .ab-m-confetti")`);
    check(art, "worksheet: Archie waves from the hero with confetti", art);
    const previews = await page.ext(`__t.qa(${JSON.stringify(PREVIEWS)}).length`);
    check(previews === Math.min(3, visible.length), "worksheet: at most 3 preview cards", previews);
    const more = await page.ext(`__t.text(".ab-more")`);
    check(more === `+${st.problems.length - 3} more`, "worksheet: the rest wait behind +N more", more);
    const metas = await page.ext(`__t.qa(".ab-preview-well .ab-pcard-meta").map((m) => m.textContent)`);
    check(metas.length === previews && metas.every((m) => / · Algebra [12]$/.test(m)), "worksheet: each preview has a kind and level chip", metas);
    const sheet = await page.ext(`__t.rect(".ab-sheet")`);
    check(Math.round(sheet.y) === 16 && Math.round(VIEW.width - (sheet.x + sheet.w)) === 16 && Math.round(sheet.w) === 360, "worksheet: card pinned 16 px from the top right, 360 px wide", sheet);
    const tabs = await page.ext(`__t.qa('[role="tab"]').map((t) => ({ text: t.textContent, sel: t.getAttribute("aria-selected"), label: t.getAttribute("aria-label") }))`);
    check(tabs.length === 3 && tabs[0].text === "Hints" && tabs[0].sel === "true" && tabs[1].text === `On this page${st.problems.length}` && tabs[2].text === "The idea", "worksheet: pill tabs Hints, On this page (count), The idea", tabs);
    check(tabs[1].label === `On this page, ${st.problems.length} problems`, "worksheet: the count tab reads well aloud", tabs[1].label);
    const heroLines = await page.ext(`(() => { const t = __t.q(".ab-hero-title"); return t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight); })()`);
    check(heroLines <= 2.05, "worksheet: hero title takes at most two lines", heroLines);
    await fitCheck(page, "worksheet", 16);

    // Markers sit beside visible problems only.
    await sleep(200);
    const marks = await page.ext(`(() => {
      const ms = __t.qa(".ab-marker").filter(__t.shown).map((m) => __t.rect(m));
      const els = AlgeBridgeDetect.findProblems(document, { visibleOnly: true }).map((p) => p.element.getBoundingClientRect());
      return { ms, els: els.map((r) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })), faces: __t.qa(".ab-marker").filter(__t.shown).filter((m) => m.querySelector("svg.ab-face")).length };
    })()`);
    check(marks.ms.length >= 3, "worksheet: markers shown", marks.ms.length);
    check(marks.faces === marks.ms.length, "worksheet: each marker shows Archie's face", marks.faces);
    for (const m of marks.ms) {
      const near = marks.els.some((r) => m.cy >= r.top - 6 && m.cy <= r.bottom + 6 && m.x >= r.left);
      check(near, "worksheet: each marker sits beside a problem", m);
      check(m.x + m.w <= VIEW.width && m.y >= -22 && Math.round(m.w) === 22, "worksheet: 22 px marker inside the viewport", m);
    }

    // Hovering a preview card outlines its problem on the page.
    const first = await page.ext(`__t.rect(__t.qa(${JSON.stringify(PREVIEWS)})[0])`);
    await page.move(first.cx, first.cy);
    await page.waitFor(visibleShown(".ab-outline"), { timeout: 2000 });
    const outline = await page.ext(`__t.rect(".ab-outline")`);
    const firstEl = await page.ext(`(() => { const ps = AlgeBridgeDetect.findProblems(document, { visibleOnly: true }); ps.sort((a, b) => a.element.compareDocumentPosition(b.element) & 4 ? -1 : 1); const r = ps[0].element.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
    check(Math.abs(outline.x - (firstEl.x - 4)) <= 2 && Math.abs(outline.y - (firstEl.y - 4)) <= 2, "worksheet: outline wraps the hovered problem", { outline, firstEl });
    const pageUntouched = await page.ext(`[...document.querySelectorAll("li")].every((li) => !li.getAttribute("style") && !li.className)`);
    check(pageUntouched, "worksheet: page elements were never restyled");
    await page.move(first.cx - 200, first.cy + 300);
    await sleep(200);
    await page.shot("worksheet-card.png");

    // problems:count and stats
    const log = await page.ext(`__harness.log`);
    const counts = log.filter((m) => m.type === "problems:count").map((m) => m.count);
    check(counts.length && counts[counts.length - 1] === st.problems.length, "worksheet: problems:count reports the page total", counts);
    const seenBumps = log.filter((m) => m.type === "stats:bump" && m.key === "problemsSeen").length;
    check(seenBumps === visible.length, "worksheet: one problemsSeen bump per problem on screen", { seenBumps, visible: visible.length });

    // +N more opens On this page with every problem, exponents drawn as superscripts.
    await page.click(await page.ext(`__t.rect(".ab-more")`));
    await page.waitFor(`return __t.isShown(".ab-page-well") && __t.qa(${JSON.stringify(PAGE_ROWS)}).length > 3;`, { timeout: 2000 });
    const list = await page.ext(`({ rows: __t.qa(${JSON.stringify(PAGE_ROWS)}).length, nums: __t.qa(".ab-page-well .ab-pcard-num").map((n) => n.textContent).join(","), sups: __t.qa(".ab-page-well sup").length, tab: ${STATE}.tab, sel: __t.q("#ab-tab-page").getAttribute("aria-selected") })`);
    check(list.rows === st.problems.length && list.tab === "page" && list.sel === "true", "worksheet: On this page lists every problem", list);
    check(list.nums.startsWith("1,2,3,4"), "worksheet: the list is numbered in page order", list.nums);
    check(list.sups >= 4, "worksheet: exponents in the list render as superscripts", list.sups);
    await fitCheck(page, "worksheet list", 16);
    await page.shot("worksheet-on-this-page.png");
    // Keyboard: arrows move between tabs, Enter opens one.
    await page.ext(`__t.q("#ab-tab-page").focus()`);
    await page.key("ArrowLeft");
    const onTab = await page.ext(`__t.active()`);
    check(onTab && onTab.text === "Hints", "worksheet: arrow keys move between tabs", onTab);
    await page.key("Enter");
    await page.waitFor(visibleShown(".ab-found"), { timeout: 2000 });

    // Not now hides the card and the round button; markers stay.
    await page.move(5, 5);
    await page.click(await page.ext(`__t.at("Not now, hide this for this page")`));
    await sleep(150);
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)), "worksheet: Not now hides the card");
    check(!(await page.ext(`__t.isShown(".ab-fab")`)), "worksheet: Not now hides the round button too");
    check((await page.ext(`__t.qa(".ab-marker").filter(__t.shown).length`)) >= 3, "worksheet: markers stay after Not now");
    await page.shot("worksheet-markers.png");

    // Scrolling moves markers with their problems, and no card comes back.
    const before = await page.ext(`__t.qa(".ab-marker").filter(__t.shown).map((m) => __t.rect(m).y)`);
    await page.ext(`window.scrollBy(0, 420)`);
    await sleep(500);
    const after = await page.ext(`(() => {
      const ms = __t.qa(".ab-marker").filter(__t.shown).map((m) => __t.rect(m));
      const els = AlgeBridgeDetect.findProblems(document, { visibleOnly: true }).map((p) => p.element.getBoundingClientRect());
      return { ms, ok: ms.every((m) => els.some((r) => m.cy >= r.top - 6 && m.cy <= r.bottom + 6)) };
    })()`);
    check(after.ok, "worksheet: markers follow their problems after scrolling", { before, after: after.ms });
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)), "worksheet: no card again after Not now");
    const st2 = await page.ext(STATE);
    check(st2.lastScanMs < 60, "worksheet: scan fits the 60 ms budget", st2.lastScanMs);
    page.notes.push(`worksheet scan ${st2.lastScanMs.toFixed(1)} ms over ${st2.scanCount} scans`);

    // open-panel from the background with selected text (context menu path).
    const resp = await page.ext(`__harness.dispatch({ type: "open-panel", text: "Solve x^2 - 5x + 6 = 0" })`);
    check(resp && resp.ok === true, "worksheet: open-panel answers ok", resp);
    await page.waitFor(`return __t.isShown(".ab-sheet") && ${STATE}.view === "panel";`);
    await waitHints(page, 1);
    const sup = await page.ext(`({ problem: __t.qa(".ab-problem-math sup").map((s) => s.textContent), hint: __t.qa(".ab-thread sup").map((s) => s.textContent) })`);
    check(sup.problem.includes("2"), "worksheet: x^2 in the problem renders as a superscript", sup);
    check(sup.hint.includes("2"), "worksheet: x^2 in a hint renders as a superscript", sup);
    const chip = await page.ext(`__t.text(".ab-problem .ab-chip")`);
    check(chip === "Quadratic · Algebra 1", "worksheet: chip shows kind and level", chip);
    await page.shot("hints-superscript.png");
    await page.key("Escape");
    await sleep(120);
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)), "worksheet: Escape closes the hint view");
  },

  async katex(page) {
    await page.goto("katex.html");
    await waitCard(page);
    const st = await page.ext(STATE);
    const vis = st.problems.filter((p) => p.visible);
    check(vis.length === 1, "katex: exactly one problem on screen (the related one is far below)", st.problems);
    check(st.problems.length >= 2, "katex: the problem below the fold is detected too", st.problems.map((p) => p.text));
    const hero = await page.ext(`({ title: __t.text(".ab-hero-title"), sub: __t.text(".ab-hero-sub"), go: __t.text(".ab-go") })`);
    check(hero.title === `Archie found ${st.problems.length} algebra problems`, "katex: title counts the page", hero);
    const preview = await page.ext(`__t.qa(${JSON.stringify(PREVIEWS)}).map((b) => b.textContent)`);
    check(/x/.test(preview[0]) && /7/.test(preview[0]) && /Hint$/.test(preview[0]), "katex: the problem on screen comes first, with a Hint pill", preview);
    await page.shot("card-katex.png");

    // Get a hint: the same card grows into the hint view.
    const cardBox = await page.ext(`__t.rect(".ab-sheet")`);
    await page.click(await page.ext(`__t.at("Get a hint for the first problem", ".ab-go")`));
    await page.waitFor(`return ${STATE}.view === "panel" && __t.isShown(".ab-problem");`);
    const focus = await page.ext(`__t.active()`);
    check(focus && focus.tag === "H2", "katex: focus moves to the problem heading", focus);
    await waitHints(page, 1);
    const panelBox = await page.ext(`__t.rect(".ab-sheet")`);
    check(Math.abs(panelBox.y - cardBox.y) < 1 && Math.abs(panelBox.x + panelBox.w - (cardBox.x + cardBox.w)) < 1, "katex: the card grows in place, no jump", { cardBox, panelBox });
    let payloads = await page.ext(`__t.hintsLog()`);
    check(payloads.length === 1 && payloads[0].action === "first" && payloads[0].hints.length === 0, "katex: first request is action first", payloads);
    check(!payloads[0].sealed, "katex: first request has no sealed blob", payloads[0]);
    check(payloads[0].problem.length > 0 && payloads[0].problem.length <= 600, "katex: problem text sent", payloads[0].problem);

    // Next hint twice.
    await page.click(await page.ext(`__t.at("Next hint")`));
    await waitHints(page, 2);
    const kept = await page.ext(`__t.active()`);
    check(kept && kept.label === "Next hint", "katex: focus stays on Next hint after the hint comes in", kept);
    await page.click(await page.ext(`__t.at("Next hint")`));
    await waitHints(page, 3);
    const movedOn = await page.ext(`__t.active()`);
    check(movedOn && movedOn.label === "Check my answer", "katex: with every step covered, focus moves on to Check my answer", movedOn);
    payloads = await page.ext(`__t.hintsLog()`);
    check(payloads[1].action === "next" && payloads[1].hints.length === 1, "katex: second request is next with one hint", payloads[1]);
    check(payloads[2].action === "next" && payloads[2].hints.length === 2, "katex: third request is next with two hints", payloads[2]);
    check(payloads[1].sealed === "sealed-" + payloads[0].problem.length + "-0", "katex: sealed blob from the last reply is sent back", payloads[1].sealed);
    const nextBtn = await page.ext(`(() => { const b = __t.q(".ab-next"); return { disabled: b.disabled, label: b.getAttribute("aria-label") }; })()`);
    check(nextBtn.disabled && nextBtn.label === "All steps covered", "katex: done disables Next hint", nextBtn);
    const lead = await page.ext(`({ check: __t.q(".ab-check").className, next: __t.q(".ab-next").className })`);
    check(/ab-primary/.test(lead.check) && /ab-quiet/.test(lead.next) && !/ab-primary/.test(lead.next), "katex: with every step covered, Check my answer leads", lead);
    const steps = await page.ext(`({ labels: __t.qa(".ab-thread .ab-step").map((n) => n.textContent), latest: __t.qa(".ab-thread .ab-latest").length, last: __t.qa(${JSON.stringify(HINTS)}).at(-1).classList.contains("ab-latest"), avatars: __t.qa(".ab-thread .ab-avatar").filter((a) => getComputedStyle(a).visibility === "visible").length })`);
    check(steps.labels.join(",") === "Step 1,Step 2,Step 3", "katex: hints are chat bubbles labeled Step 1, 2, 3", steps);
    check(steps.latest === 1 && steps.last, "katex: only the newest step is highlighted", steps);
    check(steps.avatars === 1, "katex: Archie's face sits by the last bubble of the run", steps);
    const foot = await page.ext(`__t.text(".ab-foot-text")`);
    check(foot === "Hints only. The answer stays yours to find.", "katex: footer line", foot);
    const pose = await page.ext(`__t.q(".ab-problem-art svg").getAttribute("class")`);
    check(/ab-pose-idle/.test(pose), "katex: Archie is back to idle once the hint is in", pose);
    await fitCheck(page, "katex hints", 16);
    await page.shot("hints-3.png");

    // Check my answer: wrong, then right.
    await page.click(await page.ext(`__t.at("Check my answer")`));
    const inCheck = await page.ext(`__t.active()`);
    check(inCheck && inCheck.label === "Your answer", "katex: check input gets focus", inCheck);
    await page.type("x = 12");
    await page.key("Enter");
    await page.waitFor(`const v = __t.qa(".ab-thread .ab-verdict").at(-1); return v && __t.shown(v) && v.classList.contains("ab-warn") && !__t.isShown(".ab-status");`, { timeout: 3000 });
    const amber = await page.ext(`(() => { const v = __t.qa(".ab-thread .ab-verdict").at(-1); const mine = __t.qa(".ab-thread .ab-you").at(-1); return { text: v.textContent, color: getComputedStyle(v).color, mine: mine.textContent, mineFirst: mine.closest("li") === v.closest("li").previousElementSibling }; })()`);
    check(/Plug it back/.test(amber.text) && amber.color === "rgb(146, 64, 14)", "katex: incorrect check is an amber line with the slip", amber);
    check(amber.mine === "My answerx = 12" && amber.mineFirst, "katex: the checked answer shows as the student's bubble, right before the verdict", amber);
    const lastSeen = await page.ext(`(() => { const sc = __t.q(".ab-thread-well .ab-scroll").getBoundingClientRect(); const v = __t.qa(".ab-thread .ab-msg").at(-1).getBoundingClientRect(); return { sc: [sc.top, sc.bottom], v: [v.top, v.bottom] }; })()`);
    check(lastSeen.v[1] <= lastSeen.sc[1] + 1 && lastSeen.v[0] >= lastSeen.sc[0] - 1, "katex: the verdict scrolls into view", lastSeen);
    await fitCheck(page, "katex incorrect", 16);
    await page.shot("check-incorrect.png");
    await page.selectAllInFocused();
    await page.type("x = 15");
    await page.click(await page.ext(`__t.at("Check this answer")`));
    await page.waitFor(`const v = __t.qa(".ab-thread .ab-verdict").at(-1); return v && __t.shown(v) && v.classList.contains("ab-good");`, { timeout: 3000 });
    const green = await page.ext(`(() => { const v = __t.qa(".ab-thread .ab-verdict").at(-1); return { text: v.textContent, color: getComputedStyle(v).color, weight: getComputedStyle(v.querySelector(".ab-verdict-text")).fontWeight, party: !!v.closest("li").querySelector(".ab-party svg.ab-pose-party .ab-m-confetti"), row: __t.q(".ab-problem-art svg").getAttribute("class"), verdicts: __t.qa(".ab-thread .ab-verdict").length }; })()`);
    check(/^That checks out/.test(green.text) && green.color === "rgb(22, 101, 52)" && Number(green.weight) >= 700, "katex: correct check is a bold green line", green);
    check(green.party && /ab-pose-party/.test(green.row), "katex: Archie celebrates with confetti", green);
    check(green.verdicts === 2, "katex: both checks stay in the chat as history", green.verdicts);
    payloads = await page.ext(`__t.hintsLog()`);
    check(payloads.at(-1).action === "check" && payloads.at(-1).answer === "x = 15", "katex: check sends the answer", payloads.at(-1));
    await sleep(950); // confetti settles
    await fitCheck(page, "katex correct", 16);
    await page.shot("check-correct.png");

    // The idea tab asks for the concept once and shows it.
    await page.click(await page.ext(`__t.rect("#ab-tab-idea")`));
    await page.waitFor(`return __t.isShown(".ab-idea") && /inverse operations/.test(__t.text(".ab-idea-text"));`, { timeout: 3000 });
    payloads = await page.ext(`__t.hintsLog()`);
    check(payloads.at(-1).action === "concept", "katex: The idea asks for the concept", payloads.at(-1));
    const ideaState = await page.ext(`({ tab: ${STATE}.tab, label: __t.text(".ab-idea-label"), dock: __t.isShown(".ab-dock") })`);
    check(ideaState.tab === "idea" && ideaState.label === "The big idea" && ideaState.dock, "katex: idea tab shows The big idea with the dock", ideaState);
    await page.shot("idea-tab.png");
    await page.click(await page.ext(`__t.rect("#ab-tab-idea")`));
    await sleep(300);
    const conceptCalls = (await page.ext(`__t.hintsLog()`)).filter((p) => p.action === "concept").length;
    check(conceptCalls === 1, "katex: the concept is asked for once", conceptCalls);

    // Ask: the question shows as the student's bubble, the reply as Archie's.
    await page.click(await page.ext(`__t.at("Ask about this problem", "input")`));
    await page.type("why do I divide?");
    await page.key("Enter");
    await page.waitFor(`const m = __t.qa(".ab-thread .ab-msg"); return m.length >= 2 && m.at(-1).classList.contains("ab-archie") && /fraction bar/.test(m.at(-1).textContent) && !__t.isShown(".ab-status");`, { timeout: 3000 });
    const asked = await page.ext(`({ tab: ${STATE}.tab, you: __t.qa(".ab-thread .ab-you").map((m) => m.textContent), input: __t.q(".ab-ask-input").value })`);
    check(asked.tab === "hints" && asked.you.at(-1) === "You asked: why do I divide?" && asked.input === "", "katex: the question shows in the chat", asked);
    payloads = await page.ext(`__t.hintsLog()`);
    check(payloads.at(-1).action === "ask" && payloads.at(-1).question === "why do I divide?", "katex: ask sends the question", payloads.at(-1));

    // A friendly error with Try again; the retried question is not doubled.
    await page.ext(`__harness.failNext = { ok: false, error: "offline", message: "Could not reach AlgeBridge. Check your connection and try again." }`);
    await page.click(await page.ext(`__t.at("Ask about this problem", "input")`));
    await page.type("what does undo mean?");
    await page.key("Enter");
    await page.waitFor(visibleShown(".ab-error"), { timeout: 3000 });
    const err = await page.ext(`__t.text(".ab-error-text")`);
    check(err === "Could not reach AlgeBridge. Check your connection and try again.", "katex: error message shown", err);
    await page.shot("hints-error.png");
    await page.click(await page.ext(`__t.at("Try again")`));
    await page.waitFor(`return !__t.isShown(".ab-error") && !__t.isShown(".ab-status") && __t.qa(".ab-thread .ab-msg").at(-1).classList.contains("ab-archie");`, { timeout: 3000 });
    const doubled = await page.ext(`__t.qa(".ab-thread .ab-you").filter((m) => /undo mean/.test(m.textContent)).length`);
    check(doubled === 1, "katex: a retried question shows once", doubled);

    // Every button has a name.
    const unnamed = await page.ext(`__t.qa("button").filter((b) => !(b.getAttribute("aria-label") || b.textContent.trim())).length`);
    check(unnamed === 0, "katex: every button has an accessible name", unnamed);

    // Editing the problem resets its state.
    await page.click(await page.ext(`__t.at("Edit the problem text")`));
    await page.waitFor(visibleShown(".ab-textarea"));
    await page.selectAllInFocused();
    await page.type("Solve for x: x/4 + 1 = 6");
    await page.click(await page.ext(`__t.at("Use this problem text")`));
    await sleep(100);
    const reset = await page.ext(`({ hints: __t.qa(${JSON.stringify(HINTS)}).length, msgs: __t.qa(".ab-thread .ab-msg").length, text: __t.text(".ab-problem-math"), next: __t.q(".ab-next").getAttribute("aria-label"), state: ${STATE}.current, intro: __t.isShown(".ab-intro") })`);
    check(reset.hints === 0 && reset.msgs === 0 && reset.state.hints.length === 0 && !reset.state.sealed && reset.intro, "katex: edited problem starts fresh", reset);
    check(reset.text === "Solve for x: x/4 + 1 = 6" && reset.next === "Get a hint", "katex: edited text shown", reset);
    await page.click(await page.ext(`__t.at("Get a hint", ".ab-next")`));
    await waitHints(page, 1);
    payloads = await page.ext(`__t.hintsLog()`);
    check(payloads.at(-1).action === "first" && !payloads.at(-1).sealed && payloads.at(-1).problem === "Solve for x: x/4 + 1 = 6", "katex: edited problem asks fresh", payloads.at(-1));

    // Drag by the header.
    const logo = await page.ext(`__t.rect(".ab-logo")`);
    const before = await page.ext(`__t.rect(".ab-sheet")`);
    await page.drag({ x: logo.cx, y: logo.cy }, { x: logo.cx - 420, y: logo.cy + 120 });
    const after = await page.ext(`__t.rect(".ab-sheet")`);
    check(Math.abs(after.x - (before.x - 420)) <= 2 && Math.abs(after.y - (before.y + 120)) <= 2, "katex: card drags by its header", { before, after });

    // Stats, Escape, and the round button picks up where the student left off.
    const bumps = await page.ext(`__harness.log.filter((m) => m.type === "stats:bump" && m.key === "hints").length`);
    check(bumps === 4, "katex: one hints bump per hint shown", bumps);
    const asksBefore = (await page.ext(`__t.hintsLog()`)).length;
    await page.ext(`__t.q(".ab-problem-math").focus()`);
    await page.key("Escape");
    await sleep(150);
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)), "katex: Escape closes the hint view");
    check(await page.ext(`__t.isShown(".ab-fab")`), "katex: the round button waits in the corner");
    const fabFocus = await page.ext(`__t.active()`);
    check(fabFocus && /ab-fab/.test(fabFocus.cls), "katex: focus lands on the round button", fabFocus);
    await page.click(await page.ext(`__t.rect(".ab-fab")`));
    await page.waitFor(`return ${STATE}.view === "panel" && __t.qa(${JSON.stringify(HINTS)}).length === 1;`, { timeout: 2000 });
    const resumed = await page.ext(`__t.text(".ab-problem-math")`);
    check(resumed === "Solve for x: x/4 + 1 = 6", "katex: the round button reopens the same problem", resumed);
    await sleep(300);
    const asks = (await page.ext(`__t.hintsLog()`)).length;
    check(asks === asksBefore, "katex: reopening asks for nothing new", { asks, asksBefore });
  },

  async mathjax(page) {
    await page.goto("mathjax.html");
    await waitCard(page);
    const st = await page.ext(STATE);
    check(st.problems.length === 2, "mathjax: both MathJax problems detected, reflection skipped", st.problems.map((p) => p.text));
    const exprs = st.problems.map((p) => p.expr).join(" | ");
    check(/x\^2/.test(exprs) && /2\^/.test(exprs), "mathjax: assistive MathML read as text", exprs);
    const title = await page.ext(`__t.text(".ab-hero-title")`);
    check(title === "Archie found 2 algebra problems", "mathjax: card counts both", title);
    const sups = await page.ext(`__t.qa(".ab-preview-well sup").length`);
    check(sups >= 2, "mathjax: exponents render as superscripts in the previews", sups);
    check(!(await page.ext(`__t.isShown(".ab-more")`)), "mathjax: no +more with two problems");
    await page.shot("mathjax-card.png");
    // Pick the second one from the well.
    await page.click(await page.ext(`__t.rect(__t.qa(${JSON.stringify(PREVIEWS)})[1])`));
    await page.waitFor(`return ${STATE}.view === "panel";`);
    await waitHints(page, 1);
    const sent = await page.ext(`__t.hintsLog()[0].problem`);
    check(/16/.test(sent), "mathjax: picking a preview opens that problem", sent);
    // On this page marks the open problem.
    await page.click(await page.ext(`__t.rect("#ab-tab-page")`));
    await page.waitFor(visibleShown(".ab-page-well"));
    const rows = await page.ext(`__t.qa(${JSON.stringify(PAGE_ROWS)}).map((b) => ({ open: b.classList.contains("ab-current"), pill: b.querySelector(".ab-pcard-pill").textContent }))`);
    check(rows.length === 2 && !rows[0].open && rows[1].open && rows[1].pill === "Open", "mathjax: On this page marks the open problem", rows);
    // The idea from the list: the first problem, with the big idea.
    await page.click(await page.ext(`__t.rect(__t.qa(${JSON.stringify(PAGE_ROWS)})[0])`));
    await waitHints(page, 1);
    await page.click(await page.ext(`__t.rect("#ab-tab-idea")`));
    await page.waitFor(`return __t.isShown(".ab-idea");`, { timeout: 3000 });
    const log = (await page.ext(`__t.hintsLog()`)).map((p) => p.action + ":" + /x\^2|x²/.test(p.problem));
    check(log.join(",") === "first:false,first:true,concept:true", "mathjax: switching problems keeps each one's own hints", log);
  },

  async forms(page) {
    await page.goto("forms.html");
    await page.move(2, 2);
    await waitCard(page);
    const st = await page.ext(STATE);
    const texts = st.problems.map((p) => p.text);
    check(st.problems.length === 2, "forms: two math questions, one per question card", texts);
    check(!texts.some((t) => /first name/i.test(t)), "forms: the name question is not a problem", texts);
    check(texts.some((t) => /4x - 7 = 2x \+ 9/.test(t)), "forms: question text kept whole", texts);
    // The idea with two problems: a picker, not a guess.
    await page.click(await page.ext(`__t.rect("#ab-tab-idea")`));
    await page.waitFor(`return __t.isShown(".ab-page-well") && /big idea/.test(__t.text(".ab-page-head"));`, { timeout: 2000 });
    const pills = await page.ext(`__t.qa(${JSON.stringify(PAGE_ROWS)}).map((b) => b.querySelector(".ab-pcard-pill").textContent)`);
    check(pills.join(",") === "Idea,Idea", "forms: The idea lists the problems to pick from", pills);
    check((await page.ext(`__t.hintsLog()`)).length === 0, "forms: nothing is asked before a pick");
    await page.click(await page.ext(`__t.rect("#ab-tab-hints")`));
    await page.move(2, 2);
    // Auto shrink after 10 s without hover.
    await sleep(10400);
    const s2 = await page.ext(STATE);
    check(s2.cardState === "launcher", "forms: card shrinks to the round button after 10 s", s2.cardState);
    check(await page.ext(`__t.isShown(".ab-fab")`), "forms: round button visible");
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)), "forms: card hidden after shrinking");
    const fab = await page.ext(`({ r: __t.rect(".ab-fab"), count: __t.text(".ab-fab-count"), label: __t.q(".ab-fab").getAttribute("aria-label"), face: !!__t.q(".ab-fab svg.ab-face"), vw: document.documentElement.clientWidth, vh: innerHeight })`);
    check(Math.round(fab.r.w) === 56 && Math.round(fab.vw - fab.r.x - fab.r.w) === 16 && Math.round(fab.vh - fab.r.y - fab.r.h) === 16, "forms: 56 px round button 16 px from the bottom right", fab);
    check(fab.count === "2" && fab.label === "Open AlgeBridge hints, 2 problems on this page" && fab.face, "forms: Archie's face with a count badge", fab);
    await page.shot("fab-collapsed.png");
    await page.shotClip("fab-zoom.png", { x: fab.r.x - 14, y: fab.r.y - 14, w: fab.r.w + 28, h: fab.r.h + 28 }, 2);
    const clear = await page.ext(`(() => { const b = __t.q(".ab-fab-count").getBoundingClientRect(); const eyes = [...__t.q(".ab-fab svg.ab-face").querySelectorAll("ellipse")].filter((e) => e.getAttribute("fill") === "#ffffff").map((e) => e.getBoundingClientRect()); return eyes.length === 2 && eyes.every((e) => e.right <= b.left || e.top >= b.bottom); })()`);
    check(clear, "forms: the count badge clears Archie's eyes", clear);
    // The round button brings the card back.
    await page.click(fab.r);
    await page.waitFor(visibleShown(".ab-found"));
    check((await page.ext(`__t.qa(${JSON.stringify(PREVIEWS)}).length`)) === 2, "forms: the round button reopens the card");
  },

  async spa(page) {
    await page.goto("spa.html");
    await waitCard(page);
    let st = await page.ext(STATE);
    check(st.problems.length === 1 && /7x - 4 = 3x \+ 12/.test(st.problems[0].text), "spa: first problem detected", st.problems);
    const title = await page.ext(`__t.text(".ab-hero-title")`);
    check(title === "Archie found an algebra problem", "spa: one problem, singular title", title);
    await fitCheck(page, "spa card", 16);
    await page.shot("card-single.png");
    const nextProblem = `(() => { const r = document.getElementById("next").getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; })()`;
    // Without the hint view: the card follows the new problem.
    await page.click(await page.ext(nextProblem));
    await page.waitFor(`return /5\\(x \\+ 2\\)/.test(__t.text(".ab-preview-well") || "");`, { timeout: 3000 });
    st = await page.ext(STATE);
    check(st.problems.length === 1 && /5\(x \+ 2\)/.test(st.problems[0].text), "spa: in-place swap detected", st.problems);

    // Open hints, then swap again (this time the element is rebuilt).
    await page.click(await page.ext(`__t.at("Get a hint", ".ab-go")`));
    await waitHints(page, 1);
    await page.click(await page.ext(nextProblem));
    await page.waitFor(visibleShown(".ab-notice"), { timeout: 3000 });
    const notice = await page.ext(`__t.text(".ab-notice")`);
    check(/New problem on screen/.test(notice) && /2y/.test(notice), "spa: the hint view offers the new problem", notice);
    await page.shot("spa-notice.png");
    await page.click(await page.ext(`__t.at("Switch to the new problem")`));
    await sleep(120);
    const sw = await page.ext(`({ text: __t.text(".ab-problem-math"), hints: __t.qa(${JSON.stringify(HINTS)}).length, notice: __t.isShown(".ab-notice") })`);
    check(/2y\/3 \+ 4 = 10/.test(sw.text) && sw.hints === 0 && !sw.notice, "spa: Switch moves the hint view to the new problem", sw);
    const seen = await page.ext(`__harness.log.filter((m) => m.type === "stats:bump" && m.key === "problemsSeen").length`);
    check(seen === 3, "spa: each new problem counts once", seen);

    // Put away, then a new problem: the round button bounces once instead of
    // the card popping back right away.
    await page.ext(`__t.q(".ab-problem-math").focus()`);
    await page.key("Escape");
    await page.waitFor(visibleShown(".ab-fab"), { timeout: 2000 });
    await page.click(await page.ext(nextProblem));
    await page.waitFor(`return __t.q(".ab-fab").classList.contains("ab-bounce");`, { timeout: 3000 });
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)), "spa: the card stays put away right after closing");
    st = await page.ext(STATE);
    page.notes.push(`spa scan ${st.lastScanMs.toFixed(1)} ms over ${st.scanCount} scans`);
  },

  async negatives(page) {
    await page.goto("negatives.html");
    await sleep(2600);
    const st = await page.ext(STATE);
    check(st.problems.length === 0, "negatives: nothing detected on a code blog", st.problems.map((p) => p.text));
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)), "negatives: no card");
    check(!(await page.ext(`__t.isShown(".ab-fab")`)), "negatives: no round button");
    check((await page.ext(`__t.qa(".ab-marker").length`)) === 0, "negatives: no markers");
    const counts = await page.ext(`__harness.log.filter((m) => m.type === "problems:count").map((m) => m.count)`);
    check(counts.every((c) => c === 0), "negatives: count stays 0", counts);
    const direct = await page.ext(`AlgeBridgeDetect.findProblems(document).map((p) => p.text)`);
    check(direct.length === 0, "negatives: detector finds nothing", direct);
    // Opened by hand with nothing on the page: a box to type a problem.
    await page.ext(`__harness.dispatch({ type: "open-panel" })`);
    await page.waitFor(`return __t.isShown(".ab-textarea");`, { timeout: 3000 });
    const typed = await page.ext(`({ focus: __t.active(), intro: __t.text(".ab-intro"), list: (__t.q("#ab-tab-page").click(), __t.text(".ab-page-empty")) })`);
    check(typed.focus && typed.focus.tag === "TEXTAREA", "negatives: focus goes to the problem box", typed.focus);
    check(/Type or paste/.test(typed.intro) && /not spotted/.test(typed.list), "negatives: friendly empty states", typed);
  },

  async dark(page) {
    await page.goto("dark.html");
    await waitCard(page);
    const bg = await page.ext(`getComputedStyle(__t.q(".ab-sheet")).backgroundColor`);
    check(bg === "rgb(255, 255, 255)", "dark: card keeps its own light surface", bg);
    await page.shot("dark-card.png");
    await page.click(await page.ext(`__t.rect(__t.qa(${JSON.stringify(PREVIEWS)})[1])`));
    await waitHints(page, 1);
    await page.click(await page.ext(`__t.at("Next hint")`));
    await waitHints(page, 2);
    const ink = await page.ext(`getComputedStyle(__t.q(".ab-thread .ab-bubble-text")).color`);
    check(ink === "rgb(15, 23, 42)", "dark: page color does not leak into hints", ink);
    await page.move(5, 5);
    await sleep(250); // off the button, and past its color transition
    const guard = await page.ext(`(() => {
      const next = getComputedStyle(__t.q(".ab-next"));
      const hostCs = getComputedStyle(document.querySelector("algebridge-hints"));
      return { blue: next.backgroundColor, size: next.fontSize, spacing: next.letterSpacing, display: hostCs.display, opacity: hostCs.opacity, transform: hostCs.transform, panelW: __t.rect(".ab-sheet").w };
    })()`);
    check(guard.blue === "rgb(37, 99, 235)" && guard.size === "14px", "dark: hostile page CSS cannot restyle buttons", guard);
    check(guard.display === "block" && guard.opacity === "1" && guard.transform === "none", "dark: hostile page CSS cannot hide the host", guard);
    check(guard.spacing === "normal" && Math.round(guard.panelW) === 360, "dark: page letter-spacing and root font size stay out", guard);
    await page.shot("dark-hints.png");
  },

  async frames(page) {
    await framesFlow(page, "frames.html", "frames", false);
  },

  // The quiz frame on another origin (127.0.0.1 page, localhost frames), so
  // replies pinned to the top's origin are really delivered.
  async framesx(page) {
    const base = `http://127.0.0.1:${SERVER.port}/`;
    const child = `http://localhost:${SERVER.port}/`;
    await framesFlow(page, `${base}frames-cross.html?child=${encodeURIComponent(child)}`, "framesx", true);
  },

  async solved(page) {
    await page.goto("worksheet.html");
    await waitCard(page);
    await page.click(await page.ext(`__t.at("Get a hint for the first problem", ".ab-go")`));
    await waitHints(page, 1);
    const firstText = await page.ext(`${STATE}.current.text`);
    await page.click(await page.ext(`__t.at("Check my answer")`));
    await page.type("x = 15");
    await page.key("Enter");
    await page.waitFor(`return ${STATE}.current.solved && !__t.isShown(".ab-status");`, { timeout: 3000 });
    await sleep(250);
    const s = await page.ext(`({
      verdict: __t.qa(".ab-thread .ab-verdict.ab-good").length,
      form: __t.isShown(".ab-form"),
      value: __t.q(".ab-form .ab-input").value,
      move: { shown: __t.isShown(".ab-move"), text: __t.text(".ab-move"), primary: __t.q(".ab-move").classList.contains("ab-primary") },
      next: { shown: __t.isShown(".ab-next"), cls: __t.q(".ab-next").className, disabled: __t.q(".ab-next").disabled, text: __t.text(".ab-next") },
      check: __t.isShown(".ab-check"),
      ask: __t.isShown(".ab-ask-input") && !__t.q(".ab-send").disabled,
      chip: __t.isShown(".ab-solved-chip") ? __t.text(".ab-solved-chip") : null,
      chips: __t.q(".ab-chips").getBoundingClientRect().height,
      focus: __t.active(),
    })`);
    check(s.verdict === 1, "solved: the correct check shows Archie's green line", s);
    check(!s.form && s.value === "", "solved: the answer box clears and closes", s);
    check(s.move.shown && s.move.text === "Next problem" && s.move.primary, "solved: Next problem leads the dock", s.move);
    check(s.next.shown && /ab-secondary/.test(s.next.cls) && !/ab-primary/.test(s.next.cls) && !s.next.disabled && s.next.text === "Next hint", "solved: Next hint stays on, as a secondary button", s.next);
    check(!s.check && s.ask, "solved: Check my answer steps aside, Ask stays", s);
    check(s.chip === "Solved" && s.chips <= 22, "solved: a Solved chip joins the kind chip on one line", s);
    check(s.focus && /^Next problem/.test(s.focus.label), "solved: focus moves from the answer box to Next problem", s.focus);
    await fitCheck(page, "solved", 16);

    // The marker beside the problem gets a small check; the others do not.
    await sleep(150);
    const marks = await page.ext(`__t.qa(".ab-marker").filter(__t.shown).map((m) => { const c = m.querySelector(".ab-marker-check"); return { check: !!c && __t.shown(c), face: !!m.querySelector("svg.ab-face"), label: m.getAttribute("aria-label"), r: __t.rect(m), cr: c ? __t.rect(c) : null }; })`);
    check(marks.length >= 3 && marks.filter((m) => m.check).length === 1 && marks[0].check, "solved: only the solved problem's marker shows a check", marks.map((m) => m.check));
    check(marks.every((m) => m.face), "solved: every marker keeps Archie's face", marks.map((m) => m.face));
    check(marks[0].label === "Solved. Open this problem again" && marks[1].label === "Get a hint for this problem", "solved: the marker says it is solved", marks.map((m) => m.label));
    check(Math.round(marks[0].cr.w) === 12 && marks[0].cr.x + marks[0].cr.w > marks[0].r.x + marks[0].r.w && marks[0].cr.y + marks[0].cr.h > marks[0].r.y + marks[0].r.h, "solved: the check is a 12 px badge on the marker's lower right", marks[0]);
    // A close-up at 2x zoom: the solved marker and an open one, with their problems.
    const m0 = marks[0].r;
    const m1 = marks[1].r;
    const zx = Math.min(m0.x, m1.x) - 200;
    await page.shotClip("marker-zoom.png", { x: zx, y: m0.y - 14, w: Math.max(m0.x + m0.w, m1.x + m1.w) + 14 - zx, h: m1.y + m1.h + 14 - (m0.y - 14) }, 2);

    // On this page ticks it off.
    await page.click(await page.ext(`__t.rect("#ab-tab-page")`));
    await page.waitFor(visibleShown(".ab-page-well"));
    const rows = await page.ext(`__t.qa(${JSON.stringify(PAGE_ROWS)}).map((b) => ({ solved: b.classList.contains("ab-solved"), done: !!b.querySelector(".ab-pcard-done svg"), num: b.querySelector(".ab-pcard-num").textContent, pill: b.querySelector(".ab-pcard-pill").textContent, label: b.getAttribute("aria-label") }))`);
    check(rows[0].solved && rows[0].done && rows[0].pill === "Solved" && /^Problem 1, solved and open now: /.test(rows[0].label), "solved: On this page marks the problem solved with a check", rows[0]);
    check(rows.slice(1).every((r) => !r.solved && !r.done && r.pill === "Hint") && rows[1].num === "2", "solved: the other problems are unchanged", rows.slice(1, 3));
    await fitCheck(page, "solved list", 16);
    await page.shot("solved-on-this-page.png");
    await page.click(await page.ext(`__t.rect("#ab-tab-hints")`));
    await page.waitFor(visibleShown(".ab-dock"));

    // "What is the answer?" on a solved problem: a local reply, no request.
    const before = (await page.ext(`__t.hintsLog()`)).length;
    for (const q of ["what is the answer?", "whats x", "x = ?"]) {
      await page.click(await page.ext(`__t.at("Ask about this problem", "input")`));
      await page.type(q);
      await page.key("Enter");
      await page.waitFor(`const y = __t.qa(".ab-thread .ab-you").at(-1); return y && y.textContent === ${JSON.stringify("You asked: " + q)};`, { timeout: 2000 });
      await sleep(120);
      const local = await page.ext(`({ last: __t.qa(".ab-thread .ab-msg").at(-1).textContent, n: __t.hintsLog().length, status: __t.isShown(".ab-status"), input: __t.q(".ab-ask-input").value })`);
      check(local.last === "You already solved this one. Want to try the next problem?", `solved: "${q}" gets the local reply`, local);
      check(local.n === before && !local.status && local.input === "", `solved: "${q}" sends no request`, local);
    }
    await sleep(200);
    await page.shot("solved-state.png");
    // Other questions still go to Archie.
    await page.click(await page.ext(`__t.at("Ask about this problem", "input")`));
    await page.type("why do I subtract first?");
    await page.key("Enter");
    await page.waitFor(`return __t.hintsLog().length === ${before + 1} && !__t.isShown(".ab-status");`, { timeout: 3000 });
    const asked = await page.ext(`__t.hintsLog().at(-1)`);
    check(asked.action === "ask" && asked.question === "why do I subtract first?", "solved: other questions still reach Archie", asked);

    // Next problem opens the next one on the page, with no hint asked for yet.
    const nextText = await page.ext(`(() => { const ps = ${STATE}.problems; const i = ps.findIndex((p) => p.text === ${JSON.stringify(firstText)}); return ps[i + 1].text; })()`);
    const n0 = (await page.ext(`__t.hintsLog()`)).length;
    await page.click(await page.ext(`__t.at("Next problem", ".ab-move")`));
    await page.waitFor(`return ${STATE}.current && ${STATE}.current.text === ${JSON.stringify(nextText)};`, { timeout: 2000 });
    await sleep(150);
    const moved = await page.ext(`({ n: __t.hintsLog().length, move: __t.isShown(".ab-move"), next: __t.text(".ab-next"), nextPrimary: __t.q(".ab-next").classList.contains("ab-primary"), check: __t.isShown(".ab-check"), chip: __t.isShown(".ab-solved-chip"), outline: __t.isShown(".ab-outline"), focus: __t.active(), solved: ${STATE}.current.solved })`);
    check(moved.n === n0 && !moved.solved, "solved: Next problem asks for nothing on its own", moved);
    check(moved.next === "Get a hint" && moved.nextPrimary && moved.check && !moved.move && !moved.chip, "solved: the next problem starts fresh", moved);
    check(moved.outline, "solved: the next problem is outlined on the page for a moment", moved);
    check(moved.focus && moved.focus.tag === "H2", "solved: focus lands on the new problem", moved.focus);
    const still = await page.ext(`__t.qa(".ab-marker").filter((m) => m.querySelector(".ab-marker-check")).length`);
    check(still === 1, "solved: the first problem keeps its check", still);

    // A page with one problem: Done instead of Next problem.
    await page.goto("spa.html");
    await waitCard(page);
    await page.click(await page.ext(`__t.at("Get a hint", ".ab-go")`));
    await waitHints(page, 1);
    await page.click(await page.ext(`__t.at("Check my answer")`));
    await page.type("15");
    await page.key("Enter");
    await page.waitFor(`return ${STATE}.current.solved && !__t.isShown(".ab-status");`, { timeout: 3000 });
    await sleep(150);
    const last = await page.ext(`({ move: __t.text(".ab-move"), label: __t.q(".ab-move").getAttribute("aria-label"), focus: __t.active() })`);
    check(last.move === "Done" && last.label === "Done, put hints away" && last.focus && last.focus.label === "Done, put hints away", "solved: with no other problem on the page, Done leads", last);
    await page.click(await page.ext(`__t.at("Ask about this problem", "input")`));
    await page.type("tell me the answer");
    await page.key("Enter");
    await page.waitFor(`return /already solved/.test(__t.qa(".ab-thread .ab-msg").at(-1).textContent);`, { timeout: 2000 });
    const lastReply = await page.ext(`({ text: __t.qa(".ab-thread .ab-msg").at(-1).textContent, asks: __t.hintsLog().filter((p) => p.action === "ask").length })`);
    check(lastReply.text === "You already solved this one. Nice work." && lastReply.asks === 0, "solved: with nothing next, the local reply says so", lastReply);
    await sleep(200);
    await page.shot("solved-done.png");
    await page.click(await page.ext(`__t.at("Done", ".ab-move")`));
    await page.waitFor(visibleShown(".ab-fab"), { timeout: 2000 });
    const after = await page.ext(`({ sheet: __t.isShown(".ab-sheet"), card: ${STATE}.cardState, view: ${STATE}.view, focus: __t.active() })`);
    check(!after.sheet && after.card === "launcher" && after.focus && /ab-fab/.test(after.focus.cls), "solved: Done shrinks the card to the round button", after);
    await page.click(await page.ext(`__t.rect(".ab-fab")`));
    await page.waitFor(visibleShown(".ab-found"));
    const pills = await page.ext(`__t.qa(${JSON.stringify(PREVIEWS)}).map((b) => b.querySelector(".ab-pcard-pill").textContent)`);
    check(pills.join(",") === "Solved", "solved: the round button reopens the list, with the problem marked solved", pills);
  },

  async busy(page) {
    await page.goto("katex.html");
    await waitCard(page);
    const retryState = `(() => { const r = __t.q(".ab-retry"); const b = getComputedStyle(r, "::before"); return { text: __t.text(".ab-error-text"), shown: __t.shown(r), disabled: r.disabled, waiting: r.classList.contains("ab-waiting"), anim: b.animationName, next: __t.q(".ab-next").disabled }; })()`;

    // A short wait: Try again (and Next hint, the same request) stay off,
    // then turn back on by themselves, and the retry works.
    await page.ext(`__harness.failNext = { ok: false, error: "no-model", message: "The hint helper is busy right now. Try again in a minute.", retryAfter: 2 }`);
    await page.click(await page.ext(`__t.at("Get a hint for the first problem", ".ab-go")`));
    await page.waitFor(`return /about 2 seconds/.test(__t.text(".ab-error-text") || "");`, { timeout: 3000 });
    const t0 = Date.now();
    let b = await page.ext(retryState);
    check(b.text === "Archie is busy. Try again in about 2 seconds." && b.disabled && b.waiting && b.next, "busy: a 2 second wait keeps Try again and Get a hint off", b);
    await page.waitFor(`return !__t.q(".ab-retry").disabled && !__t.q(".ab-retry").classList.contains("ab-waiting") && !__t.q(".ab-next").disabled;`, { timeout: 5000 });
    const waited = Date.now() - t0;
    check(waited >= 1200, "busy: the buttons stay off for the wait", waited);
    await page.click(await page.ext(`__t.at("Try again")`));
    await waitHints(page, 1);
    check(!(await page.ext(`__t.isShown(".ab-error")`)), "busy: the retry brings the hint in");

    // Paused and off: Try again cannot help, so it is not offered.
    for (const [code, message] of [
      ["paused", "Hints are paused on this site. Turn them back on from the AlgeBridge button in your toolbar."],
      ["off", "Hints are turned off. Turn them on from the AlgeBridge button in your toolbar."],
    ]) {
      await page.ext(`__harness.failNext = { ok: false, error: ${JSON.stringify(code)}, message: ${JSON.stringify(message)} }`);
      await page.click(await page.ext(`__t.at("Next hint")`));
      await page.waitFor(`return __t.text(".ab-error-text") === ${JSON.stringify(message)} && !__t.isShown(".ab-status");`, { timeout: 3000 });
      check(!(await page.ext(`__t.isShown(".ab-retry")`)), `busy: ${code} shows no Try again`);
    }

    // Too many requests: the same honest wait, in the rate wording.
    await page.ext(`__harness.failNext = { ok: false, error: "rate", message: "That is a lot of hints in a short time. Take a short break and try again in about 60 seconds.", retryAfter: 60 }`);
    await page.click(await page.ext(`__t.at("Next hint")`));
    await page.waitFor(`return /a lot of hints/.test(__t.text(".ab-error-text") || "");`, { timeout: 3000 });
    b = await page.ext(retryState);
    check(b.text === "That is a lot of hints in a short time. Try again in about 60 seconds." && b.disabled && b.next, "busy: rate limits get the same honest wait", b);
    // Asking a question is a different request, so it still goes.
    const asks = (await page.ext(`__t.hintsLog()`)).length;
    await page.click(await page.ext(`__t.at("Ask about this problem", "input")`));
    await page.type("why do I divide?");
    await page.key("Enter");
    await page.waitFor(`return __t.hintsLog().length === ${asks + 1} && !__t.isShown(".ab-status");`, { timeout: 3000 });

    // The model is busy and the server says 40 seconds, on the other problem.
    await page.ext(`__harness.failNext = { ok: false, error: "no-model", message: "The hint helper is busy right now. Try again in a minute.", retryAfter: 40 }`);
    await page.click(await page.ext(`__t.rect("#ab-tab-page")`));
    await page.waitFor(visibleShown(".ab-page-well"));
    await page.click(await page.ext(`__t.rect(__t.qa(${JSON.stringify(PAGE_ROWS)})[1])`));
    await page.waitFor(`return /about 40 seconds/.test(__t.text(".ab-error-text") || "");`, { timeout: 3000 });
    await sleep(1500);
    b = await page.ext(retryState);
    check(b.text === "Archie is busy. Try again in about 40 seconds.", "busy: an honest wait, in the server's number", b.text);
    check(b.shown && b.disabled && b.waiting && b.anim === "ab-wait" && b.next, "busy: Try again stays off and fills up during the wait", b);
    await fitCheck(page, "busy", 16);
    await page.shot("busy-state.png");
    const n = (await page.ext(`__t.hintsLog()`)).length;
    await page.click(await page.ext(`__t.rect(".ab-retry")`));
    await page.click(await page.ext(`__t.rect(".ab-next")`));
    await sleep(300);
    check((await page.ext(`__t.hintsLog()`)).length === n, "busy: pressing Try again or Get a hint during the wait asks for nothing");
  },

  async settings(page) {
    await page.goto("worksheet.html");
    await waitCard(page);
    await page.ext(`__harness.dispatch({ type: "settings:changed", settings: { enabled: true, mode: "badge", pausedSites: [], apiBase: "https://learn.algebridge.org" } })`);
    await sleep(150);
    let st = await page.ext(STATE);
    check(!(await page.ext(`__t.isShown(".ab-sheet")`)) && st.markers >= 3 && st.running, "settings: badge mode keeps markers, drops the card", st);
    await page.ext(`__harness.dispatch({ type: "settings:changed", settings: { enabled: true, mode: "off", pausedSites: [] } })`);
    await sleep(150);
    st = await page.ext(STATE);
    check(!st.running && st.markers === 0, "settings: off mode stops watching", st);
    const opened = await page.ext(`__harness.dispatch({ type: "open-panel" })`);
    check(opened && opened.ok, "settings: off mode still opens on request", opened);
    await page.waitFor(`return __t.isShown(".ab-sheet") && ${STATE}.view === "panel";`);
    const text = await page.ext(`__t.text(".ab-problem-math")`);
    check(text && text.length > 3, "settings: off mode picks the problem in view", text);
    const offCount = await page.ext(`__t.text("#ab-tab-page .ab-tab-count")`);
    check(Number(offCount) >= 3, "settings: off mode still counts what is on screen", offCount);
    await page.ext(`__harness.dispatch({ type: "settings:changed", settings: { enabled: false, mode: "popup", pausedSites: [] } })`);
    await sleep(150);
    const hostCount = await page.ext(`document.querySelectorAll("algebridge-hints").length`);
    check(hostCount === 0, "settings: turning hints off removes everything", hostCount);
    const closed = await page.ext(`__harness.dispatch({ type: "open-panel" })`);
    check(closed && closed.ok === false, "settings: paused page declines open-panel", closed);
    await page.ext(`__harness.dispatch({ type: "settings:changed", settings: { enabled: true, mode: "popup", pausedSites: [] } })`);
    await page.waitFor(`return ${STATE}.running && ${STATE}.markers >= 3;`, { timeout: 4000 });
  },

  async motion(page) {
    await page.goto("katex.html");
    await waitCard(page);
    const anim = await page.ext(`({ card: getComputedStyle(__t.q(".ab-sheet")).animationName, archie: getComputedStyle(__t.q(".ab-hero-art .ab-m-fig")).animationName, bit: getComputedStyle(__t.q(".ab-hero-art .ab-m-bit")).animationName })`);
    check(anim.card === "none" && anim.archie === "none" && anim.bit === "none", "motion: reduced motion turns off the slide-in and Archie's pop", anim);
  },

  async phone(page) {
    await page.goto("worksheet.html");
    await waitCard(page);
    const card = await fitCheck(page, "phone card", 16);
    check(Math.round(card.w) === 358 && Math.round(card.x) === 16, "phone: card is the width of the screen less 16 px a side", card);
    const underCard = `(() => { const s = __t.rect(".ab-sheet"); return __t.qa(".ab-marker").filter(__t.shown).map((m) => __t.rect(m)).filter((m) => m.x + m.w > s.x && m.x < s.x + s.w && m.y + m.h > s.y && m.y < s.y + s.h).length; })()`;
    check((await page.ext(underCard)) === 0, "phone: no marker peeks out from under the card", await page.ext(underCard));
    check((await page.ext(`__t.qa(".ab-marker").filter(__t.shown).length`)) >= 1, "phone: markers below the card still show");
    await page.shot("phone-card.png");
    await page.click(await page.ext(`__t.at("Get a hint for the first problem", ".ab-go")`));
    await waitHints(page, 1);
    await page.click(await page.ext(`__t.at("Next hint")`));
    await waitHints(page, 2);
    await page.click(await page.ext(`__t.at("Next hint")`));
    await waitHints(page, 3);
    await page.click(await page.ext(`__t.at("Check my answer")`));
    await fitCheck(page, "phone hints", 16);
    await page.ext(`__t.q(".ab-thread-well .ab-scroll").scrollTop = 1e6`);
    await sleep(100);
    await page.shot("phone-hints.png");
    // Solved on a phone: the dock still fits.
    await page.ext(`__t.q(".ab-form .ab-input").focus()`);
    await page.type("x = 15");
    await page.key("Enter");
    await page.waitFor(`return ${STATE}.current.solved && !__t.isShown(".ab-status");`, { timeout: 3000 });
    await sleep(950); // confetti settles
    await fitCheck(page, "phone solved", 16);
    const ph = await page.ext(`({ move: __t.text(".ab-move"), check: __t.isShown(".ab-check"), form: __t.isShown(".ab-form") })`);
    check(ph.move === "Next problem" && !ph.check && !ph.form, "phone: solved leads with Next problem", ph);
    await page.shot("phone-solved.png");
  },

  async archie(page) {
    // Archie at large size, every pose, for review. Drawn on a plain overlay.
    await page.goto("negatives.html");
    const got = await page.ext(`(() => {
      const M = globalThis.AlgeBridgeMascot;
      const wrap = document.createElement("div");
      wrap.setAttribute("style", "position:fixed;inset:0;z-index:2147483646;background:#fff;display:flex;flex-wrap:wrap;align-items:flex-end;gap:28px;padding:40px;font:600 15px system-ui;color:#475569");
      const add = (node, label) => { const c = document.createElement("div"); c.setAttribute("style", "display:flex;flex-direction:column;align-items:center;gap:8px"); c.append(node, document.createTextNode(label)); wrap.appendChild(c); };
      add(M.create("idle", 260, { confetti: true }), "idle");
      add(M.create("thinking", 260), "thinking");
      add(M.create("party", 260), "party");
      add(M.create("idle", 96, { confetti: true }), "96 px");
      add(M.create("thinking", 52, { shadow: false }), "52 px");
      add(M.face(56), "button");
      add(M.face(26), "avatar");
      add(M.face(22), "marker");
      document.body.appendChild(wrap);
      const svgs = [...wrap.querySelectorAll("svg")];
      return { n: svgs.length, poses: svgs.map((s) => s.getAttribute("class")), ids: wrap.querySelectorAll("[id]").length };
    })()`);
    check(got.n === 8 && got.poses.slice(0, 3).join(",") === "ab-mascot ab-pose-idle,ab-mascot ab-pose-thinking,ab-mascot ab-pose-party", "archie: every pose draws", got);
    check(got.ids === 0, "archie: no ids, so copies never clash", got.ids);
    await sleep(1200); // confetti and the wave finish
    await page.shot("archie-poses.png");
  },
};


/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  const detectPath = path.join(EXT, "src/detect.js");
  try {
    await access(detectPath);
  } catch {
    console.error("extension/src/detect.js is missing. The UI harness needs the detector.");
    process.exit(2);
  }
  await mkdir(SHOTS, { recursive: true });

  const statics = await staticChecks();
  const [css, detect, mascot, content] = await Promise.all([
    readFile(path.join(EXT, "src/ui.css"), "utf8"),
    readFile(detectPath, "utf8"),
    readFile(path.join(EXT, "src/mascot.js"), "utf8"),
    readFile(path.join(EXT, "src/content.js"), "utf8"),
  ]);
  const scripts = [shimSource(css), detect + "\n//# sourceURL=detect.js", mascot + "\n//# sourceURL=mascot.js", content + "\n//# sourceURL=content.js"];

  const chrome = await launchChrome();
  const cdp = await CDP.connect(chrome.wsUrl);
  SERVER = await startServer();
  console.log(`${chrome.version} on port ${chrome.port}`);
  const started = Date.now();

  try {
    const names = Object.keys(tests).filter((n) => !ONLY.length || ONLY.includes(n));
    for (const name of names) {
      const page = await Page.open(cdp, scripts, { reducedMotion: name === "motion", viewport: VIEWPORTS[name] });
      page.notes = [];
      const t0 = Date.now();
      try {
        await tests[name](page);
        const ours = page.errors.filter((e) => /content\.js|detect\.js|mascot\.js/.test(e));
        check(ours.length === 0, `${name}: no script errors`, ours);
        results.push({ name, ok: true, ms: Date.now() - t0, notes: page.notes });
      } catch (e) {
        await page.shot(`FAIL-${name}.png`).catch(() => {});
        const diag = await page
          .ext(`({ chrome: typeof chrome, runtimeId: typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id, detect: typeof AlgeBridgeDetect, hints: typeof __algebridgeHints, ready: document.readyState, state: globalThis.__algebridgeHints ? __algebridgeHints.state() : null, log: globalThis.__harness ? __harness.log.slice(-6) : null })`)
          .catch((err) => "diag failed: " + err.message);
        page.notes.push("diag " + JSON.stringify(diag).slice(0, 900));
        results.push({ name, ok: false, ms: Date.now() - t0, error: e.message, errors: page.errors, notes: page.notes });
      } finally {
        await page.close();
      }
    }
  } finally {
    cdp.close();
    await chrome.close();
    SERVER.server.close();
  }

  console.log("");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(10)} ${String(r.ms).padStart(6)} ms${r.notes && r.notes.length ? "   " + r.notes.join("; ") : ""}`);
    if (!r.ok) {
      console.log("      " + r.error);
      if (r.errors && r.errors.length) console.log("      page errors: " + r.errors.slice(0, 3).join(" | "));
    }
  }
  if (statics.length) {
    console.log("FAIL  static     " + statics.join("; "));
  } else {
    console.log("PASS  static     no em dashes, no emoji, no HTML string APIs in content.js or mascot.js, manifest loads mascot.js");
  }
  const failed = results.filter((r) => !r.ok).length + (statics.length ? 1 : 0);
  console.log(`\n${results.length - results.filter((r) => !r.ok).length}/${results.length} flows passed, ${checks} checks run, ${shots.length} screenshots in extension/test/shots (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
