/**
 * Renders each house's yard as an actual image.
 *
 *   npm run yards
 *
 * The SVG yards this replaces were a decent vector illustration and could
 * never have been more than that: flat-shaded bands cut from a 1D ridgeline.
 * Ground does not look like that, because ground is a *surface* — it has
 * depth, near land hides far land, light falls on it per point rather than per
 * facet, and the air between you and the horizon takes the colour out of it.
 *
 * So this is a renderer, not a drawing. It marches a ray per screen column
 * across a 2D heightfield, which buys true perspective and correct occlusion
 * for free, then shades every pixel from the surface normal at that point.
 * This is the same technique as the Sentloop hero range, retuned from alpine
 * relief to the gentler landforms a house stands in.
 *
 * Output is WebP with an alpha channel and NO sky baked in. Distance fades to
 * transparent rather than to a colour, so the page's own animated sky, sun,
 * clouds and birds show through behind it and the aerial perspective is real
 * rather than painted. One render works whatever the sky above it is doing.
 *
 * Each yard also gets a flat pad at a known depth. That is where the house
 * stands, and it is why the building sits on ground instead of hovering over
 * a hillside — see PAD_Z / PAD_R and SCENE pad tuning below.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/* ── Noise ──────────────────────────────────────────────────────
   Integer hash, so a re-run reproduces the same yard exactly. */

function hash2(x: number, y: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Fractal noise. Rotating the lattice per octave hides the axis alignment. */
function fbm2(x: number, y: number, octaves: number): number {
  let sum = 0;
  let total = 0;
  let freq = 1;
  let amp = 0.5;
  let px = x;
  let py = y;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(px * freq, py * freq);
    total += amp;
    freq *= 2.03;
    amp *= 0.5;
    const nx = px * 0.8 - py * 0.6;
    py = px * 0.6 + py * 0.8;
    px = nx;
  }
  return sum / total;
}

/** Ridged multifractal, for anything that should read as rock rather than turf. */
function ridged2(x: number, y: number, octaves: number): number {
  let sum = 0;
  let total = 0;
  let freq = 1;
  let amp = 0.5;
  let weight = 1;
  let px = x;
  let py = y;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(2 * noise2(px * freq, py * freq) - 1);
    n *= n;
    n *= weight;
    weight = Math.min(1, n * 2.6);
    sum += n * amp;
    total += amp;
    freq *= 2.07;
    amp *= 0.5;
    const nx = px * 0.8 - py * 0.6;
    py = px * 0.6 + py * 0.8;
    px = nx;
  }
  return sum / total;
}

/* ── Camera ─────────────────────────────────────────────────────
   Low and close, the way you would stand in your own garden. The Sentloop
   range wanted a distant alpine view; a yard wants the near ground legible. */

const CAM_Y = 1.85;
const HORIZON = 0.6;
const Z_NEAR = 1.6;
const Z_FAR = 150;
const PITCH_SCALE = 1.02;
const FOV = 0.66;

/** Where the house stands, and how wide its level ground is. */
const PAD_Z = 15.5;
const PAD_R = 4.4;

type RGB = [number, number, number];

type Scene = {
  /** Landform vertical scale. */
  relief: number;
  /** Horizontal size of the landforms. Larger is broader, calmer country. */
  scale: number;
  /** 0 rolling turf, 1 ridged rock. */
  rugged: number;
  /** Height of standing water, or null for dry land. */
  water: number | null;
  /** Ground falls away past the pad at this rate, so water forms a shore
   *  beyond the house rather than pooling in random hollows. */
  seaward?: number;
  seed: number;
  sun: RGB;
  groundDark: RGB;
  groundLit: RGB;
  /** Second material, blended in by slope: bare earth, stone, wet sand. */
  bareDark: RGB;
  bareLit: RGB;
  waterDark: RGB;
  waterLit: RGB;
  /** The pad the building stands on. */
  padDark: RGB;
  padLit: RGB;
  /** Sky bounce, which is what fills the shadows. */
  ambient: RGB;
  fog: number;
};

function norm(v: RGB): RGB {
  const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

const SCENES: Record<string, Scene> = {
  /* Meadow, late morning, sun high and to the left. */
  cottage: {
    relief: 7.4,
    scale: 0.055,
    rugged: 0.1,
    water: null,
    seed: 3,
    sun: norm([-0.55, 0.74, -0.38]),
    groundDark: [46, 84, 40],
    groundLit: [136, 196, 96],
    bareDark: [92, 74, 44],
    bareLit: [190, 158, 104],
    waterDark: [0, 0, 0],
    waterLit: [0, 0, 0],
    padDark: [118, 96, 58],
    padLit: [214, 184, 124],
    ambient: [128, 168, 150],
    fog: 1,
  },

  /* Forest country: steeper, darker, more broken ground. */
  treehouse: {
    relief: 9.6,
    scale: 0.05,
    rugged: 0.34,
    water: null,
    seed: 11,
    sun: norm([-0.62, 0.68, -0.4]),
    groundDark: [26, 62, 40],
    groundLit: [86, 148, 78],
    bareDark: [66, 54, 36],
    bareLit: [150, 124, 82],
    waterDark: [0, 0, 0],
    waterLit: [0, 0, 0],
    padDark: [88, 70, 44],
    padLit: [178, 146, 98],
    ambient: [106, 148, 132],
    fog: 1.05,
  },

  /* Parkland at golden hour, warm low sun raking across the grass. */
  loft: {
    relief: 5.0,
    scale: 0.062,
    rugged: 0.08,
    water: null,
    seed: 23,
    sun: norm([-0.82, 0.36, -0.44]),
    groundDark: [52, 72, 46],
    groundLit: [166, 178, 96],
    bareDark: [96, 88, 72],
    bareLit: [206, 190, 156],
    waterDark: [0, 0, 0],
    waterLit: [0, 0, 0],
    padDark: [104, 100, 96],
    padLit: [206, 200, 190],
    ambient: [178, 146, 110],
    fog: 1.15,
  },

  /* Shore: low dunes running down to standing water. */
  beach: {
    relief: 2.8,
    scale: 0.07,
    rugged: 0.05,
    water: -0.05,
    seaward: 0.16,
    seed: 41,
    sun: norm([-0.5, 0.72, -0.48]),
    groundDark: [148, 122, 74],
    groundLit: [244, 224, 172],
    bareDark: [128, 108, 70],
    bareLit: [216, 196, 148],
    waterDark: [16, 74, 112],
    waterLit: [96, 190, 218],
    padDark: [150, 126, 82],
    padLit: [238, 216, 166],
    ambient: [150, 196, 214],
    fog: 1,
  },

  /* Mountains at dusk, cool and steep, sun already low behind them. */
  castle: {
    relief: 19.0,
    scale: 0.042,
    rugged: 0.86,
    water: null,
    seed: 67,
    sun: norm([-0.78, 0.3, -0.34]),
    groundDark: [42, 40, 70],
    groundLit: [126, 112, 148],
    bareDark: [50, 46, 76],
    bareLit: [150, 132, 164],
    waterDark: [0, 0, 0],
    waterLit: [0, 0, 0],
    padDark: [70, 74, 52],
    padLit: [140, 148, 100],
    ambient: [116, 92, 128],
    fog: 1.2,
  },
};

/**
 * The heightfield.
 *
 * Two things shape it beyond the noise. A distance envelope keeps the ground
 * near the camera low, so the nearest hummock cannot rise up and hide the
 * whole yard — the same problem the Sentloop range had, and the same fix.
 * And the pad flattens a disc of ground at PAD_Z, because a house standing on
 * a hillside is a house sliding down a hillside.
 */
function height(x: number, z: number, s: Scene): number {
  // fbm clusters hard around its mean, so the raw range is nothing like
  // [-0.5,0.5]. Widen it, or the relief numbers below mean almost nothing.
  const rolling = (fbm2(x * s.scale + s.seed, z * s.scale + s.seed, 6) - 0.5) * 2.8;
  const rocky = (ridged2(x * s.scale * 0.9 + s.seed, z * s.scale * 0.9 + s.seed, 6) - 0.34) * 2.0;
  const land = rolling * (1 - s.rugged) + rocky * s.rugged;

  // Some of the country is simply higher than the rest.
  const massif = fbm2(x * s.scale * 0.2 + 40, z * s.scale * 0.2 + 40, 2);

  // Near ground stays low so the view opens up.
  const t = Math.max(0, Math.min(1, (z - 5) / 15));
  const opens = t * t * (3 - 2 * t);

  // Texture that is NOT damped by the envelope, so the near ground still has
  // relief to catch the light. Without this the foreground renders as paper.
  const tussock = (fbm2(x * 0.42 + 91, z * 0.42 + 91, 3) - 0.5) * 0.5;
  const grain = (noise2(x * 2.4 + 57, z * 2.4 + 57) - 0.5) * 0.11;
  // Near ground needs relief at the scale the camera actually resolves. With
  // nothing above 2.4 the foreground rendered as green velvet: correct, and
  // completely smooth. These are small in world units and only visible close
  // up, which is exactly where the eye looks for texture.
  const clumps = (noise2(x * 9 + 21, z * 9 + 21) - 0.5) * 0.05;
  const blades = (noise2(x * 26 + 77, z * 26 + 77) - 0.5) * 0.018;

  let h = land * (0.4 + massif * 1.15) * s.relief * opens + tussock + grain + clumps + blades;

  // A shore needs the ground to actually fall away from you. Without this
  // the sea pools in whatever hollows the noise happened to leave.
  if (s.seaward) h -= Math.max(0, z - PAD_Z - 5) * s.seaward;

  // Level the pad, easing out so its edge is a shoulder rather than a step.
  const dx = x;
  const dz = z - PAD_Z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < PAD_R * 1.75) {
    const k = Math.max(0, Math.min(1, (d - PAD_R) / (PAD_R * 0.75)));
    const ease = k * k * (3 - 2 * k);
    h = h * ease + (0.14 + grain * 0.5) * (1 - ease);
  }

  return h;
}

/** How much of this point is the level pad rather than open country. */
function padMix(x: number, z: number): number {
  const dz = z - PAD_Z;
  const d = Math.sqrt(x * x + dz * dz);
  const k = Math.max(0, Math.min(1, (d - PAD_R * 0.6) / (PAD_R * 0.7)));
  return 1 - k * k * (3 - 2 * k);
}

/**
 * Soft cast shadow: march toward the sun and see whether the land gets in the
 * way. Tracking the closest approach rather than a yes/no hit gives a penumbra,
 * so ridges do not stamp a hard edge across the valley below them.
 */
function sunShadow(x: number, y: number, z: number, s: Scene): number {
  let shade = 1;
  let t = 0.35;
  for (let i = 0; i < 22 && t < 26; i++) {
    const hx = x + s.sun[0] * t;
    const hz = z + s.sun[2] * t;
    const ray = y + s.sun[1] * t;
    const gap = ray - height(hx, hz, s);
    if (gap < 0) return 0.12;
    shade = Math.min(shade, (gap * 7) / t);
    t *= 1.42;
  }
  return Math.max(0.12, Math.min(1, shade));
}

function render(width: number, heightPx: number, s: Scene): Buffer {
  const rgba = new Uint8ClampedArray(width * heightPx * 4);
  const horizonY = Math.round(heightPx * HORIZON);

  for (let sx = 0; sx < width; sx++) {
    // Highest pixel painted in this column. Marching near to far and only
    // drawing above it gives correct occlusion with no sorting: a near ridge
    // simply hides whatever stands behind it.
    let highest = heightPx;
    const dirX = (sx / width - 0.5) * 2 * FOV;

    let z = Z_NEAR;
    let step = 0.008;

    while (z < Z_FAR && highest > 0) {
      const wx = dirX * z;
      let h = height(wx, z, s);

      const isWater = s.water !== null && h < s.water;
      if (isWater) h = s.water as number;

      const sy = Math.round(horizonY + ((CAM_Y - h) / z) * heightPx * PITCH_SCALE);

      if (sy < highest) {
        // Surface normal from finite differences, in world units.
        const e = 0.04;
        let nx: number;
        let nz: number;
        let ny: number;
        if (isWater) {
          // Ripples, so water is a surface and not a painted plane.
          const rx =
            noise2(wx * 1.7 + 5, z * 1.7 + 5) - noise2(wx * 1.7 - 5, z * 1.7 - 5);
          const rz =
            noise2(wx * 1.7 + 9, z * 1.7 + 9) - noise2(wx * 1.7 - 9, z * 1.7 - 9);
          nx = -rx * 0.16;
          nz = -rz * 0.16;
          ny = 1;
        } else {
          nx = -(height(wx + e, z, s) - height(wx - e, z, s));
          nz = -(height(wx, z + e, s) - height(wx, z - e, s));
          ny = 2 * e;
        }
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nl;
        nz /= nl;
        const nyn = ny / nl;

        const diffuse = Math.max(0, nx * s.sun[0] + nyn * s.sun[1] + nz * s.sun[2]);
        // Ground in another hill's shade takes no sun however it is angled.
        const shadow = isWater ? 1 : sunShadow(wx, h, z, s);
        // Wrapped, so shaded faces keep shape instead of going flat black.
        const lit = Math.min(1, diffuse * shadow * 0.9 + 0.1);
        // Shadows are filled by light from the sky, which is blue. Filling
        // them with a darker version of the surface is the other half of why
        // flat-shaded ground looks like velvet.
        const skyFill = (1 - diffuse * shadow) * 0.34;

        let dark: RGB;
        let light: RGB;

        if (isWater) {
          dark = s.waterDark;
          light = s.waterLit;
        } else {
          // Turf holds on level ground and slides off anything steep, which is
          // where bare earth and stone show through. That break is most of
          // what stops a hillside reading as a green bedsheet.
          const flat = Math.max(0, nyn);
          const bare = Math.max(0, Math.min(1, (0.74 - flat) * 3.1 + (noise2(wx * 0.7 + 3, z * 0.7 + 3) - 0.5) * 0.7));
          const pad = padMix(wx, z);

          const gd: RGB = [
            s.groundDark[0] + (s.bareDark[0] - s.groundDark[0]) * bare,
            s.groundDark[1] + (s.bareDark[1] - s.groundDark[1]) * bare,
            s.groundDark[2] + (s.bareDark[2] - s.groundDark[2]) * bare,
          ];
          const gl: RGB = [
            s.groundLit[0] + (s.bareLit[0] - s.groundLit[0]) * bare,
            s.groundLit[1] + (s.bareLit[1] - s.groundLit[1]) * bare,
            s.groundLit[2] + (s.bareLit[2] - s.groundLit[2]) * bare,
          ];
          dark = [
            gd[0] + (s.padDark[0] - gd[0]) * pad,
            gd[1] + (s.padDark[1] - gd[1]) * pad,
            gd[2] + (s.padDark[2] - gd[2]) * pad,
          ];
          light = [
            gl[0] + (s.padLit[0] - gl[0]) * pad,
            gl[1] + (s.padLit[1] - gl[1]) * pad,
            gl[2] + (s.padLit[2] - gl[2]) * pad,
          ];
        }

        // Variation at two scales, so a large face is neither one flat wash
        // nor uniformly speckled.
        const grain = isWater
          ? 1
          : (noise2(wx * 1.6, z * 1.6) * 0.15 + 0.9) * (noise2(wx * 7.5 + 31, z * 7.5 + 31) * 0.1 + 0.95);

        let r = (dark[0] + (light[0] - dark[0]) * lit) * grain;
        let g = (dark[1] + (light[1] - dark[1]) * lit) * grain;
        let b = (dark[2] + (light[2] - dark[2]) * lit) * grain;

        r += (s.ambient[0] - r) * skyFill;
        g += (s.ambient[1] - g) * skyFill;
        b += (s.ambient[2] - b) * skyFill;

        // Aerial perspective. Distance pulls colour toward the ambient sky
        // tone and then drains the alpha, so the furthest ground dissolves
        // into whatever sky the page is drawing rather than into a colour
        // baked in here.
        const t = Math.min(1, ((z - Z_NEAR) / (Z_FAR - Z_NEAR)) * s.fog);
        const haze = t * t * 0.6;
        r += (s.ambient[0] - r) * haze;
        g += (s.ambient[1] - g) * haze;
        b += (s.ambient[2] - b) * haze;
        const alpha = Math.max(0, 1 - t * t * t * 1.04) * 255;

        for (let y = Math.max(0, sy); y < highest; y++) {
          const i = (y * width + sx) * 4;
          rgba[i] = r;
          rgba[i + 1] = g;
          rgba[i + 2] = b;
          rgba[i + 3] = alpha;
        }
        highest = Math.max(0, sy);
      }

      // Steps lengthen with distance: near ground needs fine sampling, far
      // ground is only a few pixels tall however carefully it is walked.
      z += step;
      step *= 1.004;
    }
  }

  return Buffer.from(rgba.buffer);
}

const OUT = "public/house/yards";
const W = 1800;
const H = 1200;

async function main() {
  const root = process.cwd();
  mkdirSync(join(root, OUT), { recursive: true });

  for (const [id, scene] of Object.entries(SCENES)) {
    const raw = render(W, H, scene);
    const out = await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
      .webp({ quality: 84, alphaQuality: 92, effort: 6 })
      .toBuffer();
    const file = `${OUT}/${id}.webp`;
    writeFileSync(join(root, file), out);
    console.log(`  ${file}  ${W}x${H}  ${(out.length / 1024).toFixed(0)} KB`);
  }
}

main();
