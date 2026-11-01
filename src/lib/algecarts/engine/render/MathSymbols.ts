import * as THREE from "three";

const GLYPHS = ["+", "−", "×", "÷", "=", "π", "√", "x²", "∑", "∞", "%", "y", "f(x)", "m", "7", "12", "<", ">"];

/**
 * Big glowing math symbols hanging in the sky around the arena, bobbing and
 * turning slowly: the skyline of a math world. Additive sprites, so the bloom
 * pass lights them up. Owns its textures and frees them itself.
 */
export class MathSymbols {
  readonly group = new THREE.Group();
  private readonly sprites: { s: THREE.Sprite; y0: number; ph: number; sp: number }[] = [];
  private readonly textures: THREE.CanvasTexture[] = [];
  private t = 0;

  build(colors: string[], count: number, half: number): void {
    this.clear();
    const made = new Map<string, THREE.SpriteMaterial>();
    for (let i = 0; i < count; i++) {
      const glyph = GLYPHS[i % GLYPHS.length];
      const color = colors[i % colors.length];
      const key = `${glyph}|${color}`;
      let m = made.get(key);
      if (!m) {
        const tex = this.glyphTexture(glyph, color);
        this.textures.push(tex);
        m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, opacity: 0.85 });
        made.set(key, m);
      }
      const s = new THREE.Sprite(m);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.25;
      const r = half + 40 + Math.random() * 120;
      const y0 = 22 + Math.random() * 70;
      const size = 14 + Math.random() * 20;
      s.scale.set(size, size, 1);
      s.position.set(Math.cos(a) * r, y0, Math.sin(a) * r);
      this.group.add(s);
      this.sprites.push({ s, y0, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.5 });
    }
    // The materials are shared by glyph and colour: keep them for disposal.
    this.mats = [...made.values()];
  }

  private mats: THREE.SpriteMaterial[] = [];

  private glyphTexture(glyph: string, color: string): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.font = `900 ${glyph.length > 2 ? 110 : glyph.length > 1 ? 150 : 200}px 'Baloo 2', 'Nunito', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 34;
    ctx.fillStyle = color;
    ctx.fillText(glyph, 128, 136);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.75;
    ctx.fillText(glyph, 128, 136);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  update(dt: number): void {
    this.t += dt;
    for (const e of this.sprites) {
      e.s.position.y = e.y0 + Math.sin(this.t * e.sp + e.ph) * 3.2;
      e.s.material.rotation = Math.sin(this.t * e.sp * 0.6 + e.ph) * 0.18;
    }
  }

  private clear(): void {
    this.group.clear();
    this.sprites.length = 0;
    for (const m of this.mats) m.dispose();
    this.mats = [];
    for (const t of this.textures) t.dispose();
    this.textures.length = 0;
  }

  dispose(): void {
    this.clear();
  }
}
