// Slope Rider 3D parts: the looks catalog, small mesh helpers, the six vehicles, wheels, hats, decals and the particle pool.
import * as THREE from "../vendor/three.module.min.js";
import { buildArchie3D } from "../kit/kit.js";
import { VEH } from "./sim.js";
export { THREE };

const TAU = Math.PI * 2;

// ---------- what you can earn ----------
export const BODIES = [{ id: "buggy", name: "Buggy", stars: 0 }, { id: "mini", name: "Mini", stars: 6 }, { id: "bus", name: "Long Bus", stars: 14 }, { id: "monster", name: "Monster Truck", stars: 24 }, { id: "penny", name: "Big Wheel", stars: 36 }, { id: "rocket", name: "Rocket Car", stars: 50 }];
export const PAINTS = [
  { id: "sunny", name: "Sunny", c: "#f59e0b", need: 0 }, { id: "blueberry", name: "Blueberry", c: "#3b82f6", need: 20 }, { id: "lime", name: "Lime", c: "#84cc16", need: 70 },
  { id: "mint", name: "Mint", c: "#10b981", need: 110 }, { id: "cherry", name: "Cherry", c: "#ef4444", need: 260 }, { id: "bubblegum", name: "Bubblegum", c: "#f472b6", need: 330 },
  { id: "grape", name: "Grape", c: "#8b5cf6", need: 480 }, { id: "teal", name: "Teal", c: "#14b8a6", need: 560 }, { id: "snow", name: "Snow", c: "#f1f5f9", need: 700 },
  { id: "midnight", name: "Midnight", c: "#1e293b", need: 840 }, { id: "gold", name: "Gold", c: "#fde047", need: 950, metal: 0.35 }, { id: "chrome", name: "Chrome", c: "#cbd5e1", need: 1250, metal: 0.45 },
];
export const WHEELS = [{ id: "classic", name: "Classic", c: "#e2e8f0", need: 0 }, { id: "chunky", name: "Chunky", c: "#fbbf24", need: 60 }, { id: "cog", name: "Cog", c: "#f59e0b", need: 200 }, { id: "star", name: "Star rims", c: "#1e3a8a", need: 360 }, { id: "donut", name: "Donut", c: "#f9a8d4", need: 760 }, { id: "neon", name: "Neon", c: "#22d3ee", need: 1050 }];
export const HATS = [{ id: "none", name: "No hat", c: "#e2e8f0", need: 0 }, { id: "cap", name: "Cap", c: "#ef4444", need: 170 }, { id: "tophat", name: "Top hat", c: "#1f2937", need: 420 }, { id: "cone", name: "Cone", c: "#fb923c", need: 600 }, { id: "viking", name: "Viking", c: "#94a3b8", need: 880 }, { id: "crown", name: "Crown", c: "#fde047", need: 1150 }, { id: "wizard", name: "Wizard", c: "#7c3aed", need: 1300 }, { id: "prop", name: "Propeller", c: "#10b981", need: 1400 }];
export const TRAILS = [
  { id: "dust", name: "Dust", need: 0, colors: null, size: 0.14, life: 0.4, g: 2, grow: 0.3 },
  { id: "sparks", name: "Sparks", need: 40, colors: ["#fde047", "#fb923c", "#ffffff"], size: 0.07, life: 0.45, g: 9, sq: true, glow: true },
  { id: "bubbles", name: "Bubbles", need: 150, colors: ["#7dd3fc", "#e0f2fe", "#a5f3fc"], size: 0.13, life: 0.9, g: -2.5, grow: 0.1 },
  { id: "snow", name: "Snowflakes", need: 300, colors: ["#ffffff", "#dbeafe"], size: 0.09, life: 0.9, g: 1.5, sq: true },
  { id: "fire", name: "Fire", need: 520, colors: ["#ef4444", "#f97316", "#fde047"], size: 0.16, life: 0.4, g: -4, grow: -0.25, glow: true },
  { id: "rainbow", name: "Rainbow", need: 820, colors: ["#ef4444", "#f59e0b", "#fde047", "#22c55e", "#3b82f6", "#a855f7"], size: 0.12, life: 0.8, g: 0, sq: true, glow: true },
  { id: "stars", name: "Gold dust", need: 1100, colors: ["#fde047", "#fef9c3", "#f59e0b"], size: 0.08, life: 1.0, g: 0.6, sq: true, glow: true },
];
export const DECALS = [{ id: "none", name: "No decal", need: 0 }, { id: "stripe", name: "Stripes", need: 30 }, { id: "seven", name: "Lucky 7", need: 90 }, { id: "stars", name: "Stars", need: 230 }, { id: "bolt", name: "Bolt", need: 400 }, { id: "flames", name: "Flames", need: 660 }, { id: "checker", name: "Checker", need: 1000 }];
export const byId = (list, id) => list.find((p) => p.id === id) || list[0];

// ---------- mesh helpers ----------
export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 18);
export const SPH = new THREE.SphereGeometry(1, 14, 10);
export const CONE = new THREE.ConeGeometry(1, 1, 14);
const MATS = new Map();
/** A cached material. Plain ones (no options) are merged into one vertex-colored mesh by bake(). */
export function M(color, o) {
  const k = color + (o ? JSON.stringify(o) : "");
  let m = MATS.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...(o || {}) }); m.userData.plain = !o; MATS.set(k, m); }
  return m;
}
export const BAKED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Vector3();
/** Shorthand shape makers that add scaled unit meshes to a parent. */
export function parts(root) {
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); root.add(m); return m; };
  return {
    add,
    box: (w, h, d, mat, x, y, z, rz = 0) => { const m = add(BOX, mat, x, y, z); m.scale.set(w, h, d); m.rotation.z = rz; return m; },
    cyl: (r, len, mat, x, y, z, axis = "z") => { const m = add(CYL, mat, x, y, z); m.scale.set(r, len, r); if (axis === "z") m.rotation.x = Math.PI / 2; else if (axis === "x") m.rotation.z = Math.PI / 2; return m; },
    sph: (r, mat, x, y, z) => { const m = add(SPH, mat, x, y, z); m.scale.setScalar(r); return m; },
    cone: (r, h, mat, x, y, z, rz = 0) => { const m = add(CONE, mat, x, y, z); m.scale.set(r, h, r); m.rotation.z = rz; return m; },
    bar: (a, b, r, mat) => { _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _v.length(), m = add(CYL, mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); m.scale.set(r, len, r); m.quaternion.setFromUnitVectors(_up, _v.normalize()); return m; },
  };
}
/**
 * Merge every plain-material mesh under root into one vertex-colored mesh. Things marked userData.keep (and special materials)
 * stay as they are. Returns a new Group in root's own space.
 */
export function bake(root, o = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), pos = [], nor = [], col = [], keep = [];
  const walk = (obj) => {
    if (obj.userData.keep) { keep.push(obj); return; }
    if (obj.isMesh) {
      if (!obj.material.userData.plain) { keep.push(obj); return; }
      const ge = obj.geometry, p = ge.attributes.position, nn = ge.attributes.normal, ix = ge.index, c = obj.material.color;
      _m.multiplyMatrices(inv, obj.matrixWorld); _nm.getNormalMatrix(_m);
      const n = ix ? ix.count : p.count;
      for (let i = 0; i < n; i++) {
        const k = ix ? ix.getX(i) : i;
        _v.fromBufferAttribute(p, k).applyMatrix4(_m); pos.push(_v.x, _v.y, _v.z);
        _v.fromBufferAttribute(nn, k).applyMatrix3(_nm).normalize(); nor.push(_v.x, _v.y, _v.z);
        col.push(c.r, c.g, c.b);
      }
    }
    for (const ch of obj.children) walk(ch);
  };
  walk(root);
  const out = new THREE.Group();
  if (pos.length) {
    const ge = new THREE.BufferGeometry();
    ge.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    ge.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    ge.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    ge.userData.own = true;
    const mesh = new THREE.Mesh(ge, o.material || BAKED);
    mesh.castShadow = o.cast !== false; mesh.receiveShadow = !!o.receive;
    out.add(mesh); out.userData.baked = mesh;
  }
  for (const k of keep) { _m.multiplyMatrices(inv, k.matrixWorld); out.add(k); _m.decompose(k.position, k.quaternion, k.scale); k.traverse((q) => { if (q.isMesh) q.castShadow = o.cast !== false; }); }
  return out;
}
/** Free the GPU memory of everything this module (or the view) made for one object tree. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry?.userData.own) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m.userData.own) { if (m.map?.userData.own) m.map.dispose(); m.dispose(); }
    if (o.isInstancedMesh) o.dispose();
  });
  root.removeFromParent();
}
export function extrude(pts, hw, bevel = 0.06) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const ge = new THREE.ExtrudeGeometry(s, { depth: 2 * (hw - bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 2, curveSegments: 1 });
  ge.translate(0, 0, -(hw - bevel));
  ge.userData.own = true;
  return ge;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString(); };

// ---------- decals (canvas textures) ----------
const DECAL_TEX = new Map();
export function decalCanvas(id) {
  const cv = document.createElement("canvas"); cv.width = 384; cv.height = 128;
  const x = cv.getContext("2d"), W = 384, H = 128;
  x.lineJoin = "round"; x.lineCap = "round";
  const star = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const q = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * 0.628; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); } x.closePath(); x.fill(); x.stroke(); };
  if (id === "stripe") { x.fillStyle = "#ffffff"; x.fillRect(0, 34, W, 22); x.fillRect(0, 70, W, 22); x.fillStyle = "#1e3a8a"; x.fillRect(0, 58, W, 10); }
  else if (id === "seven") { x.fillStyle = "#ffffff"; x.strokeStyle = "#1e3a8a"; x.lineWidth = 8; x.beginPath(); x.arc(W / 2, H / 2, 54, 0, TAU); x.fill(); x.stroke(); x.fillStyle = "#1e3a8a"; x.font = "900 88px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("7", W / 2, H / 2 + 6); }
  else if (id === "stars") { x.fillStyle = "#ffffff"; x.strokeStyle = "#1e3a8a"; x.lineWidth = 6; star(80, 70, 40); star(192, 58, 52); star(304, 70, 40); }
  else if (id === "bolt") { x.fillStyle = "#fde047"; x.strokeStyle = "#1e3a8a"; x.lineWidth = 8; x.beginPath(); [[40, 30], [200, 18], [160, 58], [344, 44], [120, 112], [170, 70], [30, 82]].forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); x.fill(); x.stroke(); }
  else if (id === "flames") {
    for (const [col, k] of [["#ef4444", 1], ["#fb923c", 0.72], ["#fde047", 0.42]]) {
      x.fillStyle = col; x.beginPath(); x.moveTo(W, 8); x.lineTo(W, H - 8);
      for (let i = 0; i <= 4; i++) { const y = H - 8 - (i * (H - 16)) / 4; x.quadraticCurveTo(W - 60 * k, y + 14, W - (300 - (i % 2) * 110) * k, y - 4); x.quadraticCurveTo(W - 90 * k, y - 8, W - 50 * k, y - (H - 16) / 4); }
      x.closePath(); x.fill();
    }
  } else if (id === "checker") { for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) { x.fillStyle = (i + j) % 2 ? "#0f172a" : "#ffffff"; x.fillRect(i * 32, 16 + j * 32, 32, 32); } }
  return cv;
}
function decalTex(id, flip) {
  const k = id + (flip ? "f" : "");
  let t = DECAL_TEX.get(k);
  if (!t) { t = new THREE.CanvasTexture(decalCanvas(id)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (flip) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; } DECAL_TEX.set(k, t); }
  return t;
}

// ---------- wheels ----------
const TIRE = "#1f2937", TREAD = "#3b4656";
function buildWheel(r, width, style, spoked) {
  const root = new THREE.Group(), P = parts(root), acc = byId(WHEELS, style).c, zf = width / 2 + 0.012;
  const ring = (n, rad, fn) => { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; fn(Math.cos(a) * rad, Math.sin(a) * rad, a, i); } };
  if (spoked) {
    // the tall thin wheel of the Big Wheel: open spokes so the driver shows through
    const t = new THREE.Mesh(new THREE.TorusGeometry(r - 0.07, 0.07, 8, 30), M(TIRE)); root.add(t);
    const t2 = new THREE.Mesh(new THREE.TorusGeometry(r - 0.17, 0.035, 6, 30), M(acc)); root.add(t2);
    ring(22, r - 0.005, (x, y, a) => P.box(0.05, 0.1, 0.16, M(TREAD), x, y, 0, a));
    ring(10, 0, (x, y, a) => P.bar([0, 0, 0], [Math.cos(a) * (r - 0.14), Math.sin(a) * (r - 0.14), 0], 0.022, M(acc)));
    P.cyl(0.13, width + 0.06, M(style === "neon" ? "#0f172a" : acc), 0, 0, 0);
    P.cyl(0.06, width + 0.1, M("#475569"), 0, 0, 0);
    if (style === "neon") { const n = new THREE.Mesh(new THREE.TorusGeometry(r - 0.17, 0.04, 6, 30), M("#22d3ee", { emissive: "#22d3ee", emissiveIntensity: 1.6 })); root.add(n); }
    return bake(root);
  }
  const donut = style === "donut", fat = style === "chunky";
  P.cyl(r, width * (fat ? 1.18 : 1), M(donut ? "#d9a05b" : TIRE), 0, 0, 0);
  if (donut) {
    P.cyl(r * 0.94, 0.05, M("#f9a8d4"), 0, 0, zf);
    P.cyl(r * 0.3, 0.07, M("#3b2a1a"), 0, 0, zf);
    ring(9, r * 0.62, (x, y, a, i) => P.box(0.13 * r * 2, 0.045 * r * 2, 0.02, M(["#ffffff", "#fde047", "#60a5fa", "#34d399"][i % 4]), x, y, zf + 0.03, a + i * 1.3));
    ring(6, r, (x, y, a, i) => P.box(0.04, 0.12, width * 0.5, M(["#f9a8d4", "#ffffff"][i % 2]), x, y, 0, a));
    return bake(root);
  }
  const n = fat ? 12 : 16, bh = fat ? 0.1 : 0.045;
  ring(n, r + bh * 0.3, (x, y, a) => P.box(bh, ((TAU * r) / n) * 0.52, width * (fat ? 1.22 : 1.02), M(TREAD), x, y, 0, a));
  if (style === "classic") {
    P.cyl(r * 0.64, 0.04, M("#e2e8f0"), 0, 0, zf);
    ring(5, r * 0.3, (x, y, a) => P.box(r * 0.56, r * 0.13, 0.03, M("#64748b"), x, y, zf + 0.025, a));
    P.cyl(r * 0.17, 0.08, M("#64748b"), 0, 0, zf + 0.02);
  } else if (fat) {
    P.cyl(r * 0.6, 0.05, M("#fbbf24"), 0, 0, zf + (width * 0.09));
    P.cyl(r * 0.28, 0.1, M("#334155"), 0, 0, zf + (width * 0.09) + 0.02);
    ring(6, r * 0.44, (x, y) => P.cyl(r * 0.06, 0.09, M("#92400e"), x, y, zf + (width * 0.09) + 0.02));
  } else if (style === "cog") {
    P.cyl(r * 0.66, 0.04, M("#334155"), 0, 0, zf);
    P.cyl(r * 0.46, 0.07, M("#f59e0b"), 0, 0, zf + 0.02);
    ring(8, r * 0.52, (x, y, a) => P.box(r * 0.2, r * 0.17, 0.07, M("#f59e0b"), x, y, zf + 0.02, a));
    P.cyl(r * 0.16, 0.1, M("#334155"), 0, 0, zf + 0.03);
  } else if (style === "star") {
    P.cyl(r * 0.66, 0.04, M("#1e3a8a"), 0, 0, zf);
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const q = i % 2 ? r * 0.25 : r * 0.58, a = Math.PI / 2 + i * 0.628; i ? s.lineTo(Math.cos(a) * q, Math.sin(a) * q) : s.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), M("#fde047")); st.position.z = zf + 0.01; root.add(st);
  } else if (style === "neon") {
    P.cyl(r * 0.66, 0.04, M("#0f172a"), 0, 0, zf);
    const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.46, r * 0.07, 6, 24), M("#22d3ee", { emissive: "#22d3ee", emissiveIntensity: 1.6 })); t.position.z = zf + 0.03; root.add(t);
    P.cyl(r * 0.14, 0.08, M("#22d3ee", { emissive: "#22d3ee", emissiveIntensity: 1.6 }), 0, 0, zf + 0.02);
  }
  return bake(root);
}

// ---------- hats (in Archie's own space: he is 1 tall, facing +z) ----------
function buildHat(id) {
  if (id === "none") return null;
  const root = new THREE.Group(), P = parts(root);
  let spin = null;
  const half = (r, col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, TAU, 0, Math.PI / 2), M(col)); root.add(m); return m; };
  if (id === "cap") { half(0.3, "#ef4444").scale.set(1, 0.8, 0.72); P.box(0.4, 0.04, 0.3, M("#b91c1c"), 0, 0.02, 0.3); P.sph(0.04, M("#ffffff"), 0, 0.25, 0); }
  else if (id === "cone") { P.cone(0.24, 0.6, M("#fb923c"), 0, 0.3, 0); P.cyl(0.165, 0.09, M("#ffffff"), 0, 0.27, 0, "y"); P.box(0.56, 0.04, 0.4, M("#ea580c"), 0, 0.01, 0); }
  else if (id === "crown") { P.cyl(0.26, 0.18, M("#fde047"), 0, 0.09, 0, "y"); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; P.cone(0.075, 0.2, M("#fde047"), Math.cos(a) * 0.2, 0.27, Math.sin(a) * 0.15); P.sph(0.035, M(i % 2 ? "#ef4444" : "#3b82f6"), Math.cos(a) * 0.26, 0.09, Math.sin(a) * 0.2); } }
  else if (id === "tophat") { P.cyl(0.36, 0.04, M("#1f2937"), 0, 0.02, 0, "y"); P.cyl(0.23, 0.42, M("#1f2937"), 0, 0.23, 0, "y"); P.cyl(0.235, 0.09, M("#ef4444"), 0, 0.1, 0, "y"); }
  else if (id === "viking") { half(0.3, "#94a3b8").scale.set(1, 0.85, 0.72); P.cyl(0.305, 0.06, M("#b45309"), 0, 0.03, 0, "y").scale.z = 0.22; for (const s of [-1, 1]) { P.cone(0.07, 0.3, M("#fef3c7"), s * 0.34, 0.24, 0, -s * 0.5); P.sph(0.075, M("#fef3c7"), s * 0.27, 0.12, 0); } }
  else if (id === "wizard") { P.cone(0.26, 0.72, M("#7c3aed"), 0, 0.38, 0, 0.12); P.cyl(0.4, 0.04, M("#6d28d9"), 0, 0.02, 0, "y"); for (const [x, y, z] of [[0.12, 0.2, 0.17], [-0.1, 0.36, 0.13], [0.03, 0.5, 0.08]]) P.sph(0.04, M("#fde047", { emissive: "#fde047", emissiveIntensity: 0.8 }), x, y, z); }
  else if (id === "prop") {
    half(0.28, "#10b981").scale.set(1, 0.8, 0.72); P.cyl(0.02, 0.16, M("#334155"), 0, 0.28, 0, "y");
    spin = new THREE.Group(); spin.position.y = 0.37; spin.userData.keep = true;
    const sp = parts(spin); sp.box(0.62, 0.025, 0.11, M("#fde047"), 0, 0, 0); sp.sph(0.045, M("#ef4444"), 0, 0, 0);
    root.add(spin);
  }
  const out = bake(root);
  out.userData.spin = spin;
  return out;
}

// ---------- the vehicles ----------
// hw: half width of the body, zw: wheel offset from the middle, ww: wheel width, ar: Archie x, y, size, dec: decal x, y, w, h (hull space)
export const SPEC = {
  buggy: { hw: 0.6, zw: 0.8, ww: 0.34, ar: [-0.2, 0.27, 0.8], dec: [-0.36, 0.04, 1.3, 0.44], len: 2.6 },
  mini: { hw: 0.5, zw: 0.66, ww: 0.28, ar: [-0.1, 0.25, 0.72], dec: [-0.22, 0.05, 0.8, 0.38], len: 1.7 },
  bus: { hw: 0.72, zw: 0.62, ww: 0.34, ar: [1.98, 0.2, 0.62], dec: [-0.7, -0.06, 3.4, 0.42], len: 5.6 },
  monster: { hw: 0.62, zw: 1.0, ww: 0.58, ar: [-0.15, 0.4, 0.8], dec: [-0.35, 0.12, 1.4, 0.5], len: 3.2 },
  penny: { hw: 0.46, zw: 0.74, ww: 0.16, ar: [-0.1, 0.27, 0.8], dec: [-0.2, 0.05, 1.1, 0.4], len: 2.8 },
  rocket: { hw: 0.55, zw: 0.74, ww: 0.34, ar: [-0.45, 0.24, 0.76], dec: [-0.52, 0.045, 1.35, 0.38], len: 3.6 },
};
const GLASS = () => M("#cfeaff", { transparent: true, opacity: 0.5, roughness: 0.1 });
const LAMP = () => M("#fef9c3", { emissive: "#fde047", emissiveIntensity: 1.1 });
const TAIL = () => M("#ef4444", { emissive: "#ef4444", emissiveIntensity: 0.7 });

/**
 * One vehicle with the player's look. Returns { hull, wheels, archie, spin, flame, key }.
 * hull is in hull space (the same numbers as VEH[key].hull); wheels are separate so they can follow the physics.
 */
export function buildCar(key, look = {}, o = {}) {
  const sp = VEH[key], S = SPEC[key], pd = byId(PAINTS, look.paint);
  const paint = new THREE.MeshStandardMaterial({ color: pd.c, roughness: pd.metal ? 0.25 : 0.42, metalness: pd.metal || 0.08 });
  paint.userData.own = true;
  const dark = shade(pd.c, 0.62), root = new THREE.Group(), P = parts(root), hw = S.hw;
  const x0 = sp.hull[0][0], x1 = sp.hull[1][0], yb = sp.hull[0][1];
  let flame = null;
  if (key === "bus") {
    P.add(extrude([[-2.7, -0.3], [2.7, -0.3], [2.7, 0.2], [-2.7, 0.2]], hw, 0.05), paint);
    P.add(extrude([[-2.7, 0.2], [1.42, 0.2], [1.42, 0.86], [-2.7, 0.86]], hw, 0.05), paint);
    P.box(5.46, 0.08, hw * 2 + 0.03, M("#ffffff"), 0, 0.16, 0);
    P.box(5.5, 0.1, hw * 2 + 0.08, M("#f8fafc"), 0, 0.91, 0);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) P.box(0.78, 0.4, 0.03, M("#7dd3fc"), -2.2 + i * 0.95, 0.55, s * (hw + 0.004));
    for (const s of [-1, 1]) { P.box(0.1, 0.68, 0.1, paint, 2.63, 0.54, s * (hw - 0.06)); P.box(0.34, 0.3, 0.05, M("#334155"), 1.7, -0.05, s * (hw + 0.004)); }
    P.box(0.04, 0.6, hw * 2 - 0.2, GLASS(), 2.66, 0.54, 0);
    P.box(0.5, 0.16, 0.9, M("#fde047"), 2.3, 1.02, 0);
    P.box(0.12, 0.16, hw * 2 + 0.06, M("#64748b"), 2.74, -0.24, 0); P.box(0.12, 0.16, hw * 2 + 0.06, M("#64748b"), -2.74, -0.24, 0);
    P.cyl(0.05, 0.5, M("#334155"), 2.1, 0.45, 0.1, "y"); const sw = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 6, 14), M("#1f2937")); sw.position.set(2.2, 0.7, 0.1); sw.rotation.y = Math.PI / 2; sw.rotation.z = 0.5; root.add(sw);
    for (const s of [-1, 1]) { P.sph(0.11, LAMP(), 2.7, -0.06, s * 0.45); P.box(0.06, 0.16, 0.2, TAIL(), -2.71, 0, s * 0.5); }
  } else {
    P.add(extrude(sp.hull, hw), paint);
    P.box(x1 - x0 - 0.2, 0.1, hw * 2 + 0.05, M(dark), (x0 + x1) / 2, yb + 0.06, 0);
    for (const s of [-1, 1]) { P.sph(key === "mini" ? 0.1 : 0.11, LAMP(), x1 + 0.02, yb + 0.25, s * hw * 0.62); P.box(0.06, 0.14, 0.2, TAIL(), x0 - 0.01, yb + 0.4, s * hw * 0.66); }
    const hx = sp.head[0];
    if (key === "buggy" || key === "monster") {
      const top = key === "monster" ? 1.4 : 1.24, by = key === "monster" ? 0.42 : 0.3, cage = M("#475569");
      for (const s of [-1, 1]) { const z = s * (hw - 0.09); P.bar([hx - 0.52, by, z], [hx - 0.46, top, z], 0.05, cage); P.bar([hx - 0.46, top, z], [hx + 0.25, top - 0.03, z], 0.05, cage); P.bar([hx + 0.25, top - 0.03, z], [hx + 0.62, by - 0.05, z], 0.05, cage); }
      P.bar([hx - 0.46, top, -hw + 0.09], [hx - 0.46, top, hw - 0.09], 0.05, cage); P.bar([hx + 0.25, top - 0.03, -hw + 0.09], [hx + 0.25, top - 0.03, hw - 0.09], 0.05, cage);
      for (const z of [-0.3, 0, 0.3]) P.sph(0.075, LAMP(), hx + 0.27, top + 0.06, z);
      P.box(0.12, 0.5, hw * 1.4, M("#334155"), hx - 0.42, by + 0.24, 0, 0.15);
      P.box(0.5, 0.24, hw * 1.2, M("#64748b"), x0 + 0.34, by + 0.1, 0);
      for (const s of [-1, 1]) P.bar([x0 + 0.3, by + 0.2, s * 0.22], [x0 - 0.12, by + 0.42, s * 0.22], 0.055, M("#cbd5e1"));
      P.box(0.14, 0.16, hw * 2 + 0.16, M("#64748b"), x1 + 0.1, yb + 0.12, 0); P.box(0.12, 0.14, hw * 2 + 0.1, M("#64748b"), x0 - 0.06, yb + 0.14, 0);
      const sw = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 14), M("#1f2937")); sw.position.set(hx + 0.46, by + 0.33, 0); sw.rotation.y = Math.PI / 2; sw.rotation.z = 0.5; root.add(sw);
      P.bar([hx + 0.62, by - 0.05, 0], [hx + 0.46, by + 0.33, 0], 0.03, M("#334155"));
      if (key === "monster") { for (const s of [-1, 1]) { P.cyl(0.07, 0.75, M("#cbd5e1"), x0 + 0.25, 0.85, s * 0.42, "y"); P.box(0.3, 0.34, 0.3, M("#475569"), s * 1.0, -0.38, 0); } P.box(2.3, 0.12, 0.9, M("#334155"), 0, -0.28, 0); P.box(0.08, 0.3, hw * 1.7, M("#334155"), x1 + 0.03, 0.02, 0); P.box(0.42, 0.12, 0.5, M(dark), 0.72, 0.4, 0, -0.29); }
      else for (const w of sp.wheels) for (const s of [-1, 1]) P.box(0.96, 0.07, 0.36, paint, w.x, 0.13, s * S.zw);
    } else if (key === "mini") {
      P.box(0.05, 0.4, hw * 1.7, GLASS(), 0.3, 0.5, 0, -0.3);
      for (const s of [-1, 1]) { P.bar([0.24, 0.3, s * (hw - 0.07)], [0.36, 0.7, s * (hw - 0.07)], 0.03, M("#475569")); P.sph(0.065, paint, 0.3, 0.42, s * (hw + 0.1)); P.bar([-0.66, 0.3, s * 0.3], [-0.74, 0.52, s * 0.3], 0.03, M("#475569")); P.box(0.64, 0.06, 0.3, paint, s * 0.5, 0.04, hw + 0.14); P.box(0.64, 0.06, 0.3, paint, s * 0.5, 0.04, -hw - 0.14); }
      P.box(0.3, 0.05, hw * 2 + 0.1, M(dark), -0.76, 0.54, 0);
      P.box(0.5, 0.02, 0.22, M("#ffffff"), 0.48, 0.2, 0, -0.374);
      P.box(0.1, 0.4, hw * 1.3, M("#334155"), -0.36, 0.48, 0, 0.15);
    } else if (key === "penny") {
      P.box(x1 - x0 - 0.1, 0.06, hw * 2 + 0.08, M("#d4a017"), (x0 + x1) / 2, yb + 0.02, 0);
      P.box(0.1, 0.46, hw * 1.3, M("#7c2d12"), -0.5, 0.52, 0, 0.12);
      P.bar([1.12, 0.05, 0], [0.96, 0.66, 0], 0.035, M("#d4a017")); P.bar([0.96, 0.66, -0.3], [0.96, 0.66, 0.3], 0.03, M("#d4a017")); P.sph(0.1, LAMP(), 1.2, 0.2, 0);
      for (const s of [-1, 1]) P.bar([1.05, -0.18, s * 0.4], [1.05, -0.55, s * 0.4], 0.04, M("#475569"));
    } else if (key === "rocket") {
      const nose = P.cone(0.2, 0.55, M("#e2e8f0"), x1 + 0.3, -0.1, 0, -Math.PI / 2); nose.scale.z = hw * 0.8;
      P.add(extrude([[-1.3, 0.28], [-1.78, 0.98], [-1.38, 0.98], [-0.82, 0.28]], 0.06, 0.02), paint);
      for (const s of [-1, 1]) { const f = P.box(0.7, 0.05, 0.5, M(dark), -1.05, -0.02, s * (hw + 0.2)); f.rotation.x = s * 0.25; }
      P.cyl(0.27, 0.5, M("#475569"), -1.55, 0.05, 0, "x"); P.cyl(0.32, 0.12, M("#334155"), -1.84, 0.05, 0, "x");
      flame = P.cone(0.22, 0.9, M("#fb923c", { emissive: "#f97316", emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }), -2.3, 0.05, 0, Math.PI / 2); flame.userData.keep = true;
      P.box(0.05, 0.34, hw * 1.4, GLASS(), 0.02, 0.44, 0, -0.5);
      P.box(1.9, 0.05, hw * 2 + 0.03, M("#ffffff"), 0.1, -0.06, 0);
      P.box(0.1, 0.36, hw * 1.2, M("#334155"), -0.74, 0.44, 0, 0.15);
    }
  }
  // the driver
  let archie = null, spin = null;
  if (!o.ghost) {
    archie = buildArchie3D(THREE, {});
    archie.scale.setScalar(S.ar[2]); archie.position.set(S.ar[0], S.ar[1], 0); archie.rotation.y = Math.PI / 2 - 0.6;
    archie.userData.keep = true; archie.userData.base = S.ar[1];
    const hat = buildHat(look.hat || "none");
    if (hat) { hat.position.y = 0.94; archie.add(hat); spin = hat.userData.spin; }
    root.add(archie);
    const dc = look.decal && look.decal !== "none" ? look.decal : null;
    if (dc) for (const s of [-1, 1]) {
      const mat = new THREE.MeshStandardMaterial({ map: decalTex(dc, s < 0), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }); mat.userData.own = true;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(S.dec[2], S.dec[3]), mat); pl.geometry.userData.own = true;
      pl.position.set(S.dec[0], S.dec[1], s * (hw + 0.006)); if (s < 0) pl.rotation.y = Math.PI; pl.userData.keep = true; pl.userData.decal = true; root.add(pl);
    }
  }
  const hull = bake(root);
  hull.traverse((q) => { if (q.userData.decal) q.castShadow = false; });
  const wheels = sp.wheels.map((w) => {
    const node = new THREE.Group(), one = buildWheel(w.r, key === "penny" && w.r < 0.5 ? 0.22 : S.ww, look.wheel || "classic", key === "penny" && w.r > 0.8);
    const zw = key === "penny" && w.r < 0.5 ? 0.4 : S.zw, two = one.clone();
    one.position.z = zw; two.position.z = -zw; two.rotation.y = Math.PI;
    const ax = new THREE.Mesh(CYL, M("#334155")); ax.scale.set(0.06, zw * 2, 0.06); ax.rotation.x = Math.PI / 2; ax.castShadow = true;
    node.add(one, two, ax); node.userData.rest = [w.x, w.y];
    return node;
  });
  if (o.ghost) { const gm = GHOST(); for (const n of [hull, ...wheels]) n.traverse((q) => { if (q.isMesh) { q.material = gm; q.castShadow = false; } }); paint.dispose(); }
  return { key, hull, wheels, archie, spin, flame, sp };
}
let ghostMat = null;
const GHOST = () => (ghostMat ||= new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.28, depthWrite: false }));
/** Put the wheels under the hull at their rest places (garage, ghost). */
export function restPose(car) { for (const w of car.wheels) { w.position.set(w.userData.rest[0], w.userData.rest[1], 0); car.hull.add(w); } return car.hull; }
/** Driver pose and the little moving bits. */
export function poseCar(car, pose, t) {
  const a = car.archie;
  if (a) {
    const arms = a.userData.arms, up = pose === "jump";
    arms[0].rotation.z = up ? -2.7 + Math.sin(t * 18) * 0.15 : -0.35; arms[1].rotation.z = up ? 2.7 - Math.sin(t * 18 + 1) * 0.15 : 0.35;
    arms[0].rotation.x = arms[1].rotation.x = pose === "idle" ? -1.1 : 0;
    a.rotation.z = pose === "sad" ? 0.25 : 0; a.rotation.x = pose === "sad" ? 0.2 : 0;
    a.position.y = a.userData.base + (up ? 0.06 : 0);
  }
  if (car.spin) car.spin.rotation.y = t * 22;
  if (car.flame) { const k = 0.8 + 0.3 * Math.sin(t * 40) + 0.15 * Math.sin(t * 67); car.flame.scale.y = 0.9 * k; }
}
export function disposeCar(car) { if (!car) return; for (const w of car.wheels) disposeTree(w); disposeTree(car.hull); }

// ---------- particles ----------
export class Particles {
  constructor(max = 260) {
    this.max = max; this.list = [];
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.92, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 5;
    this.col = new THREE.Color();
    this.mesh.setColorAt(0, this.col);
  }
  puff(x, y, z, o = {}) {
    for (let i = 0; i < (o.n || 1) && this.list.length < this.max; i++) {
      const a = (o.angle ?? Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? 1.2), v = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      this.list.push({ x, y, z: z + (Math.random() - 0.5) * (o.zs ?? 1.2), vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v, vz: (Math.random() - 0.5) * (o.vz ?? 1.5), g: o.g ?? 2, life: (o.life ?? 0.5) * (0.6 + Math.random() * 0.6), t: 0, size: (o.size ?? 0.16) * (0.6 + Math.random() * 0.8), color: o.colors ? o.colors[(Math.random() * o.colors.length) | 0] : o.color || "#fff", sq: !!o.sq, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 14, grow: o.grow ?? 0 });
    }
  }
  update(dt) {
    const P = this.list;
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.t += dt; if (p.t >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; } p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt; p.size = Math.max(0.01, p.size + p.grow * dt); }
  }
  sync() {
    const P = this.list, e = _m.elements;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], k = p.t / p.life, s = p.size * (k < 0.6 ? 1 : (1 - k) / 0.4), c = Math.cos(p.rot) * s, sn = Math.sin(p.rot) * s, f = p.sq ? 0.55 : 1;
      e[0] = c; e[1] = sn; e[2] = 0; e[3] = 0; e[4] = -sn * f; e[5] = c * f; e[6] = 0; e[7] = 0; e[8] = 0; e[9] = 0; e[10] = s * f; e[11] = 0; e[12] = p.x; e[13] = p.y; e[14] = p.z; e[15] = 1;
      this.mesh.setMatrixAt(i, _m); this.mesh.setColorAt(i, this.col.set(p.color));
    }
    this.mesh.count = P.length; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.list.length = 0; this.mesh.count = 0; }
}
