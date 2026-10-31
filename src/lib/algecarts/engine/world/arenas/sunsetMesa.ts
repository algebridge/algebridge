import type { ArenaDef, Block, Spawn } from "../Arena";
import type { Prop } from "../Props";

const ring = (n: number, r: number): Spawn[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    return { x, z, yaw: Math.atan2(-x, -z) };
  });

const WALL = "#c9603a";
const TOP = "#e8905f";
const RAMP = "#d97a4a";

const blocks: Block[] = [
  // The mesa in the middle, with a ramp up each side.
  { kind: "box", x: 0, z: 0, w: 20, h: 3, d: 20, color: WALL, top: TOP },
  { kind: "ramp", x: 0, z: 15, w: 8, d: 10, h0: 0, h1: 3, dir: "-z", color: RAMP },
  { kind: "ramp", x: 0, z: -15, w: 8, d: 10, h0: 0, h1: 3, dir: "+z", color: RAMP },
  { kind: "ramp", x: 15, z: 0, w: 10, d: 8, h0: 0, h1: 3, dir: "-x", color: RAMP },
  { kind: "ramp", x: -15, z: 0, w: 10, d: 8, h0: 0, h1: 3, dir: "+x", color: RAMP },
  // Corner lookouts, each reached by one ramp from inside the arena.
  { kind: "box", x: 40, z: 40, w: 12, h: 2.2, d: 12, color: WALL, top: TOP },
  { kind: "ramp", x: 40, z: 29, w: 7, d: 10, h0: 0, h1: 2.2, dir: "+z", color: RAMP },
  { kind: "box", x: -40, z: 40, w: 12, h: 2.2, d: 12, color: WALL, top: TOP },
  { kind: "ramp", x: -29, z: 40, w: 10, d: 7, h0: 0, h1: 2.2, dir: "-x", color: RAMP },
  { kind: "box", x: -40, z: -40, w: 12, h: 2.2, d: 12, color: WALL, top: TOP },
  { kind: "ramp", x: -40, z: -29, w: 7, d: 10, h0: 0, h1: 2.2, dir: "-z", color: RAMP },
  { kind: "box", x: 40, z: -40, w: 12, h: 2.2, d: 12, color: WALL, top: TOP },
  { kind: "ramp", x: 29, z: -40, w: 10, d: 7, h0: 0, h1: 2.2, dir: "+x", color: RAMP },
  // Pillars to weave around.
  { kind: "box", x: 24, z: 24, w: 3, h: 6, d: 3, color: "#b24e2e" },
  { kind: "box", x: -24, z: 24, w: 3, h: 6, d: 3, color: "#b24e2e" },
  { kind: "box", x: 24, z: -24, w: 3, h: 6, d: 3, color: "#b24e2e" },
  { kind: "box", x: -24, z: -24, w: 3, h: 6, d: 3, color: "#b24e2e" },
  // Low rock walls across the mid lanes.
  { kind: "box", x: 0, z: 42, w: 14, h: 2, d: 2, color: "#b98b64", top: "#d4a97e" },
  { kind: "box", x: 0, z: -42, w: 14, h: 2, d: 2, color: "#b98b64", top: "#d4a97e" },
  // Kickers: launch toward the mesa.
  { kind: "ramp", x: -34, z: 0, w: 8, d: 7, h0: 0, h1: 2.6, dir: "+x", color: "#2ec4b6" },
  { kind: "ramp", x: 34, z: 0, w: 8, d: 7, h0: 0, h1: 2.6, dir: "-x", color: "#2ec4b6" },
  // Kickers at the side lanes, launching along the walls.
  { kind: "ramp", x: 16, z: 44, w: 6, d: 6, h0: 0, h1: 1.8, dir: "+x", color: "#2ec4b6" },
  { kind: "ramp", x: -16, z: -44, w: 6, d: 6, h0: 0, h1: 1.8, dir: "-x", color: "#2ec4b6" },
];

const props: Prop[] = [
  // Inside dressing.
  { kind: "flag", x: 9, z: 9, y: 3, color: "#2ec4b6" },
  { kind: "flag", x: -9, z: 9, y: 3, color: "#ff5d8f" },
  { kind: "flag", x: 9, z: -9, y: 3, color: "#ff5d8f" },
  { kind: "flag", x: -9, z: -9, y: 3, color: "#2ec4b6" },
  { kind: "rock", x: 44, z: 12, s: 1.1 },
  { kind: "rock", x: -44, z: -14, s: 0.9, ry: 1.2 },
  { kind: "rock", x: 30, z: -46, s: 0.8, ry: 2.2 },
  { kind: "cactus", x: 46, z: -22, s: 0.8 },
  { kind: "cactus", x: -46, z: 24, s: 0.75, ry: 1 },
  { kind: "tires", x: 24, z: 44 },
  { kind: "tires", x: -24, z: -44 },
  { kind: "boulder", x: 46, z: -46, s: 0.8, ry: 0.6 },
  { kind: "boulder", x: -46, z: 46, s: 0.7, ry: 2.1 },
  { kind: "cactus", x: 12, z: 47, s: 0.7, ry: 0.4 },
  { kind: "cactus", x: -14, z: -47, s: 0.65, ry: 2.6 },
  { kind: "rock", x: 47, z: -30, s: 0.7 },
  { kind: "rock", x: -47, z: 32, s: 0.75, ry: 1.9 },
  { kind: "barrel", x: 46, z: 46, color: "#2ec4b6" },
  { kind: "barrel", x: -46, z: -46, color: "#ff5d8f" },
  // The desert beyond the walls.
  { kind: "mesa", x: 110, z: 40, h: 16, s: 1.2 },
  { kind: "mesa", x: 90, z: -120, h: 12, s: 1.0, ry: 0.5 },
  { kind: "mesa", x: -130, z: -30, h: 20, s: 1.4, ry: 0.3 },
  { kind: "mesa", x: -80, z: 130, h: 10, s: 0.9, ry: 1.1 },
  { kind: "mountain", x: 160, z: 160, h: 46, color: "#7a4f8a" },
  { kind: "mountain", x: -170, z: 120, h: 40, color: "#6f4a7a" },
  { kind: "mountain", x: 40, z: -190, h: 52, color: "#7a4f8a" },
  { kind: "mountain", x: -150, z: -170, h: 44, color: "#6f4a7a" },
  { kind: "mountain", x: 190, z: -60, h: 36, color: "#6f4a7a" },
  { kind: "cactus", x: 70, z: 20, s: 1.6 },
  { kind: "cactus", x: -72, z: -40, s: 1.4, ry: 2 },
  { kind: "cactus", x: 20, z: 76, s: 1.5, ry: 0.7 },
  { kind: "cactus", x: -30, z: -80, s: 1.3 },
  { kind: "boulder", x: 68, z: -62, s: 2.4 },
  { kind: "boulder", x: -90, z: -70, s: 3, ry: 1.3 },
  { kind: "rock", x: -75, z: 66, s: 2.6, ry: 0.8 },
  { kind: "rock", x: 85, z: 70, s: 1.8, ry: 2.4 },
  { kind: "palm", x: 64, z: 64, s: 1.2 },
  { kind: "palm", x: -66, z: 12, s: 1.1, ry: 1.4 },
];

export const SUNSET_MESA: ArenaDef = {
  id: "sunset-mesa",
  name: "Sunset Mesa",
  tagline: "A desert plateau with four ramps up and two kickers across.",
  half: 52,
  theme: {
    skyTop: "#3b1d5e",
    skyHorizon: "#ff8c5a",
    skyBottom: "#ffd27a",
    fog: "#f3b58a",
    fogNear: 90,
    fogFar: 320,
    ground: "#e9c27a",
    groundLine: "#cf9f5c",
    outside: "same",
    wall: WALL,
    wallTop: TOP,
    wallStripe: "#fff1d6",
    rampColor: RAMP,
    sun: "#fff1d6",
    sunIntensity: 2.1,
    sunFrom: [60, 80, -40],
    hemiSky: "#ffd9b0",
    hemiGround: "#b7784a",
    hemiIntensity: 0.9,
    ambient: "#ffe3c4",
    ambientIntensity: 0.35,
    night: false,
    cloudColor: "#fff3e6",
    clouds: 14,
  },
  blocks,
  spawns: ring(8, 44),
  items: [
    { x: 0, z: 0 },
    { x: 7, z: 7 },
    { x: -7, z: 7 },
    { x: 7, z: -7 },
    { x: -7, z: -7 },
    { x: 40, z: 40 },
    { x: -40, z: 40 },
    { x: 40, z: -40 },
    { x: -40, z: -40 },
    { x: 0, z: 30 },
    { x: 0, z: -30 },
    { x: 24, z: 0 },
    { x: -24, z: 0 },
    { x: 36, z: 18 },
    { x: -36, z: -18 },
    { x: -36, z: 18 },
    { x: 36, z: -18 },
  ],
  waypoints: [
    ...ring(12, 32).map((s) => ({ x: s.x, z: s.z })),
    ...ring(8, 46).map((s) => ({ x: s.x, z: s.z })),
    { x: 0, z: 0 },
    { x: 0, z: 22 },
    { x: 0, z: -22 },
    { x: 22, z: 0 },
    { x: -22, z: 0 },
  ],
  props,
};
