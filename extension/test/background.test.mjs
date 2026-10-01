// Unit tests for extension/src/background.js, run in Node with an in-memory
// chrome.* mock. No browser, no network.
//
//   node extension/test/background.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const EXT = join(here, "..");
const source = readFileSync(join(EXT, "src/background.js"), "utf8");
const DEV_MANIFEST = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8"));
// What pack.mjs ships: the same manifest without the localhost host permissions.
const STORE_MANIFEST = {
  ...DEV_MANIFEST,
  host_permissions: DEV_MANIFEST.host_permissions.filter((p) => !/localhost|127\.0\.0\.1|\[::1\]/.test(p)),
};
const LIVE = "https://learn.algebridge.org";

function makeArea(name, bus) {
  const data = {};
  const area = {
    _data: data,
    _access: null,
    async get(keys) {
      if (keys === null || keys === undefined) return structuredClone(data);
      const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in data) out[k] = structuredClone(data[k]);
      return out;
    },
    async set(obj) {
      const changes = {};
      for (const [k, v] of Object.entries(obj)) {
        changes[k] = { oldValue: data[k], newValue: structuredClone(v) };
        data[k] = structuredClone(v);
      }
      setTimeout(() => bus.forEach((fn) => fn(changes, name)), 0);
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete data[k];
    },
    async setAccessLevel(opts) {
      area._access = opts && opts.accessLevel;
    },
  };
  return area;
}

function makeEnv({ manifest = DEV_MANIFEST } = {}) {
  const changeBus = [];
  const listeners = { message: [], installed: [], menuClick: [], command: [], removed: [] };
  const sent = [];
  const badges = {};
  const menus = [];
  let tabs = [
    { id: 1, active: true, url: "https://example.com/hw" },
    { id: 2, active: false, url: "chrome://newtab" },
  ];
  const receivers = new Set([1]); // tabs with a content script
  const env = {
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  };
  const chrome = {
    runtime: {
      id: "testid",
      lastError: undefined,
      onMessage: { addListener: (fn) => listeners.message.push(fn) },
      onInstalled: { addListener: (fn) => listeners.installed.push(fn) },
      onStartup: { addListener: (fn) => (listeners.startup = fn) },
      getURL: (p) => `chrome-extension://testid/${String(p).replace(/^\//, "")}`,
      getManifest: () => structuredClone(manifest),
    },
    storage: {
      sync: makeArea("sync", changeBus),
      local: makeArea("local", changeBus),
      session: makeArea("session", changeBus),
      onChanged: { addListener: (fn) => changeBus.push(fn) },
    },
    tabs: {
      query: async (q) => (q && q.active ? tabs.filter((t) => t.active) : tabs.slice()),
      sendMessage: async (tabId, msg, opts) => {
        sent.push({ tabId, msg: structuredClone(msg), frameId: opts && opts.frameId });
        if (!receivers.has(tabId)) throw new Error("Could not establish connection. Receiving end does not exist.");
        return undefined;
      },
      onRemoved: { addListener: (fn) => listeners.removed.push(fn) },
    },
    action: {
      setBadgeText: async ({ tabId, text }) => ((badges[tabId] ||= {}).text = text),
      setBadgeBackgroundColor: async ({ tabId, color }) => ((badges[tabId] ||= {}).bg = color),
      setBadgeTextColor: async ({ tabId, color }) => ((badges[tabId] ||= {}).fg = color),
    },
    contextMenus: {
      removeAll: (cb) => {
        menus.length = 0;
        cb && cb();
      },
      create: (props, cb) => {
        menus.push(props);
        cb && cb();
      },
      onClicked: { addListener: (fn) => listeners.menuClick.push(fn) },
    },
    commands: { onCommand: { addListener: (fn) => listeners.command.push(fn) } },
  };
  const ctx = {
    chrome,
    fetch: (...args) => env.fetchImpl(...args),
    AbortSignal,
    crypto: globalThis.crypto,
    URL,
    console,
    setTimeout,
    clearTimeout,
    structuredClone,
    module: { exports: {} },
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: "background.js" });
  return { env, ctx, api: ctx.module.exports, chrome, listeners, sent, badges, menus, receivers, setTabs: (t) => (tabs = t) };
}

// Objects from the vm realm have other prototypes; Chrome structured-clones
// messages anyway, so compare plain JSON copies.
const plain = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// A content script in the top frame of tab 1, and the toolbar popup.
const PAGE = { id: "testid", tab: { id: 1, url: "https://example.com/hw" }, frameId: 0, url: "https://example.com/hw", documentId: "docA" };
const POPUP = { id: "testid", url: "chrome-extension://testid/popup/popup.html" };
const frame = (tabId, frameId, url, documentId) => ({ id: "testid", tab: { id: tabId, url: "https://example.com/hw" }, frameId, url, documentId });

function send(h, msg, sender = PAGE) {
  return new Promise((resolve, reject) => {
    let kept = false;
    const timer = setTimeout(() => reject(new Error(`no response to ${msg && msg.type}`)), 2000);
    for (const fn of h.listeners.message) {
      const r = fn(msg, sender, (res) => {
        clearTimeout(timer);
        resolve(plain(res));
      });
      if (r === true) kept = true;
    }
    if (!kept) {
      clearTimeout(timer);
      resolve("__not_handled__");
    }
  });
}

function jsonResponse(status, body, headers = {}) {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n     ${err && err.stack ? err.stack.split("\n").slice(0, 3).join("\n     ") : err}`);
  }
}

/* ------------------------------------------------------------------ */
/* Install, settings                                                   */
/* ------------------------------------------------------------------ */

await test("onInstalled creates install uuid, stores defaults, makes the menu", async () => {
  const h = makeEnv();
  for (const fn of h.listeners.installed) await fn({ reason: "install" });
  const local = h.chrome.storage.local._data;
  assert.match(local.install, /^[0-9a-f-]{36}$/);
  assert.deepEqual(plain(h.chrome.storage.sync._data.settings), {
    enabled: true,
    mode: "popup",
    pausedSites: [],
    apiBase: LIVE,
  });
  assert.equal(h.menus.length, 1);
  assert.equal(h.menus[0].title, "Get an AlgeBridge hint for this");
  assert.deepEqual(plain(h.menus[0].contexts), ["selection"]);
  // second onInstalled (update) does not duplicate the menu or change the id
  const id = local.install;
  for (const fn of h.listeners.installed) await fn({ reason: "update" });
  assert.equal(h.menus.length, 1);
  assert.equal(h.chrome.storage.local._data.install, id);
});

await test("worker limits local and sync storage to trusted contexts on start", async () => {
  const h = makeEnv();
  await tick();
  assert.equal(h.chrome.storage.local._access, "TRUSTED_CONTEXTS");
  assert.equal(h.chrome.storage.sync._access, "TRUSTED_CONTEXTS");
});

await test("settings:get merges defaults over partial and bad stored values", async () => {
  const h = makeEnv();
  h.chrome.storage.sync._data.settings = { mode: "weird", pausedSites: ["Example.COM", 5, "example.com", ""], enabled: "yes" };
  const s = await send(h, { type: "settings:get" });
  assert.deepEqual(s, { enabled: true, mode: "popup", pausedSites: ["example.com"], apiBase: LIVE });
});

await test("settings:set from the popup applies the patch, ignores apiBase, broadcasts settings:changed", async () => {
  const h = makeEnv();
  const s = await send(h, { type: "settings:set", patch: { mode: "badge", apiBase: "https://evil.example", pausedSites: ["a.com"] } }, POPUP);
  assert.equal(s.mode, "badge");
  assert.equal(s.apiBase, LIVE);
  assert.deepEqual(s.pausedSites, ["a.com"]);
  await tick(20);
  const bc = h.sent.filter((x) => x.msg.type === "settings:changed");
  assert.equal(bc.length, 2, "sent to both tabs (one rejects quietly)");
  assert.equal(bc[0].msg.settings.mode, "badge");
});

await test("concurrent settings:set calls do not overwrite each other", async () => {
  const h = makeEnv();
  await Promise.all([
    send(h, { type: "settings:set", patch: { mode: "off" } }, POPUP),
    send(h, { type: "settings:set", patch: { enabled: false } }, POPUP),
  ]);
  const s = h.chrome.storage.sync._data.settings;
  assert.equal(s.mode, "off");
  assert.equal(s.enabled, false);
});

await test("settings:set from a content script can pause only its own site", async () => {
  const h = makeEnv();
  await send(h, { type: "settings:set", patch: { pausedSites: ["kept.org"] } }, POPUP);
  // Tries to pause two other sites, drop kept.org, and move the API.
  const s = await send(h, {
    type: "settings:set",
    patch: { pausedSites: ["www.example.com", "other.com", "evil.example"], apiBase: "http://localhost:9999", mode: "badge" },
  });
  assert.deepEqual(s.pausedSites, ["kept.org", "www.example.com"]);
  assert.equal(s.apiBase, LIVE);
  assert.equal(s.mode, "badge", "display mode is the student's own choice from the panel");
  // And can unpause its own site without touching the others.
  const s2 = await send(h, { type: "settings:set", patch: { pausedSites: [] } });
  assert.deepEqual(s2.pausedSites, ["kept.org"]);
});

await test("setApiBase helper accepts localhost in the dev build, rejects other hosts", async () => {
  const h = makeEnv();
  assert.equal(await h.ctx.self.setApiBase("http://localhost:3000/"), "http://localhost:3000");
  assert.equal(await h.ctx.self.setApiBase("https://evil.example"), LIVE);
  assert.equal(await h.ctx.self.setApiBase("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  assert.equal(await h.ctx.self.setApiBase(), LIVE);
});

await test("cleanApiBase only accepts hosts the running manifest lists", async () => {
  const dev = makeEnv().api;
  const store = makeEnv({ manifest: STORE_MANIFEST }).api;
  for (const api of [dev, store]) {
    assert.equal(api.cleanApiBase("https://learn.algebridge.org/"), LIVE);
    assert.equal(api.cleanApiBase("http://learn.algebridge.org"), LIVE, "plain http to the live site is refused");
    assert.equal(api.cleanApiBase("https://other.algebridge.org"), LIVE, "not in host_permissions");
    assert.equal(api.cleanApiBase("https://learn.algebridge.org.evil.example"), LIVE);
    assert.equal(api.cleanApiBase("https://user:pw@learn.algebridge.org"), LIVE);
    assert.equal(api.cleanApiBase("javascript:alert(1)"), LIVE);
    assert.equal(api.cleanApiBase(42), LIVE);
  }
  assert.equal(dev.cleanApiBase("http://localhost:3216"), "http://localhost:3216");
  assert.equal(dev.cleanApiBase("http://127.0.0.1:8080/x"), "http://127.0.0.1:8080");
  assert.equal(store.cleanApiBase("http://localhost:3216"), LIVE, "store build has no localhost");
  assert.equal(store.cleanApiBase("http://127.0.0.1:8080"), LIVE);
});

await test("store build sends hints to the live site even if storage holds a localhost apiBase", async () => {
  const h = makeEnv({ manifest: STORE_MANIFEST });
  h.chrome.storage.sync._data.settings = { enabled: true, mode: "popup", pausedSites: [], apiBase: "http://localhost:3000" };
  assert.equal(await h.ctx.self.setApiBase("http://localhost:3000"), LIVE);
  let url = null;
  h.env.fetchImpl = async (u) => {
    url = u;
    return jsonResponse(200, { reply: "ok?" });
  };
  await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
  assert.equal(url, `${LIVE}/api/extension/hint`);
});

await test("patternCovers handles ports and wildcard subdomains, never a bare *", async () => {
  const { patternCovers } = makeEnv().api;
  const u = (s) => new URL(s);
  assert.equal(patternCovers("http://localhost/*", u("http://localhost:3216/")), true);
  assert.equal(patternCovers("http://localhost:3000/*", u("http://localhost:3216/")), false);
  assert.equal(patternCovers("http://localhost:3000/*", u("http://localhost:3000/")), true);
  assert.equal(patternCovers("https://*.algebridge.org/*", u("https://learn.algebridge.org/")), true);
  assert.equal(patternCovers("https://*.algebridge.org/*", u("https://evilalgebridge.org/")), false);
  assert.equal(patternCovers("*://*/*", u("https://evil.example/")), false);
  assert.equal(patternCovers("<all_urls>", u("https://evil.example/")), false);
});

/* ------------------------------------------------------------------ */
/* Sender checks                                                       */
/* ------------------------------------------------------------------ */

await test("messages from another extension or an unknown context are not handled", async () => {
  const h = makeEnv();
  for (const sender of [
    { id: "otherext", tab: { id: 1 }, url: "https://example.com/hw" },
    { tab: { id: 1 }, url: "https://example.com/hw" }, // no id at all
    { id: "testid", url: "https://example.com/hw" }, // a web url but no tab
    { id: "testid", tab: { id: 1 }, url: "chrome://settings" },
    { id: "testid", tab: { id: 1 }, url: "chrome-extension://otherext/page.html" },
    null,
  ]) {
    assert.equal(await send(h, { type: "settings:get" }, sender), "__not_handled__", JSON.stringify(sender));
  }
});

await test("problems:count is only taken from a content script in a tab", async () => {
  const h = makeEnv();
  assert.equal(await send(h, { type: "problems:count", count: 5 }, POPUP), "__not_handled__");
  assert.equal(h.badges[1], undefined);
});

await test("unknown and prototype-named message types are not handled", async () => {
  const h = makeEnv();
  for (const type of ["nope", "__proto__", "constructor", "toString", "hasOwnProperty"]) {
    assert.equal(await send(h, { type }), "__not_handled__", type);
  }
  assert.equal(await send(h, null), "__not_handled__");
  assert.equal(await send(h, ["hint"]), "__not_handled__");
  assert.equal(await send(h, { type: 5 }), "__not_handled__");
});

await test("senderKind tells the popup from a content script", async () => {
  const { senderKind } = makeEnv().api;
  assert.equal(senderKind(POPUP), "extension");
  assert.equal(senderKind({ ...POPUP, tab: { id: 9 } }), "extension", "popup opened in a tab");
  assert.equal(senderKind(PAGE), "content");
  assert.equal(senderKind({ ...PAGE, url: "file:///Users/x/hw.html" }), "content");
  assert.equal(senderKind({ ...PAGE, id: "x" }), null);
});

/* ------------------------------------------------------------------ */
/* Badge and stats                                                     */
/* ------------------------------------------------------------------ */

await test("problems:count sets per-tab badge in brand blue, sums frames, clears on new page", async () => {
  const h = makeEnv();
  await send(h, { type: "problems:count", count: 3 });
  assert.equal(h.badges[1].text, "3");
  assert.equal(h.badges[1].bg, "#2563eb");
  assert.equal(h.badges[1].fg, "#ffffff");
  await send(h, { type: "problems:count", count: 2 }, frame(1, 7, "https://forms.example/q", "docF"));
  assert.equal(h.badges[1].text, "5");
  // same frame updates replace, not add
  await send(h, { type: "problems:count", count: 1 }, frame(1, 7, "https://forms.example/q", "docF"));
  assert.equal(h.badges[1].text, "4");
  // a new top document starts a fresh total
  await send(h, { type: "problems:count", count: 0 }, frame(1, 0, "https://example.com/next", "docB"));
  assert.equal(h.badges[1].text, "");
  await send(h, { type: "problems:count", count: 250 }, frame(1, 0, "https://example.com/next", "docB"));
  assert.equal(h.badges[1].text, "99+");
});

await test("problems:count ignores junk counts and caps the frames kept per tab", async () => {
  const h = makeEnv();
  await send(h, { type: "problems:count", count: "lots" });
  assert.equal(h.badges[1].text, "");
  await send(h, { type: "problems:count", count: -4 });
  assert.equal(h.badges[1].text, "");
  for (let f = 1; f <= 80; f++) await send(h, { type: "problems:count", count: 1 }, frame(1, f, "https://ads.example/x", `d${f}`));
  const rec = h.chrome.storage.session._data["counts:1"];
  assert.ok(Object.keys(rec.frames).length <= 64, `frames kept: ${Object.keys(rec.frames).length}`);
});

await test("a subframe that reports before the top frame still counts", async () => {
  const h = makeEnv();
  await send(h, { type: "problems:count", count: 4 }, frame(1, 9, "https://quiz.example/x", "sub1"));
  assert.equal(h.badges[1].text, "4");
  await send(h, { type: "problems:count", count: 0 }, frame(1, 0, "https://example.com/hw", "top1"));
  assert.equal(h.badges[1].text, "4");
});

await test("badge hides when off, in 'only when I ask' mode, or on a paused site", async () => {
  const h = makeEnv();
  await send(h, { type: "problems:count", count: 2 });
  assert.equal(h.badges[1].text, "2");
  await send(h, { type: "settings:set", patch: { mode: "off" } }, POPUP);
  await tick(20);
  assert.equal(h.badges[1].text, "");
  await send(h, { type: "settings:set", patch: { mode: "badge" } }, POPUP);
  await tick(20);
  assert.equal(h.badges[1].text, "2");
  await send(h, { type: "settings:set", patch: { pausedSites: ["example.com"] } }, POPUP);
  await tick(20);
  assert.equal(h.badges[1].text, "");
  await send(h, { type: "settings:set", patch: { pausedSites: [], enabled: false } }, POPUP);
  await tick(20);
  assert.equal(h.badges[1].text, "");
  await send(h, { type: "settings:set", patch: { enabled: true } }, POPUP);
  await tick(20);
  assert.equal(h.badges[1].text, "2");
});

await test("paused site matching ignores www. and covers subdomains (same rule as content.js)", async () => {
  const h = makeEnv();
  await send(h, { type: "settings:set", patch: { pausedSites: ["example.com"] } }, POPUP);
  await send(h, { type: "problems:count", count: 3 }, frame(1, 0, "https://www.example.com/a", "d1"));
  assert.equal(h.badges[1].text, "");
  await send(h, { type: "problems:count", count: 3 }, frame(3, 0, "https://docs.example.com/a", "d2"));
  assert.equal(h.badges[3].text, "");
  await send(h, { type: "problems:count", count: 3 }, frame(4, 0, "https://notexample.com/a", "d3"));
  assert.equal(h.badges[4].text, "3");
});

await test("stats:bump counts per day and resets on a new day", async () => {
  const h = makeEnv();
  h.chrome.storage.local._data.stats = { day: "2000-01-01", problemsSeen: 40, hints: 9 };
  await send(h, { type: "stats:bump", key: "problemsSeen" });
  await send(h, { type: "stats:bump", key: "hints" });
  await Promise.all([send(h, { type: "stats:bump", key: "hints" }), send(h, { type: "stats:bump", key: "hints" })]);
  await send(h, { type: "stats:bump", key: "bogus" });
  await send(h, { type: "stats:bump", key: "__proto__" });
  const st = h.chrome.storage.local._data.stats;
  assert.notEqual(st.day, "2000-01-01");
  assert.equal(st.problemsSeen, 1);
  assert.equal(st.hints, 3);
});

/* ------------------------------------------------------------------ */
/* Hints                                                               */
/* ------------------------------------------------------------------ */

await test("hint posts v:1 + install to apiBase/api/extension/hint and returns data", async () => {
  const h = makeEnv();
  h.chrome.storage.local._data.install = "11111111-2222-3333-4444-555555555555";
  let seen = null;
  h.env.fetchImpl = async (url, init) => {
    seen = { url, init, body: JSON.parse(init.body) };
    return jsonResponse(200, { reply: "What could you do to both sides?", sealed: "abc", step: 0, steps: 3, done: false, kind: "linear-equation", level: 1, source: "ai" });
  };
  const r = await send(h, { type: "hint", payload: { problem: "  Solve 2x + 3 = 7  ", action: "first", hints: [] } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { reply: "What could you do to both sides?", sealed: "abc", step: 0, steps: 3, done: false, kind: "linear-equation", level: 1, source: "ai" });
  assert.equal(seen.url, `${LIVE}/api/extension/hint`);
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.init.redirect, "error", "a redirect can never carry the problem elsewhere");
  assert.equal(seen.init.referrerPolicy, "no-referrer");
  assert.ok(seen.init.signal instanceof AbortSignal);
  assert.deepEqual(seen.body, { v: 1, install: "11111111-2222-3333-4444-555555555555", problem: "Solve 2x + 3 = 7", action: "first", hints: [] });
});

await test("hint passes only the contract fields of a reply to the page", async () => {
  const h = makeEnv();
  h.env.fetchImpl = async () =>
    jsonResponse(200, {
      reply: "Which operation is done to x first?",
      sealed: "has spaces so not base64url",
      step: "0",
      steps: 3,
      kind: "<img src=x>",
      verdict: "maybe",
      source: "ai",
      answers: ["x = 4"],
      solution: { steps: [] },
      debug: "x = 4",
    });
  const r = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { reply: "Which operation is done to x first?", steps: 3, source: "ai" });
});

await test("hint creates an install id lazily if storage lost it or holds junk", async () => {
  for (const stored of [undefined, "", "short", "has spaces in it", 12345]) {
    const h = makeEnv();
    if (stored !== undefined) h.chrome.storage.local._data.install = stored;
    let body = null;
    h.env.fetchImpl = async (url, init) => {
      body = JSON.parse(init.body);
      return jsonResponse(200, { reply: "ok?" });
    };
    await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
    assert.match(body.install, /^[0-9a-f-]{36}$/, `stored ${JSON.stringify(stored)}`);
    assert.equal(h.chrome.storage.local._data.install, body.install);
  }
});

await test("hint uses a localhost apiBase when set in the dev build", async () => {
  const h = makeEnv();
  await h.ctx.self.setApiBase("http://localhost:3000");
  let url = null;
  h.env.fetchImpl = async (u) => {
    url = u;
    return jsonResponse(200, { reply: "ok?" });
  };
  await send(h, { type: "hint", payload: { problem: "x+1=2", action: "next", hints: ["h1"], sealed: "s" } });
  assert.equal(url, "http://localhost:3000/api/extension/hint");
});

await test("hint clamps sizes and passes check answer / ask question", async () => {
  const h = makeEnv();
  const bodies = [];
  h.env.fetchImpl = async (u, init) => {
    bodies.push(JSON.parse(init.body));
    return jsonResponse(200, { reply: "ok", verdict: "incorrect" });
  };
  await send(h, {
    type: "hint",
    payload: { problem: "y".repeat(900), action: "check", answer: "x = 4", hints: Array.from({ length: 20 }, () => "z".repeat(900)), sealed: "S" },
  });
  const b = bodies[0];
  assert.equal(b.problem.length, 600);
  assert.equal(b.hints.length, 12);
  assert.equal(b.hints[0].length, 700);
  assert.equal(b.answer, "x = 4");
  assert.equal(b.sealed, "S");
  await send(h, { type: "hint", payload: { problem: "x+1=2", action: "ask", question: "why subtract?", hints: [] } });
  assert.equal(bodies[1].question, "why subtract?");
  // An unknown action becomes "first"; junk hints are dropped.
  await send(h, { type: "hint", payload: { problem: "x+1=2", action: "answer", hints: [3, null, "  ", "real hint"] } });
  assert.equal(bodies[2].action, "first");
  assert.deepEqual(bodies[2].hints, ["real hint"]);
});

await test("hint drops a sealed value that is not server-made base64url or too long", async () => {
  const h = makeEnv();
  const bodies = [];
  h.env.fetchImpl = async (u, init) => {
    bodies.push(JSON.parse(init.body));
    return jsonResponse(200, { reply: "ok?" });
  };
  for (const sealed of ["a b", "x".repeat(24001), { evil: 1 }, "AbC-_09"]) {
    await send(h, { type: "hint", payload: { problem: "x+1=2", action: "next", hints: [], sealed } });
  }
  assert.deepEqual(bodies.map((b) => b.sealed), [undefined, undefined, undefined, "AbC-_09"]);
});

await test("hint refuses locally when problem, answer or question is missing", async () => {
  const h = makeEnv();
  let calls = 0;
  h.env.fetchImpl = async () => {
    calls++;
    return jsonResponse(200, { reply: "x" });
  };
  const a = await send(h, { type: "hint", payload: { problem: "   ", action: "first", hints: [] } });
  const b = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "check", hints: [] } });
  const c = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "ask", hints: [] } });
  const d = await send(h, { type: "hint" });
  assert.equal(calls, 0);
  for (const r of [a, b, c, d]) {
    assert.equal(r.ok, false);
    assert.equal(r.error, "bad-request");
    assert.ok(r.message.length > 10);
  }
});

await test("a content script on a paused site, or with hints off, sends nothing", async () => {
  const h = makeEnv();
  let calls = 0;
  h.env.fetchImpl = async () => {
    calls++;
    return jsonResponse(200, { reply: "x?" });
  };
  await send(h, { type: "settings:set", patch: { pausedSites: ["example.com"] } }, POPUP);
  const top = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
  assert.equal(top.error, "paused");
  // A frame from another site inside a paused page counts as paused too.
  const sub = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } }, frame(1, 3, "https://quiz.example/q", "s"));
  assert.equal(sub.error, "paused");
  await send(h, { type: "settings:set", patch: { pausedSites: [], enabled: false } }, POPUP);
  const off = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
  assert.equal(off.error, "off");
  assert.equal(calls, 0);
  for (const r of [top, sub, off]) assert.ok(r.message.length > 20);
});

const EM = String.fromCharCode(0x2014);
// [name, response, code, retryAfter the page gets (undefined = none), wait the message names]
const errorCases = [
  ["400", () => jsonResponse(400, { error: "bad-request", message: "server words" }), "bad-request"],
  ["422", () => jsonResponse(422, { error: "not-algebra", message: "server words" }), "not-algebra"],
  ["429 body", () => jsonResponse(429, { error: "rate", message: "server words", retryAfter: 42 }), "rate", 42, "about 42 seconds"],
  ["429 header", () => jsonResponse(429, { error: "rate" }, { "Retry-After": "300" }), "rate", 300, "about 5 minutes"],
  ["429 body wins over header", () => jsonResponse(429, { error: "rate", retryAfter: 60 }, { "Retry-After": "300" }), "rate", 60, "about a minute"],
  ["429 with no wait named", () => jsonResponse(429, { error: "rate", message: "server words" }), "rate", undefined],
  ["503 body (server ran out of time)", () => jsonResponse(503, { error: "no-model", message: "server words", retryAfter: 5 }), "no-model", 5, "about 5 seconds"],
  ["503 header", () => jsonResponse(503, { error: "no-model" }, { "Retry-After": "120" }), "no-model", 120, "about 2 minutes"],
  ["503 with no wait named", () => jsonResponse(503, { error: "no-model", message: "x" }), "no-model", undefined],
  ["503 junk wait", () => jsonResponse(503, { error: "no-model", retryAfter: -4 }, { "Retry-After": "soon" }), "no-model", undefined],
  ["503 huge wait is capped at an hour", () => jsonResponse(503, { error: "no-model", retryAfter: 1e9 }), "no-model", 3600, "about 60 minutes"],
  ["500", () => new Response("oops", { status: 500 }), "server"],
  ["404 html", () => new Response("<html>", { status: 404 }), "server"],
  ["200 bad json", () => new Response("not json", { status: 200 }), "server"],
  ["200 no reply", () => jsonResponse(200, { sealed: "x" }), "server"],
  ["200 array", () => jsonResponse(200, ["reply"]), "server"],
];
for (const [name, make, code, retry, wait] of errorCases) {
  await test(`hint maps ${name} to ${code}`, async () => {
    const h = makeEnv();
    h.env.fetchImpl = async () => make();
    const r = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
    assert.equal(r.ok, false);
    assert.equal(r.error, code);
    assert.ok(typeof r.message === "string" && r.message.length > 10);
    assert.ok(!r.message.includes(EM), "no em dash");
    assert.ok(!r.message.includes("server words"), "server text is not passed through");
    assert.equal(r.retryAfter, retry);
    if (retry === undefined) {
      assert.ok(!("retryAfter" in r), "no retryAfter key when the server named no wait");
      assert.ok(!/\d/.test(r.message), `no made-up wait in "${r.message}"`);
    } else {
      assert.ok(r.message.includes(wait), `"${r.message}" names ${wait}`);
    }
  });
}

await test("readRetryAfter reads seconds or an HTTP date, and nothing else", async () => {
  const { api } = makeEnv();
  const now = Date.parse("2026-10-01T12:00:00Z");
  const res = (h) => new Response("", { status: 503, headers: h === undefined ? {} : { "Retry-After": h } });
  assert.equal(api.readRetryAfter(res("Thu, 01 Oct 2026 12:00:30 GMT"), null, now), 30);
  assert.equal(api.readRetryAfter(res("Thu, 01 Oct 2026 11:59:00 GMT"), null, now), null, "a date in the past");
  assert.equal(api.readRetryAfter(res("2.2"), null, now), 3);
  assert.equal(api.readRetryAfter(res("0"), null, now), null);
  assert.equal(api.readRetryAfter(res("12abc"), null, now), null);
  assert.equal(api.readRetryAfter(res(undefined), { retryAfter: "7" }, now), 7);
  assert.equal(api.readRetryAfter(res(undefined), { retryAfter: 0.2 }, now), 1);
  assert.equal(api.readRetryAfter(res(undefined), "not an object", now), null);
});

await test("waitPhrase reads naturally", async () => {
  const { api } = makeEnv();
  assert.equal(api.waitPhrase(1), "a second");
  assert.equal(api.waitPhrase(5), "about 5 seconds");
  assert.equal(api.waitPhrase(60), "about a minute");
  assert.equal(api.waitPhrase(89), "about a minute");
  assert.equal(api.waitPhrase(300), "about 5 minutes");
});

await test("the worker registers no listener for other extensions", async () => {
  // No externally_connectable key in the manifest means web pages cannot
  // message the extension; other extensions could only reach these two events.
  assert.ok(!/onMessageExternal\s*\.\s*addListener|onConnectExternal\s*\.\s*addListener/.test(source));
  assert.equal(DEV_MANIFEST.externally_connectable, undefined);
});

await test("hint maps network failure to offline with the contract message", async () => {
  const h = makeEnv();
  h.env.fetchImpl = async () => {
    throw new TypeError("Failed to fetch");
  };
  const r = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
  assert.deepEqual(r, { ok: false, error: "offline", message: "Could not reach AlgeBridge. Check your connection and try again." });
});

await test("hint maps a timeout to timeout", async () => {
  const h = makeEnv();
  h.env.fetchImpl = async () => {
    throw new DOMException("signal timed out", "TimeoutError");
  };
  const r = await send(h, { type: "hint", payload: { problem: "x+1=2", action: "first", hints: [] } });
  assert.equal(r.error, "timeout");
});

/* ------------------------------------------------------------------ */
/* Menu, shortcut, tabs                                                */
/* ------------------------------------------------------------------ */

await test("context menu sends open-panel with the selected text to the top frame", async () => {
  const h = makeEnv();
  for (const fn of h.listeners.menuClick) fn({ menuItemId: "algebridge-hint-selection", selectionText: " 3x - 5 = 10 ", frameId: 4 }, { id: 1 });
  await tick(10);
  assert.deepEqual(h.sent.at(-1), { tabId: 1, msg: { type: "open-panel", text: "3x - 5 = 10" }, frameId: 0 });
});

await test("context menu falls back to the clicked frame when the top frame has no script", async () => {
  const h = makeEnv();
  h.receivers.clear();
  for (const fn of h.listeners.menuClick) fn({ menuItemId: "algebridge-hint-selection", selectionText: "x^2=9", frameId: 4 }, { id: 1 });
  await tick(10);
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[1].frameId, 4);
});

await test("keyboard command opens the panel on the active tab", async () => {
  const h = makeEnv();
  for (const fn of h.listeners.command) await fn("open-panel", undefined);
  await tick(10);
  assert.deepEqual(h.sent.at(-1), { tabId: 1, msg: { type: "open-panel" }, frameId: 0 });
  for (const fn of h.listeners.command) await fn("open-panel", { id: 2 });
  await tick(10);
  assert.equal(h.sent.at(-1).tabId, 2);
});

await test("closing a tab clears its stored counts", async () => {
  const h = makeEnv();
  await send(h, { type: "problems:count", count: 3 });
  assert.ok(h.chrome.storage.session._data["counts:1"]);
  for (const fn of h.listeners.removed) fn(1);
  await tick(5);
  assert.equal(h.chrome.storage.session._data["counts:1"], undefined);
});

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

await test("background copy has no em dash and no emoji", async () => {
  assert.ok(!source.includes(EM), "em dash in background.js");
  assert.ok(!/\p{Extended_Pictographic}/u.test(source), "emoji in background.js");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
