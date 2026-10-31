import * as THREE from "three";

/**
 * The cartoon paint: one MeshToonMaterial per colour, shared by everything
 * drawn in that colour, with a four-band gradient so light falls in flat
 * steps the way it does on a low-poly toy. The palette is reference counted
 * so two mounted games (a SPA going page to page) never free each other's
 * paint, and the last one out frees the GPU side.
 */
export class Palette {
  private readonly toons = new Map<string, THREE.MeshToonMaterial>();
  private readonly unlits = new Map<string, THREE.MeshBasicMaterial>();
  readonly gradient: THREE.DataTexture;

  constructor() {
    const data = new Uint8Array([70, 118, 158, 192, 220, 242, 255]);
    const tex = new THREE.DataTexture(data, 7, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.gradient = tex;
  }

  /** Lit cartoon paint in a colour, optionally glowing. */
  toon(color: string, emissive = "#000000", emissiveIntensity = 1): THREE.MeshToonMaterial {
    const key = `${color}|${emissive}|${emissiveIntensity}`;
    let m = this.toons.get(key);
    if (!m) {
      m = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient, emissive, emissiveIntensity });
      this.toons.set(key, m);
    }
    return m;
  }

  /** Flat unlit colour: glows, neon strips, particles. */
  unlit(color: string, opacity = 1): THREE.MeshBasicMaterial {
    const key = `${color}|${opacity}`;
    let m = this.unlits.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
      this.unlits.set(key, m);
    }
    return m;
  }

  /** Unlit paint pushed past white, so the bloom pass makes it glow. */
  glow(color: string, boost = 1.5): THREE.MeshBasicMaterial {
    const key = `glow|${color}|${boost}`;
    let m = this.unlits.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      m.color.multiplyScalar(boost);
      this.unlits.set(key, m);
    }
    return m;
  }

  /** A paint of the kart's own, so a hit flash never spreads to shared materials. */
  own(color: string): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.gradient });
  }

  dispose(): void {
    for (const m of this.toons.values()) m.dispose();
    for (const m of this.unlits.values()) m.dispose();
    this.toons.clear();
    this.unlits.clear();
    this.gradient.dispose();
  }
}

/** Frees a tree's geometries and any materials made just for it (flagged userData.own). */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.userData.own && mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const map = (m as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        m.dispose();
      }
    }
  });
}
