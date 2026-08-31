/**
 * How each house is drawn, flat.
 *
 * The old exteriors were ray-marched: five buildings, twelve angles each, 3.3
 * MB of WebP that had to be regenerated whenever a wall colour changed. This
 * is the same five houses as data, a palette, a roof shape and a backdrop -
 * fed to one drawing routine. A sixth house is a row in this file, not a
 * render farm.
 *
 * Rules the palettes follow, so the five read as one set:
 *  - No outlines. An edge is a darker shade of the thing it edges.
 *  - Two tones per surface, lit from the upper left. Flat tones, never a
 *    gradient faking roundness, a gradient is the one thing that makes flat
 *    art look like failed 3D.
 *  - Detail comes from repetition (courses, planks, mullions), not shading.
 *
 * Every number is a literal. This renders on the server as well as the
 * browser, and computed geometry that disagrees by a float shows up as a
 * hydration mismatch rather than a wrong pixel.
 */

export type RoofKind = "gable" | "canopy" | "flat" | "turret" | "thatch";
export type BackdropKind = "hills" | "forest" | "skyline" | "sea" | "peaks";

export interface HousePalette {
  wall: string;
  wallShade: string;
  /** Thin horizontal courses on the wall: siding, brick, planks. */
  course: string;
  roof: string;
  roofShade: string;
  trim: string;
  door: string;
  doorShade: string;
  glass: string;
  glassShade: string;
  frame: string;
  /** The one saturated colour the house is allowed. */
  accent: string;
}

export interface RoomPalette {
  wall: string;
  wallShade: string;
  floor: string;
  floorShade: string;
  skirting: string;
  rug: string;
  rugShade: string;
}

export interface HouseArt {
  sky: [string, string];
  backdrop: BackdropKind;
  /** Far layer, near layer. */
  far: string;
  near: string;
  groundFar: string;
  groundNear: string;
  /** The hedgerow/dune band between the horizon and the lawn. It has to be
   *  its own tone: painted in the backdrop's green it vanished into the hills. */
  mid: string;
  midLight: string;
  /** The seam between the far lawn and the near one. */
  groundEdge: string;
  roof: RoofKind;
  chimney: boolean;
  palette: HousePalette;
  room: RoomPalette;
}

export const HOUSE_ART: Record<string, HouseArt> = {
  cottage: {
    sky: ["#cfe8fb", "#eef7fd"],
    backdrop: "hills",
    far: "#b3d3a4",
    near: "#9bc78d",
    groundFar: "#8fbd79",
    groundNear: "#7fae6b",
    mid: "#679a52",
    midLight: "#82b26b",
    groundEdge: "#74a361",
    roof: "gable",
    chimney: true,
    palette: {
      wall: "#f5ead6",
      wallShade: "#e4d5ba",
      course: "#ded0b4",
      roof: "#c7714f",
      roofShade: "#a85a3d",
      trim: "#ffffff",
      door: "#2f5d8a",
      doorShade: "#254a6f",
      glass: "#bfe0f2",
      glassShade: "#9dcbe4",
      frame: "#ffffff",
      accent: "#e0902f",
    },
    room: {
      wall: "#fbf3e4",
      wallShade: "#efe3cd",
      floor: "#c98f52",
      floorShade: "#b17b43",
      skirting: "#f7efe0",
      rug: "#7fa8c4",
      rugShade: "#6a92ad",
    },
  },

  treehouse: {
    sky: ["#d8ecdc", "#f2f9f2"],
    backdrop: "forest",
    far: "#5d8a67",
    near: "#456f52",
    groundFar: "#7cb570",
    groundNear: "#6ba460",
    mid: "#3d6b4d",
    midLight: "#528565",
    groundEdge: "#5f9455",
    roof: "canopy",
    chimney: false,
    palette: {
      wall: "#b98151",
      wallShade: "#9d6740",
      course: "#8f5c39",
      roof: "#5d8050",
      roofShade: "#4a6941",
      trim: "#d6ac7c",
      door: "#7a4b2c",
      doorShade: "#653c22",
      glass: "#cfe7db",
      glassShade: "#aecfbe",
      frame: "#d6ac7c",
      accent: "#e2b13c",
    },
    room: {
      wall: "#e6d3b6",
      wallShade: "#d6c0a0",
      floor: "#a5713f",
      floorShade: "#8d5e33",
      skirting: "#efe1c9",
      rug: "#6f9a63",
      rugShade: "#5c8452",
    },
  },

  loft: {
    sky: ["#d5e2f0", "#f2f6fa"],
    backdrop: "skyline",
    far: "#c2cfdd",
    near: "#a7b8cb",
    groundFar: "#b8bfc8",
    groundNear: "#a8b0ba",
    mid: "#8d99a8",
    midLight: "#a6b1bd",
    groundEdge: "#99a1ac",
    roof: "flat",
    chimney: false,
    palette: {
      wall: "#dde3ea",
      wallShade: "#c8d0da",
      course: "#c1cad4",
      roof: "#6e7987",
      roofShade: "#5b6472",
      trim: "#94a0b0",
      door: "#3f4b5a",
      doorShade: "#333d4a",
      glass: "#a9cade",
      glassShade: "#88b0ca",
      frame: "#7d8b9c",
      accent: "#2563eb",
    },
    room: {
      wall: "#e7ecf2",
      wallShade: "#d5dce5",
      floor: "#8d97a3",
      floorShade: "#79838f",
      skirting: "#f2f5f9",
      rug: "#2563eb",
      rugShade: "#1e4fc4",
    },
  },

  beach: {
    sky: ["#bfe6f5", "#f7f4e4"],
    backdrop: "sea",
    far: "#5fb9cd",
    near: "#3f9db4",
    groundFar: "#ead6a2",
    groundNear: "#dcc48d",
    mid: "#c9ab6f",
    midLight: "#dcc28c",
    groundEdge: "#cfb57e",
    roof: "thatch",
    chimney: false,
    palette: {
      wall: "#f3e4c7",
      wallShade: "#e0cda8",
      course: "#d8c39b",
      roof: "#c9a05e",
      roofShade: "#ab8449",
      trim: "#ffffff",
      door: "#2b8b9b",
      doorShade: "#217382",
      glass: "#c9ecf4",
      glassShade: "#a4d8e5",
      frame: "#ffffff",
      accent: "#ef7d52",
    },
    room: {
      wall: "#f6efdb",
      wallShade: "#e8dec5",
      floor: "#e0c48f",
      floorShade: "#cbad77",
      skirting: "#fdfaf0",
      rug: "#3fa4b7",
      rugShade: "#338c9d",
    },
  },

  castle: {
    sky: ["#d6d0ee", "#f0ecf9"],
    backdrop: "peaks",
    far: "#9b91c0",
    near: "#7e73a8",
    groundFar: "#94b87c",
    groundNear: "#83a86d",
    mid: "#6a8c56",
    midLight: "#84a56d",
    groundEdge: "#769a61",
    roof: "turret",
    chimney: false,
    palette: {
      wall: "#cec8dc",
      wallShade: "#b5adca",
      course: "#aca3c3",
      roof: "#6b4fa0",
      roofShade: "#563e85",
      trim: "#a79ec4",
      door: "#5b4230",
      doorShade: "#4a3527",
      glass: "#e3d8f2",
      glassShade: "#c9bbe2",
      frame: "#a79ec4",
      accent: "#d4af37",
    },
    room: {
      wall: "#ded8ea",
      wallShade: "#cbc3dc",
      floor: "#9d94b3",
      floorShade: "#877ea0",
      skirting: "#efeaf7",
      rug: "#8b3f5e",
      rugShade: "#74334e",
    },
  },
};

export function getHouseArt(styleId: string): HouseArt {
  return HOUSE_ART[styleId] ?? HOUSE_ART.cottage;
}

/**
 * Backdrop silhouettes, authored as literal paths against the 1200x800 scene.
 * Two layers per scene: the far one washes toward the sky, the near one sits
 * on the horizon. Depth is the gap between those two tones, nothing else.
 */
export const BACKDROPS: Record<BackdropKind, { far: string; near: string }> = {
  hills: {
    far: "M0 430 L0 352 Q120 296 246 336 Q352 370 452 322 Q566 268 690 316 Q812 362 918 318 Q1040 268 1200 330 L1200 430 Z",
    near: "M0 430 L0 392 Q142 344 268 384 Q386 420 494 380 Q610 336 742 382 Q866 424 986 386 Q1100 350 1200 392 L1200 430 Z",
  },
  forest: {
    far: "M0 430 L0 300 L36 246 L72 300 L104 232 L140 300 L172 258 L208 300 L244 220 L282 300 L316 254 L352 300 L388 234 L424 300 L458 262 L494 300 L530 226 L568 300 L602 256 L638 300 L674 238 L710 300 L744 262 L780 300 L816 224 L854 300 L888 258 L924 300 L960 236 L996 300 L1030 260 L1066 300 L1102 230 L1140 300 L1172 254 L1200 300 L1200 430 Z",
    near: "M0 430 L0 348 L44 288 L88 348 L128 302 L172 348 L214 276 L258 348 L298 306 L342 348 L384 284 L428 348 L468 310 L512 348 L554 282 L598 348 L638 304 L682 348 L724 278 L768 348 L808 308 L852 348 L894 286 L938 348 L978 302 L1022 348 L1064 280 L1108 348 L1148 306 L1200 348 L1200 430 Z",
  },
  skyline: {
    far: "M0 430 L0 322 L58 322 L58 268 L112 268 L112 322 L164 322 L164 224 L226 224 L226 322 L286 322 L286 286 L340 286 L340 322 L400 322 L400 240 L462 240 L462 322 L520 322 L520 292 L578 292 L578 322 L640 322 L640 250 L700 250 L700 322 L760 322 L760 282 L818 282 L818 322 L878 322 L878 236 L938 236 L938 322 L998 322 L998 290 L1056 290 L1056 322 L1120 322 L1120 262 L1180 262 L1180 322 L1200 322 L1200 430 Z",
    near: "M0 430 L0 372 L70 372 L70 330 L138 330 L138 372 L206 372 L206 300 L276 300 L276 372 L344 372 L344 344 L412 344 L412 372 L482 372 L482 312 L552 312 L552 372 L620 372 L620 340 L690 340 L690 372 L758 372 L758 296 L828 296 L828 372 L896 372 L896 348 L964 348 L964 372 L1034 372 L1034 318 L1104 318 L1104 372 L1200 372 L1200 430 Z",
  },
  sea: {
    far: "M0 430 L0 372 Q108 356 214 372 Q296 384 372 366 Q470 344 566 368 Q660 390 758 370 Q862 348 962 370 Q1076 394 1200 366 L1200 430 Z",
    near: "M0 430 L0 400 Q142 386 262 402 Q374 416 486 400 Q600 384 716 402 Q834 420 944 402 Q1074 382 1200 400 L1200 430 Z",
  },
  peaks: {
    far: "M0 430 L0 336 L128 200 L206 288 L282 176 L400 320 L470 254 L560 158 L688 306 L764 232 L858 186 L966 312 L1050 244 L1128 190 L1200 292 L1200 430 Z",
    near: "M0 430 L0 388 L104 288 L182 356 L268 264 L372 384 L446 320 L536 248 L648 380 L730 316 L818 276 L920 384 L1006 328 L1094 282 L1200 372 L1200 430 Z",
  },
};
