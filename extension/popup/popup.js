/*
 * AlgeBridge Hints toolbar popup.
 * Reads and changes settings through the background (settings:get / settings:set),
 * reads today's counts from chrome.storage.local and the page's problem count
 * from chrome.storage.session, and asks the page's content script to open the
 * hint panel. Builds every bit of text with textContent, never HTML.
 */
"use strict";

const DEFAULTS = { enabled: true, mode: "popup", pausedSites: [], apiBase: "https://learn.algebridge.org" };
const MODES = ["popup", "badge", "off"];
const MODE_HELP = {
  popup: "A card slides in for each new problem.",
  badge: "A small marker sits next to each problem.",
  off: "Nothing shows until you open hints.",
};

const el = (id) => document.getElementById(id);

const state = {
  settings: { ...DEFAULTS },
  tab: null,
  host: "",
  kind: "special", // "web" | "file" | "algebridge" | "special" | "unknown"
  pageCount: 0,
  stats: { problemsSeen: 0, hints: 0 },
  mascot: false,
};

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function classify(tab) {
  if (!tab) return { kind: "special", host: "" };
  // Without a URL (it should come with activeTab) we still let the student try.
  const url = tab.url || tab.pendingUrl;
  if (!url) return { kind: "unknown", host: "" };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "special", host: "" };
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    const host = parsed.hostname.toLowerCase();
    if (host === "algebridge.org" || host.endsWith(".algebridge.org")) return { kind: "algebridge", host };
    return { kind: "web", host };
  }
  if (parsed.protocol === "file:") return { kind: "file", host: "" };
  return { kind: "special", host: "" };
}

function mergeSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULTS.enabled,
    mode: MODES.includes(s.mode) ? s.mode : DEFAULTS.mode,
    pausedSites: Array.isArray(s.pausedSites) ? s.pausedSites.filter((x) => typeof x === "string") : [],
    apiBase: typeof s.apiBase === "string" ? s.apiBase : DEFAULTS.apiBase,
  };
}

async function loadSettings() {
  try {
    const got = await chrome.runtime.sendMessage({ type: "settings:get" });
    if (got && typeof got === "object") return mergeSettings(got);
  } catch {
    // Background asleep or restarting. Read storage directly instead.
  }
  const stored = await chrome.storage.sync.get("settings").catch(() => ({}));
  return mergeSettings(stored.settings);
}

// Settings are written by the background only, so its checks always apply.
// If it does not answer, the switch flips back and the student can try again.
async function saveSettings(patch) {
  try {
    const next = await chrome.runtime.sendMessage({ type: "settings:set", patch });
    if (next && typeof next === "object") {
      state.settings = mergeSettings(next);
      render();
      return;
    }
  } catch {
    // fall through
  }
  render();
  setNote("That did not save. Try again in a moment.", true);
}

async function loadStats() {
  const got = await chrome.storage.local.get("stats").catch(() => ({}));
  const stats = got.stats;
  if (stats && stats.day === todayKey()) {
    state.stats = {
      problemsSeen: Number.isFinite(stats.problemsSeen) ? stats.problemsSeen : 0,
      hints: Number.isFinite(stats.hints) ? stats.hints : 0,
    };
  } else {
    state.stats = { problemsSeen: 0, hints: 0 };
  }
}

async function loadPageCount() {
  state.pageCount = 0;
  if (!state.tab || typeof state.tab.id !== "number" || !chrome.storage.session) return;
  const key = `counts:${state.tab.id}`;
  const got = await chrome.storage.session.get(key).catch(() => ({}));
  const rec = got[key];
  if (!rec || !rec.frames) return;
  let sum = 0;
  for (const frame of Object.values(rec.frames)) {
    if (frame && Number.isFinite(frame.count) && frame.count > 0) sum += frame.count;
  }
  state.pageCount = sum;
}

// Matches the content script and the background: "www." is ignored and a
// paused site also covers its subdomains.
function siteKey(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

function siteCovers(site, host) {
  const s = siteKey(site);
  const h = siteKey(host);
  return Boolean(s) && Boolean(h) && (h === s || h.endsWith("." + s));
}

function isPaused() {
  return state.kind === "web" && state.settings.pausedSites.some((site) => siteCovers(site, state.host));
}

function statusText() {
  const s = state.settings;
  if (!s.enabled) return "Hints are off";
  if (isPaused()) return "Paused on this site";
  if (s.mode === "badge") return "On, markers only";
  if (s.mode === "off") return "On, only when you ask";
  return "Hints are on";
}

function setNote(text, warn) {
  const note = el("open-note");
  note.textContent = text || "";
  note.classList.toggle("warn", Boolean(warn && text));
}

/* ------------------------------------------------------------------ */
/* Hero art: the mascot from src/mascot.js when it is there, else the */
/* AlgeBridge mark. Built with DOM calls only.                         */
/* ------------------------------------------------------------------ */

const SVGNS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function fallbackArt() {
  const box = document.createElement("div");
  box.className = "fallback";
  const s = svgEl("svg", { viewBox: "0 0 24 24", width: 40, height: 40, focusable: "false" });
  s.appendChild(svgEl("circle", { cx: 12, cy: 12, r: 12, fill: "#2563eb" }));
  const g = svgEl("g", { fill: "none", stroke: "#ffffff", "stroke-linejoin": "miter" });
  g.appendChild(svgEl("path", { d: "M7.7 18 L12 6.4 L16.3 18", "stroke-width": "2.1" }));
  g.appendChild(svgEl("path", { d: "M3 13.1 H21", "stroke-width": "1.5" }));
  g.appendChild(
    svgEl("path", {
      d: "M3.6 15.4 H5.4 C6.7 15.4 7.6 16.2 8.2 17.6 M20.4 15.4 H18.6 C17.3 15.4 16.4 16.2 15.8 17.6",
      "stroke-width": "1.25",
    }),
  );
  s.appendChild(g);
  box.appendChild(s);
  return box;
}

let artPose = "";
function paintArt(pose) {
  if (artPose === pose) return;
  artPose = pose;
  const box = el("hero-art");
  let node = null;
  const M = globalThis.AlgeBridgeMascot;
  if (M && typeof M.create === "function") {
    try {
      const made = M.create(pose, 72);
      if (made instanceof Element) node = made;
    } catch {
      node = null;
    }
  }
  state.mascot = Boolean(node);
  box.replaceChildren(node || fallbackArt());
}

function heroCopy() {
  const s = state.settings;
  const n = state.pageCount;
  if (state.kind === "special") {
    return { title: "Hints work on web pages", sub: "Open your homework site, then click here again." };
  }
  if (state.kind === "algebridge") {
    return { title: "You are on AlgeBridge", sub: "Use the helper built into each lesson here." };
  }
  if (!s.enabled) return { title: "Hints are off", sub: "Turn them on with the switch at the top." };
  if (isPaused()) return { title: "Paused on this site", sub: "Turn off the pause below to get hints here." };
  if (n > 0) {
    const what = n === 1 ? "an algebra problem" : `${n} algebra problems`;
    return {
      title: state.mascot ? `Archie found ${what}` : `Found ${what}`,
      sub: `Open hints to work through ${n === 1 ? "it" : "them"} one step at a time.`,
    };
  }
  return { title: "Stuck on a problem?", sub: "Open hints and work through it one step at a time." };
}

function render() {
  const s = state.settings;

  el("enabled").checked = s.enabled;
  el("status-line").textContent = statusText();

  el("mode-group").disabled = !s.enabled;
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.checked = radio.value === s.mode;
  }
  el("mode-help").textContent = MODE_HELP[s.mode] || "";

  // Site row
  const paused = isPaused();
  const pausedBox = el("paused");
  if (state.kind === "web") {
    el("site-label").textContent = `Pause on ${siteKey(state.host)}`;
    el("site-label").title = siteKey(state.host);
    el("site-help").textContent = paused ? "Hints stay quiet on this site." : "";
    pausedBox.disabled = !s.enabled;
    el("site-row").hidden = false;
  } else {
    // Nothing to pause on a browser page, a file or AlgeBridge itself.
    el("site-row").hidden = true;
    pausedBox.disabled = true;
  }
  pausedBox.checked = paused;

  // Hero and the Open button
  const good = state.kind === "web" || state.kind === "file" || state.kind === "unknown";
  paintArt(good && s.enabled && !paused && state.pageCount > 0 ? "idle" : "thinking");
  const copy = heroCopy();
  el("hero-title").textContent = copy.title;
  el("hero-sub").textContent = copy.sub;
  el("open-panel").disabled = !good || !s.enabled || paused;
  if (el("open-panel").disabled) setNote("", false);

  // Counts
  el("count-seen").textContent = String(state.stats.problemsSeen);
  el("count-hints").textContent = String(state.stats.hints);
}

async function renderShortcut() {
  if (!chrome.commands || !chrome.commands.getAll) return;
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === "open-panel");
    const box = el("shortcut");
    box.textContent = "";
    if (!cmd || !cmd.shortcut) {
      box.hidden = true;
      return;
    }
    const kbd = document.createElement("kbd");
    kbd.textContent = cmd.shortcut;
    kbd.title = "Keyboard shortcut to open hints";
    box.append(kbd);
    box.hidden = false;
  } catch {
    // The shortcut is optional.
  }
}

function isNoReceiver(err) {
  const text = String((err && err.message) || err || "");
  return /Receiving end does not exist|Could not establish connection|No tab with id/i.test(text);
}

async function openPanel() {
  const tab = state.tab;
  if (!tab || typeof tab.id !== "number") return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "open-panel" }, { frameId: 0 });
    if (res && res.ok === false) {
      setNote(
        res.reason === "paused"
          ? "Hints are paused on this page. Check the switches above."
          : res.reason === "small"
            ? "This window is a little small for hints. Make it bigger and try again."
            : "Hints could not open on this page. Reload it and try again.",
        true,
      );
      return;
    }
  } catch (err) {
    if (isNoReceiver(err)) {
      setNote(
        state.kind === "file"
          ? "To use hints on files, turn on Allow access to file URLs for AlgeBridge Hints in chrome://extensions."
          : "Hints are not running on this tab yet. Reload the page and try again.",
        true,
      );
      return;
    }
    // Any other error means the page got the message but sent nothing back.
  }
  window.close();
}

function openLink(event) {
  event.preventDefault();
  const url = event.currentTarget.href;
  chrome.tabs.create({ url }).finally(() => window.close());
}

function wire() {
  el("enabled").addEventListener("change", (e) => {
    saveSettings({ enabled: e.target.checked });
  });
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener("change", (e) => {
      if (e.target.checked) saveSettings({ mode: e.target.value });
    });
  }
  el("paused").addEventListener("change", (e) => {
    if (state.kind !== "web" || !state.host) return;
    const key = siteKey(state.host);
    // Turning the pause off removes every entry that covers this site.
    const sites = state.settings.pausedSites.filter((site) => !siteCovers(site, state.host));
    if (e.target.checked) sites.push(key);
    setNote("", false);
    saveSettings({ pausedSites: sites });
  });
  el("open-panel").addEventListener("click", openPanel);
  el("privacy-link").addEventListener("click", openLink);
  el("site-link").addEventListener("click", openLink);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      state.settings = mergeSettings(changes.settings.newValue);
      render();
    } else if (area === "local" && changes.stats) {
      loadStats().then(render);
    } else if (area === "session" && state.tab && changes[`counts:${state.tab.id}`]) {
      loadPageCount().then(render);
    }
  });
}

async function init() {
  wire();
  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    tab = null;
  }
  state.tab = tab || null;
  const where = classify(tab);
  state.kind = where.kind;
  state.host = where.host;

  const [settings] = await Promise.all([loadSettings(), loadStats(), loadPageCount(), renderShortcut()]);
  state.settings = settings;
  render();
}

init();
