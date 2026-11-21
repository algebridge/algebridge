// Rare Find: rare-answer trivia. Every prompt has many right answers, and the less obvious your right
// answer is, the more it scores. Pixel Archie hosts. Rarity is our own written ranking, never player data.
import { createGame, math, sfx } from "../kit/kit.js";
import { makeLayer, dailyStore, dayLabel, dayNum, showResult, wireCopy, esc } from "./shell.js";
import { makeGame, TIERS, tierOf, rankOf } from "./prompts.js";
import { COL, TIER_COL, meterColor, px, paintText, setText, drawArchie, drawSky, makeFx, drawPoster, SKINS, skinOf } from "./pixel.js";

const SECONDS = 20, COUNT = 7, BLOCKS = 10;
const HONEST = "Rarity is our own ranking of how obvious each answer is.";
let store, layer, ui;

// These run from the title screen too, which the kit draws before createGame returns.
const G = () => window.__arcade;
/** The mode picked on the title screen. A new day goes back to the daily puzzle. */
const getMode = () => { const o = G().load("opts", {}); return o.type === "practice" && o.day === dayNum() ? "practice" : "daily"; };
const setMode = (type) => G().save("opts", { type, day: dayNum() });
const owns = (s) => !s.need || G().xp >= s.need;
const skin = () => { const s = skinOf(G().skin); return owns(s) ? s : SKINS[0]; };

const g = createGame({
  slug: "rare-find",
  title: "Rare Find",
  tagline: "Every prompt has many right answers. Find one that hides.",
  instant: true,
  keepF: true,
  prompt: matchMedia("(pointer: coarse)").matches ? "Tap to play" : "Press any key",
  aspect: 16 / 9,
  bg: COL.ink,
  onMenu: (host) => {
    const g = G();
    store ||= dailyStore(g);
    if (ui) { pose = "wave"; ui.say.textContent = HELLO; }
    const paint = () => {
      const mode = getMode(), s = store.streak(), d = store.done("daily");
      const line = mode === "practice" ? "Fresh prompts every time." : d ? `Today: ${d.total} of 700. New puzzle tomorrow.` : "7 prompts. One try a day.";
      const owned = SKINS.filter(owns);
      host.innerHTML = `<div class="rf-pick">
        <div class="rf-seg" role="group"><button type="button" data-mode="daily" class="${mode === "daily" ? "on" : ""}">Daily</button><button type="button" data-mode="practice" class="${mode === "practice" ? "on" : ""}">Practice</button>${owned.length > 1 ? `<button type="button" data-skin="1" class="skin">Look: ${esc(skin().name)}</button>` : ""}</div>
        <p class="rf-status">${esc(line)}${s ? ` Day streak ${s}.` : ""}</p></div>`;
    };
    host.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.mode) setMode(b.dataset.mode);
      else {
        const owned = SKINS.filter(owns);
        g.skin = owned[(owned.indexOf(skin()) + 1) % owned.length].id;
        g.redraw?.();
      }
      sfx.play("click");
      paint();
    };
    paint();
  },
});
const HELLO = "Hi, I am Archie. I host this show.";
store ||= dailyStore(g);
g.unlocks(SKINS.filter((s) => s.need).map((s) => ({ id: s.id, name: s.name + " Archie", need: s.need })));
layer = makeLayer(g, "rf");
g.stage.classList.add("rfs");

layer.innerHTML = `
  <canvas class="rf-sky" aria-hidden="true"></canvas>
  <header class="rf-head">${px("Rare Find", "rf-brand", COL.gold, "#b3402a")}<span class="rf-chip">Daily</span><span class="rf-dots"></span><span class="rf-grow"></span><span class="rf-total">${px("0", "rf-total-n", COL.white)}<small>PTS</small></span></header>
  <div class="rf-main">
    <div class="rf-host"><div class="rf-say pxl"></div><canvas class="rf-archie" width="40" height="40" role="img" aria-label="Archie"></canvas></div>
    <div class="rf-card pxl">
      <div class="rf-title">
        <div class="rf-logos">${px("Rare", "rf-logo a", COL.gold, "#b3402a")}${px("Find", "rf-logo b", COL.cyan, "#1b3fc4")}</div>
        <p class="rf-tag">Many right answers. The one that hides scores most.</p>
        <div class="rf-meter demo"><div class="rf-track">${Array.from({ length: BLOCKS }, (_, i) => `<i class="on" style="--c:${meterColor(i)}"></i>`).join("")}</div><div class="rf-labels"><span>Common</span><span>Uncommon</span><span>Rare</span><span>Very rare</span></div></div>
      </div>
      <div class="rf-play">
        <div class="rf-step"><span class="rf-step-n"></span><span class="rf-cat"></span></div>
        <div class="rf-prompt"></div>
        <div class="rf-timer"><span class="rf-ticks">${"<i></i>".repeat(SECONDS)}</span><span class="rf-secs-w">${px(String(SECONDS), "rf-secs", COL.cyan)}</span></div>
        <div class="rf-answer">
          <form class="rf-form"><span class="rf-caret">&gt;</span><input class="rf-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="40" enterkeyhint="go" aria-label="Your answer"><button class="rf-b rf-go" type="submit">Enter</button></form>
          <div class="rf-note"></div>
          <div class="rf-meter wait"><div class="rf-track">${"<i></i>".repeat(BLOCKS)}</div><div class="rf-labels"><span>Common</span><span>Uncommon</span><span>Rare</span><span>Very rare</span></div><p class="rf-teach">A right answer fills this. The better it hides, the further it goes.</p></div>
        </div>
        <div class="rf-reveal" hidden></div>
      </div>
    </div>
  </div>
  <canvas class="rf-fx" aria-hidden="true"></canvas>
  <canvas class="rf-poster" aria-hidden="true" hidden></canvas>`;
const $ = (s) => layer.querySelector(s);
ui = { sky: $(".rf-sky"), fx: $(".rf-fx"), poster: $(".rf-poster"), chip: $(".rf-chip"), dots: $(".rf-dots"), total: $(".rf-total-n"), archie: $(".rf-archie"), say: $(".rf-say"), step: $(".rf-step-n"), cat: $(".rf-cat"), prompt: $(".rf-prompt"), ticks: [...layer.querySelectorAll(".rf-ticks i")], secs: $(".rf-secs"), timer: $(".rf-timer"), answer: $(".rf-answer"), form: $(".rf-form"), input: $(".rf-input"), note: $(".rf-note"), reveal: $(".rf-reveal"), card: $(".rf-card") };
paintText(layer);
const skyCtx = ui.sky.getContext("2d"), fxCtx = ui.fx.getContext("2d"), archCtx = ui.archie.getContext("2d");
const fx = makeFx();

// One background pixel is a quarter of an em, the same step the panels use for their corners.
let GW = 240, GH = 135;
function sizeGrid() {
  const r = g.stage.getBoundingClientRect();
  const unit = Math.max(1, (g.fs || 16) / 4);
  GW = Math.max(40, Math.round((r.width || 960) / unit));
  GH = Math.max(40, Math.round((r.height || 540) / unit));
  for (const c of [ui.sky, ui.fx]) if (c.width !== GW || c.height !== GH) { c.width = GW; c.height = GH; }
}
addEventListener("resize", () => { sizeGrid(); g.redraw?.(); });

let mode = "daily", prompts = [], results = [], idx = 0, phase = "idle", timeLeft = SECONDS, lastTick = SECONDS, shownSecs = -1, shownTicks = -1;
let pose = "wave", poseT = 0, sceneT = 0, posterOn = false;
let rv = null; // the reveal that is playing: { target, shown, t, done, res }
const total = () => results.reduce((a, r) => a + r.points, 0);

function host(p, text) { pose = p; poseT = 0; ui.say.textContent = text; }
function paintDots() {
  ui.dots.innerHTML = Array.from({ length: COUNT }, (_, i) => `<i class="${i < results.length ? (results[i].points ? "t" + results[i].tier : "tx") : i === idx && phase !== "idle" ? "now" : ""}"></i>`).join("");
  setText(ui.total, total());
}
const OPENERS = ["Dig deep. The less obvious, the better.", "Skip the first answer that comes to mind.", "What would nobody think of?", "Right is good. Right and hidden is better.", "Look where others would not.", "Go one step odder.", "Last one. Make it count."];

function showPrompt() {
  const p = prompts[idx];
  phase = "answer";
  rv = null;
  timeLeft = SECONDS;
  lastTick = SECONDS;
  shownSecs = shownTicks = -1;
  ui.step.textContent = `Prompt ${idx + 1} of ${COUNT}`;
  ui.cat.textContent = p.catName || "Math";
  ui.prompt.textContent = p.text;
  ui.prompt.classList.toggle("long", p.text.length > 44);
  ui.note.textContent = p.hint;
  ui.note.className = "rf-note";
  ui.input.value = "";
  ui.input.placeholder = p.sample;
  ui.answer.hidden = false;
  ui.reveal.hidden = true;
  ui.timer.classList.remove("low", "stopped");
  host("think", idx === COUNT - 1 ? OPENERS[6] : OPENERS[idx % 6]);
  paintDots();
  focusInput();
}
function focusInput() { if (phase === "answer" && g.state === "playing") ui.input.focus({ preventScroll: true }); }

function lockIn(fromTimer = false) {
  if (phase !== "answer") return;
  const p = prompts[idx];
  const raw = ui.input.value;
  let j = raw.trim() ? p.judge(raw) : { status: "reject", msg: "Type an answer first." };
  if (j.status === "reject") {
    if (!fromTimer) {
      ui.note.textContent = j.msg;
      ui.note.className = "rf-note bad";
      ui.form.classList.remove("shake");
      void ui.form.offsetWidth;
      ui.form.classList.add("shake");
      sfx.play("tick");
      return;
    }
    j = { status: "none", shown: raw.trim() || "No answer", msg: raw.trim() ? "Time ran out before that could be read as an answer." : "Time ran out.", points: 0 };
  }
  const res = { q: p.text, answer: String(j.shown), points: j.points || 0, tier: tierOf(j.points || 0), status: j.status };
  results.push(res);
  if (mode === "daily") store.saveProgress("daily", { results });
  reveal(p, j, res);
}

function reveal(p, j, res) {
  phase = "reveal";
  const good = j.status === "ok";
  ui.answer.hidden = true;
  ui.timer.classList.add("stopped");
  const ex = p.examples(good ? j.shown : null);
  const last = idx === COUNT - 1;
  const verdict = good ? TIERS[res.tier] : j.status === "wrong" ? (p.kind === "bank" ? "Not listed" : "Not right") : "No score";
  ui.reveal.hidden = false;
  ui.reveal.innerHTML = `
    <div class="rf-yours ${good ? "t" + res.tier : "miss"}"><span class="rf-ans">${esc(res.answer)}</span>${px(verdict, "rf-verdict", good ? TIER_COL[res.tier] : COL.red)}${px("+" + res.points, "rf-pts", good ? TIER_COL[res.tier] : COL.red)}</div>
    <div class="rf-meter"><div class="rf-track">${Array.from({ length: BLOCKS }, (_, i) => `<i style="--c:${meterColor(i)}"></i>`).join("")}</div><div class="rf-labels"><span>Common</span><span>Uncommon</span><span>Rare</span><span>Very rare</span></div></div>
    <p class="rf-why">${esc(good ? j.why : j.msg)}</p>
    <div class="rf-ex"><div class="rf-ex-h">${good ? "Other right answers" : "Some right answers"}${p.count ? `<span>${p.count} on our list</span>` : ""}</div>${ex.map((e) => `<div class="rf-ex-row t${e.tier}"><b>${esc(e.text)}</b><span class="rf-tier">${TIERS[e.tier]}</span><em>${e.points}</em></div>`).join("")}</div>
    <button class="rf-b rf-next" type="button">${last ? "See my score" : "Next"}</button>`;
  paintText(ui.reveal);
  rv = { target: good ? Math.max(1, Math.round(res.points / 10)) : 0, shown: 0, t: 0, done: false, res, blocks: [...ui.reveal.querySelectorAll(".rf-track i")] };
  host(good ? "idle" : "sad", good ? "Let us see how well it hides." : j.status === "wrong" ? "Not this time. Look at what would have worked." : "The clock won that one.");
  if (!good) { sfx.play("wrong"); g.shake(5, 0.25); rv.done = true; }
  paintDots();
  const btn = ui.reveal.querySelector(".rf-next");
  btn.addEventListener("click", next);
  if (!g.coarse) btn.focus({ preventScroll: true });
}
/** The meter fills block by block. When it stops, Archie reacts and the confetti flies. */
function stepReveal(dt) {
  if (!rv || rv.done) return;
  rv.t += dt;
  const want = Math.min(rv.target, Math.floor(rv.t / 0.055));
  while (rv.shown < want) {
    rv.blocks[rv.shown]?.classList.add("on");
    sfx.tone(300 + rv.shown * 70, 0.05, { type: "square", vol: 0.12 });
    rv.shown++;
  }
  if (rv.shown < rv.target) return;
  rv.done = true;
  const t = rv.res.tier;
  const r = ui.card.getBoundingClientRect(), s = g.stage.getBoundingClientRect(), a = ui.archie.getBoundingClientRect();
  const cx = ((r.left + r.width / 2 - s.left) / s.width) * GW, cy = ((r.top + r.height * 0.4 - s.top) / s.height) * GH;
  fx.text("+" + rv.res.points, ((a.left + a.width / 2 - s.left) / s.width) * GW, ((a.top - s.top) / s.height) * GH + 2, TIER_COL[t]);
  if (t === 3) { sfx.play("power"); host("cheer", "Now that one hides well. Beautiful."); fx.burst(cx, cy, 70, { speed: 90, up: 60 }); fx.burst(cx, cy, 14, { speed: 50, spark: true, colors: [COL.gold, COL.white] }); fx.rain(GW, 50); g.shake(7, 0.35); }
  else if (t === 2) { sfx.play("correct"); host("cheer", "A rare one. Nice digging."); fx.burst(cx, cy, 40, { speed: 75 }); fx.burst(cx, cy, 6, { speed: 40, spark: true, colors: [COL.pink, COL.white] }); }
  else if (t === 1) { sfx.play("coin"); host("wave", "Right, and a little off the usual path."); fx.burst(cx, cy, 16, { speed: 55, colors: [COL.green, COL.white] }); }
  else { sfx.play("pop"); host("idle", "Right, but easy to spot. Dig deeper next time."); fx.burst(cx, cy, 6, { speed: 40, colors: [COL.cyan] }); }
}

function next() {
  if (phase !== "reveal") return;
  sfx.play("click");
  fx.clear();
  idx++;
  if (idx >= COUNT) return finish();
  showPrompt();
}

function shareText(rec) {
  const line = rec.results.map((r) => (r.points ? "CURV"[r.tier] : "-")).join(" ");
  return `Rare Find ${rec.daily ? "daily " + rec.date : "practice"}\n${rec.total}/700 ${rankOf(rec.total)}\n${line}\nV very rare, R rare, U uncommon, C common, - miss`;
}
function unlockBar() {
  const list = SKINS.filter((s) => s.need).sort((a, b) => a.need - b.need);
  const nextUp = list.find((s) => s.need > g.xp);
  if (!nextUp) return `<p class="rf-unlock">Every Archie look is unlocked.</p>`;
  const prev = [...list].reverse().find((s) => s.need <= g.xp)?.need || 0;
  const n = Math.max(0, Math.min(BLOCKS, Math.floor(((g.xp - prev) / (nextUp.need - prev)) * BLOCKS)));
  return `<div class="rf-unlock"><span>Next look: <b>${esc(nextUp.name)} Archie</b></span><span class="rf-track mini">${Array.from({ length: BLOCKS }, (_, i) => `<i class="${i < n ? "on" : ""}" style="--c:${COL.gold}"></i>`).join("")}</span></div>`;
}
function resultCard(rec, again) {
  const rank = rankOf(rec.total);
  const streak = store.streak();
  const text = shareText(rec);
  const mood = rec.total >= 340 ? "cheer" : rec.total >= 200 ? "wave" : rec.total > 0 ? "idle" : "sad";
  showResult(
    g,
    `<div class="rf-res-top"><canvas class="rf-res-archie" width="40" height="40" aria-hidden="true"></canvas><div class="rf-res-score">${px(rank, "rf-rank", COL.gold, "#b3402a")}<div class="rf-big">${px(String(rec.total), "rf-big-n", COL.white)}<small>of 700</small></div><p class="rf-sub">${rec.daily ? `Daily puzzle ${rec.date}` : "Practice round"}${streak ? `. Day streak ${streak}` : ""}</p></div></div>
     <div class="rf-rows">${rec.results.map((r, i) => `<div class="rf-row ${r.points ? "t" + r.tier : "miss"}"><i>${i + 1}</i><span class="q">${esc(r.q)}</span><b>${esc(r.answer)}</b><span class="rf-tier">${r.points ? TIERS[r.tier] : "Miss"}</span><em>${r.points}</em></div>`).join("")}</div>
     <p class="rf-honest">${HONEST}</p>
     ${unlockBar()}
     ${again ? `<p class="rf-again">You already played today's puzzle. A new one arrives tomorrow.</p>` : ""}
     <div class="rf-actions"><button class="rf-b" data-a="play" type="button">${rec.daily ? "Play practice" : "Play again"}</button><button class="rf-b quiet" data-z="copy" type="button">Copy result</button><button class="rf-b quiet" data-a="quit" type="button">Title</button></div>`,
    (card) => {
      card.classList.add("rf-result");
      paintText(card);
      const c = card.querySelector(".rf-res-archie");
      drawArchie(c.getContext("2d"), 0, 0, { pose: mood, t: mood === "cheer" ? 0.26 : 1.2, skin: skin() });
      wireCopy(card, text);
      if (rec.daily) card.querySelector("[data-a=play]").addEventListener("click", () => setMode("practice"), true);
    }
  );
}
function finish() {
  phase = "done";
  const rec = { total: total(), results, daily: mode === "daily", date: dayLabel() };
  if (rec.daily) store.finish("daily", rec);
  g.addXp(Math.round(rec.total / 10));
  host(rec.total >= 340 ? "cheer" : rec.total >= 200 ? "wave" : "idle", rec.total >= 340 ? "What a dig." : "Good game.");
  g.over({ score: rec.total, won: rec.total >= 200, title: rankOf(rec.total) });
  resultCard(rec, false);
}

g.onStart = () => {
  if (posterOn) { posterOn = false; g.posterMode = false; ui.poster.hidden = true; g.stage.classList.remove("rf-poster-on"); }
  fx.clear();
  mode = getMode();
  ui.chip.textContent = mode === "daily" ? "Daily" : "Practice";
  if (mode === "daily") {
    const done = store.done("daily");
    if (done) {
      results = done.results; idx = COUNT; phase = "done";
      paintDots();
      g.state = "over";
      g.stage.dataset.state = "over";
      return resultCard(done, true);
    }
  }
  prompts = makeGame(mode === "daily" ? math.dailySeed(11) : (Math.random() * 2 ** 31) | 0, COUNT);
  const saved = mode === "daily" ? store.progress("daily") : null;
  results = saved?.results?.slice(0, COUNT) || [];
  idx = results.length;
  if (idx >= COUNT) return finish();
  showPrompt();
};
g.onPause = (paused) => { if (!paused) setTimeout(focusInput, 0); };

ui.form.addEventListener("submit", (e) => { e.preventDefault(); lockIn(); });
ui.input.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); g.pause(); } });
ui.input.addEventListener("input", () => { if (phase === "answer") sfx.tone(520 + (ui.input.value.length % 6) * 40, 0.025, { type: "square", vol: 0.05 }); });
// keep the cursor in the box on a keyboard, so typing always lands
ui.input.addEventListener("blur", () => { if (!g.coarse) setTimeout(() => { if (document.activeElement === document.body) focusInput(); }, 0); });
layer.addEventListener("pointerdown", (e) => { if (phase === "answer" && !e.target.closest("button, input")) { e.preventDefault(); focusInput(); } });

g.loop(
  (dt) => {
    sceneT += dt;
    poseT += dt;
    fx.update(dt);
    if (phase === "reveal") stepReveal(dt);
    if (phase !== "answer") return;
    timeLeft -= dt;
    const s = Math.ceil(timeLeft);
    if (s < lastTick && s <= 5 && s > 0) sfx.play("tick");
    lastTick = s;
    if (timeLeft <= 0) { timeLeft = 0; lockIn(true); }
  },
  () => {
    if (posterOn) return paintPoster();
    drawSky(skyCtx, GW, GH, sceneT * 3, { floor: true });
    fx.draw(fxCtx, GW, GH);
    archCtx.clearRect(0, 0, 40, 40);
    drawArchie(archCtx, 0, 0, { pose, t: g.state === "menu" ? 0.3 : poseT, skin: skin() });
    const sx = g.state === "playing" ? g.shakeX : 0, sy = g.state === "playing" ? g.shakeY : 0;
    layer.style.transform = sx || sy ? `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)` : "";
    if (phase !== "answer") return;
    const s = Math.max(0, Math.ceil(timeLeft));
    if (s !== shownTicks) { shownTicks = s; ui.ticks.forEach((el, i) => el.classList.toggle("off", i >= s)); }
    if (s !== shownSecs) { shownSecs = s; setText(ui.secs, s, s <= 5 ? COL.red : COL.cyan); ui.timer.classList.toggle("low", s <= 5); }
  }
);

// ---------- poster: one composed hero shot, no HUD, no words ----------
function paintPoster() {
  const r = g.stage.getBoundingClientRect();
  const w = r.width || 960, h = r.height || 540;
  const c = ui.poster;
  if (w < h) { c.width = 64; c.height = Math.round((64 * h) / w); } else { c.width = Math.round((64 * w) / h); c.height = 64; }
  drawPoster(c.getContext("2d"), c.width, c.height, skin());
}
function poster() {
  posterOn = true;
  g.posterMode = true;
  ui.poster.hidden = false;
  g.stage.classList.add("rf-poster-on");
  paintPoster();
}

host("wave", HELLO);
paintDots();
sizeGrid();
g.redraw?.();
g.debug = { get phase() { return phase; }, get idx() { return idx; }, get results() { return results; }, get prompts() { return prompts; }, get timeLeft() { return timeLeft; }, lockIn, next, poster, fx, type(text) { ui.input.value = text; lockIn(); } };
