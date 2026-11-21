// Six Guess: find the hidden true equation in six tries. Every guess must itself be a true equation.
// Round tiles: filled blue = right symbol, right spot. Amber ring = in the equation, other spot. Slate = not in it.
import { createGame, math, sfx, archieSVG } from "../kit/kit.js";
import { makeLayer, dailyStore, dayLabel, menuPicker, loadOpts, showResult, wireCopy, esc } from "./shell.js";
import { checkGuess, score, generate, bonus, normalize } from "./logic.js";

const TRIES = 6;
const SIZES = { easy: { len: 6, name: "Easy", salt: 21 }, classic: { len: 8, name: "Classic", salt: 22 }, algebra: { len: 8, name: "Algebra", salt: 23 } };
const DEFAULTS = { type: "daily", size: "easy" };
const MAX_HINTS = 2;
let store = null;

const g = createGame({
  slug: "six-guess",
  title: "Six Guess",
  tagline: "Find the hidden equation in six tries.",
  how: ["Every guess must be a true equation, like 3×4=12. Blank tiles are fine, and you get 2 hints.", "Blue tile: right spot. Amber ring: in it, other spot. Slate: not in it."],
  aspect: 16 / 9,
  bg: "#dbeafe",
  onMenu: (host) => {
    const g = window.__arcade; // createGame draws the menu before it returns
    store ||= dailyStore(g);
    // Easy is the default now: move an older saved choice over to it once
    if (!g.load("easyDefault", false)) { g.save("easyDefault", true); const old = g.load("opts", null); if (old) g.save("opts", { ...old, size: "easy" }); }
    menuPicker(host, g, [{ key: "size", options: [["easy", "Easy 6"], ["classic", "Classic 8"], ["algebra", "Algebra"]] }, { key: "type", options: [["daily", "Daily puzzle"], ["practice", "Practice"]] }], DEFAULTS, (o) => {
      const s = store.streak();
      const streak = s ? ` Day streak: <b>${s}</b>.` : "";
      const about = o.size === "algebra" ? "8 tiles, then one bonus question about x." : o.size === "easy" ? "6 tiles, one operation. The = spot is shown." : "8 tiles.";
      if (o.type === "practice") return about + " A new equation every time." + streak;
      const d = store.done(o.size);
      return (d ? `Today: ${d.won ? `solved in <b>${d.guesses}</b>` : "not solved"}. New puzzle tomorrow.` : about + " One try a day.") + streak;
    });
  },
});
const layer = makeLayer(g, "sg");
const PAD = ["7", "8", "9", "+", "-", "4", "5", "6", "×", "÷", "1", "2", "3", "0", "="];
layer.innerHTML = `
  <header class="dz-head"><span class="dz-title">Six Guess</span><span class="dz-chip sg-type">Daily</span><span class="dz-chip soft sg-size">Classic</span></header>
  <div class="sg-main">
    <div class="sg-boardwrap"><div class="sg-board"></div></div>
    <div class="sg-side">
      <div class="sg-host"><div class="dz-archie sg-archie"></div><div class="dz-bubble sg-say"></div></div>
      <div class="sg-legend"><span><i class="sg-t spot">7</i>Right spot</span><span><i class="sg-t near">7</i>Other spot</span><span><i class="sg-t miss">7</i>Not in it</span></div>
      <div class="sg-pad">${PAD.map((k) => `<button type="button" tabindex="-1" data-key="${k}">${k === "-" ? "−" : k}</button>`).join("")}<button type="button" tabindex="-1" data-key="back" class="del" aria-label="Delete">⌫</button><button type="button" tabindex="-1" data-key=" " class="small" aria-label="Blank tile">Blank</button><button type="button" tabindex="-1" data-key="hint" class="small hint">Hint</button><button type="button" tabindex="-1" data-key="enter" class="wide2 go">Enter</button></div>
    </div>
  </div>`;
const $ = (s) => layer.querySelector(s);
const ui = { type: $(".sg-type"), size: $(".sg-size"), board: $(".sg-board"), archie: $(".sg-archie"), say: $(".sg-say"), pad: $(".sg-pad") };

let size = "easy", type = "daily", len = 6, answer = "", rows = [], cur = "", status = "idle", fresh = -1, shake = false, bonusQ = null;
let shown = new Set(), hints = 0; // shown: tile positions given away (the = spot in Easy, and hints)
const face = (c) => (c === "-" ? "−" : c);

function host(pose, text) {
  ui.archie.innerHTML = archieSVG(pose, 90);
  ui.say.textContent = text;
}
function paint() {
  let html = "";
  for (let r = 0; r < TRIES; r++) {
    const done = rows[r], active = r === rows.length && status === "playing";
    html += `<div class="sg-row${active && shake ? " shake" : ""}${r === fresh ? " flip" : ""}">`;
    for (let i = 0; i < len; i++) {
      const ch = done ? done.guess[i] : active ? cur[i] || "" : "";
      const ghost = active && !ch && shown.has(i);
      const cls = done ? (done.replay || ch !== " " ? done.marks[i] : "miss blank") : ch === " " ? "typed blank" : ch ? "typed" : (ghost ? "ghost " : "") + (active && i === cur.length ? "next" : "");
      html += `<i class="sg-t ${cls}" style="--i:${i}">${ghost ? face(answer[i]) : face(ch.trim())}</i>`;
    }
    html += `</div>`;
  }
  ui.board.style.setProperty("--n", len);
  ui.board.innerHTML = html;
  shake = false;
  const known = {};
  const rank = { miss: 1, near: 2, spot: 3 };
  for (const row of rows) [...row.guess].forEach((ch, i) => { if (ch !== " " && (!known[ch] || rank[row.marks[i]] > rank[known[ch]])) known[ch] = row.marks[i]; });
  ui.pad.querySelectorAll("[data-key]").forEach((b) => { const k = b.dataset.key; if (k.length === 1 && k !== " ") b.className = known[k] || ""; });
  const hb = ui.pad.querySelector("[data-key=hint]");
  hb.textContent = `Hint ${MAX_HINTS - hints}`;
  hb.classList.toggle("off", hints >= MAX_HINTS);
}

function type_(ch) {
  if (status !== "playing" || g.state !== "playing") return;
  if (ch === "back") { if (cur) { cur = cur.slice(0, -1); sfx.play("tick"); } }
  else if (ch === "enter") return submit();
  else if (ch === "hint") return hint();
  else if (cur.length < len) { cur += ch; sfx.play("click"); }
  else return;
  fresh = -1;
  paint();
}
/** Reveal one correct tile in its place. Up to MAX_HINTS per puzzle; the count is shown in the result. */
function hint() {
  if (status !== "playing") return;
  ui.say.classList.remove("warn");
  if (hints >= MAX_HINTS) { host("idle", "No hints left for this puzzle."); sfx.play("tick"); return; }
  const found = new Set(shown);
  for (const row of rows) row.marks.forEach((m, i) => { if (m === "spot") found.add(i); });
  const open = [...answer].map((_, i) => i).filter((i) => !found.has(i));
  if (!open.length) { host("happy", "You already know every tile. Type it in."); return; }
  const i = open[Math.floor(Math.random() * open.length)];
  shown.add(i); hints++;
  if (type === "daily") store.saveProgress(size, { guesses: rows.map((r) => r.guess), shown: [...shown], hints });
  sfx.play("power");
  host("happy", `Hint: tile ${i + 1} is ${face(answer[i])}. It is marked in your row.`);
  fresh = -1;
  paint();
}
function submit() {
  if (status !== "playing") return;
  const typed = cur;
  if (cur.trim()) cur = cur.padEnd(len, " "); // a shorter equation is fine: the rest of the row is blank tiles
  const res = checkGuess(cur, len);
  if (!res.ok) {
    cur = typed;
    shake = true;
    fresh = -1;
    host("idle", res.msg);
    ui.say.classList.add("warn");
    sfx.play("tick");
    return paint();
  }
  ui.say.classList.remove("warn");
  const marks = score(cur, answer);
  rows.push({ guess: cur, marks });
  fresh = rows.length - 1;
  const won = cur === answer;
  cur = "";
  if (type === "daily") store.saveProgress(size, { guesses: rows.map((r) => r.guess), shown: [...shown], hints });
  if (won) {
    status = "won";
    sfx.play("correct");
    host("happy", rows.length === 1 ? "First try. Incredible." : rows.length <= 3 ? "Solved, and fast. Sharp work." : "Solved. Nicely done.");
    paint();
    return later(afterSolve);
  }
  if (rows.length >= TRIES) {
    status = "lost";
    host("sad", `It was ${[...answer].map(face).join("")}. So close.`);
    paint();
    return later(() => finish(false, null));
  }
  const spots = marks.filter((m) => m === "spot").length, near = marks.filter((m) => m === "near").length;
  sfx.play(spots >= len - 2 ? "coin" : "pop");
  host(spots >= len - 2 ? "happy" : "idle", spots + near === 0 ? "None of those are in it. That still narrows it down." : `${spots} in the right spot, ${near} in another spot. ${TRIES - rows.length} ${TRIES - rows.length === 1 ? "try" : "tries"} left.`);
  paint();
}
// Let the last row finish its reveal before a card covers it. Timed with g.time so g.advance works.
let pending = null;
const later = (fn, seconds = 0.9) => { pending = { at: g.time + seconds, fn }; };
async function afterSolve() {
  if (size !== "algebra") return finish(true, null);
  bonusQ = bonus(math.rng(type === "daily" ? math.dailySeed(29) : (Math.random() * 2 ** 31) | 0), Number(answer.split("=")[1]));
  const ok = await g.ask(bonusQ, { title: "Bonus: what x makes this true?" });
  finish(true, ok);
}

function shareText(rec) {
  const grid = rec.rows.map((m) => m.map((x) => (x === "spot" ? "#" : x === "near" ? "o" : ".")).join("")).join("\n");
  return `Six Guess ${rec.daily ? "daily " + rec.date : "practice"} (${SIZES[rec.size].name})\n${rec.won ? `Solved ${rec.guesses}/${TRIES}` : `Missed X/${TRIES}`}${rec.hints ? `, ${rec.hints} ${rec.hints === 1 ? "hint" : "hints"}` : ""}${rec.bonus == null ? "" : rec.bonus ? ", bonus yes" : ", bonus no"}\n${grid}\n# right spot, o other spot, . not in it`;
}
function resultCard(rec, again) {
  const text = shareText(rec);
  const streak = store.streak();
  const title = !rec.won ? "Not this time" : rec.guesses === 1 ? "First try" : rec.guesses <= 3 ? "Sharp solve" : rec.guesses <= 5 ? "Solved" : "Just in time";
  showResult(
    g,
    `<div class="dz-top"><div class="dz-archie">${archieSVG(rec.won ? "happy" : "sad", 80)}</div><div><h2>${title}</h2><div class="dz-big">${rec.won ? rec.guesses : "X"}<small> / ${TRIES} tries</small></div></div></div>
     <p class="dz-sub">${rec.daily ? `Daily puzzle ${rec.date}` : "Practice"} · ${SIZES[rec.size].name}${streak ? ` · Day streak ${streak}` : ""} · ${rec.hints ? `${rec.hints} ${rec.hints === 1 ? "hint" : "hints"} used` : "No hints used"}</p>
     <div class="sg-answer">${[...rec.answer].map((c) => `<i class="sg-t spot">${face(c)}</i>`).join("")}</div>
     ${rec.bonus == null ? "" : `<p class="sg-bonus ${rec.bonus ? "ok" : "no"}">Bonus ${rec.bonus ? "correct" : "missed"}: ${esc(rec.bonusText)} when x = ${rec.bonusX}</p>`}
     <div class="sg-mini">${rec.rows.map((m) => `<div>${m.map((x) => `<i class="${x}"></i>`).join("")}</div>`).join("")}</div>
     <div class="dz-share"><pre>${esc(text)}</pre><button class="dz-b quiet" data-z="copy" type="button">Copy result</button></div>
     ${again ? `<p class="dz-note">You already played today's ${SIZES[rec.size].name} puzzle. A new one arrives tomorrow.</p>` : ""}
     <div class="dz-actions">${rec.daily ? `<button class="dz-b" data-z="practice" type="button">Play practice</button>` : `<button class="dz-b" data-a="play" type="button">Play again</button>`}<button class="dz-b quiet" data-a="quit" type="button">Menu</button></div>`,
    (card) => {
      wireCopy(card, text);
      card.querySelector("[data-z=practice]")?.addEventListener("click", () => { g.save("opts", { ...loadOpts(g, DEFAULTS), type: "practice" }); g.start(); });
    }
  );
}
function finish(won, bonusOk) {
  const rec = { size, answer, won, guesses: rows.length, hints, rows: rows.map((r) => r.marks), bonus: bonusOk, bonusText: bonusQ?.text, bonusX: bonusQ?.x, daily: type === "daily", date: dayLabel() };
  if (rec.daily) store.finish(size, rec);
  if (won && bonusOk !== null) host(bonusOk ? "happy" : "idle", bonusOk ? "And the bonus too. Full marks." : `The bonus was x = ${bonusQ.x}.`);
  g.over({ score: won ? TRIES + 1 - rows.length : 0, won, title: won ? "Solved" : "Not this time" });
  resultCard(rec, false);
}

g.onStart = () => {
  const o = loadOpts(g, DEFAULTS);
  size = SIZES[o.size] ? o.size : "easy";
  type = o.type === "practice" ? "practice" : "daily";
  len = SIZES[size].len;
  ui.type.textContent = type === "daily" ? "Daily" : "Practice";
  ui.size.textContent = SIZES[size].name;
  ui.say.classList.remove("warn");
  cur = ""; fresh = -1; bonusQ = null; pending = null; shown = new Set(); hints = 0;
  if (type === "daily") {
    const done = store.done(size);
    if (done) {
      answer = done.answer;
      rows = done.rows.map((marks) => ({ guess: " ".repeat(len), marks, replay: true }));
      status = done.won ? "won" : "lost";
      host(done.won ? "happy" : "idle", "See you tomorrow for a new one.");
      paint();
      g.state = "over";
      g.stage.dataset.state = "over";
      return resultCard(done, true);
    }
  }
  answer = generate(math.rng(type === "daily" ? math.dailySeed(SIZES[size].salt) : (Math.random() * 2 ** 31) | 0), len, size === "algebra" ? 10 : 1);
  const saved = type === "daily" ? store.progress(size) : null;
  rows = (saved?.guesses || []).filter((q) => q.length === len && checkGuess(q, len).ok).slice(0, TRIES).map((guess) => ({ guess, marks: score(guess, answer) }));
  hints = Math.min(MAX_HINTS, saved?.hints || 0);
  shown = new Set((saved?.shown || []).filter((i) => i >= 0 && i < len).slice(0, hints + 1));
  if (size === "easy") shown.add(answer.indexOf("=")); // Easy shows where the = sign goes for free
  status = "playing";
  host("wave", rows.length ? "Welcome back. Your guesses are still here." : size === "easy" ? "Type a true equation. The = spot is marked for you." : "Type a true equation to start. Short ones are fine.");
  paint();
  const last = rows[rows.length - 1];
  if (last?.guess === answer) { status = "won"; afterSolve(); }
  else if (rows.length >= TRIES) { status = "lost"; finish(false, null); }
};

ui.pad.addEventListener("pointerdown", (e) => {
  const b = e.target.closest("[data-key]");
  if (!b) return;
  e.preventDefault();
  type_(b.dataset.key);
});
addEventListener("keydown", (e) => {
  if (g.state !== "playing" || status !== "playing" || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea")) return;
  const k = e.key === "Enter" ? "enter" : e.key === "Backspace" || e.key === "Delete" ? "back" : e.key === " " ? " " : e.key === "h" || e.key === "H" || e.key === "?" ? "hint" : normalize(e.key);
  if (k !== "enter" && k !== "back" && k !== "hint" && !(k.length === 1 && "0123456789+-×÷= ".includes(k))) return;
  e.preventDefault();
  type_(k);
});

g.loop(() => { if (pending && g.time >= pending.at) { const { fn } = pending; pending = null; fn(); } }, () => {});
len = 6;
host("wave", "Find the hidden equation.");
paint();
g.debug = { get answer() { return answer; }, get rows() { return rows; }, get cur() { return cur; }, get status() { return status; }, get bonus() { return bonusQ; }, get hints() { return hints; }, get shown() { return [...shown]; }, type: (s) => [...s].forEach((c) => type_(c === " " ? " " : normalize(c))), enter: () => type_("enter"), hint: () => type_("hint") };
