/**
 * Renders the birds as a wingbeat sprite sheet.
 *
 *   npm run birds
 *
 * The birds this replaces were flat vector silhouettes with three hand-drawn
 * wing positions. That has a ceiling, for the same reason the hand-drawn
 * mountains did: a bird in flight is a *shape changing in three dimensions*,
 * and the thing that makes it read as alive is that the silhouette narrows as
 * the wing turns edge-on to you, the primaries splay and close, and the near
 * and far wings foreshorten by different amounts. None of that is available to
 * a flat fill you can only swap between.
 *
 * So this builds an actual bird out of polygons in 3D — body, head, tail, two
 * wings with a shoulder, an elbow and eight primaries each — sweeps it through
 * a real wingbeat, and renders every frame with the same sun the terrain uses.
 * Feathers are shaded individually by their own orientation, which is what
 * gives the wing its grain.
 *
 * Rendered at 3x and downsampled, so the edges are anti-aliased by the
 * resample rather than by anything clever in here.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const FRAMES = 8
const CELL = 132
const SS = 3 // supersample factor

type V3 = [number, number, number]

/** Rotate about the bird's long axis — this is what a wingbeat mostly is. */
function roll([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x, y * c - z * s, y * s + z * c]
}

/** Sweep fore and aft, which the wing also does through the stroke. */
function yaw([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, y, -x * s + z * c]
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]

function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function norm(a: V3): V3 {
  const l = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/**
 * Slightly off-axis view, so the near wing foreshortens differently from the
 * far one. Straight side-on, both wings project identically and the bird looks
 * like a paper cut-out however well it is shaded.
 */
function project([x, y, z]: V3): [number, number, number] {
  // The z coupling is what turns a wingspan into width on screen. At 0.26 the
  // wings barely moved horizontally and the whole fan collapsed into a bundle
  // hanging off the body — anatomically defensible for a dead-side-on view,
  // and useless, because that view is the one where a bird has no wingspan.
  const sx = x - z * 0.66
  const sy = -y - z * 0.13
  return [sx, sy, z]
}

/** Same sun as the terrain, so bird and mountain are lit by one light. */
const SUN = norm([-0.62, 0.66, -0.42])

type Poly = { pts: V3[]; shade: number; depth: number }

/**
 * One wing.
 *
 * `dihedral` is the flap angle. `fold` closes the wing on the upstroke — real
 * birds pull the wrist in as the wing comes up, which is why the upstroke
 * silhouette is short and the downstroke is long. Drawing both at full span is
 * the single biggest tell of a fake wingbeat.
 */
function wing(side: 1 | -1, dihedral: number, fold: number, sweep: number): Poly[] {
  const polys: Poly[] = []
  const shoulder: V3 = [0.06, 0.045, side * 0.045]

  // Shoulder out to the wrist.
  const armLen = 0.4 * (1 - fold * 0.32)
  let arm: V3 = [0, 0, side * armLen]
  arm = roll(arm, side * dihedral)
  arm = yaw(arm, side * sweep)
  const wrist = add(shoulder, arm)

  // Backward direction in the wing's own plane, so the trailing edge tucks the
  // right way whatever the wing is doing.
  let back: V3 = [-1, 0, 0]
  back = roll(back, side * dihedral)
  back = yaw(back, side * sweep)

  /*
    The inner wing.

    This is the part that was missing, and it is most of why the first passes
    read as a feather duster: a real wing is a continuous surface from the body
    out to the wrist, and only the primaries beyond it separate. Without it you
    have a handful of spikes hanging off a shoulder.
  */
  polys.push(
    face(
      [
        add(shoulder, scale(back, -0.05)),
        add(wrist, scale(back, -0.03)),
        add(wrist, scale(back, 0.2)),
        add(shoulder, scale(back, 0.3)),
      ],
      0.94,
    ),
  )

  /*
    Primaries. Wide and overlapping rather than narrow and gapped — a spread
    wing shows a solid edge with the tips fingering apart at the very end, not
    eight separate blades.
  */
  const COUNT = 7
  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1)
    const len = (0.3 + 0.36 * Math.sin(Math.PI * (0.3 + t * 0.62))) * (1 - fold * 0.45)

    // Swept further back toward the outer tip, and further still when folded.
    const rake = -0.28 - t * 1.0 + fold * 0.55
    let dir: V3 = [Math.sin(rake), 0, side * Math.cos(rake) * 0.92]
    // Twist along the fan. A wing is not a flat plate: without this the
    // mid-stroke frames turn exactly edge-on and the bird flattens into a
    // horizontal plank for two frames out of eight.
    dir = roll(dir, side * (dihedral + (t - 0.5) * 0.44))
    dir = yaw(dir, side * sweep)

    // Roots march along the wrist so the feathers overlap into one edge.
    const root = add(wrist, scale(back, t * 0.11 - 0.02))
    const tip = add(root, scale(dir, len))

    // Wide at the root, tapering — and they overlap, which is what closes the
    // gaps that made the earlier version look like a comb.
    const wRoot = 0.075 - t * 0.02
    const wTip = 0.03 - t * 0.012
    let upR: V3 = roll([0, wRoot, 0], side * dihedral)
    let upT: V3 = roll([0, wTip, 0], side * dihedral)
    upR = yaw(upR, side * sweep)
    upT = yaw(upT, side * sweep)

    polys.push(
      face([add(root, upR), add(tip, upT), sub(tip, upT), sub(root, upR)], 1),
    )
  }

  return polys
}

/** Build a polygon, shaded by its own normal against the sun. */
function face(pts: V3[], tint: number): Poly {
  const n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])))
  const lambert = Math.abs(n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2])
  // Birds against a bright sky are close to silhouettes, so this is a narrow
  // range on purpose: enough shading to give the wing form, not so much that
  // it stops reading as a dark shape in the air.
  const shade = (0.34 + lambert * 0.66) * tint
  const depth = (pts[0][2] + pts[1][2] + pts[2][2]) / 3
  return { pts, shade, depth }
}

/** Body, head, beak and tail. Built once and reused across every frame. */
function bodyPolys(): Poly[] {
  const polys: Poly[] = []

  // Body as a ring of quads around the long axis, so it shades like a solid.
  const RINGS = 14
  const SEG = 10
  const prof = (t: number) => {
    // Fat at the shoulders, tapering to the tail. Slim: a thick body next to
    // a short wing is what made the first pass read as a fish with fins.
    const s = Math.sin(Math.PI * Math.min(1, t * 1.06))
    return 0.082 * s * (1 - t * 0.32)
  }
  for (let i = 0; i < RINGS; i++) {
    const t0 = i / RINGS
    const t1 = (i + 1) / RINGS
    const x0 = 0.36 - t0 * 0.78
    const x1 = 0.36 - t1 * 0.78
    for (let j = 0; j < SEG; j++) {
      const a0 = (j / SEG) * Math.PI * 2
      const a1 = ((j + 1) / SEG) * Math.PI * 2
      const r0 = prof(t0)
      const r1 = prof(t1)
      polys.push(
        face(
          [
            [x0, Math.sin(a0) * r0, Math.cos(a0) * r0],
            [x1, Math.sin(a0) * r1, Math.cos(a0) * r1],
            [x1, Math.sin(a1) * r1, Math.cos(a1) * r1],
            [x0, Math.sin(a1) * r0, Math.cos(a1) * r0],
          ],
          0.86,
        ),
      )
    }
  }

  // Head.
  for (let j = 0; j < SEG; j++) {
    const a0 = (j / SEG) * Math.PI * 2
    const a1 = ((j + 1) / SEG) * Math.PI * 2
    const r = 0.062
    polys.push(
      face(
        [
          [0.36, 0.04 + Math.sin(a0) * r, Math.cos(a0) * r],
          [0.45, 0.045 + Math.sin(a0) * r * 0.72, Math.cos(a0) * r * 0.72],
          [0.45, 0.045 + Math.sin(a1) * r * 0.72, Math.cos(a1) * r * 0.72],
          [0.36, 0.04 + Math.sin(a1) * r, Math.cos(a1) * r],
        ],
        0.9,
      ),
    )
  }

  // Beak.
  polys.push(face([[0.45, 0.06, 0.014], [0.55, 0.042, 0], [0.45, 0.026, 0.014]], 0.8))
  polys.push(face([[0.45, 0.06, -0.014], [0.55, 0.042, 0], [0.45, 0.026, -0.014]], 0.7))

  // Tail: a shallow fan of five feathers.
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.15
    const root: V3 = [-0.4, 0, 0]
    const tip: V3 = [-0.4 - 0.2 * Math.cos(a), 0.008, Math.sin(a) * 0.2]
    polys.push(
      face(
        [
          [root[0], root[1] + 0.014, root[2]],
          [tip[0], tip[1] + 0.012, tip[2]],
          [tip[0], tip[1] - 0.012, tip[2]],
          [root[0], root[1] - 0.014, root[2]],
        ],
        0.95,
      ),
    )
  }

  return polys
}

/** Even-odd scanline fill. Rendered at 3x, so the resample does the edges. */
function fillPoly(
  buf: Float32Array,
  cov: Float32Array,
  w: number,
  h: number,
  pts: Array<[number, number]>,
  shade: number,
) {
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p[1] < minY) minY = p[1]
    if (p[1] > maxY) maxY = p[1]
  }
  const y0 = Math.max(0, Math.floor(minY))
  const y1 = Math.min(h - 1, Math.ceil(maxY))

  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5
    const xs: number[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (a[1] === b[1]) continue
      if (yc >= Math.min(a[1], b[1]) && yc < Math.max(a[1], b[1])) {
        xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
    }
    xs.sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.round(xs[k]))
      const xb = Math.min(w - 1, Math.round(xs[k + 1]))
      for (let x = xa; x <= xb; x++) {
        const i = y * w + x
        buf[i] = shade
        cov[i] = 1
      }
    }
  }
}

function renderFrame(phase: number, ink: [number, number, number]) {
  const W = CELL * SS
  const H = CELL * SS
  const shadeBuf = new Float32Array(W * H)
  const cov = new Float32Array(W * H)

  /*
    The stroke.

    Not a sine wave. A real downstroke is fast and powerful and the upstroke is
    a quicker recovery with the wing partly folded, so the two halves are not
    mirror images — which is exactly what a sine gives you.
  */
  const d = Math.sin(phase * Math.PI * 2)
  // A little permanent camber, so the level part of the stroke still presents
  // some wing to the viewer rather than vanishing to a line.
  const dihedral = (d > 0 ? d * 1.05 : d * 0.78) + 0.13
  const fold = Math.max(0, d) * 0.85
  const sweep = Math.cos(phase * Math.PI * 2) * 0.13

  const polys: Poly[] = [
    ...wing(-1, dihedral, fold, sweep),
    ...bodyPolys(),
    ...wing(1, dihedral, fold, sweep),
  ]

  // Painter's algorithm: far first. Enough for a convex-ish subject like this.
  polys.sort((a, b) => a.depth - b.depth)

  const S = W * 0.6
  const cx = W * 0.5
  const cy = H * 0.5

  for (const p of polys) {
    const pts2 = p.pts.map((v) => {
      const [x, y] = project(v)
      return [cx + x * S, cy + y * S] as [number, number]
    })
    fillPoly(shadeBuf, cov, W, H, pts2, p.shade)
  }

  const rgba = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    if (!cov[i]) continue
    const s = shadeBuf[i]
    rgba[i * 4] = ink[0] * s
    rgba[i * 4 + 1] = ink[1] * s
    rgba[i * 4 + 2] = ink[2] * s
    rgba[i * 4 + 3] = 255
  }
  return Buffer.from(rgba.buffer)
}

const OUT = 'public/house/birds'

async function main() {
  const root = process.cwd()
  mkdirSync(join(root, OUT), { recursive: true })

  // One sheet per theme: a near-black bird reads against a bright sky, and a
  // pale one against a night sky. Same geometry, different ink.
  const themes: Array<[string, [number, number, number]]> = [
    ['day', [30, 40, 58]],
    ['dusk', [58, 44, 86]],
  ]

  for (const [name, ink] of themes) {
    const cells: Buffer[] = []
    for (let f = 0; f < FRAMES; f++) {
      // Sampled half a step off, so no frame lands exactly on the level
      // crossing of the stroke — that is the one pose where the wing is
      // closest to edge-on, and hitting it dead on wastes a frame on a plank.
      const raw = renderFrame((f + 0.5) / FRAMES, ink)
      cells.push(
        await sharp(raw, { raw: { width: CELL * SS, height: CELL * SS, channels: 4 } })
          .resize(CELL, CELL)
          .png()
          .toBuffer(),
      )
    }

    const sheet = await sharp({
      create: {
        width: CELL * FRAMES,
        height: CELL,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(cells.map((input, i) => ({ input, left: i * CELL, top: 0 })))
      .png({ compressionLevel: 9 })
      .toBuffer()

    const file = `${OUT}/birds-${name}.png`
    writeFileSync(join(root, file), sheet)
    console.log(`  ${file}  ${CELL * FRAMES}×${CELL}  ${(sheet.length / 1024).toFixed(0)} KB`)
  }
}

main()
