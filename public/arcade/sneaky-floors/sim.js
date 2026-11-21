// Sneaky Floors: the world rules. Pure and deterministic (no DOM, no random, no clock), so the
// same inputs always give the same run. A stage is a room map plus edits, objects and TRAPS:
//   trap = { id?, on: {...conditions, all must hold}, delay?: seconds (the beat), do: [actions] }
//   on:  zone:[x,y,w,h] tiles | xgt | xlt | ygt | ylt (player center, tiles) | jump | land:id|true | stand:id
//        | touch:id | t:seconds | fired:trapId | air | ground | g:1|-1 | tryMin:n | tryMax:n
//   do:  {fall:id} {show:id} {hide:id} {move:id, to:[x,y]|by:[dx,dy], time, ease} {ice:bool} {grav:1|-1}
//        {mirror:seconds} {scroll:tiles, time} {rule:{text,test}} {label:id, n} {swap:[a,b]} {say:text}
//        {set:id, props:{}}   every action may add at:seconds (after the trap fires). ids may be arrays.
//        {tilt:-1|0|1} the board leans and you slide   {jump:mult} jump power   {dark:seconds} lights off
//        {fx:name} a pure show effect (banner)   {belt:id, v} sets a block's treadmill speed
// Object props: crumble, crack, fake, ghost (unseen until touched), hidden, crush, n, belt (px/s, pushes you only
//   while you stand still on it), shut (a door that will not open), k:"s"+fake (painted spikes), k:"f" (a flag, only for show).
// Stage props: twin (a mirrored chalk copy: he dies on spikes and pits on HIS side), jump, tilt.
export const T = 40, VW = 960, VH = 540, OY = 20, DT = 1 / 60, PW = 22, PH = 30;
const RUN = 235, GRAV = 2000, JUMP = 650, MAXF = 900;
const arr = (v) => (Array.isArray(v) ? v : [v]);

function mk(o) {
  if (o.k === "d") return { ...o, x: o.x * T + 4, y: o.up ? o.y * T : (o.y + 1) * T - 60, w: 32, h: 60 };
  return { ...o, x: o.x * T, y: o.y * T, w: (o.w || 1) * T, h: (o.h || 1) * T };
}
const doorPos = (o, tx, ty) => [tx * T + 4, o.up ? ty * T : (ty + 1) * T - 60];

export function compile(stage, rooms) {
  const room = rooms[stage.room];
  const rows = room.map.map((r) => r.split(""));
  const H = rows.length, W = rows[0].length;
  for (const [x, y, w, h] of stage.cut || []) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) rows[j][i] = ".";
  for (const e of stage.edit || []) { const m = /^(\d+),(\d+):(.*)$/.exec(e); let x = +m[1]; for (const ch of m[3]) rows[+m[2]][x++] = ch; }
  const rects = [], objs = [], box = {};
  let spawn = { x: 2, y: 11 };
  for (let y = 0; y < H; y++) {
    let run = null, sp = null;
    for (let x = 0; x <= W; x++) {
      const ch = x < W ? rows[y][x] : ".";
      if (ch === "#") { if (!run) run = { x: x * T, y: y * T, w: 0, h: T }; run.w += T; } else if (run) { rects.push(run); run = null; }
      if (ch === "^" || ch === "!") { if (!sp || sp.ch !== ch) { sp = { id: "^" + objs.length, k: "s", x, y, w: 0, h: 1, dn: ch === "!", ch }; objs.push(sp); } sp.w++; } else sp = null;
      if (ch === "S") spawn = { x, y };
      else if (/[a-zA-Z]/.test(ch)) { const b = box[ch] || (box[ch] = { x0: x, y0: y, x1: x, y1: y }); b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y); }
    }
  }
  for (const ch in box) { const b = box[ch], p = stage.obj?.[ch] || {}; objs.push({ id: ch, k: ch === "D" ? "d" : "b", x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, ...p }); }
  for (const o of stage.objs || []) objs.push({ k: "b", ...o });
  let ni = 0;
  for (const [x, y, w, list] of stage.nums || []) list.forEach((n, i) => { if (n != null) objs.push({ id: "n" + ni++, k: "b", x: x + i * w, y, w, h: 1, n }); });
  return { stage, W, H, rects, objs: objs.map(mk), spawn, traps: stage.traps || [], rule: stage.rule || null };
}

export function newSim(c, attempt = 0) {
  return {
    c, try: attempt, t: 0, grace: 0,
    p: { x: c.spawn.x * T + (T - PW) / 2, y: (c.spawn.y + 1) * T - PH, vx: 0, vy: 0, g: 1, ground: true, gid: null, coy: 0, buf: 0, jh: false, face: 1 },
    objs: c.objs.map((o) => ({ ...o })), fired: new Float32Array(c.traps.length).fill(-1), pend: [],
    ice: !!c.stage.ice, tilt: c.stage.tilt || 0, jp: c.stage.jump || 1, dark: 0, twinAir: 0, mirror: 0, cam: { x: 0, mv: null }, rule: c.rule, dead: null, won: null, ev: [],
  };
}
export function clone(s) {
  return { ...s, p: { ...s.p }, objs: s.objs.map((o) => ({ ...o })), fired: s.fired.slice(), pend: s.pend.slice(), cam: { ...s.cam }, ev: [] };
}
const get = (s, id) => s.objs.find((o) => o.id === id);
const hit = (ax, ay, aw, ah, b) => ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
const solidObj = (o) => o.k === "b" && !o.hidden && !o.fake && !o.falling;
function embedded(s) {
  const p = s.p;
  for (const r of s.c.rects) if (hit(p.x, p.y, PW, PH, r)) return true;
  for (const o of s.objs) if (solidObj(o) && hit(p.x, p.y, PW, PH, o)) return true;
  return false;
}
function die(s, why) { if (!s.dead && !s.won) { s.dead = why; s.ev.push({ type: "die", why }); } }

function act(s, a) {
  const E = s.ev;
  if (a.fall != null) for (const id of arr(a.fall)) { const o = get(s, id); if (o && !o.falling && !o.gone) { o.falling = true; o.vy = 0; o.fg = s.p.g; E.push({ type: "fall", id }); } }
  if (a.show != null) for (const id of arr(a.show)) { const o = get(s, id); if (o) { o.hidden = false; E.push({ type: "show", id }); if (solidObj(o) && hit(s.p.x, s.p.y, PW, PH, o)) die(s, "crush"); } }
  if (a.hide != null) for (const id of arr(a.hide)) { const o = get(s, id); if (o) { o.hidden = true; E.push({ type: "hide", id }); } }
  if (a.move != null) for (const id of arr(a.move)) {
    const o = get(s, id); if (!o) continue;
    let x1, y1;
    if (a.by) { x1 = o.x + a.by[0] * T; y1 = o.y + a.by[1] * T; } else if (o.k === "d") [x1, y1] = doorPos(o, a.to[0], a.to[1]); else { x1 = a.to[0] * T; y1 = a.to[1] * T; }
    o.mv = { x0: o.x, y0: o.y, x1, y1, t0: s.t, dur: a.time || 0.3, ease: a.ease || "io" };
    E.push({ type: "move", id });
  }
  if (a.set != null) for (const id of arr(a.set)) { const o = get(s, id); if (o) { Object.assign(o, a.props); E.push({ type: "set", id, props: a.props }); } }
  if (a.tilt != null) { s.tilt = a.tilt; E.push({ type: "tilt" }); }
  if (a.jump != null) { s.jp = a.jump; E.push({ type: "jp" }); }
  if (a.dark != null) { s.dark = a.dark; E.push({ type: "dark" }); }
  if (a.fx != null) E.push({ type: "fx", name: a.fx });
  if (a.belt != null) { const o = get(s, a.belt); if (o) { o.belt = a.v; E.push({ type: "belt", id: o.id }); } }
  if (a.ice != null) { s.ice = a.ice; E.push({ type: "ice" }); }
  if (a.grav != null) { s.p.g = a.grav; s.p.ground = false; E.push({ type: "grav" }); }
  if (a.mirror != null) { s.mirror = a.mirror; E.push({ type: "mirror" }); }
  if (a.scroll != null) { s.cam.mv = { x0: s.cam.x, x1: a.scroll * T, t0: s.t, dur: a.time || 1 }; E.push({ type: "scroll" }); }
  if (a.rule != null) { s.rule = a.rule; s.grace = s.t + 0.5; E.push({ type: "rule" }); }
  if (a.label != null) { const o = get(s, a.label); if (o) { o.n = a.n; o.armed = false; s.grace = s.t + 0.25; E.push({ type: "label", id: o.id, stroke: a.stroke }); } }
  if (a.swap != null) { const A = get(s, a.swap[0]), B = get(s, a.swap[1]); if (A && B) { const n = A.n; A.n = B.n; B.n = n; E.push({ type: "label", id: A.id }, { type: "label", id: B.id }); } }
  if (a.say != null) E.push({ type: "say", text: a.say });
}

export function step(s, dir, jump) {
  if (s.dead || s.won) return;
  const p = s.p, E = s.ev;
  s.t += DT;
  if (s.mirror > 0) { dir = -dir; s.mirror -= DT; if (s.mirror <= 0) { s.mirror = 0; E.push({ type: "mirrorEnd" }); } }
  // scheduled actions
  if (s.pend.length) { const now = s.pend.filter((q) => q.t <= s.t); if (now.length) { s.pend = s.pend.filter((q) => q.t > s.t); for (const q of now) act(s, q.a); } }
  // moving and falling things
  for (const o of s.objs) {
    if (o.mv) {
      const m = o.mv, k = Math.min(1, (s.t - m.t0) / m.dur), e = m.ease === "in" ? k * k : m.ease === "lin" ? k : k * k * (3 - 2 * k);
      const nx = m.x0 + (m.x1 - m.x0) * e, ny = m.y0 + (m.y1 - m.y0) * e, dx = nx - o.x, dy = ny - o.y;
      const riding = solidObj(o) && p.ground && p.gid === o.id;
      o.x = nx; o.y = ny;
      if (riding) { p.x += dx; if (dx && embedded(s)) p.x -= dx; p.y += dy; if (dy && embedded(s)) die(s, "crush"); }
      else if (solidObj(o) && hit(p.x, p.y, PW, PH, o)) {
        if (o.crush) die(s, "crush");
        else { if (Math.abs(dx) > Math.abs(dy)) p.x = dx > 0 ? o.x + o.w : o.x - PW; else p.y = dy > 0 ? o.y + o.h : o.y - PH; if (embedded(s)) die(s, "crush"); }
      }
      if (k >= 1) { o.mv = null; E.push({ type: "stop", id: o.id }); }
    }
    if (o.falling) { o.vy += GRAV * DT * o.fg; o.y += o.vy * DT; if (o.y > s.c.H * T + 80 || o.y < -160) { o.falling = false; o.hidden = true; o.gone = true; } }
  }
  if (s.cam.mv) { const m = s.cam.mv, k = Math.min(1, (s.t - m.t0) / m.dur); s.cam.x = m.x0 + (m.x1 - m.x0) * (m.dur > 3 ? k : k * k * (3 - 2 * k)); if (k >= 1) s.cam.mv = null; }
  if (s.dead) return;
  // run
  const wasGround = p.ground, g = p.g;
  if (dir) p.face = dir;
  const rate = wasGround ? (s.ice ? (dir ? 520 : 150) : dir ? 2800 : 3400) : dir ? 2000 : 900;
  let tv = dir * RUN;
  if (s.dark > 0) s.dark = Math.max(0, s.dark - DT);
  if (wasGround && s.tilt) tv += s.tilt * 105;                       // a leaning board: you slide downhill
  if (wasGround && !dir && p.gid && p.gid !== "#") { const b = get(s, p.gid); if (b && b.belt) { tv = b.belt; if (!b.rolling) { b.rolling = true; E.push({ type: "roll", id: b.id }); } } }
  p.vx = p.vx < tv ? Math.min(tv, p.vx + rate * DT) : Math.max(tv, p.vx - rate * DT);
  // jump: buffer and coyote time
  const pressed = jump && !p.jh; p.jh = jump;
  p.buf = pressed ? 0.11 : p.buf - DT;
  p.coy = wasGround ? 0.09 : p.coy - DT;
  let jumped = false;
  if (p.buf > 0 && p.coy > 0) { p.vy = -JUMP * s.jp * g; p.buf = 0; p.coy = 0; jumped = true; E.push({ type: "jump" }); }
  if (!jump && p.vy * g < -260) p.vy = -260 * g;
  p.vy = Math.max(-MAXF, Math.min(MAXF, p.vy + GRAV * g * DT));
  // move x
  p.x += p.vx * DT;
  const fixX = (r, o) => { if (!hit(p.x, p.y, PW, PH, r)) return; if (p.vx > 0) p.x = r.x - PW; else if (p.vx < 0) p.x = r.x + r.w; else return; p.vx = 0; if (o && o.ghost) o.seen = true; };
  for (const r of s.c.rects) fixX(r, null);
  for (const o of s.objs) if (solidObj(o)) fixX(o, o);
  const lo = s.cam.x, hi = Math.min(s.c.W * T, s.cam.x + VW) - PW;
  if (p.x < lo) { p.x = lo; if (p.vx < 0) p.vx = 0; if (embedded(s)) die(s, "crush"); }
  if (p.x > hi) { p.x = hi; if (p.vx > 0) p.vx = 0; if (embedded(s)) die(s, "crush"); }
  // move y
  p.y += p.vy * DT;
  let gid = null, best = 0, land = false;
  p.ground = false;
  const fixY = (r, o) => {
    if (!hit(p.x, p.y, PW, PH, r)) return;
    const ov = Math.min(p.x + PW, r.x + r.w) - Math.max(p.x, r.x);
    const down = p.vy > 0;
    p.y = down ? r.y - PH : r.y + r.h;
    if ((down ? 1 : -1) === g) { land = true; if (ov > best) { best = ov; gid = o ? o.id : "#"; } }
    if (o && o.ghost) o.seen = true;
    return true;
  };
  let any = false;
  for (const r of s.c.rects) if (fixY(r, null)) any = true;
  for (const o of s.objs) if (solidObj(o) && fixY(o, o)) any = true;
  // a second floor piece next to the one we hit also counts as ground under us
  if (land) { const fy = g > 0 ? p.y + PH : p.y - 1; for (const o of s.objs) if (solidObj(o) && fy >= o.y - 0.5 && fy <= o.y + o.h + 0.5) { const ov = Math.min(p.x + PW, o.x + o.w) - Math.max(p.x, o.x); if (ov > best && (g > 0 ? Math.abs(o.y - fy) < 1 : Math.abs(o.y + o.h - p.y) < 1)) { best = ov; gid = o.id; } } }
  if (any) p.vy = 0;
  if (land) { p.ground = true; p.gid = gid; if (!wasGround) E.push({ type: "land" }); } else p.gid = null;
  const landed = land && !wasGround;
  // weak floors: crumblers, and numbered tiles the rule does not hold
  if (land && gid !== "#") {
    const o = get(s, gid);
    if (o && !o.armed && (o.crumble != null || (o.n != null && s.rule && !s.rule.test(o.n)))) {
      o.armed = true;
      const at = Math.max(s.t + (o.crumble != null ? o.crumble : 0.05), s.grace);
      o.wig = at; s.pend.push({ t: at, a: { fall: o.id } }); E.push({ type: "arm", id: o.id });
    }
  }
  if (p.y > s.c.H * T + 40 || p.y < -PH - 60) return die(s, "fell");
  // the chalk twin: a mirrored copy. Spikes and pits on his side of the room get him.
  if (s.c.stage.twin) {
    const tx = s.c.W * T - p.x - PW;
    for (const o of s.objs) if (o.k === "s" && !o.hidden && !o.fake && !o.falling && tx < o.x + o.w - 7 && tx + PW > o.x + 7 && p.y < o.y + o.h - (o.dn ? 14 : 0) && p.y + PH > o.y + (o.dn ? 0 : 14)) return die(s, "twin");
    if (p.ground) {
      const fx0 = tx + 3, fx1 = tx + PW - 3, fy = p.g > 0 ? p.y + PH + 2 : p.y - 2;
      const on = (r) => fx1 > r.x && fx0 < r.x + r.w && fy >= r.y && fy <= r.y + r.h;
      s.twinAir = s.c.rects.some(on) || s.objs.some((o) => solidObj(o) && on(o)) ? 0 : s.twinAir + DT;
      if (s.twinAir > 0.1) return die(s, "twin");
    } else s.twinAir = 0;
  }
  // things you touch
  for (const o of s.objs) {
    if (o.hidden || o.falling) continue;
    if (o.k === "f") continue;
    if (o.k === "s") { if (o.fake) { if (!o.seen && hit(p.x, p.y, PW, PH, o)) { o.seen = true; E.push({ type: "painted", id: o.id }); } continue; } if (p.x < o.x + o.w - 7 && p.x + PW > o.x + 7 && p.y < o.y + o.h - (o.dn ? 14 : 0) && p.y + PH > o.y + (o.dn ? 0 : 14)) return die(s, "spike"); }
    else if (o.k === "b" && o.fake) { if (!o.seen && hit(p.x, p.y, PW, PH, o)) { o.seen = true; E.push({ type: "seen", id: o.id }); } }
    else if (o.k === "d" && !o.twin && hit(p.x + 6, p.y, PW - 12, PH, o)) {
      if (o.fake) { if (!o.seen) { o.seen = true; E.push({ type: "painted", id: o.id }); } }
      else if (p.ground && !o.mv && !o.shut) { if (o.n != null && s.rule && !s.rule.test(o.n)) return die(s, "wrong"); s.won = o.id; E.push({ type: "win", id: o.id }); return; }
    }
  }
  // traps
  const cx = (p.x + PW / 2) / T, cy = (p.y + PH / 2) / T, tr = s.c.traps;
  for (let i = 0; i < tr.length; i++) {
    if (s.fired[i] >= 0) continue;
    const o = tr[i].on;
    if (o.tryMin != null && s.try < o.tryMin) continue;
    if (o.tryMax != null && s.try > o.tryMax) continue;
    if (o.t != null && s.t < o.t) continue;
    if (o.xgt != null && cx <= o.xgt) continue;
    if (o.xlt != null && cx >= o.xlt) continue;
    if (o.ygt != null && cy <= o.ygt) continue;
    if (o.ylt != null && cy >= o.ylt) continue;
    if (o.jump && !jumped) continue;
    if (o.air && p.ground) continue;
    if (o.ground && !p.ground) continue;
    if (o.g != null && p.g !== o.g) continue;
    if (o.land != null && !(landed && (o.land === true || gid === o.land))) continue;
    if (o.stand != null && !(p.ground && gid === o.stand)) continue;
    if (o.zone && !(p.x < (o.zone[0] + o.zone[2]) * T && p.x + PW > o.zone[0] * T && p.y < (o.zone[1] + o.zone[3]) * T && p.y + PH > o.zone[1] * T)) continue;
    if (o.touch != null) { const q = get(s, o.touch); if (!q || q.hidden || !hit(p.x, p.y, PW, PH, q)) continue; }
    if (o.fired != null) { const j = tr.findIndex((q) => q.id === o.fired); if (j < 0 || s.fired[j] < 0) continue; }
    s.fired[i] = s.t;
    const base = s.t + (tr[i].delay ?? 0.05);
    E.push({ type: "trig", i });
    for (const a of tr[i].do) {
      s.pend.push({ t: base + (a.at || 0), a });
      if (!a.at) for (const id of arr(a.fall ?? a.show ?? a.move ?? a.hide ?? [])) { const q = get(s, id); if (q) q.wig = base; }
    }
  }
}
