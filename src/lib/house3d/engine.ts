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
import { buildGarden, GARDEN_LAYOUT } from "./garden";
import { makeKit, SWATCH_HEX, type Kit } from "./kit";
import { liveSlice, watchReads } from "./live";
import { modelFor, ornamentModelFor } from "./registry";
import { buildRoom, viewTexture, type RoomParts } from "./room";
import { BACK_WALL_Z, clearOfOpenings, floorToWorld, ROOM_D, ROOM_H, ROOM_W, wallToWorld, worldToFloor, worldToWall } from "./space";
import { themeFor, type WindowShape } from "./themes";
import { DEFAULT_LIVE, type ItemModel, type LiveData } from "./types";

export type Mount = "floor" | "wall" | "ceiling";

/** A part of the garden itself that was tapped. */
export type GardenPick = { kind: "bed"; unit: number } | { kind: "sprinkler" } | { kind: "tree" } | { kind: "house" };

/** Ornaments stand within this many metres of the yard's middle (lib/dollhouse.ts PAD_LIMIT). */
const YARD = 6.4;

/** Where the camera starts and how far it may turn: the room keeps its open side towards you; the yard is open all round but the house. */
const VIEWS = {
  room: { azimuth: 0.62, polar: 1.04, target: [0, 0.95, -0.15], azimuthRange: [0.12, 1.05], polarRange: [0.82, 1.25] },
  garden: { azimuth: 0.36, polar: 1.0, target: [0, 0.9, -1.2], azimuthRange: [-1.05, 1.05], polarRange: [0.62, 1.3] },
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
}

/** Where a piece really goes, from its model: hung pieces always on the wall, hanging ones from the ceiling. */
export function mountOf(model: ItemModel): Mount {
  return model.ceiling ? "ceiling" : model.wall ? "wall" : "floor";
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


const MAX_LAMPS = 6;

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
  private roomKey = "";
  /** The room's window shape: hung pieces keep clear of the window and the door. */
  private windowShape: WindowShape = "square";
  private placed = new Map<string, Placed>();
  private live: LiveData = DEFAULT_LIVE;
  private night = false;
  private sun: THREE.DirectionalLight;
  private moon: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private lamps: THREE.PointLight[] = [];
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

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -5;
    sc.right = 5;
    sc.top = 5;
    sc.bottom = -5;
    sc.near = 1;
    sc.far = 20;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun, this.sun.target);

    // Moonlight, faint and cool, for the night.
    this.moon = new THREE.DirectionalLight("#9fb3e0", 0);
    this.moon.position.set(-7, 6, 2);
    this.scene.add(this.moon);

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
    // Ease the camera; keep drawing only while it is still moving.
    const o = this.orbit;
    const k = this.reduceMotion ? 1 : 0.22;
    o.azimuth += (this.goal.azimuth - o.azimuth) * k;
    o.polar += (this.goal.polar - o.polar) * k;
    const want = this.fitDistance / this.goal.zoom;
    o.distance += (want - o.distance) * k;
    const moving = Math.abs(this.goal.azimuth - o.azimuth) > 0.0005 || Math.abs(this.goal.polar - o.polar) > 0.0005 || Math.abs(want - o.distance) > 0.002;
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
    if (moving) this.invalidate();
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
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // A phone held upright sees the room from a little higher and further back.
    this.camera.fov = this.camera.aspect < 0.9 ? 40 : 30;
    this.camera.updateProjectionMatrix();
    this.fit(this.orbit.distance === 11);
  }

  private corners(): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const b =
      this.mode === "garden"
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
    this.camera.far = this.mode === "garden" ? 320 : 80;
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
    if (mode === "garden") {
      if (this.room) {
        this.scene.remove(this.room.group);
        this.room.dispose();
        this.room = null;
      }
      this.roomKey = "";
    } else {
      this.dropGarden();
    }
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
    if (this.mode === "garden") {
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
    const key = `${styleId}:${floor}:${night}`;
    this.setNightLight(night);
    if (key === this.roomKey) return;
    this.roomKey = key;
    if (this.room) {
      this.scene.remove(this.room.group);
      this.room.dispose();
    }
    this.room = buildRoom(this.kit, themeFor(styleId), floor, night);
    this.scene.add(this.room.group);
    // Another house has other windows: hung pieces find their wall again.
    this.windowShape = themeFor(styleId).window;
    for (const p of this.placed.values()) this.position(p);
    this.refreshSelection();
    this.invalidate();
  }

  private setNightLight(night: boolean): void {
    this.night = night;
    const out = this.mode === "garden";
    this.sun.intensity = night ? 0 : out ? 3.0 : 2.6;
    this.moon.intensity = night ? (out ? 0.55 : 0.35) : 0;
    this.hemi.intensity = night ? (out ? 0.14 : 0.05) : out ? 0.75 : 0.45;
    this.hemi.color.set(night ? "#5b6c9a" : out ? "#dfeaf7" : "#e9eef6");
    this.hemi.groundColor.set(out ? "#6f7d4c" : "#b49a7c");
    this.scene.environmentIntensity = night ? (out ? 0.14 : 0.1) : out ? 0.5 : 0.6;
    for (const v of this.room?.views ?? []) {
      const m = v.material as THREE.MeshBasicMaterial;
      m.map = viewTexture(themeFor(this.roomKey.split(":")[0]).view, night);
      m.color.set(night ? "#9aa3b8" : "#ffffff");
      m.needsUpdate = true;
    }
    this.updateLamps();
    this.invalidate();
  }

  // --- The garden ---------------------------------------------------------------

  /** The backyard: the beds, the tree and the sprinkler as the student's progress has grown them, and the ornaments put out. */
  showGarden(state: GardenState, styleId: string, night: boolean, ornaments: { instanceId: string; itemId: string; x: number; z: number; on?: boolean }[]): void {
    this.enter("garden");
    const key = `${styleId}:${night}:${JSON.stringify(state)}`;
    if (key !== this.gardenKey) {
      this.dropGarden();
      this.gardenKey = key;
      // The garden keeps its own pictures and frees them itself.
      const made = buildGarden(this.kit, state, { night, styleId });
      this.garden = { group: made.group, own: [], dispose: made.dispose };
      this.scene.add(made.group);
    }
    this.setNightLight(night);
    this.setPieces(ornaments.map((o) => ({ instanceId: o.instanceId, itemId: o.itemId, x: o.x, y: o.z, surface: "floor" as const, color: null, on: o.on ?? true, ornament: true })));
  }

  private dropGarden(): void {
    if (!this.garden) return;
    this.scene.remove(this.garden.group);
    this.garden.dispose();
    for (const d of this.garden.own) d.dispose();
    this.garden = null;
    this.gardenKey = "";
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
    const hit = this.raycaster.intersectObject(this.garden.group, true).find((h) => h.object.visible);
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o !== this.garden.group) {
      if (typeof o.userData.gardenUnit === "number") return { kind: "bed", unit: o.userData.gardenUnit };
      if (o.userData.gardenPart === "sprinkler") return { kind: "sprinkler" };
      if (o.userData.gardenPart === "tree") return { kind: "tree" };
      if (o.userData.gardenPart === "house") return { kind: "house" };
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
    this.scene.add(root);
    let shadow: THREE.Mesh | null = null;
    if (mountOf(model) === "floor") {
      shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.blobMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(model.size[0] * 1.35 + 0.15, model.size[2] * 1.35 + 0.15, 1);
      shadow.renderOrder = 1;
      this.scene.add(shadow);
    }
    return { piece, model, root, shadow, disposables, key: "", reads };
  }

  private removePlaced(p: Placed): void {
    this.scene.remove(p.root);
    if (p.shadow) {
      this.scene.remove(p.shadow);
      p.shadow.geometry.dispose();
    }
    for (const d of p.disposables) d.dispose();
    this.placed.delete(p.piece.instanceId);
  }

  /** Where a piece stands, hangs or is hung, from its stored percentages. */
  private position(p: Placed): void {
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
      // Keep the whole piece inside the room, not just its middle.
      const hw = p.model.size[0] / 2;
      const hd = p.model.size[2] / 2;
      const px = Math.max(-ROOM_W / 2 + hw + 0.02, Math.min(ROOM_W / 2 - hw - 0.02, spot.x));
      const pz = Math.max(-ROOM_D / 2 + hd + 0.02, Math.min(ROOM_D / 2 - hd - 0.02, spot.z));
      p.root.position.set(px, 0, pz);
      p.shadow?.position.set(px, 0.003, pz);
    }
  }

  /** Real light from the pieces that give it, nearest the middle of the room first. */
  private updateLamps(): void {
    for (const l of this.lamps) this.scene.remove(l);
    this.lamps = [];
    const lit = [...this.placed.values()].filter((p) => p.piece.on && p.model.light);
    lit.sort((a, b) => a.root.position.lengthSq() - b.root.position.lengthSq());
    for (const p of lit.slice(0, MAX_LAMPS)) {
      const spec = p.model.light!;
      const l = new THREE.PointLight(spec.color, spec.intensity * (this.night ? 1 : 0.35), spec.distance ?? 4, 2);
      l.position.set(p.root.position.x + spec.at[0], p.root.position.y + spec.at[1], p.root.position.z + spec.at[2]);
      this.scene.add(l);
      this.lamps.push(l);
    }
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
    if (!p) return;
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
    const v = VIEWS[this.mode];
    this.goal.azimuth = clamp(this.goal.azimuth - dx * 0.006, v.azimuthRange[0], v.azimuthRange[1]);
    this.goal.polar = clamp(this.goal.polar - dy * 0.004, v.polarRange[0], v.polarRange[1]);
    this.invalidate();
  }

  zoom(factor: number): void {
    this.goal.zoom = Math.max(0.85, Math.min(1.9, this.goal.zoom * factor));
    this.invalidate();
  }

  resetView(): void {
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

  /** A still picture of the view, for sharing or a card. */
  snapshot(): string {
    this.step();
    return this.renderer.domElement.toDataURL("image/png");
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    for (const p of [...this.placed.values()]) this.removePlaced(p);
    this.room?.dispose();
    this.dropGarden();
    this.blob.dispose();
    this.blobMat.dispose();
    this.envTarget.dispose();
    this.kit.dispose();
    this.renderer.dispose();
  }
}
