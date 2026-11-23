// AlgeBridge Arcade kit: the shell every game shares (menu, HUD, pause, question card,
// game over), a fixed-step loop that sleeps when nothing is happening, input, sound and saves.
// Read README.md in this folder for the full API.
import { archieSVG } from "./archie.js";
import * as math from "./math.js";
export { math };
export * from "./archie.js";
export { createFx } from "./fx.js";

// ---------- small helpers ----------
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const rand = (lo = 0, hi = 1) => lo + Math.random() * (hi - lo);
export const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
export const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const ease = {
  out: (t) => 1 - (1 - t) ** 3,
  in: (t) => t ** 3,
  inOut: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};
/** The arcade palette. Games may add their own colors; these keep the set feeling like one family. */
export const PAL = {
  blue: "#2563eb", sky: "#60a5fa", navy: "#1e3a8a", ink: "#0f172a",
  amber: "#f59e0b", yellow: "#fde047", orange: "#fb923c", red: "#ef4444", pink: "#ec4899",
  green: "#10b981", lime: "#84cc16", teal: "#14b8a6", purple: "#8b5cf6", white: "#ffffff",
  cream: "#fef7e6", slate: "#64748b", cloud: "#e2e8f0",
};
export const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, -apple-system, "Segoe UI", sans-serif';

// ---------- sound (Web Audio synth, no files) ----------
let ac = null;
let muted = false;
try { muted = localStorage.getItem("arcade:muted") === "1"; } catch {}
function audio() {
  if (!ac) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    ac = new A();
  }
  if (ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
export const sfx = {
  get muted() { return muted; },
  setMuted(m) { muted = !!m; try { localStorage.setItem("arcade:muted", muted ? "1" : "0"); } catch {} },
  /** tone(freq, seconds, { type, vol, slide (end freq), delay }) */
  tone(freq, dur = 0.12, o = {}) {
    if (muted) return;
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type || "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    const v = (o.vol ?? 0.5) * 0.22;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  },
  /** noise(seconds, { vol, freq (filter), delay }) for thuds, whooshes, crashes */
  noise(dur = 0.15, o = {}) {
    if (muted) return;
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + (o.delay || 0);
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = o.type || "lowpass";
    f.frequency.value = o.freq || 1200;
    const g = a.createGain();
    g.gain.value = (o.vol ?? 0.5) * 0.3;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t0);
  },
  /** Named sounds: jump, land, coin, hit, crash, whoosh, click, correct, wrong, win, lose, pop, bounce, tick, power */
  play(name) {
    const T = sfx.tone, N = sfx.noise;
    switch (name) {
      case "jump": T(330, 0.16, { slide: 660, type: "square", vol: 0.3 }); break;
      case "land": N(0.08, { freq: 500, vol: 0.5 }); break;
      case "coin": T(988, 0.07, { type: "square", vol: 0.3 }); T(1319, 0.16, { type: "square", vol: 0.3, delay: 0.07 }); break;
      case "hit": N(0.14, { freq: 900, vol: 0.8 }); T(140, 0.14, { slide: 60, type: "sawtooth", vol: 0.4 }); break;
      case "crash": N(0.4, { freq: 700, vol: 1 }); T(110, 0.35, { slide: 40, type: "sawtooth", vol: 0.5 }); break;
      case "whoosh": N(0.22, { freq: 2400, type: "bandpass", vol: 0.35 }); break;
      case "click": T(660, 0.04, { type: "square", vol: 0.2 }); break;
      case "pop": T(520, 0.07, { slide: 900, vol: 0.4 }); break;
      case "bounce": T(220, 0.1, { slide: 440, type: "sine", vol: 0.5 }); break;
      case "tick": T(1200, 0.025, { type: "square", vol: 0.15 }); break;
      case "power": [392, 523, 659, 784].forEach((f, i) => T(f, 0.1, { delay: i * 0.05, type: "square", vol: 0.28 })); break;
      case "correct": T(659, 0.1, { vol: 0.5 }); T(880, 0.1, { delay: 0.09, vol: 0.5 }); T(1319, 0.2, { delay: 0.18, vol: 0.5 }); break;
      case "wrong": T(220, 0.16, { type: "sawtooth", vol: 0.35 }); T(165, 0.26, { delay: 0.13, type: "sawtooth", vol: 0.35 }); break;
      case "win": [523, 659, 784, 1047, 784, 1047].forEach((f, i) => T(f, 0.16, { delay: i * 0.11, vol: 0.5 })); break;
      case "lose": [392, 330, 262, 196].forEach((f, i) => T(f, 0.22, { delay: i * 0.16, type: "triangle", vol: 0.45 })); break;
    }
  },
};

// ---------- the game shell ----------
/**
 * createGame({ slug, title, tagline, how: ["line", ...], controls: [{ keys: "← →", does: "Steer" }],
 *              aspect: 16/9, bg: "#0f172a", mount: element })
 */
export function createGame(opts) {
  const mount = opts.mount || document.getElementById("game") || document.body;
  const aspect = opts.aspect || 16 / 9;
  mount.classList.add("ak-root");
  mount.innerHTML = `
    <div class="ak-stage" style="--ak-aspect:${aspect}; background:${opts.bg || "#0f172a"}">
      <div class="ak-layer ak-canvases"></div>
      <div class="ak-layer ak-hud"><div class="ak-pills"></div><div class="ak-right">
        <button class="ak-icon" data-a="pause" aria-label="Pause" title="Pause (P)"><svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg></button>
        <button class="ak-icon ak-topic" data-a="topic" aria-label="Choose a math topic" title="Choose a math topic"></button>
        <button class="ak-icon" data-a="mute" aria-label="Sound" title="Sound (M)"></button>
        <button class="ak-icon" data-a="full" aria-label="Full screen" title="Full screen (F)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      </div></div>
      <div class="ak-layer ak-toasts"></div>
      <div class="ak-layer ak-touch"></div>
      <div class="ak-layer ak-overlay"></div>
    </div>`;
  const stage = mount.querySelector(".ak-stage");
  const canvases = mount.querySelector(".ak-canvases");
  const pills = mount.querySelector(".ak-pills");
  const overlay = mount.querySelector(".ak-overlay");
  const toasts = mount.querySelector(".ak-toasts");
  const touchLayer = mount.querySelector(".ak-touch");
  const hud = mount.querySelector(".ak-hud");
  const muteBtn = mount.querySelector('[data-a="mute"]');
  const coarse = matchMedia("(pointer: coarse)").matches;

  const g = {
    slug: opts.slug, stage, state: "menu", time: 0, coarse,
    onStart: null, onResize: null, onPause: null,
  };

  // ----- saves -----
  const key = (k) => `arcade:${opts.slug}:${k}`;
  g.load = (k, fallback = null) => { try { const v = localStorage.getItem(key(k)); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
  g.save = (k, v) => { try { localStorage.setItem(key(k), JSON.stringify(v)); } catch {} saved(); };
  Object.defineProperty(g, "best", { get: () => g.load("best", 0), set: (v) => g.save("best", v) });
  /** Coins are shared by every arcade game. */
  Object.defineProperty(g, "coins", { get: () => { try { return Number(localStorage.getItem("arcade:coins")) || 0; } catch { return 0; } } });
  g.addCoins = (n) => { try { localStorage.setItem("arcade:coins", String(Math.max(0, g.coins + Math.round(n)))); } catch {} return g.coins; };
  /**
   * Things to earn. g.unlocks([{ id: "gold", name: "Gold Archie", need: 40 }, ...]) declares them (need = total xp).
   * g.addXp(n) after every run or level: it saves, toasts anything newly unlocked and returns those items.
   * The game-over and level cards show a progress bar to the next unlock by themselves.
   * g.unlocked(id), and g.skin (the id the player picked, saved) are yours to use for looks.
   */
  let unlockList = [];
  g.unlocks = (list) => { unlockList = list.slice().sort((a, b) => a.need - b.need); return unlockList; };
  Object.defineProperty(g, "xp", { get: () => g.load("xp", 0) });
  g.unlocked = (id) => { const u = unlockList.find((x) => x.id === id); return !u || g.xp >= u.need; };
  g.addXp = (n) => {
    const before = g.xp, after = before + Math.max(0, Math.round(n));
    g.save("xp", after);
    const got = unlockList.filter((u) => u.need > before && u.need <= after);
    got.forEach((u, i) => setTimeout(() => { g.toast("Unlocked: " + u.name, 2200, "gold"); sfx.play("power"); }, 300 + i * 500));
    return got;
  };
  Object.defineProperty(g, "skin", { get: () => g.load("skin", null), set: (v) => g.save("skin", v) });
  const unlockBar = () => {
    const next = unlockList.find((u) => u.need > g.xp);
    if (!next) return unlockList.length ? `<p class="ak-line">Everything unlocked</p>` : "";
    const prev = [...unlockList].reverse().find((u) => u.need <= g.xp)?.need || 0;
    const f = Math.max(0.04, Math.min(1, (g.xp - prev) / (next.need - prev)));
    return `<div class="ak-unlock"><span>Next: <b>${esc(next.name)}</b></span><i><em style="width:${(f * 100).toFixed(0)}%"></em></i></div>`;
  };
  const tell = (type, data = {}) => { try { if (parent !== window) parent.postMessage({ source: "algebridge-arcade", type, slug: opts.slug, ...data }, location.origin); } catch {} };
  // Tells the page around the game that something was saved, at most twice a second, so it can copy saves to the account.
  let saveT = 0;
  const saved = () => { if (saveT) return; saveT = setTimeout(() => { saveT = 0; tell("save"); }, 500); };

  // ----- canvases -----
  /** A 2D canvas with a fixed logical size (w x h) scaled to the stage. Returns { canvas, ctx, w, h }. Draw in logical units. */
  g.canvas2d = (w = 960, h = Math.round(960 / aspect)) => {
    const canvas = document.createElement("canvas");
    canvas.className = "ak-canvas";
    canvases.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const c = { canvas, ctx, w, h, scale: 1 };
    const fit = () => {
      const r = stage.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(1, Math.round((r.width || w) * dpr));
      canvas.width = px;
      canvas.height = Math.round(px * (h / w));
      c.scale = canvas.width / w;
      ctx.setTransform(c.scale, 0, 0, c.scale, 0, 0);
      g._dirty = true;
    };
    c.fit = fit;
    fits.push(fit);
    fit();
    return c;
  };
  /** A bare canvas that fills the stage, for three.js. onResize(width, height, dpr) fires now and on every resize. */
  g.canvas3d = (onResize) => {
    const canvas = document.createElement("canvas");
    canvas.className = "ak-canvas";
    canvases.appendChild(canvas);
    const fit = () => {
      const r = stage.getBoundingClientRect();
      onResize?.(Math.max(1, Math.round(r.width || 960)), Math.max(1, Math.round(r.height || 540)), Math.min(window.devicePixelRatio || 1, 2));
      g._dirty = true;
    };
    fits.push(fit);
    fit();
    return canvas;
  };
  const fits = [];
  let fitTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => { fits.forEach((f) => f()); g.onResize?.(); drawOnce(); }, 60);
  }).observe(stage);

  // ----- HUD -----
  const pillEls = {};
  /** setHud("Score", 120) adds or updates a pill at the top left. Pass null to remove. */
  g.setHud = (label, value) => {
    if (value == null) { pillEls[label]?.remove(); delete pillEls[label]; return; }
    let el = pillEls[label];
    if (!el) {
      el = pillEls[label] = document.createElement("div");
      el.className = "ak-pill";
      el.innerHTML = `<span></span><b></b>`;
      el.firstChild.textContent = label;
      pills.appendChild(el);
    }
    const t = String(value);
    if (el.lastChild.textContent !== t) el.lastChild.textContent = t;
  };
  g.setScore = (n) => { g.score = n; g.setHud("Score", n); };
  g.toast = (text, ms = 1400, tone = "") => {
    const el = document.createElement("div");
    el.className = "ak-toast " + tone;
    el.textContent = text;
    toasts.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };
  const paintMute = () => {
    muteBtn.innerHTML = sfx.muted
      ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h3l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12"/></svg>`;
  };
  paintMute();
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (mount.requestFullscreen?.() || Promise.reject()).catch?.(() => mount.classList.toggle("ak-pinned"));
  };
  hud.addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "pause") g.state === "playing" ? g.pause() : g.state === "paused" && g.resume();
    if (a === "mute") { sfx.setMuted(!sfx.muted); paintMute(); }
    if (a === "full") toggleFull();
    if (a === "topic") topicCard();
  });
  // The math topic is the player's pick, for every game. Games that use math.problem() follow it by themselves.
  const topicBtn = mount.querySelector('[data-a="topic"]');
  const paintTopic = () => { const c = math.TOPIC_CHOICES.find((x) => x.id === math.getTopic()) || math.TOPIC_CHOICES[0]; topicBtn.textContent = "Topic: " + c.label; };
  paintTopic();
  const topicCard = () => {
    if (g.state === "asking") return;
    const was = g.state;
    if (was === "playing") { g.state = "paused"; stage.dataset.state = "paused"; g.onPause?.(true); }
    show(`<div class="ak-card ak-small"><h2>What do you want to practice?</h2><div class="ak-topics">${math.TOPIC_CHOICES.map((c) => `<button class="ak-topicb${c.id === math.getTopic() ? " on" : ""}" data-topic="${c.id}"><b>${esc(c.label)}</b><span>${esc(c.note)}</span></button>`).join("")}</div></div>`);
    overlay.querySelector(".ak-topics").addEventListener("click", (e) => {
      const id = e.target.closest("[data-topic]")?.dataset.topic;
      if (!id) return;
      e.stopPropagation();
      math.setTopic(id); paintTopic(); sfx.play("click"); g.onTopic?.(id);
      if (was === "playing" || was === "paused") { g.state = "playing"; g.pause(); } else if (was === "over") { g.state = "menu"; g.menu(); } else g.menu();
    });
  };

  // ----- input -----
  const down = new Set();
  const pressed = new Set();
  const GAME_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
  /** g.keys.down("ArrowLeft") is held; g.keys.pressed("Space") is true for the one update after the press. Codes are KeyboardEvent.code. */
  g.keys = {
    down: (...codes) => codes.some((c) => down.has(c)),
    pressed: (...codes) => codes.some((c) => pressed.has(c)),
    press(code) { if (!down.has(code)) pressed.add(code); down.add(code); },
    release(code) { down.delete(code); },
    /** -1, 0 or 1 from two sets of codes, e.g. axis(["ArrowLeft","KeyA"], ["ArrowRight","KeyD"]) */
    axis: (neg, pos) => (pos.some((c) => down.has(c)) ? 1 : 0) - (neg.some((c) => down.has(c)) ? 1 : 0),
  };
  addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea")) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    audio();
    if (asking) { askKey(e); return; }
    if (e.code === "KeyP" || e.code === "Escape") { if (g.state === "playing") g.pause(); else if (g.state === "paused") g.resume(); return; }
    if (e.code === "KeyM") { sfx.setMuted(!sfx.muted); paintMute(); return; }
    if (e.code === "KeyF" && !opts.keepF) { toggleFull(); return; }
    if (opts.instant && (g.state === "menu" || g.state === "over") && !overlay.querySelector(".ak-card") && !e.metaKey && !e.ctrlKey && !e.altKey && e.code !== "Tab" && (g.state === "menu" || ["Space", "Enter", "KeyR", "ArrowUp", "ArrowRight"].includes(e.code))) { e.preventDefault(); overlay.querySelector("[data-a=play]")?.click(); return; }
    if ((e.code === "Enter" || e.code === "Space") && (g.state === "menu" || g.state === "over")) { e.preventDefault(); overlay.querySelector("[data-a=play]")?.click(); return; }
    g.keys.press(e.code);
  });
  addEventListener("keyup", (e) => down.delete(e.code));
  addEventListener("blur", () => down.clear());
  /** Pointer in stage-relative units: x and y from 0 to 1, plus down and pressed (edge). Use g.pointer.at(canvas2d) for logical coordinates. */
  g.pointer = { x: 0.5, y: 0.5, down: false, pressed: false, released: false, at: (c) => ({ x: g.pointer.x * c.w, y: g.pointer.y * c.h }) };
  const pt = (e) => { const r = stage.getBoundingClientRect(); g.pointer.x = clamp((e.clientX - r.left) / r.width, 0, 1); g.pointer.y = clamp((e.clientY - r.top) / r.height, 0, 1); };
  canvases.addEventListener("pointerdown", (e) => { audio(); pt(e); g.pointer.down = true; g.pointer.pressed = true; canvases.setPointerCapture?.(e.pointerId); });
  canvases.addEventListener("pointermove", pt);
  const up = () => { if (g.pointer.down) g.pointer.released = true; g.pointer.down = false; };
  canvases.addEventListener("pointerup", up);
  canvases.addEventListener("pointercancel", up);
  canvases.addEventListener("contextmenu", (e) => e.preventDefault());
  /**
   * On-screen buttons for touch devices. Each feeds g.keys with its code.
   * touchButtons([{ code: "ArrowLeft", label: "◀", side: "left" }, { code: "Space", label: "Jump", side: "right" }])
   * Shown only on coarse pointers unless { always: true }.
   */
  g.touchButtons = (buttons, o = {}) => {
    touchLayer.innerHTML = "";
    if (!coarse && !o.always) return;
    const L = document.createElement("div"); L.className = "ak-pad ak-pad-left";
    const R = document.createElement("div"); R.className = "ak-pad ak-pad-right";
    for (const b of buttons) {
      const el = document.createElement("button");
      el.className = "ak-tbtn"; el.textContent = b.label; el.setAttribute("aria-label", b.aria || b.label);
      const on = (e) => { e.preventDefault(); audio(); g.keys.press(b.code); el.classList.add("on"); };
      const off = (e) => { e.preventDefault(); g.keys.release(b.code); el.classList.remove("on"); };
      el.addEventListener("pointerdown", on); el.addEventListener("pointerup", off); el.addEventListener("pointerleave", off); el.addEventListener("pointercancel", off);
      (b.side === "right" ? R : L).appendChild(el);
    }
    touchLayer.append(L, R);
  };

  // ----- loop: fixed 60 Hz steps, asleep unless playing -----
  const STEP = 1 / 60;
  let update = null, render = null, raf = 0, last = 0, acc = 0;
  const frame = (now) => {
    raf = 0;
    if (g.state !== "playing") return;
    const real = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (stopT > 0) stopT -= real;
    else acc += real * (slowT > 0 ? slowScale : 1);
    if (slowT > 0) slowT -= real;
    let n = 0;
    while (acc >= STEP && n++ < 5) { step(); acc -= STEP; if (g.state !== "playing") break; }
    if (n >= 5) acc = 0;
    render?.(acc / STEP);
    if (g.state === "playing") raf = requestAnimationFrame(frame);
  };
  const step = () => {
    g.time += STEP;
    if (shakeT > 0) shakeT = Math.max(0, shakeT - STEP);
    update?.(STEP);
    pressed.clear();
    g.pointer.pressed = false;
    g.pointer.released = false;
  };
  const wake = () => { if (!raf && g.state === "playing") { last = performance.now(); acc = 0; raf = requestAnimationFrame(frame); } };
  const drawOnce = () => { try { render?.(0); } catch (e) { console.error(e); } };
  /** g.loop(update(dt), render(alpha)). update runs at a fixed 1/60 s while playing; render once per frame. */
  g.loop = (u, r) => { update = u; render = r; drawOnce(); };
  /** Test hook: run the simulation for some seconds right now, then draw. */
  g.advance = (seconds) => { const n = Math.round(seconds / STEP); for (let i = 0; i < n && g.state === "playing"; i++) step(); drawOnce(); };
  g.redraw = drawOnce;
  let shakeT = 0, shakeMag = 0, stopT = 0, slowT = 0, slowScale = 1;
  /** Freeze the game for a few hundredths of a second on a big hit. It makes impacts land. */
  g.hitstop = (seconds = 0.06) => { stopT = Math.max(stopT, seconds); };
  /** Run the game slower for a moment (a near miss, the last knock-out). scale 0.3 = 30% speed. */
  g.slowmo = (scale = 0.35, seconds = 0.6) => { slowScale = scale; slowT = seconds; };
  /** Screen shake. Read g.shakeX / g.shakeY in render and offset the camera or ctx by them. */
  g.shake = (mag = 8, seconds = 0.25) => { shakeMag = mag; shakeT = seconds; };
  Object.defineProperty(g, "shakeX", { get: () => (shakeT > 0 ? (Math.random() * 2 - 1) * shakeMag * Math.min(1, shakeT * 6) : 0) });
  Object.defineProperty(g, "shakeY", { get: () => (shakeT > 0 ? (Math.random() * 2 - 1) * shakeMag * Math.min(1, shakeT * 6) : 0) });

  // ----- screens -----
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const show = (html, cls = "") => { overlay.className = "ak-layer ak-overlay on " + cls; overlay.innerHTML = html; };
  const hide = () => { overlay.className = "ak-layer ak-overlay"; overlay.innerHTML = ""; };
  const controlsHtml = () => (opts.controls || []).map((c) => `<li><kbd>${esc(c.keys)}</kbd><span>${esc(c.does)}</span></li>`).join("");
  g.menu = () => {
    g.state = "menu";
    stage.dataset.state = "menu";
    const best = g.best;
    if (opts.instant) {
      // No card: the live scene, the title, and one prompt. Any key or tap starts.
      show(`<div class="ak-splash" data-a="play"><h1 class="ak-logo">${esc(opts.title)}</h1>
        <p class="ak-go">${esc(opts.prompt || (coarse ? "Tap to play" : "Click or press any key"))}</p>
        ${(opts.controls || []).length ? `<ul class="ak-controls ak-light">${controlsHtml()}</ul>` : ""}
        <div class="ak-extra"></div>${best ? `<p class="ak-best ak-light">Best ${esc(best)}</p>` : ""}</div>`, "splash");
      g.menuExtra = overlay.querySelector(".ak-extra");
      opts.onMenu?.(g.menuExtra);
      drawOnce();
      return;
    }
    show(`<div class="ak-card ak-menu">
      <div class="ak-archie">${archieSVG("wave", 92)}</div>
      <h1>${esc(opts.title)}</h1>
      ${opts.tagline ? `<p class="ak-tag">${esc(opts.tagline)}</p>` : ""}
      ${(opts.how || []).length ? `<ul class="ak-how">${opts.how.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      ${(opts.controls || []).length ? `<ul class="ak-controls">${controlsHtml()}</ul>` : ""}
      <div class="ak-extra"></div>
      <button class="ak-btn" data-a="play">Play</button>
      ${best ? `<p class="ak-best">Best: <b>${esc(best)}</b></p>` : ""}
    </div>`);
    g.menuExtra = overlay.querySelector(".ak-extra");
    opts.onMenu?.(g.menuExtra);
    drawOnce();
  };
  /** Start or restart play. Calls g.onStart() where the game resets its world. */
  g.start = () => {
    hide();
    g.state = "playing";
    stage.dataset.state = "playing";
    g.time = 0;
    pressed.clear();
    down.clear();
    g.onStart?.();
    tell("start");
    wake();
  };
  g.pause = () => {
    if (g.state !== "playing") return;
    g.state = "paused";
    stage.dataset.state = "paused";
    g.onPause?.(true);
    show(`<div class="ak-card ak-small"><h2>Paused</h2>${(opts.controls || []).length ? `<ul class="ak-controls">${controlsHtml()}</ul>` : ""}<button class="ak-btn" data-a="resume">Keep playing</button><button class="ak-btn ak-ghost" data-a="quit">Quit to menu</button></div>`);
  };
  g.resume = () => {
    if (g.state !== "paused") return;
    hide();
    g.state = "playing";
    stage.dataset.state = "playing";
    g.onPause?.(false);
    wake();
  };
  /**
   * End the run. over({ score, title: "Nice run", lines: ["Distance 420 m"], won: false, higherIsBetter: true, scoreLabel: "Score" })
   * Saves the best score and shows Play again.
   */
  g.over = (o = {}) => {
    if (g.state === "over") return;
    g.state = "over";
    stage.dataset.state = "over";
    const score = o.score ?? g.score ?? 0;
    const hib = o.higherIsBetter !== false;
    const prev = g.load("best", null);
    const isBest = typeof score === "number" && (score > 0 || !hib) && (prev == null || (hib ? score > prev : score < prev)) && (o.won !== false || hib);
    if (isBest) g.best = score;
    sfx.play(o.won ? "win" : o.won === false ? "lose" : isBest ? "win" : "lose");
    tell("over", { score, won: !!o.won });
    drawOnce();
    overAt = performance.now();
    if (opts.instant) {
      // A small strip, not a wall: the score, what you are earning, and one tap to go again.
      show(`<div class="ak-mini" data-a="play">
        <h2>${esc(o.title || (o.won ? "You did it" : "Game over"))}</h2>
        <p class="ak-score"><b>${esc(score)}</b>${isBest ? `<span class="ak-newbest">New best</span>` : prev != null ? `<span>Best ${esc(g.best)}</span>` : ""}</p>
        ${(o.lines || []).map((l) => `<p class="ak-line">${esc(l)}</p>`).join("")}
        ${unlockBar()}
        <p class="ak-go">${esc(o.again || (coarse ? "Tap to go again" : "Space to go again"))}</p>
      </div>`, "mini");
      return;
    }
    show(`<div class="ak-card ak-small">
      <div class="ak-archie">${archieSVG(o.won || isBest ? "happy" : "idle", 76)}</div>
      <h2>${esc(o.title || (o.won ? "You did it" : "Game over"))}</h2>
      <p class="ak-score"><span>${esc(o.scoreLabel || "Score")}</span><b>${esc(score)}</b></p>
      ${isBest ? `<p class="ak-newbest">New best</p>` : prev != null ? `<p class="ak-best">Best: <b>${esc(g.best)}</b></p>` : ""}
      ${(o.lines || []).map((l) => `<p class="ak-line">${esc(l)}</p>`).join("")}
      ${unlockBar()}
      <button class="ak-btn" data-a="play">${esc(o.again || "Play again")}</button>
      <button class="ak-btn ak-ghost" data-a="quit">Menu</button>
    </div>`);
  };
  let overAt = 0;
  overlay.addEventListener("click", (e) => {
    if (e.target.closest(".ak-extra") && !e.target.closest("[data-a]:not(.ak-splash)")) return; // menu extras handle their own clicks
    const strip = overlay.classList.contains("splash") || overlay.classList.contains("mini");
    const a = e.target.closest("[data-a]")?.dataset.a || (strip ? overlay.querySelector("[data-a]")?.dataset.a : null);
    if (!a) return;
    if (a === "next") { g._levelGo?.(); return; }
    if (a === "play" && g.state === "over" && performance.now() - overAt < 350) return; // do not skip the result by accident
    audio();
    sfx.play("click");
    if (a === "play") g.start();
    if (a === "resume") g.resume();
    if (a === "quit") g.menu();
  });
  /**
   * Between levels: a small strip that never stops the flow. Resolves when the player taps or presses a key,
   * or by itself after `auto` seconds. levelDone({ title: "Level 3", stars: 2, lines: ["4.2 s"], auto: 1.6 })
   */
  g.levelDone = (o = {}) =>
    new Promise((resolve) => {
      const was = g.state;
      g.state = "paused";
      const stars = o.stars != null ? `<p class="ak-stars">${[0, 1, 2].map((i) => `<span class="${i < o.stars ? "on" : ""}"></span>`).join("")}</p>` : "";
      show(`<div class="ak-mini" data-a="next"><h2>${esc(o.title || "Level clear")}</h2>${stars}${(o.lines || []).map((l) => `<p class="ak-line">${esc(l)}</p>`).join("")}${unlockBar()}<p class="ak-go">${esc(o.prompt || "Next")}</p></div>`, "mini");
      sfx.play("win");
      let done = false;
      const go = () => { if (done) return; done = true; removeEventListener("keydown", key); clearTimeout(t); hide(); g.state = was; stage.dataset.state = was; wake(); resolve(); };
      const t0 = performance.now();
      const key = (e) => { if (performance.now() - t0 > 250 && !e.repeat) go(); };
      addEventListener("keydown", key);
      overlay.firstElementChild.addEventListener("click", go);
      const t = o.auto ? setTimeout(go, o.auto * 1000) : 0;
      g._levelGo = go;
    });
  /** A custom screen over the game (level select, shop, results). Returns the card element; call g.closePanel() to remove. */
  g.panel = (html, cls = "") => { show(`<div class="ak-card ${cls}">${html}</div>`); return overlay.firstElementChild; };
  g.closePanel = hide;

  // ----- the question card -----
  let asking = null;
  const askKey = (e) => {
    const i = ["Digit1", "Digit2", "Digit3", "Digit4", "Numpad1", "Numpad2", "Numpad3", "Numpad4"].indexOf(e.code) % 4;
    if (i >= 0) overlay.querySelectorAll(".ak-choice")[i]?.click();
  };
  /**
   * Pause the game and ask one problem (from math.problem()). Resolves true or false.
   * ask(problem, { title: "Answer to load the boost", seconds: 0 (no timer), reveal: true })
   */
  g.ask = (p, o = {}) =>
    new Promise((resolve) => {
      if (asking || (g.state !== "playing" && g.state !== "asking")) return resolve(false);
      const was = g.state;
      g.state = "asking";
      stage.dataset.state = "asking";
      let timer = 0;
      const done = (ok) => {
        clearInterval(timer);
        asking = null;
        g.lastAnswer = ok;
        hide();
        g.state = was === "asking" ? "playing" : was;
        stage.dataset.state = g.state;
        down.clear();
        pressed.clear();
        wake();
        resolve(ok);
      };
      asking = { done };
      show(`<div class="ak-card ak-ask">
        <div class="ak-ask-top"><span class="ak-archie-s">${archieSVG("idle", 44)}</span><span>${esc(o.title || "Quick one")}</span>${o.seconds ? `<span class="ak-timer"><i></i></span>` : ""}</div>
        <div class="ak-q">${esc(p.text)}</div>
        <div class="ak-choices">${p.choices.map((c, i) => `<button class="ak-choice" data-i="${i}"><kbd>${i + 1}</kbd>${esc(c)}</button>`).join("")}</div>
      </div>`, "ask");
      const btns = [...overlay.querySelectorAll(".ak-choice")];
      const answer = (i) => {
        if (!asking || asking.locked) return;
        asking.locked = true;
        const ok = i >= 0 && p.check(p.choices[i]);
        sfx.play(ok ? "correct" : "wrong");
        btns.forEach((b, j) => { if (p.check(p.choices[j])) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); b.disabled = true; });
        setTimeout(() => done(ok), ok ? 380 : o.reveal === false ? 380 : 900);
      };
      btns.forEach((b, i) => b.addEventListener("click", () => answer(i)));
      asking.pick = (right) => answer(p.choices.findIndex((c) => p.check(c) === right));
      if (o.seconds) {
        const bar = overlay.querySelector(".ak-timer i");
        const t0 = performance.now();
        timer = setInterval(() => {
          const f = 1 - (performance.now() - t0) / (o.seconds * 1000);
          if (bar) bar.style.width = Math.max(0, f * 100) + "%";
          if (f <= 0) answer(-1);
        }, 80);
      }
    });
  /** Test hook: answer the open question card. */
  g.answerOpen = (right = true) => { if (!asking?.pick) return false; asking.pick(right); return true; };

  document.addEventListener("visibilitychange", () => { if (document.hidden && g.state === "playing" && !opts.noAutoPause) g.pause(); });
  window.__arcade = g;
  g.menu();
  return g;
}
