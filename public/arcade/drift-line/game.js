// Drift Line: a one-button drift along a narrow pastel road above the clouds.
// Hold to swing right, let go to swing left. At a fork, each branch carries an answer.
import * as THREE from "../vendor/three.module.min.js";
import { createGame, math, sfx, FONT, clamp, lerp, damp, rand, randInt } from "../kit/kit.js";
import { toonRamp, rbox, merge, label, skyDome } from "./lib.js";

const CARS = [
  { name: "Sky", color: "#3b82f6", cost: 0 },
  { name: "Coral", color: "#fb7185", cost: 25 },
  { name: "Mint", color: "#34d399", cost: 50 },
  { name: "Sunny", color: "#fbbf24", cost: 80 },
  { name: "Grape", color: "#a78bfa", cost: 120 },
];

let ready = false;
const g = createGame({
  slug: "drift-line",
  title: "Drift Line",
  tagline: "One button. One narrow road in the sky.",
  how: ["Hold to drift right. Let go to drift left. Stay on the road.", "At a fork, take the branch with the right answer for a boost and coins."],
  controls: [{ keys: "Space / click / touch", does: "Hold to steer right" }],
  aspect: 16 / 9,
  bg: "#bfe3ff",
  onMenu: (el) => { if (ready) paintGarage(el); },
});

// ---------- constants ----------
const T = 4.4; // tile length and normal road width
const WIDE = 6.8, NARROW = 3.6;
const ARM = 5 * T; // fork square to branch corner, center to center
const MARGIN = 0.7; // how far the car's center may hang over an edge
const TURN = 7.4, GRIP = 5.2; // at 13 units per second; both scale with speed
const SQ2 = Math.SQRT1_2;
const DX = [1, 0], DZ = [0, -1]; // dir 0 = +X (hold), dir 1 = -Z (let go)
const PASTEL = ["#ffd3e6", "#ffe3c4", "#fff3b5", "#d3f5d8", "#c9ecff", "#e2dbff"];
const SIGN_COL = ["#ec4899", "#14b8a6"];

// ---------- renderer ----------
let W = 960, H = 540, DPR = 1, renderer = null;
const camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.5, 2400);
const applySize = () => {
  if (!renderer) return;
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
};
const canvas = g.canvas3d((w, h, dpr) => { W = w; H = h; DPR = dpr; applySize(); });
renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
applySize();
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const HAZE = "#e4f3ff";
scene.fog = new THREE.Fog(HAZE, 70, 190);
const ramp = toonRamp([150, 205, 255]);
const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: ramp, ...o });
const vtoon = toon({ vertexColors: true });

scene.add(skyDome({ top: "#2f86e6", mid: "#8accff", low: HAZE, sun: "#fff3c4", sunDir: [0.5, 0.42, -0.75], sunSize: 0.9992, glow: 5 }));
scene.add(new THREE.HemisphereLight("#ffffff", "#9cc8ff", 1.5));
const sun = new THREE.DirectionalLight("#fff6e0", 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 90 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

// ---------- cloud sea far below ----------
const seaMat = new THREE.ShaderMaterial({
  fog: false,
  uniforms: { uTime: { value: 0 }, uCar: { value: new THREE.Vector2() }, white: { value: new THREE.Color("#ffffff") }, shade: { value: new THREE.Color("#cfe6ff") }, deep: { value: new THREE.Color("#79bdf7") }, haze: { value: new THREE.Color(HAZE) } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying vec3 vW; uniform float uTime; uniform vec2 uCar; uniform vec3 white, shade, deep, haze;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    void main(){
      vec2 p = vW.xz;
      float n = noise(p * 0.022 + uTime * 0.012) * 0.62 + noise(p * 0.06 - uTime * 0.02) * 0.28 + noise(p * 0.15) * 0.1;
      vec3 c = mix(deep, shade, smoothstep(0.38, 0.47, n));
      c = mix(c, white, smoothstep(0.47, 0.6, n));
      c = mix(c, shade, smoothstep(0.66, 0.8, n) * 0.5);
      float d = length(p - uCar);
      c = mix(c, haze, smoothstep(90.0, 420.0, d));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), seaMat);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -34;
scene.add(sea);

// ---------- scenery pools: cloud puffs, islands, balloons ----------
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), toon({ color: "#ffffff", fog: true }), 96);
puffs.frustumCulled = false;
scene.add(puffs);
const islandGeo = merge([
  { g: new THREE.CylinderGeometry(4.2, 3.6, 1.1, 10), c: "#8fdc7a", p: [0, -0.55, 0] },
  { g: new THREE.CylinderGeometry(3.6, 0.5, 5.6, 9), c: "#c2a48d", p: [0, -3.9, 0] },
  { g: new THREE.CylinderGeometry(1.6, 0.2, 3.2, 7), c: "#a98b76", p: [1.6, -3.4, 1.0] },
  { g: new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7), c: "#a56a43", p: [-1.6, 0.8, 0.4] },
  { g: new THREE.IcosahedronGeometry(1.25, 1), c: "#ff9fc4", p: [-1.6, 2.2, 0.4] },
  { g: new THREE.IcosahedronGeometry(0.85, 1), c: "#ffb9d3", p: [-0.9, 2.7, 0.9] },
  { g: new THREE.CylinderGeometry(0.16, 0.22, 1.1, 7), c: "#a56a43", p: [1.9, 0.55, -1.3] },
  { g: new THREE.IcosahedronGeometry(0.85, 1), c: "#5fcf86", p: [1.9, 1.5, -1.3] },
  { g: rbox(1.5, 1.1, 1.3, 0.12), c: "#fff4dc", p: [0.9, 0.55, 1.1] },
  { g: new THREE.ConeGeometry(1.25, 0.9, 4), c: "#fb7185", p: [0.9, 1.5, 1.1], r: [0, Math.PI / 4, 0] },
]);
const islands = new THREE.InstancedMesh(islandGeo, vtoon, 14);
islands.frustumCulled = false;
scene.add(islands);
const balloonGeo = merge([
  { g: new THREE.SphereGeometry(1.7, 18, 14), c: "#ffffff", s: [1, 1.14, 1], p: [0, 2.6, 0] },
  { g: new THREE.CylinderGeometry(1.72, 1.72, 0.5, 18, 1, true), c: "#fff0b0", p: [0, 2.7, 0] },
  { g: new THREE.CylinderGeometry(0.75, 0.5, 0.7, 12, 1, true), c: "#fff0b0", p: [0, 0.75, 0] },
  { g: rbox(0.8, 0.6, 0.8, 0.12), c: "#d9b98c", p: [0, -0.3, 0] },
  { g: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), c: "#8a7a6a", p: [-0.36, 0.3, -0.36] }, { g: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), c: "#8a7a6a", p: [0.36, 0.3, 0.36] },
  { g: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), c: "#8a7a6a", p: [0.36, 0.3, -0.36] }, { g: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), c: "#8a7a6a", p: [-0.36, 0.3, 0.36] },
]);
const balloons = new THREE.InstancedMesh(balloonGeo, toon({ vertexColors: true, side: THREE.DoubleSide }), 12);
balloons.frustumCulled = false;
scene.add(balloons);
{
  const c = new THREE.Color();
  const tints = ["#ff8fb3", "#ffb35c", "#7fd8a4", "#8fb8ff", "#c7a2ff", "#ffe066"];
  for (let i = 0; i < 12; i++) balloons.setColorAt(i, c.set(tints[i % tints.length]));
}

// ---------- road slabs ----------
const NS = 170;
const slabs = Array.from({ length: NS }, (_, i) => ({ i, on: false, cx: 0, cz: 0, hx: 0, hz: 0, tcx: 0, tcz: 0, thx: 0, thz: 0, dir: 0, k: 0, br: 0, kind: 0, fall: -1, born: 0, u: 0 }));
const unit = rbox(1, 1, 1, 0.07, 2);
const tileMesh = new THREE.InstancedMesh(unit, toon({}), NS);
const baseMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon({}), NS);
for (const m of [tileMesh, baseMesh]) { m.frustumCulled = false; m.receiveShadow = true; scene.add(m); }
baseMesh.castShadow = false;

// ---------- coins, boost pad, signs ----------
const NC = 90;
const coins = Array.from({ length: NC }, () => ({ on: false, x: 0, z: 0, born: 0 }));
const coinMesh = new THREE.InstancedMesh(
  merge([
    { g: new THREE.CylinderGeometry(0.42, 0.42, 0.12, 18), c: "#f6b21b", r: [Math.PI / 2, 0, 0] },
    { g: new THREE.CylinderGeometry(0.29, 0.29, 0.17, 18), c: "#ffe27a", r: [Math.PI / 2, 0, 0] },
  ]),
  toon({ vertexColors: true, emissive: "#8a5a00", emissiveIntensity: 0.5 }), NC);
coinMesh.frustumCulled = false; coinMesh.castShadow = true;
scene.add(coinMesh);

const pad = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.beginPath(); x.roundRect(6, 6, 244, 244, 40); x.fillStyle = "#f59e0b"; x.fill();
  x.lineWidth = 10; x.strokeStyle = "#ffffff"; x.stroke();
  x.strokeStyle = "#fff7d6"; x.lineWidth = 26; x.lineCap = "round"; x.lineJoin = "round";
  for (const y of [150, 86]) { x.beginPath(); x.moveTo(62, y + 40); x.lineTo(128, y - 22); x.lineTo(194, y + 40); x.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(T * 0.86, T * 0.86).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.visible = false;
  scene.add(m);
  return m;
})();

// surprises on the road: speed pads and jump ramps
const NX = 6;
const extras = Array.from({ length: NX }, () => ({ on: false, type: "", x: 0, z: 0, dir: 0, used: false }));
const padMeshes = [0, 1, 2].map(() => { const m = new THREE.Mesh(pad.geometry, pad.material); m.visible = false; scene.add(m); return m; });
const rampMeshes = [0, 1, 2].map(() => {
  const grp = new THREE.Group();
  const wedge = new THREE.Mesh(merge([
    { g: rbox(T * 0.8, 0.22, T * 0.62, 0.06, 2), c: "#fb923c", p: [0, 0, 0] },
    { g: rbox(T * 0.8, 0.24, 0.3, 0.05, 2), c: "#fff7d6", p: [0, 0.01, -T * 0.16] },
    { g: rbox(T * 0.8, 0.24, 0.3, 0.05, 2), c: "#fff7d6", p: [0, 0.01, T * 0.12] },
  ]), vtoon);
  wedge.rotation.x = 0.3; wedge.position.set(0, 0.36, -T * 0.12);
  wedge.castShadow = true;
  grp.add(wedge); grp.visible = false; scene.add(grp);
  return grp;
});
function addExtra(type, x, z, dir) {
  for (const e of extras) if (!e.on) { Object.assign(e, { on: true, type, x, z, dir, used: false }); return e; }
  return null;
}

const signs = [0, 1].map((i) => {
  const grp = new THREE.Group();
  const lb = label(512, 300, ANISO);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.52), new THREE.MeshBasicMaterial({ map: lb.tex, transparent: true, fog: false }));
  const ball = new THREE.Mesh(merge([
    { g: new THREE.SphereGeometry(0.95, 16, 12), c: "#ffffff", s: [1, 1.15, 1], p: [0, 3.0, 0] },
    { g: new THREE.ConeGeometry(0.2, 0.26, 8), c: "#ffffff", p: [0, 1.86, 0] },
    { g: new THREE.CylinderGeometry(0.025, 0.025, 0.6, 4), c: "#64748b", p: [0, 1.5, 0] },
  ]), toon({ vertexColors: true, color: SIGN_COL[i], fog: false }));
  grp.add(board, ball);
  grp.visible = false;
  scene.add(grp);
  return { grp, lb, board, x: 0, z: 0 };
});

// ---------- the car ----------
const car = new THREE.Group(), carTilt = new THREE.Group();
const bodyMat = toon({ color: CARS[0].color });
{
  const body = new THREE.Mesh(merge([
    { g: rbox(1.62, 0.62, 2.7, 0.26, 4), c: "#ffffff", p: [0, 0.62, 0] },
    { g: rbox(1.7, 0.3, 0.5, 0.12), c: "#ffffff", p: [0, 0.46, -1.2] },
    { g: rbox(1.7, 0.3, 0.5, 0.12), c: "#ffffff", p: [0, 0.46, 1.2] },
    { g: rbox(0.2, 0.34, 0.16, 0.05, 2), c: "#ffffff", p: [-0.6, 1.14, 1.22] }, { g: rbox(0.2, 0.34, 0.16, 0.05, 2), c: "#ffffff", p: [0.6, 1.14, 1.22] },
    { g: rbox(1.7, 0.12, 0.46, 0.05, 2), c: "#ffffff", p: [0, 1.34, 1.24] },
  ]), bodyMat);
  const wheel = (x, z) => [
    { g: new THREE.CylinderGeometry(0.46, 0.46, 0.4, 16), c: "#2b3352", p: [x, 0.46, z], r: [0, 0, Math.PI / 2] },
    { g: new THREE.CylinderGeometry(0.22, 0.22, 0.44, 12), c: "#fff4dc", p: [x, 0.46, z], r: [0, 0, Math.PI / 2] },
  ];
  const trim = new THREE.Mesh(merge([
    { g: rbox(1.34, 0.58, 1.34, 0.22, 4), c: "#fffaf0", p: [0, 1.14, 0.1] },
    { g: rbox(1.1, 0.34, 0.08, 0.03, 1), c: "#27406e", p: [0, 1.18, -0.56] },
    { g: rbox(1.0, 0.3, 0.08, 0.03, 1), c: "#27406e", p: [0, 1.18, 0.76] },
    { g: rbox(0.08, 0.3, 0.8, 0.03, 1), c: "#27406e", p: [-0.66, 1.18, 0.1] }, { g: rbox(0.08, 0.3, 0.8, 0.03, 1), c: "#27406e", p: [0.66, 1.18, 0.1] },
    { g: new THREE.SphereGeometry(0.17, 10, 8), c: "#fff7c2", p: [-0.52, 0.66, -1.36], s: [1, 1, 0.5] }, { g: new THREE.SphereGeometry(0.17, 10, 8), c: "#fff7c2", p: [0.52, 0.66, -1.36], s: [1, 1, 0.5] },
    { g: rbox(0.36, 0.14, 0.06, 0.02, 1), c: "#ef4444", p: [-0.52, 0.66, 1.38] }, { g: rbox(0.36, 0.14, 0.06, 0.02, 1), c: "#ef4444", p: [0.52, 0.66, 1.38] },
    { g: new THREE.CylinderGeometry(0.34, 0.34, 0.05, 16), c: "#fffaf0", p: [0, 0.945, -0.86] },
    { g: rbox(0.5, 0.06, 2.72, 0.02, 1), c: "#fffaf0", p: [0, 0.94, 0] },
    ...wheel(-0.86, -0.86), ...wheel(0.86, -0.86), ...wheel(-0.86, 0.9), ...wheel(0.86, 0.9),
  ]), vtoon);
  body.castShadow = trim.castShadow = true;
  carTilt.add(body, trim);
  car.add(carTilt);
  scene.add(car);
}

// ---------- smoke and skid marks ----------
const NP = 70;
const P = { x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP), vz: new Float32Array(NP), life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP), next: 0 };
const smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85 }), NP);
smoke.frustumCulled = false;
scene.add(smoke);
const _c = new THREE.Color();
function puff(x, y, z, n, color, speed, size, life = 0.6) {
  _c.set(color);
  for (let i = 0; i < n; i++) {
    const k = P.next; P.next = (P.next + 1) % NP;
    P.x[k] = x; P.y[k] = y; P.z[k] = z;
    P.vx[k] = rand(-1, 1) * speed; P.vy[k] = rand(0.3, 1) * speed; P.vz[k] = rand(-1, 1) * speed;
    P.life[k] = P.max[k] = life * rand(0.7, 1.2); P.size[k] = size * rand(0.7, 1.3);
    smoke.setColorAt(k, _c);
  }
  smoke.instanceColor.needsUpdate = true;
}
const NM = 220;
const marks = { x: new Float32Array(NM), z: new Float32Array(NM), a: new Float32Array(NM), t: new Float32Array(NM).fill(-99), next: 0 };
const markMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.62).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: "#3b3f63", transparent: true, opacity: 0.33, depthWrite: false }), NM);
markMesh.frustumCulled = false;
scene.add(markMesh);

// ---------- the problem banner ----------
const banner = document.createElement("div");
const ASK = "#fde047"; // the question banner and both answer signs share this color
banner.style.cssText = `position:absolute;left:50%;top:1cqw;transform:translateX(-50%);transform-origin:50% 0;display:none;flex-direction:column;align-items:center;gap:0;background:${ASK};border:0.45cqw solid #1e3a8a;border-radius:2.2cqw;padding:0.35cqw 2.6cqw 0.5cqw;font:900 clamp(16px,3.8cqw,50px) ${FONT};line-height:1.05;color:#0f172a;white-space:nowrap;pointer-events:none;box-shadow:0 0.6cqw 0 rgb(15 23 42 / 0.3), 0 0 3cqw rgb(253 224 71 / 0.7)`;
banner.innerHTML = `<span style="font-size:0.36em;font-weight:900;color:#1e3a8a;text-transform:uppercase;letter-spacing:0.08em">Fork ahead</span><b></b>`;
// one-line hint low on the screen, used only on a player's first runs
const hintEl = document.createElement("div");
hintEl.style.cssText = `position:absolute;left:50%;bottom:7cqw;transform:translateX(-50%);display:none;background:rgb(15 23 42 / 0.82);border-radius:99cqw;padding:0.7cqw 2.4cqw;font:800 clamp(13px,2.5cqw,30px) ${FONT};color:#fff;white-space:nowrap;pointer-events:none`;
g.stage.insertBefore(hintEl, g.stage.querySelector(".ak-toasts"));
let hintText = "";
const showHint = (text) => { if (text === hintText) return; hintText = text; hintEl.style.display = text ? "block" : "none"; hintEl.textContent = text; };
const HINT_TURN = "Hold to turn right. Let go to turn left.", HINT_FORK = "Drive to the sign with the answer";
const teach = { turns: g.load("taughtTurns", false), fork: g.load("taughtFork", false), n: 0, last: false };
g.stage.insertBefore(banner, g.stage.querySelector(".ak-toasts"));
let bannerOn = false;
const showBanner = (on, text) => {
  if (on === bannerOn) return;
  bannerOn = on;
  banner.style.display = on ? "flex" : "none";
  if (on) { sfx.tone(660, 0.12, { type: "sine", vol: 0.25 }); sfx.tone(880, 0.16, { type: "sine", vol: 0.25, delay: 0.1 }); }
  if (on) { banner.lastChild.textContent = text; g.setHud("Streak", null); } // the banner sits where the streak pill is
};

// ---------- garage (menu) ----------
function paintGarage(el) {
  const bank = g.load("bank", 0), owned = g.load("owned", [0]), pick = g.load("car", 0);
  el.innerHTML = `<div style="margin:0 0 0.9em"><div style="font-weight:800;color:#475569;font-size:clamp(11px,1.6cqw,17px);margin-bottom:0.5em">Your car. Coin bank: <b style="color:#b45309">${bank}</b></div>
    <div style="display:flex;gap:1.2cqw;justify-content:center">${CARS.map((c, i) => {
      const has = owned.includes(i), can = bank >= c.cost;
      return `<button data-car="${i}" title="${c.name}" style="cursor:pointer;border:0;background:none;padding:0;font:inherit;opacity:${has || can ? 1 : 0.45}">
        <span style="display:block;width:clamp(26px,4.4cqw,46px);height:clamp(26px,4.4cqw,46px);border-radius:50%;background:${c.color};box-shadow:0 0 0 ${i === pick ? "0.45cqw #1e3a8a" : "0.2cqw #cbd5e1"};margin:0 auto 0.35em"></span>
        <span style="font-weight:800;font-size:clamp(10px,1.35cqw,14px);color:${has ? "#475569" : "#b45309"}">${has ? c.name : c.cost + " coins"}</span></button>`;
    }).join("")}</div></div>`;
  el.onclick = (e) => {
    const b = e.target.closest("[data-car]");
    if (!b) return;
    const i = +b.dataset.car;
    const own = g.load("owned", [0]), money = g.load("bank", 0);
    if (!own.includes(i)) {
      if (money < CARS[i].cost) { sfx.play("wrong"); return; }
      g.save("bank", money - CARS[i].cost); g.save("owned", [...own, i]);
      sfx.play("power");
    } else sfx.play("click");
    g.save("car", i);
    bodyMat.color.set(CARS[i].color);
    paintGarage(el);
    g.redraw();
  };
}
bodyMat.color.set(CARS[g.load("car", 0)]?.color || CARS[0].color);

// ---------- state and road building ----------
const S = {};
const gen = { ex: 0, ez: 0, d: 1, k: 0, nextFork: 0, legs: 0, calm: 0, last: "" };
const fork = { on: false, resolved: true, right: 1, text: "", answers: ["", ""], answer: "", u: 0, picked: 0, t: 0, padOn: false, padX: 0, padZ: 0, padUsed: false };
const _tc = new THREE.Color(), _tc2 = new THREE.Color();
const uOf = (x, z) => (x - z) * SQ2, vOf = (x, z) => (x + z) * SQ2;

function addSlab(cx, cz, sx, sz, dir, kind, br, k) {
  let s = null;
  for (const q of slabs) if (!q.on) { s = q; break; }
  if (!s) return null;
  Object.assign(s, { on: true, cx, cz, hx: sx / 2, hz: sz / 2, tcx: cx, tcz: cz, thx: sx / 2, thz: sz / 2, dir, kind, br, k, fall: -1, hold: false, born: g.time, u: uOf(cx, cz) });
  // pastel that drifts through the palette as the road goes on
  const f = (k / 16) % PASTEL.length, a = Math.floor(f);
  _tc.set(PASTEL[a]).lerp(_tc2.set(PASTEL[(a + 1) % PASTEL.length]), f - a);
  if (kind) _tc.lerp(_tc2.set("#ffffff"), 0.7); else if (k % 2) _tc.multiplyScalar(0.9);
  tileMesh.setColorAt(s.i, _tc);
  _tc.multiplyScalar(0.62).lerp(_tc2.set("#7a8fd6"), 0.25);
  baseMesh.setColorAt(s.i, _tc);
  tileMesh.instanceColor.needsUpdate = baseMesh.instanceColor.needsUpdate = true;
  return s;
}
/** n tiles from the cursor along its direction. Returns the slabs. */
function leg(n, len = T, w = T, br = 0, k0 = -1) {
  const out = [];
  const d = gen.d;
  for (let i = 0; i < n; i++) {
    const cx = gen.ex + DX[d] * len / 2, cz = gen.ez + DZ[d] * len / 2;
    const k = k0 < 0 ? ++gen.k : k0 + i;
    out.push(addSlab(cx, cz, d === 0 ? len : w, d === 0 ? w : len, d, 0, br, k));
    gen.ex += DX[d] * len; gen.ez += DZ[d] * len;
  }
  return out;
}
/** A square pad that turns the road to the other direction. */
function corner(size = T * 1.22, br = 0, k = -1, kind = 1) {
  const d = gen.d, nd = 1 - d;
  const cx = gen.ex + DX[d] * size / 2, cz = gen.ez + DZ[d] * size / 2;
  const s = addSlab(cx, cz, size, size, nd, kind, br, k < 0 ? ++gen.k : k);
  gen.d = nd; gen.ex = cx + DX[nd] * size / 2; gen.ez = cz + DZ[nd] * size / 2;
  return s;
}
function addCoin(x, z) {
  for (const c of coins) if (!c.on) { c.on = true; c.x = x; c.z = z; c.born = g.time; return; }
}
function buildFork() {
  const d1 = gen.d, d2 = 1 - d1;
  const s0 = T * 1.3, m = T * 1.6, cs = T * 1.22;
  const ox = gen.ex + DX[d1] * s0 / 2, oz = gen.ez + DZ[d1] * s0 / 2;
  const k0 = ++gen.k;
  addSlab(ox, oz, s0, s0, d1, 2, 0, k0);
  const mx = ox + (DX[d1] + DX[d2]) * ARM, mz = oz + (DZ[d1] + DZ[d2]) * ARM;
  let kEnd = k0;
  // branch 1 keeps going (first along d1), branch 2 turns at once (first along d2)
  for (const br of [1, 2]) {
    const a = br === 1 ? d1 : d2, b = 1 - a;
    gen.d = a; gen.ex = ox + DX[a] * s0 / 2; gen.ez = oz + DZ[a] * s0 / 2;
    const free1 = ARM - s0 / 2 - cs / 2, n1 = Math.round(free1 / T);
    const first = leg(n1, free1 / n1, T, br, k0 + 1);
    corner(cs, br, k0 + 1 + n1);
    const free2 = ARM - cs / 2 - m / 2, n2 = Math.round(free2 / T);
    leg(n2, free2 / n2, T, br, k0 + 2 + n1);
    kEnd = k0 + 2 + n1 + n2;
    // the sign floats over the start of this branch, a little to the outside
    const sg = signs[br - 1], t0 = first[1] || first[0];
    sg.x = t0.cx - DX[b] * 2.2; sg.z = t0.cz - DZ[b] * 2.2;
  }
  gen.k = kEnd;
  const nd = Math.random() < 0.5 ? 0 : 1;
  addSlab(mx, mz, m, m, nd, 3, 0, gen.k);
  gen.d = nd; gen.ex = mx + DX[nd] * m / 2; gen.ez = mz + DZ[nd] * m / 2;
  // the problem: one branch holds the answer, the other a near miss
  const level = clamp(1 + Math.floor(S.forks / 3), 1, 3);
  const p = math.problem({ topic: "algebra", level });
  const wrong = p.choices.find((c) => !p.check(c));
  const right = Math.random() < 0.5 ? 1 : 2;
  Object.assign(fork, { on: true, resolved: false, right, text: p.text, answer: p.answer, answers: right === 1 ? [p.answer, wrong] : [wrong, p.answer], u: uOf(ox, oz), picked: 0, t: 0, padOn: false, padUsed: false, k0 });
  // which sign is on the left of the screen depends on the direction of each branch
  for (const br of [1, 2]) {
    const sg = signs[br - 1], first = br === 1 ? d1 : d2;
    sg.lb.draw(String(fork.answers[br - 1]), { bg: ASK, fg: "#0f172a", edge: "#1e3a8a", size: 0.7 });
    sg.grp.children[1].material.color.set(ASK);
    sg.grp.visible = true; sg.grp.scale.setScalar(1);
  }
  leg(4);
}
/** Lay road until it reaches far enough ahead of the car. */
function build() {
  const carU = uOf(S.x, S.z);
  let guard = 0;
  while (uOf(gen.ex, gen.ez) < carU + 150 && guard++ < 40) {
    const v = vOf(gen.ex, gen.ez);
    if (fork.resolved && gen.k >= gen.nextFork && Math.abs(v) < 7) {
      buildFork();
      gen.nextFork = gen.k + randInt(30, 74); // forks come at uneven distances
      gen.calm = 2; gen.last = "fork";
      continue;
    }
    // straight run, kept near the middle line so scenery never touches the road
    const sign = gen.d === 0 ? 1 : -1, d = gen.d;
    const room = (m) => Math.abs(v + sign * m * T * SQ2);
    let n = gen.k < 30 ? randInt(2, 4) : Math.random() < 0.22 ? 1 : randInt(2, 6);
    while (n > 2 && room(n) > 10) n--;
    if (room(n) > 13) n = 1;
    // surprises start after the player has learned to turn, never twice in a row, never right before a fork
    let kind = "plain";
    if (gen.calm > 0) gen.calm--;
    else if (gen.k > 34 && gen.nextFork - gen.k > 8) {
      const r = Math.random(), hard = gen.k > 70;
      if (room(5) <= 10.5 && Math.random() < 0.3) kind = "jump";
      else if (r < 0.14 && n >= 3) kind = "pad";
      else if (r < 0.24) kind = "plaza";
      else if (r < 0.38 && n >= 3) kind = "slide";
      else if (r < 0.5 && n >= 2) kind = "narrow";
      else if (r < 0.58 && hard && room(1) <= 12) kind = "stairs";
      else if (r < 0.7 && n >= 2) kind = "wide";
      if (kind === gen.last) kind = "plain";
    }
    if (kind !== "plain") gen.calm = 1;
    gen.last = kind;
    if (kind === "jump") {
      // a ramp, a one-tile hole, then a landing strip
      const a = leg(2);
      addExtra("ramp", a[1].cx, a[1].cz, d);
      gen.ex += DX[d] * T; gen.ez += DZ[d] * T; gen.k++;
      for (const t of leg(2)) addCoin(t.cx, t.cz);
      corner();
    } else if (kind === "plaza") {
      // a big square with a spiral of coins
      leg(Math.min(n, 2));
      const s = corner(T * 2.5);
      for (let i = 0; i < 9; i++) { const an = i * 0.85, rad = 1.1 + i * 0.42; addCoin(s.cx + Math.cos(an) * rad, s.cz + Math.sin(an) * rad); }
    } else if (kind === "stairs") {
      for (let i = 0; i < 3; i++) { const t = leg(1)[0]; addCoin(t.cx, t.cz); corner(T * 1.3); }
    } else {
      const w = kind === "narrow" ? 3.25 : kind === "wide" ? T * 1.35 : gen.k > 30 ? T * rand(0.92, 1.12) : T;
      if (kind === "narrow") n = Math.min(n, 3);
      const tiles = leg(n, T, w);
      if (kind === "narrow") for (const t of tiles) { tileMesh.setColorAt(t.i, _tc.set("#ff9db5")); addCoin(t.cx, t.cz); }
      else if (kind === "pad") addExtra("pad", tiles[0].cx, tiles[0].cz, d);
      else if (kind === "slide") {
        // one tile waits off to the side and slides into place as the car comes near
        const t = tiles[Math.min(2, n - 2)], off = Math.random() < 0.5 ? 7 : -7;
        t.hold = true; t.cx += DX[1 - d] * off; t.cz += DZ[1 - d] * off;
        tileMesh.setColorAt(t.i, _tc.set("#bfe9ff"));
      } else if (Math.random() < 0.5 && n >= 2) for (const t of tiles) addCoin(t.cx, t.cz);
      corner(kind === "plain" && gen.k > 30 ? T * rand(1.15, 1.5) : T * 1.22);
    }
  }
}
function reset() {
  Object.assign(S, {
    x: 0, y: 0, z: 0, th: 0, ph: 0, speed: 0, base: 12.5, hold: false, k: 0, scoreF: 0, coins: 0, streak: 0, bestStreak: 0, forks: 0, forksRight: 0,
    boost: 0, air: false, falling: false, fallT: 0, vy: 0, spin: 0, slip: 0, camX: 0, camZ: 0, squash: 1, markT: 0, immortal: false,
  });
  for (const s of slabs) s.on = false;
  for (const c of coins) c.on = false;
  for (const e of extras) e.on = false;
  teach.n = 0; teach.last = false;
  showHint("");
  P.life.fill(0); marks.t.fill(-99);
  Object.assign(gen, { ex: 0, ez: T * 1.5, d: 1, k: 0, nextFork: randInt(22, 30), calm: 0, last: "" });
  Object.assign(fork, { on: false, resolved: true, picked: 0 });
  signs.forEach((s) => (s.grp.visible = false));
  pad.visible = false;
  showBanner(false);
  leg(7);
  corner();
  build();
}

function resolveFork(br) {
  fork.resolved = true; fork.picked = br; fork.t = 0;
  S.forks++;
  const ok = br === fork.right;
  const g2 = (ok ? WIDE : NARROW) - T;
  for (const s of slabs) {
    if (!s.on || s.k <= fork.k0 || s.br === 0) continue;
    if (s.br !== br) { if (s.fall < 0) s.fall = 0.25 + (s.k - fork.k0) * 0.05; continue; }
    // grow or shrink toward the outside of the diamond so neighbours still meet
        const a = s.kind === 1 ? null : s.dir; // travel axis of a tile
    const first = slabs.find((q) => q.on && q.br === br && q.k === fork.k0 + 1).dir; // direction of the first leg
    const second = 1 - first;
    const grow = (dx, dz) => { s.tcx += dx * g2 / 2; s.tcz += dz * g2 / 2; if (dx) s.thx += g2 / 2; else s.thz += g2 / 2; };
    if (s.kind === 1) { grow(DX[first], DZ[first]); grow(-DX[second], -DZ[second]); }
    else if (a === first) grow(-DX[second], -DZ[second]);
    else grow(DX[first], DZ[first]);
    if (ok && s.k > fork.k0 + 1) addCoin(s.tcx, s.tcz);
    if (ok && s.kind === 0 && a === first && s.k === fork.k0 + 3) { fork.padOn = true; fork.padX = s.tcx; fork.padZ = s.tcz; pad.rotation.y = first === 0 ? -Math.PI / 2 : 0; }
  }
  signs.forEach((sg, j) => sg.lb.draw(String(fork.answers[j]), { bg: j + 1 === fork.right ? "#10b981" : "#ef4444", fg: "#ffffff", edge: "#ffffff", size: 0.7 }));
  showBanner(false);
  if (!teach.fork) { teach.fork = true; g.save("taughtFork", true); }
  if (hintText === HINT_FORK) showHint("");
  if (ok) {
    S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); S.forksRight++;
    g.toast(S.streak > 1 ? `Right! Streak x${Math.min(5, S.streak + 1)}` : "Right! Wide road", 1300, "good");
    sfx.play("correct");
    S.squash = 1.25;
  } else {
    S.streak = 0;
    g.toast(`It was ${fork.answer}. Narrow road`, 1500, "bad");
    sfx.play("wrong");
    g.shake(6, 0.3);
  }
  g.setHud("Streak", "x" + Math.min(5, S.streak + 1));
}

function finish() {
  const score = Math.round(S.scoreF);
  const bank = g.load("bank", 0) + S.coins;
  g.save("bank", bank);
  showBanner(false);
  showHint("");
  g.over({ score, title: S.k > 150 ? "Smooth driving" : "Off the edge", lines: [`Tiles ${S.k}`, `Coins ${S.coins} (bank ${bank})`, `Right forks ${S.forksRight} of ${S.forks}`] });
}

g.onStart = () => {
  reset();
  g.setScore(0);
  g.setHud("Coins", 0);
  g.setHud("Streak", "x1");
};

function update(dt) {
  if (g.debug.frozen) return; // test hook: hold the world still for a screenshot
  if (S.falling) {
    S.fallT += dt;
    S.vy -= 26 * dt; S.y += S.vy * dt;
    S.x += Math.sin(S.ph) * S.speed * dt; S.z -= Math.cos(S.ph) * S.speed * dt;
    S.spin += dt * 4;
    S.camX = damp(S.camX, S.x, 3, dt); S.camZ = damp(S.camZ, S.z, 3, dt);
    stepFx(dt);
    if (S.fallT > 1.05) finish();
    return;
  }
  S.hold = g.keys.down("Space", "ArrowRight", "KeyD", "ArrowUp", "KeyW", "Enter") || g.pointer.down;
  // first runs: say the one rule until the player has made 3 turns
  if (!teach.turns) {
    if (S.hold !== teach.last) { teach.last = S.hold; if (++teach.n >= 3) { teach.turns = true; g.save("taughtTurns", true); if (hintText === HINT_TURN) showHint(""); } }
    if (!teach.turns && hintText !== HINT_FORK) showHint(HINT_TURN);
  }
  // ----- speed -----
  S.base = Math.min(19.5, 12.5 + S.k * 0.016);
  if (S.boost > 0) S.boost -= dt;
  S.speed = damp(S.speed, S.base * (S.boost > 0 ? 1.3 : 1), S.speed < 6 ? 2.2 : 4, dt);
  const sc = Math.max(S.speed, 6) / 13;
  // ----- one-button steering with drift -----
  const target = S.hold ? Math.PI / 2 : 0;
  const w = TURN * sc * dt;
  S.th += clamp(target - S.th, -w, w);
  const grip = GRIP * sc * (S.boost > 0 ? 1.35 : 1);
  S.ph += (S.th - S.ph) * (1 - Math.exp(-grip * dt));
  S.slip = S.th - S.ph;
  S.x += Math.sin(S.ph) * S.speed * dt;
  S.z -= Math.cos(S.ph) * S.speed * dt;
  S.squash = damp(S.squash, 1, 9, dt);
  if (S.air) {
    S.vy -= 26 * dt; S.y += S.vy * dt;
    if (S.y <= 0 && S.vy < 0) { S.y = 0; S.air = false; S.squash = 0.68; sfx.play("land"); g.shake(5, 0.18); puff(S.x, 0.3, S.z, 8, "#ffffff", 3, 0.3, 0.5); }
  }
  S.camX = damp(S.camX, S.x, 7, dt); S.camZ = damp(S.camZ, S.z, 7, dt);

  // ----- which slab is under the car -----
  let under = null;
  const carU = uOf(S.x, S.z);
  for (const s of slabs) {
    if (!s.on) continue;
    if (s.hold) { if (s.u - carU < 21) { s.hold = false; sfx.play("whoosh"); } }
    else { s.cx = damp(s.cx, s.tcx, 7, dt); s.cz = damp(s.cz, s.tcz, 7, dt); }
    s.hx = damp(s.hx, s.thx, 7, dt); s.hz = damp(s.hz, s.thz, 7, dt);
    if (s.fall >= 0) { s.fall += dt; if (s.fall > 1.6) s.on = false; continue; }
    if (s.u < carU - 11) { s.fall = 0; continue; }
    if (Math.abs(S.x - s.cx) < s.hx + MARGIN && Math.abs(S.z - s.cz) < s.hz + MARGIN && (!under || s.k > under.k)) under = s;
  }
  if (!under && !S.immortal && !S.air) {
    S.falling = true; S.fallT = 0; S.vy = 0;
    sfx.play("whoosh"); sfx.tone(520, 0.7, { slide: 90, type: "sine", vol: 0.4 });
    return;
  }
  if (under) {
    if (under.k > S.k) { S.scoreF += (under.k - S.k) * Math.min(5, S.streak + 1); S.k = under.k; if (S.k % 2 === 0) sfx.play("tick"); }
    if (!fork.resolved && under.br) resolveFork(under.br);
  }
  // ----- speed pads and jump ramps -----
  for (const e of extras) {
    if (!e.on) continue;
    if (uOf(e.x, e.z) < carU - 12) { e.on = false; continue; }
    if (e.used || S.air) continue;
    const along = (S.x - e.x) * DX[e.dir] + (S.z - e.z) * DZ[e.dir], side = Math.abs((S.x - e.x) * DX[1 - e.dir] + (S.z - e.z) * DZ[1 - e.dir]);
    if (side > 2.9 || along < -0.4 || along > 2.2) continue;
    e.used = true;
    if (e.type === "pad") { S.boost = 0.9; S.scoreF += 5; sfx.play("power"); g.toast("Speed pad +5", 800, "gold"); puff(S.x, 0.6, S.z, 10, "#ffe27a", 4, 0.25); }
    else { S.air = true; S.vy = 7.6; S.scoreF += 5; S.squash = 1.3; sfx.play("jump"); g.toast("Jump! +5", 800, "gold"); puff(S.x, 0.4, S.z, 8, "#ffffff", 3, 0.28); }
  }
  // ----- fork: banner, signs, boost pad -----
  if (fork.on) {
    if (!fork.resolved) {
      const near = fork.u - carU < 64;
      showBanner(near, fork.text);
      if (near && !teach.fork && (teach.turns || fork.u - carU < 30)) showHint(HINT_FORK);
    }
    if (fork.resolved) { fork.t += dt; if (fork.t > 6) { fork.on = false; signs.forEach((s) => (s.grp.visible = false)); pad.visible = false; fork.padOn = false; } }
    if (fork.padOn && !fork.padUsed && Math.abs(S.x - fork.padX) < 2.4 && Math.abs(S.z - fork.padZ) < 2.4) {
      fork.padUsed = true; S.boost = 1.0; S.scoreF += 10;
      sfx.play("power"); g.toast("Boost +10", 800, "gold");
      puff(S.x, 0.6, S.z, 12, "#ffe27a", 4, 0.25);
    }
  }
  // ----- coins -----
  for (const c of coins) {
    if (!c.on) continue;
    if (uOf(c.x, c.z) < carU - 12) { c.on = false; continue; }
    const dx = c.x - S.x, dz = c.z - S.z;
    if (dx * dx + dz * dz < 2.9) {
      c.on = false; S.coins++; S.scoreF += 2;
      g.setHud("Coins", S.coins);
      sfx.play("coin");
      puff(c.x, 1, c.z, 4, "#ffe27a", 2.4, 0.14, 0.4);
    }
  }
  // ----- tire smoke and skid marks -----
  const slip = Math.abs(S.slip);
  if (slip > 0.16 && S.speed > 6) {
    const fx = Math.sin(S.th), fz = -Math.cos(S.th), rx = Math.cos(S.th), rz = Math.sin(S.th);
    S.markT -= dt;
    for (const side of [-1, 1]) {
      const wx = S.x - fx * 0.9 + rx * side * 0.82, wz = S.z - fz * 0.9 + rz * side * 0.82;
      const k = marks.next; marks.next = (marks.next + 1) % NM;
      marks.x[k] = wx; marks.z[k] = wz; marks.a[k] = -S.ph; marks.t[k] = g.time;
      if (S.markT <= 0) puff(wx, 0.25, wz, 1, "#ffffff", 0.9, 0.34 + slip * 0.3, 0.7);
    }
    if (S.markT <= 0) { S.markT = 0.035; if (Math.random() < 0.25) sfx.noise(0.06, { freq: 1800, type: "bandpass", vol: 0.12 * slip }); }
  }
  build();
  stepFx(dt);
  g.setScore(Math.round(S.scoreF));
}
function stepFx(dt) {
  for (let i = 0; i < NP; i++) {
    if (P.life[i] <= 0) continue;
    P.life[i] -= dt;
    P.vy[i] += 1.5 * dt;
    P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
  }
}

// ---------- render ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _zero = new THREE.Vector3(0, 0, 0), _up = new THREE.Vector3(0, 1, 0);
const GAP = 0.14;
function render() {
  const t = g.time;
  // road
  _q.identity();
  for (const s of slabs) {
    if (!s.on) { _m.makeScale(0, 0, 0); tileMesh.setMatrixAt(s.i, _m); baseMesh.setMatrixAt(s.i, _m); continue; }
    const rise = clamp((t - s.born) / 0.5, 0, 1);
    let y = -(1 - rise) * (1 - rise) * 7;
    let sc = 1;
    if (s.fall > 0) { y -= s.fall * s.fall * 16; sc = clamp(1 - (s.fall - 0.9) / 0.7, 0, 1); }
    _p.set(s.cx, y - 0.24, s.cz); _s.set((s.hx * 2 - GAP) * sc, 0.48, (s.hz * 2 - GAP) * sc);
    tileMesh.setMatrixAt(s.i, _m.compose(_p, _q, _s));
    _p.set(s.cx, y - 0.95, s.cz); _s.set(Math.max(0.1, s.hx * 2 - 0.9) * sc, 1.0, Math.max(0.1, s.hz * 2 - 0.9) * sc);
    baseMesh.setMatrixAt(s.i, _m.compose(_p, _q, _s));
  }
  tileMesh.instanceMatrix.needsUpdate = baseMesh.instanceMatrix.needsUpdate = true;
  // coins
  let n = 0;
  for (const c of coins) {
    if (!c.on) continue;
    const pop = clamp((t - c.born) / 0.3, 0, 1);
    _p.set(c.x, 0.95 + Math.sin(t * 4 + c.x) * 0.08 + (1 - pop) * 1.5, c.z);
    _e.set(0, t * 4 + c.x + c.z, 0); _q.setFromEuler(_e); _s.set(pop, pop, pop);
    coinMesh.setMatrixAt(n++, _m.compose(_p, _q, _s));
  }
  coinMesh.count = n; coinMesh.instanceMatrix.needsUpdate = true;
  // skid marks and smoke
  for (let i = 0; i < NM; i++) {
    const age = t - marks.t[i];
    const a = age < 1.5 && age >= 0 ? clamp((1.5 - age) / 0.4, 0, 1) : 0;
    _p.set(marks.x[i], 0.012, marks.z[i]); _e.set(0, marks.a[i], 0); _q.setFromEuler(_e); _s.set(a, 1, a);
    markMesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  markMesh.instanceMatrix.needsUpdate = true;
  _q.identity();
  for (let i = 0; i < NP; i++) {
    const f = P.life[i] > 0 ? P.life[i] / P.max[i] : 0;
    const a = f > 0 ? P.size[i] * Math.sin(f * Math.PI) ** 0.6 * (1.5 - f * 0.5) : 0;
    _p.set(P.x[i], P.y[i], P.z[i]); _s.set(a, a, a);
    smoke.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  smoke.instanceMatrix.needsUpdate = true;

  // car
  car.position.set(S.x, S.y, S.z);
  car.rotation.set(0, -S.th, 0);
  const sq = S.squash;
  carTilt.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  if (S.falling) carTilt.rotation.set(S.spin * 0.9, 0, S.spin * 0.6);
  else carTilt.rotation.set(Math.sin(t * 30) * 0.004 * S.speed * 0.1, 0, clamp(S.slip * 0.32, -0.3, 0.3));
  carTilt.position.y = Math.abs(Math.sin(t * 22)) * 0.015 * (S.speed / 13);

  // camera: 3/4 view from behind along the diagonal the road follows
  const cx = S.camX + g.shakeX * 0.03, cz = S.camZ + g.shakeY * 0.03;
  const back = 14 + (S.boost > 0 ? 1.2 : 0);
  camera.position.set(cx - SQ2 * back, 11, cz + SQ2 * back);
  camera.lookAt(cx + SQ2 * 8.5, 0, cz - SQ2 * 8.5);
  sun.position.set(S.camX - 14, 30, S.camZ - 4);
  sun.target.position.set(S.camX + 8, 0, S.camZ - 8);
  sea.position.x = S.camX; sea.position.z = S.camZ;
  seaMat.uniforms.uTime.value = t;
  seaMat.uniforms.uCar.value.set(S.camX, S.camZ);

  // the question banner pulses, faster as the fork gets close
  if (bannerOn) {
    const close = clamp(1 - (fork.u - uOf(S.x, S.z)) / 64, 0, 1);
    banner.style.transform = `translateX(-50%) scale(${(1 + 0.05 * Math.sin(t * (7 + close * 9))).toFixed(3)})`;
  }
  let np = 0, nr = 0;
  for (const e of extras) {
    if (!e.on) continue;
    if (e.type === "pad" && np < 3) { const m = padMeshes[np++]; m.visible = !e.used; m.position.set(e.x, 0.02, e.z); m.rotation.y = e.dir === 0 ? -Math.PI / 2 : 0; }
    else if (e.type === "ramp" && nr < 3) { const m = rampMeshes[nr++]; m.visible = true; m.position.set(e.x, 0, e.z); m.rotation.y = e.dir === 0 ? -Math.PI / 2 : 0; }
  }
  for (; np < 3; np++) padMeshes[np].visible = false;
  for (; nr < 3; nr++) rampMeshes[nr].visible = false;
  // boost pad and signs
  pad.visible = fork.on && fork.padOn && !fork.padUsed;
  if (pad.visible) { pad.position.set(fork.padX, 0.02 + Math.sin(t * 8) * 0.004, fork.padZ); pad.material.opacity = 0.85 + Math.sin(t * 10) * 0.15; }
  for (let i = 0; i < 2; i++) {
    const sg = signs[i];
    if (!sg.grp.visible) continue;
    const dist = Math.hypot(sg.x - camera.position.x, sg.z - camera.position.z);
    let k = clamp(dist / 30, 1, 2.6) * 1.35, lift = 0;
    if (fork.resolved) { lift = fork.t * fork.t * 9; k *= clamp(1 - (fork.t - 0.6) / 0.6, 0, 1); if (k <= 0) sg.grp.visible = false; }
    sg.grp.position.set(sg.x, 2.0 + 0.45 * k + Math.sin(t * 2 + i * 2) * 0.18 + lift, sg.z);
    sg.grp.scale.setScalar(Math.max(0.001, k));
    sg.grp.quaternion.copy(camera.quaternion);
  }

  // scenery that wraps around the car
  const u0 = uOf(S.camX, S.camZ), v0 = vOf(S.camX, S.camZ);
  const pc = 30, bx = Math.floor(S.camX / pc), bz = Math.floor(S.camZ / pc);
  n = 0;
  for (let ix = -5; ix <= 5 && n < 96; ix++) for (let iz = -5; iz <= 5 && n < 96; iz++) {
    const gx = bx + ix, gz = bz + iz, h = hash(gx * 13.1 + gz * 57.7);
    if (h < 0.3) continue;
    const s = 4 + hash(h * 91) * 5;
    _p.set(gx * pc + hash(h * 7) * 22, -29 + hash(h * 3) * 8, gz * pc + hash(h * 5) * 22); _s.set(s * 1.5, s * 0.55, s);
    puffs.setMatrixAt(n++, _m.compose(_p, _q, _s));
  }
  puffs.count = n; puffs.instanceMatrix.needsUpdate = true;
  const place = (mesh, i, u, v, y, s, rot) => {
    _p.set((u + v) * SQ2, y, (v - u) * SQ2); _e.set(0, rot, 0); _q.setFromEuler(_e); _s.set(s, s, s);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  };
  const iu = Math.floor(u0 / 44);
  for (let j = 0; j < 14; j++) {
    const id = iu - 1 + (j >> 1), side = j & 1 ? 1 : -1, h = hash(id * 3.7 + side * 11.3);
    place(islands, j, id * 44 + h * 30, side * (30 + hash(h * 17) * 46), -12 + hash(h * 29) * 15 + Math.sin(t * 0.6 + id) * 0.4, 0.9 + hash(h * 5) * 1.3, h * 6);
  }
  islands.instanceMatrix.needsUpdate = true;
  const ib = Math.floor(u0 / 34);
  for (let j = 0; j < 12; j++) {
    const id = ib - 1 + (j >> 1), side = j & 1 ? 1 : -1, h = hash(id * 5.3 + side * 23.9 + 4);
    place(balloons, j, id * 34 + h * 24 + 10, side * (27 + hash(h * 13) * 30), 3 + hash(h * 31) * 13 + Math.sin(t * 0.8 + id * 2 + side) * 0.7, 1 + hash(h * 7) * 0.9, 0);
  }
  balloons.instanceMatrix.needsUpdate = true;
  void v0; void _zero; void _up; void _one;
  renderer.render(scene, camera);
}

reset();
ready = true;
if (g.menuExtra) paintGarage(g.menuExtra);
g.debug = {
  S, slabs, fork, coins, gen, extras, teach, get hint() { return hintText; },
  /** the input (true = hold) that follows the road from a point p units ahead; at a fork it takes the right or wrong branch */
  want(p = 3, right = true) {
    const tx = S.x + Math.sin(S.th) * p, tz = S.z - Math.cos(S.th) * p;
    let best = null;
    for (const s of slabs) if (s.on && s.fall < 0 && Math.abs(tx - s.cx) < s.hx && Math.abs(tz - s.cz) < s.hz && (!best || s.k > best.k)) best = s;
    if (!best) return S.hold;
    if (best.kind === 2) {
      const br = right ? fork.right : 3 - fork.right;
      return (br === 1 ? best.dir : 1 - best.dir) === 0;
    }
    if (best.kind === 1 && best.hx > T) {
      // a big square: keep going to its middle before turning
      const e = 1 - best.dir, along = (S.x - best.cx) * DX[e] + (S.z - best.cz) * DZ[e];
      if (along < -4.3) return e === 0;
    }
    return best.dir === 0;
  },
  info: () => ({ x: +S.x.toFixed(1), z: +S.z.toFixed(1), k: S.k, speed: +S.speed.toFixed(1), score: Math.round(S.scoreF), coins: S.coins, streak: S.streak, falling: S.falling, fork: fork.on ? { text: fork.text, answers: fork.answers, right: fork.right, resolved: fork.resolved, picked: fork.picked } : null, slabs: slabs.filter((s) => s.on).length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
g.loop(update, render);
