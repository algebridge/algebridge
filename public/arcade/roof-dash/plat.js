// plat.js: a tiny platformer core for Roof Dash. Pure logic, no DOM, so it runs in the page and in Node (level checks).
// Started from the Zip core (this folder keeps its own copy).
//
// World:  { T, cols, rows, grid: Uint8Array (1 = solid), boxes: [{ x, y, w, h, px, py, off }] }
//         boxes are moving or switchable solids. px/py is where the box was last step (for carrying).
// Player: plain object from newPlayer(). Position is the top left of the hitbox, in pixels.
// Input:  { dir: -1|0|1, jump: bool (held), down: bool (held) }

export const EV = { JUMP: 1, LAND: 2, SLIDE: 4, DIVE: 8, WALLJUMP: 16, BONK: 32, SLIDEJUMP: 64 };

export function makeCfg(o = {}) {
  return Object.assign({
    w: 20, h: 32, hLow: 15,
    run: 290, acc: 2300, dec: 3200, turn: 4400, airAcc: 1900, airDec: 650,
    grav: 2100, fall: 800, jump: 660, cut: 0.45, hang: 0.6,
    coyote: 0.09, buffer: 0.11, corner: 7, ledge: 8,
    slide: false, slideFric: 230, slideBoost: 1.1, slideJump: 1.36, maxBoost: 1.5, slideMin: 150,
    dive: false, diveV: 660, diveFall: 1000,
    wall: false, wallSlide: 150, wallJumpX: 1.05, wallJumpY: 0.97, wallLock: 0.15, wallGrace: 0.1,
  }, o);
}

export function newPlayer(x, y, cfg) {
  return {
    x, y, w: cfg.w, h: cfg.h, vx: 0, vy: 0, g: 1, face: 1,
    ground: false, landed: false, coy: 0, buf: 0, pj: false, pd: false, rising: false,
    slide: false, dive: false, slideCd: 0, wallT: 0, wallDir: 0, onWall: 0, lock: 0, lockDir: 0,
    ride: -1, ev: 0, crush: false,
  };
}

export function tileSolid(W, tx, ty) {
  if (tx < 0 || tx >= W.cols) return true;
  if (ty < 0 || ty >= W.rows) return false;
  return W.grid[ty * W.cols + tx] === 1;
}
function tilesHit(W, x, y, w, h) {
  const T = W.T;
  const x0 = Math.floor(x / T), x1 = Math.floor((x + w - 0.001) / T);
  const y0 = Math.floor(y / T), y1 = Math.floor((y + h - 0.001) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileSolid(W, tx, ty)) return true;
  return false;
}
function boxHit(W, x, y, w, h) {
  const B = W.boxes;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (!b.off && x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return i;
  }
  return -1;
}
export function solidAt(W, x, y, w, h) {
  return tilesHit(W, x, y, w, h) || boxHit(W, x, y, w, h) >= 0;
}

function moveX(W, p, dx) {
  if (!dx) return 0;
  p.x += dx;
  const T = W.T;
  let hit = 0;
  const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.001) / T);
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.001) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!tileSolid(W, tx, ty)) continue;
    if (dx > 0) { const nx = tx * T - p.w; if (nx < p.x) p.x = nx; hit = 1; }
    else { const nx = (tx + 1) * T; if (nx > p.x) p.x = nx; hit = -1; }
  }
  const B = W.boxes;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (b.off || !(p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y)) continue;
    if (dx > 0) { p.x = b.x - p.w; hit = 1; } else { p.x = b.x + b.w; hit = -1; }
  }
  return hit;
}
function moveY(W, p, dy) {
  if (!dy) return 0;
  p.y += dy;
  const T = W.T;
  let hit = 0;
  const y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.001) / T);
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.001) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!tileSolid(W, tx, ty)) continue;
    if (dy > 0) { const ny = ty * T - p.h; if (ny < p.y) p.y = ny; hit = 1; }
    else { const ny = (ty + 1) * T; if (ny > p.y) p.y = ny; hit = -1; }
  }
  const B = W.boxes;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (b.off || !(p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y)) continue;
    if (dy > 0) { p.y = b.y - p.h; hit = 1; } else { p.y = b.y + b.h; hit = -1; }
    if (hit === p.g) p.ride = i;
  }
  return hit;
}

function stand(W, p, cfg) {
  const ny = p.g > 0 ? p.y - (cfg.h - p.h) : p.y;
  if (solidAt(W, p.x, ny, p.w, cfg.h)) return false;
  p.y = ny; p.h = cfg.h; p.slide = false;
  return true;
}
function startSlide(p, cfg) {
  if (p.g > 0) p.y += p.h - cfg.hLow;
  p.h = cfg.hLow;
  p.slide = true;
  const s = Math.sign(p.vx) || p.face;
  if (p.slideCd <= 0) {
    p.vx = s * Math.min(cfg.run * cfg.maxBoost, Math.max(Math.abs(p.vx), cfg.run) * cfg.slideBoost);
    p.slideCd = 0.7;
  }
  p.ev |= EV.SLIDE;
}

/** One fixed step. Mutates p. Read p.ev (EV bits) afterwards for sounds and particles. */
export function stepPlayer(W, p, inp, cfg, dt) {
  p.ev = 0;
  const g = p.g;
  const B = W.boxes;

  // carried by the box under the feet
  if (p.ride >= 0) {
    const b = B[p.ride];
    if (b && !b.off) {
      const dx = b.x - b.px, dy = b.y - b.py;
      if (dx) { p.x += dx; if (tilesHit(W, p.x, p.y, p.w, p.h)) p.x -= dx; }
      if (dy) { p.y += dy; if (tilesHit(W, p.x, p.y, p.w, p.h)) p.y -= dy; }
    }
  }
  // pushed by boxes that moved into the player
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (b.off || !(p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y)) continue;
    const dx = b.x - b.px, dy = b.y - b.py;
    if (dy && Math.abs(dy) >= Math.abs(dx)) p.y = dy > 0 ? b.y + b.h : b.y - p.h;
    else if (dx) p.x = dx > 0 ? b.x + b.w : b.x - p.w;
    else {
      const l = p.x + p.w - b.x, r = b.x + b.w - p.x, u = p.y + p.h - b.y, d = b.y + b.h - p.y;
      const m = Math.min(l, r, u, d);
      if (m === u) p.y = b.y - p.h; else if (m === d) p.y = b.y + b.h; else if (m === l) p.x = b.x - p.w; else p.x = b.x + b.w;
    }
    if (solidAt(W, p.x, p.y, p.w, p.h)) p.crush = true;
  }

  const landed = p.landed;
  p.landed = false;
  if (p.coy > 0) p.coy -= dt;
  if (p.buf > 0) p.buf -= dt;
  if (p.lock > 0) p.lock -= dt;
  if (p.slideCd > 0) p.slideCd -= dt;
  if (p.wallT > 0) p.wallT -= dt;
  const jp = inp.jump && !p.pj, dp = inp.down && !p.pd;
  p.pj = inp.jump; p.pd = inp.down;
  if (jp) p.buf = cfg.buffer;
  const max = cfg.run;
  const dir = p.lock > 0 ? p.lockDir : inp.dir;

  // slide: start, keep, stop
  if (cfg.slide) {
    if (p.ground && !p.slide && inp.down && (dp || landed) && Math.abs(p.vx) > 100) startSlide(p, cfg);
    else if (p.slide && (!inp.down || Math.abs(p.vx) < 80 || (!p.ground && p.coy <= 0))) {
      if (!stand(W, p, cfg) && Math.abs(p.vx) < cfg.slideMin) p.vx = (Math.sign(p.vx) || p.face) * cfg.slideMin;
    }
  }

  // run
  if (p.slide) {
    const s = Math.sign(p.vx) || p.face;
    let sp = Math.abs(p.vx) - (cfg.slideFric + (dir === -s ? 900 : 0)) * dt;
    p.vx = s * Math.max(0, sp);
    p.face = s;
  } else if (dir) {
    if (p.lock <= 0) p.face = dir;
    const sp = p.vx * dir;
    if (sp < 0) p.vx += dir * (p.ground ? cfg.turn : cfg.airAcc * 1.4) * dt;
    else if (sp < max) p.vx = dir * Math.min(max, sp + (p.ground ? cfg.acc * (1.5 - 0.7 * sp / max) : cfg.airAcc) * dt);
    else p.vx = dir * Math.max(max, sp - (p.ground ? 520 : 40) * dt);
  } else {
    const d = (p.ground ? cfg.dec : cfg.airDec) * dt;
    if (Math.abs(p.vx) <= d) p.vx = 0; else p.vx -= Math.sign(p.vx) * d;
  }

  // jump, slide-jump, wall-jump
  if (p.buf > 0) {
    if (p.coy > 0 || p.ground) {
      let ok = true;
      if (p.slide) {
        const s = Math.sign(p.vx) || p.face;
        ok = stand(W, p, cfg);
        if (ok) { p.vx = s * Math.min(max * cfg.maxBoost, Math.max(Math.abs(p.vx), max) * cfg.slideJump); p.ev |= EV.SLIDEJUMP; }
      }
      if (ok) {
        p.vy = -cfg.jump * g; p.rising = true; p.ground = false; p.coy = 0; p.buf = 0; p.ride = -1; p.dive = false;
        p.ev |= EV.JUMP;
      }
    } else if (cfg.wall && p.wallT > 0) {
      p.vx = -p.wallDir * max * cfg.wallJumpX;
      p.vy = -cfg.jump * cfg.wallJumpY * g;
      p.lock = cfg.wallLock; p.lockDir = -p.wallDir; p.face = -p.wallDir;
      p.wallT = 0; p.buf = 0; p.rising = true; p.dive = false;
      p.ev |= EV.WALLJUMP;
    }
  }
  if (p.rising) {
    if (p.vy * g >= 0) p.rising = false;
    else if (!inp.jump) { p.vy *= cfg.cut; p.rising = false; }
  }

  // dive
  if (cfg.dive && !p.ground && p.coy <= 0 && dp && !p.dive) {
    p.dive = true; p.rising = false;
    p.vy = g * Math.max(p.vy * g, cfg.diveV);
    const s = Math.sign(p.vx) || p.face;
    p.vx = s * Math.max(Math.abs(p.vx), max * 1.05);
    p.ev |= EV.DIVE;
  }

  // gravity
  let gr = cfg.grav;
  if (p.rising && inp.jump && Math.abs(p.vy) < 110) gr *= cfg.hang;
  p.vy += gr * g * dt;
  let cap = p.dive ? cfg.diveFall : cfg.fall;
  p.onWall = 0;
  if (cfg.wall && !p.ground && p.wallT > 0 && inp.dir === p.wallDir && p.vy * g > 0 && !p.dive) { cap = cfg.wallSlide; p.onWall = p.wallDir; }
  if (p.vy * g > cap) p.vy = cap * g;

  // move X, with a small step up onto ledges that were missed by a few pixels
  const wasGround = p.ground;
  const hx = moveX(W, p, p.vx * dt);
  if (hx) {
    let fixed = false;
    if (!wasGround && p.vy * g >= 0) {
      for (let k = 1; k <= cfg.ledge; k++) {
        if (!solidAt(W, p.x + hx, p.y - k * g, p.w, p.h)) { p.y -= k * g; p.x += hx; fixed = true; break; }
      }
    }
    if (!fixed) { if (Math.abs(p.vx) > 200) p.ev |= EV.BONK; p.vx = 0; }
  }

  // move Y, with corner correction when the head clips a corner
  p.ground = false;
  p.ride = -1;
  const dy = p.vy * dt;
  let hy = 0;
  if (dy * g < 0 && solidAt(W, p.x, p.y + dy, p.w, p.h)) {
    let fixed = false;
    for (let k = 1; k <= cfg.corner && !fixed; k++) {
      if (!solidAt(W, p.x + k, p.y + dy, p.w, p.h)) { p.x += k; p.y += dy; fixed = true; }
      else if (!solidAt(W, p.x - k, p.y + dy, p.w, p.h)) { p.x -= k; p.y += dy; fixed = true; }
    }
    if (!fixed) hy = moveY(W, p, dy);
  } else hy = moveY(W, p, dy);
  if (hy) {
    if (hy === g) {
      p.ground = true;
      p.coy = cfg.coyote;
      if (!wasGround) { p.ev |= EV.LAND; p.landed = true; }
      p.dive = false;
    } else p.rising = false;
    p.vy = 0;
  }

  // walls (for wall-jumps)
  if (cfg.wall && !p.ground) {
    if (tilesHit(W, p.x + 1.5, p.y + 2, p.w, p.h - 4)) { p.wallDir = 1; p.wallT = cfg.wallGrace; }
    else if (tilesHit(W, p.x - 1.5, p.y + 2, p.w, p.h - 4)) { p.wallDir = -1; p.wallT = cfg.wallGrace; }
  }
}
