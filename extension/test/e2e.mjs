#!/usr/bin/env node
// End-to-end test of AlgeBridge Hints in real, branded Google Chrome.
//
//   node extension/test/e2e.mjs            mock hint API served by this script
//   node extension/test/e2e.mjs --live     real API at http://localhost:3216 (npm run dev -- -p 3216)
//   node extension/test/e2e.mjs --store    the packed store build (run npm run extension:pack first):
//                                          no localhost access, so the API base must stay on the live site
//   node extension/test/e2e.mjs --headed   watch it run
//
// Options: --api=http://localhost:3000 (with --live), --shots=<dir>, CHROME=<path to the Chrome binary>.
//
// Branded Chrome 137+ ignores --load-extension, so the extension is loaded over
// the DevTools protocol (Extensions.loadUnpacked, which needs
// --remote-debugging-pipe and --enable-unsafe-extension-debugging). Content
// scripts do not run on data: URLs, so the test page is served over
// http://127.0.0.1 by this script.
//
// It checks the shell (service worker, popup, badge, menus of trust) and the
// security model from the outside: what a web page and another extension can
// and cannot reach.
//
// Developer mode is turned on in chrome://extensions before the extension is
// loaded, the way a person loads an unpacked build. That matters for the last
// checks: Chrome only reports manifest warnings and errors (the yellow
// Warnings / Errors buttons) while Developer mode is on, so reading them with
// it off passes no matter what the manifest says. A probe extension with a
// known warning proves the check can see one.

import http from "node:http";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const LIVE = flag("live");
const STORE = flag("store");
const HEADED = flag("headed");
const LIVE_API = option("api", "http://localhost:3216").replace(/\/+$/, "");
const SHOTS = resolve(option("shots", process.env.SHOTS || join(tmpdir(), "algebridge-e2e-shots")));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LIVE_SITE = "https://learn.algebridge.org";
const EM = String.fromCharCode(0x2014);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Chrome over a DevTools pipe                                         */
/* ------------------------------------------------------------------ */

async function launchChrome() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME}. Set CHROME=<path>.`);
  const profile = mkdtempSync(join(tmpdir(), "algebridge-e2e-profile-"));
  const argv = [
    `--user-data-dir=${profile}`,
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,OptimizationHints,MediaRouter",
    "--disable-sync",
    "--password-store=basic",
    "--use-mock-keychain",
    "--window-size=1280,900",
    ...(HEADED ? [] : ["--headless=new"]),
    "about:blank",
  ];
  const proc = spawn(CHROME, argv, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  proc.stderr.on("data", () => {});
  const toChrome = proc.stdio[3];
  const fromChrome = proc.stdio[4];
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  let buf = Buffer.alloc(0);
  fromChrome.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let idx;
    while ((idx = buf.indexOf(0)) !== -1) {
      const msg = JSON.parse(buf.subarray(0, idx).toString("utf8"));
      buf = buf.subarray(idx + 1);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: ok, reject, method } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else ok(msg.result);
      } else {
        for (const fn of listeners) fn(msg);
      }
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: ok, reject, method });
      toChrome.write(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }) + "\0");
    });
  const on = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  await send("Browser.getVersion");
  return {
    send,
    on,
    async close() {
      try {
        await send("Browser.close");
      } catch {
        /* already gone */
      }
      await sleep(300);
      proc.kill("SIGKILL");
      await sleep(200);
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* Chrome may still be flushing; the OS cleans the temp dir later */
      }
    },
  };
}

async function evaluate(cdp, sessionId, expression, contextId) {
  const params = { expression, awaitPromise: true, returnByValue: true, userGesture: true };
  if (contextId) params.contextId = contextId;
  const res = await cdp.send("Runtime.evaluate", params, sessionId);
  if (res.exceptionDetails) {
    const d = res.exceptionDetails;
    throw new Error(`eval failed: ${(d.exception && d.exception.description) || d.text}`);
  }
  return res.result.value;
}

/* ------------------------------------------------------------------ */
/* Extension copy, test page and mock API                              */
/* ------------------------------------------------------------------ */

const EXT = mkdtempSync(join(tmpdir(), "algebridge-e2e-ext-"));
const FROM = STORE ? join(SRC, "dist", "build") : SRC;
if (STORE && !existsSync(join(FROM, "manifest.json"))) {
  console.error("--store needs extension/dist/build. Run npm run extension:pack first.");
  rmSync(EXT, { recursive: true, force: true });
  process.exit(1);
}
for (const part of ["manifest.json", "src", "popup", "icons"]) cpSync(join(FROM, part), join(EXT, part), { recursive: true });
mkdirSync(SHOTS, { recursive: true });

// Another extension, used at the end: it tries to message AlgeBridge Hints,
// and its manifest carries the exact entry Chrome warns about
// (externally_connectable with an empty ids list), so the warning check is
// shown to catch a real warning before it is trusted to report none.
const PROBE = mkdtempSync(join(tmpdir(), "algebridge-e2e-probe-"));
writeFileSync(
  join(PROBE, "manifest.json"),
  JSON.stringify({
    manifest_version: 3,
    name: "AlgeBridge e2e probe",
    version: "1.0",
    background: { service_worker: "sw.js" },
    externally_connectable: { ids: [] },
  }),
);
writeFileSync(join(PROBE, "sw.js"), "// Driven from e2e.mjs over the DevTools protocol.\n");

const PAGE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unit 2 practice</title>
<style>body{font:16px/1.5 Georgia,serif;max-width:640px;margin:40px auto;padding:0 16px;color:#1f2937}</style></head><body>
<h1>Unit 2 practice</h1>
<ol>
  <li>Solve for x: 3x - 5 = 16</li>
  <li>Solve 3(x - 4) = 2x + 5</li>
  <li>Factor x^2 + 7x + 12</li>
</ol>
<p>Due Friday at 3:30 PM. Call 555-0100 with questions. Room 2-14.</p>
</body></html>`;

const hits = [];
const redirectHits = [];
const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url.startsWith("/hw.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(PAGE_HTML);
    return;
  }
  if (req.url.startsWith("/elsewhere")) {
    redirectHits.push(req.method);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ reply: "This should never be reached?" }));
    return;
  }
  if (req.method === "POST" && req.url === "/api/extension/hint") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      const json = JSON.parse(body);
      hits.push({ json, headers: req.headers });
      const reply = (status, obj, headers = {}) => {
        res.writeHead(status, { "Content-Type": "application/json", ...headers });
        res.end(JSON.stringify(obj));
      };
      if (json.problem.includes("RATE")) return reply(429, { error: "rate", message: "slow", retryAfter: 30 });
      if (json.problem.includes("NOTALG")) return reply(422, { error: "not-algebra", message: "nope" });
      if (json.problem.includes("BUSY")) return reply(503, { error: "no-model", message: "busy" });
      if (json.problem.includes("SLOW")) return reply(503, { error: "no-model", message: "slow", retryAfter: 5 });
      if (json.problem.includes("WAITHDR")) return reply(503, { error: "no-model" }, { "Retry-After": "120" });
      if (json.problem.includes("REDIRECT")) {
        res.writeHead(307, { Location: "/elsewhere" });
        res.end();
        return;
      }
      return reply(200, {
        reply: "What could you add to both sides first?",
        sealed: "S1",
        step: json.hints.length,
        steps: 3,
        done: false,
        kind: "linear-equation",
        level: 1,
        source: "ai",
        answers: ["x = 7"], // never part of the contract; the worker must drop it
      });
    });
    return;
  }
  res.writeHead(404);
  res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
// The store build has no localhost host permission, so its API stays on the live site.
const API = STORE ? LIVE_SITE : LIVE ? LIVE_API : ORIGIN;

if (LIVE) {
  try {
    const r = await fetch(`${LIVE_API}/api/extension/hint`, { method: "OPTIONS", headers: { Origin: "chrome-extension://test" } });
    if (r.status >= 500) throw new Error(`status ${r.status}`);
  } catch (err) {
    console.error(`--live needs the site running at ${LIVE_API} (npm run dev -- -p 3216): ${err.message}`);
    server.close();
    rmSync(EXT, { recursive: true, force: true });
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${err && err.message}`);
  }
}
const note = (text) => console.log(`     ${text}`);
async function shot(sessionId, name, beyond = false) {
  const res = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: beyond }, sessionId);
  writeFileSync(join(SHOTS, name), Buffer.from(res.data, "base64"));
}

const cdp = await launchChrome();
let extId = "";
let sw = "";
let page = "";
let pageTargetId = "";
let popup = "";
let tabId = -1;
let mainFrameId = "";
const isolated = new Map(); // frameId -> context id of our content-script world
const errors = { sw: [], popup: [], page: [] };

cdp.on((m) => {
  if (m.method === "Runtime.executionContextCreated" && m.sessionId === page) {
    const c = m.params.context;
    if (c.auxData && c.auxData.isDefault === false && c.origin && c.name === "AlgeBridge Hints") {
      isolated.set(c.auxData.frameId, c.id);
    }
  }
  if (m.method === "Runtime.exceptionThrown") {
    const text = (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text;
    if (m.sessionId === sw) errors.sw.push(text);
    if (m.sessionId === popup) errors.popup.push(text);
    if (m.sessionId === page) errors.page.push(text);
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    const text = m.params.args.map((a) => a.value || a.description || "").join(" ");
    if (m.sessionId === sw) errors.sw.push(text);
    if (m.sessionId === popup) errors.popup.push(text);
  }
});

const inContent = (expression) => evaluate(cdp, page, expression, isolated.get(mainFrameId));
const inPage = (expression) => evaluate(cdp, page, expression);
// MV3 lets Chrome stop and restart the service worker at any time. If the
// session to it is gone, find the worker again (waking it with a message from
// the page if needed) and retry once.
async function attachWorker() {
  const find = async () => {
    const { targetInfos } = await cdp.send("Target.getTargets");
    return targetInfos.find((t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${extId}/`)) || null;
  };
  let target = await find();
  if (!target && page && isolated.get(mainFrameId)) {
    await evaluate(cdp, page, `chrome.runtime.sendMessage({ type: "settings:get" }).catch(() => null)`, isolated.get(mainFrameId)).catch(() => {});
  }
  target = target || (await waitFor(find, "service worker"));
  sw = (await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId;
  await cdp.send("Runtime.enable", {}, sw);
}
async function inWorker(expression) {
  try {
    return await evaluate(cdp, sw, expression);
  } catch (err) {
    if (!/wasn't found|not found|No session|Target closed|detached/i.test(err.message)) throw err;
    note("service worker restarted; attaching again");
    await attachWorker();
    return evaluate(cdp, sw, expression);
  }
}
const inPopup = (expression) => evaluate(cdp, popup, expression);
const contentState = () => inContent("globalThis.__algebridgeHints ? globalThis.__algebridgeHints.state() : null");
const badge = () => inWorker(`chrome.action.getBadgeText({ tabId: ${tabId} })`);
const settings = async () => (await inWorker(`chrome.storage.sync.get("settings")`)).settings;
const hintFromContent = (payload) => inContent(`chrome.runtime.sendMessage({ type: "hint", payload: ${JSON.stringify(payload)} })`);
const hintFromPopup = (payload) => inPopup(`chrome.runtime.sendMessage({ type: "hint", payload: ${JSON.stringify(payload)} })`);

async function waitFor(fn, what, tries = 40, gap = 250) {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await fn().catch((e) => e);
    if (last && !(last instanceof Error)) return last;
    await sleep(gap);
  }
  throw new Error(`timed out waiting for ${what}${last instanceof Error ? `: ${last.message}` : ""}`);
}

// One chrome://extensions tab, kept open, for chrome.developerPrivate.
let extensionsPage = "";
async function inExtensionsPage(expression) {
  if (!extensionsPage) {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    extensionsPage = (await cdp.send("Target.attachToTarget", { targetId, flatten: true })).sessionId;
    await cdp.send("Page.enable", {}, extensionsPage);
    await cdp.send("Page.navigate", { url: "chrome://extensions/" }, extensionsPage);
    await waitFor(
      () => evaluate(cdp, extensionsPage, `(globalThis.chrome && chrome.developerPrivate && document.readyState === "complete") || null`),
      "chrome://extensions",
    );
  }
  return evaluate(cdp, extensionsPage, expression);
}
const extensionReport = (id) =>
  inExtensionsPage(`chrome.developerPrivate.getExtensionInfo(${JSON.stringify(id)}).then(i => ({
    warnings: i.installWarnings || [],
    manifestErrors: (i.manifestErrors || []).map(e => e.message),
    runtimeErrors: (i.runtimeErrors || []).map(e => ({ message: e.message, context: e.contextUrl || "", source: e.source || "" })),
    permissions: i.permissions,
    fileAccess: i.fileAccess,
  }))`);

async function openPopupTab(query = "", fakeTab = null) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  popup = sessionId;
  await cdp.send("Runtime.enable", {}, popup);
  await cdp.send("Page.enable", {}, popup);
  // In a real popup the active tab is the page behind it. Here the popup is a
  // tab itself, so tabs.query({active}) is pointed at the test tab (or a fake).
  // The store build reads the active tab's URL through activeTab, which a click
  // on the toolbar button grants. A popup opened as a tab gets no such grant,
  // so the store run hands it the tab the click would have shown.
  const stand = fakeTab || (STORE ? { id: tabId, url: `${ORIGIN}/hw.html`, active: true } : null);
  const fake = stand ? JSON.stringify(stand) : "null";
  await cdp.send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: `if (globalThis.chrome && chrome.tabs) { const q = chrome.tabs.query.bind(chrome.tabs); const fake = ${fake};
        chrome.tabs.query = async (info) => (info && info.active) ? (fake ? [fake] : (await q({})).filter(t => t.id === ${tabId})) : q(info); }`,
    },
    popup,
  );
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 600, deviceScaleFactor: 2, mobile: false }, popup);
  await cdp.send("Page.navigate", { url: `chrome-extension://${extId}/popup/popup.html${query}` }, popup);
  await waitFor(() => inPopup(`document.readyState === "complete" && document.getElementById("hero-title").textContent.length > 0 || null`), "popup ready");
  await sleep(250);
  return targetId;
}

const popupView = () =>
  inPopup(`(() => {
    const $ = (id) => document.getElementById(id);
    const btn = $("open-panel");
    const cs = getComputedStyle(btn);
    return {
      status: $("status-line").textContent,
      hero: $("hero-title").textContent,
      sub: $("hero-sub").textContent,
      site: $("site-row").hidden ? null : $("site-label").textContent,
      siteHelp: $("site-help").textContent,
      paused: $("paused").checked,
      openDisabled: btn.disabled,
      note: $("open-note").textContent,
      enabled: $("enabled").checked,
      groupDisabled: $("mode-group").disabled,
      mode: (document.querySelector('input[name="mode"]:checked') || {}).value,
      modeHelp: $("mode-help").textContent,
      seen: $("count-seen").textContent,
      hints: $("count-hints").textContent,
      width: document.body.getBoundingClientRect().width,
      scrollW: document.documentElement.scrollWidth,
      height: document.querySelector(".popup").getBoundingClientRect().height,
      font: getComputedStyle(document.body).fontFamily,
      btnBg: cs.backgroundColor,
      btnRadius: parseFloat(cs.borderTopLeftRadius),
      btnHeight: btn.getBoundingClientRect().height,
      text: document.body.innerText,
    };
  })()`);

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

try {
  await step("Developer mode is on in chrome://extensions before loading, as for any unpacked build", async () => {
    await inExtensionsPage(`chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }).then(() => true)`);
    const conf = await inExtensionsPage(`chrome.developerPrivate.getProfileConfiguration()`);
    assert.equal(conf.inDeveloperMode, true);
  });

  await step("Chrome loads the unpacked extension", async () => {
    const r = await cdp.send("Extensions.loadUnpacked", { path: EXT });
    extId = r.id;
    assert.match(extId, /^[a-p]{32}$/);
  });

  await step("service worker starts, makes an install id and stores the default settings", async () => {
    await attachWorker();
    const local = await waitFor(async () => {
      const got = await inWorker(`chrome.storage.local.get("install")`);
      return got.install ? got : null;
    }, "install id");
    assert.match(local.install, /^[0-9a-f-]{36}$/);
    assert.deepEqual(await settings(), { enabled: true, mode: "popup", pausedSites: [], apiBase: LIVE_SITE });
    assert.equal(await inWorker(`"externally_connectable" in chrome.runtime.getManifest()`), false, "no externally_connectable key");
  });

  await step("setApiBase refuses hosts outside host_permissions and accepts the local API", async () => {
    assert.equal(await inWorker(`setApiBase("https://evil.example")`), LIVE_SITE);
    assert.equal(await inWorker(`setApiBase("https://other.algebridge.org")`), LIVE_SITE);
    assert.equal(await inWorker(`setApiBase("http://learn.algebridge.org")`), LIVE_SITE);
    if (STORE) {
      assert.equal(await inWorker(`setApiBase(${JSON.stringify(ORIGIN)})`), LIVE_SITE, "store build refuses 127.0.0.1");
      assert.equal(await inWorker(`setApiBase("http://localhost:3216")`), LIVE_SITE, "store build refuses localhost");
      const hp = await inWorker(`chrome.runtime.getManifest().host_permissions`);
      assert.deepEqual(hp, [LIVE_SITE + "/*"]);
    }
    assert.equal(await inWorker(`setApiBase(${JSON.stringify(API + "/")})`), API);
    note(`api: ${API}${STORE ? " (store build, no hint calls made)" : LIVE ? " (live model)" : " (mock)"}`);
  });

  await step("content scripts run on an http page and find the problems; badge matches in brand blue", async () => {
    // Tab ids before and after opening the page. The store build cannot read
    // tab URLs (no host permission for 127.0.0.1, no "tabs" permission), so the
    // new tab is found by id rather than by URL.
    const tabIds = async () => (await inWorker(`chrome.tabs.query({}).then(ts => ts.map(t => t.id))`)).sort();
    const before = await tabIds();
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    pageTargetId = targetId;
    page = (await cdp.send("Target.attachToTarget", { targetId, flatten: true })).sessionId;
    await cdp.send("Runtime.enable", {}, page);
    await cdp.send("Page.enable", {}, page);
    await cdp.send("Page.navigate", { url: `${ORIGIN}/hw.html` }, page);
    mainFrameId = (await cdp.send("Page.getFrameTree", {}, page)).frameTree.frame.id;
    await waitFor(async () => (isolated.get(mainFrameId) ? true : null), "content-script world");
    const st = await waitFor(async () => {
      const s = await contentState();
      return s && s.problems && s.problems.length >= 2 ? s : null;
    }, "problems found");
    note(`found: ${st.problems.map((p) => p.expr || p.text).join(" | ")}`);
    const fresh = (await tabIds()).filter((id) => !before.includes(id));
    assert.equal(fresh.length, 1, `one new tab (${fresh})`);
    tabId = fresh[0];
    const text = await waitFor(async () => {
      const b = await badge();
      return b ? b : null;
    }, "badge");
    assert.equal(text, String(st.problems.length));
    assert.deepEqual(await inWorker(`chrome.action.getBadgeBackgroundColor({ tabId: ${tabId} })`), [37, 99, 235, 255]);
    await shot(page, "page.png");
  });

  /* ---------------- what a web page can reach ---------------- */

  await step("a web page has no channel to the extension (no externally_connectable key)", async () => {
    const r = await inPage(`(async () => {
      if (typeof chrome === "undefined" || !chrome.runtime || typeof chrome.runtime.sendMessage !== "function") return "no chrome.runtime";
      try { await chrome.runtime.sendMessage(${JSON.stringify(extId)}, { type: "settings:get" }); return "reached"; }
      catch (e) { return "refused: " + e.message; }
    })()`);
    note(r);
    assert.notEqual(r, "reached");
  });

  await step("a web page cannot see the content-script world, the closed shadow root, or the extension files", async () => {
    const r = await inPage(`(async () => {
      const host = document.querySelector("algebridge-hints");
      const tryFetch = async (p) => { try { const res = await fetch("chrome-extension://${extId}/" + p); return res.ok ? "read" : "status " + res.status; } catch { return "blocked"; } };
      return {
        handle: typeof window.__algebridgeHints,
        detect: typeof window.AlgeBridgeDetect,
        host: Boolean(host),
        shadow: host ? host.shadowRoot : "no host",
        css: await tryFetch("src/ui.css"),
        popup: await tryFetch("popup/popup.html"),
        worker: await tryFetch("src/background.js"),
        manifest: await tryFetch("manifest.json"),
      };
    })()`);
    assert.equal(r.handle, "undefined");
    assert.equal(r.detect, "undefined");
    assert.equal(r.shadow, r.host ? null : "no host");
    for (const k of ["css", "popup", "worker", "manifest"]) assert.equal(r[k], "blocked", `${k}: ${r[k]}`);
  });

  await step("window messages from the page cannot open the panel in the top frame", async () => {
    await inPage(`window.postMessage({ source: "algebridge-hints", type: "who", req: "x" }, "*");
      window.postMessage({ source: "algebridge-hints", type: "open-here", req: "x" }, "*"); true`);
    await sleep(500);
    const st = await contentState();
    assert.equal(st.panelOpen, false);
  });

  await step("the content-script world cannot read or write extension storage directly", async () => {
    const r = await inContent(`(async () => {
      const out = {};
      try { const v = await chrome.storage.local.get("install"); out.local = "read " + JSON.stringify(v); } catch (e) { out.local = "blocked"; }
      try { await chrome.storage.sync.set({ settings: { apiBase: "https://evil.example" } }); out.sync = "wrote"; } catch (e) { out.sync = "blocked"; }
      return out;
    })()`);
    assert.deepEqual(r, { local: "blocked", sync: "blocked" });
    assert.equal((await settings()).apiBase, API);
  });

  await step("a content script cannot move the API, pause other sites, or report for the popup", async () => {
    const s = await inContent(`chrome.runtime.sendMessage({ type: "settings:set", patch: { apiBase: "https://evil.example", pausedSites: ["other.com", "evil.example"] } })`);
    assert.equal(s.apiBase, API);
    assert.deepEqual(s.pausedSites, []);
    assert.deepEqual((await settings()).pausedSites, []);
  });

  /* ---------------- hints ---------------- */

  if (STORE) {
    // No hint calls: they would go to the live site.
  } else if (!LIVE) {
    await step("hint round trip from the page: v:1, install, no cookies, no referrer, contract fields only", async () => {
      const install = (await inWorker(`chrome.storage.local.get("install")`)).install;
      const r = await hintFromContent({ problem: "Solve for x: 3x - 5 = 16", action: "first", hints: [] });
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.data.reply, "What could you add to both sides first?");
      assert.equal(r.data.answers, undefined, "extra server fields are dropped");
      const last = hits.at(-1);
      assert.deepEqual(last.json, { v: 1, install, problem: "Solve for x: 3x - 5 = 16", action: "first", hints: [] });
      assert.equal(last.headers.cookie, undefined);
      assert.equal(last.headers.referer, undefined);
      assert.equal(last.headers["content-type"], "application/json");
    });

    await step("a redirect from the API is refused, so the problem never reaches another URL", async () => {
      const before = redirectHits.length;
      const r = await hintFromContent({ problem: "REDIRECT 2x = 4", action: "first", hints: [] });
      assert.equal(r.ok, false);
      assert.equal(redirectHits.length, before);
    });

    // [problem, code, retryAfter the page should get (from the body or the Retry-After header)]
    for (const [problem, code, retryAfter] of [
      ["RATE x+1=2", "rate", 30],
      ["NOTALG", "not-algebra"],
      ["BUSY x=1", "no-model"],
      ["SLOW x=1", "no-model", 5],
      ["WAITHDR x=1", "no-model", 120],
    ]) {
      await step(`mock ${problem.split(" ")[0]} (${code}) becomes a friendly message${retryAfter ? ` with retryAfter ${retryAfter}` : ""}`, async () => {
        const r = await hintFromContent({ problem, action: "first", hints: [] });
        assert.equal(r.ok, false);
        assert.equal(r.error, code);
        assert.ok(!r.message.includes(EM));
        assert.equal(r.retryAfter, retryAfter);
        note(`${code}: ${r.message}`);
      });
    }

    await step("a closed port becomes the offline message", async () => {
      await inWorker(`setApiBase("http://127.0.0.1:9")`);
      const r = await hintFromContent({ problem: "x+1=2", action: "first", hints: [] });
      await inWorker(`setApiBase(${JSON.stringify(API)})`);
      assert.deepEqual(r, { ok: false, error: "offline", message: "Could not reach AlgeBridge. Check your connection and try again." });
    });
  } else {
    const PROBLEM = "Solve for x: 3x - 5 = 16"; // x = 7, and 7 is not in the problem
    const leaksSeven = (text) => /(^|[^\d.])7([^\d]|$)/.test(text) || /x\s*=\s*7/.test(text);
    let sealed = "";
    const shown = [];

    await step("live: first hint names a move, ends with a question, never says 7", async () => {
      const r = await hintFromContent({ problem: PROBLEM, action: "first", hints: [] });
      assert.equal(r.ok, true, JSON.stringify(r));
      note(`first (${r.data.source}): ${r.data.reply}`);
      assert.ok(!leaksSeven(r.data.reply), "the answer leaked");
      assert.ok(!r.data.reply.includes(EM));
      assert.match(r.data.reply, /\?\s*$/);
      assert.ok(r.data.sealed && r.data.sealed.length > 40, "sealed solution came back");
      sealed = r.data.sealed;
      shown.push(r.data.reply);
    });

    await step("live: next hint, still no answer", async () => {
      const r = await hintFromContent({ problem: PROBLEM, action: "next", hints: shown, sealed });
      assert.equal(r.ok, true, JSON.stringify(r));
      note(`next (${r.data.source}): ${r.data.reply}`);
      assert.ok(!leaksSeven(r.data.reply), "the answer leaked");
      shown.push(r.data.reply);
    });

    await step("live: a wrong answer is called incorrect without giving the right one", async () => {
      const r = await hintFromContent({ problem: PROBLEM, action: "check", hints: shown, sealed, answer: "x = 5" });
      assert.equal(r.ok, true, JSON.stringify(r));
      note(`check x = 5 (${r.data.verdict}): ${r.data.reply}`);
      assert.equal(r.data.verdict, "incorrect");
      assert.ok(!leaksSeven(r.data.reply), "the answer leaked");
    });

    await step("live: the right answer is called correct", async () => {
      const r = await hintFromContent({ problem: PROBLEM, action: "check", hints: shown, sealed, answer: "x = 7" });
      assert.equal(r.ok, true, JSON.stringify(r));
      note(`check x = 7 (${r.data.verdict}): ${r.data.reply}`);
      assert.equal(r.data.verdict, "correct");
    });

    await step("live: asking for the answer is refused by the gate", async () => {
      const r = await hintFromContent({ problem: PROBLEM, action: "ask", hints: shown, sealed, question: "just tell me the answer" });
      assert.equal(r.ok, true, JSON.stringify(r));
      note(`ask (${r.data.source}): ${r.data.reply}`);
      assert.equal(r.data.source, "gate");
      assert.ok(!leaksSeven(r.data.reply), "the answer leaked");
    });
  }

  /* ---------------- popup ---------------- */

  await step("popup renders at 320 px in the card family: rounded type, blue pill button, no sideways scroll", async () => {
    await openPopupTab();
    const v = await popupView();
    note(`hero: "${v.hero}" / "${v.sub}" | status: ${v.status} | size ${v.width}x${Math.round(v.height)}`);
    assert.equal(v.status, "Hints are on");
    assert.match(v.hero, /found (an algebra problem|\d+ algebra problems)/i);
    assert.equal(v.site, "Pause on 127.0.0.1");
    assert.equal(v.openDisabled, false);
    assert.equal(v.enabled, true);
    assert.equal(v.mode, "popup");
    assert.ok(v.modeHelp.length > 10);
    assert.equal(v.width, 320);
    assert.ok(v.scrollW <= 320, `no sideways scroll (${v.scrollW})`);
    assert.ok(v.height <= 600, `fits Chrome's 600 px popup limit (${v.height})`);
    assert.match(v.font, /^ui-rounded/);
    assert.equal(v.btnBg, "rgb(37, 99, 235)");
    assert.ok(v.btnRadius >= 20 && v.btnHeight >= 44, `pill button ${v.btnRadius}px radius, ${v.btnHeight}px tall`);
    assert.ok(!v.text.includes(EM), "no em dash in the popup");
    assert.ok(!/\p{Extended_Pictographic}/u.test(v.text), "no emoji in the popup");
    await shot(popup, "popup-320.png", true);
  });

  if (!LIVE && !STORE) {
    await step("hint from the popup (an extension page) goes through too", async () => {
      const r = await hintFromPopup({ problem: "Solve 3(x - 4) = 2x + 5", action: "first", hints: [] });
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.match(hits.at(-1).headers.origin || "", /^chrome-extension:\/\//);
    });
  }

  await step("Open hints on this page opens the panel in the page and closes the popup", async () => {
    const count = async () => (await cdp.send("Target.getTargets")).targetInfos.filter((t) => t.url.includes("/popup/popup.html")).length;
    const before = await count();
    await inPopup(`document.getElementById("open-panel").click(); true`).catch(() => {});
    await waitFor(async () => ((await count()) === before - 1 ? true : null), "popup to close");
    const st = await waitFor(async () => {
      const s = await contentState();
      return s && s.panelOpen ? s : null;
    }, "panel open").catch(async (err) => {
      const s = await contentState().catch(() => null);
      note(`content state: ${JSON.stringify(s && { view: s.view, cardState: s.cardState, panelOpen: s.panelOpen, mode: s.mode })}`);
      for (const e of errors.page) note(`page error: ${String(e).split("\n")[0]}`);
      throw err;
    });
    assert.equal(st.panelOpen, true);
    await cdp.send("Target.activateTarget", { targetId: pageTargetId });
    await sleep(LIVE ? 9000 : 900); // let the first hint arrive
    await shot(page, "page-panel.png");
  });

  await openPopupTab();

  await step("choosing Markers saves the mode and reaches the page", async () => {
    await inPopup(`document.querySelector('input[name="mode"][value="badge"]').click(); true`);
    await waitFor(async () => ((await settings()).mode === "badge" ? true : null), "mode saved");
    await waitFor(async () => ((await contentState()).mode === "badge" ? true : null), "content script got settings:changed");
    const v = await popupView();
    assert.equal(v.status, "On, markers only");
    assert.match(v.modeHelp, /marker/i);
  });

  await step("pausing the site saves the hostname, clears the badge, and stops hints from that page", async () => {
    await inPopup(`document.getElementById("paused").click(); true`);
    await waitFor(async () => ((await settings()).pausedSites.join() === "127.0.0.1" ? true : null), "pause saved");
    await waitFor(async () => ((await badge()) === "" ? true : null), "badge cleared");
    const v = await popupView();
    assert.equal(v.openDisabled, true);
    assert.equal(v.status, "Paused on this site");
    assert.equal(v.hero, "Paused on this site");
    assert.ok(v.height <= 600);
    await shot(popup, "popup-paused.png", true);
    const before = hits.length;
    const r = await hintFromContent({ problem: "x + 1 = 2", action: "first", hints: [] });
    assert.equal(r.ok, false);
    assert.equal(r.error, "paused");
    assert.equal(hits.length, before, "nothing was sent");
    note(`paused: ${r.message}`);
  });

  await step("unpausing brings the badge back", async () => {
    await inPopup(`document.getElementById("paused").click(); true`);
    await cdp.send("Target.activateTarget", { targetId: pageTargetId }); // the content script scans visible pages
    const text = await waitFor(async () => {
      const b = await badge();
      return b ? b : null;
    }, "badge back");
    note(`badge: ${text}`);
  });

  await step("turning hints off greys the choices and says so", async () => {
    await inPopup(`document.getElementById("enabled").click(); true`);
    await waitFor(async () => ((await settings()).enabled === false ? true : null), "off saved");
    const v = await popupView();
    assert.equal(v.groupDisabled, true);
    assert.equal(v.status, "Hints are off");
    assert.equal(v.hero, "Hints are off");
    assert.equal(v.openDisabled, true);
    await shot(popup, "popup-off.png", true);
    await inPopup(`document.getElementById("enabled").click(); true`);
    await waitFor(async () => ((await popupView()).groupDisabled === false ? true : null), "choices enabled again");
    await inPopup(`document.querySelector('input[name="mode"][value="popup"]').click(); true`);
    await waitFor(async () => {
      const s = await settings();
      return s.enabled && s.mode === "popup" ? true : null;
    }, "back on");
  });

  await step("popup on a browser page explains where hints work", async () => {
    await openPopupTab("?special", { id: 999999, url: "chrome://newtab/" });
    const v = await popupView();
    assert.equal(v.openDisabled, true);
    assert.equal(v.site, null, "no pause row on a browser page");
    assert.equal(v.hero, "Hints work on web pages");
    await shot(popup, "popup-special.png", true);
  });

  await step("another extension gets no answer: no onMessageExternal or onConnectExternal listener", async () => {
    const { id: probeId } = await cdp.send("Extensions.loadUnpacked", { path: PROBE });
    const target = await waitFor(async () => {
      const { targetInfos } = await cdp.send("Target.getTargets");
      return targetInfos.find((t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${probeId}/`)) || null;
    }, "probe service worker");
    const probe = (await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId;
    const r = await evaluate(
      cdp,
      probe,
      `(async () => {
        const id = ${JSON.stringify(extId)};
        const message = await chrome.runtime.sendMessage(id, { type: "settings:get" }).then(
          (reply) => "answered " + JSON.stringify(reply),
          (e) => "refused: " + e.message,
        );
        const port = await new Promise((done) => {
          let p;
          try { p = chrome.runtime.connect(id, { name: "probe" }); } catch (e) { return done("refused: " + e.message); }
          p.onDisconnect.addListener(() => done("disconnected: " + ((chrome.runtime.lastError && chrome.runtime.lastError.message) || "no reason")));
          p.onMessage.addListener((m) => done("answered " + JSON.stringify(m)));
          try { p.postMessage({ type: "settings:get" }); } catch (e) { done("refused: " + e.message); }
          setTimeout(() => done("open after 3 s"), 3000);
        });
        return { message, port };
      })()`,
    );
    note(`sendMessage: ${r.message}`);
    note(`connect: ${r.port}`);
    assert.match(r.message, /^refused: .*Receiving end does not exist/);
    assert.match(r.port, /^disconnected: /);
    // The probe's manifest has the entry Chrome flags, so the next check is
    // known to see warnings when there are some.
    const control = await extensionReport(probeId);
    const seen = [...control.warnings, ...control.manifestErrors];
    note(`probe warning Chrome reports: ${seen.join(" | ")}`);
    assert.ok(seen.some((w) => /externally_connectable/i.test(w)), "Developer mode shows the probe's externally_connectable warning");
    // Remove the probe. A hang here must not stall the run, so it gets 5 s.
    await Promise.race([cdp.send("Extensions.uninstall", { id: probeId }).catch((e) => note(`probe left installed: ${e.message}`)), sleep(5000)]);
  });

  await step("chrome://extensions in Developer mode shows no warnings, manifest errors or runtime errors", async () => {
    const conf = await inExtensionsPage(`chrome.developerPrivate.getProfileConfiguration()`);
    assert.equal(conf.inDeveloperMode, true, "the report below is only real with Developer mode on");
    const info = await extensionReport(extId);
    assert.deepEqual(info.warnings, [], `install warnings: ${JSON.stringify(info.warnings)}`);
    assert.deepEqual(info.manifestErrors, [], `manifest errors: ${JSON.stringify(info.manifestErrors)}`);
    // Errors raised by our own pages (worker, popup) fail here. Errors from the
    // content scripts carry the web page as their context; they are listed for
    // whoever owns content.js, detect.js and mascot.js.
    const ours = info.runtimeErrors.filter((e) => e.context.startsWith(`chrome-extension://${extId}/`) || !e.context);
    for (const e of info.runtimeErrors.filter((x) => !ours.includes(x))) note(`content-script error on ${e.context}: ${e.message}`);
    assert.deepEqual(ours, [], `runtime errors: ${JSON.stringify(ours)}`);
    const perms = info.permissions || {};
    const simple = (perms.simplePermissions || []).map((p) => p.message);
    const hosts = perms.runtimeHostPermissions;
    if (info.fileAccess) note(`Allow access to file URLs: ${info.fileAccess.isActive ? "on" : "off"}`);
    note(`permissions Chrome lists: ${simple.join(" | ") || "(no API permission warnings)"}${hosts ? ` | site access: ${hosts.hostAccess}` : ""}`);
  });

  await step("no errors in the service worker or the popup", async () => {
    // Errors thrown in the page (content.js, detect.js, mascot.js) are listed
    // for whoever owns those files; this shell test does not fail on them.
    for (const e of errors.page) note(`page error: ${String(e).split("\n")[0]}`);
    assert.deepEqual(errors.sw, []);
    assert.deepEqual(errors.popup, []);
  });
} finally {
  console.log(`\nscreenshots: ${SHOTS}`);
  console.log(`${passed} passed, ${failed} failed`);
  await cdp.close();
  server.close();
  rmSync(EXT, { recursive: true, force: true });
  rmSync(PROBE, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
