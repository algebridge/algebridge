import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Arena } from "../world/Arena";
import { disposeTree, Palette } from "./Materials";
import { Sky } from "./Sky";
import { WaterMaterial } from "./Water";

/**
 * The WebGL side: scene, lights, sky, fog, the current arena's geometry, and
 * on high quality a bloom pass that makes neon, lamps, flames and blasts glow.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly palette = new Palette();
  readonly sky = new Sky();
  readonly quality: "high" | "low";
  private readonly sun: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly lamps = new THREE.Group();
  private arenaGroup: THREE.Group | null = null;
  private readonly canvas: HTMLCanvasElement;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private water: WaterMaterial[] = [];

  constructor(canvas: HTMLCanvasElement, quality: "high" | "low") {
    this.canvas = canvas;
    this.quality = quality;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: quality === "low", powerPreference: "high-performance", stencil: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.shadowMap.enabled = quality === "high";
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;

    this.sun = new THREE.DirectionalLight("#ffffff", 2);
    this.sun.castShadow = quality === "high";
    const sh = this.sun.shadow;
    sh.mapSize.set(2048, 2048);
    sh.camera.near = 20;
    sh.camera.far = 300;
    sh.bias = -0.0006;
    sh.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight("#ffffff", "#444444", 0.8);
    this.ambient = new THREE.AmbientLight("#ffffff", 0.3);
    this.scene.add(this.hemi, this.ambient, this.sky.group, this.lamps);

    if (quality === "high") {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.gl, target);
      this.renderPass = new RenderPass(this.scene, new THREE.PerspectiveCamera());
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.55, 1.0);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
  }

  /** Swap in an arena: geometry, sky, fog, light, lamps and water. */
  setArena(arena: Arena): void {
    if (this.arenaGroup) {
      this.scene.remove(this.arenaGroup);
      disposeTree(this.arenaGroup);
    }
    for (const w of this.water) w.dispose();
    this.water = [];
    const t = arena.def.theme;
    this.arenaGroup = arena.build(this.palette, this.quality);
    this.scene.add(this.arenaGroup);
    this.arenaGroup.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m instanceof WaterMaterial) this.water.push(m);
    });
    this.sky.setTheme(t, this.palette);
    this.scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    this.sun.color.set(t.sun);
    this.sun.intensity = t.sunIntensity;
    this.sun.position.set(...t.sunFrom);
    this.sun.target.position.set(0, 0, 0);
    const reach = arena.half + 10;
    const c = this.sun.shadow.camera;
    c.left = -reach;
    c.right = reach;
    c.top = reach;
    c.bottom = -reach;
    c.updateProjectionMatrix();
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.hemi.intensity = t.hemiIntensity;
    this.ambient.color.set(t.ambient);
    this.ambient.intensity = t.ambientIntensity;

    // Street lamps light their patch of ground at night.
    this.lamps.clear();
    if (this.quality === "high" && t.night) {
      const spots = arena.def.props.filter((p) => p.kind === "lamp").slice(0, 6);
      for (const p of spots) {
        const l = new THREE.PointLight(p.color ?? "#fff2b0", 90, 34, 2);
        l.position.set(p.x, 5.2, p.z);
        this.lamps.add(l);
      }
    }
    if (this.bloom) this.bloom.strength = t.night ? 0.7 : 0.4;
  }

  /** Size the drawing buffer to the canvas's CSS box. Returns the CSS size. */
  resize(): { w: number; h: number } {
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === "high" ? 2 : 1.25);
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
    return { w, h };
  }

  render(camera: THREE.Camera, dt: number): void {
    for (const w of this.water) w.tick(dt);
    if (this.composer && this.renderPass) {
      this.renderPass.camera = camera;
      this.composer.render();
    } else {
      this.gl.render(this.scene, camera);
    }
  }

  dispose(): void {
    if (this.arenaGroup) disposeTree(this.arenaGroup);
    for (const w of this.water) w.dispose();
    this.composer?.dispose();
    this.sky.dispose();
    this.palette.dispose();
    this.gl.dispose();
  }
}
