/**
 * Per-house yard scenes.
 *
 * Read this before changing anything here: the realism of this screen is
 * capped by the house sprites, not by the scenery. The five buildings are flat
 * cartoon clipart with hard black outlines. Realism is a property of a whole
 * picture, so a photographic background behind a cartoon building looks worse
 * than an illustrated one, not better — that mismatch is exactly what made the
 * original painted yard read as a sticker board.
 *
 * So these scenes are built as rich illustration rather than flat shapes:
 * gradient terrain, atmospheric haze at the horizon, volumetric cloud, ground
 * texture and depth of field. That is as far as this can go while the
 * buildings stay cartoon.
 *
 * If real renders arrive later, set `image` on a scene and every vector layer
 * is skipped — see YardScene.tsx. Swapping in photoreal art is then one line
 * per house, and the animated sky and critter keep working on top of it.
 *
 * Everything is literal or integer arithmetic. No Math.sin, no Math.random:
 * this is server-rendered, and float divergence between Node and the browser
 * surfaces as a hydration mismatch.
 */

export const SCENE_W = 1200;
export const SCENE_H = 800;
/** The y where a building's base sits, shared by every scene. */
export const SCENE_GROUND_Y = 528;

export interface ScenePaint {
  d: string;
  /** A colour, or "url(#id)" naming one of the scene's gradients. */
  fill: string;
  opacity?: number;
  /** Depth of field, in scene units. */
  blur?: number;
}

export interface SceneGrad {
  id: string;
  from: string;
  to: string;
}

export interface YardScene {
  /** Set to a real render or photograph to bypass every vector layer below. */
  image?: string;
  /** The building, rendered with this yard's own camera and sun. Full frame,
   *  so it composites as a straight overlay. */
  model?: string;
  /** Sky gradient, top to horizon. */
  sky: string[];
  /** Colour the horizon washes toward, which is what reads as distance. */
  haze: string;
  hazeTop: number;
  orb: { cx: number; cy: number; r: number; core: string; glow: string } | null;
  cloudTop: string;
  cloudBottom: string;
  cloudOpacity: number;
  grads: SceneGrad[];
  /** Behind the house, back to front. */
  back: ScenePaint[];
  /** In front of the house — this is what buries the sprite's flat base. */
  front: ScenePaint[];
  /** Nearer than the critter, so it runs behind this bank. */
  near: ScenePaint[];
  /** Fine strokes over the mid ground, so grass is not one flat wash. */
  texture: { fill: string; opacity: number } | null;
  /** Castle flies at dusk, so its birds take the paler ink. */
  duskBirds: boolean;
  /** Which rendered coat crosses this yard, and how far down it runs. */
  critterCoat: "hare" | "fox" | "grey";
  critterTop: number;
  shadow: string;
}

/** A rolling silhouette. */
function ridge(baseY: number, step: number, amp: number, seed: number): string {
  let d = `M0,${baseY}`;
  for (let i = 0; i * step < SCENE_W; i++) {
    const rise = amp - ((i * 5 + seed * 11) % 3) * (amp / 4);
    d += ` q${step / 2},${-rise} ${step},0`;
  }
  return `${d} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`;
}

/**
 * A band of grass tufts. The uneven top edge is the point: it lets some blades
 * cross in front of a wall while others dip, which is what stops the base of a
 * sprite reading as a straight cut.
 */
function tufts(baseY: number, bottomY: number, step: number, seed: number): string {
  let d = `M0,${baseY}`;
  for (let i = 0; i * step < SCENE_W; i++) {
    const h = 7 + ((i * 7 + seed * 13) % 5) * 4;
    d += ` q${step / 2},${-h} ${step},0`;
  }
  return `${d} L${SCENE_W},${bottomY} L0,${bottomY} Z`;
}

/** A deterministic sprinkle of blooms, with varied radii. */
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
  /* ── Cozy Cottage — a summer meadow, late morning ───────────── */
  cottage: {
    image: "/house/yards/cottage.webp",
    model: "/house/models/cottage.webp",
    sky: ["#1E6FC4", "#4E9EDC", "#8FC9EC", "#D8ECF5"],
    haze: "#DCEDF4",
    hazeTop: 0.44,
    orb: { cx: 972, cy: 138, r: 54, core: "#FFF6D2", glow: "#FFE690" },
    cloudTop: "#FFFFFF",
    cloudBottom: "#C4D6E4",
    cloudOpacity: 0.95,
    grads: [
      { id: "far", from: "#A9DC8B", to: "#7FBE64" },
      { id: "mid", from: "#8ACF69", to: "#5FA544" },
      { id: "gnd", from: "#74C152", to: "#4A8F31" },
      { id: "dirt", from: "#E8C583", to: "#C0964E" },
      { id: "band", from: "#5EAA43", to: "#3E7C2A" },
      { id: "near", from: "#437F2C", to: "#27551A" },
      { id: "shrub", from: "#4E9B3A", to: "#2E6522" },
    ],
    back: [
      { d: ridge(444, 210, 44, 1), fill: "url(#far)" },
      { d: ridge(488, 250, 32, 4), fill: "url(#mid)" },
      { d: `M0,${SCENE_GROUND_Y + 4} L${SCENE_W},${SCENE_GROUND_Y - 2} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "url(#gnd)" },
      { d: bush(96, 534, 78, 74), fill: "url(#shrub)" },
      { d: bush(1116, 532, 86, 80), fill: "url(#shrub)" },
      { d: bush(248, 528, 52, 46), fill: "url(#shrub)" },
    ],
    front: [
      { d: tufts(512, 616, 60, 2), fill: "url(#band)" },
      { d: scatter(536, 598, 13, 3, 6), fill: "#FFF6C0", opacity: 0.9 },
      { d: scatter(542, 600, 9, 9, 5), fill: "#F5AECB", opacity: 0.85 },
      { d: clearing(654, 440, 64), fill: "url(#dirt)", blur: 2  },
    ],
    near: [
      { d: tufts(706, 800, 84, 6), fill: "url(#near)", blur: 2.5 },
      { d: scatter(728, 790, 15, 5, 9), fill: "#FFFFFF", opacity: 0.9, blur: 2.5 },
      { d: scatter(734, 794, 11, 11, 8), fill: "#F58BAF", opacity: 0.9, blur: 2.5 },
      { d: scatter(740, 792, 8, 2, 8), fill: "#FFC94D", opacity: 0.9, blur: 2.5 },
    ],
    texture: { fill: "#2F6B20", opacity: 0.14 },
    duskBirds: false,
    critterCoat: "hare",
    critterTop: 79,
    shadow: "#22380F",
  },

  /* ── Treehouse Hideout — a forest clearing ─────────────────── */
  treehouse: {
    image: "/house/yards/treehouse.webp",
    model: "/house/models/treehouse.webp",
    sky: ["#2E9BC4", "#63C0DA", "#A8DDE4", "#DCF2E8"],
    haze: "#DCF2E8",
    hazeTop: 0.42,
    orb: { cx: 232, cy: 124, r: 44, core: "#FFFBE4", glow: "#FFF0A8" },
    cloudTop: "#FCFFFD",
    cloudBottom: "#C8DCD4",
    cloudOpacity: 0.82,
    grads: [
      { id: "far", from: "#3C7C52", to: "#245239" },
      { id: "mid", from: "#4FA063", to: "#2F7245" },
      { id: "gnd", from: "#68B152", to: "#3F7C32" },
      { id: "dirt", from: "#C0925C", to: "#8E653C" },
      { id: "band", from: "#43893D", to: "#2A5C29" },
      { id: "near", from: "#2E6A32", to: "#17401C" },
      { id: "shrub", from: "#357A45", to: "#1C4728" },
    ],
    back: [
      { d: ridge(420, 160, 60, 3), fill: "url(#far)" },
      { d: ridge(472, 200, 46, 7), fill: "url(#mid)" },
      { d: `M0,${SCENE_GROUND_Y + 2} L${SCENE_W},${SCENE_GROUND_Y + 6} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "url(#gnd)" },
      { d: bush(74, 536, 96, 104), fill: "url(#shrub)" },
      { d: bush(1132, 534, 104, 112), fill: "url(#shrub)" },
      { d: bush(214, 530, 58, 60), fill: "url(#shrub)" },
      { d: bush(998, 530, 62, 58), fill: "url(#shrub)" },
    ],
    front: [
      { d: tufts(510, 620, 54, 5), fill: "url(#band)" },
      { d: scatter(538, 600, 11, 4, 6), fill: "#A6E27C", opacity: 0.8 },
      { d: clearing(660, 416, 62), fill: "url(#dirt)", blur: 2  },
    ],
    near: [
      { d: tufts(704, 800, 76, 1), fill: "url(#near)", blur: 2.5 },
      { d: scatter(726, 790, 13, 8, 9), fill: "#59A84F", opacity: 0.9, blur: 2.5 },
      { d: scatter(738, 792, 7, 3, 8), fill: "#EFDD78", opacity: 0.9, blur: 2.5 },
    ],
    texture: { fill: "#1C4A20", opacity: 0.16 },
    duskBirds: false,
    critterCoat: "fox",
    critterTop: 78,
    shadow: "#12300F",
  },

  /* ── City Loft — rooftops at golden hour ───────────────────── */
  loft: {
    image: "/house/yards/loft.webp",
    model: "/house/models/loft.webp",
    sky: ["#2C6FB4", "#5E9FD2", "#E9B888", "#FFD9A8"],
    haze: "#FFD9A8",
    hazeTop: 0.4,
    orb: { cx: 872, cy: 322, r: 50, core: "#FFF0CE", glow: "#FFC06A" },
    cloudTop: "#FFE9D2",
    cloudBottom: "#C79C86",
    cloudOpacity: 0.62,
    grads: [
      { id: "far", from: "#7E8CAE", to: "#54628A" },
      { id: "mid", from: "#54628A", to: "#333F5E" },
      { id: "gnd", from: "#93A0B2", to: "#66717F" },
      { id: "dirt", from: "#AEB9C6", to: "#7D8894" },
      { id: "band", from: "#639A50", to: "#3F6B34" },
      { id: "near", from: "#4A7A3C", to: "#2A4A22" },
      { id: "shrub", from: "#528C42", to: "#2F5628" },
    ],
    back: [
      {
        d: "M0,470 L0,392 L64,392 L64,346 L138,346 L138,412 L206,412 L206,362 L286,362 L286,424 L352,424 L352,378 L438,378 L438,336 L508,336 L508,406 L586,406 L586,358 L664,358 L664,414 L742,414 L742,370 L826,370 L826,330 L900,330 L900,404 L978,404 L978,364 L1058,364 L1058,418 L1130,418 L1130,384 L1200,384 L1200,470 Z",
        fill: "url(#far)",
      },
      {
        d: "M0,504 L0,436 L88,436 L88,404 L170,404 L170,458 L248,458 L248,418 L340,418 L340,470 L432,470 L432,430 L520,430 L520,486 L616,486 L616,442 L706,442 L706,478 L796,478 L796,424 L892,424 L892,472 L988,472 L988,438 L1084,438 L1084,482 L1200,482 L1200,504 Z",
        fill: "url(#mid)",
      },
      { d: `M0,${SCENE_GROUND_Y} L${SCENE_W},${SCENE_GROUND_Y + 4} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "url(#gnd)" },
      { d: bush(88, 534, 66, 62), fill: "url(#shrub)" },
      { d: bush(1124, 532, 70, 66), fill: "url(#shrub)" },
    ],
    front: [
      { d: tufts(514, 618, 68, 4), fill: "url(#band)" },
      { d: clearing(664, 426, 60), fill: "url(#dirt)", blur: 2  },
    ],
    near: [
      { d: tufts(708, 800, 90, 2), fill: "url(#near)", blur: 2.5 },
      { d: scatter(730, 790, 11, 7, 9), fill: "#EFCE72", opacity: 0.9, blur: 2.5 },
      { d: scatter(742, 792, 7, 4, 8), fill: "#DE7C72", opacity: 0.9, blur: 2.5 },
    ],
    texture: { fill: "#3A4A2C", opacity: 0.12 },
    duskBirds: false,
    critterCoat: "grey",
    critterTop: 80,
    shadow: "#232A36",
  },

  /* ── Beach Bungalow — open shore ───────────────────────────── */
  beach: {
    image: "/house/yards/beach.webp",
    model: "/house/models/beach.webp",
    sky: ["#1E96D4", "#55BCE6", "#9EDCF0", "#E0F6FF"],
    haze: "#E0F6FF",
    hazeTop: 0.42,
    orb: { cx: 296, cy: 150, r: 58, core: "#FFFAE0", glow: "#FFE58A" },
    cloudTop: "#FFFFFF",
    cloudBottom: "#BFD8E4",
    cloudOpacity: 0.9,
    grads: [
      { id: "sea", from: "#1173A8", to: "#2C9CCE" },
      { id: "surf1", from: "#3FAEDA", to: "#63C6E6" },
      { id: "surf2", from: "#7FD4EC", to: "#B4E9F4" },
      { id: "gnd", from: "#F6E2AE", to: "#DCC085" },
      { id: "dirt", from: "#F1DAA2", to: "#D8BB7E" },
      { id: "band", from: "#EDD79C", to: "#D2B173" },
      { id: "near", from: "#DDBC7C", to: "#B8965A" },
    ],
    back: [
      { d: `M0,432 L${SCENE_W},432 L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "url(#sea)" },
      { d: ridge(468, 260, 16, 2), fill: "url(#surf1)" },
      { d: ridge(498, 200, 14, 5), fill: "url(#surf2)" },
      { d: ridge(520, 170, 11, 8), fill: "#DFF4FA", opacity: 0.9 },
      { d: `M0,${SCENE_GROUND_Y + 8} L${SCENE_W},${SCENE_GROUND_Y + 4} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "url(#gnd)" },
    ],
    front: [
      { d: tufts(528, 620, 76, 3), fill: "url(#band)" },
      { d: clearing(668, 436, 58), fill: "url(#dirt)", blur: 2  },
      { d: scatter(600, 650, 9, 6, 5), fill: "#C9A96A", opacity: 0.5 },
    ],
    near: [
      { d: tufts(714, 800, 96, 7), fill: "url(#near)", blur: 2.5 },
      { d: scatter(738, 790, 8, 5, 10), fill: "#FBEDC8", opacity: 0.9, blur: 2.5 },
      { d: scatter(746, 792, 6, 9, 8), fill: "#E8B394", opacity: 0.9, blur: 2.5 },
    ],
    texture: null,
    duskBirds: false,
    critterCoat: "hare",
    critterTop: 81,
    shadow: "#7A5E2C",
  },

  /* ── Algebra Castle — mountains at dusk ────────────────────── */
  castle: {
    image: "/house/yards/castle.webp",
    model: "/house/models/castle.webp",
    sky: ["#3B2E7E", "#6A55A8", "#B87FA4", "#F5B184"],
    haze: "#F0AE84",
    hazeTop: 0.46,
    orb: { cx: 236, cy: 348, r: 54, core: "#FFE7BE", glow: "#FFB870" },
    cloudTop: "#F2D2E4",
    cloudBottom: "#9E7CA8",
    cloudOpacity: 0.55,
    grads: [
      { id: "far", from: "#5A5290", to: "#372F62" },
      { id: "mid", from: "#6E64A0", to: "#453C74" },
      { id: "gnd", from: "#7B9557", to: "#4E6336" },
      { id: "dirt", from: "#95815A", to: "#6B5B39" },
      { id: "band", from: "#5F7845", to: "#3C4E2A" },
      { id: "near", from: "#465A31", to: "#26331A" },
      { id: "shrub", from: "#4F6A3A", to: "#2C3C20" },
    ],
    back: [
      {
        d: "M0,470 L152,308 L268,412 L392,266 L534,430 L640,344 L768,452 L892,300 L1024,428 L1132,362 L1200,438 L1200,800 L0,800 Z",
        fill: "url(#far)",
      },
      {
        d: "M0,498 L128,404 L246,478 L376,392 L502,486 L628,418 L760,496 L888,406 L1010,486 L1128,428 L1200,486 L1200,800 L0,800 Z",
        fill: "url(#mid)",
      },
      { d: `M0,${SCENE_GROUND_Y + 2} L${SCENE_W},${SCENE_GROUND_Y + 8} L${SCENE_W},${SCENE_H} L0,${SCENE_H} Z`, fill: "url(#gnd)" },
      { d: bush(84, 536, 74, 70), fill: "url(#shrub)" },
      { d: bush(1128, 534, 80, 76), fill: "url(#shrub)" },
    ],
    front: [
      { d: tufts(512, 618, 58, 6), fill: "url(#band)" },
      { d: clearing(660, 432, 64), fill: "url(#dirt)", blur: 2  },
    ],
    near: [
      { d: tufts(704, 800, 82, 3), fill: "url(#near)", blur: 2.5 },
      { d: scatter(728, 790, 11, 6, 9), fill: "#7A9459", opacity: 0.9, blur: 2.5 },
      { d: scatter(740, 792, 6, 10, 8), fill: "#D2AEE8", opacity: 0.9, blur: 2.5 },
    ],
    texture: { fill: "#26331A", opacity: 0.16 },
    duskBirds: true,
    critterCoat: "grey",
    critterTop: 79,
    shadow: "#1E1633",
  },
};

export function getYardScene(houseStyleId: string): YardScene {
  return YARD_SCENES[houseStyleId] ?? YARD_SCENES.cottage;
}
