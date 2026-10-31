import type { ArenaDef, Block, Spawn } from "../Arena";
import type { Prop } from "../Props";

const ring = (n: number, r: number): Spawn[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    return { x, z, yaw: Math.atan2(-x, -z) };
  });

const CYAN = "#00c8e0";
const MAGENTA = "#ff3df2";
const YELLOW = "#ffd400";
const BLUE = "#3d5aff";
const CONCRETE = "#3a4060";
const DECK = "#4a5280";
const RAMP = "#5560a8";

const blocks: Block[] = [
  // The loading dock in the middle, low and wide, two ramps.
  { kind: "box", x: 0, z: 0, w: 16, h: 1.6, d: 16, color: CONCRETE, top: DECK, strip: CYAN },
  { kind: "ramp", x: 0, z: 12, w: 7, d: 8, h0: 0, h1: 1.6, dir: "-z", color: RAMP },
  { kind: "ramp", x: 0, z: -12, w: 7, d: 8, h0: 0, h1: 1.6, dir: "+z", color: RAMP },
  // Four long containers, each with a ramp onto each end: rooftop lanes.
  { kind: "box", x: -30, z: 0, w: 4, h: 2.6, d: 14, color: CYAN, top: "#7fe6f2" },
  { kind: "ramp", x: -30, z: 11, w: 4, d: 8, h0: 0, h1: 2.6, dir: "-z", color: RAMP },
  { kind: "ramp", x: -30, z: -11, w: 4, d: 8, h0: 0, h1: 2.6, dir: "+z", color: RAMP },
  { kind: "box", x: 30, z: 0, w: 4, h: 2.6, d: 14, color: MAGENTA, top: "#ff9af7" },
  { kind: "ramp", x: 30, z: 11, w: 4, d: 8, h0: 0, h1: 2.6, dir: "-z", color: RAMP },
  { kind: "ramp", x: 30, z: -11, w: 4, d: 8, h0: 0, h1: 2.6, dir: "+z", color: RAMP },
  { kind: "box", x: 0, z: -30, w: 14, h: 2.6, d: 4, color: YELLOW, top: "#ffe97a" },
  { kind: "ramp", x: 11, z: -30, w: 8, d: 4, h0: 0, h1: 2.6, dir: "-x", color: RAMP },
  { kind: "ramp", x: -11, z: -30, w: 8, d: 4, h0: 0, h1: 2.6, dir: "+x", color: RAMP },
  { kind: "box", x: 0, z: 30, w: 14, h: 2.6, d: 4, color: BLUE, top: "#9aa8ff" },
  { kind: "ramp", x: 11, z: 30, w: 8, d: 4, h0: 0, h1: 2.6, dir: "-x", color: RAMP },
  { kind: "ramp", x: -11, z: 30, w: 8, d: 4, h0: 0, h1: 2.6, dir: "+x", color: RAMP },
  // Two-high stacks on the diagonals: solid cover.
  { kind: "box", x: 20, z: 20, w: 6, h: 2.6, d: 6, color: YELLOW },
  { kind: "box", x: 20, z: 20, w: 6, h: 2.6, d: 6, y: 2.6, color: MAGENTA, strip: MAGENTA },
  { kind: "box", x: -20, z: 20, w: 6, h: 2.6, d: 6, color: BLUE },
  { kind: "box", x: -20, z: 20, w: 6, h: 2.6, d: 6, y: 2.6, color: CYAN, strip: CYAN },
  { kind: "box", x: 20, z: -20, w: 6, h: 2.6, d: 6, color: CYAN },
  { kind: "box", x: 20, z: -20, w: 6, h: 2.6, d: 6, y: 2.6, color: YELLOW, strip: YELLOW },
  { kind: "box", x: -20, z: -20, w: 6, h: 2.6, d: 6, color: MAGENTA },
  { kind: "box", x: -20, z: -20, w: 6, h: 2.6, d: 6, y: 2.6, color: BLUE, strip: BLUE },
  // Corner kickers aimed into the open lanes.
  { kind: "ramp", x: -40, z: 32, w: 6, d: 6, h0: 0, h1: 2.2, dir: "-z", color: "#ff3df2" },
  { kind: "ramp", x: 40, z: -32, w: 6, d: 6, h0: 0, h1: 2.2, dir: "+z", color: "#ff3df2" },
  { kind: "ramp", x: 32, z: 40, w: 6, d: 6, h0: 0, h1: 2.2, dir: "-x", color: "#00c8e0" },
  { kind: "ramp", x: -32, z: -40, w: 6, d: 6, h0: 0, h1: 2.2, dir: "+x", color: "#00c8e0" },
  // Low barriers at the mid walls.
  { kind: "box", x: 44, z: 0, w: 2, h: 1.4, d: 10, color: CONCRETE, top: DECK },
  { kind: "box", x: -44, z: 0, w: 2, h: 1.4, d: 10, color: CONCRETE, top: DECK },
];

const props: Prop[] = [
  { kind: "lamp", x: 46, z: 46 },
  { kind: "lamp", x: -46, z: 46 },
  { kind: "lamp", x: 46, z: -46 },
  { kind: "lamp", x: -46, z: -46 },
  { kind: "lamp", x: 46, z: 14, color: "#b8f6ff" },
  { kind: "lamp", x: -46, z: -14, color: "#ffc6fb" },
  { kind: "barrel", x: 36, z: 44, color: BLUE },
  { kind: "barrel", x: 38, z: 46, color: YELLOW },
  { kind: "barrel", x: -36, z: -44, color: MAGENTA },
  { kind: "cone", x: 10, z: 40 },
  { kind: "cone", x: 13, z: 42 },
  { kind: "cone", x: -10, z: -40 },
  { kind: "tires", x: 46, z: -30 },
  { kind: "tires", x: -46, z: 30 },
  { kind: "crate", x: 44, z: 26, color: "#8a6a4b" },
  { kind: "crate", x: -44, z: -26, color: "#8a6a4b" },
  // Lane paint.
  { kind: "mark", x: 0, z: 22, w: 0.5, h: 6, color: YELLOW },
  { kind: "mark", x: 0, z: -22, w: 0.5, h: 6, color: YELLOW },
  { kind: "mark", x: 22, z: 0, w: 0.5, h: 6, color: YELLOW, ry: Math.PI / 2 },
  { kind: "mark", x: -22, z: 0, w: 0.5, h: 6, color: YELLOW, ry: Math.PI / 2 },
  { kind: "mark", x: 12, z: 40, w: 0.4, h: 10, color: "#f4f1ea", ry: Math.PI / 2 },
  { kind: "mark", x: -12, z: -40, w: 0.4, h: 10, color: "#f4f1ea", ry: Math.PI / 2 },
  { kind: "mark", x: 40, z: 12, w: 0.4, h: 10, color: "#f4f1ea" },
  { kind: "mark", x: -40, z: -12, w: 0.4, h: 10, color: "#f4f1ea" },
  { kind: "mark", x: 30, z: 30, w: 3, h: 3, color: "#394070", ry: Math.PI / 4 },
  { kind: "mark", x: -30, z: -30, w: 3, h: 3, color: "#394070", ry: Math.PI / 4 },
  { kind: "sign", x: 16, z: 47, color: CYAN },
  { kind: "sign", x: -16, z: -47, color: MAGENTA, ry: Math.PI },
  // The harbour beyond: cranes, buoys, a skyline.
  { kind: "crane", x: 75, z: -20, ry: -0.6 },
  { kind: "crane", x: -80, z: 30, ry: 2.4, color: "#ff8a1f" },
  { kind: "buoy", x: 70, z: 40, y: -0.4 },
  { kind: "buoy", x: -66, z: -52, y: -0.4, color: "#ffd400" },
  { kind: "buoy", x: 20, z: 78, y: -0.4, color: "#00c8e0" },
  { kind: "buoy", x: -30, z: 84, y: -0.4 },
  { kind: "building", x: 120, z: 120, h: 44, s: 1.6 },
  { kind: "building", x: 150, z: 60, h: 30, s: 1.2 },
  { kind: "building", x: 100, z: 160, h: 56, s: 1.3 },
  { kind: "building", x: -140, z: 110, h: 38, s: 1.5 },
  { kind: "building", x: -110, z: 150, h: 60, s: 1.1 },
  { kind: "building", x: -160, z: -70, h: 26, s: 1.4 },
  { kind: "building", x: 60, z: -170, h: 48, s: 1.5 },
  { kind: "building", x: -40, z: -180, h: 34, s: 1.2 },
  { kind: "building", x: 170, z: -120, h: 40, s: 1.3 },
];

export const NEON_HARBOR: ArenaDef = {
  id: "neon-harbor",
  name: "Neon Harbor",
  tagline: "A night dock of containers, rooftop lanes and corner kickers.",
  half: 50,
  theme: {
    skyTop: "#070a1e",
    skyHorizon: "#23327a",
    skyBottom: "#4a1f6a",
    fog: "#1a2250",
    fogNear: 120,
    fogFar: 360,
    ground: "#2b2f45",
    groundLine: "#4a5280",
    outside: { color: "#0e3570", light: "#3f9be6", y: -1.2 },
    wall: CONCRETE,
    wallTop: DECK,
    wallStripe: "#ffd400",
    rampColor: RAMP,
    sun: "#c7d4ff",
    sunIntensity: 1.3,
    sunFrom: [-50, 70, 40],
    hemiSky: "#5566c0",
    hemiGround: "#1a1430",
    hemiIntensity: 0.8,
    ambient: "#6c7bd6",
    ambientIntensity: 0.55,
    night: true,
    cloudColor: "#2b3570",
    clouds: 8,
  },
  blocks,
  spawns: ring(8, 42),
  items: [
    { x: 0, z: 0 },
    { x: -30, z: 0 },
    { x: 30, z: 0 },
    { x: 0, z: -30 },
    { x: 0, z: 30 },
    { x: 40, z: 40 },
    { x: -40, z: 40 },
    { x: 40, z: -40 },
    { x: -40, z: -40 },
    { x: 12, z: 12 },
    { x: -12, z: -12 },
    { x: 30, z: 20 },
    { x: -30, z: -20 },
    { x: 20, z: -34 },
    { x: -20, z: 34 },
  ],
  waypoints: [
    ...ring(12, 30).map((s) => ({ x: s.x, z: s.z })),
    ...ring(8, 44).map((s) => ({ x: s.x, z: s.z })),
    { x: 0, z: 0 },
    { x: 0, z: 20 },
    { x: 0, z: -20 },
    { x: 20, z: 0 },
    { x: -20, z: 0 },
  ],
  props,
};
