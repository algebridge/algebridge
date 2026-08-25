/**
 * Per-house yard scenes, authored as vector art rather than photographs of a
 * painting.
 *
 * The house sprites are flat cartoon shapes with dark outlines. The old single
 * background was a soft painted landscape, and no amount of compositing makes
 * flat clipart sit convincingly inside a painting — the two are different
 * media. Drawing the scenery in the sprites' own language (flat fills,
 * saturated palette, dark edges on the near props) is what actually makes the
 * house and its surroundings read as one picture.
 *
 * Doing it in vector also buys the two things a single flat image cannot: a
 * different world per house, and layers the house can sit BETWEEN, so terrain
 * genuinely passes in front of its base.
 *
 * Everything here is literal or integer arithmetic. Nothing uses Math.sin or
 * Math.random, because this geometry is server-rendered and float divergence
 * between Node and the browser shows up as a hydration mismatch.
 */

export const SCENE_W = 1200;
export const SCENE_H = 800;
/** The y where a building's base sits, shared by every scene. */
export const SCENE_GROUND_Y = 528;

export type CritterKind = "hopper" | "runner" | "crab";

export interface ScenePaint {
  d: string;
  fill: string;
  stroke?: string;
  opacity?: number;
}

export interface YardScene {
  skyTop: string;
  skyBottom: string;
  orb: { cx: number; cy: number; r: number; fill: string; halo: string } | null;
  cloudFill: string;
  cloudOpacity: number;
  /** Behind the house, back to front. */
  back: ScenePaint[];
  /** In front of the house — this is what buries the sprite's flat base. */
  front: ScenePaint[];
  /** Nearer than the critter, so it runs behind this bank. */
  near: ScenePaint[];
  birdFill: string;
  critter: CritterKind;
  critterBody: string;
  critterAccent: string;
  /** Colour of the cast shadow on this scene's ground. */
  shadow: string;
}

/** A rolling silhouette. Plain arithmetic on integers, so SSR-safe. */
function ridge(baseY: number, step: number, amp: number, seed: number): string {
  let d = `M0,${baseY}`;
  for (let i = 0; i * step < SCENE_W; i++) {
    const rise = amp - ((i * 5 + seed * 11) % 3) * (amp / 4);
    d += ` q${step / 2},${-rise} ${step},0`;
  }
  return `${d} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`;
}

/** A band of grass tufts. The uneven top edge is the point: it lets some
 *  blades cross in front of a wall while others dip, which is what stops the
 *  base of a sprite reading as a straight cut. */
function tufts(baseY: number, bottomY: number, step: number, seed: number): string {
  let d = `M0,${baseY}`;
  for (let i = 0; i * step < SCENE_W; i++) {
    const h = 7 + ((i * 7 + seed * 13) % 5) * 4;
    d += ` q${step / 2},${-h} ${step},0`;
  }
  return `${d} L${SCENE_W},${bottomY} L0,${bottomY} Z`;
}

/** A deterministic sprinkle of blooms. Radii vary, otherwise a field of
 *  identical dots reads as confetti rather than flowers. */
function scatter(y0: number, y1: number, count: number, seed: number, r: number): string {
  const span = y1 - y0 > 1 ? y1 - y0 : 1;
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = ((i * 137 + seed * 61) % 1180) + 10;
    const y = y0 + ((i * 53 + seed * 29) % span);
    const rr = r - ((i * 31 + seed * 17) % 3);
    d += `M${x},${y} m${-rr},0 a${rr},${rr} 0 1,0 ${rr * 2},0 a${rr},${rr} 0 1,0 ${-rr * 2},0 `;
  }
  return d;
}

/**
 * A hill as two ridges: the lighter one first, then a darker one a little
 * lower over the top of it. The sliver left showing between them is the sunlit
 * crest, which is what gives a flat fill any sense of form.
 */
function hills(
  baseY: number,
  step: number,
  amp: number,
  seed: number,
  crest: string,
  body: string
): ScenePaint[] {
  return [
    { d: ridge(baseY, step, amp, seed), fill: crest },
    { d: ridge(baseY + 18, step, amp, seed), fill: body },
  ];
}

/** A rounded bush or shrub mass. */
function bush(cx: number, cy: number, w: number, h: number): string {
  return `M${cx - w},${cy} q${w * 0.1},${-h * 0.8} ${w * 0.62},${-h * 0.55} q${
    w * 0.28
  },${-h * 0.7} ${w * 0.72},${-h * 0.06} q${w * 0.5},${-h * 0.2} ${w * 0.66},${h * 0.61} Z`;
}

/** The open ground a house stands on, as a wide shallow oval. */
function clearing(cy: number, rx: number, ry: number): string {
  return `M${600 - rx},${cy} C${600 - rx},${cy - ry} ${600 - rx * 0.62},${cy - ry * 1.4} 600,${
    cy - ry * 1.4
  } C${600 + rx * 0.62},${cy - ry * 1.4} ${600 + rx},${cy - ry} ${600 + rx},${cy} C${
    600 + rx
  },${cy + ry * 1.5} ${600 + rx * 0.62},${cy + ry * 2} 600,${cy + ry * 2} C${
    600 - rx * 0.62
  },${cy + ry * 2} ${600 - rx},${cy + ry * 1.5} ${600 - rx},${cy} Z`;
}

export const YARD_SCENES: Record<string, YardScene> = {
  /* ── Cozy Cottage — a sunny meadow ─────────────────────────── */
  cottage: {
    skyTop: "#3FA9E4",
    skyBottom: "#C4EBFB",
    orb: { cx: 986, cy: 132, r: 58, fill: "#FFE071", halo: "#FFF6C4" },
    cloudFill: "#FFFFFF",
    cloudOpacity: 0.94,
    back: [
      ...hills(448, 200, 46, 1, "#A6DE87", "#8ACE6C"),
      ...hills(490, 240, 34, 4, "#8FD268", "#72C053"),
      { d: `M0,${SCENE_GROUND_Y + 4} L${SCENE_W},${SCENE_GROUND_Y - 2} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "#69BA4B" },
      { d: bush(96, 534, 78, 74), fill: "#4E9B3A", stroke: "#2F6B24" },
      { d: bush(1116, 532, 86, 80), fill: "#4E9B3A", stroke: "#2F6B24" },
      { d: bush(248, 528, 52, 46), fill: "#59A943", stroke: "#2F6B24" },
    ],
    front: [
      { d: tufts(512, 616, 60, 2), fill: "#55A63D" },
      { d: scatter(536, 598, 13, 3, 6), fill: "#FFF3B0" },
      { d: scatter(542, 600, 9, 9, 5), fill: "#F2A0C0" },
      { d: clearing(654, 440, 64), fill: "#CFA65C" },
      { d: clearing(656, 428, 58), fill: "#E4BD72" },
    ],
    near: [
      { d: tufts(706, 800, 84, 6), fill: "#3F8B2C" },
      { d: scatter(728, 790, 15, 5, 9), fill: "#FFFFFF" },
      { d: scatter(734, 794, 11, 11, 8), fill: "#F58BAF" },
      { d: scatter(740, 792, 8, 2, 8), fill: "#FFC94D" },
    ],
    birdFill: "#3B4A55",
    critter: "hopper",
    critterBody: "#F7EEDC",
    critterAccent: "#E4A9B0",
    shadow: "#2C4418",
  },

  /* ── Treehouse Hideout — a forest clearing ─────────────────── */
  treehouse: {
    skyTop: "#57BEDD",
    skyBottom: "#D9F4E8",
    orb: { cx: 236, cy: 122, r: 46, fill: "#FFF0A8", halo: "#FFFBDC" },
    cloudFill: "#F4FFFA",
    cloudOpacity: 0.82,
    back: [
      ...hills(424, 150, 62, 3, "#3A7C52", "#2C6642"),
      ...hills(474, 190, 48, 7, "#4A9A61", "#398350"),
      { d: `M0,${SCENE_GROUND_Y + 2} L${SCENE_W},${SCENE_GROUND_Y + 6} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "#5FA84A" },
      { d: bush(74, 536, 96, 104), fill: "#2E7040", stroke: "#1E4C2B" },
      { d: bush(1132, 534, 104, 112), fill: "#2E7040", stroke: "#1E4C2B" },
      { d: bush(214, 530, 58, 60), fill: "#37804A", stroke: "#1E4C2B" },
      { d: bush(998, 530, 62, 58), fill: "#37804A", stroke: "#1E4C2B" },
    ],
    front: [
      { d: tufts(510, 620, 54, 5), fill: "#3C7F38" },
      { d: scatter(538, 600, 11, 4, 6), fill: "#8FD46A" },
      { d: clearing(660, 416, 62), fill: "#A2764A" },
      { d: clearing(662, 404, 56), fill: "#BC8D58" },
    ],
    near: [
      { d: tufts(704, 800, 76, 1), fill: "#2C6330" },
      { d: scatter(726, 790, 13, 8, 9), fill: "#4E9B48" },
      { d: scatter(738, 792, 7, 3, 8), fill: "#E8D46A" },
    ],
    birdFill: "#33413A",
    critter: "runner",
    critterBody: "#E08340",
    critterAccent: "#FBF1E2",
    shadow: "#1F3A1C",
  },

  /* ── City Loft — rooftops at golden hour ───────────────────── */
  loft: {
    skyTop: "#4E9AD6",
    skyBottom: "#FFD8A6",
    orb: { cx: 878, cy: 296, r: 52, fill: "#FFC978", halo: "#FFE9C0" },
    cloudFill: "#FFE6CC",
    cloudOpacity: 0.66,
    back: [
      {
        d: "M0,470 L0,392 L64,392 L64,346 L138,346 L138,412 L206,412 L206,362 L286,362 L286,424 L352,424 L352,378 L438,378 L438,336 L508,336 L508,406 L586,406 L586,358 L664,358 L664,414 L742,414 L742,370 L826,370 L826,330 L900,330 L900,404 L978,404 L978,364 L1058,364 L1058,418 L1130,418 L1130,384 L1200,384 L1200,470 Z",
        fill: "#61739A",
      },
      {
        d: "M0,504 L0,436 L88,436 L88,404 L170,404 L170,458 L248,458 L248,418 L340,418 L340,470 L432,470 L432,430 L520,430 L520,486 L616,486 L616,442 L706,442 L706,478 L796,478 L796,424 L892,424 L892,472 L988,472 L988,438 L1084,438 L1084,482 L1200,482 L1200,504 Z",
        fill: "#414F6E",
      },
      { d: `M0,${SCENE_GROUND_Y} L${SCENE_W},${SCENE_GROUND_Y + 4} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "#8592A4" },
      { d: bush(88, 534, 66, 62), fill: "#4C8340", stroke: "#31552A" },
      { d: bush(1124, 532, 70, 66), fill: "#4C8340", stroke: "#31552A" },
    ],
    front: [
      { d: tufts(514, 618, 68, 4), fill: "#5A8F4A" },
      { d: clearing(664, 426, 60), fill: "#8A97A8" },
      { d: clearing(666, 414, 54), fill: "#A2AEBC" },
    ],
    near: [
      { d: tufts(708, 800, 90, 2), fill: "#46743B" },
      { d: scatter(730, 790, 11, 7, 9), fill: "#E8C765" },
      { d: scatter(742, 792, 7, 4, 8), fill: "#D9736A" },
    ],
    birdFill: "#3A4457",
    critter: "runner",
    critterBody: "#4A4A52",
    critterAccent: "#F0EDE6",
    shadow: "#2B3340",
  },

  /* ── Beach Bungalow — sand and open water ──────────────────── */
  beach: {
    skyTop: "#3FBCE8",
    skyBottom: "#DAF7FF",
    orb: { cx: 300, cy: 148, r: 60, fill: "#FFE68A", halo: "#FFF8D2" },
    cloudFill: "#FFFFFF",
    cloudOpacity: 0.9,
    back: [
      { d: `M0,436 L${SCENE_W},436 L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "#1E86BE" },
      { d: ridge(466, 260, 16, 2), fill: "#33A6D6" },
      { d: ridge(496, 200, 14, 5), fill: "#57C4E4" },
      { d: ridge(520, 170, 12, 8), fill: "#A6E6F2" },
      { d: `M0,${SCENE_GROUND_Y + 8} L${SCENE_W},${SCENE_GROUND_Y + 4} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "#F2DCA4" },
    ],
    front: [
      { d: tufts(528, 620, 76, 3), fill: "#E7CE92" },
      { d: clearing(668, 436, 58), fill: "#EBD49A" },
      { d: scatter(600, 650, 9, 6, 5), fill: "#D9BE7E" },
    ],
    near: [
      { d: tufts(714, 800, 96, 7), fill: "#D9BA78" },
      { d: scatter(738, 790, 8, 5, 10), fill: "#F5E3B8" },
      { d: scatter(746, 792, 6, 9, 8), fill: "#E0A98A" },
    ],
    birdFill: "#4A5560",
    critter: "crab",
    critterBody: "#E8623F",
    critterAccent: "#FFD9C4",
    shadow: "#8A6E3C",
  },

  /* ── Algebra Castle — mountains at dusk ────────────────────── */
  castle: {
    skyTop: "#5B4BA8",
    skyBottom: "#F5AE80",
    orb: { cx: 240, cy: 340, r: 56, fill: "#FFD08A", halo: "#FFE6BC" },
    cloudFill: "#E9CBE2",
    cloudOpacity: 0.58,
    back: [
      {
        d: "M0,470 L152,308 L268,412 L392,266 L534,430 L640,344 L768,452 L892,300 L1024,428 L1132,362 L1200,438 L1200,800 L0,800 Z",
        fill: "#4A4477",
      },
      {
        d: "M0,498 L128,404 L246,478 L376,392 L502,486 L628,418 L760,496 L888,406 L1010,486 L1128,428 L1200,486 L1200,800 L0,800 Z",
        fill: "#61598F",
      },
      { d: `M0,${SCENE_GROUND_Y + 2} L${SCENE_W},${SCENE_GROUND_Y + 8} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "#6E8A50" },
      { d: bush(84, 536, 74, 70), fill: "#4B6338", stroke: "#2E3F22" },
      { d: bush(1128, 534, 80, 76), fill: "#4B6338", stroke: "#2E3F22" },
    ],
    front: [
      { d: tufts(512, 618, 58, 6), fill: "#57703E" },
      { d: clearing(660, 432, 64), fill: "#75663D" },
      { d: clearing(662, 420, 58), fill: "#8F7C50" },
    ],
    near: [
      { d: tufts(704, 800, 82, 3), fill: "#42562F" },
      { d: scatter(728, 790, 11, 6, 9), fill: "#6E8A50" },
      { d: scatter(740, 792, 6, 10, 8), fill: "#C9A6E0" },
    ],
    birdFill: "#2E2647",
    critter: "runner",
    critterBody: "#7A67A0",
    critterAccent: "#EADEF5",
    shadow: "#2A2140",
  },
};

export function getYardScene(houseStyleId: string): YardScene {
  return YARD_SCENES[houseStyleId] ?? YARD_SCENES.cottage;
}
