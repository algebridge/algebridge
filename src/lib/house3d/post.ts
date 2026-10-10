/**
 * The finishing passes on a frame that is standing still: ambient occlusion
 * (the soft dark where walls meet floors, under every piece, in the folds of
 * the hills), a little bloom from lamps and windows at night, and a gentle
 * vignette. Moving frames (a drag, a walk) are drawn plain, so interaction
 * stays quick; the frame you rest on gets the finish.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { compileQuietly } from "./compile";

const VIGNETTE = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, strength: { value: 0.26 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = length((vUv - 0.5) * vec2(1.0, 0.85)) * 2.0;
      c.rgb *= 1.0 - strength * smoothstep(0.62, 1.55, d);
      gl_FragColor = c;
    }`,
};

export class Post {
  private composer: EffectComposer;
  private gtao: GTAOPass;
  private bloom: UnrealBloomPass;
  private output: OutputPass;
  private vignette: ShaderPass;
  /** True once the passes' shaders have compiled in the background; until then a frame is drawn plain. */
  ready = false;
  private target: THREE.WebGLRenderTarget;
  private mode = "";
  /** Cut-out leaves and blades are hidden while the occlusion pass reads the scene's shape, or every blade would cast a dark card. */
  private hidden: THREE.Object3D[] = [];

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.Camera, width: number, height: number) {
    // The finish works at up to 1.5 pixels per CSS pixel: a phone's 3x screen would need four times the memory for no visible gain.
    const dpr = Math.min(renderer.getPixelRatio(), 1.5);
    // Half-float colour where the card can render to it (bloom keeps its highlights); plain bytes otherwise.
    const hdr = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
    this.target = new THREE.WebGLRenderTarget(Math.round(width * dpr), Math.round(height * dpr), { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: 4 });
    this.composer = new EffectComposer(renderer, this.target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new GTAOPass(scene, camera, Math.round(width * dpr), Math.round(height * dpr));
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.9;
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
    const self = this;
    const pass = this.gtao as unknown as { _overrideVisibility(): void; _restoreVisibility(): void };
    const override = pass._overrideVisibility.bind(this.gtao);
    const restore = pass._restoreVisibility.bind(this.gtao);
    pass._overrideVisibility = () => {
      override();
      self.hidden = [];
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (o.visible && m && !Array.isArray(m) && m.alphaTest > 0) {
          o.visible = false;
          self.hidden.push(o);
        }
      });
    };
    pass._restoreVisibility = () => {
      for (const o of self.hidden) o.visible = true;
      self.hidden = [];
      restore();
    };
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.5, 0.92);
    this.bloom.enabled = false;
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.vignette = new ShaderPass(VIGNETTE);
    this.composer.addPass(this.output);
    this.composer.addPass(this.vignette);
    this.setSize(width, height, dpr);
  }

  /**
   * Compiles every pass's shaders without stalling the page: each goes on a
   * quad in a scene of its own and through the same quiet compile the house
   * uses, and the shapes the occlusion pass reads the scene with (plain,
   * instanced, vertex-coloured) are compiled the same way. Resolves ready.
   */
  async warm(): Promise<void> {
    const g = this.gtao as unknown as { gtaoMaterial: THREE.Material; pdMaterial: THREE.Material; blendMaterial: THREE.Material; normalMaterial: THREE.Material; depthRenderMaterial?: THREE.Material; copyMaterial?: THREE.Material };
    const b = this.bloom as unknown as { separableBlurMaterials: THREE.Material[]; compositeMaterial: THREE.Material; materialHighPassFilter: THREE.Material };
    const c = this.composer as unknown as { copyPass: { material: THREE.Material } };
    const materials = [g.gtaoMaterial, g.pdMaterial, g.blendMaterial, g.copyMaterial, g.depthRenderMaterial, ...(b.separableBlurMaterials ?? []), b.compositeMaterial, b.materialHighPassFilter, c.copyPass?.material, this.output.material, this.vignette.material].filter((m): m is THREE.Material => !!m);
    const quads = new THREE.Scene();
    const plane = new THREE.PlaneGeometry(2, 2);
    for (const m of materials) quads.add(new THREE.Mesh(plane, m));
    // The normal pass draws the whole scene in one material: its plain, instanced and vertex-coloured forms.
    const box = new THREE.BoxGeometry(1, 1, 1);
    quads.add(new THREE.Mesh(box, g.normalMaterial));
    quads.add(new THREE.InstancedMesh(box, g.normalMaterial, 1));
    const coloured = box.clone();
    coloured.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(coloured.getAttribute("position").count * 3), 3));
    quads.add(new THREE.Mesh(coloured, g.normalMaterial));
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    await compileQuietly(this.renderer, quads, cam);
    plane.dispose();
    box.dispose();
    coloured.dispose();
    this.ready = true;
  }

  /** `ratio`: pixels per CSS pixel for the frame at rest (the engine's full count; the renderer's own may be lower while the view moves). */
  setSize(width: number, height: number, ratio = Math.min(this.renderer.getPixelRatio(), 1.5)): void {
    this.composer.setPixelRatio(Math.min(ratio, 1.5));
    this.composer.setSize(width, height);
    // The occlusion is worked out at half size (its denoise smooths the rest): a quarter of the work, the same soft corners.
    const w = Math.round(width * Math.min(ratio, 1.5));
    const h = Math.round(height * Math.min(ratio, 1.5));
    this.gtao.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
  }

  /** What the finish is for: indoors the occlusion is tight (a room's corners), outdoors broader (the land); bloom only at night. */
  setMode(indoors: boolean, night: boolean): void {
    const key = `${indoors}:${night}`;
    if (key === this.mode) return;
    this.mode = key;
    this.gtao.updateGtaoMaterial({ radius: indoors ? 0.32 : 0.9, distanceExponent: 1, thickness: 1, scale: indoors ? 1.0 : 0.8, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
    this.bloom.enabled = night;
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.gtao.dispose();
    this.bloom.dispose();
    this.target.dispose();
  }
}
