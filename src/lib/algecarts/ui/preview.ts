import * as THREE from "three";
import { buildKart, type KartView } from "../engine/render/KartMesh";
import { Palette } from "../engine/render/Materials";
import type { Loadout } from "../engine/profile";

/** The garage turntable: the player's kart in its current outfit, slowly turning. */
export class KartPreview {
  private readonly gl: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly cam = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  private readonly pal = new Palette();
  private readonly stage = new THREE.Group();
  private view: KartView | null = null;
  private raf = 0;
  private last = 0;
  private running = false;
  private readonly flameTimer = { t: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.setClearColor(0x000000, 0);
    this.scene.add(new THREE.HemisphereLight("#ffe9c9", "#5a4a7a", 1.1));
    const sun = new THREE.DirectionalLight("#fff4df", 2.2);
    sun.position.set(4, 7, 5);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight("#8fb8ff", 0.9);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.3, 28), this.pal.toon("#2a2f4a"));
    disc.position.y = -0.15;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.06, 8, 40), this.pal.glow("#ff5d8f", 1.4));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.02;
    this.stage.add(disc, ring);
    this.scene.add(this.stage);
    this.cam.position.set(0, 3.2, 7.6);
    this.cam.lookAt(0, 1.45, 0);
  }

  setLoadout(lo: Loadout, name: string): void {
    if (this.view) {
      this.stage.remove(this.view.root);
      this.view.dispose();
    }
    this.view = buildKart(this.pal, lo, name || "You", true, "low");
    this.view.root.position.y = 0;
    for (const f of this.view.flames) f.visible = true;
    this.stage.add(this.view.root);
    this.render(0);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.render(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private render(dt: number): void {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    if (this.canvas.width !== Math.floor(w * Math.min(2, devicePixelRatio)) ) {
      this.gl.setPixelRatio(Math.min(2, devicePixelRatio));
      this.gl.setSize(w, h, false);
      this.cam.aspect = w / h;
      this.cam.updateProjectionMatrix();
    }
    this.stage.rotation.y += dt * 0.55;
    this.flameTimer.t += dt;
    if (this.view) {
      this.view.body.position.y = Math.sin(this.flameTimer.t * 2.2) * 0.03;
      for (const f of this.view.flames) f.scale.set(0.9 + Math.random() * 0.2, 0.9 + Math.random() * 0.25, 0.8 + Math.random() * 0.5);
      this.view.wheels.forEach((wheel) => (wheel.rotation.x += dt * 2.5));
    }
    this.gl.render(this.scene, this.cam);
  }

  dispose(): void {
    this.stop();
    if (this.view) this.view.dispose();
    this.stage.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.pal.dispose();
    this.gl.dispose();
  }
}
