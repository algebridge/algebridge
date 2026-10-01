/*
 * AlgeBridge Hints, page UI (classic content script).
 *
 * Runs after src/detect.js and src/mascot.js in every frame. It watches the
 * page for algebra problems (globalThis.AlgeBridgeDetect), and offers hints:
 *   - a white card at the top right when a new problem comes on screen (mode
 *     "popup"), in the style of Knowt's popup: pill tabs (Hints, On this page,
 *     The idea), Archie the mascot with a title and one big button, and a
 *     grey well of preview cards, one per problem,
 *   - the same card grows into the hint view: Archie and the problem in a
 *     compact row, hints as chat bubbles, Next hint, Check my answer, Ask,
 *   - a round button at the bottom right when the card is put away,
 *   - a small round marker beside each visible problem (modes "popup" and
 *     "badge"). The hint view also opens from the toolbar popup, the keyboard
 *     shortcut or the right-click menu.
 *
 * Everything we draw lives in one shadow root on a <algebridge-hints> element,
 * so page CSS cannot reach in and ours cannot leak out. Page text and API text
 * are only ever placed with textContent / text nodes, never parsed as HTML.
 */
(function () {
  "use strict";

  if (globalThis.__algebridgeHints) return;
  const D = globalThis.AlgeBridgeDetect;
  if (!D || typeof D.findProblems !== "function") return;
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
  if (document.documentElement && !(document.documentElement instanceof HTMLElement)) return; // SVG, XML

  /* ---------------------------------------------------------------- */
  /* Constants                                                         */
  /* ---------------------------------------------------------------- */

  const MIN_W = 320;
  const MIN_H = 240;
  const DEBOUNCE_MS = 400;
  const MAX_WAIT_MS = 2000;
  const BUDGET_MS = 60;
  const CARD_MS = 10000;
  const CARD_AFTER_LEAVE_MS = 4000;
  const REPOP_GAP_MS = 15000;
  const MAX_PROBLEM = 600;
  const MAX_HINTS = 12;
  const MAX_HINT_LEN = 700;
  const MAX_ANSWER = 120;
  const MAX_QUESTION = 300;
  const HOST_TAG = "algebridge-hints";
  const FRAME_MSG = "algebridge-hints";
  const SVGNS = "http://www.w3.org/2000/svg";
  const DEFAULTS = Object.freeze({
    enabled: true,
    mode: "popup",
    pausedSites: [],
    apiBase: "https://learn.algebridge.org",
  });

  let IS_TOP = false;
  try {
    IS_TOP = window.top === window;
  } catch {
    IS_TOP = false;
  }

  const KIND_LABELS = {
    "linear-equation": "Linear equation",
    "linear-inequality": "Inequality",
    system: "System of equations",
    quadratic: "Quadratic",
    polynomial: "Polynomial",
    factoring: "Factoring",
    rational: "Rational",
    radical: "Radical",
    exponential: "Exponential",
    logarithmic: "Logarithms",
    "absolute-value": "Absolute value",
    complex: "Complex numbers",
    function: "Functions",
    sequence: "Sequences",
    expression: "Expression",
    "word-problem": "Word problem",
  };

  const ERRORS = {
    offline: "Could not reach AlgeBridge. Check your connection and try again.",
    rate: "That is a lot of requests in a short time. Take a short break, then try again.",
    "not-algebra":
      "This does not look like an algebra problem yet. Fix the problem text above, then try again.",
    "no-model": "The hint helper is busy right now. Try again in a minute.",
    "bad-request": "Something in that problem text did not work. Edit it a little and try again.",
    invalidated: "AlgeBridge was just updated. Reload this page to keep getting hints.",
    unknown: "Something went wrong on our side. Try again in a moment.",
  };

  // Codes where pressing Try again cannot help: the text needs changing, or
  // the student turned hints off or paused them on this site.
  const NO_RETRY = new Set(["not-algebra", "bad-request", "paused", "off"]);

  const LOADING = {
    first: "Writing your first hint",
    next: "Writing your next hint",
    concept: "Finding the big idea",
    check: "Checking your answer",
    ask: "Thinking about your question",
  };

  const SOLVED_ASK_NEXT = "You already solved this one. Want to try the next problem?";
  const SOLVED_ASK_LAST = "You already solved this one. Nice work.";

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */

  let settings = { ...DEFAULTS };
  let booted = false;
  let invalidated = false;
  let running = false; // observers are live

  // Detected problems on this page: id -> record (Map keeps document order of the last scan)
  let problems = new Map();
  const elementIds = new Map(); // Element -> Set<id>
  let elVisible = new WeakMap(); // Element -> last IntersectionObserver verdict
  const seen = new Set(); // ids that have been on screen at least once (stats bumped)
  let dismissed = false; // "Not now" for this page load
  let lastReported = -1;
  let firstReportDue = 0;

  // Scan scheduling
  let mo = null;
  let io = null;
  let scanTimer = 0;
  let idleHandle = 0;
  let firstDirtyAt = 0;
  let lastScanMs = 0;
  let pendingScan = false;
  let scanCount = 0;

  // UI
  let host = null;
  let shadow = null;
  let ui = null; // element refs
  let cssReady = false;
  let rafPending = false;
  const markers = new Map(); // Element -> { btn, off }
  let hoverEl = null;

  // Card
  let cardState = "hidden"; // hidden | card | launcher
  let cardTimer = 0;
  let cardHover = false;
  let collapsedAt = 0;
  let pendingNew = 0;
  let cardForced = null; // array of problem records when a marker forced the list

  // Hint view (the same top right card, grown)
  const sessions = new Map(); // key -> per-problem state
  let current = null; // session shown in the panel
  let currentId = null; // detected problem id behind the hint view (if any)
  let currentEl = null; // page element behind the panel (if any)
  let panelOpen = false;
  let panelPos = null; // {x, y} after a drag
  let drag = null;
  let editing = false;
  let tool = null; // "check" | null
  let tab = "hints"; // "hints" | "page" | "idea"
  let lastTab = "hints"; // the tab open when the hint view last closed
  let pageCache = null; // problems on screen, for On this page when not watching
  let notice = null; // problem record offered by the "New problem" bar
  let restoreFocus = null;

  // Frame coordination. The top frame makes a random nonce once per boot and
  // puts it in every "who" it sends; a child must echo it, and the top only
  // listens to its own iframe elements. Only counts and sizes cross frames,
  // never page text.
  let whoSeq = 0;
  let pendingWho = null; // top: { req, list }
  let lastWho = null; // child: { req, nonce, from } of the last "who" answered
  const FRAME_NONCE = IS_TOP ? randomToken() : "";
  const frameLog = { accepted: 0, badSource: 0, badNonce: 0, stale: 0 }; // for the harness
  let flashTimer = 0;
  let flashEl = null; // problem outlined for a moment after Next problem

  /* ---------------------------------------------------------------- */
  /* Small helpers                                                     */
  /* ---------------------------------------------------------------- */

  function now() {
    return performance.now();
  }

  function cleanSettings(raw) {
    const s = raw && typeof raw === "object" ? raw : {};
    return {
      enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULTS.enabled,
      mode: s.mode === "badge" || s.mode === "off" || s.mode === "popup" ? s.mode : DEFAULTS.mode,
      pausedSites: Array.isArray(s.pausedSites)
        ? s.pausedSites.filter((x) => typeof x === "string").slice(0, 500)
        : [],
      apiBase: typeof s.apiBase === "string" ? s.apiBase : DEFAULTS.apiBase,
    };
  }

  function normHost(h) {
    return String(h || "")
      .trim()
      .toLowerCase()
      .replace(/\.$/, "")
      .replace(/^www\./, "");
  }

  function topHostname() {
    if (IS_TOP) return location.hostname;
    try {
      const ao = location.ancestorOrigins;
      if (ao && ao.length) return new URL(ao[ao.length - 1]).hostname;
    } catch {
      /* ignore */
    }
    return "";
  }

  function siteMatches(hostname, site) {
    const h = normHost(hostname);
    const s = normHost(site);
    return !!s && !!h && (h === s || h.endsWith("." + s));
  }

  function isExcluded() {
    const h = normHost(location.hostname);
    return h === "algebridge.org" || h.endsWith(".algebridge.org");
  }

  function isPaused() {
    if (!settings.enabled) return true;
    const hosts = [location.hostname, topHostname()];
    return settings.pausedSites.some((site) => hosts.some((h) => siteMatches(h, site)));
  }

  function inert() {
    return invalidated || isExcluded() || isPaused();
  }

  function bigEnough() {
    return window.innerWidth >= MIN_W && window.innerHeight >= MIN_H;
  }

  function uiAllowed() {
    return !inert() && bigEnough();
  }

  function watching() {
    return uiAllowed() && (settings.mode === "popup" || settings.mode === "badge");
  }

  function tidy(text) {
    return String(text == null ? "" : text)
      .replace(/\s*\u2014\s*/g, ", ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function randomToken() {
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      return (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2) + "0".repeat(32)).slice(0, 32);
    }
  }

  function fnv(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function keyOf(text) {
    let t = String(text || "");
    try {
      if (typeof D.normalizeMath === "function") t = D.normalizeMath(t);
    } catch {
      /* fall through with the raw text */
    }
    t = t.replace(/\s+/g, " ").trim().toLowerCase();
    try {
      if (typeof D.hash === "function") return String(D.hash(t));
    } catch {
      /* ignore */
    }
    return fnv(t);
  }

  function scoreOf(text) {
    try {
      if (typeof D.scoreText === "function") return D.scoreText(text) || null;
    } catch {
      /* ignore */
    }
    return null;
  }

  // Promise wrapper around runtime.sendMessage that never throws.
  function send(msg) {
    return new Promise((resolve) => {
      if (invalidated || !chrome.runtime || !chrome.runtime.id) {
        markInvalidated();
        resolve({ __error: "invalidated" });
        return;
      }
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          const err = chrome.runtime.lastError;
          if (err) resolve({ __error: String(err.message || "error") });
          else resolve(res);
        });
      } catch (e) {
        const text = String((e && e.message) || e);
        if (/context invalidated/i.test(text)) markInvalidated();
        resolve({ __error: /context invalidated/i.test(text) ? "invalidated" : text });
      }
    });
  }

  function markInvalidated() {
    if (invalidated) return;
    invalidated = true;
    stopWatching(true);
    hideCard(true);
    clearMarkers();
  }

  /* ---------------------------------------------------------------- */
  /* DOM builders (elements and text nodes only, never HTML strings)  */
  /* ---------------------------------------------------------------- */

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    if (children) for (const c of children) if (c) el.appendChild(c);
    return el;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k of Object.keys(attrs)) el.setAttribute(k, String(attrs[k]));
    return el;
  }

  const ICONS = {
    close: ["M6 6l12 12", "M18 6L6 18"],
    chevron: ["M9 6l6 6-6 6"],
    pencil: ["M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z", "M13.5 7.5l3 3"],
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    alert: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M12 7.5v5.5", "M12 16.5v.01"],
    arrow: ["M5 12h14", "M13 6l6 6-6 6"],
    bulb: [
      "M9 18h6",
      "M10 21h4",
      "M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.8V16h5.4v-.4c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3z",
    ],
    up: ["M12 19V5", "M6 11l6-6 6 6"],
    target: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M8 12.5l2.7 2.7L16 10"],
  };

  function icon(name, size) {
    const s = svgEl("svg", {
      viewBox: "0 0 24 24",
      width: size || 16,
      height: size || 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
      class: "ab-ico",
    });
    for (const d of ICONS[name]) s.appendChild(svgEl("path", { d }));
    return s;
  }

  // The AlgeBridge mark: an A whose crossbar is a bridge deck, with arches below.
  function mark(size, disc) {
    const s = svgEl("svg", {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      "aria-hidden": "true",
      focusable: "false",
      class: "ab-mark-svg",
    });
    if (disc) s.appendChild(svgEl("circle", { cx: 12, cy: 12, r: 12, fill: "#2563eb" }));
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
    return s;
  }

  /* ---------------------------------------------------------------- */
  /* Math rendering: x^2 -> x<sup>2</sup>, log_2 -> log<sub>2</sub>    */
  /* ---------------------------------------------------------------- */

  function prettify(text) {
    return tidy(text)
      // "Solve for x . x/3" (inline math next to punctuation) -> "Solve for x. x/3"
      .replace(/\s+([.,;:?!])(?=\s|$)/g, "$1")
      // (x)/(3) -> x/3, but only where dropping the parentheses keeps the meaning
      .replace(/(?<![A-Za-z0-9)\]])\(([A-Za-z0-9.]+)\)(?=\s*\/)/g, "$1")
      .replace(/(\/\s*)\(([A-Za-z0-9.]+)\)(?![A-Za-z0-9(^.])/g, "$1$2")
      .replace(/<=/g, "≤")
      .replace(/>=/g, "≥")
      .replace(/!=/g, "≠")
      // Breathing room around relations, and around + and - between math
      // tokens only (so "two-step" stays as it is).
      .replace(/\s*([=<>≤≥≠])\s*/g, " $1 ")
      .replace(/(?<=(?:^|[^A-Za-z])[A-Za-z]|[0-9)\]])\s*([+-])\s*(?=[0-9(√|]|[A-Za-z](?![A-Za-z]))/g, " $1 ")
      .replace(/([=<>≤≥≠(]) ([+-]) (?=\S)/g, "$1 $2")
      .replace(/^ ([+-]) /, "$1")
      .replace(/\bsqrt\s*\(/gi, "√(")
      .replace(/([0-9A-Za-z)\]])\s*\*\s*(?=[0-9A-Za-z(√])/g, "$1·");
  }

  function readGroup(s, j) {
    const open = s[j];
    if (open === "(" || open === "{") {
      const close = open === "(" ? ")" : "}";
      let depth = 0;
      for (let k = j; k < s.length && k < j + 60; k++) {
        if (s[k] === open) depth++;
        else if (s[k] === close) {
          depth--;
          if (depth === 0) return { text: s.slice(j + 1, k), end: k + 1 };
        }
      }
      return null;
    }
    const m = /^(?:-?\d+(?:\.\d+)?|-?[A-Za-zπ])/.exec(s.slice(j, j + 16));
    return m ? { text: m[0], end: j + m[0].length } : null;
  }

  function appendMathTo(parent, raw, depth) {
    const s = depth ? raw : prettify(raw);
    let buf = "";
    const flush = () => {
      if (buf) parent.appendChild(document.createTextNode(buf));
      buf = "";
    };
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if ((c === "^" || c === "_") && i > 0 && i + 1 < s.length && (depth || 0) < 4) {
        const prev = s[i - 1];
        const okBase = c === "^" ? /[0-9A-Za-z)\]}π]/.test(prev) : /[A-Za-z]/.test(prev);
        const g = okBase ? readGroup(s, i + 1) : null;
        if (g && g.text) {
          flush();
          const node = document.createElement(c === "^" ? "sup" : "sub");
          // Exponents read best set tight: x^(n+1), not x^(n + 1).
          appendMathTo(node, g.text.replace(/\s*([+\-=])\s*/g, "$1"), (depth || 0) + 1);
          parent.appendChild(node);
          i = g.end;
          continue;
        }
      }
      buf += c;
      i++;
    }
    flush();
    return parent;
  }

  function mathNode(tag, cls, text) {
    return appendMathTo(h(tag, { class: cls }), text, 0);
  }

  /* ---------------------------------------------------------------- */
  /* Shadow host                                                       */
  /* ---------------------------------------------------------------- */

  const HOST_STYLE = [
    "all: initial !important",
    "position: fixed !important",
    "top: 0 !important",
    "left: 0 !important",
    "width: 0 !important",
    "height: 0 !important",
    "margin: 0 !important",
    "padding: 0 !important",
    "border: 0 !important",
    "overflow: visible !important",
    "display: block !important",
    "visibility: visible !important",
    "opacity: 1 !important",
    "z-index: 2147483647 !important",
    "pointer-events: none !important",
  ].join("; ");

  // Keep page handlers (hotkeys, click-outside, scroll hijackers, paste
  // uploaders, focus traps) from reacting to what happens inside our UI.
  //
  // Known limit: this only stops events on their way back up. A page script
  // that listens on window or document in the capture phase still sees each
  // key event (retargeted to our host element) before it reaches us, so it
  // could log what is typed into our inputs. A closed shadow root cannot
  // prevent that; only an extension iframe could. What is typed here is the
  // student's own answer or question about a problem on that same page, so
  // nothing from another site is exposed. Do not add fields that take
  // anything more private than that (names, emails, passwords, codes)
  // without moving them into an extension iframe first.
  const CONTAINED_EVENTS = [
    "keydown",
    "keyup",
    "keypress",
    "beforeinput",
    "input",
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "pointerdown",
    "pointerup",
    "focusin",
    "focusout",
    "wheel",
    "touchstart",
    "touchmove",
    "touchend",
    "copy",
    "cut",
    "paste",
    "contextmenu",
    "selectstart",
  ];

  function ensureHost() {
    if (host && shadow) {
      if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
      return;
    }
    host = document.createElement(HOST_TAG);
    host.setAttribute("style", HOST_STYLE);
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    const rootEl = h("div", { class: "ab-root", hidden: true });
    const outline = h("div", { class: "ab-outline", hidden: true, "aria-hidden": "true" });
    const markerLayer = h("div", { class: "ab-markers" });
    rootEl.append(outline, markerLayer);
    shadow.append(style, rootEl);
    for (const type of CONTAINED_EVENTS) {
      rootEl.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
    }
    ui = { root: rootEl, style, outline, markerLayer, sheet: null, launcher: null, P: null };
    document.documentElement.appendChild(host);
    loadCss();
  }

  async function loadCss() {
    const url = chrome.runtime.getURL("src/ui.css");
    let css = "";
    try {
      const res = await fetch(url);
      if (res.ok) css = await res.text();
    } catch {
      css = "";
    }
    if (!ui) return;
    if (css) {
      ui.style.textContent = css;
    } else {
      // Fallback: a <link> into the shadow root. Pages with a strict style-src
      // may block it, in which case the UI stays hidden rather than unstyled.
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      const loaded = await new Promise((resolve) => {
        link.onload = () => resolve(true);
        link.onerror = () => resolve(false);
        shadow.insertBefore(link, ui.root);
        setTimeout(() => resolve(false), 4000);
      });
      if (!loaded) return;
    }
    cssReady = true;
    if (ui) ui.root.hidden = false;
    refreshUi();
  }

  function removeHost() {
    clearTimeout(cardTimer);
    clearTimeout(flashTimer);
    if (host && host.isConnected) host.remove();
    host = null;
    shadow = null;
    ui = null;
    cssReady = false;
    markers.clear();
    cardState = "hidden";
    panelOpen = false;
    hoverEl = null;
  }

  /* ---------------------------------------------------------------- */
  /* Scanning                                                          */
  /* ---------------------------------------------------------------- */

  function isOurs(node) {
    return !!host && (node === host || (node instanceof Node && host.contains(node)));
  }

  function onMutations(records) {
    if (!running) return;
    for (const r of records) {
      if (isOurs(r.target)) continue;
      if (r.type === "childList" && r.target === document.documentElement) {
        const nodes = [...r.addedNodes, ...r.removedNodes];
        if (nodes.length && nodes.every(isOurs)) continue;
      }
      scheduleScan();
      return;
    }
  }

  function scheduleScan(immediate) {
    if (!running) return;
    if (document.hidden) {
      pendingScan = true;
      return;
    }
    const t = now();
    if (!firstDirtyAt) firstDirtyAt = t;
    clearTimeout(scanTimer);
    if (idleHandle) return; // an idle scan is already queued
    if (lastScanMs > BUDGET_MS) {
      // The last scan was heavy: wait for the page to be idle.
      scanTimer = 0;
      idleHandle = requestIdle(() => {
        idleHandle = 0;
        scan();
      }, 4000);
      return;
    }
    const wait = immediate ? 0 : Math.max(0, Math.min(DEBOUNCE_MS, firstDirtyAt + MAX_WAIT_MS - t));
    scanTimer = setTimeout(scan, wait);
  }

  function requestIdle(fn, timeout) {
    if (typeof requestIdleCallback === "function") return requestIdleCallback(fn, { timeout });
    return setTimeout(fn, 200);
  }

  function cancelIdle(handle) {
    if (!handle) return;
    if (typeof cancelIdleCallback === "function") cancelIdleCallback(handle);
    else clearTimeout(handle);
  }

  function detect() {
    let found = [];
    try {
      found = D.findProblems(document, { visibleOnly: true }) || [];
    } catch {
      found = [];
    }
    const out = new Map();
    for (const p of found) {
      if (!p || typeof p.id !== "string" || !p.element || out.has(p.id)) continue;
      if (isOurs(p.element)) continue;
      out.set(p.id, p);
    }
    return out;
  }

  function scan() {
    clearTimeout(scanTimer);
    scanTimer = 0;
    firstDirtyAt = 0;
    if (!running) return;
    if (document.hidden) {
      pendingScan = true;
      return;
    }
    pendingScan = false;
    const t0 = now();
    const found = detect();
    lastScanMs = now() - t0;
    scanCount++;

    const next = new Map();
    for (const [id, p] of found) {
      const old = problems.get(id);
      const rec = old || { id, visible: false };
      rec.text = String(p.text || "").slice(0, MAX_PROBLEM);
      rec.expr = String(p.expr || "");
      rec.kind = p.kind;
      rec.level = p.level;
      rec.score = p.score;
      if (rec.element !== p.element) {
        if (rec.element) unobserve(rec.element, id);
        rec.element = p.element;
        // Quiz sites often swap the text inside the same element. That element
        // is already observed and will not report again, so inherit its state.
        rec.visible = elementIds.has(p.element) ? elVisible.get(p.element) === true : false;
        observe(p.element, id);
      }
      next.set(id, rec);
    }
    for (const [id, rec] of problems) {
      if (!next.has(id)) unobserve(rec.element, id);
    }
    problems = next;
    reportCount();
    onVisibilityChanged();
  }

  function observe(el, id) {
    let ids = elementIds.get(el);
    if (!ids) {
      ids = new Set();
      elementIds.set(el, ids);
      if (io) io.observe(el);
    }
    ids.add(id);
  }

  function unobserve(el, id) {
    const ids = elementIds.get(el);
    if (!ids) return;
    ids.delete(id);
    if (!ids.size) {
      elementIds.delete(el);
      if (io) io.unobserve(el);
      dropMarker(el);
    }
  }

  function onIntersect(entries) {
    let changed = false;
    const vh = window.innerHeight || 1;
    for (const en of entries) {
      const ids = elementIds.get(en.target);
      if (!ids) continue;
      const vis =
        en.isIntersecting &&
        (en.intersectionRatio >= 0.2 || en.intersectionRect.height >= Math.min(120, vh * 0.4));
      elVisible.set(en.target, vis);
      for (const id of ids) {
        const rec = problems.get(id);
        if (rec && rec.visible !== vis) {
          rec.visible = vis;
          changed = true;
        }
      }
    }
    if (changed) onVisibilityChanged();
  }

  function byDocOrder(a, b) {
    if (a.element === b.element) return 0;
    const pos = a.element.compareDocumentPosition(b.element);
    return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : pos & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
  }

  function visibleProblems() {
    const out = [];
    for (const rec of problems.values()) if (rec.visible && rec.element.isConnected) out.push(rec);
    return out.sort(byDocOrder);
  }

  function allProblems() {
    return [...problems.values()].filter((r) => r.element.isConnected).sort(byDocOrder);
  }

  function reportCount() {
    const count = problems.size;
    if (count === lastReported) return;
    // Subframes stay quiet until they have something to say, so a page full of
    // ad frames does not churn the badge. Their first report waits a moment so
    // the top frame (which resets the tab's tally) reports first.
    if (!IS_TOP && lastReported <= 0 && count === 0) return;
    if (!IS_TOP && now() < firstReportDue) {
      setTimeout(reportCount, firstReportDue - now() + 10);
      return;
    }
    lastReported = count;
    send({ type: "problems:count", count });
  }

  function startWatching() {
    if (running) return;
    running = true;
    io = new IntersectionObserver(onIntersect, { threshold: [0, 0.05, 0.2, 0.5, 1] });
    for (const el of elementIds.keys()) io.observe(el);
    mo = new MutationObserver(onMutations);
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "open"],
    });
    idleHandle = requestIdle(() => {
      idleHandle = 0;
      scan();
    }, 1200);
  }

  function stopWatching(silent) {
    if (!running) return;
    running = false;
    if (mo) mo.disconnect();
    if (io) io.disconnect();
    mo = null;
    io = null;
    clearTimeout(scanTimer);
    cancelIdle(idleHandle);
    scanTimer = 0;
    idleHandle = 0;
    firstDirtyAt = 0;
    problems = new Map();
    elementIds.clear();
    elVisible = new WeakMap();
    clearMarkers();
    if (!silent && (lastReported > 0 || (IS_TOP && lastReported !== 0))) {
      lastReported = 0;
      send({ type: "problems:count", count: 0 });
    }
  }

  // One-off detection for frames that are not watching (mode "off").
  function quickVisible() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const out = [];
    for (const p of detect().values()) {
      const r = p.element.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0) {
        out.push({ id: p.id, text: String(p.text || "").slice(0, MAX_PROBLEM), expr: p.expr, kind: p.kind, level: p.level, element: p.element, visible: true });
      }
    }
    return out.sort(byDocOrder);
  }

  // The problem the student most likely means: the visible one nearest the
  // middle of the viewport.
  function bestVisible() {
    const list = running ? visibleProblems() : quickVisible();
    if (!list.length) return null;
    const mid = window.innerHeight / 2;
    let best = list[0];
    let bestDist = Infinity;
    for (const p of list) {
      const r = p.element.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best;
  }

  /* ---------------------------------------------------------------- */
  /* Visibility changes: stats, card, markers                          */
  /* ---------------------------------------------------------------- */

  function onVisibilityChanged() {
    const vis = visibleProblems();
    const fresh = vis.filter((p) => !seen.has(p.id));
    for (const p of fresh) {
      seen.add(p.id);
      send({ type: "stats:bump", key: "problemsSeen" });
    }
    if (!uiAllowed()) return;
    if (panelOpen) {
      if (settings.mode !== "off") {
        const other = fresh.find((p) => !current || keyOf(p.text) !== current.key);
        if (other) showNotice(other);
      }
    } else if (settings.mode === "popup") {
      if (!dismissed) {
        if (fresh.length) {
          if (cardState === "launcher" && now() - collapsedAt < REPOP_GAP_MS) {
            pendingNew += fresh.length;
            renderLauncher();
            bounceLauncher();
          } else {
            cardForced = null;
            showCard();
          }
        } else if (cardState === "card" && !cardForced) {
          // With nothing in view the card lists what is on the page; a quiz
          // that is swapping problems shows the new one a moment later.
          if (vis.length || problems.size) renderCard();
          else hideCard(false);
        } else if (cardState === "launcher" && problems.size === 0) {
          hideCard(false);
        }
      }
    }
    // Keep the tab count, the On this page list and the button's badge current.
    if (panelOpen) renderSheet();
    renderLauncher();
    syncMarkers(vis);
  }

  /* ---------------------------------------------------------------- */
  /* Markers and the outline box                                       */
  /* ---------------------------------------------------------------- */

  function syncMarkers(vis) {
    if (!uiAllowed() || settings.mode === "off") {
      clearMarkers();
      return;
    }
    const wanted = new Map(); // Element -> [records]
    for (const p of vis) {
      const list = wanted.get(p.element);
      if (list) list.push(p);
      else wanted.set(p.element, [p]);
    }
    if (!wanted.size && !markers.size) return;
    ensureHost();
    for (const el of [...markers.keys()]) if (!wanted.has(el)) dropMarker(el);
    for (const [el, list] of wanted) {
      let m = markers.get(el);
      if (!m) {
        const btn = h("button", { type: "button", class: "ab-marker", title: "AlgeBridge hint" }, [faceArt(22)]);
        m = { btn, off: null, list };
        btn.addEventListener("click", () => onMarkerClick(el));
        btn.addEventListener("mouseenter", () => setOutline(el));
        btn.addEventListener("mouseleave", () => unhover());
        btn.addEventListener("focus", () => setOutline(el));
        btn.addEventListener("blur", () => unhover());
        ui.markerLayer.appendChild(btn);
        markers.set(el, m);
      }
      m.list = list;
      paintMarker(m);
    }
    measureMarkers();
  }

  // A small green check on the marker once every problem it stands for is
  // solved.
  function paintMarker(m) {
    const list = m.list || [];
    const solved = list.length > 0 && list.every(isSolved);
    if (solved && !m.check) {
      m.check = h("span", { class: "ab-marker-check", "aria-hidden": "true" }, [icon("check", 9)]);
      m.btn.appendChild(m.check);
    } else if (!solved && m.check) {
      m.check.remove();
      m.check = null;
    }
    m.btn.classList.toggle("ab-solved", solved);
    m.btn.title = solved ? "Solved" : "AlgeBridge hint";
    m.btn.setAttribute(
      "aria-label",
      solved
        ? list.length > 1
          ? `Solved, ${list.length} problems here`
          : "Solved. Open this problem again"
        : list.length > 1
          ? `Get a hint, ${list.length} problems here`
          : "Get a hint for this problem",
    );
  }

  function repaintMarkers() {
    for (const m of markers.values()) paintMarker(m);
  }

  function isSolved(p) {
    if (!p || !p.text) return false;
    const s = sessions.get(keyOf(p.text));
    return !!(s && s.solved);
  }

  function dropMarker(el) {
    const m = markers.get(el);
    if (!m) return;
    m.btn.remove();
    markers.delete(el);
    if (hoverEl === el) setOutline(null);
  }

  function clearMarkers() {
    for (const m of markers.values()) m.btn.remove();
    markers.clear();
    setOutline(null);
  }

  function onMarkerClick(el) {
    const m = markers.get(el);
    if (!m) return;
    const list = m.list.filter((p) => problems.has(p.id));
    if (list.length > 1) {
      cardForced = list;
      showCard(true);
    } else if (list.length === 1) {
      openPanelFor(list[0], { auto: true, from: m.btn });
    }
  }

  // Where the marker sits relative to the element's box: just after the
  // widest line of real text, level with the first line. Measured after each
  // scan and resize; scroll only moves the element box, so the offset holds.
  const CLIPPED = ".katex-mathml, mjx-assistive-mml, .MJX_Assistive_MathML, .sr-only, .visually-hidden";

  const RENDERED_MATH = "mjx-container, .MathJax, .MathJax_Display, .MathJax_SVG, .mq-math-mode, math, img[alt]:not([alt=''])";

  function textBox(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let best = null; // the text box that reaches furthest right
    let n = 0;
    for (let node = walker.nextNode(); node && n < 400; node = walker.nextNode()) {
      n++;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      if (parent && parent.closest(CLIPPED)) continue;
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (const r of rects) {
        if (r.width < 2 || r.height < 6) continue;
        // Superscripts are short boxes; prefer a full-height box on a tie.
        if (!best || r.right > best.right + 1 || (Math.abs(r.right - best.right) <= 1 && r.height > best.height)) best = r;
      }
    }
    // Rendered math often has no text nodes of its own (MathJax draws glyphs
    // with CSS, equation editors use images), so count those boxes as text.
    for (const m of el.querySelectorAll(RENDERED_MATH)) {
      if (m.closest(CLIPPED)) continue;
      const r = m.getBoundingClientRect();
      if (r.width < 2 || r.height < 6) continue;
      if (!best || r.right > best.right + 1) best = r;
    }
    if (!best) return null;
    // Center on the line box around that text, not on a raised exponent.
    return { right: best.right, top: best.top, height: best.height };
  }

  function measureMarkers() {
    if (!markers.size) return;
    for (const [el, m] of markers) {
      const box = el.getBoundingClientRect();
      const tb = textBox(el);
      if (tb) {
        m.off = { dx: tb.right - box.left + 6, dy: tb.top - box.top + tb.height / 2 - 11 };

      } else {
        m.off = { dx: box.width - 28, dy: 4 };
      }
    }
    queuePositions();
  }

  function queuePositions() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(positionAll);
  }

  function positionAll() {
    rafPending = false;
    if (!ui) return;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    // Read everything first...
    // Markers under our own card or round button stay hidden rather than
    // peeking out from behind an edge.
    const covers = [];
    if (ui.sheet && !ui.sheet.hidden) covers.push(ui.sheet.getBoundingClientRect());
    if (ui.launcher && !ui.launcher.hidden) covers.push(ui.launcher.getBoundingClientRect());
    const covered = (x, y) => covers.some((c) => x + 26 > c.left && x - 4 < c.right && y + 26 > c.top && y - 4 < c.bottom);
    const moves = [];
    for (const [el, m] of markers) {
      if (!m.off || !el.isConnected) {
        moves.push([m.btn, null]);
        continue;
      }
      const r = el.getBoundingClientRect();
      let x = r.left + m.off.dx;
      const y = r.top + m.off.dy;
      if (x > vw - 30) x = Math.max(r.left, vw - 30);
      const onScreen = r.width > 0 && y > -22 && y < vh && r.bottom > 0 && !covered(x, y);
      moves.push([m.btn, onScreen ? [Math.round(x), Math.round(y)] : null]);
    }
    const outlineRect = hoverEl && hoverEl.isConnected ? hoverEl.getBoundingClientRect() : null;
    // ...then write.
    for (const [btn, at] of moves) {
      if (!at) {
        btn.style.display = "none";
      } else {
        btn.style.display = "";
        btn.style.transform = `translate(${at[0]}px, ${at[1]}px)`;
      }
    }
    if (outlineRect && outlineRect.width > 0) {
      const pad = 4;
      const o = ui.outline.style;
      o.transform = `translate(${Math.round(outlineRect.left - pad)}px, ${Math.round(outlineRect.top - pad)}px)`;
      o.width = `${Math.round(outlineRect.width + pad * 2)}px`;
      o.height = `${Math.round(outlineRect.height + pad * 2)}px`;
      ui.outline.hidden = false;
    } else if (ui.outline) {
      ui.outline.hidden = true;
    }
  }

  function setOutline(el) {
    hoverEl = el && el.isConnected ? el : null;
    if (!ui) return;
    if (!hoverEl) ui.outline.hidden = true;
    queuePositions();
  }

  /* ---------------------------------------------------------------- */
  /* Archie and small art                                              */
  /* ---------------------------------------------------------------- */

  // mascot.js runs just before this script in the same world. If it ever
  // fails to load, the AlgeBridge mark stands in for Archie.
  function mascotArt(pose, size, opts) {
    const M = globalThis.AlgeBridgeMascot;
    try {
      if (M && typeof M.create === "function") return M.create(pose, size, opts);
    } catch {
      /* fall through to the mark */
    }
    return mark(size, true);
  }

  function faceArt(size) {
    const M = globalThis.AlgeBridgeMascot;
    try {
      if (M && typeof M.face === "function") return M.face(size);
    } catch {
      /* fall through to the mark */
    }
    return mark(size, true);
  }

  function avatar() {
    return h("span", { class: "ab-avatar", "aria-hidden": "true" }, [faceArt(26)]);
  }

  function levelText(level) {
    return level === 2 ? "Algebra 2" : "Algebra 1";
  }

  function metaText(kind, level) {
    const parts = [];
    if (kind && KIND_LABELS[kind]) parts.push(KIND_LABELS[kind]);
    if (level === 1 || level === 2) parts.push(levelText(level));
    return parts.join(" · ");
  }

  /* ---------------------------------------------------------------- */
  /* The sheet: one white card pinned to the top right. It opens as    */
  /* "Archie found a problem" and grows, in place, into the hint view. */
  /* ---------------------------------------------------------------- */

  const TABS = [
    ["hints", "Hints"],
    ["page", "On this page"],
    ["idea", "The idea"],
  ];

  function buildSheet() {
    if (ui.sheet) return;
    const P = {};

    // Header: mark, pill tabs, close.
    P.tabs = {};
    P.tablist = h("div", { class: "ab-tabs", role: "tablist", "aria-label": "Sections" });
    for (const [name, label] of TABS) {
      const kids = [h("span", { class: "ab-tab-label", text: label })];
      if (name === "page") {
        P.pageCount = h("span", { class: "ab-tab-count", "aria-hidden": "true", hidden: true });
        kids.push(P.pageCount);
      }
      const tabBtn = h(
        "button",
        { type: "button", class: "ab-tab", role: "tab", id: `ab-tab-${name}`, "aria-selected": "false", "aria-controls": "ab-view", tabindex: "-1" },
        kids,
      );
      tabBtn.addEventListener("click", () => setTab(name));
      P.tablist.appendChild(tabBtn);
      P.tabs[name] = tabBtn;
    }
    P.close = h("button", { type: "button", class: "ab-icon-btn ab-close", "aria-label": "Close hints", title: "Close" }, [icon("close", 16)]);
    P.head = h("header", { class: "ab-head" }, [h("span", { class: "ab-logo", title: "AlgeBridge" }, [mark(26, true)]), P.tablist, P.close]);

    // Found: the hero (Archie, a title, one big button) and preview cards.
    P.heroArt = h("div", { class: "ab-hero-art" }, [mascotArt("idle", 96, { confetti: true })]);
    P.heroTitle = h("h2", { class: "ab-hero-title", id: "ab-hero-title" });
    P.heroSub = h("p", { class: "ab-hero-sub" });
    P.go = h("button", { type: "button", class: "ab-btn ab-primary ab-big ab-go" }, [h("span", { text: "Get a hint" })]);
    P.hero = h("div", { class: "ab-hero" }, [P.heroArt, h("div", { class: "ab-hero-text" }, [P.heroTitle, P.heroSub, P.go])]);
    P.previews = h("ul", { class: "ab-cards", "aria-label": "Problems Archie found" });
    P.moreText = h("span");
    P.more = h("button", { type: "button", class: "ab-more" }, [P.moreText, icon("chevron", 14)]);
    P.found = h("div", { class: "ab-found" }, [P.hero, h("div", { class: "ab-well ab-preview-well" }, [P.previews, P.more])]);

    // On this page: every problem, and the picker for The idea.
    P.pageHead = h("p", { class: "ab-page-head" });
    P.pageList = h("ul", { class: "ab-cards", "aria-label": "Problems on this page" });
    P.pageEmpty = h("p", { class: "ab-page-empty" });
    P.pageScroll = h("div", { class: "ab-scroll ab-fade" }, [P.pageList, P.pageEmpty]);
    P.page = h("div", { class: "ab-page" }, [P.pageHead, h("div", { class: "ab-well ab-page-well" }, [P.pageScroll])]);

    // The hint view: new-problem notice, compact problem row, chat, dock.
    P.noticeText = h("div", { class: "ab-notice-text" });
    P.noticeSwitch = h("button", { type: "button", class: "ab-btn ab-small ab-primary", "aria-label": "Switch to the new problem", text: "Switch" });
    P.noticeClose = h("button", { type: "button", class: "ab-icon-btn ab-small-icon", "aria-label": "Keep this problem" }, [icon("close", 14)]);
    P.notice = h("div", { class: "ab-notice", hidden: true, role: "status" }, [
      h("div", { class: "ab-notice-body" }, [h("span", { class: "ab-notice-label", text: "New problem on screen" }), P.noticeText]),
      P.noticeSwitch,
      P.noticeClose,
    ]);

    P.art = h("span", { class: "ab-problem-art" });
    P.meta = h("span", { class: "ab-chip" });
    P.math = h("h2", { class: "ab-problem-math", id: "ab-problem-title", tabindex: "-1" });
    P.title = P.math;
    P.pview = h("div", { class: "ab-problem-view", title: "Click to edit the problem text" }, [P.math]);
    P.input = h("textarea", {
      class: "ab-textarea",
      rows: "3",
      maxlength: String(MAX_PROBLEM),
      "aria-label": "Problem text",
      placeholder: "Type or paste an algebra problem",
      spellcheck: "false",
      hidden: true,
    });
    P.editDone = h("button", { type: "button", class: "ab-btn ab-small ab-primary", "aria-label": "Use this problem text", text: "Use this problem" });
    P.editCancel = h("button", { type: "button", class: "ab-btn ab-small ab-ghost", "aria-label": "Cancel editing", text: "Cancel" });
    P.editRow = h("div", { class: "ab-edit-row", hidden: true }, [P.editCancel, P.editDone]);
    P.edit = h("button", { type: "button", class: "ab-icon-btn ab-edit", "aria-label": "Edit the problem text", title: "Edit" }, [icon("pencil", 15)]);
    P.solvedChip = h("span", { class: "ab-chip ab-solved-chip", hidden: true }, [icon("check", 12), h("span", { text: "Solved" })]);
    P.chips = h("div", { class: "ab-chips" }, [P.meta, P.solvedChip]);
    P.problem = h("div", { class: "ab-problem" }, [P.art, h("div", { class: "ab-problem-main" }, [P.chips, P.pview, P.input, P.editRow]), P.edit]);

    P.introText = h("p", { class: "ab-bubble-text" });
    P.intro = h("div", { class: "ab-msg ab-archie ab-intro" }, [avatar(), h("div", { class: "ab-bubble" }, [P.introText])]);
    P.thread = h("ol", { class: "ab-thread", "aria-label": "Hints", "aria-live": "polite" });
    P.statusText = h("span", { class: "ab-status-text" });
    P.status = h("div", { class: "ab-msg ab-archie ab-status", role: "status", hidden: true }, [
      avatar(),
      h("div", { class: "ab-bubble ab-typing" }, [h("span", { class: "ab-dots", "aria-hidden": "true" }, [h("i"), h("i"), h("i")]), P.statusText]),
    ]);
    P.errorText = h("p", { class: "ab-error-text" });
    // While the server asks us to wait, the button stays off and slowly fills
    // (a CSS animation, so the alert region is not re-announced every second).
    P.retry = h("button", { type: "button", class: "ab-btn ab-small ab-secondary ab-retry", "aria-label": "Try again" }, [h("span", { class: "ab-retry-label", text: "Try again" })]);
    P.error = h("div", { class: "ab-error", role: "alert", hidden: true }, [icon("alert", 16), h("div", { class: "ab-error-body" }, [P.errorText, P.retry])]);
    // The grey well holds an inner scroller, so its rounded corners stay put
    // and bubbles fade softly at the scroll edges.
    P.threadScroll = h("div", { class: "ab-scroll ab-fade" }, [P.intro, P.thread, P.status, P.error]);
    P.threadWell = h("div", { class: "ab-well ab-thread-well" }, [P.threadScroll]);

    P.ideaText = h("div", { class: "ab-idea-text" });
    P.ideaCard = h("div", { class: "ab-idea", hidden: true }, [
      h("p", { class: "ab-idea-label" }, [h("span", { class: "ab-idea-ico" }, [icon("bulb", 15)]), h("span", { text: "The big idea" })]),
      P.ideaText,
    ]);
    P.ideaEmpty = h("p", { class: "ab-idea-empty", hidden: true });
    P.ideaScroll = h("div", { class: "ab-scroll ab-fade" }, [P.ideaCard, P.ideaEmpty]);
    P.ideaWell = h("div", { class: "ab-well ab-idea-well", "aria-live": "polite", hidden: true }, [P.ideaScroll]);

    P.nextDoneIcon = icon("check", 16);
    P.nextArrow = icon("arrow", 16);
    P.next = h("button", { type: "button", class: "ab-btn ab-primary ab-next" }, [P.nextDoneIcon, h("span", { class: "ab-next-label", text: "Get a hint" }), P.nextArrow]);
    P.check = h("button", { type: "button", class: "ab-btn ab-secondary ab-check", "aria-label": "Check my answer", "aria-expanded": "false" }, [
      icon("target", 15),
      h("span", { text: "Check my answer" }),
    ]);
    // Once the problem is solved, this leads: Next problem, or Done when
    // there is no other problem on the page.
    P.moveLabel = h("span", { class: "ab-move-label", text: "Next problem" });
    P.moveArrow = icon("arrow", 16);
    P.moveDone = icon("check", 16);
    P.move = h("button", { type: "button", class: "ab-btn ab-primary ab-move", hidden: true }, [P.moveDone, P.moveLabel, P.moveArrow]);
    P.actions = h("div", { class: "ab-actions" }, [P.move, P.next, P.check]);
    P.checkInput = h("input", { type: "text", class: "ab-input", maxlength: String(MAX_ANSWER), "aria-label": "Your answer", placeholder: "Your answer, like x = 4", autocomplete: "off", spellcheck: "false" });
    P.checkGo = h("button", { type: "submit", class: "ab-btn ab-small ab-primary", "aria-label": "Check this answer", text: "Check" });
    P.checkForm = h("form", { class: "ab-form", hidden: true, "aria-label": "Check my answer" }, [P.checkInput, P.checkGo]);
    P.askInput = h("input", { type: "text", class: "ab-input ab-ask-input", maxlength: String(MAX_QUESTION), "aria-label": "Ask about this problem", placeholder: "Ask Archie about this problem", autocomplete: "off" });
    P.askGo = h("button", { type: "submit", class: "ab-send", "aria-label": "Send your question", title: "Send" }, [icon("up", 16)]);
    P.askForm = h("form", { class: "ab-ask", "aria-label": "Ask about this problem" }, [P.askInput, P.askGo]);
    P.dock = h("div", { class: "ab-dock" }, [P.actions, P.checkForm, P.askForm]);
    P.work = h("div", { class: "ab-work" }, [P.notice, P.problem, P.threadWell, P.ideaWell, P.dock]);

    P.body = h("div", { class: "ab-view", id: "ab-view", role: "tabpanel" }, [P.found, P.page, P.work]);
    P.later = h("button", { type: "button", class: "ab-later", "aria-label": "Not now, hide this for this page", text: "Not now" });
    P.foot = h("footer", { class: "ab-foot" }, [h("span", { class: "ab-foot-text", text: "Hints only. The answer stays yours to find." }), P.later]);

    const sheet = h("section", { class: "ab-sheet", role: "region", "aria-label": "AlgeBridge hints", hidden: true }, [P.head, P.body, P.foot]);
    ui.root.appendChild(sheet);
    ui.sheet = sheet;
    ui.P = P;

    // Wiring: header
    P.tablist.addEventListener("keydown", onTabKey);
    P.close.addEventListener("click", () => dismissSheet());
    sheet.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      dismissSheet();
    });

    // Found
    P.go.addEventListener("click", () => {
      const list = cardList();
      const first = list.find((p) => !isSolved(p)) || list[0];
      if (first) openPanelFor(first, { auto: true, from: null });
    });
    P.more.addEventListener("click", (e) => {
      setTab("page");
      // From the keyboard, land on the first problem; a mouse click leaves
      // focus (and the page outline) alone.
      const first = P.pageList.querySelector("button");
      if (first && e.detail === 0) first.focus({ preventScroll: true });
    });
    P.later.addEventListener("click", () => {
      dismissed = true;
      hideCard(false);
      setOutline(null);
    });
    sheet.addEventListener("mouseenter", () => {
      if (panelOpen) return;
      cardHover = true;
      clearTimeout(cardTimer);
      const list = cardList();
      if (list.length === 1) setOutline(list[0].element);
    });
    sheet.addEventListener("mouseleave", () => {
      unhover();
      if (panelOpen) return;
      cardHover = false;
      armCardTimer(CARD_AFTER_LEAVE_MS);
    });
    sheet.addEventListener("focusin", () => {
      if (panelOpen) return;
      cardHover = true;
      clearTimeout(cardTimer);
    });
    sheet.addEventListener("focusout", (e) => {
      if (panelOpen || (e.relatedTarget && sheet.contains(e.relatedTarget))) return;
      cardHover = false;
      armCardTimer(CARD_AFTER_LEAVE_MS);
    });

    // Hint view
    P.next.addEventListener("click", () => {
      if (!current) {
        startEdit();
        return;
      }
      if (tab !== "hints") setTab("hints");
      request(current.hints.length === 0 ? "first" : "next");
    });
    P.check.addEventListener("click", () => toggleTool("check"));
    P.checkForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const answer = P.checkInput.value.trim();
      if (!answer) return P.checkInput.focus();
      request("check", answer);
    });
    P.askForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!current) return startEdit();
      const q = P.askInput.value.trim();
      if (!q) return P.askInput.focus();
      if (tab !== "hints") setTab("hints");
      // On a solved problem, asking for the answer gets a local reply: the
      // student already has it, and the server would only offer a next hint.
      if (current.solved && asksForAnswer(q) && !current.loading) return replyLocally(q);
      request("ask", q);
    });
    P.move.addEventListener("click", () => {
      if (!current || !current.solved) return;
      const nxt = nextProblem();
      if (nxt) openNextProblem(nxt);
      else finishSolved();
    });
    P.retry.addEventListener("click", () => {
      if (!current || !current.retry || waitLeft(current) > 0) return;
      request(current.retry.action, current.retry.extra);
    });
    P.edit.addEventListener("click", () => (editing ? commitEdit() : startEdit()));
    P.pview.addEventListener("click", () => startEdit());
    P.editDone.addEventListener("click", () => commitEdit());
    P.editCancel.addEventListener("click", () => cancelEdit());
    P.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape" && current) {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
      }
    });
    P.input.addEventListener("input", () => autosize(P.input));
    P.problem.addEventListener("mouseenter", () => {
      if (currentEl && currentEl.isConnected) setOutline(currentEl);
    });
    P.problem.addEventListener("mouseleave", () => unhover());
    P.noticeSwitch.addEventListener("click", () => {
      const p = notice;
      hideNotice();
      if (p) openPanelFor(p, { auto: false, from: null, keepFocus: true });
    });
    P.noticeClose.addEventListener("click", () => hideNotice());

    // Drag by the header (anywhere that is not a button).
    P.head.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || (e.target instanceof Element && e.target.closest("button"))) return;
      const r = sheet.getBoundingClientRect();
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      try {
        P.head.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      sheet.classList.add("ab-dragging");
      e.preventDefault();
    });
    P.head.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      placePanel(e.clientX - drag.dx, e.clientY - drag.dy);
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      sheet.classList.remove("ab-dragging");
    };
    P.head.addEventListener("pointerup", endDrag);
    P.head.addEventListener("pointercancel", endDrag);
  }

  // Close (X) and Escape: the hint view closes, the card shrinks to the
  // round button.
  function dismissSheet() {
    if (panelOpen) {
      closePanel();
      return;
    }
    collapseCard();
    if (ui && ui.launcher && !ui.launcher.hidden) ui.launcher.focus({ preventScroll: true });
  }

  // Arrow keys move between tabs; Enter or Space opens one.
  function onTabKey(e) {
    if (!ui || !ui.P) return;
    const names = TABS.map((t) => t[0]);
    const at = names.findIndex((n) => ui.P.tabs[n] === shadow.activeElement);
    if (at < 0) return;
    let to = -1;
    if (e.key === "ArrowRight") to = (at + 1) % names.length;
    else if (e.key === "ArrowLeft") to = (at - 1 + names.length) % names.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = names.length - 1;
    if (to < 0) return;
    e.preventDefault();
    ui.P.tabs[names[to]].focus({ preventScroll: true });
  }

  function setTab(name) {
    if (!ui || !ui.P) return;
    if (name === "idea" && !panelOpen) {
      // The idea belongs to one problem. With one on offer, open it there;
      // with several, the tab lists them to pick from.
      const items = cardList();
      if (items.length === 1) {
        openPanelFor(items[0], { auto: false, from: null, tab: "idea" });
        return;
      }
    }
    if (name === "page" && !running) pageCache = quickVisible();
    tab = name;
    renderSheet();
    if (name === "idea" && panelOpen && current && !current.concept && !current.loading) request("concept");
  }

  function pageList() {
    return running ? allProblems() : pageCache || [];
  }

  function cardList() {
    if (cardForced) return cardForced.filter((p) => problems.has(p.id));
    const vis = visibleProblems();
    return vis.length ? vis : allProblems();
  }

  // One white card per problem, reused by the preview well, On this page,
  // and the picker for The idea. The same problems keep the same buttons,
  // so hover and focus survive rescans.
  function fillCards(list, items, o) {
    const curKey = panelOpen && current ? current.key : "";
    const solved = items.map(isSolved);
    const sig = `${o.mode}|${curKey}|${items.map((p, i) => p.id + (solved[i] ? "+" : "")).join("|")}`;
    if (list.dataset.sig === sig && list.childElementCount === items.length) return;
    list.dataset.sig = sig;
    list.textContent = "";
    items.forEach((p, i) => list.appendChild(h("li", null, [problemCard(p, i, o, curKey, solved[i])])));
  }

  function problemCard(p, i, o, curKey, solved) {
    const expr = p.expr || p.text;
    const isCurrent = !!curKey && keyOf(p.text) === curKey;
    const idea = o.mode === "idea";
    const meta = metaText(p.kind, p.level);
    const kids = [];
    if (o.numbered) {
      // A solved problem trades its number for a green check, like a list
      // of tasks ticked off.
      kids.push(
        solved
          ? h("span", { class: "ab-pcard-num ab-pcard-done", "aria-hidden": "true" }, [icon("check", 13)])
          : h("span", { class: "ab-pcard-num", "aria-hidden": "true", text: String(i + 1) }),
      );
    }
    kids.push(
      h("span", { class: "ab-pcard-main" }, [
        mathNode("span", "ab-pcard-math ab-oneline", expr),
        meta ? h("span", { class: "ab-pcard-meta", text: meta }) : null,
      ]),
    );
    const pillText = solved && !idea ? "Solved" : isCurrent ? "Open" : idea ? "Idea" : "Hint";
    kids.push(
      h("span", { class: "ab-pcard-pill" + (isCurrent ? " ab-current" : "") + (solved && !idea ? " ab-solved" : ""), "aria-hidden": "true" }, [
        solved && !idea ? icon("check", 13) : idea && !isCurrent ? icon("bulb", 13) : null,
        h("span", { text: pillText }),
      ]),
    );
    const label = solved && !idea
      ? `Problem ${i + 1}, solved${isCurrent ? " and open now" : ""}: ${expr}`
      : isCurrent
        ? `Problem ${i + 1}, open now: ${expr}`
        : idea
          ? `See the big idea for problem ${i + 1}: ${expr}`
          : `Get a hint for problem ${i + 1}: ${expr}`;
    const cls = "ab-pcard" + (isCurrent ? " ab-current" : "") + (solved ? " ab-solved" : "");
    const btn = h("button", { type: "button", class: cls, "aria-label": label, title: tidy(p.text) }, kids);
    btn.addEventListener("click", () => openPanelFor(p, { auto: !idea, from: null, keepFocus: panelOpen, tab: idea ? "idea" : "hints" }));
    btn.addEventListener("mouseenter", () => setOutline(p.element));
    btn.addEventListener("mouseleave", () => unhover());
    btn.addEventListener("focus", () => setOutline(p.element));
    btn.addEventListener("blur", () => unhover());
    return btn;
  }

  /* ---------------------------------------------------------------- */
  /* Card state: shown, shrunk to the round button, or hidden          */
  /* ---------------------------------------------------------------- */

  function buildLauncher() {
    if (ui.launcher) return;
    const count = h("span", { class: "ab-fab-count", "aria-hidden": "true", hidden: true });
    const btn = h(
      "button",
      { type: "button", class: "ab-fab", "aria-label": "Open AlgeBridge hints", title: "AlgeBridge hints", hidden: true },
      [faceArt(56), count],
    );
    btn.addEventListener("click", () => onLauncherClick());
    btn.addEventListener("animationend", () => btn.classList.remove("ab-bounce"));
    ui.root.appendChild(btn);
    ui.launcher = btn;
    ui.launcherCount = count;
  }

  function onLauncherClick() {
    pendingNew = 0;
    // Pick up where the student left off, if that problem is still here and
    // not already solved (Done means done; the list shows what is left).
    if (current && !current.solved && (current.thread.length || current.concept) && (!currentEl || currentEl.isConnected)) {
      openPanelFor(
        { text: current.text, id: currentId, element: currentEl, kind: current.kind, level: current.level },
        { auto: false, from: ui.launcher, tab: lastTab === "idea" ? "idea" : "hints" },
      );
      return;
    }
    if (problems.size) {
      cardForced = null;
      showCard(true);
    } else {
      openPanelFor(null, { auto: false, from: ui.launcher });
    }
  }

  function showCard(byHand) {
    if (!uiAllowed()) return;
    if (!byHand && settings.mode !== "popup") return;
    ensureHost();
    buildSheet();
    buildLauncher();
    pendingNew = 0;
    if (panelOpen) {
      // The hint view is up: show the list in the same card instead.
      cardForced = null;
      setTab("page");
      return;
    }
    const wasCard = cardState === "card";
    const wasShown = !ui.sheet.hidden;
    cardState = "card";
    if (!wasCard) tab = "hints";
    renderSheet();
    renderLauncher();
    if (cssReady && !wasShown && !ui.sheet.hidden) enterSheet(true);
    if (!cardHover) armCardTimer(CARD_MS);
  }

  // Slide the card down into place; Archie pops in with his confetti.
  function enterSheet(withHero) {
    if (!ui || !ui.sheet) return;
    const sh = ui.sheet;
    sh.classList.remove("ab-enter");
    void sh.offsetWidth;
    sh.classList.add("ab-enter");
    if (withHero) {
      const art = ui.P.heroArt;
      art.textContent = "";
      art.appendChild(mascotArt("idle", 96, { confetti: true }));
    }
  }

  function armCardTimer(ms) {
    clearTimeout(cardTimer);
    if (cardState !== "card") return;
    cardTimer = setTimeout(() => {
      if (!cardHover) collapseCard();
    }, ms);
  }

  function collapseCard() {
    clearTimeout(cardTimer);
    if (cardState !== "card") return;
    cardState = problems.size || cardForced ? "launcher" : "hidden";
    cardForced = null;
    collapsedAt = now();
    cardHover = false;
    setOutline(null);
    renderCard();
    renderLauncher();
  }

  function hideCard(keepLauncher) {
    clearTimeout(cardTimer);
    cardState = keepLauncher ? "launcher" : "hidden";
    cardForced = null;
    cardHover = false;
    renderCard();
    renderLauncher();
  }

  function renderCard() {
    renderSheet();
  }

  function renderPanel() {
    renderSheet();
  }

  function renderLauncher() {
    if (!ui || !ui.launcher) return;
    const show =
      cssReady && cardState === "launcher" && !panelOpen && !dismissed && uiAllowed() && settings.mode === "popup";
    if (ui.launcher.hidden !== !show && markers.size) queuePositions();
    ui.launcher.hidden = !show;
    const n = problems.size;
    ui.launcherCount.hidden = !(n > 0);
    ui.launcherCount.textContent = n > 9 ? "9+" : String(n);
    ui.launcher.setAttribute(
      "aria-label",
      n > 0 ? `Open AlgeBridge hints, ${n} ${n === 1 ? "problem" : "problems"} on this page` : "Open AlgeBridge hints",
    );
  }

  // One soft bounce when a new problem turns up while the card is small.
  function bounceLauncher() {
    if (!ui || !ui.launcher || ui.launcher.hidden) return;
    ui.launcher.classList.remove("ab-bounce");
    void ui.launcher.offsetWidth;
    ui.launcher.classList.add("ab-bounce");
  }

  /* ---------------------------------------------------------------- */
  /* Rendering the sheet                                               */
  /* ---------------------------------------------------------------- */

  function renderSheet() {
    if (!ui || !ui.sheet) return;
    const P = ui.P;
    const cardItems = panelOpen ? [] : cardList();
    const show = cssReady && (panelOpen || (cardState === "card" && cardItems.length > 0));
    if (ui.sheet.hidden !== !show && markers.size) queuePositions();
    ui.sheet.hidden = !show;
    if (!show) return;

    const view = panelOpen ? "panel" : "card";
    if (ui.sheet.dataset.view !== view) {
      ui.sheet.dataset.view = view;
      ui.sheet.setAttribute("role", view === "panel" ? "dialog" : "region");
      if (view === "panel") ui.sheet.setAttribute("aria-modal", "false");
      else ui.sheet.removeAttribute("aria-modal");
      // Same card, new contents: a quick fade, no jump.
      P.body.classList.remove("ab-swap");
      void P.body.offsetWidth;
      P.body.classList.add("ab-swap");
    }

    for (const [name] of TABS) {
      const on = tab === name;
      P.tabs[name].setAttribute("aria-selected", String(on));
      P.tabs[name].tabIndex = on ? 0 : -1;
      P.tabs[name].classList.toggle("ab-on", on);
    }
    P.body.setAttribute("aria-labelledby", `ab-tab-${tab}`);
    const pageItems = pageList();
    const n = pageItems.length;
    P.pageCount.hidden = !n;
    P.pageCount.textContent = n > 99 ? "99+" : String(n);
    P.tabs.page.setAttribute("aria-label", n ? `On this page, ${n} ${n === 1 ? "problem" : "problems"}` : "On this page");
    P.close.setAttribute("aria-label", view === "panel" ? "Close hints" : "Minimize to a small button");
    P.close.title = view === "panel" ? "Close" : "Minimize";

    const pickIdea = view === "card" && tab === "idea";
    P.found.hidden = !(view === "card" && tab === "hints");
    P.page.hidden = !(tab === "page" || pickIdea);
    P.work.hidden = !(view === "panel" && tab !== "page");
    P.later.hidden = view !== "card";

    if (!P.found.hidden) renderFound(cardItems);
    if (!P.page.hidden) renderPage(pickIdea ? cardItems : pageItems, pickIdea);
    if (!P.work.hidden) renderWork();
    if (panelPos) placePanel(panelPos.x, panelPos.y);
    if (markers.size) queuePositions();
  }

  function renderFound(items) {
    const P = ui.P;
    const total = cardForced ? items.length : Math.max(problems.size, items.length);
    P.heroTitle.textContent = total === 1 ? "Archie found an algebra problem" : `Archie found ${total} algebra problems`;
    P.heroSub.textContent =
      total === 1
        ? "Press Get a hint to work through it one step at a time."
        : "Pick one below, or press Get a hint to start with the first.";
    P.go.setAttribute("aria-label", total === 1 ? "Get a hint" : "Get a hint for the first problem");
    const shown = items.slice(0, 3);
    fillCards(P.previews, shown, { mode: "preview", numbered: false });
    const more = total - shown.length;
    P.more.hidden = more <= 0;
    P.moreText.textContent = `+${more} more`;
    P.more.setAttribute("aria-label", `See all ${total} problems on this page`);
  }

  function renderPage(items, pickIdea) {
    const P = ui.P;
    P.pageHead.textContent = pickIdea
      ? "Pick a problem and Archie will explain the big idea behind it."
      : items.length
        ? "Pick a problem to work through it one step at a time."
        : "";
    P.pageHead.hidden = !P.pageHead.textContent;
    fillCards(P.pageList, items, { mode: pickIdea ? "idea" : "page", numbered: true });
    P.pageList.hidden = !items.length;
    P.pageEmpty.hidden = items.length > 0;
    P.pageEmpty.textContent = running
      ? "Archie has not spotted a problem on this page yet. You can type one in the Hints tab."
      : "Archie looks for problems on screen. Scroll to one, or type one in the Hints tab.";
  }

  function threadItem(item) {
    if (item.t === "you") {
      const lead = item.check
        ? h("span", { class: "ab-you-label", text: "My answer" })
        : h("span", { class: "ab-sr", text: "You asked: " });
      return h("li", { class: "ab-msg ab-you" }, [h("div", { class: "ab-bubble" }, [lead, mathNode("span", "ab-bubble-text", item.text)])]);
    }
    if (item.t === "verdict") {
      // A correct answer gets Archie jumping with confetti beside a green
      // line; anything else gets an amber line with the slip to look at.
      const good = item.verdict === "correct";
      const art = good
        ? h("span", { class: "ab-party", "aria-hidden": "true" }, [mascotArt("party", 60, { confetti: true, shadow: false })])
        : avatar();
      return h("li", { class: "ab-msg ab-archie ab-verdict-msg" }, [
        art,
        h("div", { class: "ab-bubble ab-verdict " + (good ? "ab-good" : "ab-warn") }, [
          good ? null : h("span", { class: "ab-verdict-ico" }, [icon("alert", 16)]),
          mathNode("p", "ab-verdict-text", item.text),
        ]),
      ]);
    }
    const kids = [];
    if (item.t === "hint") kids.push(h("span", { class: "ab-step", text: `Step ${item.n}` }));
    kids.push(mathNode("div", "ab-bubble-text", item.text));
    return h("li", { class: "ab-msg ab-archie" + (item.t === "hint" ? " ab-hint" : "") }, [avatar(), h("div", { class: "ab-bubble" }, kids)]);
  }

  function renderWork() {
    const P = ui.P;
    const s = current;
    const ideaTab = tab === "idea";

    // Compact problem row: Archie thinks while a request is out and
    // celebrates a correct answer.
    const pose = s && s.loading ? "thinking" : s && s.verdict && s.verdict.verdict === "correct" ? "party" : "idle";
    if (P.artPose !== pose) {
      P.art.textContent = "";
      P.art.appendChild(mascotArt(pose, 52, { shadow: false, confetti: pose === "party" }));
      P.artPose = pose;
    }
    P.pview.hidden = editing || !s;
    P.input.hidden = !(editing || !s);
    P.editRow.hidden = !(editing || !s);
    P.editCancel.hidden = !s;
    P.edit.hidden = editing || !s;
    if (s) {
      P.math.textContent = "";
      appendMathTo(P.math, s.text, 0);
    }
    if (P.input.hidden === false && !P.input.value && s) P.input.value = s.text;
    // Solved: the green Solved chip joins the row, and the kind alone keeps
    // the row to one line.
    const meta = s ? (s.solved && metaText(s.kind, null)) || metaText(s.kind, s.level) : "";
    P.meta.hidden = !meta;
    P.meta.textContent = meta;
    P.chips.hidden = !meta && !(s && s.solved);

    // Chat: append only what is new, so screen readers announce one hint.
    P.threadWell.hidden = ideaTab;
    P.ideaWell.hidden = !ideaTab;
    const items = s ? s.thread : [];
    const listKey = s ? s.key : "";
    if (P.thread.dataset.key !== listKey || P.thread.children.length > items.length) {
      P.thread.textContent = "";
      P.thread.dataset.key = listKey;
    }
    for (let i = P.thread.children.length; i < items.length; i++) P.thread.appendChild(threadItem(items[i]));
    let lastHint = null;
    for (const li of P.thread.children) {
      li.classList.remove("ab-latest");
      if (li.classList.contains("ab-hint")) lastHint = li;
    }
    if (lastHint) lastHint.classList.add("ab-latest");
    P.thread.hidden = !items.length;
    P.intro.hidden = !!items.length || !!(s && (s.loading || s.error));
    P.introText.textContent = s
      ? "Hints come one step at a time. Each one points to your next move, and you do the work."
      : "Type or paste an algebra problem above. Archie will help you work through it one step at a time.";

    // The idea
    const concept = s && s.concept;
    P.ideaCard.hidden = !concept;
    if (concept && P.ideaText.dataset.text !== concept) {
      P.ideaText.textContent = "";
      appendMathTo(P.ideaText, concept, 0);
      P.ideaText.dataset.text = concept;
    }
    const ideaBusy = !!(s && s.loading === "concept");
    const ideaErr = !!(s && s.error && s.errorFrom === "concept");
    P.ideaEmpty.hidden = !!concept || ideaBusy || ideaErr;
    P.ideaEmpty.textContent = !s
      ? "Type or paste a problem first, then Archie can explain the big idea behind it."
      : s.loading
        ? "Archie is finishing your hint first. The big idea comes right after."
        : "Archie can explain the idea this problem turns on. Open this tab again to ask him.";

    // Loading and errors sit at the end of whichever tab asked for them.
    const well = ideaTab ? P.ideaScroll : P.threadScroll;
    if (P.status.parentNode !== well) well.appendChild(P.status);
    if (P.error.parentNode !== well) well.appendChild(P.error);
    const busyHere = !!(s && s.loading && (s.loading === "concept") === ideaTab);
    P.status.hidden = !busyHere;
    P.statusText.textContent = busyHere ? LOADING[s.loading] || "Working on it" : "";
    const errHere = !!(s && s.error && (s.errorFrom === "concept") === ideaTab);
    P.error.hidden = !errHere;
    P.errorText.textContent = errHere ? s.error : "";
    P.retry.hidden = !(errHere && s.retry);

    // Check my answer
    P.checkForm.hidden = tool !== "check";
    P.check.setAttribute("aria-expanded", String(tool === "check"));
    P.check.classList.toggle("ab-on", tool === "check");

    // Buttons. With a hint for every step, Check my answer becomes the main
    // action and Next hint turns into a quiet "all steps covered" note.
    // Solved: Next problem (or Done) leads, Next hint and Ask stay on as
    // secondary, and Check my answer steps aside.
    const busy = !!(s && s.loading);
    const done = !!(s && s.done);
    const solved = !!(s && s.solved);
    const nextLabel = !s || s.hints.length === 0 ? "Get a hint" : done ? "All steps covered" : "Next hint";
    P.next.querySelector(".ab-next-label").textContent = nextLabel;
    P.nextDoneIcon.style.display = done ? "" : "none";
    P.nextArrow.style.display = done || solved ? "none" : "";
    P.next.classList.toggle("ab-primary", !done && !solved);
    P.next.classList.toggle("ab-secondary", solved && !done);
    P.next.classList.toggle("ab-quiet", done);
    P.next.hidden = solved && done;
    P.check.hidden = solved;
    const checkLead = done && tool !== "check";
    P.check.classList.toggle("ab-primary", checkLead);
    P.check.classList.toggle("ab-secondary", !checkLead);
    P.next.setAttribute("aria-label", nextLabel);
    P.next.disabled = busy || done;
    P.checkGo.disabled = busy;
    P.askGo.disabled = busy;
    P.dock.classList.toggle("ab-solved-dock", solved);
    P.move.hidden = !solved;
    P.solvedChip.hidden = !solved;
    if (solved) {
      const nxt = nextProblem();
      const label = nxt ? "Next problem" : "Done";
      P.moveLabel.textContent = label;
      P.moveArrow.style.display = nxt ? "" : "none";
      P.moveDone.style.display = nxt ? "none" : "";
      P.move.setAttribute("aria-label", nxt ? `Next problem: ${tidy(nxt.expr || nxt.text).slice(0, 80)}` : "Done, put hints away");
    }

    // Try again waits out the server's retryAfter, then turns back on. When
    // a hint was what failed, Next hint is the same request, so it waits too
    // (a slow check does not hold hints back).
    const left = waitLeft(s);
    P.retry.disabled = busy || left > 0;
    if (left > 0 && s.retry && (s.retry.action === "first" || s.retry.action === "next")) P.next.disabled = true;
    P.retry.classList.toggle("ab-waiting", left > 0);
    if (left > 0) {
      P.retry.style.setProperty("--ab-wait-total", `${(s.retryMs / 1000).toFixed(2)}s`);
      P.retry.style.setProperty("--ab-wait-delay", `${(-(s.retryMs - left) / 1000).toFixed(2)}s`);
    }
    P.threadWell.setAttribute("aria-busy", String(busy));
  }

  // Milliseconds left before Try again turns back on.
  function waitLeft(s) {
    return s && s.retryAt ? Math.max(0, s.retryAt - Date.now()) : 0;
  }

  // After a reply: if focus was on a control in the card and got dropped
  // (the control turned off or hid), put it back there, or on what leads
  // now: Next problem once solved, Check my answer once every step is
  // covered, else Next hint or the problem heading. Focus the student moved elsewhere
  // (into the page, say) stays where it is.
  function refocus(keep, s) {
    if (!keep || !ui || !ui.P || current !== s || !panelOpen) return;
    const a = document.activeElement;
    const inCard = a === host && shadow.activeElement && !shadow.activeElement.disabled && shadow.activeElement.getClientRects().length > 0;
    const dropped = !a || a === document.body || a === document.documentElement || (a === host && !inCard);
    if (!dropped) return;
    const P = ui.P;
    const usable = (el) => el && el.isConnected && !el.disabled && el.getClientRects().length > 0;
    const target = [keep, s.solved ? P.move : null, s.done ? P.check : null, P.next, P.title].find(usable);
    try {
      if (target) target.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  /* ---------------------------------------------------------------- */
  /* Opening and closing the hint view                                 */
  /* ---------------------------------------------------------------- */

  function placePanel(x, y) {
    if (!ui || !ui.sheet) return;
    const panel = ui.sheet;
    const w = panel.offsetWidth;
    const ht = panel.offsetHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const cx = Math.round(Math.min(Math.max(8, x), Math.max(8, vw - w - 8)));
    const cy = Math.round(Math.min(Math.max(8, y), Math.max(8, vh - ht - 8)));
    panelPos = { x: cx, y: cy };
    panel.style.left = cx + "px";
    panel.style.top = cy + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function sessionFor(text, hint) {
    const key = keyOf(text);
    let s = sessions.get(key);
    if (!s) {
      const sc = hint && hint.kind ? null : scoreOf(text);
      s = {
        key,
        text,
        hints: [],
        thread: [], // what the chat shows: hints, questions, replies
        sealed: null,
        step: -1,
        steps: 0,
        done: false,
        kind: (hint && hint.kind) || (sc && sc.isAlgebra ? sc.kind : null),
        level: (hint && hint.level) || (sc && sc.isAlgebra ? sc.level : null),
        concept: null,
        verdict: null,
        checks: 0,
        solved: false, // a check came back correct: the problem is done
        loading: null,
        error: null,
        errorFrom: null,
        retry: null,
        retryAt: 0, // Date.now() when Try again turns back on
        retryMs: 0,
        retryTimer: 0,
      };
      sessions.set(key, s);
    }
    return s;
  }

  function openPanelFor(p, opts) {
    const o = opts || {};
    if (!uiAllowed()) return false;
    ensureHost();
    buildSheet();
    buildLauncher();
    if (!o.keepFocus && !panelOpen) {
      const active = shadow && shadow.activeElement;
      restoreFocus = o.from || active || (document.activeElement !== host ? document.activeElement : null);
    }
    const wasShown = !ui.sheet.hidden;
    const text = p && p.text ? String(p.text).slice(0, MAX_PROBLEM).trim() : "";
    current = text ? sessionFor(text, p) : null;
    currentId = p && p.id ? p.id : null;
    currentEl = p && p.element ? p.element : null;
    if (notice && current && keyOf(notice.text) === current.key) hideNotice();
    if (!running) pageCache = quickVisible();
    tool = null;
    tab = o.tab === "idea" ? "idea" : "hints";
    editing = !current;
    if (!current) ui.P.input.value = "";
    panelOpen = true;
    cardHover = false;
    clearTimeout(cardTimer);
    if (cardState === "card") {
      cardState = problems.size ? "launcher" : "hidden";
      cardForced = null;
    }
    setOutline(null);
    renderSheet();
    renderLauncher();
    if (cssReady && !wasShown) enterSheet(false);
    const P = ui.P;
    const focusTarget = editing ? P.input : P.title;
    const doFocus = () => {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    };
    if (cssReady) doFocus();
    else setTimeout(doFocus, 300);
    if (current && !current.loading && !current.error) {
      if (tab === "idea" && !current.concept) request("concept");
      else if (tab === "hints" && o.auto && current.hints.length === 0 && !current.solved) request("first");
    }
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Solved: Next problem, Done, and the local reply to "the answer?"  */
  /* ---------------------------------------------------------------- */

  // The next unsolved problem on the page after the open one, wrapping
  // around to the top; null when every other problem is solved too.
  function nextProblem() {
    const list = pageList().filter((p) => p && p.element && p.element.isConnected);
    if (!list.length) return null;
    const curKey = current ? current.key : "";
    let at = currentId ? list.findIndex((p) => p.id === currentId) : -1;
    if (at < 0 && curKey) at = list.findIndex((p) => keyOf(p.text) === curKey);
    const open = (p) => keyOf(p.text) !== curKey && !isSolved(p);
    for (let i = at + 1; i < list.length; i++) if (open(list[i])) return list[i];
    for (let i = 0; i < at; i++) if (open(list[i])) return list[i];
    return null;
  }

  function reducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function openNextProblem(p) {
    const el = p.element;
    try {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    } catch {
      /* the page keeps its scroll */
    }
    // No automatic hint: the student gets a go at it first.
    openPanelFor(p, { auto: false, from: null, keepFocus: true });
    flashOutline(el);
  }

  // Outline the problem on the page for a moment, so the eye finds it. The
  // card may shrink under a still mouse right then; that mouseleave must
  // not cut the moment short.
  function flashOutline(el) {
    flashEl = el;
    setOutline(el);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashEl = null;
      if (hoverEl === el) setOutline(null);
    }, 1600);
  }

  // Mouse or focus left something that outlined a problem.
  function unhover() {
    if (flashEl && hoverEl === flashEl) return;
    setOutline(null);
  }

  // Done: the card shrinks to the round button (in popup mode), or closes.
  function finishSolved() {
    closePanel();
    if (settings.mode === "popup" && !dismissed && uiAllowed()) {
      cardState = "launcher";
      renderLauncher();
      const a = document.activeElement;
      const lost = !a || a === document.body || a === document.documentElement || (a === host && shadow && !shadow.activeElement);
      if (lost && ui && ui.launcher && !ui.launcher.hidden) ui.launcher.focus({ preventScroll: true });
    }
  }

  // Questions that ask for the answer itself ("what is the answer", "what's
  // x", "x = ?", "solve it for me").
  function asksForAnswer(q) {
    const t = String(q || "")
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (/\b(?:answer|solution)s?\b/.test(t) && /\b(?:what|whats|tell|give|show|say|need|want|is|was|the|final|real|right|correct)\b/.test(t)) return true;
    if (/^(?:the )?(?:answer|solution)s?\s*\??$/.test(t)) return true;
    if (/\bwhat(?:'?s| is| was| does| do)\s+(?:the value of\s+)?[a-z]\s*(?:=|equals?|\?|$)/.test(t)) return true;
    if (/^[a-z]\s*=\s*\?*$/.test(t)) return true;
    if (/\bsolve (?:it|this|that)(?: for me)?\b/.test(t) && /\bfor me\b|\bcan you\b|\bjust\b|\bplease\b/.test(t)) return true;
    return false;
  }

  function replyLocally(q) {
    const s = current;
    const P = ui.P;
    s.thread.push({ t: "you", text: q.slice(0, MAX_QUESTION) });
    s.thread.push({ t: "archie", text: nextProblem() ? SOLVED_ASK_NEXT : SOLVED_ASK_LAST });
    P.askInput.value = "";
    renderPanel();
    scrollIntoWell(P.thread.lastElementChild);
  }

  function closePanel() {
    if (!panelOpen || !ui || !ui.sheet) return;
    lastTab = tab;
    panelOpen = false;
    collapsedAt = now(); // a new problem soon after this bounces the button instead of popping the card
    editing = false;
    tool = null;
    drag = null;
    tab = "hints";
    hideNotice();
    setOutline(null);
    if (settings.mode === "popup" && !dismissed && problems.size) cardState = "launcher";
    renderSheet();
    renderLauncher();
    const back = restoreFocus;
    restoreFocus = null;
    if (back && back.isConnected) {
      try {
        if (back.closest && back.getRootNode && back.getRootNode() === shadow && back.offsetParent === null && ui.launcher && !ui.launcher.hidden) {
          ui.launcher.focus({ preventScroll: true });
        } else back.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    } else if (ui.launcher && !ui.launcher.hidden) {
      ui.launcher.focus({ preventScroll: true });
    }
  }

  function showNotice(p) {
    if (!ui || !ui.P) return;
    notice = p;
    const P = ui.P;
    P.noticeText.textContent = "";
    P.noticeText.appendChild(mathNode("span", "ab-math ab-oneline", p.expr || p.text));
    P.notice.hidden = false;
  }

  function hideNotice() {
    notice = null;
    if (ui && ui.P) ui.P.notice.hidden = true;
  }

  function toggleTool(name) {
    if (!current) return startEdit();
    tool = tool === name ? null : name;
    if (tab !== "hints" && tab !== "idea") tab = "hints";
    renderPanel();
    if (tool === "check") {
      ui.P.checkInput.focus({ preventScroll: true });
      // The dock just grew: keep the newest bubble in view.
      scrollIntoWell(ui.P.thread.lastElementChild);
    }
  }

  function startEdit() {
    if (!ui || !ui.P) return;
    editing = true;
    if (tab === "page") tab = "hints";
    renderPanel();
    const P = ui.P;
    P.input.value = current ? current.text : "";
    autosize(P.input);
    P.input.focus({ preventScroll: true });
    if (current) P.input.setSelectionRange(P.input.value.length, P.input.value.length);
  }

  function cancelEdit() {
    if (!current) return; // nothing to go back to
    editing = false;
    renderPanel();
    ui.P.edit.focus({ preventScroll: true });
  }

  function commitEdit() {
    const P = ui.P;
    const text = P.input.value.replace(/\s+/g, " ").trim().slice(0, MAX_PROBLEM);
    if (!text) {
      P.input.focus({ preventScroll: true });
      return;
    }
    if (!current || keyOf(text) !== current.key) {
      // New text means a new problem: fresh hints, fresh sealed solution.
      current = sessionFor(text, null);
      currentId = null;
      currentEl = null;
    }
    editing = false;
    renderPanel();
    P.next.focus({ preventScroll: true });
    if (tab === "idea" && !current.concept && !current.loading) request("concept");
  }

  function autosize(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(140, Math.max(64, ta.scrollHeight + 2)) + "px";
  }

  // Bring a new bubble into view inside its scrolling well. A bubble taller
  // than the well shows from its first line.
  function scrollIntoWell(el) {
    if (!el || el.hidden) return;
    const well = el.closest(".ab-scroll");
    if (!well) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (el.offsetHeight > well.clientHeight - 16) well.scrollTop = Math.max(0, top - 8);
    else if (bottom > well.scrollTop + well.clientHeight || top < well.scrollTop) well.scrollTop = Math.max(0, bottom - well.clientHeight + 10);
  }

  function waitWords(secs) {
    if (secs <= 1) return "a second";
    if (secs < 90) return `about ${secs} seconds`;
    return `about ${Math.round(secs / 60)} minutes`;
  }

  // { message, retry, waitMs }: retry false hides Try again; waitMs keeps it
  // off until the server said it is worth asking again.
  function friendlyError(res) {
    if (!res) return { message: ERRORS.unknown, retry: true, waitMs: 0 };
    if (res.__error) {
      if (res.__error === "invalidated" || /context invalidated/i.test(res.__error)) {
        markInvalidated();
        return { message: ERRORS.invalidated, retry: false, waitMs: 0 };
      }
      return { message: ERRORS.offline, retry: true, waitMs: 0 };
    }
    const code = typeof res.error === "string" ? res.error : "unknown";
    const message = typeof res.message === "string" && res.message.trim() ? tidy(res.message).slice(0, 300) : ERRORS[code] || ERRORS.unknown;
    if (NO_RETRY.has(code)) return { message, retry: false, waitMs: 0 };
    const wait = Number(res.retryAfter);
    if (Number.isFinite(wait) && wait > 0) {
      // An honest wait, in the number the server gave.
      const secs = Math.min(3600, Math.ceil(wait));
      const lead = code === "rate" ? "That is a lot of hints in a short time." : "Archie is busy.";
      return { message: `${lead} Try again in ${waitWords(secs)}.`, retry: true, waitMs: secs * 1000 };
    }
    return { message, retry: true, waitMs: 0 };
  }

  function armRetryWait(s, ms) {
    clearTimeout(s.retryTimer);
    s.retryAt = ms > 0 ? Date.now() + ms : 0;
    s.retryMs = ms > 0 ? ms : 0;
    s.retryTimer = 0;
    if (ms > 0) {
      s.retryTimer = setTimeout(() => {
        s.retryTimer = 0;
        if (current === s && panelOpen) renderPanel();
      }, ms + 30);
    }
  }

  async function request(action, extra) {
    const s = current;
    if (!s || s.loading) return;
    const payload = {
      problem: s.text.slice(0, MAX_PROBLEM),
      action,
      hints: s.hints.slice(-MAX_HINTS).map((x) => String(x).slice(0, MAX_HINT_LEN)),
    };
    if (s.sealed) payload.sealed = s.sealed;
    if (action === "check") {
      payload.answer = String(extra || "").slice(0, MAX_ANSWER);
      const last = s.thread[s.thread.length - 1];
      if (!(last && last.t === "you" && last.check && last.pending && last.text === payload.answer)) {
        s.thread.push({ t: "you", check: true, text: payload.answer, pending: true });
      }
    }
    if (action === "ask") {
      payload.question = String(extra || "").slice(0, MAX_QUESTION);
      // The question shows in the chat right away, like a sent message. A
      // retry of the same question does not add it twice.
      const last = s.thread[s.thread.length - 1];
      if (!(last && last.t === "you" && last.pending && last.text === payload.question)) {
        s.thread.push({ t: "you", text: payload.question, pending: true });
      }
      if (ui && ui.P && current === s) ui.P.askInput.value = "";
    }
    // The control the student used. Buttons turn off while Archie works,
    // and Chrome then drops their focus; it comes back after (see below).
    const keep = current === s && ui && host && document.activeElement === host ? shadow.activeElement : null;
    s.loading = action;
    s.error = null;
    s.errorFrom = null;
    s.retry = null;
    armRetryWait(s, 0);
    if (action === "check") s.verdict = null;
    renderPanel();
    if (ui && ui.P && current === s) scrollIntoWell(ui.P.status);

    const res = await send({ type: "hint", payload });
    s.loading = null;

    if (!res || res.__error || res.ok !== true || !res.data || typeof res.data !== "object") {
      const err = friendlyError(res);
      s.error = err.message;
      s.errorFrom = action;
      s.retry = err.retry ? { action, extra } : null;
      armRetryWait(s, err.retry ? err.waitMs : 0);
      if (current === s && ui && ui.P) {
        renderPanel();
        scrollIntoWell(ui.P.error);
        refocus(keep, s);
      }
      return;
    }

    const data = res.data;
    const reply = tidy(data.reply);
    if (typeof data.sealed === "string" && data.sealed) s.sealed = data.sealed;
    if (Number.isFinite(data.steps)) s.steps = data.steps;
    if (typeof data.kind === "string" && KIND_LABELS[data.kind]) s.kind = data.kind;
    if (data.level === 1 || data.level === 2) s.level = data.level;

    if (action === "first" || action === "next") {
      if (Number.isFinite(data.step) && data.step >= 0 && reply) {
        s.hints.push(reply);
        s.thread.push({ t: "hint", n: s.hints.length, text: reply });
        s.step = data.step;
        send({ type: "stats:bump", key: "hints" });
      } else if (reply) {
        s.thread.push({ t: "archie", text: reply });
      }
      s.done = !!data.done;
    } else if (action === "concept") {
      if (reply) s.concept = reply;
      else {
        s.error = ERRORS.unknown;
        s.errorFrom = "concept";
        s.retry = { action, extra };
      }
    } else if (action === "ask") {
      const last = s.thread[s.thread.length - 1];
      if (last && last.t === "you") last.pending = false;
      if (reply) s.thread.push({ t: "archie", text: reply });
    } else if (action === "check") {
      const verdict = data.verdict === "correct" ? "correct" : data.verdict === "incorrect" ? "incorrect" : "unsure";
      s.checks++;
      const last = s.thread[s.thread.length - 1];
      if (last && last.t === "you") last.pending = false;
      s.verdict = {
        verdict,
        n: s.checks,
        text: reply || (verdict === "correct" ? "That's it. Nice work." : "Not quite yet. Plug it back into the original problem to see which side is off."),
      };
      s.thread.push({ t: "verdict", verdict, text: s.verdict.text });
      if (verdict === "correct") s.solved = true;
    }

    if (s.solved && action === "check" && ui && ui.P) {
      // Solved: the answer box clears and closes (focus then moves on to
      // Next problem or Done, below).
      if (current === s) {
        ui.P.checkInput.value = "";
        if (tool === "check") tool = null;
      }
      repaintMarkers();
    }

    if (current === s && ui && ui.P) {
      const P = ui.P;
      renderPanel();
      if (action === "concept") P.ideaScroll.scrollTop = 0;
      else scrollIntoWell(P.thread.lastElementChild);
      refocus(keep, s);
      // The idea tab opened while a hint was on its way: ask for it now.
      if (tab === "idea" && panelOpen && action !== "concept" && !s.concept && !s.error) request("concept");
    }
  }

  /* ---------------------------------------------------------------- */
  /* Rendering glue                                                    */
  /* ---------------------------------------------------------------- */

  function refreshUi() {
    if (!ui) return;
    renderSheet();
    renderLauncher();
    if (panelOpen && ui.P) {
      const P = ui.P;
      try {
        (editing ? P.input : P.title).focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
    if (cardState === "card" && !panelOpen && ui.sheet && !ui.sheet.hidden) {
      enterSheet(true);
      if (!cardHover) armCardTimer(CARD_MS);
    }
    measureMarkers();
  }

  function onScroll() {
    if (markers.size || hoverEl) queuePositions();
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      reconcile();
      if (panelPos) placePanel(panelPos.x, panelPos.y);
      measureMarkers();
    }, 150);
  }

  function onVisibilityState() {
    if (!document.hidden && pendingScan && running) scheduleScan(true);
  }

  /* ---------------------------------------------------------------- */
  /* Settings and lifecycle                                            */
  /* ---------------------------------------------------------------- */

  function applySettings(raw) {
    settings = cleanSettings(raw);
    reconcile();
  }

  function reconcile() {
    if (!booted) return;
    if (watching()) startWatching();
    else stopWatching();

    if (!uiAllowed()) {
      if (host) removeHost();
      return;
    }
    if (settings.mode !== "popup") {
      if (cardState !== "hidden" && !cardForced) hideCard(false);
    }
    if (settings.mode === "off") clearMarkers();
    else if (running) onVisibilityChanged();
    renderLauncher();
  }

  function onPageHide(e) {
    stopWatching(true);
    clearTimeout(cardTimer);
    clearTimeout(resizeTimer);
    if (!e.persisted) {
      removeListeners();
      removeHost();
    }
  }

  function onPageShow(e) {
    if (e.persisted) reconcile();
  }

  // Windows of this document's own <iframe> and <frame> elements. The top
  // frame talks only to these, and only listens to these. "deep" also looks
  // inside open shadow roots (pages built from web components); it walks the
  // page, so it only runs when the top asks, or while an answer is due.
  function ownFrameWindows(deep) {
    const out = [];
    const add = (root) => {
      for (const f of root.querySelectorAll("iframe, frame")) {
        try {
          const w = f.contentWindow;
          if (w && !out.includes(w)) out.push(w);
        } catch {
          /* detached */
        }
      }
    };
    add(document);
    if (deep) {
      const stack = [document];
      let roots = 0;
      while (stack.length && roots < 200) {
        const root = stack.pop();
        for (const el of root.querySelectorAll("*")) {
          const sr = el.shadowRoot; // open roots only; ours is closed
          if (sr && roots < 200) {
            roots++;
            add(sr);
            stack.push(sr);
          }
        }
      }
    }
    return out;
  }

  function isOwnFrame(w) {
    if (!w || w === window) return false;
    if (ownFrameWindows(false).includes(w)) return true;
    return !!pendingWho && ownFrameWindows(true).includes(w);
  }

  // Answer only to the window that asked, pinned to its origin when it has
  // a real one (opaque origins, like file: pages, cannot be named).
  function replyTarget(origin) {
    return /^https?:\/\/[^/\s]+$/i.test(String(origin || "")) ? origin : "*";
  }

  const TOKEN_RE = /^[0-9a-f]{32}$/;
  const REQ_RE = /^w\d{1,9}\.[0-9a-f]{12}$/;

  function clampNum(v, max) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : 0;
  }

  // Frame messages carry only these fields: what kind of message, the
  // request id, the nonce, and for a candidate how many problems are on
  // screen and how big the frame is. Never page text.
  function onFrameMessage(e) {
    const d = e.data;
    if (!d || typeof d !== "object" || d.source !== FRAME_MSG || typeof d.type !== "string") return;
    if (IS_TOP) {
      if (d.type !== "candidate") return;
      if (!isOwnFrame(e.source)) {
        frameLog.badSource++;
        return;
      }
      if (d.nonce !== FRAME_NONCE) {
        frameLog.badNonce++;
        return;
      }
      if (!pendingWho || d.req !== pendingWho.req || pendingWho.list.some((c) => c.src === e.source)) {
        frameLog.stale++;
        return;
      }
      frameLog.accepted++;
      pendingWho.list.push({ src: e.source, count: clampNum(d.count, 999), area: clampNum(d.area, 1e8) });
      return;
    }
    // Only the top frame ever asks, so a child listens to the top alone
    // (for a direct child that is also its parent).
    if (!e.source || e.source !== window.top) {
      frameLog.badSource++;
      return;
    }
    if (typeof d.nonce !== "string" || !TOKEN_RE.test(d.nonce) || typeof d.req !== "string" || !REQ_RE.test(d.req)) {
      frameLog.badNonce++;
      return;
    }
    if (d.type === "who") {
      if (inert() || !bigEnough()) return;
      const n = (running ? visibleProblems() : quickVisible()).length;
      if (!n) return;
      lastWho = { req: d.req, nonce: d.nonce, from: e.source };
      frameLog.accepted++;
      try {
        e.source.postMessage(
          { source: FRAME_MSG, type: "candidate", req: d.req, nonce: d.nonce, count: Math.min(n, 999), area: Math.round(window.innerWidth * window.innerHeight) },
          replyTarget(e.origin),
        );
      } catch {
        /* the asker went away */
      }
    } else if (d.type === "open-here") {
      if (!lastWho || d.req !== lastWho.req || d.nonce !== lastWho.nonce || e.source !== lastWho.from) {
        frameLog.stale++;
        return;
      }
      lastWho = null;
      frameLog.accepted++;
      openPanelFor(bestVisible(), { auto: false, from: null });
    }
  }

  // Top frame, no text, nothing visible here: ask child frames whether one of
  // them shows a problem, and let the biggest one open its panel. Only counts
  // cross frames, never page text.
  function askFrames() {
    const req = `w${++whoSeq}.${randomToken().slice(0, 12)}`;
    pendingWho = { req, list: [] };
    let posted = 0;
    for (const w of ownFrameWindows(true)) {
      try {
        // "*": the frame's origin is not ours to read. The message holds
        // only the request id and the nonce.
        w.postMessage({ source: FRAME_MSG, type: "who", req, nonce: FRAME_NONCE }, "*");
        posted++;
      } catch {
        /* ignore */
      }
    }
    const finish = () => {
      const got = pendingWho && pendingWho.req === req ? pendingWho.list : [];
      pendingWho = null;
      got.sort((a, b) => b.count - a.count || b.area - a.area);
      // Only a frame that is still one of ours gets the go-ahead.
      const mine = ownFrameWindows(true);
      const pick = got.find((c) => mine.includes(c.src));
      if (pick) {
        try {
          pick.src.postMessage({ source: FRAME_MSG, type: "open-here", req, nonce: FRAME_NONCE }, "*");
          return;
        } catch {
          /* fall through */
        }
      }
      openPanelFor(null, { auto: false, from: null });
    };
    if (!posted) finish();
    else setTimeout(finish, 250);
  }

  function onRuntimeMessage(msg, sender, sendResponse) {
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return false;
    switch (msg.type) {
      case "settings:changed":
        if (msg.settings && typeof msg.settings === "object") applySettings(msg.settings);
        return false;
      case "rescan": {
        if (inert()) {
          if (IS_TOP) sendResponse({ ok: false, reason: "paused" });
          return false;
        }
        let count;
        if (running) {
          scan();
          count = problems.size;
        } else {
          count = detect().size;
          if (count !== lastReported) {
            lastReported = count;
            send({ type: "problems:count", count });
          }
        }
        if (IS_TOP) sendResponse({ ok: true, count });
        return false;
      }
      case "open-panel": {
        if (inert() || !bigEnough()) {
          sendResponse({ ok: false, reason: inert() ? "paused" : "small" });
          return false;
        }
        const text = typeof msg.text === "string" ? msg.text.replace(/\s+/g, " ").trim().slice(0, MAX_PROBLEM) : "";
        if (text) {
          const sc = scoreOf(text);
          openPanelFor(
            { text, id: null, element: null, kind: sc && sc.isAlgebra ? sc.kind : null, level: sc && sc.isAlgebra ? sc.level : null },
            { auto: true, from: null },
          );
        } else {
          const best = bestVisible();
          if (best) openPanelFor(best, { auto: false, from: null });
          else if (IS_TOP) askFrames();
          else openPanelFor(null, { auto: false, from: null });
        }
        sendResponse({ ok: true });
        return false;
      }
      default:
        return false;
    }
  }

  function addListeners() {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
    window.addEventListener("message", onFrameMessage);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityState);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
  }

  function removeListeners() {
    try {
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    } catch {
      /* context gone */
    }
    window.removeEventListener("message", onFrameMessage);
    document.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibilityState);
    window.removeEventListener("pageshow", onPageShow);
  }

  async function boot() {
    if (!(document.documentElement instanceof HTMLElement)) return; // SVG, XML and friends
    firstReportDue = now() + 1500;
    // A previous copy of this script (before an extension update) may have
    // left its host behind. It can no longer talk to the extension.
    for (const old of document.querySelectorAll(HOST_TAG)) old.remove();
    addListeners();
    const got = await send({ type: "settings:get" });
    booted = true;
    applySettings(got && typeof got === "object" && !got.__error ? got : null);
    if (IS_TOP && !inert() && settings.mode !== "off" && lastReported < 0) {
      // Claim the tab's tally early so subframe reports land on this document.
      lastReported = 0;
      send({ type: "problems:count", count: 0 });
    }
  }

  // Extension-world handle (content scripts run in an isolated world, so page
  // scripts cannot see this). Used by the test harness and for debugging.
  Object.defineProperty(globalThis, "__algebridgeHints", {
    value: Object.freeze({
      get root() {
        return shadow;
      },
      state() {
        return {
          running,
          mode: settings.mode,
          cardState,
          panelOpen,
          dismissed,
          problems: allProblems().map((p) => ({ id: p.id, text: p.text, expr: p.expr, kind: p.kind, level: p.level, visible: p.visible })),
          markers: markers.size,
          lastScanMs,
          scanCount,
          view: panelOpen ? "panel" : cardState,
          tab,
          current: current ? { key: current.key, text: current.text, hints: current.hints.slice(), done: current.done, solved: current.solved, sealed: current.sealed, concept: current.concept, verdict: current.verdict ? current.verdict.verdict : null } : null,
          solved: [...sessions.values()].filter((x) => x.solved).map((x) => x.text),
          frames: { ...frameLog },
        };
      },
    }),
    configurable: false,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot(), { once: true });
  } else {
    boot();
  }
})();
