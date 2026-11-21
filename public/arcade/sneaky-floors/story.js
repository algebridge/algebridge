// Sneaky Floors: the intro story and the ending, told in chalk panels that draw themselves.
// Pure functions of story time t (seconds), so g.advance steps them like the rest of the game.
// api: { board(k), hero(k, x, y, size, opts), text(k, str, x, y, size, color, align, weight), FONT, fx, dust(x, y, n), scribble(), sfx }
import { chalkStroke, chalkDot, chalkFace, line, poly, arc, quad, rectPts, CHALK, YEL, PINK } from "./chalk.js";

export const TB = 5, TC = 10, TF = 16.1, TD = TF + 0.4, INTRO_LEN = TD + 2.75, END_LEN = 7;
const FY = 455, HS = 92, HY = FY - 34;
const cl = (v) => Math.max(0, Math.min(1, v)), pr = (t, a, d) => cl((t - a) / d), ez = (p) => p * p * (3 - 2 * p), lerp = (a, b, p) => a + (b - a) * p;
const NIGHT = "#c9d6f2";
const IB = { x: 250, y: 110, w: 460, h: 258.75 }, ZS = 960 / IB.w;

// ---------- panel A: the classroom at night ----------
const ROOM = [];
const R = (pts, t0, dur, color = NIGHT, width = 3) => ROOM.push({ pts, t0, dur, color, width });
R(line(30, 432, 930, 432, 14), 0.1, 0.6);
R(rectPts(IB.x - 9, IB.y - 9, IB.w + 18, IB.h + 18, 14), 0.3, 0.9, "#d9b98a", 4);
R(line(236, 388, 724, 388, 12), 0.9, 0.4, "#d9b98a", 4);
R(line(300, 382, 326, 381, 6), 1.2, 0.15, CHALK, 5);
R(rectPts(628, 372, 44, 13, 8), 1.25, 0.25, PINK, 2.5);
R(rectPts(62, 122, 130, 168, 12), 1.0, 0.6);
R(line(127, 122, 127, 290, 12), 1.5, 0.2); R(line(62, 206, 192, 206, 12), 1.6, 0.2);
R(arc(150, 166, 21, 21, 0.9, 5.4), 1.8, 0.35, YEL); R(arc(160, 166, 17, 19, 1.25, 5.05), 2.0, 0.3, YEL);
for (const [x, y] of [[88, 150], [104, 250], [168, 240]]) { R(line(x - 5, y, x + 5, y, 4), 2.2, 0.1, YEL, 2); R(line(x, y - 5, x, y + 5, 4), 2.25, 0.1, YEL, 2); }
R(arc(832, 172, 37, 37, -1.5, 4.9), 1.3, 0.5);
R(line(832, 172, 832, 146, 6), 1.8, 0.12); R(line(832, 172, 842, 158, 6), 1.9, 0.12);
for (let i = 0; i < 4; i++) R(line(832 + Math.cos(i * 1.571) * 29, 172 + Math.sin(i * 1.571) * 29, 832 + Math.cos(i * 1.571) * 34, 172 + Math.sin(i * 1.571) * 34, 4), 2.0, 0.1, NIGHT, 2);
[150, 480, 810].forEach((dx, i) => {
  const t0 = 2.1 + i * 0.22;
  R(rectPts(dx - 74, 468, 148, 11, 12), t0, 0.3);
  R(line(dx - 62, 480, dx - 67, 536, 10), t0 + 0.2, 0.15); R(line(dx + 62, 480, dx + 67, 536, 10), t0 + 0.25, 0.15);
  R(poly([dx - 24, 468, dx - 26, 438, dx + 26, 438, dx + 24, 468], 10), t0 + 0.3, 0.25, NIGHT, 2.5);
});

// ---------- panels B and C: on the board ----------
const FLOOR = line(60, FY, 900, FY, 10);
const CORNER = poly([40, 322, 244, 322, 244, FY], 12);
const DOOR = [[826, 300], [826, 262], ...arc(847, 262, 21, 15, Math.PI, Math.PI * 2, 8), [868, 300]];
const LEDGE = line(786, 300, 902, 300, 10);
const LINE_C = "Class dismissed. If you can reach it.";
const walkX = (t) => lerp(150, 430, ez(pr(t, 8.5, 1.2)));
const eraser = (t) => {
  if (t < 11.3) return [lerp(1010, 900, pr(t, 11, 0.3)), FY - 14];
  if (t < 12.5) return [lerp(900, 470, pr(t, 11.3, 1.2)), FY - 14];
  if (t < 12.6) { const p = pr(t, 12.5, 0.1); return [lerp(470, 390, p), FY - 14 - Math.sin(p * Math.PI) * 60]; }
  if (t < 13.4) return [lerp(390, 60, pr(t, 12.6, 0.8)), FY - 14];
  const p = pr(t, 13.4, 0.5); return [60 - p * 140, FY - 14 - p * 30];
};
function floorSeg(k, a, b, o = {}) {
  if (b - a < 6) return;
  const i0 = Math.max(0, Math.ceil((a - 60) / 10)), i1 = Math.min(FLOOR.length - 1, Math.floor((b - 60) / 10));
  if (i1 > i0) chalkStroke(k, FLOOR.slice(i0, i1 + 1), { width: 3.5, seed: 11, i0, ...o });
}
function reveal(k, api, str, x, y, size, color, p) {
  if (p <= 0) return;
  k.save(); k.font = `900 ${size}px ${api.FONT}`;
  const w = k.measureText(str).width;
  k.beginPath(); k.rect(x - w / 2 - 6, y - size, (w + 12) * p, size * 2); k.clip();
  api.text(k, str, x, y, size, color, "center", 900);
  k.restore();
}
function drawEraser(k, x, y, rub) {
  k.save(); k.translate(x, y); k.rotate(rub ? Math.sin(rub * 42) * 0.07 : 0);
  k.fillStyle = "#e98d8d"; k.fillRect(-28, -13, 56, 16);
  k.fillStyle = "#d8d4c6"; k.fillRect(-28, 3, 56, 9);
  chalkStroke(k, rectPts(-28, -13, 56, 25, 9), { width: 2.5, seed: 70 });
  chalkStroke(k, line(-28, 3, 28, 3, 9), { width: 2, seed: 71, double: false });
  k.restore();
}
function boardScene(k, t, api) {
  api.board(k);
  const boil = Math.floor(t * 7);
  chalkStroke(k, CORNER, { width: 2.5, seed: 9, alpha: 0.5 });
  // the floor: drawn, then rubbed out from both sides, leaving the bit he stands on
  const dy = t > TF ? 1500 * (t - TF) * (t - TF) : 0;
  if (t < 11.3) floorSeg(k, 60, lerp(244, 900, ez(pr(t, 5.6, 1.0))));
  else {
    const xr = lerp(900, 470, pr(t, 11.3, 1.2)), xl = t < 12.6 ? 390 : lerp(390, 60, pr(t, 12.6, 0.8));
    k.save(); k.lineCap = "round"; k.strokeStyle = "rgba(244,241,230,0.07)"; k.lineWidth = 26;
    k.beginPath(); k.moveTo(xr + 14, FY - 2); k.lineTo(900, FY - 2); if (xl < 388) { k.moveTo(xl + 14, FY - 2); k.lineTo(390, FY - 2); } k.stroke(); k.restore();
    floorSeg(k, 470, xr); floorSeg(k, 60, xl);
    k.save(); k.translate(0, dy); if (dy) { k.translate(430, FY); k.rotate(-dy * 0.0012); k.translate(-430, -FY); }
    floorSeg(k, 390, 470);
    if (t > TF - 0.25) for (const x of [408, 446]) chalkStroke(k, [[x - 5, FY + 2], [x + 1, FY + 9], [x - 3, FY + 14], [x + 5, FY + 22]], { width: 2, seed: x, prog: pr(t, TF - 0.25, 0.15) });
    k.restore();
  }
  // the far door and the one line of the story
  if (t > 13.4) {
    chalkStroke(k, LEDGE, { width: 3.5, seed: 14, prog: pr(t, 13.4, 0.35) });
    chalkStroke(k, DOOR, { width: 3.5, seed: 15, color: YEL, prog: pr(t, 13.65, 0.7) });
    if (t > 14.35) chalkDot(k, 861, 284, 2.6, YEL, 16, 0);
    reveal(k, api, LINE_C, 404, 122, 28, CHALK, pr(t, 13.7, 1.1));
  }
  if (t > TC) chalkFace(k, 772, 120 + (t > 11 && t < 11.6 ? Math.sin((t - 11) * 26) * 4 * (11.6 - t) : 0), 44, { mood: t < 11 ? "flat" : "smirk", prog: pr(t, TC, 0.9), boil: Math.floor(t * 5), look: { x: -0.7, y: 0.6 } });
  // Archie
  const [ex, ey] = eraser(t);
  let x = t < 8.5 ? 150 : walkX(t), y = HY + dy, o = { pose: "idle", look: { x: 0, y: 0 }, t, boil: t < 5.3 ? 0 : boil };
  if (t < 5.3) o.draw = 0.55 * pr(t, 2.9, 1.3);
  else if (t < 6.6) o.draw = lerp(0.55, 1, pr(t, 5.3, 1.3));
  else if (t < 8) { o.blink = (t > 6.9 && t < 7.02) || (t > 7.3 && t < 7.42); o.look = { x: t < 7.5 ? 0 : t < 7.75 ? -0.9 : 0.9, y: 0 }; }
  else if (t < 8.35) { const p = (t - 8) / 0.35; y -= 4 * 40 * p * (1 - p); o.pose = "jump"; }
  else if (t < 8.5) { const p = (t - 8.35) / 0.15; o.squashX = 1 + 0.16 * (1 - p); o.squashY = 1 - 0.16 * (1 - p); y += 5 * (1 - p); }
  else if (t < 9.7) { o.pose = "run"; o.rotation = 0.08; o.look = { x: 0.7, y: 0 }; y -= Math.abs(Math.sin(t * 14)) * 3; }
  else if (t < TC) o.pose = "happy";
  else if (t < 11.3) o.look = { x: 0.9, y: -0.8 };
  else if (t < 13.5) { o.pose = "surprised"; o.look = { x: ex > x ? 0.9 : -0.9, y: 0.7 }; }
  else if (t < TF - 0.25) o.look = { x: 0.9, y: -0.6 };
  else if (t < TF) { o.pose = "surprised"; o.look = { x: 0, y: 0.9 }; }
  else { o.pose = "fall"; o.look = { x: 0, y: -0.5 }; }
  api.hero(k, x, y, HS, o);
  if (t > 10.95 && t < 13.95) drawEraser(k, ex, ey, t > 11.3 && t < 13.4 ? t : 0);
  api.fx.draw(k);
}

export function drawIntro(k, t, api) {
  if (t < TB + 0.3) {
    const z = ez(pr(t, 4.5, 0.8)), cy0 = IB.y + IB.h / 2;
    k.fillStyle = "#0b1326"; k.fillRect(0, 0, 960, 540);
    k.save(); k.translate(480, lerp(cy0, 270, z)); k.scale(lerp(1, ZS, z), lerp(1, ZS, z)); k.translate(-480, -cy0);
    // moonlight from the window
    const gr = k.createLinearGradient(130, 200, 420, 520); gr.addColorStop(0, `rgba(190,210,255,${0.1 * pr(t, 1.6, 0.8)})`); gr.addColorStop(1, "rgba(190,210,255,0)");
    k.fillStyle = gr; k.beginPath(); k.moveTo(62, 290); k.lineTo(192, 290); k.lineTo(470, 540); k.lineTo(150, 540); k.closePath(); k.fill();
    k.save(); k.translate(IB.x, IB.y); k.scale(1 / ZS, 1 / ZS); boardScene(k, t, api); k.restore();
    k.fillStyle = `rgba(8,14,40,${0.4 * (1 - z)})`; k.fillRect(IB.x, IB.y, IB.w, IB.h);
    ROOM.forEach((s, i) => chalkStroke(k, s.pts, { color: s.color, width: s.width, seed: 200 + i, prog: pr(t, s.t0, s.dur), alpha: 0.9 }));
    k.restore();
  } else boardScene(k, t, api);
}

/** The last beat plays on the real stage: he drops in, looks at you, shrugs, and gets ready to run. */
export function heroD(td) {
  if (td < 0.3) { const p = td / 0.3; return { dy: -430 * (1 - p * p), pose: "fall", look: { x: 0, y: 0.8 } }; }
  if (td < 0.6) return { dy: 0, sq: 1 - (td - 0.3) / 0.3, pose: "idle", look: { x: 0, y: 0 } };
  if (td < 1.3) return { dy: 0, pose: "idle", look: { x: 0, y: 0 }, blink: td > 0.9 && td < 1.02 };
  if (td < 2.3) { const p = Math.sin(cl((td - 1.3) / 0.25) * 1.571); return { dy: -3 * p, pose: "shrug", look: { x: 0, y: -0.3 } }; }
  return { dy: 0, pose: "run", look: { x: 0.8, y: 0 }, lean: 0.12 };
}

const cue = (list, t0, t1, api) => { for (const [t, fn] of list) if (t >= t0 && t < t1) fn(api, t); };
const every = (a, b, step, fn) => { const out = []; for (let t = a; t < b - 1e-6; t += step) out.push([t, fn]); return out; };
const INTRO_CUES = [
  ...[0.2, 0.9, 1.5, 2.1, 2.9, 3.5, 5.4, 6.0, 10.0, 10.5, 13.4, 13.8, 14.3, 14.7].map((t) => [t, (a) => a.scribble()]),
  [4.5, (a) => a.sfx.play("whoosh")],
  [6.9, (a) => a.sfx.play("tick")], [7.3, (a) => a.sfx.play("tick")],
  [8.0, (a) => { a.sfx.play("jump"); a.dust(150, FY, 5); }], [8.35, (a) => { a.sfx.play("land"); a.dust(150, FY, 8); }],
  ...every(8.55, 9.7, 0.22, (a, t) => { a.sfx.noise(0.04, { freq: 2400, vol: 0.3 }); a.dust(walkX(t) - 10, FY, 2); }),
  [9.7, (a) => a.sfx.play("pop")],
  [11.0, (a) => { a.sfx.tone(520, 0.12, { slide: 300, type: "square", vol: 0.3 }); a.sfx.tone(390, 0.2, { slide: 240, type: "square", vol: 0.3, delay: 0.13 }); }],
  ...every(11.3, 13.4, 0.12, (a, t) => { const [x, y] = eraser(t); a.dust(x, y + 12, 2); }),
  ...every(11.3, 13.4, 0.35, (a) => a.sfx.noise(0.3, { freq: 700, vol: 0.45 })),
  [11.4, (a) => a.sfx.tone(700, 0.08, { slide: 1500, type: "square", vol: 0.25 })],
  [TF - 0.25, (a) => a.sfx.play("tick")],
  [TF, (a) => { a.sfx.noise(0.18, { freq: 500, vol: 0.7 }); a.sfx.tone(300, 0.3, { slide: 90, vol: 0.3 }); a.dust(430, FY, 10); }],
  [TD + 0.3, (a) => a.land()], [TD + 1.3, (a) => a.sfx.play("pop")], [TD + 2.3, (a) => a.sfx.play("whoosh")],
];
export const introCues = (t0, t1, api) => cue(INTRO_CUES, t0, t1, api);

// ---------- the ending: the door opens onto a sunny real hallway, and the chalk face sulks ----------
const DX = 748, DW = 124, DT = 262;
const BIG_DOOR = [[DX, FY], [DX, DT + 40], ...arc(DX + DW / 2, DT + 40, DW / 2, 40, Math.PI, Math.PI * 2, 12), [DX + DW, FY]];
const endX = (t) => (t < 2 ? 170 : t < 4.4 ? lerp(170, DX - 40, pr(t, 2, 2.4)) : lerp(DX - 40, DX + DW / 2, ez(pr(t, 5.4, 0.8))));
function hallway(k) {
  const x0 = DX, x1 = DX + DW, bx0 = DX + 38, bx1 = DX + DW - 38, by0 = DT + 62, by1 = FY - 52;
  const wall = k.createLinearGradient(0, DT, 0, FY); wall.addColorStop(0, "#fff6cf"); wall.addColorStop(1, "#ffe09a");
  k.fillStyle = wall; k.fillRect(x0, DT - 4, DW, FY - DT + 4);
  k.fillStyle = "#8fc3e6"; k.beginPath(); k.moveTo(x0, DT + 20); k.lineTo(bx0, by0); k.lineTo(bx0, by1); k.lineTo(x0, FY); k.closePath(); k.fill();          // lockers
  k.fillStyle = "#ffd58c"; k.beginPath(); k.moveTo(x1, DT + 20); k.lineTo(bx1, by0); k.lineTo(bx1, by1); k.lineTo(x1, FY); k.closePath(); k.fill();
  k.fillStyle = "#e7b676"; k.beginPath(); k.moveTo(x0, FY); k.lineTo(bx0, by1); k.lineTo(bx1, by1); k.lineTo(x1, FY); k.closePath(); k.fill();                // floor
  k.strokeStyle = "rgba(60,90,120,0.55)"; k.lineWidth = 1.5; k.beginPath();
  for (let i = 1; i < 4; i++) { const p = i / 4, x = lerp(x0, bx0, p); k.moveTo(x, lerp(DT + 20, by0, p)); k.lineTo(x, lerp(FY, by1, p)); }
  k.stroke();
  k.strokeStyle = "rgba(150,100,50,0.5)"; k.beginPath();
  for (let i = 1; i < 4; i++) { const p = i / 4; k.moveTo(lerp(x0, bx0, p), lerp(FY, by1, p)); k.lineTo(lerp(x1, bx1, p), lerp(FY, by1, p)); }
  k.stroke();
  k.fillStyle = "#fffdf0"; k.fillRect(bx0, by0, bx1 - bx0, by1 - by0);                                                                                         // the bright far end
  k.save(); k.shadowColor = "#fff2a0"; k.shadowBlur = 22; k.fillStyle = "#ffd24a"; k.beginPath(); k.arc((bx0 + bx1) / 2, by0 + 24, 11, 0, 6.3); k.fill(); k.restore();
  k.fillStyle = "#bfe6ff"; k.fillRect(bx0, by0 + 44, bx1 - bx0, by1 - by0 - 44);
  k.fillStyle = "#8fd18a"; k.fillRect(bx0, by1 - 12, bx1 - bx0, 12);
}
export function drawEnding(k, t, api) {
  api.board(k);
  const boil = Math.floor(t * 7), op = ez(pr(t, 1.0, 0.8));
  chalkStroke(k, FLOOR, { width: 3.5, seed: 11, prog: pr(t, 0, 0.5) });
  const path = () => { k.beginPath(); BIG_DOOR.forEach((p, i) => (i ? k.lineTo(p[0], p[1]) : k.moveTo(p[0], p[1]))); k.closePath(); };
  if (op > 0) {
    // sunlight spills onto the board
    k.save(); k.globalAlpha = 0.2 * op; k.fillStyle = YEL; k.beginPath(); k.moveTo(DX, FY); k.lineTo(DX + DW, FY); k.lineTo(DX + 60, 534); k.lineTo(DX - 250, 534); k.closePath(); k.fill();
    k.globalAlpha = 0.5 * op; k.shadowColor = YEL; k.shadowBlur = 40; path(); k.fill(); k.restore();
    k.save(); path(); k.clip(); k.beginPath(); k.rect(DX, 0, DW * op, 540); k.clip(); hallway(k); k.restore();
  }
  if (op < 1) {
    k.save(); path(); k.clip(); k.fillStyle = "#143327"; k.fillRect(DX + DW * op, 0, DW * (1 - op), 540);
    if (t > 0.6) { k.globalAlpha = 0.5; k.strokeStyle = YEL; k.lineWidth = 2; const w = DW * (1 - op) - 24; if (w > 4) { k.strokeRect(DX + DW * op + 12, DT + 60, w, 50); k.strokeRect(DX + DW * op + 12, DT + 124, w, 50); } }
    k.restore();
  }
  chalkStroke(k, BIG_DOOR, { width: 4.5, seed: 21, color: YEL, prog: pr(t, 0.2, 0.7) });
  // the face: flat, then shocked, then sulking with the tally struck out
  const mood = t < 1.5 ? "flat" : t < 2.8 ? "shock" : "sulk";
  chalkFace(k, 230, 122 + (mood === "sulk" ? 3 : 0), 44, { mood, prog: pr(t, 0, 0.6), boil: Math.floor(t * 5), look: mood === "sulk" ? { x: -0.9, y: 0.8 } : { x: 0.8, y: 0.6 } });
  for (let i = 0; i < 5; i++) chalkStroke(k, i < 4 ? line(140 - i * 13, 96, 138 - i * 13, 146, 10) : line(150, 132, 88, 106, 10), { width: 3, seed: 30 + i, prog: pr(t, 0.2 + i * 0.06, 0.15) });
  chalkStroke(k, line(78, 128, 162, 112, 10), { width: 5, seed: 36, color: PINK, prog: pr(t, 3.2, 0.3) });
  if (mood === "sulk") chalkStroke(k, [[196, 60], [206, 52], [216, 62], [226, 51], [238, 61], [250, 52], [262, 60]], { width: 2.5, seed: 37, boil, prog: pr(t, 3.5, 0.4), alpha: 0.8 });
  reveal(k, api, "Class dismissed.", 520, 122, 36, YEL, pr(t, 4.4, 0.8));
  // Archie runs for the light, waves, and steps off the board
  const out = pr(t, 5.4, 0.8), x = endX(t), o = { pose: "idle", look: { x: 0.8, y: -0.2 }, t, boil };
  if (t > 1.8 && t < 2) o.pose = "happy";
  else if (t >= 2 && t < 4.4) { o.pose = "run"; o.rotation = 0.08; }
  else if (t >= 4.4 && t < 5.4) { o.pose = "wave"; o.look = { x: 0, y: 0 }; }
  else if (t >= 5.4) { o.pose = "run"; o.alpha = 1 - out; }
  const size = lerp(HS, 54, ez(out));
  if (out < 1) api.hero(k, x, FY - size * 0.37 - (o.pose === "run" ? Math.abs(Math.sin(t * 14)) * 3 : 0) - (t > 1.8 && t < 2 ? Math.sin((t - 1.8) * 15.7) * 14 : 0) - out * 14, size, o);
  api.fx.draw(k);
}
const END_CUES = [
  [0.1, (a) => a.scribble()], [0.5, (a) => a.scribble()],
  [1.0, (a) => a.sfx.tone(330, 0.6, { slide: 880, type: "sine", vol: 0.4 })],
  [1.5, (a) => a.sfx.tone(700, 0.08, { slide: 1500, type: "square", vol: 0.25 })],
  [1.8, (a) => a.sfx.play("jump")],
  ...every(2.05, 4.4, 0.22, (a, t) => { a.sfx.noise(0.04, { freq: 2400, vol: 0.3 }); a.dust(endX(t) - 10, FY, 2); }),
  [3.2, (a) => a.scribble()], [4.4, (a) => a.scribble()],
  [6.15, (a) => { a.sfx.play("coin"); a.sparkle(DX + DW / 2, FY - 70); }],
];
export const endCues = (t0, t1, api) => cue(END_CUES, t0, t1, api);
