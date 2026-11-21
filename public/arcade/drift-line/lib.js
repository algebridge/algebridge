// Small three.js helpers shared by this game's modules: toon ramp, merged vertex-colored
// geometry (one draw call per prop), rounded boxes and canvas text labels.
import * as THREE from "../vendor/three.module.min.js";
import { FONT } from "../kit/kit.js";

/** A stepped ramp for MeshToonMaterial. */
export function toonRamp(steps = [90, 170, 255]) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; });
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Rounded box centered on the origin. r is the edge radius. */
export function rbox(w, h, d, r = 0.08, seg = 3) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const iw = w - 2 * r, ih = h - 2 * r, c = Math.min(r, iw / 2, ih / 2);
  const s = new THREE.Shape();
  const x0 = -iw / 2, y0 = -ih / 2, x1 = iw / 2, y1 = ih / 2;
  s.moveTo(x0 + c, y0);
  s.lineTo(x1 - c, y0); s.quadraticCurveTo(x1, y0, x1, y0 + c);
  s.lineTo(x1, y1 - c); s.quadraticCurveTo(x1, y1, x1 - c, y1);
  s.lineTo(x0 + c, y1); s.quadraticCurveTo(x0, y1, x0, y1 - c);
  s.lineTo(x0, y0 + c); s.quadraticCurveTo(x0, y0, x0 + c, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
/**
 * Merge parts into one non-indexed geometry with vertex colors.
 * part: { g: geometry, c: color, p: [x,y,z], r: [rx,ry,rz], s: number | [x,y,z] }. The source geometries are disposed.
 */
export function merge(parts) {
  let n = 0;
  const list = parts.map((part) => {
    const g = part.g.index ? part.g.toNonIndexed() : part.g.clone();
    const s = part.s ?? 1;
    _p.set(...(part.p || [0, 0, 0]));
    _e.set(...(part.r || [0, 0, 0]));
    _q.setFromEuler(_e);
    Array.isArray(s) ? _s.set(...s) : _s.set(s, s, s);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    n += g.attributes.position.count;
    part.g.dispose();
    return [g, part.c];
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const [g, c] of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    _c.set(c);
    const k = g.attributes.position.count;
    for (let i = 0; i < k; i++) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; }
    o += k;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

/** A canvas texture for a text label. draw(text, { bg, fg, edge, sub }) repaints it. */
export function label(w = 512, h = 256, aniso = 8) {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  const rr = (x, y, ww, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, ww, hh, r); };
  const draw = (text, o = {}) => {
    const pad = Math.round(h * 0.06);
    ctx.clearRect(0, 0, w, h);
    rr(pad / 2, pad / 2, w - pad, h - pad, h * 0.2);
    ctx.fillStyle = o.edge || "#1e3a8a"; ctx.fill();
    rr(pad * 1.7, pad * 1.7, w - pad * 3.4, h - pad * 3.4, h * 0.14);
    ctx.fillStyle = o.bg || "#ffffff"; ctx.fill();
    ctx.fillStyle = o.fg || "#0f172a";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let size = h * (o.size || 0.62);
    const t = String(text);
    ctx.font = `900 ${size}px ${FONT}`;
    const max = w - pad * 6;
    const tw = ctx.measureText(t).width;
    if (tw > max) { size *= max / tw; ctx.font = `900 ${size}px ${FONT}`; }
    ctx.fillText(t, w / 2, h / 2 + size * 0.04);
    tex.needsUpdate = true;
  };
  return { canvas, ctx, tex, draw };
}

/** Sky dome with a vertical gradient (3 stops) and a soft sun. */
export function skyDome({ top, mid, low, sun, sunDir, sunSize = 0.9995, glow = 6 }) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, low: { value: new THREE.Color(low) }, sun: { value: new THREE.Color(sun) }, sunDir: { value: new THREE.Vector3(...sunDir).normalize() }, sunSize: { value: sunSize }, glow: { value: glow } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 top, mid, low, sun, sunDir; uniform float sunSize, glow;
      void main(){ vec3 d = normalize(vDir); float h = d.y;
        vec3 c = mix(low, mid, smoothstep(-0.02, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.75, h));
        c = mix(c, low * 0.92, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, sunDir), 0.0);
        c += sun * (pow(s, 900.0 / glow) * 0.55 + pow(s, 40.0 / glow * 6.0) * 0.35);
        c = mix(c, vec3(1.0, 0.98, 0.9), smoothstep(sunSize, sunSize + 0.0004, s));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}
