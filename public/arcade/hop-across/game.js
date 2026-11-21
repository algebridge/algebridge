// Hop Across: an endless lane hopper. Roads, rails and rivers. On rivers only the pads
// whose number fits the rule on the banner will hold you.
import * as THREE from "../vendor/three.module.min.js";
import { createGame, math, sfx, buildArchie3D, clamp, lerp, damp, rand, randInt, choose } from "../kit/kit.js";

const HALF = 4; // playable columns are -4..4
const WIDE = 13; // scenery reaches this far to each side
const SPAN = 36; // traffic wraps over this width
const BASE = 6; // the row the run starts on
const HOP = 0.13;
const SKY = 0xcdeaf8;

const g = createGame({
  slug: "hop-across",
  title: "Hop Across",
  tagline: "Hop far. Land only on the pads that fit the rule.",
  how: ["Cross roads and rails without getting bumped.", "At a river, read the rule at the top. Only pads that fit it will hold you."],
  controls: [{ keys: "↑ ← ↓ →", does: "Hop" }, { keys: "Swipe or tap", does: "Hop on a touch screen" }],
  aspect: 16 / 9,
  bg: "#cdeaf8",
});

// ---------- renderer ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 27, 41);
const camera = new THREE.PerspectiveCamera(32, 16 / 9, 1, 80);
let renderer = null;
let vw = 960, vh = 540, vd = 1;
const applySize = () => {
  if (!renderer) return;
  renderer.setPixelRatio(vd);
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh;
  camera.updateProjectionMatrix();
};
const canvas = g.canvas3d((w, h, d) => { vw = w; vh = h; vd = d; applySize(); });
renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
applySize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x9ccf8a, 1.35));
const sun = new THREE.DirectionalLight(0xfff4dc, 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -13, near: 1, far: 45 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

// ---------- materials and geometry ----------
const grad = new THREE.DataTexture(new Uint8Array([165, 215, 255]), 3, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;
const toon = (color = 0xffffff, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra });

/** A box with truly round edges and smooth normals. */
function rbox(w, h, d, r, k = 3) {
  const s = 2 * k + 1;
  const geo = new THREE.BoxGeometry(w, h, d, s, s, s);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const half = [w / 2, h / 2, d / 2], v = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    v[0] = pos.getX(i); v[1] = pos.getY(i); v[2] = pos.getZ(i);
    for (let a = 0; a < 3; a++) {
      const H = half[a];
      const idx = Math.round(((v[a] + H) / (2 * H)) * s);
      if (idx <= k) { c[a] = -H + r; v[a] = (idx - k) / k; } else { c[a] = H - r; v[a] = (idx - k - 1) / k; }
    }
    const L = Math.hypot(v[0], v[1], v[2]) || 1;
    pos.setXYZ(i, c[0] + (v[0] / L) * r, c[1] + (v[1] / L) * r, c[2] + (v[2] / L) * r);
    nor.setXYZ(i, v[0] / L, v[1] / L, v[2] / L);
  }
  return geo;
}
const at = (geo, x, y, z) => geo.translate(x, y, z);
/** Merge parts into one geometry with a color per part. parts: [geometry, hex] */
function merge(parts) {
  let n = 0;
  const list = parts.map(([g0, c]) => { const gg = g0.index ? g0.toNonIndexed() : g0; n += gg.attributes.position.count; return [gg, c]; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  const col = new THREE.Color();
  let o = 0;
  for (const [gg, c] of list) {
    P.set(gg.attributes.position.array, o * 3);
    N.set(gg.attributes.normal.array, o * 3);
    col.set(c ?? 0xffffff);
    for (let i = 0; i < gg.attributes.position.count; i++) { C[(o + i) * 3] = col.r; C[(o + i) * 3 + 1] = col.g; C[(o + i) * 3 + 2] = col.b; }
    o += gg.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(P, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  out.setAttribute("color", new THREE.BufferAttribute(C, 3));
  return out;
}
const sphere = (r, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => at(new THREE.SphereGeometry(r, 11, 8).scale(sx, sy, sz), x, y, z);
const axle = (r, len, x, y) => at(new THREE.CylinderGeometry(r, r, len, 16).rotateX(Math.PI / 2), x, y, 0);

const meshes = [];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
function inst(geo, mat, cap, o = {}) {
  const m = new THREE.InstancedMesh(geo, mat, cap);
  m.frustumCulled = false;
  m.castShadow = o.cast !== false;
  m.receiveShadow = !!o.receive;
  m.userData.n = 0;
  m.userData.cap = cap;
  if (o.color) m.setColorAt(0, _c.set(0xffffff));
  m.count = 0;
  scene.add(m);
  meshes.push(m);
  return m;
}
function put(m, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, col) {
  const i = m.userData.n;
  if (i >= m.userData.cap) return -1;
  _p.set(x, y, z);
  _q.set(0, Math.sin(ry / 2), 0, Math.cos(ry / 2));
  _s.set(sx, sy, sz);
  m.setMatrixAt(i, _m.compose(_p, _q, _s));
  if (col !== undefined) m.setColorAt(i, _c.set(col));
  m.userData.n = i + 1;
  return i;
}

const DARK = 0x263244, GLASS = 0xa9dcf7, LAMP = 0xfff1a8, TAIL = 0xf87171;
const M = {
  strip: inst(at(new THREE.BoxGeometry(70, 1, 1), 0, -0.5, 0), toon(), 40, { cast: false, receive: true, color: true }),
  dash: inst(at(rbox(0.8, 0.03, 0.1, 0.014, 1), 0, 0.012, 0), toon(0xf4f7fb), 260, { cast: false }),
  sleeper: inst(at(rbox(0.22, 0.07, 0.82, 0.03, 1), 0, 0.03, 0), toon(0x8a6a4b), 420, { cast: false, receive: true }),
  rail: inst(at(new THREE.BoxGeometry(70, 0.07, 0.07), 0, 0.1, 0), toon(0xcfd6df), 24, { cast: false }),
  post: inst(merge([[at(new THREE.CylinderGeometry(0.05, 0.07, 1, 10), 0, 0.5, 0), 0xe5e7eb], [at(rbox(0.34, 0.34, 0.2, 0.09, 2), 0, 1.08, 0), DARK]]), toon(0xffffff, { vertexColors: true }), 24),
  lamp: inst(sphere(0.105, 0, 1.08, 0.09), new THREE.MeshBasicMaterial(), 24, { cast: false, color: true }),
  trunk: inst(at(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 10), 0, 0.25, 0), toon(0x9a6b45), 420),
  leaf: inst(merge([[sphere(0.44, 0, 0.78, 0, 1, 0.92, 1)], [sphere(0.31, 0.03, 1.2, 0.02)]]), toon(), 420, { color: true }),
  pine: inst(merge([[sphere(0.4, 0, 0.72, 0, 1, 0.8, 1)], [sphere(0.3, 0, 1.08, 0, 1, 0.85, 1)], [sphere(0.19, 0, 1.4, 0, 1, 1.1, 1)]]), toon(), 200, { color: true }),
  rock: inst(merge([[sphere(0.36, 0, 0.2, 0, 1, 0.72, 0.9)], [sphere(0.2, 0.26, 0.12, 0.14, 1, 0.8, 1)]]), toon(), 120, { color: true }),
  flower: inst(merge([[sphere(0.065, 0, 0.17, 0, 1, 0.7, 1)], [at(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5), 0, 0.08, 0), 0x4c9f4a]]), toon(0xffffff, { vertexColors: true }), 220, { cast: false, color: true }),
  carPaint: inst(merge([[at(rbox(1.6, 0.44, 0.84, 0.2), 0, 0.42, 0)], [at(rbox(0.8, 0.1, 0.64, 0.05, 2), -0.1, 0.94, 0)]]), toon(), 60, { color: true }),
  carTrim: inst(merge([[at(rbox(0.9, 0.42, 0.72, 0.18), -0.1, 0.73, 0), GLASS], [axle(0.19, 0.92, 0.48, 0.19), DARK], [axle(0.19, 0.92, -0.48, 0.19), DARK],
    [sphere(0.075, 0.77, 0.44, 0.25), LAMP], [sphere(0.075, 0.77, 0.44, -0.25), LAMP], [sphere(0.06, -0.78, 0.46, 0.26), TAIL], [sphere(0.06, -0.78, 0.46, -0.26), TAIL]]), toon(0xffffff, { vertexColors: true }), 60),
  truckPaint: inst(merge([[at(rbox(0.78, 0.84, 0.88, 0.22), 0.88, 0.62, 0)]]), toon(), 40, { color: true }),
  truckTrim: inst(merge([[at(rbox(1.72, 1.0, 0.9, 0.16), -0.42, 0.74, 0), 0xf8fafc], [at(rbox(0.2, 0.32, 0.7, 0.09, 2), 1.2, 0.78, 0), GLASS], [axle(0.2, 0.96, 0.9, 0.2), DARK], [axle(0.2, 0.96, -0.2, 0.2), DARK], [axle(0.2, 0.96, -0.95, 0.2), DARK],
    [sphere(0.07, 1.26, 0.4, 0.28), LAMP], [sphere(0.07, 1.26, 0.4, -0.28), LAMP], [at(rbox(1.5, 0.12, 0.92, 0.05, 1), -0.42, 0.5, 0), 0xfbbf24]]), toon(0xffffff, { vertexColors: true }), 40),
  scootPaint: inst(merge([[at(rbox(0.84, 0.16, 0.26, 0.08, 2), 0, 0.27, 0)], [at(rbox(0.14, 0.52, 0.28, 0.07, 2), 0.36, 0.5, 0)], [sphere(0.16, -0.06, 1.0, 0)]]), toon(), 60, { color: true }),
  scootTrim: inst(merge([[axle(0.15, 0.13, 0.32, 0.15), DARK], [axle(0.15, 0.13, -0.32, 0.15), DARK], [at(rbox(0.28, 0.46, 0.32, 0.14), -0.08, 0.62, 0), 0xfef7e6],
    [at(rbox(0.3, 0.26, 0.3, 0.08, 2), -0.36, 0.5, 0), 0xfbbf24], [sphere(0.06, 0.44, 0.62, 0), LAMP], [at(rbox(0.1, 0.07, 0.2, 0.03, 1), 0.07, 1.0, 0), DARK]]), toon(0xffffff, { vertexColors: true }), 60),
  tramPaint: inst(merge([[at(rbox(6.4, 1.04, 0.94, 0.32), 0, 0.74, 0)]]), toon(), 8, { color: true }),
  tramTrim: inst(merge([[at(rbox(5.7, 0.38, 0.97, 0.13), 0, 0.9, 0), 0x2f4a78], [at(rbox(6.0, 0.24, 0.8, 0.1, 2), 0, 0.2, 0), DARK], [at(rbox(2.2, 0.16, 0.5, 0.07, 2), 0, 1.3, 0), 0xe5e7eb],
    [at(rbox(6.42, 0.09, 0.96, 0.04, 1), 0, 0.56, 0), 0xfef7e6], [sphere(0.09, 3.14, 0.56, 0.24), LAMP], [sphere(0.09, 3.14, 0.56, -0.24), LAMP], [sphere(0.09, -3.14, 0.56, 0.24), LAMP], [sphere(0.09, -3.14, 0.56, -0.24), LAMP]]), toon(0xffffff, { vertexColors: true }), 8),
  pad: inst(merge([[new THREE.CylinderGeometry(0.47, 0.42, 0.1, 26, 1, false, 0.3, Math.PI * 2 - 0.6)], [at(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 22, 1, false, 0.3, Math.PI * 2 - 0.6), 0, 0.045, 0), 0xd9f7c4]]), toon(0xffffff, { vertexColors: true }), 140, { cast: false, color: true }),
  log: inst(merge([[rbox(1, 0.36, 0.72, 0.17), 0xa9744a], [at(rbox(0.86, 0.06, 0.4, 0.028, 1), 0, 0.165, 0), 0xc08a5c]]), toon(0xffffff, { vertexColors: true }), 30),
  coin: inst(merge([[new THREE.CylinderGeometry(0.21, 0.21, 0.07, 20).rotateX(Math.PI / 2), 0xfbbf24], [new THREE.CylinderGeometry(0.13, 0.13, 0.09, 16).rotateX(Math.PI / 2), 0xfde68a]]), toon(0xffffff, { vertexColors: true }), 50),
  foam: inst(sphere(1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }), 120, { cast: false }),
  bit: inst(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial(), 90, { cast: false, color: true }),
  // the fog bank that rolls in from behind: the visible edge you must stay ahead of
  fog: inst(new THREE.SphereGeometry(1, 12, 9), toon(0xf3f6ff), 64, { cast: false }),
  fogWall: inst(at(new THREE.BoxGeometry(70, 1, 1), 0, -0.5, 0), toon(0xf3f6ff), 2, { cast: false }),
};
const DEAD_LINE = 1.75; // rows behind the camera focus where the fog catches you
const QUICK = 0.75; // seconds allowed between forward hops to keep a quick streak

// number labels: one atlas of discs 0..63, one instanced plane with a per-instance cell offset
const atlas = document.createElement("canvas");
atlas.width = atlas.height = 1024;
{
  const x = atlas.getContext("2d");
  x.textAlign = "center";
  x.textBaseline = "middle";
  for (let n = 0; n < 64; n++) {
    const cx = (n % 8) * 128 + 64, cy = Math.floor(n / 8) * 128 + 64;
    x.fillStyle = "#1e3a8a"; x.beginPath(); x.arc(cx, cy, 60, 0, 7); x.fill();
    x.fillStyle = "#ffffff"; x.beginPath(); x.arc(cx, cy, 51, 0, 7); x.fill();
    x.fillStyle = "#0f172a";
    x.font = `900 ${n > 9 ? 66 : 78}px ui-rounded, "SF Pro Rounded", "Nunito", "Arial Rounded MT Bold", system-ui, sans-serif`;
    x.fillText(String(n), cx, cy + 4);
  }
}
const atlasTex = new THREE.CanvasTexture(atlas);
atlasTex.colorSpace = THREE.SRGBColorSpace;
atlasTex.anisotropy = 8;
const labelMat = new THREE.MeshBasicMaterial({ map: atlasTex, transparent: true, depthWrite: false });
labelMat.onBeforeCompile = (sh) => {
  sh.vertexShader = "attribute vec2 aOff;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n vMapUv = vMapUv * 0.125 + aOff;");
};
const labelGeo = new THREE.PlaneGeometry(0.84, 0.84).rotateX(-Math.PI / 2);
const labelOff = new THREE.InstancedBufferAttribute(new Float32Array(140 * 2), 2);
labelGeo.setAttribute("aOff", labelOff);
M.label = inst(labelGeo, labelMat, 140, { cast: false });
M.label.renderOrder = 2;

const archie = buildArchie3D(THREE);
archie.traverse((o) => { if (o.isMesh && o.material.isMeshToonMaterial) o.material.gradientMap = grad; });
const hero = new THREE.Group(); // scaled for squash; archie inside turns
hero.add(archie);
archie.scale.setScalar(0.92);
scene.add(hero);

// ---------- river rules ----------
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
const fromTest = (text, test, pool) => ({ text, safe: pool.filter(test), unsafe: pool.filter((n) => !test(n)) });
const solo = (text, x, extra = []) => ({ text, safe: [x], unsafe: [...new Set([x - 3, x - 2, x - 1, x + 1, x + 2, x + 3, ...extra])].filter((n) => n >= 0 && n <= 63 && n !== x) });
const RULES = [
  // tier 0
  [
    () => fromTest("Even numbers", (n) => n % 2 === 0, range(1, 30)),
    () => fromTest("Odd numbers", (n) => n % 2 === 1, range(1, 30)),
    () => { const k = choose([2, 5, 10]); return fromTest(`Multiples of ${k}`, (n) => n % k === 0, range(1, Math.min(60, k * 8))); },
    () => { const n = randInt(8, 30); return fromTest(`Greater than ${n}`, (v) => v > n, range(n - 7, n + 7)); },
    () => { const n = randInt(8, 30); return fromTest(`Less than ${n}`, (v) => v < n, range(n - 7, n + 7)); },
  ],
  // tier 1
  [
    () => { const k = choose([3, 4, 6]); return fromTest(`Multiples of ${k}`, (n) => n % k === 0, range(1, k * 9)); },
    () => { const x = randInt(2, 14), a = randInt(2, 9); return solo(`x + ${a} = ${x + a}`, x, [x + a]); },
    () => { const a = randInt(2, 9), x = a + randInt(1, 12); return solo(`x - ${a} = ${x - a}`, x, [x - a]); },
    () => { const N = choose([12, 18, 20]); return fromTest(`Factors of ${N}`, (n) => N % n === 0, range(1, N)); },
    () => { const a = randInt(4, 20), b = a + randInt(4, 8); return fromTest(`Between ${a} and ${b}`, (v) => v > a && v < b, range(a - 5, b + 5).filter((v) => v !== a && v !== b)); },
  ],
  // tier 2
  [
    () => { const k = choose([7, 8, 9]); return fromTest(`Multiples of ${k}`, (n) => n % k === 0, range(1, 63)); },
    () => fromTest("Primes", math.isPrime, range(1, 50)),
    () => fromTest("Perfect squares", (n) => Number.isInteger(Math.sqrt(n)), range(1, 63)),
    () => { const N = choose([24, 30, 36, 48, 60]); return fromTest(`Factors of ${N}`, (n) => N % n === 0, range(1, N)); },
    () => { const k = randInt(2, 6), x = randInt(2, 9); return solo(`${k}x = ${k * x}`, x, [k]); },
    () => { const a = randInt(2, 4), x = randInt(2, 9), b = randInt(1, 9); return solo(`${a}x + ${b} = ${a * x + b}`, x, [a, b]); },
    () => { const k = choose([2, 3]), x = randInt(3, 8); return fromTest(`Greater than ${k}x when x = ${x}`, (v) => v > k * x, range(k * x - 7, k * x + 7)); },
    () => { const k = choose([2, 3]), x = randInt(4, 9); return fromTest(`Less than ${k}x when x = ${x}`, (v) => v < k * x, range(k * x - 7, k * x + 7)); },
    () => { const a = randInt(2, 5), x = randInt(2, 6), b = randInt(1, 9); return solo(`Equal to ${a}x + ${b} when x = ${x}`, a * x + b, [a + x + b, a * x]); },
  ],
];
function makeRule(dist) {
  const tier = dist < 30 ? 0 : dist < 90 ? choose([0, 1, 1]) : dist < 180 ? choose([1, 1, 2]) : choose([1, 2, 2]);
  for (let tries = 0; tries < 8; tries++) {
    const r = choose(RULES[tier])();
    r.safe = r.safe.filter((n) => n >= 0 && n <= 63);
    r.unsafe = r.unsafe.filter((n) => n >= 0 && n <= 63);
    if (r.safe.length && r.unsafe.length) return r;
  }
  return fromTest("Even numbers", (n) => n % 2 === 0, range(1, 30));
}

// ---------- world ----------
const LEAVES = [0x4fb86a, 0x5cc474, 0x44a85e, 0x6bcf7f, 0x3f9f58];
const PINES = [0x3fae7c, 0x48b987, 0x38a272];
const ROCKS = [0xaab4c0, 0x9aa5b3, 0xb8c1cc];
const PETALS = [0xfde047, 0xf9a8d4, 0xffffff, 0xfdba74, 0xc4b5fd];
const PAINTS = [0xef4444, 0xf59e0b, 0x14b8a6, 0x8b5cf6, 0xec4899, 0xf8fafc, 0x60a5fa, 0x84cc16];
const LEN = { car: 1.6, truck: 2.6, scooter: 0.9 };

let rows, nextKind, P, focus, started, score, coins, stats, bits, shownRule, lastRiver;
let streak = 0, bestStreak = 0, lastFwd = -9, topRow = BASE, warnBeep = 0, fogGap = 9;

function grassRow(o = {}) {
  const r = rows.length;
  const row = { type: "grass", r, blockers: new Map(), flowers: [], coins: new Set(), bank: !!o.clear };
  const tree = (c, far) => ({ k: Math.random() < 0.28 ? "pine" : "tree", s: rand(0.85, far ? 1.35 : 1.1), col: 0, ox: far ? rand(-0.25, 0.25) : 0, oz: far ? rand(-0.2, 0.2) : 0, ry: rand(0, 6.28), c });
  for (let c = -WIDE; c <= WIDE; c++) {
    if (Math.abs(c) <= HALF) continue;
    if (Math.random() < (Math.abs(c) === HALF + 1 ? 0.8 : 0.6)) row.blockers.set(c, tree(c, true));
  }
  if (o.wall) for (let c = -HALF; c <= HALF; c++) row.blockers.set(c, tree(c, true));
  else if (!o.clear) {
    const n = randInt(0, 3);
    for (let i = 0; i < n; i++) {
      const c = randInt(-HALF, HALF);
      row.blockers.set(c, Math.random() < 0.3 ? { k: "rock", s: rand(0.85, 1.15), col: 0, ox: 0, oz: 0, ry: rand(0, 6.28), c } : tree(c, false));
    }
    // every open stretch of the row below must have a way up into this row
    const below = rows[r - 1];
    if (below && below.type === "grass") {
      let run = [];
      for (let c = -HALF; c <= HALF + 1; c++) {
        if (c <= HALF && !below.blockers.has(c)) run.push(c);
        else { if (run.length && run.every((x) => row.blockers.has(x))) row.blockers.delete(choose(run)); run = []; }
      }
    }
  }
  for (const b of row.blockers.values()) b.col = b.k === "rock" ? choose(ROCKS) : b.k === "pine" ? choose(PINES) : choose(LEAVES);
  const nf = o.clear ? randInt(2, 5) : randInt(0, 2);
  for (let i = 0; i < nf; i++) {
    const c = randInt(-HALF, HALF);
    if (!row.blockers.has(c)) row.flowers.push({ x: c + rand(-0.38, 0.38), z: rand(-0.38, 0.38), col: choose(PETALS), s: rand(0.8, 1.3) });
  }
  if (!o.noCoin && Math.random() < 0.16) { const c = randInt(-HALF, HALF); if (!row.blockers.has(c)) row.coins.add(c); }
  rows.push(row);
  return row;
}
function roadRow(t, dir) {
  const kind = choose(["car", "car", "car", "truck", "scooter"]);
  const sp = { car: [2.0, 3.8], truck: [1.5, 2.6], scooter: [3.6, 5.4] }[kind];
  const speed = rand(sp[0], sp[1]) * (1 + 0.5 * t);
  const row = { type: "road", r: rows.length, kind, dir, speed, cars: [], coins: new Set() };
  let x = -SPAN / 2 + rand(0, 4);
  while (x < SPAN / 2 - LEN[kind] - 2.5) {
    row.cars.push({ x, col: choose(PAINTS) });
    x += LEN[kind] + rand(3.6, 8.5) * (1 - 0.25 * t) + speed * 0.5;
  }
  if (Math.random() < 0.22) row.coins.add(randInt(-HALF, HALF));
  rows.push(row);
}
function railRow() {
  rows.push({ type: "rail", r: rows.length, state: 0, t: rand(1.2, 4.5), x: 0, dir: choose([-1, 1]), col: choose([0x14b8a6, 0xf59e0b, 0xec4899, 0x8b5cf6]), coins: new Set() });
}
function riverRows(t) {
  const dist = rows.length - BASE;
  const width = dist < 14 ? 1 : dist < 45 ? randInt(1, 2) : randInt(1, 3);
  const river = { start: rows.length, end: rows.length + width - 1, rule: makeRule(dist) };
  const rule = river.rule;
  const logAt = width === 3 && Math.random() < 0.6 ? 1 : -1;
  let c = randInt(-HALF + 1, HALF - 1);
  for (let i = 0; i < width; i++) {
    if (i === logAt) {
      const row = { type: "log", r: rows.length, river, dir: choose([-1, 1]), speed: rand(1.0, 1.6), logs: [] };
      let x = -SPAN / 2 + rand(0, 2);
      while (x < SPAN / 2 - 3) { const len = rand(2.3, 3.2); row.logs.push({ x: x + len / 2, len }); x += len + rand(1.6, 2.8); }
      rows.push(row);
      c = randInt(-HALF + 1, HALF - 1);
      continue;
    }
    const row = { type: "river", r: rows.length, river, pads: new Map() };
    const used = new Set();
    const num = (list) => { let n = choose(list); for (let k = 0; k < 6 && used.has(n); k++) n = choose(list); used.add(n); return n; };
    const add = (col, safe) => row.pads.set(col, { n: num(safe ? rule.safe : rule.unsafe), safe, sink: -1, bob: 0, gone: false, used: false, ry: rand(0, 6.28) });
    row.add = add;
    const c2 = clamp(c + randInt(-2, 2), -HALF, HALF);
    for (let k = Math.min(c, c2); k <= Math.max(c, c2); k++) add(k, true);
    c = c2;
    const fill = 0.62 - 0.1 * t, safeP = 0.3 - 0.12 * t;
    for (let k = -HALF; k <= HALF; k++) if (!row.pads.has(k) && Math.random() < fill) add(k, Math.random() < safeP);
    // always leave a tempting wrong pad next to the path
    if (![...row.pads.values()].some((p) => !p.safe)) { const free = range(-HALF, HALF).filter((k) => !row.pads.has(k)); if (free.length) add(choose(free), false); else { const k = choose(range(-HALF, HALF).filter((q) => q !== c)); row.pads.delete(k); add(k, false); } }
    rows.push(row);
  }
  // a right answer is never a dead end: every stretch of safe pads has a safe pad straight ahead of one of them
  for (let r = river.start; r < river.end; r++) {
    const row = rows[r], up = rows[r + 1];
    if (row.type !== "river" || up.type !== "river") continue;
    let run = [];
    for (let k = -HALF; k <= HALF + 1; k++) {
      if (k <= HALF && row.pads.get(k)?.safe) run.push(k);
      else { if (run.length && !run.some((q) => up.pads.get(q)?.safe)) { const q = choose(run); up.pads.delete(q); up.add(q, true); } run = []; }
    }
  }
  return river;
}
/** Fair river: there is a way across on safe pads, and no safe pad leads to a dead end (logs reach every column). */
function riverReachable(river) {
  for (let r = river.start; r <= river.end; r++) {
    const row = rows[r], up = rows[r + 1];
    if (row.type !== "river") continue;
    const safe = range(-HALF, HALF).filter((c) => row.pads.get(c)?.safe);
    if (!safe.length) return false;
    if (r === river.end || up.type !== "river") continue;
    for (const c of safe) {
      let ok = false;
      for (let k = c; k <= HALF && row.pads.get(k)?.safe; k++) if (up.pads.get(k)?.safe) ok = true;
      for (let k = c; k >= -HALF && row.pads.get(k)?.safe; k--) if (up.pads.get(k)?.safe) ok = true;
      if (!ok) return false;
    }
  }
  return true;
}
function extend() {
  const dist = rows.length - BASE;
  const t = clamp(dist / 220, 0, 1);
  const kind = nextKind;
  if (kind === "road") { const n = randInt(1, 2 + (t > 0.25 ? 1 : 0) + (t > 0.7 ? 1 : 0)); let dir = choose([-1, 1]); for (let i = 0; i < n; i++) { roadRow(t, dir); if (Math.random() < 0.7) dir = -dir; } }
  else if (kind === "rail") { const n = Math.random() < 0.25 + 0.3 * t ? 2 : 1; for (let i = 0; i < n; i++) railRow(); }
  else riverRows(t);
  const opts = dist < 4 ? ["road"] : dist < 9 ? ["river"] : kind === "river" ? ["road", "road", "rail", "river"] : ["road", "rail", "river", "river"];
  nextKind = choose(opts.filter((k) => k !== kind || k === "road" || Math.random() < 0.35)) || "road";
  const n = Math.random() < 0.55 - 0.3 * t ? 2 : 1;
  for (let i = 0; i < n; i++) grassRow({ clear: (i === 0 && kind === "river") || (i === n - 1 && nextKind === "river") });
}

function reset() {
  rows = [];
  for (let i = 0; i < BASE - 2; i++) grassRow({ wall: true, noCoin: true });
  for (let i = 0; i < 5; i++) grassRow({ clear: true, noCoin: true });
  nextKind = "road";
  while (rows.length < BASE + 26) extend();
  P = { x: 0, y: 0, col: 0, row: BASE, t: -1, fx: 0, fz: -BASE, fy: 0, tx: 0, ty: 0, face: Math.PI, rot: 0, sq: 0, sqV: 0, bump: 0, onLog: null, lock: false, badPad: null, dead: null, deadT: 0, idle: 0, queue: null, vz: -BASE, sx: 0, sy: 0, swipe: false, why: "" };
  focus = BASE - 0.4;
  started = false;
  score = 0;
  coins = 0;
  stats = { pads: 0, rivers: 0 };
  bits = [];
  shownRule = null;
  lastRiver = null;
  streak = 0; bestStreak = 0; lastFwd = -9; topRow = BASE; warnBeep = 0; fogGap = 9;
}

function burst(x, y, z, n, col, power = 2.4, up = 3.4) {
  for (let i = 0; i < n && bits.length < 88; i++) {
    const a = rand(0, 6.28), p = rand(0.4, 1) * power;
    bits.push({ x, y, z, vx: Math.cos(a) * p, vy: rand(0.6, 1) * up, vz: Math.sin(a) * p, life: rand(0.4, 0.75), col, s: rand(0.7, 1.4) });
  }
}
const groundY = (row, col, x) => (row.type === "river" ? -0.02 : row.type === "log" ? 0.08 : 0);

function tryHop(dx, dz) {
  if (P.dead || P.lock) return;
  P.face = dz > 0 ? Math.PI : dz < 0 ? 0 : dx > 0 ? Math.PI / 2 : -Math.PI / 2;
  P.idle = 0;
  const nc = Math.round(P.x) + dx, nr = P.row + dz;
  const row = rows[nr];
  if (Math.abs(nc) > HALF || !row || (row.type === "grass" && row.blockers.has(nc)) || nr < focus - 1.4) { P.bump = 1; sfx.play("tick"); return; }
  P.fx = P.x; P.fz = P.vz; P.fy = P.y;
  P.col = nc; P.row = nr; P.tx = nc; P.ty = groundY(row);
  P.t = 0; P.onLog = null;
  started = true;
  sfx.tone(470, 0.09, { slide: 760, type: "sine", vol: 0.4 });
}
function die(kind, why = "") {
  if (P.dead) return;
  P.dead = kind; P.deadT = 0; P.why = why; P.lock = true; P.queue = null;
  if (kind === "hit") { sfx.play("crash"); g.shake(14, 0.4); burst(P.x, 0.4, P.vz, 16, 0xffffff, 3.2, 3.6); burst(P.x, 0.4, P.vz, 8, 0xfbbf24, 2.4, 3); }
  else if (kind === "sink" || kind === "swept") { sfx.noise(0.35, { freq: 1600, vol: 0.7 }); sfx.tone(300, 0.3, { slide: 90, type: "sine", vol: 0.5 }); g.shake(6, 0.25); burst(P.x, -0.05, P.vz, 22, 0xe0f5ff, 2.2, 4.4); burst(P.x, -0.05, P.vz, 10, 0x8fd6f5, 1.5, 3.2); }
  else { sfx.play("whoosh"); }
}
function land() {
  const row = rows[P.row];
  P.t = -1; P.x = P.tx; P.y = P.ty; P.vz = -P.row; P.sqV = -7.5;
  if (row.type === "river") {
    const pad = row.pads.get(P.col);
    if (!pad || pad.gone) return die("sink", "You missed the pads.");
    if (pad.safe) {
      pad.bob = 1;
      if (!pad.used) { pad.used = true; stats.pads++; burst(P.x, 0.05, P.vz, 6, 0xbbf7d0, 1.3, 2.2); }
      sfx.play("bounce");
    } else {
      pad.sink = 0; P.lock = true; P.badPad = pad;
      P.why = `${pad.n} does not fit: ${row.river.rule.text}.`;
      sfx.play("wrong");
    }
  } else if (row.type === "log") {
    const lg = row.logs.find((l) => Math.abs(l.x - P.x) < l.len / 2 + 0.08);
    if (!lg) return die("sink", "You missed the log.");
    P.onLog = lg;
    sfx.play("land");
  } else {
    sfx.noise(0.05, { freq: 420, vol: 0.3 });
    if (row.coins?.has(P.col)) { row.coins.delete(P.col); coins++; g.setHud("Coins", coins); sfx.play("coin"); burst(P.x, 0.5, P.vz, 8, 0xfde047, 1.6, 2.8); }
    if (lastRiver && P.row > lastRiver.end && !lastRiver.done) { lastRiver.done = true; stats.rivers++; g.toast("River crossed", 900, "good"); sfx.play("correct"); }
  }
  if (row.river) lastRiver = row.river;
  if (P.row - BASE > score) { score = P.row - BASE; g.setScore(score); }
  // quick streak: each new row reached soon after the last one keeps the chain going
  if (!P.dead && !P.badPad && P.row > topRow) {
    topRow = P.row;
    streak = g.time - lastFwd <= QUICK ? streak + 1 : 1;
    lastFwd = g.time;
    if (streak > bestStreak) bestStreak = streak;
    if (streak >= 3) {
      g.setHud("Streak", "x" + streak);
      sfx.tone(520 + Math.min(streak, 20) * 40, 0.07, { type: "triangle", vol: 0.25 });
      if (streak % 5 === 0) { const bonus = streak >= 20 ? 2 : 1; coins += bonus; g.setHud("Coins", coins); g.toast(`Quick streak x${streak}  +${bonus} ${bonus === 1 ? "coin" : "coins"}`, 800, "gold"); sfx.play("coin"); burst(P.x, 0.6, P.vz, 10, 0xfde047, 1.8, 3); }
    }
  }
}

function readInput() {
  const k = g.keys;
  let mv = null;
  if (k.pressed("ArrowUp", "KeyW", "Space")) mv = [0, 1];
  else if (k.pressed("ArrowDown", "KeyS")) mv = [0, -1];
  else if (k.pressed("ArrowLeft", "KeyA")) mv = [-1, 0];
  else if (k.pressed("ArrowRight", "KeyD")) mv = [1, 0];
  const p = g.pointer;
  if (p.pressed) { P.sx = p.x; P.sy = p.y; P.swipe = true; }
  if (P.swipe && (p.released || (p.down && Math.hypot((p.x - P.sx) * 16, (p.y - P.sy) * 9) > 1.1))) {
    const dx = (p.x - P.sx) * 16, dy = (p.y - P.sy) * 9;
    P.swipe = false;
    if (Math.hypot(dx, dy) < 0.45) mv = [0, 1];
    else if (Math.abs(dx) > Math.abs(dy)) mv = [dx > 0 ? 1 : -1, 0];
    else mv = [0, dy < 0 ? 1 : -1];
  }
  if (mv) P.queue = mv;
}

function update(dt) {
  readInput();
  while (rows.length < focus + 34) extend();
  const lo = Math.max(0, Math.floor(focus) - 7), hi = Math.floor(focus) + 23;
  for (let r = 0; r < lo - 4; r++) if (rows[r]) rows[r] = null; // let old rows go

  // traffic, trams, logs, pads
  for (let r = lo; r <= hi; r++) {
    const row = rows[r];
    if (!row) continue;
    if (row.type === "road") {
      for (const c of row.cars) { c.x += row.dir * row.speed * dt; if (c.x > SPAN / 2) c.x -= SPAN; else if (c.x < -SPAN / 2) c.x += SPAN; }
    } else if (row.type === "rail") {
      row.t -= dt;
      if (row.state === 0 && row.t <= 0) { row.state = 1; row.t = 1.15; row.beep = 0; }
      else if (row.state === 1) {
        row.beep -= dt;
        if (row.beep <= 0 && Math.abs(r - P.row) < 9) { row.beep = 0.26; sfx.tone(880, 0.07, { type: "square", vol: 0.16 }); }
        if (row.t <= 0) { row.state = 2; row.x = -row.dir * 24; if (Math.abs(r - P.row) < 9) sfx.play("whoosh"); }
      } else if (row.state === 2) {
        row.x += row.dir * 30 * dt;
        if (Math.abs(row.x) > 25) { row.state = 0; row.t = rand(2.2, 6); }
      }
    } else if (row.type === "log") {
      for (const l of row.logs) { l.x += row.dir * row.speed * dt; if (l.x > SPAN / 2) l.x -= SPAN; else if (l.x < -SPAN / 2) l.x += SPAN; }
    } else if (row.type === "river") {
      for (const [, pad] of row.pads) {
        if (pad.bob > 0) pad.bob = Math.max(0, pad.bob - dt * 2.6);
        if (pad.sink >= 0 && !pad.gone) {
          pad.sink += dt;
          if (pad.sink > 0.42) { pad.gone = true; if (P.badPad === pad) die("sink", P.why); }
        }
      }
    }
  }

  // the hero
  if (P.t >= 0) {
    P.t += dt / HOP;
    const e = Math.min(1, P.t);
    P.x = lerp(P.fx, P.tx, e);
    P.vz = lerp(P.fz, -P.row, e);
    P.y = lerp(P.fy, P.ty, e) + Math.sin(Math.PI * e) * 0.5;
    if (P.t >= 1) land();
  } else if (!P.dead) {
    if (P.onLog) {
      const row = rows[P.row];
      P.x += row.dir * row.speed * dt;
      if (Math.abs(P.x) > HALF + 0.55) die("swept", "The log carried you away.");
    }
    if (P.queue) { const q = P.queue; P.queue = null; tryHop(q[0], q[1]); }
  }
  P.idle += dt;
  P.sqV += (-P.sq * 190 - P.sqV * 15) * dt;
  P.sq += P.sqV * dt;
  P.bump = Math.max(0, P.bump - dt * 7);
  let want = P.face;
  if (P.idle > 2.2 && !P.dead && P.t < 0) want = 0.25; // glance back at the player
  let d = want - P.rot;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  P.rot += d * (1 - Math.exp(-22 * dt));

  if (!P.dead) {
    const row = rows[P.row];
    if (row.type === "road") { const hl = LEN[row.kind] / 2 + 0.24; for (const c of row.cars) if (Math.abs(c.x - P.x) < hl) { die("hit", row.kind === "truck" ? "A truck got you." : row.kind === "scooter" ? "A scooter got you." : "A car got you."); break; } }
    else if (row.type === "rail" && row.state === 2 && Math.abs(row.x - P.x) < 3.45) die("hit", "The tram got you. Watch the red light.");
    // the camera never waits: it starts to creep at the first hop and speeds up steadily with the score
    if (started) focus += (0.45 + Math.min(1.05, score * 0.007)) * dt;
    if (streak && g.time - lastFwd > QUICK) { streak = 0; g.setHud("Streak", null); }
    // warn when the fog is about to catch up
    fogGap = P.row - (focus - DEAD_LINE);
    if (started && fogGap < 1.25) { warnBeep -= dt; if (warnBeep <= 0) { warnBeep = 0.34; sfx.tone(980, 0.08, { type: "square", vol: 0.2 }); } } else warnBeep = 0;
    if (P.row - focus > 2.2) focus = damp(focus, P.row - 2.2, 5, dt);
    if (P.row < focus - DEAD_LINE && !P.dead) die("behind", "The fog caught up with you. Keep hopping forward.");
  } else {
    P.deadT += dt;
    if (P.dead === "sink" || P.dead === "swept") P.y -= dt * 2.6;
    if (P.deadT > 1.0) {
      const title = { hit: "Bumped", sink: "Splash", swept: "Swept away", behind: "Too slow" }[P.dead];
      g.over({ score, title, scoreLabel: "Rows", lines: [P.why, `Coins ${coins}   Safe pads ${stats.pads}   Rivers ${stats.rivers}   Best quick streak ${bestStreak}`].filter(Boolean) });
      warn.style.opacity = "0";
    }
  }

  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.life -= dt; b.vy -= 11 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.life <= 0) { bits[i] = bits[bits.length - 1]; bits.pop(); }
  }

  // which rule to show: the next river in view that is not behind us
  let rule = null;
  if (!P.dead || P.dead === "sink") {
    for (let r = Math.max(0, P.row - 0); r <= Math.floor(focus) + 13; r++) if (rows[r]?.river) { rule = rows[r].river.rule; break; }
  }
  if (rule !== shownRule) { shownRule = rule; paintRule(); }
}

// ---------- fog warning (a red glow at the back edge and one short line) ----------
const warn = document.createElement("div");
warn.className = "ha-warn";
warn.innerHTML = "<b>The fog is close. Hop!</b>";
g.stage.appendChild(warn);

// ---------- banner ----------
const banner = document.createElement("div");
banner.className = "ha-rule";
banner.innerHTML = "<small>Safe pads</small><b></b>";
g.stage.appendChild(banner);
function paintRule() {
  if (shownRule) { banner.lastChild.textContent = shownRule.text; banner.classList.add("on"); }
  else banner.classList.remove("on");
}

// ---------- draw ----------
const hash = (n) => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
function render() {
  const T = g.time;
  for (const m of meshes) m.userData.n = 0;
  const lo = Math.max(0, Math.floor(focus) - 7), hi = Math.min(rows.length - 1, Math.floor(focus) + 23);
  for (let r = lo; r <= hi; r++) {
    const row = rows[r];
    if (!row) continue;
    const z = -r;
    if (row.type === "grass") {
      put(M.strip, 0, 0, z, 0, 1, 1, 1, row.bank ? (r % 2 ? 0xa6dd78 : 0xaee282) : r % 2 ? 0x93d36c : 0x9bd974);
      for (const b of row.blockers.values()) {
        const x = b.c + b.ox, zz = z + b.oz;
        if (b.k === "rock") put(M.rock, x, 0, zz, b.ry, b.s, b.s, b.s, b.col);
        else { put(M.trunk, x, 0, zz, 0, b.s, b.s, b.s); put(b.k === "pine" ? M.pine : M.leaf, x, 0, zz, b.ry, b.s, b.s, b.s, b.col); }
      }
      for (const f of row.flowers) put(M.flower, f.x, 0, z + f.z, 0, f.s, f.s, f.s, f.col);
    } else if (row.type === "road") {
      put(M.strip, 0, -0.03, z, 0, 1, 1, 1, 0x5a6475);
      if (rows[r + 1]?.type === "road") for (let x = -WIDE - 1; x <= WIDE + 1; x += 2) put(M.dash, x, -0.03, z - 0.5);
      const paint = row.kind === "car" ? M.carPaint : row.kind === "truck" ? M.truckPaint : M.scootPaint;
      const trim = row.kind === "car" ? M.carTrim : row.kind === "truck" ? M.truckTrim : M.scootTrim;
      const ry = row.dir > 0 ? 0 : Math.PI;
      for (const c of row.cars) {
        const bob = Math.sin(T * 9 + c.x) * 0.012;
        put(paint, c.x, -0.03 + bob, z, ry, 1, 1, 1, c.col);
        put(trim, c.x, -0.03 + bob, z, ry);
      }
    } else if (row.type === "rail") {
      put(M.strip, 0, -0.02, z, 0, 1, 1, 1, 0xcdb994);
      for (let x = -WIDE - 2; x <= WIDE + 2; x += 0.85) put(M.sleeper, x, -0.02, z);
      put(M.rail, 0, -0.02, z - 0.25);
      put(M.rail, 0, -0.02, z + 0.25);
      const on = row.state === 1 && Math.sin(T * 24) > 0;
      for (const sx of [-HALF - 0.8, HALF + 0.8]) {
        put(M.post, sx, 0, z + 0.36);
        put(M.lamp, sx, 0, z + 0.36, 0, 1, 1, 1, on || row.state === 2 ? 0xff3b3b : 0x6b1f1f);
      }
      if (row.state === 2) { const ry = row.dir > 0 ? 0 : Math.PI; put(M.tramPaint, row.x, 0, z, ry, 1, 1, 1, row.col); put(M.tramTrim, row.x, 0, z, ry); }
    } else {
      put(M.strip, 0, -0.16, z, 0, 1, 1, 1, row.type === "log" ? 0x4fb4e6 : r % 2 ? 0x5cc0ee : 0x57bbea);
      for (let i = 0; i < 5; i++) {
        const h = hash(r * 13 + i), sp = 0.35 + hash(r + i * 7) * 0.5;
        const x = ((h * SPAN + T * sp * (row.dir || (r % 2 ? 1 : -1))) % SPAN + SPAN) % SPAN - SPAN / 2;
        put(M.foam, x, -0.155, z + (hash(i * 3 + r) - 0.5) * 0.8, 0, 0.22 + h * 0.2, 0.012, 0.035);
      }
      if (row.type === "log") for (const l of row.logs) put(M.log, l.x, -0.1 + Math.sin(T * 2 + l.x) * 0.015, z, 0, l.len, 1, 1);
      else for (const [c, pad] of row.pads) {
        if (pad.gone) continue;
        const sink = pad.sink >= 0 ? pad.sink / 0.42 : 0;
        const wob = pad.sink >= 0 ? Math.sin(pad.sink * 60) * 0.03 * (1 - sink) : 0;
        const y = -0.1 - Math.sin(pad.bob * Math.PI) * 0.07 - sink * sink * 0.5 + Math.sin(T * 1.7 + c * 2 + r) * 0.012;
        const s = 1 - sink * 0.35;
        put(M.pad, c + wob, y, z, pad.ry, s, 1, s, pad.sink >= 0 ? 0xc9c36a : 0xffffff);
        if (!(P.row === r && P.col === c && P.t < 0)) {
          const i = put(M.label, c + wob, y + 0.075, z, 0, s, 1, s);
          if (i >= 0) labelOff.setXY(i, (pad.n % 8) / 8, 1 - (Math.floor(pad.n / 8) + 1) / 8);
        }
      }
    }
    if (row.coins) for (const c of row.coins) put(M.coin, c, 0.46 + Math.sin(T * 3 + c) * 0.05, z, T * 3.2 + c);
  }
  for (const b of bits) { const s = b.s * Math.min(1, b.life * 4); put(M.bit, b.x, b.y, b.z, 0, s, s, s, b.col); }
  // fog bank: a solid wall behind the line and two rows of rolling puffs along its front edge
  const edge = -(focus - DEAD_LINE) + 0.55;
  put(M.fogWall, 0, 1.5, edge + 6.4, 0, 1, 1.7, 12);
  for (let i = 0; i < 30; i++) {
    const h = hash(i * 7.3), x = -14.5 + i, roll = Math.sin(T * 1.6 + i * 1.3);
    const s = 0.8 + h * 0.3 + roll * 0.05;
    put(M.fog, x + roll * 0.12, 0.75 + h * 0.3, edge + 0.45 - roll * 0.1, 0, s * 1.15, s, s);
    const s2 = 0.42 + hash(i * 3.1) * 0.22;
    put(M.fog, x + 0.5 - roll * 0.1, 0.16, edge - 0.3 + Math.sin(T * 2.1 + i * 2.2) * 0.14, 0, s2 * 1.2, s2 * 0.8, s2);
  }
  const danger = g.state === "playing" && started && !P.dead ? clamp((1.25 - fogGap) / 0.9, 0, 1) : 0;
  warn.style.opacity = danger > 0 ? (danger * (0.7 + 0.3 * Math.sin(T * 14))).toFixed(2) : "0";
  for (const m of meshes) {
    m.count = m.userData.n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  labelOff.needsUpdate = true;

  // hero
  const hit = P.dead === "hit";
  let sy = 1 + P.sq, sxz = 1 - P.sq * 0.5;
  if (P.t >= 0) { const st = Math.sin(Math.PI * Math.min(1, P.t)) * 0.16; sy += st; sxz -= st * 0.5; }
  else if (!P.dead) sy += Math.sin(T * 3) * 0.018;
  if (hit) { const k = Math.min(1, P.deadT * 9); sy = lerp(sy, 0.14, k); sxz = lerp(sxz, 1.35, k); }
  hero.position.set(P.x + Math.sin(P.face) * P.bump * 0.1, P.y, P.vz + Math.cos(P.face) * P.bump * 0.1);
  hero.scale.set(sxz, sy, sxz);
  archie.rotation.y = P.rot;
  archie.rotation.z = P.badPad && !P.badPad.gone ? Math.sin(T * 40) * 0.12 : 0;
  const up = P.t >= 0 ? Math.sin(Math.PI * Math.min(1, P.t)) : 0;
  archie.userData.arms[0].rotation.z = -0.35 - up * 1.5 - (P.lock && !hit ? 2 : 0);
  archie.userData.arms[1].rotation.z = 0.35 + up * 1.5 + (P.lock && !hit ? 2 : 0);
  hero.visible = !(P.dead === "sink" || P.dead === "swept") || P.y > -1.3;

  // camera and sun
  const fz = -(focus + 3.4), cx = clamp(P.x, -HALF, HALF) * 0.32;
  camera.position.set(cx + 2.9 + g.shakeX * 0.02, 16.2 + g.shakeY * 0.02, fz + 12.2);
  camera.lookAt(cx, 0, fz);
  sun.position.set(cx - 7.5, 15, fz + 6.5);
  sun.target.position.set(cx, 0, fz - 1);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
}

g.onStart = () => { reset(); g.setScore(0); g.setHud("Coins", 0); paintRule(); };
reset();
g.debug = {
  get P() { return P; }, get rows() { return rows; }, get focus() { return focus; }, get score() { return score; }, get coins() { return coins; }, get stats() { return stats; },
  get rule() { return shownRule; }, get streak() { return { streak, bestStreak, fogGap }; }, HALF, BASE, riverReachable, makeRule, renderer,
  /** Test hook: build n rivers and count any without a safe path. */
  checkRivers(n = 500) { const keep = rows; let bad = 0, badNum = 0; for (let i = 0; i < n; i++) { rows = new Array(BASE + randInt(0, 300)).fill(null); const rv = riverRows(Math.random()); rows.push({ type: "grass" }); if (!riverReachable(rv)) bad++; for (let r = rv.start; r <= rv.end; r++) if (rows[r].type === "river") for (const p of rows[r].pads.values()) if (rv.rule.safe.includes(p.n) !== p.safe || rv.rule.unsafe.includes(p.n) === p.safe) badNum++; } rows = keep; return { bad, badNum }; },
};
g.loop(update, render);
