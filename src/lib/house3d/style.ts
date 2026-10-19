/**
 * The world's look, in one place. Everything in the Bridgey House is built
 * from the kit (kit.ts) and lit by the engine (engine.ts); this says how all
 * of it should look: a bright, chunky cartoon town, the way a platform game
 * draws one. Colours come out clean and saturated and are pulled towards a
 * small family of hues; the light falls in soft steps instead of a smooth
 * gradient; corners are rounder; surfaces are flat colour with bold, simple
 * patterns where the photographic look had grain and grit.
 *
 * Every design here is the house's own. The look borrows the grammar of a
 * platform game (saturation, chunkiness, stepped light, puffy clouds), never
 * another game's characters, blocks or signs.
 *
 * With CARTOON off (?look=real in the address bar) the earlier photographic
 * look comes back, so the two can be compared.
 */

import * as THREE from "three";

export const CARTOON: boolean = (() => {
  if (typeof window === "undefined") return true;
  try {
    return new URLSearchParams(window.location.search).get("look") !== "real";
  } catch {
    return true;
  }
})();

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** The hues the world is painted in, in degrees: a colour is pulled part of the way to the nearest. */
const HUES = [0, 26, 48, 96, 126, 166, 198, 222, 258, 288, 328];
const popped = new Map<string, string>();
const scratch = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };

/**
 * A colour as the cartoon world paints it: more saturated, a little
 * brighter in the middle tones, its hue nudged towards one of the world's
 * own. Greys stay grey, white stays white, black stays black. The same
 * string back when the cartoon look is off.
 */
export function pop(color: string): string {
  if (!CARTOON) return color;
  const had = popped.get(color);
  if (had) return had;
  scratch.set(color).getHSL(hsl, THREE.SRGBColorSpace);
  let { h, s, l } = hsl;
  if (s > 0.06) {
    const deg = h * 360;
    let best = HUES[0];
    let near = 999;
    for (const a of HUES) {
      const d = Math.abs(((deg - a + 540) % 360) - 180);
      if (d < near) {
        near = d;
        best = a;
      }
    }
    const to = deg + 0.4 * (((best - deg + 540) % 360) - 180);
    h = (((to % 360) + 360) % 360) / 360;
    s = Math.min(1, s * 1.35 + 0.08);
  }
  l = Math.min(1, l + 0.12 * 4 * l * (1 - l));
  const out = `#${scratch.setHSL(h, s, l, THREE.SRGBColorSpace).getHexString()}`;
  popped.set(color, out);
  return out;
}

// ---------------------------------------------------------------------------
// Light
// ---------------------------------------------------------------------------

const PHYSICAL_IRRADIANCE = "vec3 irradiance = dotNL * directLight.color;";
const PHYSICAL_DIFFUSE = "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );";
/**
 * A light's colour on a surface in soft steps: a surface turned away from
 * the light keeps a little of it (the wrap), the turn from shade into light
 * happens over a short band, and the lit side is lit all the way. Only the
 * matte colour takes the steps; a highlight keeps the true angle to the
 * light, or every edge turned from a lamp would sparkle with highlights it
 * never had. Shadows cast by other things arrive through the light's own
 * colour, untouched.
 */
const STEPPED_IRRADIANCE = `
	vec3 irradiance = dotNL * directLight.color;
	float toonWrap = saturate( ( dot( geometryNormal, directLight.direction ) + 0.3 ) / 1.3 );
	vec3 toonIrradiance = mix( toonWrap, smoothstep( 0.2, 0.52, toonWrap ), 0.6 ) * directLight.color;`;
const STEPPED_DIFFUSE = "reflectedLight.directDiffuse += toonIrradiance * BRDF_Lambert( material.diffuseColor );";

/**
 * Gives a physically based material the cartoon's stepped light. Every
 * material the kit makes passes through here, and so do the few made by
 * hand in the garden and the room. Returns the material it was given.
 */
export function toon<T extends THREE.Material>(m: T): T {
  if (!CARTOON) return m;
  const std = m as unknown as THREE.MeshStandardMaterial;
  if (!std.isMeshStandardMaterial) return m;
  std.onBeforeCompile = (shader) => {
    const lights = THREE.ShaderChunk.lights_physical_pars_fragment.replace(PHYSICAL_IRRADIANCE, STEPPED_IRRADIANCE).replace(PHYSICAL_DIFFUSE, STEPPED_DIFFUSE);
    shader.fragmentShader = shader.fragmentShader.replace("#include <lights_physical_pars_fragment>", lights);
  };
  std.customProgramCacheKey = () => "toon";
  return m;
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/**
 * How round a box's corners are. The cartoon makes every box chunkier: a
 * softened edge becomes a real round, and a sharp box gets a little
 * rounding of its own; never more than the box's smallest side can take.
 */
export function corner(w: number, h: number, d: number, r: number | undefined): number {
  const min = Math.min(w, h, d);
  const room = min / 2 - 0.0005;
  if (!CARTOON) return Math.min(r ?? 0, room);
  const want = r ? Math.max(r * 2.2, min * 0.14) : min > 0.025 ? min * 0.12 : 0;
  return Math.min(want, room, Math.max(0.16, r ?? 0));
}

/** How far an extruded outline's edge is softened: wider in the cartoon, so walls and cut-outs read as thick, rounded slabs. */
export function bevel(depth: number, b: number | undefined): number {
  const own = b ?? Math.min(0.01, depth / 4);
  if (!CARTOON) return own;
  return Math.min(Math.max(own * 3, 0.018), depth / 4);
}
