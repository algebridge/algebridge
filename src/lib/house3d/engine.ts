/**
 * The room you see on /house: one WebGL view, drawn only when something
 * changes (a drag, a colour, a switch, the camera), never on an idle loop.
 *
 * Light is what makes it read as real: the sun comes in through the side
 * window and casts soft shadows, the room's own bounce light comes from an
 * environment (RoomEnvironment), every piece sits on a soft contact shadow,
 * and at night the lamps that are switched on light the room themselves.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GardenState } from "@/lib/garden";
import { buildFront, buildGarden, FRONT_LAYOUT, GARDEN_LAYOUT, skyTexture, type StreetNeighbour } from "./garden";
import { Post } from "./post";
import { buildFigure, poseFigure, type Figure } from "./figure";
import { lotBlockers, slideMove, type Rect, type StreetLot } from "./walk";
import { avatarKey } from "@/lib/avatar";
import type { AvatarSpec } from "@/types";
import { makeKit, SWATCH_HEX, type Kit } from "./kit";
import { compileQuietly } from "./compile";
import { liveSlice, watchReads } from "./live";
import { modelFor, ornamentModelFor } from "./registry";
import { buildRoom, viewTexture, type RoomParts } from "./room";
import { BACK_WALL_Z, clearOfOpenings, floorToWorld, ROOM_D, ROOM_H, ROOM_W, wallToWorld, worldToFloor, worldToWall } from "./space";
import { themeFor, type WindowShape } from "./themes";
import { DEFAULT_LIVE, type ItemModel, type LiveData } from "./types";

export type Mount = "floor" | "wall" | "ceiling";

/** A part of the garden itself that was tapped. */
export type GardenPick = { kind: "bed"; unit: number } | { kind: "sprinkler" } | { kind: "tree" } | { kind: "house" } | { kind: "mailbox" } | { kind: "neighbour"; name: string; styleId: string };

/** Ornaments stand within this many metres of the yard's middle (lib/dollhouse.ts PAD_LIMIT). */
const YARD = 6.4;

/** Where the camera starts and how far it may turn: the room keeps its open side towards you; the yard is open all round but the house. */
const VIEWS = {
  room: { azimuth: 0.62, polar: 1.04, target: [0, 0.95, -0.15], azimuthRange: [0.12, 1.05], polarRange: [0.82, 1.25] },
  garden: { azimuth: 0.36, polar: 1.0, target: [0, 0.9, -1.2], azimuthRange: [-1.05, 1.05], polarRange: [0.62, 1.3] },
  // The porch view turns all the way round the house.
  front: { azimuth: 0.26, polar: 1.12, target: [0.4, 2.2, -6.0], azimuthRange: [-1000, 1000], polarRange: [0.62, 1.32] },
  // Walking: the camera follows the character a few steps behind, and may swing right round them.
  walk: { azimuth: Math.PI, polar: 1.2, target: [0, 1.25, 0], azimuthRange: [-1000, 1000], polarRange: [0.95, 1.5] },
} as const;

type Mode = keyof typeof VIEWS;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A placed piece as the view needs it: what it is, where it is stored, and how it looks. */
export interface ScenePiece {
  instanceId: string;
  itemId: string;
  /** Stored percentages (see space.ts). */
  x: number;
  y: number;
  /** Stored surface: the wall or the floor. */
  surface: "floor" | "wall";
  /** A swatch id, or null for the piece's own colour. */
  color: string | null;
  on: boolean;
  /** A garden ornament: x metres east and y metres north of the yard's middle. */
  ornament?: boolean;
  /** Which floor it is on, for the porch view's dollhouse (both floors at once). */
  floor?: "down" | "up";
  /** Turned round, in degrees (standing, ceiling and garden pieces). */
  turn?: number;
}

/** Where a piece really goes, from its model: hung pieces always on the wall, hanging ones from the ceiling. */
export function mountOf(model: ItemModel): Mount {
  return model.ceiling ? "ceiling" : model.wall ? "wall" : "floor";
}

interface SceneLight {
  pos: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  distance: number;
}

/** How many places to keep built. */
const KEEP_BUILT = 8;
/**
 * Pixels drawn per CSS pixel: at most this many for the frame at rest (a
 * Retina screen's full 2 is nearly twice the work for a difference that
 * takes a magnifier), and down to MIN_RATIO for a moving frame on a computer
 * that falls behind (see pacedRatio).
 */
const MAX_RATIO = 1.5;
const MIN_RATIO = 0.75;

/** How close (as a zoom) the porch view comes before the walls in the way open up. */
const DOLLHOUSE_ZOOM = 1.45;
/** How close the porch view may come. */
const ZOOM_MAX: Record<string, number> = { room: 1.9, garden: 1.9, front: 3.4 };
/** How far behind the character the camera walks, before zooming. */
const WALK_DISTANCE = 5.4;
/** Where the character stands on the porch, and where a walk starts (the gate). */
const PORCH_SPOT = { x: GARDEN_LAYOUT.doorX + 1.7, y: FRONT_LAYOUT.porch.top, z: GARDEN_LAYOUT.wallZ + 0.15 + 0.95 };
const GATE_SPOT = { x: GARDEN_LAYOUT.doorX, z: 5.75 };
/** How far out each view may go: the porch view backs off down the street to show the neighbours. */
const ZOOM_MIN: Record<string, number> = { room: 0.85, garden: 0.85, front: 0.55 };

/** A part of a wall that steps aside when the camera is on its side (normal points out of the house). */
interface Cutaway {
  obj: THREE.Object3D;
  normal: THREE.Vector3;
  /** The roof and the upper walls: out of the way whenever you look inside. */
  always?: boolean;
}

/** The inside of the house in the porch view: both rooms, built the first time you zoom in. */
interface Dollhouse {
  key: string;
  group: THREE.Group;
  floors: { down: THREE.Group; up: THREE.Group };
  rooms: RoomParts[];
  cut: Cutaway[];
}

/** A place kept built: the room, the garden or the porch, and for the last two the builder of their street. */
interface Built {
  group: THREE.Object3D;
  dispose(): void;
  lights: SceneLight[];
  room?: RoomParts;
  street?: (neighbours: StreetNeighbour[]) => (() => THREE.Object3D)[];
}

interface Placed {
  piece: ScenePiece;
  model: ItemModel;
  root: THREE.Group;
  shadow: THREE.Mesh | null;
  disposables: (THREE.Material | THREE.Texture)[];
  key: string;
  /** The live data the model read when it was built (the clock its minute, the shelf its count): only a change there rebuilds it. */
  reads: Set<string>;
}


const MAX_LAMPS = 4;

/** The soft dark patch under a piece, shared by all of them. */
function blobTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class HouseView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private kit: Kit;
  private room: RoomParts | null = null;
  /**
   * The last few places built (rooms, the garden, the porch), kept whole:
   * going back to one is instant, with nothing to rebuild or compile.
   */
  private built = new Map<string, Built>();
  /** Who lives on the street (other students on the board), for the porch and the garden. */
  private neighbours: StreetNeighbour[] = [];
  /** The garden or porch on show, for filling its street when the neighbours arrive. */
  private outdoors: Built | null = null;
  private roomKey = "";
  /** The room's window shape: hung pieces keep clear of the window and the door. */
  private windowShape: WindowShape = "square";
  private placed = new Map<string, Placed>();
  private live: LiveData = DEFAULT_LIVE;
  private night = false;
  private sun: THREE.DirectionalLight;
  private moon: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  /**
   * Every scene has exactly MAX_LAMPS point lights, the unused ones dark.
   * three.js compiles a material once per number of lights, so a fixed
   * number means day, night, a lamp switched on, the garden or the porch
   * never compile anything again.
   */
  private pool: THREE.PointLight[] = [];
  /** Lights the room, garden or porch asked for (a porch lantern, lit windows), taken out of their scene. */
  private sceneLights: SceneLight[] = [];
  /** Called when a new scene starts or finishes compiling, for a "getting ready" note. */
  onBusy: (busy: boolean) => void = () => undefined;
  private blob: THREE.Texture;
  private blobMat: THREE.MeshBasicMaterial;
  private selection: THREE.Box3Helper | null = null;
  private selectedId: string | null = null;
  private raycaster = new THREE.Raycaster();
  private frame = 0;
  private envTarget: THREE.WebGLRenderTarget;
  /** Camera: angles round the room and distance, eased towards their targets. */
  private orbit = { azimuth: 0.62, polar: 1.04, distance: 11, target: new THREE.Vector3(0, 0.95, -0.15) };
  private goal = { azimuth: 0.62, polar: 1.04, zoom: 1 };
  private fitDistance = 11;
  private disposed = false;
  private reduceMotion = false;
  /** Indoors or out in the garden. */
  private mode: Mode = "room";
  private garden: { group: THREE.Group; own: (THREE.Material | THREE.Texture)[]; dispose(): void } | null = null;
  private gardenKey = "";
  /** The porch view's open house: the shell's walls that open, and the rooms inside. */
  private shellCut: Cutaway[] = [];
  private dollhouse: Dollhouse | null = null;
  private dollhouseShown = false;
  private frontStyle = "cottage";
  /** The house style on show in any view, for building its other places ahead (see warmPlaces). */
  private styleId = "cottage";
  private pendingPieces: ScenePiece[] | null = null;
  /** The student's character, on the porch or out on the street (the porch view only). */
  private figure: Figure | null = null;
  private figureSpec: AvatarSpec | null = null;
  private figureShadow: THREE.Mesh | null = null;
  /** Walking: where the character is and faces, the stride, and what the keys or the stick are asking. */
  private walk = { on: false, x: 0, z: 0, heading: 0, phase: 0, input: { x: 0, y: 0 }, run: false, moving: false, last: 0 };
  /** Everything solid on the street, from the lots built so far. */
  private blockers: Rect[] = [];
  /** The finishing passes for a frame at rest (null until the first one, or where WebGL 2 is missing). */
  private post: Post | null = null;
  private postFailed = false;
  private size = { width: 2, height: 2 };
  /** Pixels per CSS pixel: for the frame at rest, for a moving frame, and what the canvas has now. */
  private ratioRest = 1;
  private ratioMove = 1;
  private ratioNow = 1;
  /** How the moving frames keep up: the last one's time, the running gap between them, and the counts that decide a step down or up. */
  private pace = { last: 0, ema: 0, slow: 0, fine: 0, changedAt: 0 };
  private lastStep = 0;
  private wasMoving = false;
  /** When the view was last turned by a drag: for that moment the camera follows the pointer exactly. */
  private turnAt = 0;
  /** Light from the sky itself for the outdoor views, by day and by night, made once each. */
  private skyEnvs = new Map<string, THREE.Texture>();
  /** New materials wait to be compiled off the main thread before they are drawn (see step). */
  private needsCompile = true;
  private compiling = false;
  private ownsRenderer = true;
  private drawnOnce: () => void = () => undefined;
  /** Resolves once the first frame is on the canvas. */
  readonly firstFrame: Promise<void>;

  /**
   * `renderer`: draw with one that already exists (the picture studio shares
   * one, so its shaders are compiled once for every picture).
   */
  constructor(canvas: HTMLCanvasElement, opts: { renderer?: THREE.WebGLRenderer } = {}) {
    this.firstFrame = new Promise((resolve) => (this.drawnOnce = resolve));
    this.ownsRenderer = !opts.renderer;
    this.renderer = opts.renderer ?? new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    // Asking whether each shader compiled stalls the page until the GPU is done
    // (seconds on a first visit): the browser compiles them in parallel instead.
    this.renderer.debug.checkShaderErrors = false;
    this.ratioRest = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
    this.ratioMove = this.ratioRest;
    this.ratioNow = this.ratioRest;
    this.renderer.setPixelRatio(this.ratioRest);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    // Plain PCF: a third of the soft kind's cost on every pixel, the edge softened by the radius below.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    this.kit = makeKit();

    // The room's bounce light: a neutral studio environment, the same for every piece.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    pmrem.dispose();

    this.hemi = new THREE.HemisphereLight("#e9eef6", "#b49a7c", 0.45);
    this.scene.add(this.hemi);

    // The sun, low and warm, through the side window.
    this.sun = new THREE.DirectionalLight("#fff0da", 2.6);
    this.sun.position.set(-7.5, 5.2, 1.4);
    this.sun.target.position.set(0.4, 0, -0.4);
    this.sun.castShadow = true;
    // A phone's screen is small enough that half the shadow texels read the same, for a quarter of the work.
    const phone = Math.min(window.innerWidth || 1024, window.innerHeight || 1024) < 700;
    this.sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -5;
    sc.right = 5;
    sc.top = 5;
    sc.bottom = -5;
    sc.near = 1;
    sc.far = 20;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun, this.sun.target);

    // Moonlight, faint and cool, for the night.
    this.moon = new THREE.DirectionalLight("#9fb3e0", 0);
    this.moon.position.set(-7, 6, 2);
    this.scene.add(this.moon);

    for (let i = 0; i < MAX_LAMPS; i += 1) {
      const l = new THREE.PointLight("#ffffff", 0, 4, 2);
      this.pool.push(l);
      this.scene.add(l);
    }

    this.blob = blobTexture();
    this.blobMat = new THREE.MeshBasicMaterial({ map: this.blob, transparent: true, depthWrite: false, toneMapped: false });
  }

  // --- Drawing ---------------------------------------------------------------

  /** Draws one frame soon. Everything that changes the picture calls this. */
  invalidate(): void {
    if (this.frame || this.disposed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.step();
    });
  }

  private step(): void {
    // New materials (a first visit, a piece just put in) compile in the
    // background first; the last frame stays on screen meanwhile.
    if (this.needsCompile) {
      if (this.compiling) return;
      this.compiling = true;
      this.placeCamera();
      // A note after a moment, in case this takes a while (a first visit on a slow computer).
      const note = window.setTimeout(() => this.onBusy(true), 400);
      const limit = new Promise((r) => window.setTimeout(r, 20000));
      Promise.race([compileQuietly(this.renderer, this.scene, this.camera), limit]).then(() => {
        window.clearTimeout(note);
        this.onBusy(false);
        this.compiling = false;
        this.needsCompile = false;
        this.invalidate();
      });
      return;
    }
    // Ease the camera; keep drawing only while it is still moving. The
    // easing runs on the clock (a slow frame covers more of the way, so a
    // move feels the same at any frame rate), and a drag in progress is
    // followed exactly, with nothing trailing behind the pointer.
    const now = performance.now();
    const dt = this.lastStep ? Math.min(0.05, (now - this.lastStep) / 1000) : 1 / 60;
    this.lastStep = now;
    const turning = now - this.turnAt < 150;
    const o = this.orbit;
    const k = this.reduceMotion ? 1 : 1 - Math.exp(-dt * 14);
    const kt = turning ? 1 : k;
    o.azimuth += (this.goal.azimuth - o.azimuth) * kt;
    o.polar += (this.goal.polar - o.polar) * kt;
    const want = (this.walk.on ? WALK_DISTANCE : this.fitDistance) / this.goal.zoom;
    o.distance += (want - o.distance) * k;
    let moving = turning || Math.abs(this.goal.azimuth - o.azimuth) > 0.0005 || Math.abs(this.goal.polar - o.polar) > 0.0005 || Math.abs(want - o.distance) > 0.002;
    if (this.walk.on) moving = this.stepWalk() || moving;
    this.placeCamera();
    this.clearNeighbours();
    if (this.mode === "front" && this.applyCutaway()) {
      // The inside was just built: its shaders compile first.
      this.invalidate();
      return;
    }
    // A moving frame is drawn plain, at the size the computer keeps up with; the frame at rest in full, with its finish.
    this.applyRatio(moving ? this.pacedRatio(now) : this.ratioRest);
    if (moving) this.renderer.render(this.scene, this.camera);
    else this.renderFine();
    this.drawnOnce();
    this.wasMoving = moving;
    if (moving) this.invalidate();
    else this.pace.last = 0;
  }

  /** Sets how many pixels the canvas has per CSS pixel, when that changes. */
  private applyRatio(ratio: number): void {
    if (ratio === this.ratioNow) return;
    this.ratioNow = ratio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(this.size.width, this.size.height, false);
  }

  /**
   * How many pixels a moving frame gets. The frames' own timing says
   * whether the computer keeps up: when they run late (over 20 ms apart on
   * average, six in a row, so frames are being dropped) the moving picture
   * drops a step in size, and after a long smooth stretch it steps back up.
   * The frame at rest is always drawn in full, so a slower computer sees the
   * same house, and only the swing of a drag is softer.
   */
  private pacedRatio(now: number): number {
    const p = this.pace;
    if (p.last) {
      const gap = now - p.last;
      p.ema = p.ema ? p.ema * 0.8 + gap * 0.2 : gap;
      if (p.ema > 20) {
        p.slow += 1;
        p.fine = 0;
      } else {
        p.fine += 1;
        if (p.ema < 17.5) p.slow = 0;
      }
      if (p.slow >= 6 && this.ratioMove > MIN_RATIO) {
        this.ratioMove = Math.max(MIN_RATIO, Math.round((this.ratioMove - 0.25) * 100) / 100);
        p.slow = 0;
        p.ema = 0;
        p.changedAt = now;
      } else if (p.fine >= 240 && this.ratioMove < this.ratioRest && now - p.changedAt > 4000) {
        this.ratioMove = Math.min(this.ratioRest, Math.round((this.ratioMove + 0.25) * 100) / 100);
        p.fine = 0;
        p.ema = 0;
        p.changedAt = now;
      }
    } else {
      p.ema = 0;
      p.slow = 0;
    }
    p.last = now;
    return this.ratioMove;
  }

  /** A frame at rest, with its finish (lib/house3d/post.ts); plain where that is unavailable. */
  private renderFine(): void {
    if (!this.post && !this.postFailed) {
      try {
        if (this.renderer.capabilities.isWebGL2) {
          this.post = new Post(this.renderer, this.scene, this.camera, this.size.width, this.size.height);
          // Its shaders compile in the background; the frame at rest is drawn again with the finish once they have.
          void this.post.warm().then(() => this.invalidate());
        } else this.postFailed = true;
      } catch {
        this.postFailed = true;
      }
    }
    if (!this.post?.ready) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.post.setMode(this.mode === "room", this.night);
    this.post.render();
  }

  private placeCamera(): void {
    const o = this.orbit;
    const sinP = Math.sin(o.polar);
    this.camera.position.set(o.target.x + o.distance * sinP * Math.sin(o.azimuth), o.target.y + o.distance * Math.cos(o.polar), o.target.z + o.distance * sinP * Math.cos(o.azimuth));
    this.camera.lookAt(o.target);
  }

  /** Fits the whole room (or the yard) into the view at its starting angle, for this canvas's shape. */
  resize(width: number, height: number): void {
    if (width < 2 || height < 2) return;
    this.size = { width, height };
    this.renderer.setSize(width, height, false);
    this.post?.setSize(width, height, this.ratioRest);
    this.camera.aspect = width / height;
    // A phone held upright sees the room from a little higher and further back.
    this.camera.fov = this.camera.aspect < 0.9 ? 40 : 30;
    this.camera.updateProjectionMatrix();
    this.fit(this.orbit.distance === 11);
  }

  private corners(): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const b =
      this.mode === "front"
        ? { x: [-5.6, 6.2], y: [0, 3.2], z: [FRONT_LAYOUT.house.z - FRONT_LAYOUT.house.d / 2, FRONT_LAYOUT.curbZ + 0.2] }
        : this.mode === "garden"
        ? { x: [-GARDEN_LAYOUT.half, GARDEN_LAYOUT.half], y: [0, 2.4], z: [GARDEN_LAYOUT.wallZ, GARDEN_LAYOUT.half] }
        : { x: [-ROOM_W / 2 - 0.15, ROOM_W / 2], y: [-0.2, ROOM_H], z: [-ROOM_D / 2 - 0.15, ROOM_D / 2] };
    for (const x of b.x) for (const y of b.y) for (const z of b.z) out.push(new THREE.Vector3(x, y, z));
    return out;
  }

  /** The distance that just fits everything at the starting angle; `snap` moves the camera there now. */
  private fit(snap: boolean): void {
    const corners = this.corners();
    const v = VIEWS[this.mode];
    const saved = { azimuth: this.orbit.azimuth, polar: this.orbit.polar, distance: this.orbit.distance };
    this.orbit.azimuth = v.azimuth;
    this.orbit.polar = v.polar;
    let lo = 3;
    let hi = 80;
    for (let i = 0; i < 26; i += 1) {
      const mid = (lo + hi) / 2;
      this.orbit.distance = mid;
      this.placeCamera();
      this.camera.updateMatrixWorld();
      const fits = corners.every((c) => {
        const p = c.clone().project(this.camera);
        return Math.abs(p.x) <= 0.94 && Math.abs(p.y) <= 0.9;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    this.fitDistance = hi;
    this.orbit.azimuth = saved.azimuth;
    this.orbit.polar = saved.polar;
    this.orbit.distance = snap ? hi / this.goal.zoom : saved.distance;
    // Outdoors the sky is a dome 120 m round.
    this.camera.far = this.mode !== "room" ? 620 : 80;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  /** Goes indoors or out: what was on show is cleared and the camera starts afresh. */
  private enter(mode: Mode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    for (const p of [...this.placed.values()]) this.removePlaced(p);
    this.selectedId = null;
    this.refreshSelection();
    // The last place leaves the stage (it stays built); setRoom or show* puts the next one on.
    if (this.room) {
      this.scene.remove(this.room.group);
      this.room = null;
    }
    this.roomKey = "";
    this.dropGarden();
    this.stopWalk();
    this.removeFigure();
    this.shellCut = [];
    this.dollhouse = null;
    this.dollhouseShown = false;
    this.pendingPieces = null;
    const v = VIEWS[mode];
    this.goal = { azimuth: v.azimuth, polar: v.polar, zoom: 1 };
    this.orbit.azimuth = v.azimuth;
    this.orbit.polar = v.polar;
    this.orbit.target.set(v.target[0], v.target[1], v.target[2]);
    this.placeSun();
    this.fit(true);
  }

  /** The sun: low through the side window indoors, high over the yard outside. */
  private placeSun(): void {
    const sc = this.sun.shadow.camera;
    if (this.mode !== "room") {
      // An afternoon sun from the south-west, over the house's shoulder.
      this.sun.position.set(-11, 14, 9);
      this.sun.target.position.set(0, 0, -1.5);
      this.moon.position.set(-11, 9, 9);
      sc.left = -15;
      sc.right = 15;
      sc.top = 15;
      sc.bottom = -15;
      sc.far = 60;
    } else {
      this.sun.position.set(-7.5, 5.2, 1.4);
      this.sun.target.position.set(0.4, 0, -0.4);
      this.moon.position.set(-7, 6, 2);
      sc.left = -5;
      sc.right = 5;
      sc.top = 5;
      sc.bottom = -5;
      sc.far = 20;
    }
    sc.updateProjectionMatrix();
  }

  // --- The room ---------------------------------------------------------------

  setRoom(styleId: string, floor: "down" | "up", night: boolean): void {
    this.enter("room");
    this.styleId = styleId;
    const key = `${styleId}:${floor}:${night}`;
    this.setNightLight(night);
    if (key === this.roomKey) return;
    this.roomKey = key;
    if (this.room) this.scene.remove(this.room.group);
    const b = this.keep(`room:${key}`, () => this.makeRoom(styleId, floor, night));
    this.room = b.room!;
    this.sceneLights = b.lights;
    this.updateLamps();
    this.scene.add(this.room.group);
    // Another house has other windows: hung pieces find their wall again.
    this.windowShape = themeFor(styleId).window;
    for (const p of this.placed.values()) this.position(p);
    this.refreshSelection();
    this.invalidate();
  }

  private setNightLight(night: boolean): void {
    this.night = night;
    const out = this.mode !== "room";
    this.sun.intensity = night ? 0 : out ? 3.4 : 2.6;
    this.moon.intensity = night ? (out ? 0.55 : 0.35) : 0;
    this.hemi.intensity = night ? (out ? 0.14 : 0.05) : out ? 0.75 : 0.45;
    this.hemi.color.set(night ? "#5b6c9a" : out ? "#dfeaf7" : "#e9eef6");
    this.hemi.groundColor.set(out ? "#6f7d4c" : "#b49a7c");
    // Outdoors the light comes from the sky itself; indoors from a studio's soft bounce.
    this.scene.environment = out ? this.skyEnv(night) : this.envTarget.texture;
    this.scene.environmentIntensity = night ? (out ? 0.3 : 0.1) : out ? 1.0 : 0.6;
    this.hemi.intensity = night ? (out ? 0.1 : 0.05) : out ? 0.5 : 0.45;
    // Outdoors the far hills fade into the sky's own colour at the horizon; indoors there is nothing far away.
    this.scene.fog = out ? new THREE.Fog(night ? "#222f4b" : "#dbe5ec", 80, 330) : null;
    for (const v of this.room?.views ?? []) {
      const m = v.material as THREE.MeshBasicMaterial;
      m.map = viewTexture(themeFor(this.roomKey.split(":")[0]).view, night);
      m.color.set(night ? "#9aa3b8" : "#ffffff");
      m.needsUpdate = true;
    }
    this.updateLamps();
    this.invalidate();
  }

  /** The painted sky as the light round everything outdoors: blue from above, the ground's green from below. */
  private skyEnv(night: boolean): THREE.Texture {
    const key = night ? "night" : "day";
    const had = this.skyEnvs.get(key);
    if (had) return had;
    const sky = new THREE.Scene();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(night), side: THREE.BackSide }));
    dome.rotation.y = -0.35;
    sky.add(dome);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), new THREE.MeshBasicMaterial({ color: night ? "#0b100c" : "#55703e" }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    sky.add(ground);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(sky, 0.03, 0.1, 50).texture;
    pmrem.dispose();
    dome.geometry.dispose();
    (dome.material as THREE.Material).dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    this.skyEnvs.set(key, env);
    return env;
  }

  // --- The garden ---------------------------------------------------------------

  /** The backyard: the beds, the tree and the sprinkler as the student's progress has grown them, and the ornaments put out. */
  showGarden(state: GardenState, styleId: string, night: boolean, ornaments: { instanceId: string; itemId: string; x: number; z: number; on?: boolean; turn?: number }[]): void {
    this.enter("garden");
    this.styleId = styleId;
    const key = `${styleId}:${night}:${JSON.stringify(state)}`;
    if (key !== this.gardenKey) {
      this.dropGarden();
      this.gardenKey = key;
      // The garden keeps its own pictures and frees them itself.
      this.showOutdoors(`garden:${key}`, () => buildGarden(this.kit, state, { night, styleId }));
    }
    this.setNightLight(night);
    this.setPieces(ornaments.map((o) => ({ instanceId: o.instanceId, itemId: o.itemId, x: o.x, y: o.z, surface: "floor" as const, color: null, on: o.on ?? true, ornament: true, turn: o.turn })));
  }

  /** The front of the house from the street: the porch, and the mailbox with its flag up while messages are unread. */
  showFront(styleId: string, night: boolean, unread: number): void {
    this.enter("front");
    this.styleId = styleId;
    const key = `front:${styleId}:${night}:${unread > 0}`;
    if (key !== this.gardenKey) {
      this.dropGarden();
      this.gardenKey = key;
      this.showOutdoors(key, () => buildFront(this.kit, { night, styleId, unread }));
      this.frontStyle = styleId;
      this.shellCut = this.findShell(this.garden!.group);
      this.dollhouse = null;
      this.dollhouseShown = false;
      // A dollhouse already built for this house comes back with it.
      const kept = this.garden!.group.children.find((c) => c.userData.dollhouseKey === `${styleId}:${night}`);
      if (kept) {
        kept.visible = false;
        this.dollhouse = kept.userData.dollhouse as Dollhouse;
      }
    }
    this.setNightLight(night);
    if (this.figureSpec && !this.figure) this.setAvatar(this.figureSpec);
    this.invalidate();
  }

  /** The house shell's parts, each with the side it faces, so the ones in the way can step aside. */
  private findShell(group: THREE.Object3D): Cutaway[] {
    let shell: THREE.Object3D | null = null;
    group.traverse((o) => {
      if (!shell && o.userData.shell) shell = o;
    });
    if (!shell) return [];
    const H = FRONT_LAYOUT.house;
    const out: Cutaway[] = [];
    // The porch's roof and ceiling.
    group.traverse((o) => {
      if (o.userData.porchTop) out.push({ obj: o, normal: new THREE.Vector3(0, 1, 0), always: true });
    });
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    (shell as THREE.Object3D).updateMatrixWorld(true);
    for (const o of (shell as THREE.Object3D).children) {
      // A part that says which way it faces (a corner tower).
      if (Array.isArray(o.userData.cutNormal)) {
        out.push({ obj: o, normal: new THREE.Vector3(...(o.userData.cutNormal as [number, number, number])) });
        continue;
      }
      box.setFromObject(o);
      if (box.isEmpty() || box.max.y < 0.45) continue;
      box.getCenter(c);
      const front = H.z + H.d / 2;
      const back = H.z - H.d / 2;
      if (c.y > H.eave - 0.35) out.push({ obj: o, normal: new THREE.Vector3(0, 1, 0), always: true });
      else if (c.z > front - 0.7) out.push({ obj: o, normal: new THREE.Vector3(0, 0, 1) });
      else if (c.z < back + 0.7) out.push({ obj: o, normal: new THREE.Vector3(0, 0, -1) });
      else if (c.x > H.x + H.w / 2 - 0.7) out.push({ obj: o, normal: new THREE.Vector3(1, 0, 0) });
      else if (c.x < H.x - H.w / 2 + 0.7) out.push({ obj: o, normal: new THREE.Vector3(-1, 0, 0) });
    }
    return out;
  }

  /** Builds the two rooms inside the house, furnished, and which of their walls open. */
  private buildDollhouse(night: boolean): Dollhouse {
    const I = FRONT_LAYOUT.inside;
    const group = new THREE.Group();
    const floors = { down: new THREE.Group(), up: new THREE.Group() };
    const rooms: RoomParts[] = [];
    const cut: Cutaway[] = [];
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    for (const floor of ["down", "up"] as const) {
      const r = buildRoom(this.kit, themeFor(this.frontStyle), floor, night);
      this.takeLights(r.group);
      // Its walls, by the side they face, before it is moved into place.
      r.group.updateMatrixWorld(true);
      for (const o of r.group.children) {
        box.setFromObject(o);
        if (box.isEmpty()) continue;
        box.getCenter(c);
        if (c.z < -ROOM_D / 2 + 0.35 && box.max.y > 0.3) cut.push({ obj: o, normal: new THREE.Vector3(0, 0, -1) });
        else if (c.x < -ROOM_W / 2 + 0.35 && box.max.y > 0.3) cut.push({ obj: o, normal: new THREE.Vector3(-1, 0, 0) });
      }
      const f = floors[floor];
      f.add(r.group);
      f.position.set(I.x, floor === "down" ? I.down : I.up, I.z);
      group.add(f);
      rooms.push(r);
    }
    group.visible = false;
    return { key: `${this.frontStyle}:${night}`, group, floors, rooms, cut };
  }

  /** The furnished rooms inside the porch view's house: built hidden, hung on the porch scene, and freed with it. */
  private attachDollhouse(): Dollhouse | null {
    if (this.dollhouse || !this.garden || this.mode !== "front") return this.dollhouse;
    const d = this.buildDollhouse(this.night);
    d.group.userData.dollhouseKey = d.key;
    d.group.userData.dollhouse = d;
    this.garden.group.add(d.group);
    this.dollhouse = d;
    // Free the rooms with the porch scene when it goes.
    const entry = this.built.get(this.gardenKey);
    if (entry) {
      const before = entry.dispose;
      const rooms = d.rooms;
      entry.dispose = () => {
        before();
        for (const r of rooms) r.dispose();
      };
    }
    if (this.pendingPieces) this.setPieces(this.pendingPieces);
    return d;
  }

  /**
   * The porch view, zoomed in: the roof and the walls between you and the
   * inside step aside and the furnished rooms show, like an open dollhouse.
   * Returns true when the inside was built just now (it compiles first).
   */
  private applyCutaway(): boolean {
    const inside = !this.walk.on && this.orbit.distance < this.fitDistance / DOLLHOUSE_ZOOM;
    let built = false;
    if (inside && !this.dollhouse && this.garden) {
      this.attachDollhouse();
      this.needsCompile = true;
      built = true;
    }
    if (inside !== this.dollhouseShown) {
      this.dollhouseShown = inside;
      // Going in, the view comes down a little, to see both floors like an open dollhouse.
      if (inside) this.goal.polar = Math.max(this.goal.polar, 1.24);
      if (this.dollhouse) this.dollhouse.group.visible = inside;
      for (const p of this.placed.values()) p.root.visible = inside;
      this.updateLamps();
    }
    // Which walls face the camera.
    const H = FRONT_LAYOUT.house;
    const eye = this.camera.position.clone().sub(new THREE.Vector3(H.x, 2, H.z)).normalize();
    for (const part of this.shellCut) part.obj.visible = !inside || (!part.always && part.normal.dot(eye) < 0.2);
    if (this.dollhouse) for (const part of this.dollhouse.cut) part.obj.visible = !inside || part.normal.dot(eye) < 0.2;
    return built;
  }

  /** Who lives on the street; the lots are rebuilt when that changes. */
  setNeighbours(neighbours: StreetNeighbour[]): void {
    this.neighbours = neighbours;
    if (this.outdoors && this.garden) this.fillStreet(this.outdoors);
  }

  /** Builds the street of a garden or porch for the neighbours known now, unless it already shows them. */
  private fillStreet(b: Built): void {
    if (!b.street) return;
    const key = JSON.stringify(this.neighbours);
    const group = b.group;
    if (group.userData.streetKey === key) return;
    group.userData.streetKey = key;
    for (const lot of group.children.filter((o) => o.userData.lot)) {
      group.remove(lot);
      lot.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    delete group.userData.neighbours;
    this.refreshBlockers();
    this.buildLater(group, b.street(this.neighbours), key);
  }

  /**
   * The neighbours, one lot at a time once the page is idle and the view
   * stands still: the porch or the garden is on screen first, then the
   * street fills in, and no frame waits on it. After the last lot, the
   * places a click would build next are built ahead (warmPlaces).
   */
  private buildLater(group: THREE.Object3D, jobs: (() => THREE.Object3D)[], key: string): void {
    const alive = () => group.userData.streetKey === key;
    this.idleRun(
      [
        ...jobs.map((job) => async () => {
          // Built and merged in a few milliseconds; its shaders compile against this scene before it joins, so no frame waits on it.
          const lot = job();
          await compileQuietly(this.renderer, lot, this.camera, this.scene);
          if (this.disposed || !alive()) return;
          group.add(lot);
          delete group.userData.neighbours;
          this.refreshBlockers();
          this.invalidate();
        }),
        () => this.warmPlaces(),
      ],
      alive,
    );
  }

  /**
   * Runs jobs one at a time in idle moments while the view stands still
   * (a drag or a walk keeps its frames; after 2.5 s of either, the next job
   * runs anyway), after the first frame and never while a compile is on.
   */
  private idleRun(jobs: (() => Promise<void> | void)[], alive: () => boolean = () => true): void {
    const queue = [...jobs];
    const idle = (fn: () => void) => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(fn, { timeout: 1500 }) : window.setTimeout(fn, 60));
    let held = 0;
    const next = () => {
      if (this.disposed || !queue.length || !alive()) return;
      if (this.compiling || this.needsCompile || (this.wasMoving && held < 2500)) {
        held += 120;
        window.setTimeout(() => idle(next), 120);
        return;
      }
      held = 0;
      void Promise.resolve(queue.shift()!()).then(() => idle(next));
    };
    this.firstFrame.then(() => idle(next));
  }

  /**
   * What the next click would build, built ahead while the page is idle:
   * the inside of the house (for the zoom in) and both floors of this
   * style (for their tabs), each compiled against the scene it will show
   * in. The first click on each is then as quick as the second.
   */
  private warmPlaces(): void {
    const styleId = this.styleId;
    const night = this.night;
    this.idleRun([() => this.warmDollhouse(), () => this.warmRoom(styleId, "down", night), () => this.warmRoom(styleId, "up", night)]);
  }

  private async warmDollhouse(): Promise<void> {
    if (this.mode !== "front" || this.dollhouse || !this.garden) return;
    const d = this.attachDollhouse();
    if (d) await compileQuietly(this.renderer, d.group, this.camera, this.scene);
  }

  private async warmRoom(styleId: string, floor: "down" | "up", night: boolean): Promise<void> {
    const key = `room:${styleId}:${floor}:${night}`;
    if (this.built.has(key)) return;
    const b = this.keepQuiet(key, () => this.makeRoom(styleId, floor, night));
    // Compiled as a room is lit: no fog, the room's own bounce light (the compile reads the scene before the first await).
    const fog = this.scene.fog;
    const env = this.scene.environment;
    this.scene.fog = null;
    this.scene.environment = this.envTarget.texture;
    const done = compileQuietly(this.renderer, b.group, this.camera, this.scene);
    this.scene.fog = fog;
    this.scene.environment = env;
    await done;
  }

  // --- The character and the street -------------------------------------------

  /** The student's character, built for this spec and stood on the porch (the porch view only; null takes them away). */
  setAvatar(spec: AvatarSpec | null): void {
    const same = !!spec && !!this.figureSpec && avatarKey(spec) === avatarKey(this.figureSpec);
    this.figureSpec = spec;
    if (this.mode !== "front") return;
    if (same && this.figure) return;
    this.removeFigure();
    if (!spec) return;
    const fig = buildFigure(this.kit, spec);
    this.figure = fig;
    this.scene.add(fig.root);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), this.blobMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 1;
    this.figureShadow = shadow;
    this.scene.add(shadow);
    if (this.walk.on) this.placeFigure(this.walk.x, 0, this.walk.z, this.walk.heading);
    else this.placeFigure(PORCH_SPOT.x, PORCH_SPOT.y, PORCH_SPOT.z, 0.2);
    this.needsCompile = true;
    this.invalidate();
  }

  private placeFigure(x: number, y: number, z: number, heading: number): void {
    if (!this.figure) return;
    this.figure.root.position.set(x, y, z);
    this.figure.root.rotation.y = heading;
    this.figureShadow?.position.set(x, y + 0.004, z);
  }

  private removeFigure(): void {
    if (this.figure) this.scene.remove(this.figure.root);
    if (this.figureShadow) {
      this.scene.remove(this.figureShadow);
      this.figureShadow.geometry.dispose();
    }
    this.figure = null;
    this.figureShadow = null;
  }

  get walking(): boolean {
    return this.walk.on;
  }

  /** Steps off the porch to the gate and walks the street: the camera falls in behind. False without a character or away from the porch view. */
  startWalk(): boolean {
    if (this.mode !== "front" || !this.figure) return false;
    this.walk.on = true;
    this.walk.x = GATE_SPOT.x;
    this.walk.z = GATE_SPOT.z;
    this.walk.heading = Math.PI / 2;
    this.walk.phase = 0;
    this.walk.input = { x: 0, y: 0 };
    this.walk.moving = false;
    this.walk.last = performance.now();
    this.placeFigure(this.walk.x, 0, this.walk.z, this.walk.heading);
    poseFigure(this.figure, "stand");
    const v = VIEWS.walk;
    this.goal = { azimuth: this.walk.heading + Math.PI, polar: v.polar, zoom: 1 };
    this.orbit.azimuth = this.goal.azimuth;
    this.orbit.polar = v.polar;
    this.orbit.target.set(this.walk.x, 1.25, this.walk.z);
    this.orbit.distance = WALK_DISTANCE;
    // The street opens out: the whole house shows again.
    for (const part of this.shellCut) part.obj.visible = true;
    if (this.dollhouse) this.dollhouse.group.visible = false;
    this.dollhouseShown = false;
    for (const p of this.placed.values()) p.root.visible = false;
    this.updateLamps();
    this.invalidate();
    return true;
  }

  /** Back to the porch, and the usual view of the house. */
  stopWalk(): void {
    if (!this.walk.on) return;
    this.walk.on = false;
    this.walk.input = { x: 0, y: 0 };
    if (this.figure) {
      poseFigure(this.figure, "stand");
      this.placeFigure(PORCH_SPOT.x, PORCH_SPOT.y, PORCH_SPOT.z, 0.2);
    }
    const v = VIEWS[this.mode];
    this.goal = { azimuth: v.azimuth, polar: v.polar, zoom: 1 };
    this.orbit.target.set(v.target[0], v.target[1], v.target[2]);
    this.placeSun();
    this.invalidate();
  }

  /** What the keys or the stick ask for: x to the right, y forward, each -1 to 1, relative to the camera. */
  setWalkInput(x: number, y: number, run = false): void {
    if (!this.walk.on) return;
    this.walk.input = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
    this.walk.run = run;
    this.walk.last = performance.now();
    this.invalidate();
  }

  /** One frame of walking: the character moves, the camera follows. True while there is more to draw. */
  private stepWalk(): boolean {
    const fig = this.figure;
    if (!fig) return false;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.walk.last) / 1000));
    this.walk.last = now;
    const inp = this.walk.input;
    const mag = Math.hypot(inp.x, inp.y);
    let moved = 0;
    if (mag > 0.05) {
      // Forward is away from the camera along the ground; right is to its right.
      const az = this.orbit.azimuth;
      const fx = -Math.sin(az);
      const fz = -Math.cos(az);
      const rx = Math.cos(az);
      const rz = -Math.sin(az);
      let mx = fx * inp.y + rx * inp.x;
      let mz = fz * inp.y + rz * inp.x;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      const speed = (this.walk.run ? 4.4 : 2.4) * Math.min(1, mag);
      const to = slideMove({ x: this.walk.x, z: this.walk.z }, mx * speed * dt, mz * speed * dt, this.blockers, 0.32);
      moved = Math.hypot(to.x - this.walk.x, to.z - this.walk.z);
      this.walk.x = to.x;
      this.walk.z = to.z;
      // Turn towards the way they are going, the short way round.
      const want = Math.atan2(mx, mz);
      let d = want - this.walk.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.walk.heading += d * Math.min(1, dt * 14);
      this.walk.phase = (this.walk.phase + moved / 1.45) % 1;
      poseFigure(fig, "walk", this.walk.phase);
      this.walk.moving = true;
    } else if (this.walk.moving) {
      this.walk.moving = false;
      poseFigure(fig, "stand");
    }
    this.placeFigure(this.walk.x, 0, this.walk.z, this.walk.heading);
    // The sun's shadows come along, so the street round them is lit like the house was.
    if (moved > 0) {
      this.sun.position.set(this.walk.x - 11, 14, this.walk.z + 9);
      this.sun.target.position.set(this.walk.x, 0, this.walk.z - 1.5);
      this.moon.position.set(this.walk.x - 11, 9, this.walk.z + 9);
    }
    // The camera's eye on them, a step behind their pace.
    const t = this.orbit.target;
    const ease = 1 - Math.exp(-dt * 9);
    t.x += (this.walk.x - t.x) * ease;
    t.z += (this.walk.z - t.z) * ease;
    t.y += (1.25 - t.y) * ease;
    return mag > 0.05 || Math.hypot(this.walk.x - t.x, this.walk.z - t.z) > 0.01;
  }

  /** Everything solid on the street now: your house, and every lot with a house on it. */
  private refreshBlockers(): void {
    const lots: StreetLot[] = [{ x: 0, across: false, house: true, drive: 1, own: true }];
    this.garden?.group.traverse((o) => {
      const lot = o.userData.lot as StreetLot | undefined;
      if (lot) lots.push(lot);
    });
    this.blockers = lots.flatMap(lotBlockers);
  }

  /**
   * A neighbour's house standing between the camera and yours (or round the
   * camera itself, when it swings out over their lawn) steps out of the way,
   * like a wall in a game: you always see your own house.
   */
  private clearNeighbours(): void {
    if (!this.garden) return;
    const list = (this.garden.group.userData.neighbours ??= (() => {
      const found: THREE.Object3D[] = [];
      this.garden!.group.traverse((o) => {
        if (o.userData.neighbour) found.push(o);
      });
      return found;
    })()) as THREE.Object3D[];
    const cx = this.camera.position.x;
    const cz = this.camera.position.z;
    const tx = this.orbit.target.x;
    const tz = this.orbit.target.z;
    const dx = tx - cx;
    const dz = tz - cz;
    const len2 = dx * dx + dz * dz || 1;
    for (const o of list) {
      const n = o.userData.neighbour as { x: number; z: number; r: number };
      // The nearest point to the house's middle on the line from the camera to what it looks at.
      const t = Math.max(0, Math.min(1, ((n.x - cx) * dx + (n.z - cz) * dz) / len2));
      const near = Math.hypot(cx + dx * t - n.x, cz + dz * t - n.z);
      o.visible = near > n.r;
    }
  }

  private showOutdoors(key: string, make: () => { group: THREE.Group; dispose(): void; street?: (neighbours: StreetNeighbour[]) => (() => THREE.Object3D)[] }): void {
    const b = this.keep(key, () => {
      const made = make();
      return { group: made.group, dispose: made.dispose, lights: this.takeLights(made.group), street: made.street };
    });
    this.outdoors = b;
    this.fillStreet(b);
    this.garden = { group: b.group as THREE.Group, own: [], dispose: () => undefined };
    this.sceneLights = b.lights;
    this.updateLamps();
    this.scene.add(b.group);
  }

  /** The garden or porch leaves the stage; it stays built (see built). */
  private dropGarden(): void {
    if (!this.garden) return;
    this.scene.remove(this.garden.group);
    this.garden = null;
    this.gardenKey = "";
    this.sceneLights = [];
  }

  /** A room, built and its lights taken out for the pool. */
  private makeRoom(styleId: string, floor: "down" | "up", night: boolean): Built {
    const r = buildRoom(this.kit, themeFor(styleId), floor, night);
    return { group: r.group, dispose: () => r.dispose(), lights: this.takeLights(r.group), room: r };
  }

  /** A place from the built ones, or built now (and then it has shaders to compile, unless it was built ahead: see warmPlaces). */
  private keep(key: string, make: () => Built): Built {
    const had = this.built.has(key);
    const b = this.keepQuiet(key, make);
    if (!had) this.needsCompile = true;
    return b;
  }

  /** A place from the built ones, or built now, with no compile asked for. */
  private keepQuiet(key: string, make: () => Built): Built {
    let b = this.built.get(key);
    if (b) {
      this.built.delete(key);
      this.built.set(key, b);
      return b;
    }
    b = make();
    this.built.set(key, b);
    // The oldest go, never the one being shown.
    for (const [k, old] of this.built) {
      if (this.built.size <= KEEP_BUILT) break;
      if (old === b) continue;
      old.dispose();
      this.built.delete(k);
    }
    return b;
  }

  /** Where an ornament stands now, in metres east and north, for saving after a drag. */
  gardenSpotOf(instanceId: string): { x: number; z: number } | null {
    const p = this.placed.get(instanceId);
    if (!p?.piece.ornament) return null;
    return { x: clamp(p.piece.x, -YARD, YARD), z: clamp(p.piece.y, -YARD, YARD) };
  }

  /** The bed, the sprinkler or the tree under a point, if a tap landed on one. */
  pickGarden(clientX: number, clientY: number): GardenPick | null {
    if (!this.garden) return null;
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    // Only what is shown: a neighbour stepped out of the way is no target.
    const shown = (o: THREE.Object3D | null): boolean => {
      for (let p = o; p; p = p.parent) if (!p.visible) return false;
      return true;
    };
    const hit = this.raycaster.intersectObject(this.garden.group, true).find((h) => shown(h.object));
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o !== this.garden.group) {
      if (typeof o.userData.gardenUnit === "number") return { kind: "bed", unit: o.userData.gardenUnit };
      if (o.userData.gardenPart === "sprinkler") return { kind: "sprinkler" };
      if (o.userData.gardenPart === "tree") return { kind: "tree" };
      if (o.userData.gardenPart === "house") return { kind: "house" };
      if (o.userData.gardenPart === "mailbox") return { kind: "mailbox" };
      if (o.userData.gardenPart === "neighbour") return { kind: "neighbour", name: o.userData.who.name, styleId: o.userData.who.styleId };
      o = o.parent;
    }
    return null;
  }

  // --- Pieces -----------------------------------------------------------------

  setLive(live: LiveData): void {
    this.live = live;
    // Pieces that show something are rebuilt on their next setPieces (their key carries the data).
  }

  /** Shows these pieces (the ones on this floor), rebuilding only what changed. */
  setPieces(pieces: ScenePiece[]): void {
    // In the porch view the pieces live in the dollhouse, which is built the first time you zoom in.
    if (this.mode === "front") {
      this.pendingPieces = pieces;
      if (!this.dollhouse) return;
    }
    const seen = new Set<string>();
    for (const piece of pieces) {
      seen.add(piece.instanceId);
      const base = `${piece.ornament ? "ornament:" : ""}${piece.itemId}|${piece.color}|${piece.on}`;
      let p = this.placed.get(piece.instanceId);
      if (!p || p.key !== `${base}|${liveSlice(this.live, p.reads)}`) {
        if (p) this.removePlaced(p);
        p = this.build(piece);
        p.key = `${base}|${liveSlice(this.live, p.reads)}`;
        this.placed.set(piece.instanceId, p);
      }
      p.piece = piece;
      this.position(p);
    }
    for (const [id, p] of this.placed) if (!seen.has(id)) this.removePlaced(p);
    if (this.selectedId && !this.placed.has(this.selectedId)) this.select(null);
    this.refreshSelection();
    this.updateLamps();
    this.invalidate();
  }

  private build(piece: ScenePiece): Placed {
    this.needsCompile = true;
    const model = piece.ornament ? ornamentModelFor(piece.itemId) : modelFor(piece.itemId);
    const color = piece.color ? (SWATCH_HEX[piece.color] ?? null) : null;
    // Note what the model reads from the live data, so a new minute rebuilds the clock and nothing else.
    const { live, reads } = watchReads(this.live);
    // Pictures and screens made for this one piece are its own to free.
    const [obj, disposables] = this.kit.collect(() => model.build(this.kit, { color, on: piece.on, live }));
    obj.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const root = new THREE.Group();
    root.add(obj);
    root.userData.instanceId = piece.instanceId;
    const parent = this.parentFor(piece);
    parent.add(root);
    if (this.mode === "front") root.visible = this.dollhouseShown;
    let shadow: THREE.Mesh | null = null;
    if (mountOf(model) === "floor") {
      shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.blobMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(model.size[0] * 1.35 + 0.15, model.size[2] * 1.35 + 0.15, 1);
      shadow.renderOrder = 1;
      parent.add(shadow);
    }
    return { piece, model, root, shadow, disposables, key: "", reads };
  }

  /** Where a piece's group goes: the scene, or its floor of the porch view's dollhouse. */
  private parentFor(piece: ScenePiece): THREE.Object3D {
    if (this.mode === "front" && this.dollhouse && !piece.ornament) return this.dollhouse.floors[piece.floor ?? "down"];
    return this.scene;
  }

  private removePlaced(p: Placed): void {
    p.root.parent?.remove(p.root);
    if (p.shadow) {
      p.shadow.parent?.remove(p.shadow);
      p.shadow.geometry.dispose();
    }
    for (const d of p.disposables) d.dispose();
    this.placed.delete(p.piece.instanceId);
  }

  /** Where a piece stands, hangs or is hung, from its stored percentages. */
  private position(p: Placed): void {
    // Turned round its own middle; the soft shadow under it turns with it.
    const turn = mountOf(p.model) === "wall" ? 0 : ((p.piece.turn ?? 0) * Math.PI) / 180;
    p.root.rotation.y = turn;
    p.shadow?.rotation.set(-Math.PI / 2, 0, turn);
    if (p.piece.ornament) {
      // Metres in the yard: x east, y north (north is away from the camera, -z).
      const x = clamp(p.piece.x, -YARD, YARD);
      const z = -clamp(p.piece.y, -YARD, YARD);
      p.root.position.set(x, 0, z);
      p.shadow?.position.set(x, 0.004, z);
      return;
    }
    const mount = mountOf(p.model);
    const { x, y, surface } = p.piece;
    if (mount === "wall") {
      // Hung pieces always hang: one stored on the floor goes up on the wall above where it stood.
      const at = surface === "wall" ? wallToWorld(x, y) : { x: floorToWorld(x, 50).x, y: 1.25 };
      // Nothing hangs over the window or the door.
      p.root.position.set(clearOfOpenings(at.x, p.model.size[0], this.windowShape), at.y, BACK_WALL_Z + 0.004);
    } else if (mount === "ceiling") {
      const spot = surface === "wall" ? { x: wallToWorld(x, y).x, z: BACK_WALL_Z + 0.9 } : floorToWorld(x, y);
      p.root.position.set(spot.x, ROOM_H, spot.z);
    } else {
      const spot = floorToWorld(x, y);
      // Keep the whole piece inside the room, not just its middle, however it is turned.
      const [w, , d] = p.model.size;
      const cos = Math.abs(Math.cos(turn));
      const sin = Math.abs(Math.sin(turn));
      const hw = (w * cos + d * sin) / 2;
      const hd = (w * sin + d * cos) / 2;
      const px = Math.max(-ROOM_W / 2 + hw + 0.02, Math.min(ROOM_W / 2 - hw - 0.02, spot.x));
      const pz = Math.max(-ROOM_D / 2 + hd + 0.02, Math.min(ROOM_D / 2 - hd - 0.02, spot.z));
      p.root.position.set(px, 0, pz);
      p.shadow?.position.set(px, 0.003, pz);
    }
  }

  /** Real light from the pieces that give it, nearest the middle of the room first. */
  private updateLamps(): void {
    const shown = this.mode !== "front" || this.dollhouseShown;
    const lit = shown ? [...this.placed.values()].filter((p) => p.piece.on && p.model.light) : [];
    lit.sort((a, b) => a.root.position.lengthSq() - b.root.position.lengthSq());
    const want = [
      ...this.sceneLights,
      ...lit.map((p) => {
        const spec = p.model.light!;
        // A turned lamp gives its light from where its bulb now is.
        p.root.updateMatrixWorld(true);
        return {
          pos: p.root.localToWorld(new THREE.Vector3(spec.at[0], spec.at[1], spec.at[2])),
          color: new THREE.Color(spec.color),
          intensity: spec.intensity * (this.night ? 1 : 0.35),
          distance: spec.distance ?? 4,
        };
      }),
    ];
    this.pool.forEach((l, i) => {
      const w = want[i];
      l.intensity = w ? w.intensity : 0;
      if (!w) return;
      l.position.copy(w.pos);
      l.color.copy(w.color);
      l.distance = w.distance;
    });
  }

  /** Takes a new scene's own point lights out of it, to be lit by the pool instead (see pool). */
  private takeLights(group: THREE.Object3D): SceneLight[] {
    const found: THREE.PointLight[] = [];
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) found.push(o as THREE.PointLight);
    });
    // The brightest first, if there are more than the pool holds.
    found.sort((a, b) => b.intensity - a.intensity);
    const lights = found.map((l) => ({ pos: l.getWorldPosition(new THREE.Vector3()), color: l.color.clone(), intensity: l.intensity, distance: l.distance }));
    for (const l of found) l.parent?.remove(l);
    return lights;
  }

  // --- Selecting and dragging -----------------------------------------------

  select(instanceId: string | null): void {
    this.selectedId = instanceId;
    this.refreshSelection();
    this.invalidate();
  }

  private refreshSelection(): void {
    if (this.selection) {
      this.scene.remove(this.selection);
      this.selection.geometry.dispose();
      (this.selection.material as THREE.Material).dispose();
      this.selection = null;
    }
    const p = this.selectedId ? this.placed.get(this.selectedId) : null;
    if (!p) return;
    const box = new THREE.Box3().setFromObject(p.root).expandByScalar(0.04);
    this.selection = new THREE.Box3Helper(box, new THREE.Color("#2563eb"));
    this.scene.add(this.selection);
  }

  private ndc(clientX: number, clientY: number): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }

  /** The piece under a point on the canvas, if any. */
  pick(clientX: number, clientY: number): string | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const roots = [...this.placed.values()].map((p) => p.root);
    const hit = this.raycaster.intersectObjects(roots, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.instanceId) o = o.parent;
    return (o?.userData.instanceId as string | undefined) ?? null;
  }

  private dragFrom: { instanceId: string; offset: THREE.Vector3 } | null = null;

  /** Starts moving a piece; the point it was grabbed by stays under the pointer. */
  beginDrag(instanceId: string, clientX: number, clientY: number): void {
    const p = this.placed.get(instanceId);
    // Pieces are moved in their own room, not in the porch view's dollhouse.
    if (!p || this.mode === "front") return;
    const hit = this.hitSurface(mountOf(p.model), clientX, clientY);
    this.dragFrom = { instanceId, offset: hit ? p.root.position.clone().sub(hit) : new THREE.Vector3() };
  }

  /** Moves the piece being dragged and returns its new stored place. */
  dragTo(clientX: number, clientY: number): { x: number; y: number; surface: "floor" | "wall" } | null {
    if (!this.dragFrom) return null;
    const p = this.placed.get(this.dragFrom.instanceId);
    if (!p) return null;
    const mount = mountOf(p.model);
    const hit = this.hitSurface(mount, clientX, clientY);
    if (!hit) return null;
    const at = hit.add(this.dragFrom.offset);
    if (p.piece.ornament) {
      p.piece = { ...p.piece, x: clamp(at.x, -YARD, YARD), y: clamp(-at.z, -YARD, YARD) };
      this.position(p);
      this.refreshSelection();
      this.updateLamps();
      this.invalidate();
      return { x: p.piece.x, y: p.piece.y, surface: "floor" };
    }
    let stored: { x: number; y: number; surface: "floor" | "wall" };
    if (mount === "wall") stored = { ...worldToWall(clearOfOpenings(at.x, p.model.size[0], this.windowShape), at.y), surface: "wall" };
    else stored = { ...worldToFloor(at.x, at.z), surface: "floor" };
    p.piece = { ...p.piece, ...stored };
    this.position(p);
    this.refreshSelection();
    this.updateLamps();
    this.invalidate();
    return stored;
  }

  endDrag(): void {
    this.dragFrom = null;
  }

  private hitSurface(mount: Mount, clientX: number, clientY: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const plane = mount === "wall" ? new THREE.Plane(new THREE.Vector3(0, 0, 1), -BACK_WALL_Z) : new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, out);
  }

  /** Where a click on the floor landed, as stored percentages, for placing a new piece. */
  floorPointAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const hit = this.hitSurface("floor", clientX, clientY);
    if (!hit || Math.abs(hit.x) > ROOM_W / 2 || Math.abs(hit.z) > ROOM_D / 2) return null;
    return worldToFloor(hit.x, hit.z);
  }

  // --- Camera -----------------------------------------------------------------

  /** Turns the view round the room, within a range that keeps the open side towards you. */
  turn(dx: number, dy: number): void {
    this.turnAt = performance.now();
    const v = this.walk.on ? VIEWS.walk : VIEWS[this.mode];
    this.goal.azimuth = clamp(this.goal.azimuth - dx * 0.006, v.azimuthRange[0], v.azimuthRange[1]);
    this.goal.polar = clamp(this.goal.polar - dy * 0.004, v.polarRange[0], v.polarRange[1]);
    this.invalidate();
  }

  zoom(factor: number): void {
    if (this.walk.on) {
      this.goal.zoom = Math.max(0.6, Math.min(1.8, this.goal.zoom * factor));
      this.invalidate();
      return;
    }
    this.goal.zoom = Math.max(ZOOM_MIN[this.mode] ?? 0.85, Math.min(ZOOM_MAX[this.mode] ?? 1.9, this.goal.zoom * factor));
    this.invalidate();
  }

  resetView(): void {
    if (this.walk.on) {
      this.goal = { azimuth: this.walk.heading + Math.PI, polar: VIEWS.walk.polar, zoom: 1 };
      this.invalidate();
      return;
    }
    const v = VIEWS[this.mode];
    this.goal = { azimuth: v.azimuth, polar: v.polar, zoom: 1 };
    this.invalidate();
  }

  /** Where a piece is on the canvas, in client pixels: its middle, for anchoring a label or a test's tap. */
  screenPointOf(instanceId: string): { x: number; y: number } | null {
    const p = this.placed.get(instanceId);
    if (!p) return null;
    this.placeCamera();
    this.camera.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(p.root);
    const c = box.getCenter(new THREE.Vector3()).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((c.x + 1) / 2) * r.width, y: r.top + ((1 - c.y) / 2) * r.height };
  }

  /** A still picture of the view, for a card: compiled, drawn, and encoded without holding up the page. */
  async snapshot(): Promise<string> {
    this.placeCamera();
    await compileQuietly(this.renderer, this.scene, this.camera);
    this.needsCompile = false;
    this.placeCamera();
    this.applyRatio(this.ratioRest);
    this.renderFine();
    const blob = await new Promise<Blob | null>((r) => this.renderer.domElement.toBlob(r, "image/png"));
    return blob ? URL.createObjectURL(blob) : this.renderer.domElement.toDataURL("image/png");
  }

  dispose(): void {
    this.post?.dispose();
    for (const t of this.skyEnvs.values()) t.dispose();
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    for (const p of [...this.placed.values()]) this.removePlaced(p);
    this.dropGarden();
    for (const b of this.built.values()) b.dispose();
    this.built.clear();
    this.room = null;
    this.blob.dispose();
    this.blobMat.dispose();
    this.envTarget.dispose();
    this.kit.dispose();
    if (this.ownsRenderer) this.renderer.dispose();
  }
}
