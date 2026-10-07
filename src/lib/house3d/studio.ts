/**
 * Pictures of single pieces, for the shop and the tray: the same model, the
 * same materials and the same light as the room, photographed on its own
 * like a product shot. One offscreen renderer does them all, one at a time,
 * and keeps each picture, so a shop of a hundred cards is a hundred quick
 * renders the first time and none after.
 */

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeKit, SWATCH_HEX, type Kit } from "./kit";
import { liveSlice, watchReads } from "./live";
import { modelFor, ornamentModelFor } from "./registry";
import { DEFAULT_LIVE, type LiveData } from "./types";

export interface ShotOptions {
  color?: string | null;
  on?: boolean;
  live?: LiveData;
  width?: number;
  height?: number;
  /** A garden ornament rather than a piece of furniture. */
  ornament?: boolean;
}

class Studio {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 4 / 3, 0.05, 50);
  private kit: Kit;
  private holder = new THREE.Group();
  private ground: THREE.Mesh;
  private key: THREE.DirectionalLight;
  private envTarget: THREE.WebGLRenderTarget;

  constructor() {
    const canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.75;
    pmrem.dispose();
    this.kit = makeKit();
    this.key = new THREE.DirectionalLight("#fff4e6", 2.2);
    this.key.position.set(-2, 8, 3);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.radius = 6;
    this.key.shadow.bias = -0.0005;
    this.scene.add(this.key, this.key.target);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#c9c2b8", 0.5));
    // A floor that only catches the shadow, so the piece sits on the card.
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.holder);
  }

  shoot(itemId: string, o: ShotOptions): { url: string; reads: Set<string> } {
    const w = o.width ?? 320;
    const h = o.height ?? 240;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const model = o.ornament ? ornamentModelFor(itemId) : modelFor(itemId);
    const color = o.color ? (SWATCH_HEX[o.color] ?? null) : null;
    const { live, reads } = watchReads(o.live ?? DEFAULT_LIVE);
    const [obj, own] = this.kit.collect(() => model.build(this.kit, { color, on: o.on ?? true, live }));
    obj.traverse((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
    });
    // A hung piece is photographed standing up; a hanging one from below its hook.
    if (model.ceiling) obj.position.y = model.size[1];
    this.holder.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const centre = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.ground.position.y = box.min.y - 0.001;
    this.ground.visible = !model.wall;
    // Three-quarters from the front, a little above; flat pieces from higher up.
    const flat = model.size[1] < 0.1;
    const az = model.wall ? 0.32 : 0.58;
    const pol = flat ? 0.75 : model.wall ? 1.42 : 1.2;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fit = Math.max(1, 1 / Math.min(1, this.camera.aspect));
    const dist = (sphere.radius / Math.sin(fov / 2)) * 1.02 * fit;
    this.camera.position.set(centre.x + dist * Math.sin(pol) * Math.sin(az), centre.y + dist * Math.cos(pol), centre.z + dist * Math.sin(pol) * Math.cos(az));
    this.camera.near = Math.max(0.01, dist - sphere.radius * 3);
    this.camera.far = dist + sphere.radius * 3;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(centre);
    this.key.target.position.copy(centre);
    const sc = this.key.shadow.camera;
    const r = sphere.radius * 1.6;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    this.key.position.set(centre.x - 2, centre.y + 8, centre.z + 3);
    sc.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL("image/png");
    this.holder.remove(obj);
    for (const d of own) d.dispose();
    return { url, reads };
  }
}

let studio: Studio | null = null;
const shots = new Map<string, string>();
/** What each model read from the live data the first time it was photographed: only those fields key its picture. */
const readsOf = new Map<string, Set<string>>();
let queue: Promise<unknown> = Promise.resolve();

function shotKey(itemId: string, o: ShotOptions): string {
  const model = `${o.ornament ? "ornament:" : ""}${itemId}`;
  const reads = readsOf.get(model);
  const live = reads ? liveSlice(o.live ?? DEFAULT_LIVE, reads) : "?";
  return `${model}|${o.color ?? ""}|${o.on ?? true}|${o.width ?? 320}x${o.height ?? 240}|${live}`;
}

/** A picture of a piece (cached), taken in turn with the others so the page never stalls on many at once. */
export function pieceShot(itemId: string, o: ShotOptions = {}): Promise<string> {
  const have = shots.get(shotKey(itemId, o));
  if (have) return Promise.resolve(have);
  const next = queue.then(
    () =>
      new Promise<string>((resolve) => {
        // Taken while waiting in line, perhaps.
        const ready = shots.get(shotKey(itemId, o));
        if (ready) {
          resolve(ready);
          return;
        }
        // One render per frame, so a long shop fills in without freezing the page.
        requestAnimationFrame(() => {
          studio ??= new Studio();
          const { url, reads } = studio.shoot(itemId, o);
          readsOf.set(`${o.ornament ? "ornament:" : ""}${itemId}`, reads);
          shots.set(shotKey(itemId, o), url);
          resolve(url);
        });
      })
  );
  queue = next.catch(() => undefined);
  return next;
}

/**
 * A room in a house style, furnished with a few everyday pieces, for the
 * house cards in the shop: the real room you would move into.
 */
export function roomShot(styleId: string, o: { width?: number; height?: number } = {}): Promise<string> {
  const w = o.width ?? 520;
  const h = o.height ?? 320;
  const key = `room:${styleId}:${w}x${h}`;
  const have = shots.get(key);
  if (have) return Promise.resolve(have);
  const next = queue.then(
    () =>
      new Promise<string>((resolve) => {
        requestAnimationFrame(async () => {
          const { HouseView } = await import("./engine");
          const canvas = document.createElement("canvas");
          const view = new HouseView(canvas);
          view.resize(w, h);
          view.setRoom(styleId, "down", false);
          view.setPieces(
            [
              ["rug", 50, 62],
              ["desk", 22, 22],
              ["chair", 24, 40],
              ["bookshelf", 80, 18],
              ["plant", 92, 60],
              ["cloud-couch", 58, 70],
              ["lamp", 34, 20],
            ].map(([itemId, x, y], i) => ({ instanceId: `s${i}`, itemId: itemId as string, x: x as number, y: y as number, surface: "floor" as const, color: null, on: true }))
          );
          const url = view.snapshot();
          view.dispose();
          shots.set(key, url);
          resolve(url);
        });
      })
  );
  queue = next.catch(() => undefined);
  return next;
}

/** A picture already taken, if there is one, for the first paint. */
export function cachedShot(itemId: string, o: ShotOptions = {}): string | undefined {
  return shots.get(shotKey(itemId, o));
}
