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
const ROCK = "#b98b64";
const ROCK_TOP = "#d4a97e";
const KICK = "#2ec4b6";

const blocks: Block[] = [
  // The mesa in the middle, with a ramp up each side.
  { kind: "box", x: 0, z: 0, w: 28, h: 3, d: 28, color: WALL, top: TOP },
  { kind: "ramp", x: 0, z: 19, w: 10, d: 10, h0: 0, h1: 3, dir: "-z", color: RAMP },
  { kind: "ramp", x: 0, z: -19, w: 10, d: 10, h0: 0, h1: 3, dir: "+z", color: RAMP },
  { kind: "ramp", x: 19, z: 0, w: 10, d: 10, h0: 0, h1: 3, dir: "-x", color: RAMP },
  { kind: "ramp", x: -19, z: 0, w: 10, d: 10, h0: 0, h1: 3, dir: "+x", color: RAMP },
  // Corner lookouts, each reached by one ramp from inside the arena.
  { kind: "box", x: 56, z: 56, w: 14, h: 2.4, d: 14, color: WALL, top: TOP },
  { kind: "ramp", x: 56, z: 44, w: 7, d: 10, h0: 0, h1: 2.4, dir: "+z", color: RAMP },
  { kind: "box", x: -56, z: 56, w: 14, h: 2.4, d: 14, color: WALL, top: TOP },
  { kind: "ramp", x: -44, z: 56, w: 10, d: 7, h0: 0, h1: 2.4, dir: "-x", color: RAMP },
  { kind: "box", x: -56, z: -56, w: 14, h: 2.4, d: 14, color: WALL, top: TOP },
  { kind: "ramp", x: -56, z: -44, w: 7, d: 10, h0: 0, h1: 2.4, dir: "-z", color: RAMP },
  { kind: "box", x: 56, z: -56, w: 14, h: 2.4, d: 14, color: WALL, top: TOP },
  { kind: "ramp", x: 44, z: -56, w: 10, d: 7, h0: 0, h1: 2.4, dir: "+x", color: RAMP },
  // Bunkers at the middle of each wall, a ramp up from the inside.
  { kind: "box", x: 0, z: 62, w: 16, h: 2, d: 8, color: ROCK, top: ROCK_TOP },
  { kind: "ramp", x: 0, z: 54, w: 8, d: 8, h0: 0, h1: 2, dir: "+z", color: RAMP },
  { kind: "box", x: 0, z: -62, w: 16, h: 2, d: 8, color: ROCK, top: ROCK_TOP },
  { kind: "ramp", x: 0, z: -54, w: 8, d: 8, h0: 0, h1: 2, dir: "-z", color: RAMP },
  { kind: "box", x: 62, z: 0, w: 8, h: 2, d: 16, color: ROCK, top: ROCK_TOP },
  { kind: "ramp", x: 54, z: 0, w: 8, d: 8, h0: 0, h1: 2, dir: "+x", color: RAMP },
  { kind: "box", x: -62, z: 0, w: 8, h: 2, d: 16, color: ROCK, top: ROCK_TOP },
  { kind: "ramp", x: -54, z: 0, w: 8, d: 8, h0: 0, h1: 2, dir: "-x", color: RAMP },
  // Pillars to weave around.
  { kind: "box", x: 34, z: 34, w: 3, h: 6, d: 3, color: "#b24e2e" },
  { kind: "box", x: -34, z: 34, w: 3, h: 6, d: 3, color: "#b24e2e" },
  { kind: "box", x: 34, z: -34, w: 3, h: 6, d: 3, color: "#b24e2e" },
  { kind: "box", x: -34, z: -34, w: 3, h: 6, d: 3, color: "#b24e2e" },
  { kind: "box", x: 50, z: 14, w: 2.5, h: 5, d: 2.5, color: "#b24e2e" },
  { kind: "box", x: -50, z: -14, w: 2.5, h: 5, d: 2.5, color: "#b24e2e" },
  { kind: "box", x: 14, z: -50, w: 2.5, h: 5, d: 2.5, color: "#b24e2e" },
  { kind: "box", x: -14, z: 50, w: 2.5, h: 5, d: 2.5, color: "#b24e2e" },
  // Low rock walls across the mid lanes.
  { kind: "box", x: 0, z: 40, w: 14, h: 2, d: 2, color: ROCK, top: ROCK_TOP },
  { kind: "box", x: 0, z: -40, w: 14, h: 2, d: 2, color: ROCK, top: ROCK_TOP },
  { kind: "box", x: 40, z: 0, w: 2, h: 2, d: 14, color: ROCK, top: ROCK_TOP },
  { kind: "box", x: -40, z: 0, w: 2, h: 2, d: 14, color: ROCK, top: ROCK_TOP },
  // Kickers: launch toward the mesa.
  { kind: "ramp", x: -46, z: 0, w: 8, d: 7, h0: 0, h1: 2.6, dir: "+x", color: KICK },
  { kind: "ramp", x: 46, z: 0, w: 8, d: 7, h0: 0, h1: 2.6, dir: "-x", color: KICK },
  { kind: "ramp", x: 0, z: -46, w: 7, d: 8, h0: 0, h1: 2.6, dir: "+z", color: KICK },
  { kind: "ramp", x: 0, z: 46, w: 7, d: 8, h0: 0, h1: 2.6, dir: "-z", color: KICK },
  // Kickers at the side lanes, launching along the walls.
  { kind: "ramp", x: 22, z: 64, w: 6, d: 6, h0: 0, h1: 1.8, dir: "+x", color: KICK },
  { kind: "ramp", x: -22, z: -64, w: 6, d: 6, h0: 0, h1: 1.8, dir: "-x", color: KICK },
  { kind: "ramp", x: 64, z: -22, w: 6, d: 6, h0: 0, h1: 1.8, dir: "-z", color: KICK },
  { kind: "ramp", x: -64, z: 22, w: 6, d: 6, h0: 0, h1: 1.8, dir: "+z", color: KICK },
];

const props: Prop[] = [
  // Inside dressing.
  { kind: "flag", x: 11, z: 11, y: 3, color: KICK },
  { kind: "flag", x: -11, z: 11, y: 3, color: "#ff5d8f" },
  { kind: "flag", x: 11, z: -11, y: 3, color: "#ff5d8f" },
  { kind: "flag", x: -11, z: -11, y: 3, color: KICK },
  { kind: "flag", x: 56, z: 56, y: 2.4, color: "#ffd400" },
  { kind: "flag", x: -56, z: -56, y: 2.4, color: "#ffd400" },
  { kind: "rock", x: 64, z: 34, s: 1.1 },
  { kind: "rock", x: -64, z: -36, s: 0.9, ry: 1.2 },
  { kind: "rock", x: 36, z: -66, s: 0.8, ry: 2.2 },
  { kind: "rock", x: -30, z: 24, s: 0.6, ry: 0.4 },
  { kind: "rock", x: 28, z: -26, s: 0.55, ry: 1.7 },
  { kind: "cactus", x: 66, z: -36, s: 0.8 },
  { kind: "cactus", x: -66, z: 38, s: 0.75, ry: 1 },
  { kind: "cactus", x: 24, z: 30, s: 0.6, ry: 2.2 },
  { kind: "cactus", x: -26, z: -32, s: 0.65, ry: 0.9 },
  { kind: "tires", x: 34, z: 64 },
  { kind: "tires", x: -34, z: -64 },
  { kind: "tires", x: -64, z: 34 },
  { kind: "boulder", x: 66, z: -66, s: 0.8, ry: 0.6 },
  { kind: "boulder", x: -66, z: 66, s: 0.7, ry: 2.1 },
  { kind: "cactus", x: 16, z: 67, s: 0.7, ry: 0.4 },
  { kind: "cactus", x: -18, z: -67, s: 0.65, ry: 2.6 },
  { kind: "rock", x: 67, z: -44, s: 0.7 },
  { kind: "rock", x: -67, z: 46, s: 0.75, ry: 1.9 },
  { kind: "barrel", x: 66, z: 66, color: KICK },
  { kind: "barrel", x: -66, z: -66, color: "#ff5d8f" },
  { kind: "barrel", x: 62, z: -12, color: "#ffd400" },
  { kind: "barrel", x: -62, z: 12, color: "#ff5d8f" },
  // The desert beyond the walls.
  { kind: "mesa", x: 140, z: 50, h: 16, s: 1.2 },
  { kind: "mesa", x: 115, z: -150, h: 12, s: 1.0, ry: 0.5 },
  { kind: "mesa", x: -165, z: -40, h: 20, s: 1.4, ry: 0.3 },
  { kind: "mesa", x: -100, z: 165, h: 10, s: 0.9, ry: 1.1 },
  { kind: "mountain", x: 200, z: 200, h: 46, color: "#7a4f8a" },
  { kind: "mountain", x: -210, z: 150, h: 40, color: "#6f4a7a" },
  { kind: "mountain", x: 50, z: -240, h: 52, color: "#7a4f8a" },
  { kind: "mountain", x: -190, z: -210, h: 44, color: "#6f4a7a" },
  { kind: "mountain", x: 240, z: -80, h: 36, color: "#6f4a7a" },
  { kind: "cactus", x: 92, z: 26, s: 1.6 },
  { kind: "cactus", x: -94, z: -52, s: 1.4, ry: 2 },
  { kind: "cactus", x: 26, z: 98, s: 1.5, ry: 0.7 },
  { kind: "cactus", x: -40, z: -102, s: 1.3 },
  { kind: "boulder", x: 88, z: -80, s: 2.4 },
  { kind: "boulder", x: -116, z: -90, s: 3, ry: 1.3 },
  { kind: "rock", x: -98, z: 86, s: 2.6, ry: 0.8 },
  { kind: "rock", x: 110, z: 90, s: 1.8, ry: 2.4 },
  { kind: "palm", x: 84, z: 84, s: 1.2 },
  { kind: "palm", x: -86, z: 16, s: 1.1, ry: 1.4 },
];

export const SUNSET_MESA: ArenaDef = {
  id: "sunset-mesa",
  name: "Sunset Mesa",
  tagline: "A wide desert plateau: four ramps up, four bunkers at the walls, kickers everywhere.",
  half: 72,
  theme: {
    skyTop: "#3b1d5e",
    skyHorizon: "#ff8c5a",
    skyBottom: "#ffd27a",
    fog: "#f3b58a",
    fogNear: 110,
    fogFar: 380,
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
    clouds: 16,
  },
  blocks,
  spawns: ring(8, 60),
  items: [
    { x: 0, z: 0 },
    { x: 9, z: 9 },
    { x: -9, z: 9 },
    { x: 9, z: -9 },
    { x: -9, z: -9 },
    { x: 56, z: 56 },
    { x: -56, z: 56 },
    { x: 56, z: -56 },
    { x: -56, z: -56 },
    { x: 0, z: 62 },
    { x: 0, z: -62 },
    { x: 62, z: 0 },
    { x: -62, z: 0 },
    { x: 0, z: 34 },
    { x: 0, z: -34 },
    { x: 34, z: 0 },
    { x: -34, z: 0 },
    { x: 48, z: 26 },
    { x: -48, z: -26 },
    { x: -48, z: 26 },
    { x: 48, z: -26 },
    { x: 26, z: 48 },
    { x: -26, z: -48 },
    { x: -26, z: 48 },
    { x: 26, z: -48 },
  ],
  waypoints: [
    ...ring(12, 26).map((s) => ({ x: s.x, z: s.z })),
    ...ring(12, 46).map((s) => ({ x: s.x, z: s.z })),
    ...ring(8, 64).map((s) => ({ x: s.x, z: s.z })),
    { x: 0, z: 0 },
    { x: 0, z: 30 },
    { x: 0, z: -30 },
    { x: 30, z: 0 },
    { x: -30, z: 0 },
  ],
  props,
};
