// Bridge Run props: obstacles, coins, pickups, the answer gate, Archie, the gull, particles and text sprites.
import { g, THREE, scene, toon, vtoon, ramp, COL, LANE, ANISO } from "./world.js";
import { buildArchie3D, rand, FONT } from "../kit/kit.js";
import { rbox, merge, label } from "./lib.js";

export const TOP = 2.2; // height of the high route
export const RAMP_L = 5.5;
export const T = { HURDLE: 1, OVER: 2, SOLID: 3, OPEN: 4, RAMP: 5, HOLE: 6, FLOCK: 7, GUST: 8 };
// hw: half the drawn width that can touch Archie (the cone is its body, the flat base plate is walkable). zin: how far the drawn shape sits inside s0..s1.
export const KIND = {
  barrier: { t: T.HURDLE, hw: 0.98, cap: 24 },
  beam: { t: T.OVER, hw: 1.1, cap: 24 },
  crate: { t: T.SOLID, top: 1.3, len: 1.7, hw: 0.85, cap: 24 },
  cone: { t: T.SOLID, top: TOP, len: 1.3, hw: 0.42, zin: 0.23, cap: 24 },
  cart: { t: T.SOLID, top: TOP, len: 2.4, hw: 0.88, cap: 8 },
  truck: { t: T.SOLID, top: TOP, len: 9, hw: 0.96, cap: 8 },
  tram: { t: T.SOLID, top: TOP, len: 18, hw: 0.99, cap: 6 },
  scaffold: { t: T.OPEN, top: TOP, len: 7, hw: 1.05, cap: 10 },
  ramp: { t: T.RAMP, top: TOP, len: RAMP_L, hw: 0.9, cap: 8 },
  hole: { t: T.HOLE, hw: LANE / 2, cap: 24 },
  flock: { t: T.FLOCK, len: 4, hw: 0.85, cap: 0 },
  gust: { t: T.GUST, hw: 0, cap: 0 },
};
{
  const stripes = (w, h, d, y, a, b, n = 6, z = 0) => Array.from({ length: n }, (_, i) => ({ g: rbox(w / n + 0.01, h, d, 0.05, 2), c: i % 2 ? a : b, p: [-w / 2 + (i + 0.5) * (w / n), y, z] }));
  KIND.barrier.geo = merge([
    ...stripes(1.95, 0.42, 0.16, 0.62, COL.red, COL.white),
    { g: rbox(0.14, 0.84, 0.56, 0.05, 2), c: COL.navy, p: [-0.78, 0.42, 0] },
    { g: rbox(0.14, 0.84, 0.56, 0.05, 2), c: COL.navy, p: [0.78, 0.42, 0] },
    { g: new THREE.SphereGeometry(0.11, 8, 6), c: COL.yellow, p: [-0.78, 0.92, 0] },
    { g: new THREE.SphereGeometry(0.11, 8, 6), c: COL.yellow, p: [0.78, 0.92, 0] },
  ]);
  KIND.beam.geo = merge([
    ...stripes(2.16, 0.62, 0.3, 1.55, COL.amber, COL.navy, 7),
    { g: rbox(0.16, 2.7, 0.2, 0.05, 2), c: COL.navy, p: [-1.02, 1.35, 0] },
    { g: rbox(0.16, 2.7, 0.2, 0.05, 2), c: COL.navy, p: [1.02, 1.35, 0] },
    { g: rbox(2.2, 0.16, 0.2, 0.05, 2), c: COL.navy, p: [0, 2.72, 0] },
    { g: rbox(0.5, 0.12, 0.7, 0.04, 2), c: COL.navy, p: [-1.02, 0.06, 0] },
    { g: rbox(0.5, 0.12, 0.7, 0.04, 2), c: COL.navy, p: [1.02, 0.06, 0] },
  ]);
  const frame = (s, y, z) => [
    { g: rbox(s, 0.16, 0.08, 0.03, 1), c: COL.woodDark, p: [0, y + s / 2 - 0.1, z] }, { g: rbox(s, 0.16, 0.08, 0.03, 1), c: COL.woodDark, p: [0, y - s / 2 + 0.1, z] },
    { g: rbox(0.16, s, 0.08, 0.03, 1), c: COL.woodDark, p: [s / 2 - 0.1, y, z] }, { g: rbox(0.16, s, 0.08, 0.03, 1), c: COL.woodDark, p: [-s / 2 + 0.1, y, z] },
    { g: rbox(0.15, s * 1.25, 0.07, 0.03, 1), c: COL.woodDark, p: [0, y, z], r: [0, 0, Math.PI / 4] },
  ];
  KIND.crate.geo = merge([
    { g: rbox(1.7, 1.3, 1.7, 0.1), c: COL.wood, p: [0, 0.65, 0] }, ...frame(1.25, 0.65, 0.86),
    { g: rbox(1.5, 0.08, 1.5, 0.03, 1), c: "#e9b877", p: [0, 1.3, 0] },
  ]);
  KIND.cone.geo = merge([
    { g: rbox(1.5, 0.16, 1.3, 0.06, 2), c: COL.navy, p: [0, 0.08, 0] },
    { g: new THREE.CylinderGeometry(0.1, 0.6, 2.0, 14), c: COL.orange, p: [0, 1.14, 0] },
    { g: new THREE.CylinderGeometry(0.335, 0.435, 0.34, 14), c: COL.white, p: [0, 1.0, 0] },
    { g: new THREE.CylinderGeometry(0.185, 0.26, 0.26, 14), c: COL.white, p: [0, 1.56, 0] },
    { g: new THREE.SphereGeometry(0.17, 10, 8), c: COL.yellow, p: [0, 2.2, 0] },
  ]);
  const wheel = (x, z, r = 0.36) => ({ g: new THREE.CylinderGeometry(r, r, 0.26, 12), c: COL.tire, p: [x, r, z], r: [0, 0, Math.PI / 2] });
  KIND.cart.geo = merge([
    { g: rbox(1.7, 0.8, 2.4, 0.16), c: COL.yellow, p: [0, 0.82, 0] },
    { g: rbox(1.5, 0.95, 1.1, 0.16), c: COL.cream, p: [0, 1.6, -0.45] },
    { g: rbox(1.2, 0.5, 0.06, 0.02, 1), c: COL.glass, p: [0, 1.68, 0.11] },
    { g: rbox(1.74, 0.2, 0.3, 0.05, 2), c: COL.navy, p: [0, 0.6, 1.14] },
    { g: new THREE.SphereGeometry(0.2, 10, 8), c: COL.red, p: [0, 2.16, -0.45] },
    { g: new THREE.SphereGeometry(0.16, 8, 6), c: "#fff7c2", p: [-0.6, 0.86, 1.2] }, { g: new THREE.SphereGeometry(0.16, 8, 6), c: "#fff7c2", p: [0.6, 0.86, 1.2] },
    { g: rbox(0.9, 0.3, 0.6, 0.06, 2), c: COL.red, p: [0, 1.36, 0.7] },
    wheel(-0.88, 0.75), wheel(0.88, 0.75), wheel(-0.88, -0.75), wheel(0.88, -0.75),
  ]);
  // maintenance truck: a flat bed you can run along. Near end (+z) faces the runner.
  KIND.truck.geo = merge([
    { g: rbox(1.9, 1.5, 9, 0.16), c: COL.orange, p: [0, 1.38, 0] },
    { g: rbox(1.74, 0.1, 8.7, 0.04, 1), c: COL.cream, p: [0, 2.15, 0] },
    { g: rbox(1.94, 0.3, 9.04, 0.08, 2), c: COL.navy, p: [0, 0.82, 0] },
    ...stripes(1.8, 0.5, 0.08, 1.5, COL.yellow, COL.navy, 6, 4.5),
    { g: rbox(0.08, 0.5, 2.4, 0.03, 1), c: COL.white, p: [-0.96, 1.5, 2.4] }, { g: rbox(0.08, 0.5, 2.4, 0.03, 1), c: COL.white, p: [0.96, 1.5, 2.4] },
    { g: rbox(0.08, 0.5, 2.4, 0.03, 1), c: COL.white, p: [-0.96, 1.5, -1.8] }, { g: rbox(0.08, 0.5, 2.4, 0.03, 1), c: COL.white, p: [0.96, 1.5, -1.8] },
    { g: new THREE.SphereGeometry(0.13, 8, 6), c: COL.red, p: [-0.7, 1.0, 4.52] }, { g: new THREE.SphereGeometry(0.13, 8, 6), c: COL.red, p: [0.7, 1.0, 4.52] },
    wheel(-0.9, 3.2, 0.44), wheel(0.9, 3.2, 0.44), wheel(-0.9, 0, 0.44), wheel(0.9, 0, 0.44), wheel(-0.9, -3.2, 0.44), wheel(0.9, -3.2, 0.44),
  ]);
  const RL = Math.hypot(RAMP_L, TOP), RA = Math.atan2(TOP, RAMP_L);
  KIND.ramp.geo = merge([
    { g: rbox(1.8, 0.14, RL, 0.05, 1), c: "#e9b877", p: [0, TOP / 2 - 0.05, 0], r: [RA, 0, 0] },
    { g: rbox(0.12, 0.26, RL, 0.05, 1), c: COL.yellow, p: [-0.9, TOP / 2 + 0.04, 0], r: [RA, 0, 0] },
    { g: rbox(0.12, 0.26, RL, 0.05, 1), c: COL.yellow, p: [0.9, TOP / 2 + 0.04, 0], r: [RA, 0, 0] },
    ...[-1.6, -0.2, 1.2].map((z) => ({ g: rbox(1.0, 0.05, 0.5, 0.02, 1), c: COL.white, p: [0, TOP / 2 + 0.03 - (z / RAMP_L) * TOP, z], r: [RA, 0, 0] })),
    { g: rbox(0.14, 1.9, 0.14, 0.04, 1), c: COL.navy, p: [-0.8, 0.95, -2.4] }, { g: rbox(0.14, 1.9, 0.14, 0.04, 1), c: COL.navy, p: [0.8, 0.95, -2.4] },
    { g: rbox(0.14, 0.9, 0.14, 0.04, 1), c: COL.navy, p: [-0.8, 0.45, -0.2] }, { g: rbox(0.14, 0.9, 0.14, 0.04, 1), c: COL.navy, p: [0.8, 0.45, -0.2] },
  ]);
  // a stopped tram
  const win = [];
  for (let z = -7.4; z <= 7.5; z += 2.1) for (const s of [-1, 1]) win.push({ g: rbox(0.06, 0.56, 1.5, 0.02, 1), c: COL.glass, p: [s * 0.985, 1.55, z] });
  KIND.tram.geo = merge([
    { g: rbox(1.96, 1.76, 18, 0.3), c: "#f2545b", p: [0, 1.3, 0] },
    { g: rbox(2.0, 0.34, 18.04, 0.1, 2), c: COL.cream, p: [0, 1.02, 0] },
    { g: rbox(1.7, 0.1, 17.5, 0.04, 1), c: "#ffe7c2", p: [0, 2.15, 0] },
    { g: rbox(1.4, 0.6, 0.08, 0.03, 1), c: COL.glass, p: [0, 1.6, 9.0] },
    { g: new THREE.SphereGeometry(0.15, 8, 6), c: "#fff7c2", p: [-0.62, 0.78, 9.02] }, { g: new THREE.SphereGeometry(0.15, 8, 6), c: "#fff7c2", p: [0.62, 0.78, 9.02] },
    { g: rbox(1.9, 0.26, 17.6, 0.08, 2), c: COL.navy, p: [0, 0.36, 0] },
    ...win,
  ]);
  KIND.scaffold.geo = merge([
    { g: rbox(2.1, 0.16, 7, 0.05, 1), c: "#e9b877", p: [0, TOP - 0.08, 0] },
    { g: rbox(2.14, 0.1, 0.24, 0.04, 1), c: COL.yellow, p: [0, TOP - 0.06, 3.42] },
    ...[[-0.98, 3.3], [0.98, 3.3], [-0.98, -3.3], [0.98, -3.3], [-0.98, 0], [0.98, 0]].map(([x, z]) => ({ g: new THREE.CylinderGeometry(0.06, 0.06, TOP - 0.1, 6), c: COL.navy, p: [x, (TOP - 0.1) / 2, z] })),
    ...[-1, 1].flatMap((s) => [-1.65, 1.65].map((z) => ({ g: rbox(0.05, 0.05, 3.9, 0.02, 1), c: COL.navy, p: [s * 0.98, 1.05, z], r: [z > 0 ? 0.55 : -0.55, 0, 0] }))),
  ]);
  // a missing deck plate: open water below, girders at the sides. Scaled along z per instance.
  KIND.hole.geo = merge([
    { g: new THREE.BoxGeometry(LANE, 0.02, 1), c: "#22386f", p: [0, 0.012, 0] },
    { g: new THREE.BoxGeometry(LANE - 0.5, 0.02, 0.86), c: "#4b83d6", p: [0, 0.02, 0] },
    { g: new THREE.BoxGeometry(0.5, 0.02, 0.2), c: "#9cc3f5", p: [0.2, 0.026, 0.1] },
    { g: new THREE.BoxGeometry(0.12, 0.05, 1), c: COL.orange, p: [-LANE / 2 + 0.06, 0.03, 0] },
    { g: new THREE.BoxGeometry(0.12, 0.05, 1), c: COL.orange, p: [LANE / 2 - 0.06, 0.03, 0] },
  ]);
  for (const k in KIND) {
    const K = KIND[k];
    K.n = 0;
    if (!K.cap) continue;
    const im = new THREE.InstancedMesh(K.geo, vtoon, K.cap);
    im.castShadow = K.t !== T.HOLE; im.receiveShadow = true; im.frustumCulled = false; im.count = 0;
    scene.add(im);
    K.mesh = im;
  }
}
// birds for the flock
export const birdMesh = new THREE.InstancedMesh(merge([
  { g: new THREE.SphereGeometry(0.2, 10, 8), c: "#ffffff", p: [0, 0, 0], s: [0.8, 0.7, 1.6] },
  { g: new THREE.SphereGeometry(0.11, 8, 6), c: "#ffffff", p: [0, 0.06, 0.34] },
  { g: new THREE.ConeGeometry(0.05, 0.16, 6), c: COL.amber, p: [0, 0.05, 0.5], r: [Math.PI / 2, 0, 0] },
  { g: rbox(0.8, 0.04, 0.34, 0.015, 1), c: "#e8eefc", p: [-0.46, 0.16, 0], r: [0, 0, -0.4] },
  { g: rbox(0.8, 0.04, 0.34, 0.015, 1), c: "#e8eefc", p: [0.46, 0.16, 0], r: [0, 0, 0.4] },
  { g: rbox(0.22, 0.045, 0.3, 0.015, 1), c: "#44508a", p: [-0.86, 0.33, 0], r: [0, 0, -0.4] },
  { g: rbox(0.22, 0.045, 0.3, 0.015, 1), c: "#44508a", p: [0.86, 0.33, 0], r: [0, 0, 0.4] },
]), vtoon, 40);
birdMesh.frustumCulled = false; birdMesh.castShadow = true; birdMesh.count = 0;
scene.add(birdMesh);

export const NCOIN = 280;
export const coinMesh = new THREE.InstancedMesh(
  merge([
    { g: new THREE.CylinderGeometry(0.38, 0.38, 0.1, 18), c: "#f6b21b", r: [Math.PI / 2, 0, 0] },
    { g: new THREE.CylinderGeometry(0.26, 0.26, 0.14, 18), c: "#ffe27a", r: [Math.PI / 2, 0, 0] },
  ]),
  toon({ vertexColors: true, emissive: "#8a5a00", emissiveIntensity: 0.55 }), NCOIN);
coinMesh.frustumCulled = false; coinMesh.castShadow = true; coinMesh.count = 0;
scene.add(coinMesh);

// ---------- pickups ----------
export const PICKS = ["magnet", "spring", "x2", "glider", "shield"];
export const PICK_COL = { magnet: "#ef4444", spring: "#22c55e", x2: "#a855f7", glider: "#14b8a6", shield: "#38bdf8" };
export const pick = { group: new THREE.Group(), items: {}, ring: null };
{
  const mk = (parts) => { const m = new THREE.Mesh(merge(parts), toon({ vertexColors: true, emissive: "#333333", emissiveIntensity: 0.5 })); m.castShadow = true; pick.group.add(m); return m; };
  pick.items.magnet = mk([
    { g: new THREE.TorusGeometry(0.34, 0.13, 8, 16, Math.PI), c: "#ef4444", p: [0, 0.05, 0] },
    { g: rbox(0.27, 0.34, 0.27, 0.04, 1), c: "#ef4444", p: [-0.34, -0.1, 0] }, { g: rbox(0.27, 0.34, 0.27, 0.04, 1), c: "#ef4444", p: [0.34, -0.1, 0] },
    { g: rbox(0.28, 0.2, 0.28, 0.04, 1), c: "#f8fafc", p: [-0.34, -0.36, 0] }, { g: rbox(0.28, 0.2, 0.28, 0.04, 1), c: "#f8fafc", p: [0.34, -0.36, 0] },
  ]);
  pick.items.spring = mk([
    { g: rbox(0.36, 0.3, 0.7, 0.1), c: "#22c55e", p: [0, 0.22, 0] }, { g: rbox(0.36, 0.34, 0.34, 0.1), c: "#22c55e", p: [0, 0.48, -0.18] },
    { g: rbox(0.4, 0.1, 0.74, 0.04, 1), c: "#f8fafc", p: [0, 0.05, 0] },
    ...[-0.1, -0.24, -0.38].map((y) => ({ g: new THREE.TorusGeometry(0.2, 0.045, 6, 14), c: "#cbd5e1", p: [0, y, 0], r: [Math.PI / 2, 0, 0] })),
  ]);
  pick.items.x2 = mk([
    { g: new THREE.CylinderGeometry(0.5, 0.5, 0.16, 20), c: "#a855f7", r: [Math.PI / 2, 0, 0] },
    { g: new THREE.CylinderGeometry(0.4, 0.4, 0.2, 20), c: "#f5e9ff", r: [Math.PI / 2, 0, 0] },
    { g: rbox(0.1, 0.42, 0.24, 0.03, 1), c: "#7e22ce", p: [-0.12, 0, 0], r: [0, 0, 0.6] }, { g: rbox(0.1, 0.42, 0.24, 0.03, 1), c: "#7e22ce", p: [-0.12, 0, 0], r: [0, 0, -0.6] },
    { g: rbox(0.1, 0.34, 0.24, 0.03, 1), c: "#7e22ce", p: [0.2, 0, 0] }, { g: rbox(0.1, 0.34, 0.24, 0.03, 1), c: "#7e22ce", p: [0.2, 0, 0], r: [0, 0, 0.9] },
  ]);
  const wingShape = () => { const g2 = new THREE.ConeGeometry(0.75, 1.0, 3); g2.rotateX(-Math.PI / 2); g2.scale(1, 0.12, 1); return g2; };
  pick.items.glider = mk([
    { g: wingShape(), c: "#14b8a6" }, { g: rbox(0.1, 0.1, 0.9, 0.03, 1), c: COL.amber, p: [0, 0.06, 0.05] },
    { g: rbox(0.9, 0.05, 0.05, 0.02, 1), c: COL.navy, p: [0, -0.2, 0.2] },
  ]);
  pick.items.shield = mk([
    { g: new THREE.SphereGeometry(0.4, 16, 12), c: "#7dd3fc" }, { g: new THREE.TorusGeometry(0.47, 0.05, 6, 24), c: "#f8fafc" },
    { g: new THREE.TorusGeometry(0.47, 0.05, 6, 24), c: "#f8fafc", r: [Math.PI / 2, 0, 0] },
  ]);
  pick.ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: "#fff7c2" }));
  pick.group.add(pick.ring);
  pick.group.visible = false;
  scene.add(pick.group);
}

// ---------- answer gate ----------
export const ARCH_COL = ["#ec4899", "#8b5cf6", "#14b8a6"];
export const gate = { group: new THREE.Group(), arches: [], labels: [], planes: [], board: null, boardPlane: null };
{
  const archGeo = merge([
    { g: rbox(0.34, 2.9, 0.44, 0.12), c: "#ffffff", p: [-0.93, 1.45, 0] },
    { g: rbox(0.34, 2.9, 0.44, 0.12), c: "#ffffff", p: [0.93, 1.45, 0] },
    { g: rbox(2.2, 0.46, 0.5, 0.14), c: "#ffffff", p: [0, 2.92, 0] },
    { g: rbox(0.5, 0.2, 0.6, 0.06, 2), c: "#fff1d6", p: [-0.93, 0.1, 0] },
    { g: rbox(0.5, 0.2, 0.6, 0.06, 2), c: "#fff1d6", p: [0.93, 0.1, 0] },
    { g: new THREE.SphereGeometry(0.2, 10, 8), c: "#fff1d6", p: [-0.93, 3.24, 0] },
    { g: new THREE.SphereGeometry(0.2, 10, 8), c: "#fff1d6", p: [0.93, 3.24, 0] },
  ]);
  for (let i = 0; i < 3; i++) {
    const arch = new THREE.Mesh(archGeo, toon({ vertexColors: true, color: ARCH_COL[i] }));
    arch.position.x = (i - 1) * LANE;
    arch.castShadow = true;
    const lb = label(384, 256, ANISO);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.4), new THREE.MeshBasicMaterial({ map: lb.tex, transparent: true, fog: false }));
    plane.renderOrder = 6;
    gate.group.add(arch, plane);
    gate.arches.push(arch); gate.labels.push(lb); gate.planes.push(plane);
  }
  gate.board = label(1024, 256, ANISO);
  gate.boardPlane = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 2.3), new THREE.MeshBasicMaterial({ map: gate.board.tex, transparent: true, fog: false }));
  gate.boardPlane.renderOrder = 7;
  gate.group.add(gate.boardPlane);
  gate.group.visible = false;
  scene.add(gate.group);
}

// ---------- best distance marker ----------
export const bestMark = { group: new THREE.Group(), lb: label(1024, 256, ANISO), plane: null };
{
  const m = new THREE.Mesh(merge([
    { g: rbox(0.22, 5.2, 0.22, 0.06, 1), c: COL.amber, p: [-4.2, 2.6, 0] }, { g: rbox(0.22, 5.2, 0.22, 0.06, 1), c: COL.amber, p: [4.2, 2.6, 0] },
    { g: rbox(8.6, 0.16, 0.16, 0.05, 1), c: COL.amber, p: [0, 5.1, 0] },
    ...Array.from({ length: 12 }, (_, i) => ({ g: new THREE.ConeGeometry(0.26, 0.5, 3), c: i % 2 ? COL.red : COL.white, p: [-3.85 + i * 0.7, 3.2, 0], r: [Math.PI, 0, 0] })),
  ]), vtoon);
  m.castShadow = true;
  bestMark.plane = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: bestMark.lb.tex, transparent: true }));
  bestMark.plane.position.set(0, 4.25, 0.05);
  bestMark.group.add(m, bestMark.plane);
  bestMark.group.visible = false;
  scene.add(bestMark.group);
}

// ---------- Archie ----------
export const root = new THREE.Group(), tilt = new THREE.Group();
export const archie = buildArchie3D(THREE, {});
archie.userData.body.material.gradientMap = ramp;
archie.scale.setScalar(1.25);
archie.position.y = -0.62;
const skinMats = [archie.userData.body.material];
for (const a of archie.userData.arms) for (const c of a.children) { c.material.gradientMap = ramp; skinMats.push(c.material); }
export const setLook = (color) => { for (const m of skinMats) m.color.set(color); };
{
  const pack = new THREE.Mesh(merge([
    { g: rbox(0.4, 0.42, 0.2, 0.08), c: COL.amber, p: [0, 0.56, -0.3] },
    { g: rbox(0.28, 0.14, 0.06, 0.03, 2), c: COL.cream, p: [0, 0.5, -0.41] },
  ]), vtoon);
  pack.castShadow = true;
  archie.add(pack);
}
export const wing = new THREE.Mesh(merge([
  { g: (() => { const g2 = new THREE.ConeGeometry(1.5, 1.5, 3); g2.rotateX(-Math.PI / 2); g2.scale(1, 0.06, 1); return g2; })(), c: "#14b8a6" },
  { g: rbox(0.1, 0.08, 1.5, 0.03, 1), c: COL.amber, p: [0, 0.05, 0] },
  { g: rbox(2.2, 0.06, 0.12, 0.02, 1), c: COL.cream, p: [0, 0.05, 0.55] },
]), vtoon);
wing.castShadow = true; wing.visible = false;
wing.position.set(0, 1.5, 0.1);
export const springs = new THREE.Mesh(merge([-0.26, 0.26].flatMap((x) => [0.02, 0.1, 0.18].map((y) => ({ g: new THREE.TorusGeometry(0.12, 0.035, 6, 12), c: "#22c55e", p: [x, y, 0], r: [Math.PI / 2, 0, 0] })))), vtoon);
springs.visible = false;
tilt.add(archie);
root.add(tilt, wing, springs);
export const shield = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16), new THREE.MeshBasicMaterial({ color: "#8be9ff", transparent: true, opacity: 0.26, depthWrite: false }));
export const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.035, 6, 40), new THREE.MeshBasicMaterial({ color: "#e6fbff", transparent: true, opacity: 0.9 }));
shield.add(shieldRing);
shield.position.y = 0.7;
shield.visible = false;
root.add(shield);
scene.add(root);

// ---------- the gull that closes in after a stumble ----------
export const gull = { group: new THREE.Group(), l: null, r: null };
{
  const body = new THREE.Mesh(merge([
    { g: new THREE.SphereGeometry(0.34, 14, 10), c: "#ffffff", s: [0.85, 0.8, 1.7] },
    { g: new THREE.SphereGeometry(0.2, 12, 8), c: "#ffffff", p: [0, 0.14, -0.56] },
    { g: new THREE.ConeGeometry(0.08, 0.3, 8), c: COL.amber, p: [0, 0.1, -0.84], r: [-Math.PI / 2, 0, 0] },
    { g: new THREE.SphereGeometry(0.035, 6, 5), c: "#0f172a", p: [-0.12, 0.2, -0.68] }, { g: new THREE.SphereGeometry(0.035, 6, 5), c: "#0f172a", p: [0.12, 0.2, -0.68] },
    { g: rbox(0.3, 0.05, 0.4, 0.02, 1), c: "#44508a", p: [0, 0.02, 0.6] },
  ]), vtoon);
  const wg = () => merge([{ g: rbox(1.3, 0.06, 0.6, 0.02, 1), c: "#e8eefc", p: [0.65, 0, 0] }, { g: rbox(0.4, 0.07, 0.5, 0.02, 1), c: "#44508a", p: [1.4, 0, 0] }]);
  gull.l = new THREE.Mesh(wg(), vtoon); gull.r = new THREE.Mesh(wg(), vtoon);
  gull.l.scale.x = -1; gull.l.position.x = -0.2; gull.r.position.x = 0.2;
  body.castShadow = gull.l.castShadow = gull.r.castShadow = true;
  gull.group.add(body, gull.l, gull.r);
  gull.group.scale.setScalar(0.7);
  gull.group.visible = false;
  scene.add(gull.group);
}

// ---------- particles ----------
export const NP = 180;
export const P = { x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP), vz: new Float32Array(NP), life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP), grav: new Float32Array(NP), next: 0 };
export const partMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), NP);
partMesh.frustumCulled = false; partMesh.count = 0;
scene.add(partMesh);
const _col = new THREE.Color();
export function puff(x, y, z, n, color, speed = 3, size = 0.1, up = 2, grav = 12) {
  _col.set(color);
  for (let i = 0; i < n; i++) {
    const k = P.next; P.next = (P.next + 1) % NP;
    P.x[k] = x; P.y[k] = y; P.z[k] = z;
    P.vx[k] = rand(-1, 1) * speed; P.vy[k] = rand(0.2, 1) * speed + up; P.vz[k] = rand(-1, 1) * speed;
    P.life[k] = P.max[k] = rand(0.35, 0.7); P.size[k] = size * rand(0.7, 1.3); P.grav[k] = grav;
    partMesh.setColorAt(k, _col);
  }
  partMesh.instanceColor.needsUpdate = true;
}
/** One particle with an exact velocity (trails, wind). */
export function spark(x, y, z, vx, vy, vz, color, size, life, grav = 0) {
  const k = P.next; P.next = (P.next + 1) % NP;
  P.x[k] = x; P.y[k] = y; P.z[k] = z; P.vx[k] = vx; P.vy[k] = vy; P.vz[k] = vz;
  P.life[k] = P.max[k] = life; P.size[k] = size; P.grav[k] = grav;
  partMesh.setColorAt(k, _col.set(color));
  partMesh.instanceColor.needsUpdate = true;
}
export const NL = 36;
export const lineMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 1), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, fog: false, depthWrite: false }), NL);
lineMesh.frustumCulled = false; lineMesh.visible = false;
scene.add(lineMesh);
export const lineSeed = Array.from({ length: NL }, (_, i) => ({ a: (i / NL) * Math.PI * 2 + rand(0, 0.3), r: rand(2.8, 6.5), o: Math.random(), len: rand(3, 7) }));

// ---------- floating words (pooled sprites, cached textures) ----------
const texCache = new Map();
function wordTex(str, fill) {
  const key = str + fill;
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 128;
  const x = c.getContext("2d");
  x.font = `900 84px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
  let w = x.measureText(str).width;
  if (w > 470) x.font = `900 ${Math.floor((84 * 470) / w)}px ${FONT}`;
  x.lineWidth = 16; x.strokeStyle = "#1e3a8a"; x.strokeText(str, 256, 66);
  x.fillStyle = fill; x.fillText(str, 256, 66);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}
export const words = Array.from({ length: 6 }, () => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, fog: false }));
  sp.visible = false; sp.renderOrder = 20;
  scene.add(sp);
  return { sp, t: 0, life: 0, x: 0, y: 0, s: 0, size: 1, stick: false };
});
let wordNext = 0;
/** Show a word in the world at lane x, height y, distance s. stick: stays until hidden by the game. */
export function say(str, x, y, s, fill = "#fde047", size = 1, life = 0.8, stick = false) {
  const w = words[wordNext]; wordNext = (wordNext + 1) % words.length;
  w.sp.material.map = wordTex(str, fill); w.sp.material.needsUpdate = true;
  w.t = 0; w.life = life; w.x = x; w.y = y; w.s = s; w.size = size; w.stick = stick;
  return w;
}

// ---------- letters to spell a word: floating tiles, one sprite per slot ----------
const letterCache = new Map();
function letterTex(ch) {
  let t = letterCache.get(ch);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.beginPath(); x.roundRect(6, 6, 116, 116, 30); x.fillStyle = "#1e3a8a"; x.fill();
  x.beginPath(); x.roundRect(14, 14, 100, 100, 23); x.fillStyle = "#fbbf24"; x.fill();
  x.beginPath(); x.roundRect(21, 19, 86, 84, 18); x.fillStyle = "#fff7d6"; x.fill();
  x.font = `900 78px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#1e3a8a";
  x.fillText(ch, 64, 66);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  letterCache.set(ch, t);
  return t;
}
export const NLET = 4;
export const letterSprites = Array.from({ length: NLET }, () => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, fog: false }));
  sp.visible = false; sp.renderOrder = 5; sp.userData.ch = "";
  scene.add(sp);
  return sp;
});
export function setLetter(sp, ch) { if (sp.userData.ch !== ch) { sp.userData.ch = ch; sp.material.map = letterTex(ch); sp.material.needsUpdate = true; } }
export function hideProps() { g.stage.querySelector(".ak-hud").style.visibility = "hidden"; }
export function showProps() { g.stage.querySelector(".ak-hud").style.visibility = ""; }
