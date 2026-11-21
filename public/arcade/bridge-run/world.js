// Bridge Run world: renderer, sky, water, far shore, the deck and the repeating bridge span.
import * as THREE from "../vendor/three.module.min.js";
import { createGame, math } from "../kit/kit.js";
import { toonRamp, rbox, merge, skyDome } from "./lib.js";

export const hooks = { onMenu: null };
export const g = createGame({
  slug: "bridge-run",
  title: "Bridge Run",
  tagline: "Sprint the sunrise bridge. Run through the right arch.",
  instant: true,
  controls: [{ keys: "← →", does: "Lane" }, { keys: "↑", does: "Jump" }, { keys: "↓", does: "Slide" }],
  onMenu: (el) => hooks.onMenu?.(el),
  aspect: 16 / 9,
  bg: "#f7c2a2",
});

// ---------- constants ----------
export const LANE = 2.2;
export const SPAN = 96; // tower spacing
export const HORIZON = 170; // how far ahead rows are laid
export const COL = {
  fog: "#f6c3a6", deck: "#6d6890", shoulder: "#857fa6", dash: "#fff4d6", edge: "#fbbf24",
  tower: "#2f6fed", towerDark: "#1e4fc4", cream: "#fff1d6", pier: "#9a94bd", cable: "#fff7e6",
  red: "#ef4444", white: "#ffffff", navy: "#1e3a8a", amber: "#f59e0b", wood: "#d9964a", woodDark: "#a8672c",
  orange: "#fb7a2a", yellow: "#fcd34d", tire: "#2b2f4a", glass: "#8fd3ff",
};

// ---------- renderer ----------
let W = 960, H = 540, DPR = 1;
export let renderer = null;
export const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 2400);
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
export const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COL.fog, 55, 215);
export const ramp = toonRamp([120, 185, 255]);
export const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: ramp, ...o });
export const vtoon = toon({ vertexColors: true });

// ---------- sky, sun, light ----------
export const SUN = new THREE.Vector3(0.34, 0.15, -1).normalize();
scene.add(skyDome({ top: "#3f6ee0", mid: "#f6a5b6", low: "#ffd38f", sun: "#ffb35a", sunDir: [SUN.x, SUN.y, SUN.z], sunSize: 0.9988, glow: 7 }));
scene.add(new THREE.HemisphereLight("#ffe1cf", "#6f7fd8", 1.25));
export const sunLight = new THREE.DirectionalLight("#fff0da", 2.3);
sunLight.position.set(9, 15, -13);
sunLight.target.position.set(0, 0, -9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
Object.assign(sunLight.shadow.camera, { left: -13, right: 13, top: 26, bottom: -22, near: 1, far: 70 });
sunLight.shadow.bias = -0.0005;
sunLight.shadow.normalBias = 0.05;
sunLight.shadow.radius = 3;
scene.add(sunLight, sunLight.target);

// ---------- water ----------
export const waterMat = new THREE.ShaderMaterial({
  fog: false,
  uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, deep: { value: new THREE.Color("#3565b8") }, light: { value: new THREE.Color("#6ea5ea") }, glint: { value: new THREE.Color("#ffe3ad") }, haze: { value: new THREE.Color("#f9c5a0") }, sunXZ: { value: new THREE.Vector2(SUN.x, SUN.z).normalize() } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `varying vec3 vW; uniform float uTime, uScroll; uniform vec3 deep, light, glint, haze; uniform vec2 sunXZ;
    void main(){
      vec2 p = vec2(vW.x, vW.z - uScroll);
      float d = length(vW.xz);
      float w1 = sin(p.x * 0.09 + sin(p.y * 0.05 + uTime * 0.5) * 2.0) * sin(p.y * 0.16 + uTime * 0.9);
      float w2 = sin(p.x * 0.31 - uTime * 0.7) * sin(p.y * 0.47 + p.x * 0.1 + uTime * 1.3);
      float near = 1.0 - smoothstep(120.0, 520.0, d);
      vec3 c = mix(deep, light, smoothstep(40.0, 600.0, d) * 0.75 + 0.12);
      c = mix(c, light, smoothstep(0.55, 0.62, w1) * 0.35 * near);
      float a = dot(normalize(vW.xz + vec2(0.0001)), sunXZ);
      float path = smoothstep(0.93, 0.999, a);
      c = mix(c, glint, path * (0.25 + 0.6 * smoothstep(0.1, 0.25, w2 * (0.6 + near))));
      c = mix(c, haze, smoothstep(350.0, 1050.0, d));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -42;
scene.add(water);

// ---------- far shore: city, hills, clouds ----------
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const r = math.rng(77);
  const R = (a, b) => a + r() * (b - a);
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: false }), 150);
  let n = 0;
  for (let layer = 0; layer < 2; layer++) {
    for (let x = -640; x < 640 && n < 146; x += R(12, 26)) {
      const center = 1 - Math.min(1, Math.abs(x - 120) / 520);
      const h = R(18, 46) + center * center * R(30, 150) * (layer ? 0.7 : 1);
      const w = R(11, 24);
      P.set(x, -42 + h / 2, -980 - layer * 60); Sc.set(w, h, 20);
      city.setMatrixAt(n, m4.compose(P, q, Sc));
      c.set(layer ? "#e0a3bf" : "#b587c4").lerp(new THREE.Color("#f3b9ae"), R(0, 0.25));
      city.setColorAt(n++, c);
    }
  }
  // a few spires so the skyline has a shape of its own
  for (const [x, h] of [[90, 215], [160, 170], [-40, 150], [260, 130]]) {
    P.set(x, -42 + h / 2, -990); Sc.set(9, h, 9);
    city.setMatrixAt(n, m4.compose(P, q, Sc)); city.setColorAt(n++, c.set("#a678bf"));
  }
  city.count = n;
  city.frustumCulled = false;
  scene.add(city);
  const hills = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 10), new THREE.MeshBasicMaterial({ fog: false }), 14);
  for (let i = 0; i < 14; i++) {
    const x = -900 + i * 140 + R(-30, 30);
    P.set(x, -44, -1080); Sc.set(R(120, 210), R(40, 95) * (Math.abs(x) > 380 ? 1.3 : 0.5), 40);
    hills.setMatrixAt(i, m4.compose(P, q, Sc)); hills.setColorAt(i, c.set(i % 2 ? "#c79ad0" : "#d7a6c9"));
  }
  hills.frustumCulled = false;
  scene.add(hills);
  const shore = new THREE.Mesh(new THREE.BoxGeometry(2600, 5, 60), new THREE.MeshBasicMaterial({ color: "#b98fc6", fog: false }));
  shore.position.set(0, -41, -1000);
  scene.add(shore);
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ fog: false }), 64);
  n = 0;
  for (let i = 0; i < 15; i++) {
    const a = R(-1.25, 1.25), dist = R(520, 800), y = R(70, 260), s = R(26, 54);
    const cx = Math.sin(a) * dist, cz = -Math.cos(a) * dist;
    const tint = c.set("#fff3ea").lerp(new THREE.Color("#ffb7a8"), R(0.1, 0.55)).clone();
    for (let k = 0; k < 4 && n < 64; k++) {
      P.set(cx + (k - 1.5) * s * 0.85, y + (k % 2 ? s * 0.16 : 0), cz + R(-10, 10));
      Sc.set(s * R(0.8, 1.15), s * R(0.3, 0.42), s * 0.6);
      clouds.setMatrixAt(n, m4.compose(P, q, Sc)); clouds.setColorAt(n++, tint);
    }
  }
  clouds.count = n;
  clouds.frustumCulled = false;
  scene.add(clouds);
}

// ---------- deck (static mesh, scrolling texture) ----------
export const deckTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  const u = 512 / 8.8; // px per unit, tile is 8.8 x 8.8
  x.fillStyle = COL.deck; x.fillRect(0, 0, 512, 512);
  x.fillStyle = COL.shoulder; x.fillRect(0, 0, (4.4 - 3.45) * u, 512); x.fillRect(512 - (4.4 - 3.45) * u, 0, 100, 512);
  const r = math.rng(5);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(20,20,60,0.07)"; x.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 3); }
  x.fillStyle = "rgba(30,30,80,0.22)"; x.fillRect(0, 0, 512, 5);
  x.fillStyle = COL.edge;
  for (const s of [-1, 1]) x.fillRect(256 + s * 3.4 * u - 4, 0, 8, 512);
  x.fillStyle = COL.dash;
  for (const s of [-1, 1]) { x.beginPath(); x.roundRect(256 + s * 1.1 * u - 5, 70, 10, 220, 5); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISO;
  t.repeat.set(1, 380 / 8.8);
  return t;
})();
{
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 380), toon({ map: deckTex }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0, -160);
  deck.receiveShadow = true;
  scene.add(deck);
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push({ g: new THREE.BoxGeometry(0.55, 0.3, 380), c: COL.cream, p: [s * 4.62, 0.15, -160] });
    parts.push({ g: new THREE.BoxGeometry(0.1, 0.1, 380), c: COL.white, p: [s * 4.7, 1.05, -160] });
    parts.push({ g: new THREE.BoxGeometry(0.07, 0.07, 380), c: COL.white, p: [s * 4.7, 0.68, -160] });
  }
  parts.push({ g: new THREE.BoxGeometry(9.9, 1.3, 380), c: COL.towerDark, p: [0, -0.68, -160] });
  const sides = new THREE.Mesh(merge(parts), vtoon);
  sides.receiveShadow = true;
  scene.add(sides);
}

// ---------- repeating span: tower, cables, suspenders, posts, lamps ----------
const cableY = (z) => 4.2 + 25 * (1 - Math.abs(z + SPAN / 2) / (SPAN / 2)) ** 2;
export const spans = [];
{
  const parts = [], glow = [];
  for (const s of [-1, 1]) {
    const x = s * 5.75;
    // pylon and pier
    parts.push({ g: rbox(1.5, 33, 2.1, 0.3), c: COL.tower, p: [x, 14.5, -SPAN / 2] });
    parts.push({ g: rbox(1.9, 1.0, 2.5, 0.25), c: COL.cream, p: [x, 31.3, -SPAN / 2] });
    parts.push({ g: new THREE.SphereGeometry(0.55, 12, 8), c: COL.amber, p: [x, 32.3, -SPAN / 2] });
    parts.push({ g: rbox(2.6, 42, 3.4, 0.3), c: COL.pier, p: [x, -22.5, -SPAN / 2] });
    // main cable
    const pts = [];
    for (let z = 0; z >= -SPAN; z -= 4) pts.push(new THREE.Vector3(x, cableY(z), z));
    parts.push({ g: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.17, 6), c: COL.cable });
    // suspenders
    for (let z = -3; z > -SPAN; z -= 6) {
      if (Math.abs(z + SPAN / 2) < 2) continue;
      const top = cableY(z);
      parts.push({ g: new THREE.CylinderGeometry(0.045, 0.045, top - 1, 5), c: COL.cable, p: [x, (top + 1) / 2, z] });
    }
    // rail posts
    for (let z = -2; z > -SPAN; z -= 4) parts.push({ g: new THREE.BoxGeometry(0.16, 1.1, 0.16), c: COL.tower, p: [s * 4.7, 0.6, z] });
    // lamp posts
    for (let z = -12; z > -SPAN; z -= 24) {
      parts.push({ g: new THREE.CylinderGeometry(0.07, 0.1, 4.2, 8), c: COL.navy, p: [s * 4.95, 2.1, z] });
      parts.push({ g: new THREE.TorusGeometry(0.6, 0.06, 6, 10, Math.PI / 2), c: COL.navy, p: [s * 4.35, 4.2, z], r: [0, 0, s > 0 ? 0 : Math.PI / 2] });
      parts.push({ g: new THREE.ConeGeometry(0.34, 0.3, 10), c: COL.navy, p: [s * 4.35, 4.74, z] });
      glow.push({ g: new THREE.SphereGeometry(0.2, 10, 8), c: "#fff3b8", p: [s * 4.35, 4.52, z] });
    }
  }
  // tower cross beams
  for (const [y, h] of [[10.5, 1.5], [21, 1.2], [29.2, 1.6]]) parts.push({ g: rbox(11.2, h, 1.5, 0.25), c: y > 25 ? COL.tower : COL.towerDark, p: [0, y, -SPAN / 2] });
  parts.push({ g: rbox(3.2, 3.2, 0.5, 0.2), c: COL.cream, p: [0, 25.2, -SPAN / 2], r: [0, 0, Math.PI / 4] });
  parts.push({ g: rbox(12.6, 1.6, 2.8, 0.2), c: COL.pier, p: [0, -2.2, -SPAN / 2] });
  for (const s of [-1, 1]) glow.push({ g: new THREE.SphereGeometry(0.3, 10, 8), c: "#ffd27a", p: [s * 5.75, 33.1, -SPAN / 2] });
  const geo = merge(parts), glowGeo = merge(glow);
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  for (let i = 0; i < 4; i++) {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(geo, vtoon);
    m.castShadow = true;
    grp.add(m, new THREE.Mesh(glowGeo, glowMat));
    scene.add(grp);
    spans.push(grp);
  }
}
export { THREE };
