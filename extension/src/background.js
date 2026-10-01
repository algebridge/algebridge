/*
 * AlgeBridge Hints, background service worker (classic script, not a module).
 *
 * Jobs:
 *   - routes messages from the content script and the popup (see ROUTES)
 *   - owns settings (chrome.storage.sync "settings") and today's counts
 *     (chrome.storage.local "stats"), and the random install id
 *     (chrome.storage.local "install")
 *   - talks to the AlgeBridge hint API and turns every failure into a friendly
 *     HintResult the page can show as is
 *   - keeps the toolbar badge in step with the number of problems on each tab
 *   - right-click menu and keyboard shortcut that open the hint panel
 *
 * Trust model:
 *   - Web pages cannot reach this worker: the manifest has no
 *     externally_connectable key, so no site can message the extension. Other
 *     extensions can only address onMessageExternal / onConnectExternal, and
 *     this worker registers neither, so their messages find no receiver
 *     (pack.mjs fails the build if either listener ever appears).
 *   - Messages are accepted only from this extension (sender.id). Extension
 *     pages (the popup) may do everything below. Content scripts read untrusted
 *     pages, so they get less: they can ask for hints, read settings, report
 *     counts and bump stats, and change only the display mode, the on switch and
 *     the pause for the site they run on. Nothing can change the API base.
 *   - chrome.storage.local and .sync are limited to extension pages and this
 *     worker (setAccessLevel), so a content script cannot read the install id
 *     or write settings behind the worker's back.
 *   - The API base must match a host_permissions entry of the manifest that is
 *     running. The store build has only https://learn.algebridge.org/*, so a
 *     localhost value left in storage falls back to the live site.
 *
 * A service worker can be stopped at any moment, so nothing that has to live
 * longer than one event is kept in a global. Per-tab badge counts live in
 * chrome.storage.session, everything else in sync or local storage.
 */
"use strict";

const DEFAULT_API_BASE = "https://learn.algebridge.org";
const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  mode: "popup",
  pausedSites: Object.freeze([]),
  apiBase: DEFAULT_API_BASE,
});
const MODES = ["popup", "badge", "off"];
const ACTIONS = ["first", "next", "concept", "check", "ask"];
const STAT_KEYS = ["problemsSeen", "hints"];
const VERDICTS = ["correct", "incorrect", "unsure"];
const SOURCES = ["ai", "local", "gate"];

const BRAND_BLUE = "#2563eb";
const HINT_TIMEOUT_MS = 30000;
const MENU_ID = "algebridge-hint-selection";
const COUNT_PREFIX = "counts:";

// Request limits, matched to the API so a request is never refused for size.
const LIMITS = Object.freeze({
  problem: 600,
  hints: 12,
  hint: 700,
  answer: 120,
  question: 300,
  sealed: 24000,
  pausedSites: 500,
  reply: 2000,
});
const SEALED_RE = /^[A-Za-z0-9_-]+$/;
const INSTALL_RE = /^[A-Za-z0-9_-]{8,100}$/;

// HintResult error codes, the same words content.js uses:
//   bad-request, not-algebra, server, offline, timeout, unknown
//   rate       too many requests; retryAfter (seconds) when the server names a wait
//   no-model   no model answered; retryAfter when the server names a wait
//   off        hints are turned off (settings.enabled is false)
//   paused     the page's site, or its tab's top site, is in pausedSites
// "off" and "paused" come back before anything leaves the browser. The display
// mode "off" ("Only when I ask") is not an error: hints still work from the panel.
const MESSAGES = Object.freeze({
  offline: "Could not reach AlgeBridge. Check your connection and try again.",
  timeout: "That took longer than it should. Try again in a moment.",
  badRequest: "AlgeBridge could not read that problem. Try selecting just the problem and ask again.",
  notAlgebra: "This does not look like an algebra problem. Try selecting just the equation or expression.",
  noModel: "The hint helper is busy right now. Try again in a minute.",
  busyLead: "The hint helper is busy right now.",
  rate: "That is a lot of hints in a short time. Take a short break, then try again.",
  rateLead: "That is a lot of hints in a short time.",
  server: "Something went wrong on our side. Try again in a minute.",
  needProblem: "Pick a problem first, then ask for a hint.",
  needAnswer: "Type your answer first, then check it.",
  needQuestion: "Type your question first, then send it.",
  off: "Hints are turned off. Turn them on from the AlgeBridge button in your toolbar.",
  paused: "Hints are paused on this site. Turn them back on from the AlgeBridge button in your toolbar.",
  unknown: "Something went wrong. Try again.",
});

/* ------------------------------------------------------------------ */
/* Storage lock-down                                                   */
/* ------------------------------------------------------------------ */

// By default content scripts can read and write chrome.storage.local and
// .sync. Ours never need to (they talk to this worker), so both areas are
// limited to extension pages and the worker. Runs on every worker start, which
// includes browser start (onStartup is registered below).
function lockStorage() {
  for (const area of [chrome.storage.local, chrome.storage.sync]) {
    try {
      if (area && typeof area.setAccessLevel === "function") {
        Promise.resolve(area.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })).catch(() => {});
      }
    } catch {
      // Older Chrome without setAccessLevel on this area. The worker still
      // cleans every value it reads, so this is defense in depth.
    }
  }
}
lockStorage();

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

// One promise chain per resource, so two quick writes never overwrite each
// other. Only lives for the life of the worker, which is fine: each queued job
// reads storage fresh.
const queues = new Map();
function serial(name, job) {
  const prev = queues.get(name) || Promise.resolve();
  const next = prev.catch(() => {}).then(job);
  queues.set(name, next);
  next.finally(() => {
    if (queues.get(name) === next) queues.delete(name);
  });
  return next;
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clampText(value, max) {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.length > max ? text.slice(0, max) : text;
}

function normalizeHost(value) {
  if (typeof value !== "string") return "";
  const host = value.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 253 || /[\s/:@]/.test(host)) return "";
  return host;
}

function hostOf(url) {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* API base                                                            */
/* ------------------------------------------------------------------ */

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

function manifestHostPatterns() {
  try {
    const m = chrome.runtime.getManifest();
    return Array.isArray(m && m.host_permissions) ? m.host_permissions : [];
  } catch {
    return [];
  }
}

// True when `url` is covered by one host_permissions pattern of the running
// manifest. Only explicit hosts count: "<all_urls>" and a bare "*" host never
// make a server acceptable as the API.
function patternCovers(pattern, url) {
  const m = /^(\*|https?):\/\/([^/]+)\//.exec(typeof pattern === "string" ? pattern : "");
  if (!m) return false;
  const [, scheme, hostPart] = m;
  const proto = url.protocol.slice(0, -1);
  if (scheme === "*" ? proto !== "http" && proto !== "https" : scheme !== proto) return false;
  if (hostPart === "*") return false;
  // A pattern may carry a port ("http://localhost:3000/*"); without one it
  // covers every port.
  const portMatch = /^(.*?)(?::(\d+|\*))?$/.exec(hostPart);
  const host = portMatch[1].toLowerCase();
  const port = portMatch[2];
  if (port && port !== "*" && port !== (url.port || (proto === "https" ? "443" : "80"))) return false;
  const h = url.hostname.toLowerCase();
  if (host.startsWith("*.")) {
    const base = host.slice(2);
    return h === base || h.endsWith("." + base);
  }
  return h === host;
}

// The API base may be the live site or, in a development build whose manifest
// lists localhost, a local server. Anything else falls back to the default, so
// a bad or planted value can never send problems somewhere new.
function cleanApiBase(value) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_API_BASE;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return DEFAULT_API_BASE;
  }
  if (url.username || url.password) return DEFAULT_API_BASE;
  const loopback = LOOPBACK.includes(url.hostname);
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) return DEFAULT_API_BASE;
  if (!manifestHostPatterns().some((p) => patternCovers(p, url))) return DEFAULT_API_BASE;
  return url.origin;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function cleanSettings(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const sites = Array.isArray(src.pausedSites) ? src.pausedSites : [];
  const pausedSites = [];
  for (const site of sites) {
    const host = normalizeHost(site);
    if (host && !pausedSites.includes(host)) pausedSites.push(host);
    if (pausedSites.length >= LIMITS.pausedSites) break;
  }
  return {
    enabled: typeof src.enabled === "boolean" ? src.enabled : DEFAULT_SETTINGS.enabled,
    mode: MODES.includes(src.mode) ? src.mode : DEFAULT_SETTINGS.mode,
    pausedSites,
    apiBase: cleanApiBase(src.apiBase),
  };
}

async function readSettings() {
  const got = await chrome.storage.sync.get("settings");
  return cleanSettings(got.settings);
}

// The popup can change enabled, mode and pausedSites. The API base is only
// changed from the service worker console (see setApiBase below), so neither
// a page nor the popup can point the extension at another server.
function applyPatch(current, patch) {
  const next = { ...current };
  if (!patch || typeof patch !== "object") return next;
  if (typeof patch.enabled === "boolean") next.enabled = patch.enabled;
  if (MODES.includes(patch.mode)) next.mode = patch.mode;
  if (Array.isArray(patch.pausedSites)) next.pausedSites = patch.pausedSites;
  return cleanSettings(next);
}

// Same rule as the content script and the popup: "www." is ignored and a paused
// site also covers its subdomains.
function siteKey(host) {
  return normalizeHost(host).replace(/^www\./, "");
}

function siteCovers(site, host) {
  const s = siteKey(site);
  const h = siteKey(host);
  return Boolean(s) && Boolean(h) && (h === s || h.endsWith("." + s));
}

function hostPaused(host, pausedSites) {
  return pausedSites.some((site) => siteCovers(site, host));
}

// A content script may pause or unpause only the site it runs on (its frame or
// its tab's top page, compared the way the popup writes them: "www." dropped).
// Entries for any other site are kept exactly as they were.
function limitPatchToSites(current, patch, ownHosts) {
  const safe = {};
  if (!patch || typeof patch !== "object") return safe;
  if (typeof patch.enabled === "boolean") safe.enabled = patch.enabled;
  if (MODES.includes(patch.mode)) safe.mode = patch.mode;
  if (Array.isArray(patch.pausedSites)) {
    const mine = ownHosts.map(siteKey).filter(Boolean);
    const own = (site) => mine.includes(siteKey(site));
    const wanted = cleanSettings({ pausedSites: patch.pausedSites }).pausedSites;
    const keepOthers = current.pausedSites.filter((site) => !own(site));
    const ownWanted = wanted.filter(own);
    safe.pausedSites = [...keepOthers, ...ownWanted];
  }
  return safe;
}

function writeSettings(patch, ownHosts) {
  return serial("settings", async () => {
    const current = await readSettings();
    const allowed = ownHosts ? limitPatchToSites(current, patch, ownHosts) : patch;
    const next = applyPatch(current, allowed);
    await chrome.storage.sync.set({ settings: next });
    return next;
  });
}

async function getInstallId() {
  const got = await chrome.storage.local.get("install");
  if (typeof got.install === "string" && INSTALL_RE.test(got.install)) return got.install;
  return serial("install", async () => {
    const again = await chrome.storage.local.get("install");
    if (typeof again.install === "string" && INSTALL_RE.test(again.install)) return again.install;
    const id = crypto.randomUUID();
    await chrome.storage.local.set({ install: id });
    return id;
  });
}

function bumpStat(key) {
  if (!STAT_KEYS.includes(key)) return Promise.resolve(null);
  return serial("stats", async () => {
    const got = await chrome.storage.local.get("stats");
    const day = todayKey();
    const old = got.stats && typeof got.stats === "object" ? got.stats : {};
    const stats =
      old.day === day
        ? {
            day,
            problemsSeen: Number.isFinite(old.problemsSeen) ? old.problemsSeen : 0,
            hints: Number.isFinite(old.hints) ? old.hints : 0,
          }
        : { day, problemsSeen: 0, hints: 0 };
    stats[key] += 1;
    await chrome.storage.local.set({ stats });
    return stats;
  });
}

function sendToTab(tabId, message, frameId) {
  const options = typeof frameId === "number" ? { frameId } : undefined;
  return chrome.tabs.sendMessage(tabId, message, options);
}

/* ------------------------------------------------------------------ */
/* Hints                                                               */
/* ------------------------------------------------------------------ */

function fail(error, message, extra) {
  return { ok: false, error, message, ...(extra || {}) };
}

function buildHintBody(payload, install) {
  const p = payload && typeof payload === "object" ? payload : {};
  const problem = clampText(p.problem, LIMITS.problem);
  if (!problem) return { error: fail("bad-request", MESSAGES.needProblem) };
  const action = ACTIONS.includes(p.action) ? p.action : "first";
  const hints = (Array.isArray(p.hints) ? p.hints : [])
    .filter((h) => typeof h === "string" && h.trim())
    .slice(0, LIMITS.hints)
    .map((h) => clampText(h, LIMITS.hint));
  const body = { v: 1, install, problem, action, hints };
  // The sealed solution is opaque base64url made by the server. Anything else
  // is dropped, so the server simply solves the problem again.
  if (typeof p.sealed === "string" && p.sealed.length <= LIMITS.sealed && SEALED_RE.test(p.sealed)) {
    body.sealed = p.sealed;
  }
  if (action === "check") {
    const answer = clampText(p.answer, LIMITS.answer);
    if (!answer) return { error: fail("bad-request", MESSAGES.needAnswer) };
    body.answer = answer;
  }
  if (action === "ask") {
    const question = clampText(p.question, LIMITS.question);
    if (!question) return { error: fail("bad-request", MESSAGES.needQuestion) };
    body.question = question;
  }
  return { body };
}

// Only the fields of the HintResponse contract reach the page, each with the
// right type, so nothing unexpected in a server reply is ever passed along.
function cleanHintData(data) {
  const out = { reply: clampText(data.reply, LIMITS.reply) };
  if (typeof data.sealed === "string" && data.sealed.length <= LIMITS.sealed && SEALED_RE.test(data.sealed)) {
    out.sealed = data.sealed;
  }
  if (Number.isInteger(data.step) && data.step >= -1 && data.step < 100) out.step = data.step;
  if (Number.isInteger(data.steps) && data.steps >= 0 && data.steps < 100) out.steps = data.steps;
  if (typeof data.done === "boolean") out.done = data.done;
  if (typeof data.kind === "string" && /^[a-z-]{1,40}$/.test(data.kind)) out.kind = data.kind;
  if (data.level === 1 || data.level === 2) out.level = data.level;
  if (VERDICTS.includes(data.verdict)) out.verdict = data.verdict;
  if (SOURCES.includes(data.source)) out.source = data.source;
  return out;
}

function waitPhrase(seconds) {
  if (seconds >= 90) {
    const minutes = Math.round(seconds / 60);
    return `about ${minutes} minutes`;
  }
  if (seconds >= 60) return "about a minute";
  if (seconds <= 1) return "a second";
  return `about ${seconds} seconds`;
}

// Seconds the server asked us to wait, from the JSON body's retryAfter or the
// Retry-After header (seconds or an HTTP date), capped at an hour. null when
// the server named no wait, so the page never shows a made-up number.
const MAX_RETRY_AFTER = 3600;
function readRetryAfter(res, data, now = Date.now()) {
  const clamp = (seconds) => Math.min(Math.max(1, Math.ceil(seconds)), MAX_RETRY_AFTER);
  const fromBody = data && typeof data === "object" ? Number(data.retryAfter) : NaN;
  if (Number.isFinite(fromBody) && fromBody > 0) return clamp(fromBody);
  const header = String((res.headers && res.headers.get("Retry-After")) || "").trim();
  if (/^\d+(\.\d+)?$/.test(header) && Number(header) > 0) return clamp(Number(header));
  const when = header && !/^\d/.test(header) ? Date.parse(header) : NaN;
  if (Number.isFinite(when) && when > now) return clamp((when - now) / 1000);
  return null;
}

function mapHttpError(res, data) {
  switch (res.status) {
    case 400:
      return fail("bad-request", MESSAGES.badRequest);
    case 422:
      return fail("not-algebra", MESSAGES.notAlgebra);
    case 429: {
      const retryAfter = readRetryAfter(res, data);
      if (retryAfter === null) return fail("rate", MESSAGES.rate);
      return fail("rate", `${MESSAGES.rateLead} Take a short break and try again in ${waitPhrase(retryAfter)}.`, { retryAfter });
    }
    case 503: {
      const retryAfter = readRetryAfter(res, data);
      if (retryAfter === null) return fail("no-model", MESSAGES.noModel);
      return fail("no-model", `${MESSAGES.busyLead} Try again in ${waitPhrase(retryAfter)}.`, { retryAfter });
    }
    default:
      return fail("server", MESSAGES.server);
  }
}

// Hosts a content-script sender runs on: its own frame and its tab's top page.
function senderHosts(sender) {
  const hosts = [];
  const frame = hostOf(sender && sender.url);
  if (frame) hosts.push(frame);
  const top = hostOf(sender && sender.tab && sender.tab.url);
  if (top && !hosts.includes(top)) hosts.push(top);
  return hosts;
}

async function requestHint(payload, sender, kind) {
  const [settings, install] = await Promise.all([readSettings(), getInstallId()]);
  // Off and paused mean no page text leaves the browser, even if a content
  // script that has not caught up yet still asks.
  if (kind === "content") {
    if (!settings.enabled) return fail("off", MESSAGES.off);
    if (senderHosts(sender).some((h) => hostPaused(h, settings.pausedSites))) return fail("paused", MESSAGES.paused);
  }
  const built = buildHintBody(payload, install);
  if (built.error) return built.error;

  let res;
  try {
    res = await fetch(`${settings.apiBase}/api/extension/hint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built.body),
      signal: AbortSignal.timeout(HINT_TIMEOUT_MS),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      // A redirect could carry the problem to another server. The API never
      // redirects, so one is treated as an error.
      redirect: "error",
    });
  } catch (err) {
    const name = err && err.name;
    if (name === "TimeoutError" || name === "AbortError") return fail("timeout", MESSAGES.timeout);
    return fail("offline", MESSAGES.offline);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) return mapHttpError(res, data);
  if (!data || typeof data !== "object" || typeof data.reply !== "string" || !data.reply.trim()) {
    return fail("server", MESSAGES.server);
  }
  return { ok: true, data: cleanHintData(data) };
}

/* ------------------------------------------------------------------ */
/* Toolbar badge                                                       */
/* ------------------------------------------------------------------ */

// Stored per tab as { host, frames: { [frameId]: { doc, count } } } so every
// frame on the page adds to one total, and a new top page clears the old one.
async function readTabCounts(tabId) {
  const key = COUNT_PREFIX + tabId;
  const got = await chrome.storage.session.get(key);
  const rec = got[key];
  return rec && typeof rec === "object" && rec.frames ? rec : { host: "", frames: {} };
}

function totalCount(rec) {
  let sum = 0;
  for (const frame of Object.values(rec.frames || {})) {
    if (frame && Number.isFinite(frame.count) && frame.count > 0) sum += frame.count;
  }
  return sum;
}

function badgeText(total, settings, host) {
  if (!settings.enabled || settings.mode === "off") return "";
  if (hostPaused(host, settings.pausedSites)) return "";
  if (total <= 0) return "";
  return total > 99 ? "99+" : String(total);
}

async function paintBadge(tabId, text) {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: BRAND_BLUE });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
    }
    await chrome.action.setBadgeText({ tabId, text });
  } catch {
    // The tab closed while we were painting. Nothing to do.
  }
}

const MAX_FRAMES = 64;

function recordCount(sender, count) {
  const tabId = sender && sender.tab && sender.tab.id;
  if (typeof tabId !== "number" || tabId < 0) return Promise.resolve(null);
  const frameId = Number.isInteger(sender.frameId) && sender.frameId >= 0 ? sender.frameId : 0;
  const doc = typeof sender.documentId === "string" ? sender.documentId.slice(0, 64) : "";
  const safeCount = Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), 9999) : 0;

  return serial("counts", async () => {
    const key = COUNT_PREFIX + tabId;
    let rec = await readTabCounts(tabId);
    if (frameId === 0) {
      const top = rec.frames["0"];
      // A different top document means the tab moved to a new page. Frames
      // that reported before the top's first report belong to this page, so
      // they stay.
      if (top && top.doc !== doc) rec = { host: "", frames: {} };
      rec.host = hostOf(sender.url || (sender.tab && sender.tab.url) || "") || rec.host;
    }
    // A page with hundreds of frames cannot grow the record without end.
    const frameKey = String(frameId);
    if (!(frameKey in rec.frames) && Object.keys(rec.frames).length >= MAX_FRAMES) return null;
    rec.frames[frameKey] = { doc, count: safeCount };
    await chrome.storage.session.set({ [key]: rec });
    const settings = await readSettings();
    await paintBadge(tabId, badgeText(totalCount(rec), settings, rec.host));
    return null;
  });
}

async function repaintAllBadges(settings) {
  const all = await chrome.storage.session.get(null);
  const jobs = [];
  for (const [key, rec] of Object.entries(all)) {
    if (!key.startsWith(COUNT_PREFIX) || !rec || typeof rec !== "object") continue;
    const tabId = Number(key.slice(COUNT_PREFIX.length));
    if (!Number.isInteger(tabId)) continue;
    jobs.push(paintBadge(tabId, badgeText(totalCount(rec), settings, rec.host || "")));
  }
  await Promise.all(jobs);
}

/* ------------------------------------------------------------------ */
/* Broadcast settings to every open tab                                */
/* ------------------------------------------------------------------ */

async function broadcastSettings(settings) {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    tabs = [];
  }
  const message = { type: "settings:changed", settings };
  await Promise.all(
    tabs
      .filter((tab) => typeof tab.id === "number" && tab.id >= 0)
      // Tabs without our content script (new tab page, chrome:// pages, pages
      // opened before install) reject. That is expected, so it is ignored.
      .map((tab) => sendToTab(tab.id, message).catch(() => {})),
  );
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.settings) return;
  const settings = cleanSettings(changes.settings.newValue);
  broadcastSettings(settings);
  repaintAllBadges(settings).catch(() => {});
});

/* ------------------------------------------------------------------ */
/* Message router                                                      */
/* ------------------------------------------------------------------ */

// "chrome-extension://<our id>/", the prefix of every page this extension owns.
function extensionPrefix() {
  const base = chrome.runtime.getURL("");
  return base.endsWith("/") ? base : base + "/";
}

// "extension" for our own pages (the popup), "content" for our content
// scripts in a web page, null for anything else.
function senderKind(sender) {
  if (!sender || typeof sender !== "object" || sender.id !== chrome.runtime.id) return null;
  const url = typeof sender.url === "string" ? sender.url : "";
  if (url.startsWith(extensionPrefix())) return "extension";
  const tabId = sender.tab && sender.tab.id;
  if (typeof tabId === "number" && tabId >= 0 && /^(https?|file):/i.test(url)) return "content";
  return null;
}

const BOTH = ["extension", "content"];
const ROUTES = {
  hint: { from: BOTH, run: (msg, sender, kind) => requestHint(msg.payload, sender, kind) },
  "settings:get": { from: BOTH, run: () => readSettings() },
  "settings:set": {
    from: BOTH,
    run: (msg, sender, kind) => writeSettings(msg.patch, kind === "content" ? senderHosts(sender) : null),
  },
  "problems:count": { from: ["content"], run: (msg, sender) => recordCount(sender, Number(msg.count)) },
  "stats:bump": { from: BOTH, run: (msg) => bumpStat(msg.key).then(() => null) },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || typeof msg.type !== "string") return false;
  if (!Object.prototype.hasOwnProperty.call(ROUTES, msg.type)) return false;
  const route = ROUTES[msg.type];
  const kind = senderKind(sender);
  if (!kind || !route.from.includes(kind)) return false;

  Promise.resolve()
    .then(() => route.run(msg, sender, kind))
    .then(
      (result) => sendResponse(result === undefined ? null : result),
      () => {
        if (msg.type === "hint") sendResponse(fail("unknown", MESSAGES.unknown));
        else if (msg.type.startsWith("settings:")) sendResponse(cleanSettings(null));
        else sendResponse(null);
      },
    );
  return true; // keeps the channel open for the async reply
});

/* ------------------------------------------------------------------ */
/* Install, right-click menu, keyboard shortcut                        */
/* ------------------------------------------------------------------ */

function createMenu() {
  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: "Get an AlgeBridge hint for this",
        contexts: ["selection"],
        documentUrlPatterns: ["http://*/*", "https://*/*", "file:///*"],
      },
      () => void chrome.runtime.lastError,
    );
  });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  createMenu();
  await getInstallId().catch(() => {});
  if (details && details.reason === "install") {
    // Store the defaults once so sync has a full copy from the start.
    const current = await readSettings().catch(() => cleanSettings(null));
    await chrome.storage.sync.set({ settings: current }).catch(() => {});
  }
});

// Menus normally survive a browser restart; rebuilding them is cheap and covers
// the cases where they do not. Waking the worker at browser start also re-runs
// lockStorage() above before pages load.
chrome.runtime.onStartup.addListener(createMenu);

// The top frame owns the panel. If it has no content script (for example an
// AlgeBridge page that embeds another site), fall back to the frame the student
// clicked in.
function isNoReceiver(err) {
  const text = String((err && err.message) || err || "");
  return /Receiving end does not exist|Could not establish connection|No tab with id/i.test(text);
}

// Resolves true when a content script got the message. A frame that got it but
// sent nothing back still counts as delivered.
async function deliver(tabId, message, frameId) {
  try {
    await sendToTab(tabId, message, frameId);
    return true;
  } catch (err) {
    return !isNoReceiver(err);
  }
}

async function openPanel(tabId, text, fallbackFrameId) {
  const message = text ? { type: "open-panel", text } : { type: "open-panel" };
  if (await deliver(tabId, message, 0)) return true;
  if (typeof fallbackFrameId === "number" && fallbackFrameId !== 0) {
    return deliver(tabId, message, fallbackFrameId);
  }
  return false;
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || typeof tab.id !== "number") return;
  const text = clampText(info.selectionText || "", LIMITS.problem);
  openPanel(tab.id, text, info.frameId);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "open-panel") return;
  let target = tab;
  if (!target || typeof target.id !== "number") {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    target = active;
  }
  if (target && typeof target.id === "number") openPanel(target.id);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(COUNT_PREFIX + tabId).catch(() => {});
});

/* ------------------------------------------------------------------ */
/* Developer helper                                                    */
/* ------------------------------------------------------------------ */

// Point the extension at a local dev server from the service worker console:
//   setApiBase("http://localhost:3000")
// and back to the live site with setApiBase(). The value must match one of the
// running manifest's host_permissions: the development manifest lists
// localhost and 127.0.0.1, the store build lists only https://learn.algebridge.org.
self.setApiBase = (url) =>
  serial("settings", async () => {
    const current = await readSettings();
    const next = cleanSettings({ ...current, apiBase: url || DEFAULT_API_BASE });
    await chrome.storage.sync.set({ settings: next });
    return next.apiBase;
  });

// Exposed for tests in Node, where `module` exists. Chrome ignores this.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    cleanSettings,
    cleanApiBase,
    applyPatch,
    buildHintBody,
    cleanHintData,
    mapHttpError,
    readRetryAfter,
    badgeText,
    hostPaused,
    todayKey,
    waitPhrase,
    patternCovers,
    senderKind,
  };
}
