import * as THREE from "three";
import type { ArenaTheme } from "../world/Arena";
import type { Palette } from "./Materials";
import { disposeTree } from "./Materials";

const VERT = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform vec3 top;
uniform vec3 horizon;
uniform vec3 bottom;
varying vec3 vPos;
void main() {
  float h = normalize(vPos).y;
  vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.5)) : mix(horizon, bottom, pow(-h, 0.6));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

/** A gradient dome, drifting low-poly clouds, a sun or a moon and stars at night. */
export class Sky {
  readonly group = new THREE.Group();
  private readonly dome: THREE.Mesh;
  private readonly uniforms = {
    top: { value: new THREE.Color("#3b1d5e") },
    horizon: { value: new THREE.Color("#ff8c5a") },
    bottom: { value: new THREE.Color("#ffd27a") },
  };
  private dressing: THREE.Group | null = null;
  private clouds: THREE.Group | null = null;

  constructor() {
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 14), mat);
    this.dome.renderOrder = -10;
    this.group.add(this.dome);
  }

  setTheme(t: ArenaTheme, pal: Palette): void {
    this.uniforms.top.value.set(t.skyTop);
    this.uniforms.horizon.value.set(t.skyHorizon);
    this.uniforms.bottom.value.set(t.skyBottom);
    if (this.dressing) {
      this.group.remove(this.dressing);
      disposeTree(this.dressing);
    }
    const d = new THREE.Group();
    this.dressing = d;

    const clouds = new THREE.Group();
    this.clouds = clouds;
    const cloudMat = pal.unlit(t.cloudColor);
    const puff = new THREE.SphereGeometry(1, 10, 7);
    for (let i = 0; i < t.clouds; i++) {
      const c = new THREE.Group();
      const a = (i / t.clouds) * Math.PI * 2 + Math.random() * 0.4;
      const r = 170 + Math.random() * 140;
      c.position.set(Math.cos(a) * r, 40 + Math.random() * 50, Math.sin(a) * r);
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const m = new THREE.Mesh(puff, cloudMat);
        const s = 5 + Math.random() * 7;
        m.position.set((j - n / 2) * s * 0.9, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4);
        m.scale.set(s, s * 0.55, s * 0.8);
        c.add(m);
      }
      clouds.add(c);
    }
    d.add(clouds);

    const [sx, sy, sz] = t.sunFrom;
    const dir = new THREE.Vector3(sx, sy, sz).normalize();
    if (t.night) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 12), pal.unlit("#eef2ff"));
      moon.position.copy(dir).multiplyScalar(380);
      d.add(moon);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 12), pal.unlit("#9fb0ff", 0.18));
      glow.position.copy(moon.position);
      d.add(glow);
      const pts: number[] = [];
      for (let i = 0; i < 700; i++) {
        const u = Math.random();
        const v = Math.random() * 0.9 + 0.08;
        const th = u * Math.PI * 2;
        const ph = Math.acos(1 - v);
        pts.push(Math.sin(ph) * Math.cos(th) * 405, Math.cos(ph) * 405 * 0.98 + 5, Math.sin(ph) * Math.sin(th) * 405);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#d6ddff", size: 2.2, sizeAttenuation: false, fog: false, toneMapped: false }));
      (stars.material as THREE.Material).userData.own = true;
      stars.userData.own = true;
      d.add(stars);
    } else {
      const sun = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12), pal.unlit("#fff6d2"));
      sun.position.copy(dir).multiplyScalar(385);
      d.add(sun);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(26, 16, 12), pal.unlit("#ffd9a0", 0.22));
      halo.position.copy(sun.position);
      d.add(halo);
    }
    this.group.add(d);
  }

  update(dt: number): void {
    if (this.clouds) this.clouds.rotation.y += dt * 0.006;
  }

  dispose(): void {
    if (this.dressing) disposeTree(this.dressing);
    this.dome.geometry.dispose();
    (this.dome.material as THREE.Material).dispose();
  }
}
