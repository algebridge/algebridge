// Slope Rider 3D view: draws the 2D physics world as chunky 3D. The simulation stays flat (x, y); depth (z) is only for looks.
import { THREE, M, BAKED, BOX, CYL, SPH, CONE, parts, bake, extrude, disposeTree, buildCar, restPose, poseCar, disposeCar, Particles } from "./car3d.js";

const TAU = Math.PI * 2, ZF = 3.4, ZR = 1.7, ZB = -16, DEPTH = 3.0, FOV = 30, KW = 2 * Math.tan((FOV * Math.PI) / 360) * (16 / 9);
export const OPT = ["#2563eb", "#ec4899", "#f59e0b"];
export const THEMES = [
  { sky: ["#3fa9ff", "#dff4ff"], fog: "#d3eeff", sun: "#fff6c9", far: "#9ccbe8", mid: "#79c98a", top: "#6fd35a", top2: "#58c048", road: "#dcb680", line: "#3f8f37", dirt: "#c98a4b", dirt2: "#a96f37", dust: "#e7c79a", cloud: "#ffffff", hemi: ["#ffffff", "#9ccf8a"], sunc: "#fff4dc", wood: "#b0713a", kind: 0 },
  { sky: ["#ff8f5c", "#ffe9bd"], fog: "#ffdcae", sun: "#fff1c9", far: "#e2a07c", mid: "#d98f5c", top: "#f0c060", top2: "#e3ac48", road: "#f8e0a8", line: "#b9772e", dirt: "#b9673c", dirt2: "#94492a", dust: "#f6d9a8", cloud: "#fff2df", hemi: ["#ffe6c8", "#d9955e"], sunc: "#ffd9a8", wood: "#8f5a33", kind: 1 },
  { sky: ["#6fa4ff", "#eef5ff"], fog: "#e6f0ff", sun: "#ffffff", far: "#b9cdf0", mid: "#d5e2f8", top: "#ffffff", top2: "#e8f0ff", road: "#d3e0f5", line: "#a9bbe0", dirt: "#7f8fc0", dirt2: "#63729f", dust: "#f3f7ff", cloud: "#ffffff", hemi: ["#ffffff", "#b9c9ee"], sunc: "#ffffff", wood: "#8a6a4f", kind: 2 },
  { sky: ["#1f2266", "#b77bd0"], fog: "#9370c4", sun: "#ffe7f3", far: "#5d55a8", mid: "#6a55b0", top: "#5ee0c0", top2: "#46c8a8", road: "#9a8bd8", line: "#2a8f7c", dirt: "#6b4a9a", dirt2: "#54387c", dust: "#d9c9ff", cloud: "#c9b8f0", hemi: ["#cdbdff", "#5b3f9a"], sunc: "#ffd6f0", wood: "#5b3f7a", kind: 3 },
];
const LOOKS = { plank: "#c98a4b", drop: "#f1c27a", stone: "#9aa7b8", rod: "#94a3b8", blade: "#d9a05b", lift: "#fde047", tramp: "#ec4899", ramp: "#d9a05b", loop: "#f59e0b", hammer: "#475569", gear: "#94a3b8", log: "#b0713a", boulder: "#8b95a5", ball: "#ef4444" };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _m = new THREE.Matrix4(), _c = new THREE.Color(), _v = new THREE.Vector3(), _o = new THREE.Object3D();
function setM(x, y, z, a, sx, sy, sz) { const e = _m.elements, c = Math.cos(a), s = Math.sin(a); e[0] = c * sx; e[1] = s * sx; e[2] = 0; e[3] = 0; e[4] = -s * sy; e[5] = c * sy; e[6] = 0; e[7] = 0; e[8] = 0; e[9] = 0; e[10] = sz; e[11] = 0; e[12] = x; e[13] = y; e[14] = z; e[15] = 1; return _m; }
function canvasTex(w, h, draw) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d"), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.own = true; return t; }
const own = (m) => { m.userData.own = true; return m; };
/** Box numbers from a four-corner polygon: centre, angle, width, height. */
function boxOf(lv) { const cx = (lv[0][0] + lv[1][0] + lv[2][0] + lv[3][0]) / 4, cy = (lv[0][1] + lv[1][1] + lv[2][1] + lv[3][1]) / 4, ex = lv[1][0] - lv[0][0], ey = lv[1][1] - lv[0][1]; return { cx, cy, a: Math.atan2(ey, ex), w: Math.hypot(ex, ey), h: Math.hypot(lv[2][0] - lv[1][0], lv[2][1] - lv[1][1]) }; }

export function createView(g) {
  let W = 960, H = 540, DPR = 1, renderer = null;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 700);
  const resizers = [];
  const canvas = g.canvas3d((w, h, d) => { W = w; H = h; DPR = d; if (renderer) { renderer.setPixelRatio(d); renderer.setSize(w, h, false); } camera.aspect = w / h; camera.updateProjectionMatrix(); for (const f of resizers) f(w, h); });
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9ccf8a, 1.25), sun = new THREE.DirectionalLight(0xfff4dc, 2.2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 24, bottom: -24, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(hemi, sun, sun.target);
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const flatMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  const coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 18); coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({ color: "#fde047", roughness: 0.4, emissive: "#f59e0b", emissiveIntensity: 0.55 });
  const crateTex = canvasTex(128, 128, (x) => { x.fillStyle = "#e0a962"; x.fillRect(0, 0, 128, 128); x.strokeStyle = "#b97a35"; x.lineWidth = 3; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke(); } x.strokeStyle = "#8a5a22"; x.lineWidth = 14; x.strokeRect(7, 7, 114, 114); x.lineWidth = 12; x.beginPath(); x.moveTo(10, 10); x.lineTo(118, 118); x.moveTo(118, 10); x.lineTo(10, 118); x.stroke(); });
  crateTex.userData.own = false;
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 });
  const plankMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const logGeo = (() => { const r = new THREE.Group(), P = parts(r); P.cyl(1, 1, M("#b0713a"), 0, 0, 0); P.cyl(0.78, 1.02, M("#e2b77e"), 0, 0, 0); P.cyl(0.42, 1.03, M("#c98a4b"), 0, 0, 0); P.box(0.5, 0.12, 1.04, M("#8a5a22"), 0.5, 0, 0); const ge = bake(r).userData.baked.geometry; ge.userData.own = false; return ge; })();
  const skyTex = THEMES.map((t) => { const s = canvasTex(4, 256, (x) => { const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, t.sky[0]); gr.addColorStop(0.62, t.sky[1]); gr.addColorStop(1, t.fog); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); }); s.userData.own = false; return s; });
  const flagTex = canvasTex(96, 64, (x) => { for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? "#0f172a" : "#ffffff"; x.fillRect(i * 16, j * 16, 16, 16); } });
  flagTex.userData.own = false; flagTex.magFilter = THREE.NearestFilter;
  const stopGeo = new THREE.PlaneGeometry(1.4, 1.4), stopMat = new THREE.MeshBasicMaterial({ transparent: true, map: canvasTex(128, 128, (x) => { x.fillStyle = "#dc2626"; x.strokeStyle = "#ffffff"; x.lineWidth = 7; x.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; x.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); } x.closePath(); x.fill(); x.stroke(); x.fillStyle = "#fff"; x.font = "900 38px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("STOP", 64, 67); }) });
  stopMat.map.userData.own = false;
  const fx = new Particles(260);
  scene.add(fx.mesh);

  let L = null, th = THEMES[0], world = null, car = null, ghost = null, ghostRoot = null, low = 0, carZ = 0;
  let crates = null, crateList = [], planks = null, plankList = [], logs = null, logList = [], nodes = [], ropes = [], coins = null, flag = null, maths = [], sunDisc = null;
  const view = { THREE, renderer, scene, camera, canvas, fx, tags: [], yaw: 0.2, pitch: 0.14, onResize: (f) => resizers.push(f), get size() { return [W, H]; }, get carZ() { return carZ; } };

  view.groundY = (x) => { let best = -1e9; if (!L) return best; for (const ln of L.lines) { const p = ln.pts; if (x < p[0][0] || x > p[p.length - 1][0]) continue; for (let i = 0; i < p.length - 1; i++) if (x >= p[i][0] && x <= p[i + 1][0]) { const t = (x - p[i][0]) / (p[i + 1][0] - p[i][0] || 1), y = p[i][1] + (p[i + 1][1] - p[i][1]) * t; if (y > best) best = y; break; } } return best; };
  const slopeAt = (x) => Math.abs(view.groundY(x + 0.6) - view.groundY(x - 0.6)) / 1.2;

  // ---------- terrain ----------
  function buildTerrain() {
    const pos = [], nor = [], col = [];
    const C = (h) => new THREE.Color(h), cG = C(th.top), cG2 = C(th.top2), cR = C(th.road), cI = C("#c8ecff"), cLip = C(th.line), cD = C(th.dirt), cD2 = C(th.dirt2), cD3 = C(th.dirt2).multiplyScalar(0.5), tmp = [];
    const v = (p, n, c) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(c.r, c.g, c.b); };
    const quad = (A, B, Cc, D, nA, nB, cA, cB, cC, cD4) => { v(A, nA, cA); v(B, nB, cB); v(Cc, nB, cC); v(A, nA, cA); v(Cc, nB, cC); v(D, nA, cD4); };
    const bottom = low - 46, FRONT = [0, 0, 1];
    const bands = [[0, 0.34, cLip, cLip], [0.34, 0.8, cD, cD], [0.8, 1.05, cD2, cD2], [1.05, 1.9, cD, cD], [1.9, 2.1, cD2, cD2], [2.1, 7, cD, cD2], [7, 0, cD2, cD3]];
    L.lines.forEach((ln, li) => {
      const p = ln.pts.slice(), io = li === 0 ? 1 : 0, last = li === L.lines.length - 1;
      if (li === 0) p.unshift([p[0][0] - 90, p[0][1]]);
      if (last) p.push([p[p.length - 1][0] + 90, p[p.length - 1][1]]);
      const N = p.map((q, k) => { const a = p[Math.max(0, k - 1)], b = p[Math.min(p.length - 1, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l, 0]; });
      const gc = p.map((q) => C(th.top).lerp(cG2, hash(q[0] * 0.37 + li)));
      for (let k = 0; k < p.length - 1; k++) {
        const a = p[k], b = p[k + 1], ice = ln.ice[k - io];
        for (const [z0, z1, road] of [[ZF, ZR, 0], [ZR, -ZR, 1], [-ZR, ZB, 0]]) {
          const ca = road ? (ice ? cI : cR) : gc[k], cb = road ? (ice ? cI : cR) : gc[k + 1];
          quad([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], N[k], N[k + 1], ca, cb, cb, ca);
        }
        for (const [d0, d1, c0, c1] of bands) {
          const ya0 = a[1] - d0, yb0 = b[1] - d0, ya1 = d1 ? a[1] - d1 : bottom, yb1 = d1 ? b[1] - d1 : bottom;
          quad([a[0], ya0, ZF], [a[0], ya1, ZF], [b[0], yb1, ZF], [b[0], yb0, ZF], FRONT, FRONT, c0, c1, c1, c0);
        }
      }
      // the cliff faces where the road stops
      for (const [q, nx, on] of [[p[0], -1, li > 0], [p[p.length - 1], 1, !last]]) {
        if (!on) continue;
        const n = [nx, 0, 0], A = [q[0], q[1], ZF], B = [q[0], q[1], ZB], y1 = q[1] - 0.34, y2 = q[1] - 7;
        const wall = (ya, yb, c0, c1) => (nx > 0 ? quad([q[0], ya, ZF], [q[0], yb, ZF], [q[0], yb, ZB], [q[0], ya, ZB], n, n, c0, c1, c1, c0) : quad([q[0], ya, ZB], [q[0], yb, ZB], [q[0], yb, ZF], [q[0], ya, ZF], n, n, c0, c1, c1, c0));
        wall(A[1], y1, cLip, cLip); wall(y1, y2, cD, cD2); wall(y2, bottom, cD2, cD3); tmp.push(B);
      }
    });
    const ge = new THREE.BufferGeometry();
    ge.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); ge.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); ge.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    ge.userData.own = true;
    const mesh = new THREE.Mesh(ge, terrainMat); mesh.receiveShadow = true; mesh.frustumCulled = false;
    world.add(mesh);
  }

  // ---------- scenery: hills, trees, clouds, fence ----------
  function treeGeo(kind, v) {
    const r = new THREE.Group(), P = parts(r);
    if (kind === 0) { if (v) { P.cyl(0.16, 1.0, M("#8b5a2b"), 0, 0.5, 0, "y"); const a = P.add(new THREE.IcosahedronGeometry(1, 1), M("#3fae52"), 0, 1.7, 0); a.scale.set(0.95, 0.9, 0.95); const b = P.add(new THREE.IcosahedronGeometry(1, 0), M("#58c96a"), 0.35, 2.3, 0.2); b.scale.setScalar(0.55); } else { P.cyl(0.14, 0.7, M("#8b5a2b"), 0, 0.35, 0, "y"); P.cone(0.95, 1.3, M("#2f9e44"), 0, 1.2, 0); P.cone(0.72, 1.1, M("#37b24d"), 0, 1.95, 0); P.cone(0.46, 0.9, M("#51cf66"), 0, 2.65, 0); } }
    else if (kind === 1) { if (v) { const a = P.add(new THREE.IcosahedronGeometry(1, 0), M("#c98a5a"), 0, 0.5, 0); a.scale.set(1.1, 0.8, 0.9); const b = P.add(new THREE.IcosahedronGeometry(1, 0), M("#b9774a"), 0.7, 0.3, 0.3); b.scale.setScalar(0.5); } else { P.cyl(0.26, 2.2, M("#5a9e4b"), 0, 1.1, 0, "y"); P.sph(0.26, M("#5a9e4b"), 0, 2.2, 0); P.cyl(0.16, 0.6, M("#6aae5b"), 0.55, 1.2, 0, "x"); P.cyl(0.16, 0.7, M("#6aae5b"), 0.78, 1.5, 0, "y"); P.cyl(0.15, 0.5, M("#6aae5b"), -0.5, 0.9, 0, "x"); P.cyl(0.15, 0.6, M("#6aae5b"), -0.7, 1.15, 0, "y"); } }
    else if (kind === 2) { if (v) { const a = P.add(new THREE.IcosahedronGeometry(1, 0), M("#a9b8d8"), 0, 0.4, 0); a.scale.set(1, 0.7, 0.9); const b = P.add(new THREE.IcosahedronGeometry(1, 0), M("#ffffff"), 0, 0.75, 0); b.scale.set(0.8, 0.35, 0.7); } else { P.cyl(0.14, 0.7, M("#6b4a2f"), 0, 0.35, 0, "y"); P.cone(0.95, 1.3, M("#2f7d6b"), 0, 1.2, 0); P.cone(0.72, 1.1, M("#3a9080"), 0, 1.95, 0); P.cone(0.5, 0.95, M("#ffffff"), 0, 2.65, 0); P.cone(0.76, 0.3, M("#ffffff"), 0, 1.72, 0); } }
    else { if (v) { P.cone(0.4, 1.8, M("#7dd3fc"), 0, 0.9, 0); P.cone(0.26, 1.1, M("#c4b5fd"), 0.45, 0.55, 0.1, -0.3); } else { P.cyl(0.2, 1.3, M("#f5e9d8"), 0, 0.65, 0, "y"); const cap = P.add(new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2), M("#ec4899"), 0, 1.2, 0); cap.scale.set(1.0, 0.7, 1.0); for (let i = 0; i < 5; i++) P.sph(0.13, M("#ffffff"), Math.cos(i * 1.26) * 0.6, 1.62, Math.sin(i * 1.26) * 0.6); } }
    const ge = bake(r).userData.baked.geometry;
    return ge;
  }
  function buildScenery() {
    const seed = (L.idx || 0) * 13.7 + 5, x0 = L.startX - 70, x1 = L.endX + 90, base = low - 16;
    const plane = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)), own(new THREE.MeshStandardMaterial({ color: th.mid, roughness: 1 })));
    plane.geometry.userData.own = true; plane.rotation.x = -Math.PI / 2; plane.scale.set(x1 - x0 + 900, 700, 1); plane.position.set((x0 + x1) / 2, base, -260); plane.receiveShadow = false; world.add(plane);
    // far hills at three depths
    const hills = [];
    for (const [z, colr, sp, hh] of [[-40, th.mid, 17, [3, 8]], [-72, null, 24, [6, 13]], [-118, th.far, 32, [10, 22]]]) {
      const c = colr ? new THREE.Color(colr) : new THREE.Color(th.mid).lerp(new THREE.Color(th.far), 0.55);
      for (let x = x0 - 60; x < x1 + 60; x += sp * (0.6 + hash(x + z + seed))) { const h = hh[0] + hash(x * 1.7 + z) * (hh[1] - hh[0]) + (low - base) * 0.7; hills.push([x, base + h / 2, z + hash(x * 0.3) * 14, h * (0.75 + hash(x * 2.3) * 0.5), h, c.clone().multiplyScalar(0.92 + hash(x) * 0.16), hash(x * 5) * 6]); }
    }
    const hm = new THREE.InstancedMesh(own(new THREE.ConeGeometry(1, 1, 7)), flatMat, hills.length); hm.geometry.userData.own = true;
    hills.forEach((h, i) => { _o.position.set(h[0], h[1], h[2]); _o.scale.set(h[3], h[4], h[3] * 0.8); _o.rotation.set(0, h[6], 0); _o.updateMatrix(); hm.setMatrixAt(i, _o.matrix); hm.setColorAt(i, h[5]); });
    hm.frustumCulled = false; world.add(hm);
    // trees and rocks on the meadow behind the road, bushes on the front edge
    for (const v of [0, 1]) {
      const spots = [], n = Math.round((L.endX - L.startX + 40) / (v ? 7 : 3.2));
      for (let i = 0; i < n; i++) {
        const x = L.startX - 20 + hash(i * 3.1 + seed + v * 50) * (L.endX - L.startX + 60), front = v === 1 && hash(i * 9.1 + seed) < 0.35;
        const z = front ? 2.3 + hash(i + seed) * 0.8 : -3.6 - hash(i * 1.7 + seed) * 11.6, y = view.groundY(x);
        if (y < -1e8 || slopeAt(x) > 0.9 || L.maths.some((q) => x > q.x0 - 3 && x < q.x1 + 3)) continue;
        spots.push([x, y, z, (front ? 0.35 : 0.8 + hash(i * 2.2) * 0.9) * (v ? 0.8 : 1), hash(i * 4.4) * 6]);
      }
      if (!spots.length) continue;
      const tm = new THREE.InstancedMesh(own(treeGeo(th.kind, v)), BAKED, spots.length);
      spots.forEach((s, i) => { _o.position.set(s[0], s[1] - 0.05, s[2]); _o.scale.setScalar(s[3]); _o.rotation.set(0, s[4], 0); _o.updateMatrix(); tm.setMatrixAt(i, _o.matrix); });
      tm.castShadow = true; tm.frustumCulled = false; world.add(tm);
    }
    // fence along the back of the road
    const posts = [];
    for (let x = Math.ceil(L.startX / 2.5) * 2.5; x < L.endX; x += 2.5) { const y = view.groundY(x); if (y > -1e8 && slopeAt(x) < 0.8 && view.groundY(x - 0.5) > -1e8 && view.groundY(x + 0.5) > -1e8) posts.push([x, y]); }
    if (posts.length) {
      const fm = new THREE.InstancedMesh(BOX, M(th.wood), posts.length * 2); let k = 0;
      posts.forEach((p, i) => { fm.setMatrixAt(k++, setM(p[0], p[1] + 0.3, -ZR - 0.45, 0, 0.14, 0.75, 0.14)); const q = posts[i + 1]; if (q && q[0] - p[0] < 2.6) { const dx = q[0] - p[0], dy = q[1] - p[1]; fm.setMatrixAt(k++, setM((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + 0.48, -ZR - 0.45, Math.atan2(dy, dx), Math.hypot(dx, dy), 0.1, 0.07)); } });
      fm.count = k; fm.castShadow = true; fm.frustumCulled = false; world.add(fm);
    }
    // clouds
    const cl = [];
    for (let i = 0; i < 16; i++) { const x = x0 - 80 + hash(i * 7.7 + seed) * (x1 - x0 + 260), y = low + 16 + hash(i * 3.3) * 30, z = -150 - hash(i * 5.1) * 110, s = 7 + hash(i * 2.9) * 8; for (const [ex, ey, rx, ry] of [[0, 0, 1.6, 0.5], [0.9, 0.35, 1.0, 0.55], [-0.8, 0.25, 0.85, 0.45]]) cl.push([x + ex * s, y + ey * s, z, rx * s, ry * s]); }
    const cm = new THREE.InstancedMesh(SPH, own(new THREE.MeshBasicMaterial({ color: th.cloud, fog: false, transparent: true, opacity: 0.9 })), cl.length);
    cl.forEach((c, i) => { _o.position.set(c[0], c[1], c[2]); _o.scale.set(c[3], c[4], c[3] * 0.6); _o.rotation.set(0, 0, 0); _o.updateMatrix(); cm.setMatrixAt(i, _o.matrix); });
    cm.frustumCulled = false; world.add(cm);
    sunDisc = new THREE.Group();
    const s1 = new THREE.Mesh(own(new THREE.CircleGeometry(1, 28)), own(new THREE.MeshBasicMaterial({ color: th.sun, fog: false }))); s1.geometry.userData.own = true; s1.scale.setScalar(15);
    const s2 = new THREE.Mesh(s1.geometry, own(new THREE.MeshBasicMaterial({ color: th.sun, fog: false, transparent: true, opacity: 0.25 }))); s2.scale.setScalar(25); s2.position.z = -1;
    sunDisc.add(s1, s2); world.add(sunDisc);
  }

  // ---------- fixed props ----------
  function buildProps() {
    const r = new THREE.Group(), P = parts(r);
    for (const b of L.statics) for (const sh of b.shapes) {
      if (sh.t !== 1 || sh.look === "loop" || sh.look === "ramp" || !LOOKS[sh.look]) continue;
      const pts = []; for (let i = 0; i < sh.n; i++) pts.push([sh.wv[i * 2], sh.wv[i * 2 + 1]]);
      P.add(extrude(pts, DEPTH / 2, 0.03), M(LOOKS[sh.look]));
      if (sh.look === "tramp") { const xa = pts[0][0], xb = pts[1][0], y = pts[0][1]; P.box(xb - xa - 0.9, 0.05, DEPTH - 0.5, M("#ffffff"), (xa + xb) / 2, y + 0.19, 0); for (const x of [xa + 0.3, xb - 0.3]) for (const z of [-1.3, 1.3]) P.cyl(0.09, 0.3, M("#831843"), x, y - 0.05, z, "y"); }
    }
    for (const lp of L.loops) for (const b of [...lp.rl, ...lp.top, ...lp.ll]) {
      const sh = b.shapes[0], pts = []; for (let i = 0; i < sh.n; i++) pts.push([sh.wv[i * 2], sh.wv[i * 2 + 1]]);
      const mx = (pts[2][0] + pts[3][0]) / 2 - lp.cx, my = (pts[2][1] + pts[3][1]) / 2 - lp.cy, u = ((((Math.atan2(my, mx) + Math.PI / 2) % TAU) + TAU) % TAU) / TAU;
      const m = P.add(extrude(pts, 1.15, 0), M(Math.round(u * 44) % 2 ? "#f59e0b" : "#fbbf24")); m.position.z = 1.25 * (1 - 2 * u);
    }
    for (const lp of L.loops) for (const s of [-1, 1]) { P.box(0.4, lp.R * 2 + 0.6, 0.4, M("#92400e"), lp.cx + s * (lp.R + 0.7), lp.cy + 0.3, s * -2.7); P.box(1.4, 0.3, 0.3, M("#92400e"), lp.cx + s * (lp.R + 0.25), lp.cy, s * -2.7); }
    for (const pv of L.pivots) {
      if (pv.post) { const gy = view.groundY(pv.x), y0 = (gy > -1e8 ? gy : pv.y - 8) - 0.3; { const z = -2.9, gb = view.groundY(pv.x - 1.2) > -1e8 ? pv.x : pv.x - 2.6, yb = Math.max(view.groundY(gb), y0 + 0.3) - 0.3; P.box(0.36, pv.y + 0.5 - yb, 0.36, M("#64748b"), gb, (pv.y + 0.5 + yb) / 2, z); P.box(0.9, 0.2, 0.7, M("#475569"), gb, yb + 0.4, z); if (gb !== pv.x) P.box(2.9, 0.3, 0.3, M("#64748b"), pv.x - 1.3, pv.y + 0.2, z); P.bar([gb, pv.y - 1.6, z], [pv.x, pv.y, -1.2], 0.09, M("#475569")); } P.cyl(0.16, 3.9, M("#475569"), pv.x, pv.y, -1.2); P.cyl(0.3, 0.5, M("#fbbf24"), pv.x, pv.y, 0); }
      else { P.add(extrude([[pv.x, pv.y + 0.1], [pv.x - 0.6, pv.y - pv.h], [pv.x + 0.6, pv.y - pv.h]], 1.25, 0.03), M("#64748b")); P.cyl(0.12, DEPTH + 0.3, M("#334155"), pv.x, pv.y, 0); }
    }
    for (let i = 0; i + 1 < L.ropes.length; i += 2) { const a = L.ropes[i], b = L.ropes[i + 1], pa = a.a.world(a.la[0], a.la[1]), pb = b.a.world(b.la[0], b.la[1]); P.box(pb[0] - pa[0] + 0.8, 0.22, 0.22, M("#64748b"), (pa[0] + pb[0]) / 2, pa[1] + 0.1, -1.35); P.box(pb[0] - pa[0] + 0.8, 0.22, 0.22, M("#64748b"), (pa[0] + pb[0]) / 2, pa[1] + 0.1, 1.35); for (const x of [pa[0], pb[0]]) P.box(0.2, 0.2, 6.2, M("#475569"), x, pa[1] + 0.1, 0); for (const z of [-3, 3]) P.box(0.3, 60, 0.3, M("#64748b"), (pa[0] + pb[0]) / 2, pa[1] - 29.8, z); P.box(0.24, 0.24, 6.2, M("#64748b"), (pa[0] + pb[0]) / 2, pa[1] + 0.1, 0); }
    // a stop sign wherever the test driver has to wait: hammers, ferries, falling rocks
    let lastStop = -99;
    for (const q of L.zones) { if (!q.wait || q.on || q.x0 - lastStop < 6) continue; lastStop = q.x0; const gy = view.groundY(q.x0); if (gy < -1e8) continue; P.cyl(0.07, 2.6, M("#e2e8f0"), q.x0, gy + 1.3, -2.3, "y"); const sg = new THREE.Mesh(stopGeo, stopMat); sg.position.set(q.x0, gy + 2.9, -2.24); sg.userData.keep = true; r.add(sg); P.cyl(0.74, 0.06, M("#f8fafc"), q.x0, gy + 2.9, -2.3).rotation.y = 0; }
    // finish: pole, flag and a checker strip on the road
    const fx0 = L.finishX, fy = L.finishY;
    P.cyl(0.09, 4.5, M("#f8fafc"), fx0, fy + 2.2, -2.1, "y"); P.sph(0.16, M("#fde047"), fx0, fy + 4.5, -2.1); P.cyl(0.3, 0.2, M("#64748b"), fx0, fy + 0.1, -2.1, "y");
    for (let i = 0; i < 2; i++) for (let j = 0; j < 8; j++) P.box(0.4, 0.04, 0.42, M((i + j) % 2 ? "#0f172a" : "#ffffff"), fx0 + (i - 0.5) * 0.4, fy + 0.02, -1.47 + j * 0.42);
    const out = bake(r, { receive: true }); world.add(out);
    flag = new THREE.Mesh(own(new THREE.PlaneGeometry(2.3, 1.45, 8, 1)), own(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 })));
    flag.geometry.userData.own = true; flag.position.set(fx0 + 1.2, fy + 3.72, -2.1); flag.castShadow = true; world.add(flag);
    flag.userData.base = Float32Array.from(flag.geometry.attributes.position.array);
  }

  // ---------- things that move ----------
  function buildDynamics() {
    crateList = []; plankList = []; logList = []; nodes = []; ropes = [];
    for (const b of L.world.bodies) {
      if (b.tag === "car" || b.tag === "wheel") continue;
      if (b.tag === "crate") { crateList.push({ b, s: boxOf(b.shapes[0].lv).w }); continue; }
      if (b.tag === "log") { logList.push(b); continue; }
      if (b.shapes.every((s) => s.t === 1 && (s.look === "plank" || s.look === "drop"))) { for (const sh of b.shapes) plankList.push({ b, sh, ...boxOf(sh.lv), col: new THREE.Color(LOOKS[sh.look]).multiplyScalar(0.9 + hash(plankList.length * 3.3) * 0.2) }); continue; }
      const r = new THREE.Group(), P = parts(r);
      for (const sh of b.shapes) {
        if (!LOOKS[sh.look]) continue;
        if (sh.t === 1) { const q = boxOf(sh.lv), dz = sh.look === "rod" ? 0.3 : sh.look === "lift" ? DEPTH : DEPTH - 0.2; P.box(q.w, q.h, dz, M(LOOKS[sh.look]), q.cx, q.cy, 0, q.a); if (sh.look === "lift") { P.box(q.w, 0.06, 0.25, M("#0f172a"), q.cx, q.cy + q.h / 2, 1.2); P.box(q.w, 0.06, 0.25, M("#0f172a"), q.cx, q.cy + q.h / 2, -1.2); P.box(0.3, 0.5, DEPTH + 0.3, M("#854d0e"), q.cx, q.cy - 0.3, 0); } }
        else if (sh.look === "hammer") { P.cyl(sh.r, 1.7, M("#475569"), sh.lx, sh.ly, 0); P.cyl(sh.r * 0.66, 1.76, M("#fde047"), sh.lx, sh.ly, 0); P.cyl(sh.r * 0.4, 1.8, M("#334155"), sh.lx, sh.ly, 0); for (let i = 0; i < 8; i++) P.box(0.22, 0.3, 1.5, M("#334155"), sh.lx + Math.cos(i * 0.785) * sh.r, sh.ly + Math.sin(i * 0.785) * sh.r, 0, i * 0.785); }
        else if (sh.look === "gear") { const R = sh.r, n = Math.round(R * 4); P.cyl(R - 0.3, DEPTH, M("#94a3b8"), 0, 0, 0); for (let i = 0; i < n; i++) { const a = (i / n) * TAU; P.box(0.5, ((TAU * R) / n) * 0.5, DEPTH, M("#64748b"), Math.cos(a) * (R - 0.24), Math.sin(a) * (R - 0.24), 0, a); } for (let i = 0; i < 6; i++) P.cyl(R * 0.16, DEPTH + 0.06, M("#475569"), Math.cos(i * 1.047) * R * 0.58, Math.sin(i * 1.047) * R * 0.58, 0); P.cyl(R * 0.2, DEPTH + 0.3, M("#fbbf24"), 0, 0, 0); P.cyl(R * 0.07, DEPTH + 1.2, M("#334155"), 0, 0, 0); }
        else if (sh.look === "ball") { const ge = new THREE.SphereGeometry(sh.r, 18, 12), p = ge.attributes.position, cs = []; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)), k = Math.floor(((a + Math.PI) / TAU) * 6) % 2, pole = Math.abs(p.getZ(i)) > sh.r * 0.93; _c.set(pole ? "#fde047" : k ? "#ffffff" : "#ef4444"); cs.push(_c.r, _c.g, _c.b); } ge.setAttribute("color", new THREE.Float32BufferAttribute(cs, 3)); ge.userData.own = true; const m = new THREE.Mesh(ge, BAKED); m.position.set(sh.lx, sh.ly, 0); m.userData.keep = true; r.add(m); }
        else if (sh.look === "boulder") { const ge = new THREE.IcosahedronGeometry(sh.r, 1), p = ge.attributes.position, cs = []; for (let i = 0; i < p.count; i++) { const k = 0.93 + hash(Math.round(p.getX(i) * 31) + Math.round(p.getY(i) * 17) * 7 + Math.round(p.getZ(i) * 13) * 3) * 0.1; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } ge.computeVertexNormals(); for (let i = 0; i < p.count; i += 3) { _c.set("#8b95a5").multiplyScalar(0.8 + hash(i * 1.3) * 0.35); for (let j = 0; j < 3; j++) cs.push(_c.r, _c.g, _c.b); } ge.setAttribute("color", new THREE.Float32BufferAttribute(cs, 3)); ge.userData.own = true; const m = new THREE.Mesh(ge, BAKED); m.position.set(sh.lx, sh.ly, 0); m.userData.keep = true; r.add(m); }
      }
      const node = bake(r, { receive: true }); world.add(node); nodes.push({ b, node });
    }
    crates = planks = logs = null;
    if (crateList.length) { crates = new THREE.InstancedMesh(BOX, crateMat, crateList.length * 2); crates.castShadow = crates.receiveShadow = true; crates.frustumCulled = false; crates.instanceMatrix.setUsage(THREE.DynamicDrawUsage); world.add(crates); }
    if (plankList.length) { planks = new THREE.InstancedMesh(BOX, plankMat, plankList.length); planks.castShadow = planks.receiveShadow = true; planks.frustumCulled = false; planks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); plankList.forEach((p, i) => planks.setColorAt(i, p.col)); world.add(planks); }
    if (logList.length) { logs = new THREE.InstancedMesh(logGeo, BAKED, logList.length); logs.castShadow = logs.receiveShadow = true; logs.frustumCulled = false; logs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); world.add(logs); }
    for (const rp of L.ropes) for (const z of [-1.35, 1.35]) { const m = new THREE.Mesh(CYL, M("#6b3f1a")); m.userData.z = z; world.add(m); ropes.push({ rp, m }); }
    coins = null;
    if (L.coins.length) { coins = new THREE.InstancedMesh(coinGeo, coinMat, L.coins.length); coins.castShadow = true; coins.frustumCulled = false; coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage); world.add(coins); }
  }
  function syncDynamics(t) {
    if (crates) { crateList.forEach((q, i) => { const b = q.b, s = b.dead ? 0 : q.s; crates.setMatrixAt(i * 2, setM(b.x, b.y, q.s * 0.52, b.a, s, s, s)); crates.setMatrixAt(i * 2 + 1, setM(b.x, b.y, -q.s * 0.52, b.a, s, s, s)); }); crates.instanceMatrix.needsUpdate = true; }
    if (planks) { plankList.forEach((q, i) => { const b = q.b, k = b.dead ? 0 : 1; planks.setMatrixAt(i, setM(b.x + b.c * q.cx - b.s * q.cy, b.y + b.s * q.cx + b.c * q.cy, 0, b.a + q.a, q.w * k, q.h * k, (DEPTH - 0.1) * k)); }); planks.instanceMatrix.needsUpdate = true; }
    if (logs) { logList.forEach((b, i) => { const r = b.dead ? 0 : b.shapes[0].r; logs.setMatrixAt(i, setM(b.x, b.y, 0, b.a, r, r, DEPTH - 0.2)); }); logs.instanceMatrix.needsUpdate = true; }
    for (const n of nodes) { n.node.visible = !n.b.dead; n.node.position.set(n.b.x, n.b.y, 0); n.node.rotation.z = n.b.a; }
    for (const r of ropes) { const a = r.rp.a.world(r.rp.la[0], r.rp.la[1]), b = r.rp.b.world(r.rp.lb[0], r.rp.lb[1]), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); r.m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, r.m.userData.z); r.m.scale.set(0.05, l, 0.05); r.m.rotation.z = Math.atan2(dy, dx) - Math.PI / 2; }
    if (coins) { L.coins.forEach((k, i) => { _o.position.set(k.x, k.y + Math.sin(t * 3 + k.x) * 0.06, 0); _o.rotation.set(0, t * 4 + k.x, 0); _o.scale.setScalar(k.got ? 0 : 1); _o.updateMatrix(); coins.setMatrixAt(i, _o.matrix); }); coins.instanceMatrix.needsUpdate = true; }
    if (flag) { const p = flag.geometry.attributes.position, base = flag.userData.base, wv = L.state === "win" ? 9 : 3; for (let i = 0; i < p.count; i++) { const x = base[i * 3] + 1.15; p.setZ(i, Math.sin(t * wv + x * 2.4) * 0.12 * x); p.setY(i, base[i * 3 + 1] + Math.sin(t * wv + x * 1.7) * 0.04 * x); } p.needsUpdate = true; }
  }

  // ---------- pick the line: grid, ghost ramps, signs ----------
  function buildMaths() {
    maths = L.maths.map((Mq) => {
      const u = Mq.u, ys = [Mq.A[1], Mq.B[1]];
      for (const o of Mq.opts) ys.push(o.m * Mq.A[0] + o.b, o.m * Mq.B[0] + o.b);
      const gx0 = Mq.A[0] - 1, gx1 = Mq.B[0] + 1, lo = Math.min(Mq.A[1], Mq.B[1]), hi = Math.max(Mq.A[1], Mq.B[1]), gy0 = Math.max(lo - 3, Math.floor(Math.min(...ys)) - 1), gy1 = Math.min(hi + 3, Math.ceil(Math.max(...ys)) + 1);
      const X = (x) => Mq.ox + x * u, Y = (y) => Mq.oy + y * u, grp = new THREE.Group(), S = 56, nx = gx1 - gx0, ny = gy1 - gy0;
      const tex = canvasTex(nx * S + 40, ny * S + 40, (x, w, h) => {
        const px = (v) => 20 + (v - gx0) * S, py = (v) => h - 20 - (v - gy0) * S;
        x.fillStyle = "rgba(255,255,255,0.2)"; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 18); x.fill();
        x.strokeStyle = "rgba(255,255,255,0.85)"; x.lineWidth = 2; x.beginPath(); for (let i = gx0; i <= gx1; i++) { x.moveTo(px(i), py(gy0)); x.lineTo(px(i), py(gy1)); } for (let j = gy0; j <= gy1; j++) { x.moveTo(px(gx0), py(j)); x.lineTo(px(gx1), py(j)); } x.stroke();
        x.strokeStyle = "rgba(30,58,138,0.85)"; x.lineWidth = 5; x.beginPath(); if (gy0 <= 0 && gy1 >= 0) { x.moveTo(px(gx0), py(0)); x.lineTo(px(gx1), py(0)); } if (gx0 <= 0 && gx1 >= 0) { x.moveTo(px(0), py(gy0)); x.lineTo(px(0), py(gy1)); } x.stroke();
        x.font = "800 20px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#1e3a8a"; x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 4; x.lineJoin = "round";
        const lab = (s, a, b) => { x.strokeText(s, a, b); x.fillText(s, a, b); };
        if (gy0 <= 0 && gy1 >= 0) for (let i = gx0; i <= gx1; i++) lab(i, px(i) + (i === 0 ? -12 : 0), py(0) + 14);
        if (gx0 <= 0 && gx1 >= 0) for (let j = gy0; j <= gy1; j++) if (j) lab(j, px(0) - 14, py(j));
      });
      const plane = new THREE.Mesh(own(new THREE.PlaneGeometry((nx + 40 / S) * u, (ny + 40 / S) * u)), own(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })));
      plane.geometry.userData.own = true; plane.position.set(X((gx0 + gx1) / 2), Y((gy0 + gy1) / 2), 0); plane.renderOrder = 2; grp.add(plane);
      for (const [p, colr] of [[Mq.A, "#ffffff"], [Mq.B, "#fde047"]]) { const s = new THREE.Mesh(SPH, M(colr, { emissive: colr, emissiveIntensity: 0.35 })); s.scale.setScalar(0.3); s.position.set(X(p[0]), Y(p[1]), 0); grp.add(s); const ring = new THREE.Mesh(CYL, M("#1e3a8a")); ring.scale.set(0.36, 0.1, 0.36); ring.rotation.x = Math.PI / 2; ring.position.copy(s.position); grp.add(ring); }
      const pole = new THREE.Mesh(CYL, M("#1e3a8a")); pole.scale.set(0.05, 1.5, 0.05); pole.position.set(X(Mq.B[0]), Y(Mq.B[1]) + 0.75, -1.5); grp.add(pole);
      const pen = new THREE.Mesh(extrude([[0, 0], [0.75, -0.25], [0, -0.5]], 0.03, 0), M("#fde047")); pen.position.set(X(Mq.B[0]), Y(Mq.B[1]) + 1.5, -1.5); grp.add(pen);
      const ghosts = Mq.opts.map((o, k) => {
        const xa = Mq.A[0], xb = Mq.ghost === "stub" ? xa + 1 : Mq.B[0];
        let t0 = 0, t1 = 1; const ya = o.m * xa + o.b, yb = o.m * xb + o.b;
        if (ya !== yb) { const ta = (gy0 - ya) / (yb - ya), tb = (gy1 - ya) / (yb - ya); t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb)); } else if (ya < gy0 || ya > gy1) t1 = -1;
        if (t1 - t0 < 0.05) return null;
        const p0 = [X(xa + (xb - xa) * t0), Y(ya + (yb - ya) * t0)], p1 = [X(xa + (xb - xa) * t1), Y(ya + (yb - ya) * t1)], dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const gg = new THREE.Group(); gg.position.set((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0); gg.rotation.z = a;
        const slab = new THREE.Mesh(BOX, own(new THREE.MeshStandardMaterial({ color: OPT[k], transparent: true, opacity: 0.4, depthWrite: false, emissive: OPT[k], emissiveIntensity: 0.25 }))); slab.scale.set(l, 0.3, DEPTH); slab.position.y = -0.15; slab.renderOrder = 3;
        const line = new THREE.Mesh(BOX, own(new THREE.MeshBasicMaterial({ color: OPT[k], transparent: true, opacity: 0.95, fog: false }))); line.scale.set(l, 0.1, 0.14); line.renderOrder = 4;
        const edge = new THREE.LineSegments(own(new THREE.EdgesGeometry(BOX)), own(new THREE.LineBasicMaterial({ color: OPT[k], transparent: true, opacity: 0.9 }))); edge.geometry.userData.own = true; edge.scale.copy(slab.scale); edge.position.copy(slab.position);
        const bt = canvasTex(64, 64, (x) => { x.fillStyle = OPT[k]; x.strokeStyle = "#fff"; x.lineWidth = 5; x.beginPath(); x.arc(32, 32, 27, 0, TAU); x.fill(); x.stroke(); x.fillStyle = "#fff"; x.font = "900 36px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(k + 1, 32, 34); });
        const badge = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: bt, depthTest: false, fog: false }))); badge.scale.setScalar(0.85); badge.renderOrder = 6;
        const f = Mq.ghost === "stub" ? 0.5 : clamp((0.42 + k * 0.16 - t0) / (t1 - t0), 0.1, 0.9); badge.position.set((f - 0.5) * l, 0.1, 0);
        gg.add(slab, line, edge, badge); grp.add(gg);
        return { gg, slab, line, edge, badge };
      });
      const signs = Mq.opts.map((o, k) => {
        const st = canvasTex(512, 136, (x) => { x.fillStyle = "#ffffff"; x.strokeStyle = OPT[k]; x.lineWidth = 12; x.beginPath(); x.roundRect(8, 8, 496, 120, 40); x.fill(); x.stroke(); x.fillStyle = OPT[k]; x.beginPath(); x.arc(66, 68, 40, 0, TAU); x.fill(); x.fillStyle = "#fff"; x.font = "900 50px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(k + 1, 66, 71); x.fillStyle = "#0f172a"; x.font = `900 ${o.label.length > 11 ? 52 : 60}px system-ui, sans-serif`; x.fillText(o.label, 66 + (512 - 66) / 2 - 6, 72); });
        const s = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 136 / 512)), own(new THREE.MeshBasicMaterial({ map: st, transparent: true, fog: false, depthTest: false }))); s.geometry.userData.own = true; s.renderOrder = 7; grp.add(s);
        return s;
      });
      world.add(grp);
      return { M: Mq, grp, ghosts, signs, plane, ramp: null, picked: -2, cx: X((gx0 + gx1) / 2), top: Y(gy1) };
    });
  }
  function syncMaths(s, D, T) {
    view.tags = [];
    maths.forEach((q, mi) => {
      const Mq = q.M, show = !s.poster;
      q.grp.visible = show;
      if (!show) return;
      if (q.picked !== Mq.picked) {
        q.picked = Mq.picked;
        if (q.ramp) { disposeTree(q.ramp); q.ramp = null; }
        if (Mq.body) { const lv = Mq.body.shapes[0].lv, b = boxOf(lv), r = new THREE.Group(), P = parts(r); P.box(b.w, b.h, DEPTH, M("#d9a05b"), 0, 0, 0); P.box(b.w, 0.05, DEPTH - 0.5, M("#f1c27a"), 0, b.h / 2, 0); for (let i = 0; i < 2; i++) P.box(b.w, b.h + 0.06, 0.16, M("#8a5a22"), 0, 0, (i - 0.5) * (DEPTH - 0.1)); q.ramp = bake(r, { receive: true }); q.ramp.position.set(b.cx, b.cy, 0); q.ramp.rotation.z = b.a; world.add(q.ramp); }
      }
      const active = mi === s.mi, past = L.car.chassis.x > Mq.x0 + 2;
      q.ghosts.forEach((gh, k) => { if (!gh) return; const on = (Mq.ghost !== "none" || Mq.picked >= 0) && Mq.picked !== k; gh.gg.visible = on; const f = Mq.picked >= 0 ? 0.25 : active ? 1 : 0.6; gh.slab.material.opacity = 0.42 * f; gh.line.material.opacity = 0.95 * f; gh.edge.material.opacity = 0.9 * f; gh.badge.visible = Mq.picked < 0 && Mq.ghost !== "none"; });
      // signs keep one size on screen so the equations are always readable
      const sw = 172 / s.cam.z, gap = 12 / s.cam.z, halfH = D * Math.tan((FOV * Math.PI) / 360), top = Math.min(q.top + sw * 0.2, T.y + halfH * 0.66), halfW = halfH * (W / H);
      const cx = clamp(q.cx, T.x - halfW * 0.9 + (sw * 1.5 + gap), Math.max(T.x - halfW * 0.9 + (sw * 1.5 + gap), T.x + halfW * 0.84 - (sw * 1.5 + gap)));
      q.signs.forEach((sg, k) => {
        sg.visible = !past; if (past) return;
        sg.scale.setScalar(sw * (Mq.picked === k ? 1.08 : 1)); sg.position.set(cx + (k - 1) * (sw + gap), top, 0.4); sg.quaternion.copy(camera.quaternion);
        sg.material.opacity = Mq.picked >= 0 && Mq.picked !== k ? 0.45 : 1;
        if (active) { const p = view.project(sg.position.x, sg.position.y, sg.position.z), pw = 172 * (KW * D / (960 / s.cam.z)); view.tags.push({ x: p[0] - 86, y: p[1] - 23, w: 172, h: 46, k, pw }); }
      });
    });
  }

  // ---------- level in, level out ----------
  view.setLevel = (lv, o = {}) => {
    if (world) disposeTree(world);
    disposeCar(car); disposeCar(ghost); car = ghost = null; fx.clear();
    L = lv; th = THEMES[L.def.th || 0]; world = new THREE.Group(); scene.add(world); carZ = 0;
    low = 1e9; for (const ln of L.lines) for (const p of ln.pts) low = Math.min(low, p[1]);
    scene.background = skyTex[L.def.th || 0]; scene.fog = new THREE.Fog(th.fog, 60, 330);
    hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.kind === 3 ? 1.05 : 1.25; sun.color.set(th.sunc); sun.intensity = th.kind === 3 ? 1.5 : 2.2;
    buildTerrain(); buildScenery(); buildProps(); buildDynamics(); buildMaths();
    car = buildCar(L.car.key, o.look || {}); world.add(car.hull, ...car.wheels);
    ghost = buildCar(L.car.key, o.look || {}, { ghost: true }); ghostRoot = new THREE.Group(); const inner = restPose(ghost); inner.position.set(L.car.off[0], L.car.off[1], 0); ghostRoot.add(inner); ghostRoot.visible = false; world.add(ghostRoot);
  };
  view.project = (x, y, z = 0) => { _v.set(x, y, z).project(camera); return [(_v.x * 0.5 + 0.5) * 960, (0.5 - _v.y * 0.5) * 540]; };
  view.puff = (x, y, o = {}) => fx.puff(x, y, o.z ?? carZ, o);

  /** s: { cam: { x, y, z }, t, pose, ghost: [x, y, a] or null, mi, poster, shake: [x, y], yaw, pitch } */
  view.render = (s) => {
    if (!L) return;
    const c = L.car.chassis, t = s.t;
    // the loop is a corkscrew in depth: slide the buggy sideways as it goes round
    let zt = 0;
    for (const lp of L.loops) {
      const dx = c.x - lp.cx, dy = c.y - lp.cy, d = Math.hypot(dx, dy), u = ((((Math.atan2(dy, dx) + Math.PI / 2) % TAU) + TAU) % TAU) / TAU, S = 1.25;
      if (lp.phase === 0) { if (dx <= 0 && dx > -lp.R - 6 && dy < 0) zt = S * clamp((dx + lp.R + 6) / (lp.R + 4), 0, 1); else if (dx > 0 && d < lp.R + 0.8) zt = S * (1 - 2 * u); }
      else zt = dx < 0 || dy > 0 ? S * (1 - 2 * u) : -S * clamp(1 - dx / (lp.R + 1.2), 0, 1);
    }
    carZ += (zt - carZ) * 0.3;
    const off = c.world(L.car.off[0], L.car.off[1]);
    car.hull.position.set(off[0], off[1], carZ); car.hull.rotation.z = c.a;
    L.car.wheels.forEach((w, i) => { car.wheels[i].position.set(w.x, w.y, carZ); car.wheels[i].rotation.z = w.a; });
    poseCar(car, s.pose, t);
    ghostRoot.visible = !!s.ghost;
    if (s.ghost) { ghostRoot.position.set(s.ghost[0], s.ghost[1], -0.02); ghostRoot.rotation.z = s.ghost[2]; }
    syncDynamics(t);
    fx.sync();
    // camera: side-on, a little from the front and above
    const zpx = s.cam.z, D = 960 / zpx / KW, yaw = s.yaw ?? view.yaw, pitch = s.pitch ?? view.pitch, T = { x: s.cam.x + 96 / zpx, y: s.cam.y + 75.6 / zpx };
    const cp = Math.cos(pitch), sh = s.shake || [0, 0];
    camera.position.set(T.x + D * Math.sin(yaw) * cp + sh[0] / zpx, T.y + D * Math.sin(pitch) - sh[1] / zpx, D * Math.cos(yaw) * cp);
    camera.lookAt(T.x + sh[0] / zpx, T.y - sh[1] / zpx, 0);
    camera.updateMatrixWorld();
    sun.target.position.set(T.x, T.y - 2, 0); sun.position.set(T.x - 16, T.y + 34, 26);
    if (sunDisc) { sunDisc.position.set(camera.position.x + 95 * (s.poster ? -0.2 : 1), camera.position.y + 34, -330); sunDisc.quaternion.copy(camera.quaternion); }
    syncMaths(s, D, T);
    renderer.render(scene, camera);
  };
  return view;
}
