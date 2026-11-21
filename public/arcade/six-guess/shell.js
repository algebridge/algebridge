// Shared helpers for the daily puzzle games (Rare Find, Six Guess, Warmer).
// Each game keeps its own copy so every game folder stays self-contained.
import { clamp, sfx } from "../kit/kit.js";

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

/**
 * A DOM layer inside the kit stage. The stage follows the shape of the screen (wide on a laptop,
 * tall on a phone) and everything inside is sized in em from one computed font size.
 */
export function makeLayer(g, cls) {
  const layer = document.createElement("div");
  layer.className = "dz dz-layer " + cls;
  g.stage.querySelector(".ak-canvases").after(layer);
  const mount = g.stage.parentElement;
  const fit = () => {
    const r = mount.getBoundingClientRect();
    const W = r.width || 960, H = r.height || 540;
    const a = clamp(W / H, 0.5, 16 / 9);
    g.stage.style.setProperty("--ak-aspect", a.toFixed(4));
    const sw = Math.min(W, H * a), sh = sw / a;
    const portrait = a < 1.05;
    const fs = portrait ? Math.min(sw / 26, sh / 43) : Math.min(sw / 60, sh / 33.75);
    g.stage.style.setProperty("--fs", fs.toFixed(2) + "px");
    g.stage.classList.toggle("portrait", portrait);
    g.portrait = portrait;
    g.fs = fs;
  };
  addEventListener("resize", fit);
  fit();
  return layer;
}

// ----- days, daily records and the streak -----
export const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
export const dayLabel = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function dailyStore(g) {
  return {
    /** Today's finished record for a mode, or null. */
    done(mode) {
      const r = g.load("daily:" + mode);
      return r && r.day === dayNum() ? r : null;
    },
    finish(mode, rec) {
      const t = dayNum();
      g.save("daily:" + mode, { ...rec, day: t, date: dayLabel() });
      g.save("progress:" + mode, null);
      const s = g.load("streak", { last: 0, count: 0 });
      if (s.last !== t) g.save("streak", { last: t, count: s.last === t - 1 ? s.count + 1 : 1 });
    },
    /** A daily game in progress, so leaving and coming back does not hand out a fresh try. */
    progress(mode) {
      const p = g.load("progress:" + mode);
      return p && p.day === dayNum() ? p : null;
    },
    saveProgress(mode, p) { g.save("progress:" + mode, { ...p, day: dayNum() }); },
    streak() {
      const s = g.load("streak", { last: 0, count: 0 });
      return s.last >= dayNum() - 1 ? s.count : 0;
    },
  };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-99px;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Wires a "Copy result" button inside a result card. */
export function wireCopy(root, text) {
  const btn = root.querySelector("[data-z=copy]");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    sfx.play("click");
    const ok = await copyText(text);
    btn.textContent = ok ? "Copied" : "Select the text to copy";
    btn.classList.toggle("ok", ok);
  });
}

/**
 * Segmented pickers on the menu card. groups: [{ key, options: [[id, label], ...] }].
 * Choices are saved, and status(opts) returns a short line shown under the pickers.
 */
export function menuPicker(host, g, groups, defaults, status) {
  const opts = { ...defaults, ...g.load("opts", {}) };
  for (const gr of groups) if (!gr.options.some((o) => o[0] === opts[gr.key])) opts[gr.key] = defaults[gr.key];
  const paint = () => {
    host.innerHTML =
      `<div class="dz dz-pick">` +
      groups.map((gr) => `<div class="dz-seg" role="group">${gr.options.map(([id, label]) => `<button type="button" data-k="${gr.key}" data-v="${id}" class="${opts[gr.key] === id ? "on" : ""}">${esc(label)}</button>`).join("")}</div>`).join("") +
      `<p class="dz-status">${status ? status(opts) : ""}</p></div>`;
  };
  host.onclick = (e) => {
    const b = e.target.closest("[data-k]");
    if (!b) return;
    opts[b.dataset.k] = b.dataset.v;
    g.save("opts", opts);
    sfx.play("click");
    paint();
  };
  paint();
  return opts;
}
export const loadOpts = (g, defaults) => ({ ...defaults, ...g.load("opts", {}) });

/** Marks the run as finished without the kit's own card, then shows ours. */
export function showResult(g, html, onReady) {
  const card = g.panel(`<div class="dz dz-result">${html}</div>`, "ak-wide dz-card");
  onReady?.(card);
  return card;
}
