/**
 * The room itself: floor, the back wall and the side wall with real openings
 * (so the sun through the side window lands on the floor), window frames and
 * glass, the door, baseboards, a cut along the top of the walls like a real
 * dollhouse, and what you see outside, painted soft as a camera focused on
 * the room would see it. And what a lived-in room has that nobody buys:
 * curtains, crown molding, a radiator, switches and outlets, sconces, a
 * plant on the sill, coats by the door (roomDetails).
 */

import * as THREE from "three";
import { bumpScale, canvasTexture, TEX, type Kit } from "./kit";
import { BACK_WINDOW, DOOR, ROOM_D, ROOM_H, ROOM_W, SIDE_WINDOW, WALL_T, windowSize } from "./space";
import type { RoomFinish, RoomTheme, ViewKind, WallKind, WindowShape } from "./themes";

type Pt = [number, number];

/** A window's outline (x across, y up, centred on its middle) for a shape and size. */
function windowOutline(shape: WindowShape, w: number, h: number): Pt[] {
  if (shape === "round") {
    const r = Math.min(w, h) / 2;
    return Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
    });
  }
  if (shape === "arch") {
    const r = w / 2;
    const pts: Pt[] = [
      [-r, -h / 2],
      [r, -h / 2],
      [r, h / 2 - r],
    ];
    for (let i = 1; i < 20; i += 1) {
      const a = (i / 20) * Math.PI;
      pts.push([Math.cos(a) * r, h / 2 - r + Math.sin(a) * r]);
    }
    pts.push([-r, h / 2 - r]);
    return pts;
  }
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
}

function wallMaterial(kind: WallKind, color: string): THREE.Material {
  const m = (map: THREE.Texture, roughness: number, bump: number, tint = "#ffffff") => new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: bumpScale(bump), color: tint, roughness, metalness: 0 });
  switch (kind) {
    case "brick":
      return m(TEX.brick([0.85, 0.85]), 0.9, 0.7);
    case "logs":
      return m(TEX.logs([0.57, 0.57]), 0.85, 0.8);
    case "bamboo":
      return m(TEX.bamboo([0.9, 0.9]), 0.7, 0.6);
    case "stone":
      return m(TEX.stoneBlocks([0.36, 0.36]), 0.88, 0.7);
    case "boards":
      return m(boardsTexture(color, true), 0.75, 0.5);
    case "timber":
      return m(boardsTexture(color, false), 0.6, 0.5);
    default: {
      const map = TEX.plaster([0.5, 0.5]);
      return new THREE.MeshStandardMaterial({ color, map, bumpMap: map, bumpScale: bumpScale(0.22), roughness: 0.92 });
    }
  }
}

/** Boards in a tone, up and down (painted siding, a barn) or across (natural timber, a chalet). */
export function boardsTexture(tone: string, vertical: boolean, repeat: [number, number] = [0.9, 0.9]): THREE.Texture {
  const t = TEX.planks(tone, repeat).clone();
  t.needsUpdate = true;
  if (vertical) {
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
  }
  return t;
}

function floorMaterial(f: RoomFinish): THREE.Material {
  const w = ROOM_W + 0.3;
  const d = ROOM_D + 0.2;
  switch (f.floor) {
    case "carpet": {
      const map = TEX.carpet([6, 5]);
      return new THREE.MeshStandardMaterial({ color: f.floorColor, map, bumpMap: map, bumpScale: bumpScale(0.3), roughness: 1 });
    }
    case "concrete": {
      const map = TEX.concrete([3, 2.5]);
      return new THREE.MeshPhysicalMaterial({ color: f.floorColor, map, bumpMap: map, bumpScale: bumpScale(0.3), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    }
    case "tiles": {
      const map = TEX.tiles(f.floorColor, [w / 2, d / 2]);
      return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: bumpScale(0.6), roughness: 0.35 });
    }
    case "stone": {
      const map = TEX.stoneBlocks([w / 2.8, d / 2.8]);
      return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: bumpScale(0.6), color: "#d8d4ce", roughness: 0.7 });
    }
    default: {
      const map = TEX.planks(f.floorColor, [w / 1.44, d / 1.44]);
      return new THREE.MeshPhysicalMaterial({ map, bumpMap: map, bumpScale: bumpScale(0.5), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
    }
  }
}

/** A wall in the x-y plane, from x0 to x1 and 0 to H, with openings; extruded WALL_T towards -z. */
function wallMesh(x0: number, x1: number, holes: Pt[][], m: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2(x1, ROOM_H), new THREE.Vector2(x0, ROOM_H)]);
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -WALL_T);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Frame, sill, glass and muntins for one window, built in its own plane (x across, y up, +z into the room). */
function windowParts(k: Kit, shape: WindowShape, w: number, h: number, trim: string): THREE.Group {
  const g = new THREE.Group();
  const frameM = k.paint(trim, 0.45);
  const outline = windowOutline(shape, w, h);
  const outer = windowOutline(shape, w + 0.14, h + 0.14);
  // The casing round the opening, standing a little proud of the wall.
  g.add(k.extrude(outer, 0.05, frameM, { holes: [outline.slice().reverse()], at: [0, 0, 0.012], bevel: 0.008 }));
  // Glass, in the middle of the wall's thickness.
  const glassShape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), k.glass("#d9e6ec", 0.16));
  glass.position.z = -WALL_T / 2;
  g.add(glass);
  // Muntins.
  const bar = (bw: number, bh: number, x: number, y: number) => g.add(k.box(bw, bh, 0.035, frameM, { at: [x, y, -WALL_T / 2] }));
  if (shape === "square") {
    bar(0.04, h, 0, 0);
    bar(w, 0.04, 0, 0);
  } else if (shape === "grid") {
    for (const fx of [-1 / 3, 1 / 3]) bar(0.035, h, fx * w, 0);
    for (const fy of [-0.25, 0, 0.25]) bar(w, 0.035, 0, fy * h);
  } else if (shape === "wide") {
    bar(0.05, h, 0, 0);
  } else if (shape === "round") {
    bar(0.04, h, 0, 0);
    bar(w, 0.04, 0, 0);
  } else if (shape === "arch") {
    bar(0.04, h, 0, 0);
    bar(w, 0.04, 0, -0.05);
  }
  // Sill.
  g.add(k.box(w + 0.24, 0.04, 0.16, frameM, { at: [0, -h / 2 - 0.02, 0.05], r: 0.006 }));
  return g;
}

// ---------------------------------------------------------------------------
// The view outside
// ---------------------------------------------------------------------------

const viewCache = new Map<string, THREE.Texture>();

/** What is outside, painted soft (the camera is focused on the room), by day or by night. */
export function viewTexture(kind: ViewKind, night: boolean): THREE.Texture {
  const key = `${kind}:${night}`;
  const cached = viewCache.get(key);
  if (cached) return cached;
  const t = canvasTexture(1600, 800, (c, w, h) => {
    let s = kind.length * 977 + (night ? 7 : 3);
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    // Blurred parts are drawn on a layer and blurred once (a blur on every shape was slow).
    const layer = (filter: string, draw: (c: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const l = cv.getContext("2d", { willReadFrequently: true })!;
      draw(l);
      c.save();
      c.filter = filter;
      c.drawImage(cv, 0, 0);
      c.restore();
    };
    const sky = c.createLinearGradient(0, 0, 0, h * 0.62);
    if (night) {
      sky.addColorStop(0, "#0a1430");
      sky.addColorStop(1, "#2b3b5e");
    } else {
      sky.addColorStop(0, "#8fbfe8");
      sky.addColorStop(1, "#e6f0f6");
    }
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    if (night) {
      for (let i = 0; i < 160; i += 1) {
        c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
        c.fillRect(rnd() * w, rnd() * h * 0.5, 2, 2);
      }
      const moon = c.createRadialGradient(w * 0.72, h * 0.18, 4, w * 0.72, h * 0.18, 60);
      moon.addColorStop(0, "rgba(255,250,230,1)");
      moon.addColorStop(0.45, "rgba(255,250,230,0.9)");
      moon.addColorStop(1, "rgba(255,250,230,0)");
      c.fillStyle = moon;
      c.fillRect(w * 0.6, 0, w * 0.3, h * 0.4);
    } else {
      // Soft clouds.
      layer("blur(18px)", (c) => {
        for (let i = 0; i < 9; i += 1) {
          c.fillStyle = `rgba(255,255,255,${0.55 + rnd() * 0.3})`;
          c.beginPath();
          c.ellipse(rnd() * w, 40 + rnd() * h * 0.28, 90 + rnd() * 140, 26 + rnd() * 30, 0, 0, Math.PI * 2);
          c.fill();
        }
      });
    }
    const dim = (hex: string, f: number) => {
      const col = new THREE.Color(hex);
      if (night) col.multiplyScalar(0.22 * f).lerp(new THREE.Color("#1a2540"), 0.45);
      return `#${col.getHexString()}`;
    };
    const hills = (y: number, amp: number, color: string, blur: number) => {
      layer(`blur(${blur}px)`, (c) => {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) c.lineTo(x, y + Math.sin(x * 0.004 + y) * amp + Math.sin(x * 0.011) * amp * 0.4);
        c.lineTo(w, h);
        c.closePath();
        c.fill();
      });
    };
    const trees = (n: number, y: number, size: number, color: string, blur: number) => {
      layer(`blur(${blur}px)`, (c) => {
        for (let i = 0; i < n; i += 1) {
          const x = rnd() * w;
          const s2 = size * (0.7 + rnd() * 0.6);
          c.fillStyle = color;
          c.beginPath();
          c.ellipse(x, y - s2 * 0.9, s2 * 0.7, s2, 0, 0, Math.PI * 2);
          c.fill();
          c.fillRect(x - s2 * 0.08, y - s2 * 0.2, s2 * 0.16, s2 * 0.5);
        }
      });
    };
    if (kind === "countryside") {
      hills(h * 0.55, 30, dim("#9db98a", 1), 6);
      trees(14, h * 0.6, 26, dim("#5f7f4f", 1), 5);
      hills(h * 0.68, 22, dim("#86a96a", 1), 8);
      trees(8, h * 0.78, 60, dim("#4a6b3d", 1), 9);
      hills(h * 0.86, 12, dim("#6f9455", 1), 12);
    } else if (kind === "forest") {
      hills(h * 0.5, 20, dim("#7f9c7a", 1), 8);
      trees(40, h * 0.62, 50, dim("#4f6e48", 1), 7);
      trees(26, h * 0.8, 90, dim("#3c5a37", 1), 10);
      trees(14, h * 1.0, 160, dim("#2f4a2c", 1), 14);
    } else if (kind === "city") {
      layer("blur(4px)", (c) => {
        for (let layer = 0; layer < 3; layer += 1) {
          const base = h * (0.62 + layer * 0.12);
          for (let x = -20; x < w; ) {
            const bw = 50 + rnd() * 120;
            const bh = 80 + rnd() * (260 - layer * 40);
            const tone = 150 - layer * 30 + rnd() * 30;
            c.fillStyle = night ? `rgb(${tone * 0.18},${tone * 0.2},${tone * 0.3})` : `rgb(${tone},${tone + 8},${tone + 22})`;
            c.fillRect(x, base - bh, bw, bh + h);
            // Windows, many lit at night.
            for (let wy = base - bh + 12; wy < base - 8; wy += 16)
              for (let wx = x + 8; wx < x + bw - 8; wx += 14)
                if (rnd() < (night ? 0.45 : 0.25)) {
                  c.fillStyle = night ? "rgba(255,214,140,0.9)" : "rgba(220,235,250,0.55)";
                  c.fillRect(wx, wy, 6, 8);
                }
            x += bw + 6;
          }
        }
      });
    } else if (kind === "ocean") {
      c.fillStyle = dim("#4f93b6", 1);
      c.fillRect(0, h * 0.5, w, h * 0.2);
      layer("blur(2px)", (c) => {
        for (let i = 0; i < 60; i += 1) {
          c.fillStyle = `rgba(255,255,255,${night ? 0.08 : 0.35})`;
          c.fillRect(rnd() * w, h * 0.52 + rnd() * h * 0.16, 30 + rnd() * 60, 2);
        }
      });
      hills(h * 0.7, 8, dim("#e7d3a8", 1), 6);
      layer("blur(8px)", (c) => {
        for (let i = 0; i < 5; i += 1) {
          const x = rnd() * w;
          c.strokeStyle = dim("#5a4a32", 1);
          c.lineWidth = 12;
          c.beginPath();
          c.moveTo(x, h);
          c.quadraticCurveTo(x + 30, h * 0.6, x + 60, h * 0.42);
          c.stroke();
          c.fillStyle = dim("#3f6b3a", 1);
          for (let f = 0; f < 6; f += 1) {
            c.beginPath();
            c.ellipse(x + 60 + Math.cos(f) * 60, h * 0.42 + Math.sin(f) * 20, 70, 14, f, 0, Math.PI * 2);
            c.fill();
          }
        }
      });
    } else if (kind === "desert") {
      // A desert: far mesas, dunes in the warm light, a few saguaros.
      layer("blur(6px)", (c) => {
        c.fillStyle = dim("#b98a6c", 1);
        for (let i = 0; i < 4; i += 1) {
          const x = rnd() * w;
          const mw = 160 + rnd() * 240;
          const top = h * 0.5 - rnd() * 60;
          c.beginPath();
          c.moveTo(x - mw / 2 - 40, h * 0.6);
          c.lineTo(x - mw / 2, top);
          c.lineTo(x + mw / 2, top);
          c.lineTo(x + mw / 2 + 40, h * 0.6);
          c.closePath();
          c.fill();
        }
      });
      hills(h * 0.62, 14, dim("#d9b48a", 1), 6);
      hills(h * 0.74, 18, dim("#e2c19a", 1), 8);
      hills(h * 0.86, 10, dim("#c9a179", 1), 10);
      layer("blur(3px)", (c) => {
        c.fillStyle = dim("#4f7a4a", 1);
        for (let i = 0; i < 7; i += 1) {
          const x = rnd() * w;
          const base = h * (0.7 + rnd() * 0.25);
          const tall = 50 + rnd() * 70;
          c.fillRect(x - 7, base - tall, 14, tall);
          c.fillRect(x - 30, base - tall * 0.55, 10, tall * 0.3);
          c.fillRect(x - 30, base - tall * 0.55, 30, 10);
          c.fillRect(x + 20, base - tall * 0.7, 10, tall * 0.35);
          c.fillRect(x, base - tall * 0.7, 30, 10);
        }
      });
    } else if (kind === "lake") {
      // A lake below wooded hills, a jetty, mountains far behind.
      layer("blur(5px)", (c) => {
        c.fillStyle = dim("#8a90b4", 1);
        c.beginPath();
        c.moveTo(0, h * 0.5);
        let x = 0;
        while (x <= w) {
          c.lineTo(x + 70, h * 0.5 - 90 - rnd() * 100);
          c.lineTo(x + 150, h * 0.5);
          x += 150 + rnd() * 60;
        }
        c.lineTo(w, h * 0.5);
        c.closePath();
        c.fill();
      });
      hills(h * 0.52, 16, dim("#6f8f66", 1), 6);
      trees(22, h * 0.57, 28, dim("#45664a", 1), 5);
      c.fillStyle = dim("#5f9ac0", 1);
      c.fillRect(0, h * 0.58, w, h * 0.3);
      layer("blur(2px)", (c) => {
        for (let i = 0; i < 70; i += 1) {
          c.fillStyle = `rgba(255,255,255,${night ? 0.1 : 0.4})`;
          c.fillRect(rnd() * w, h * 0.6 + rnd() * h * 0.26, 24 + rnd() * 70, 2);
        }
        // A jetty, out from the near shore.
        c.fillStyle = dim("#6b5338", 1);
        c.fillRect(w * 0.58, h * 0.76, 140, 10);
        for (let i = 0; i < 4; i += 1) c.fillRect(w * 0.58 + 20 + i * 36, h * 0.76, 6, 26);
      });
      hills(h * 0.9, 8, dim("#7fa36a", 1), 8);
    } else {
      // Mountains, with snow, and pine forest below.
      layer("blur(5px)", (c) => {
        for (let layer = 0; layer < 3; layer += 1) {
          const base = h * (0.55 + layer * 0.1);
          c.fillStyle = dim(["#8f93b8", "#6f7499", "#565b7c"][layer], 1);
          c.beginPath();
          c.moveTo(0, h);
          let x = 0;
          while (x <= w) {
            const peak = base - 120 - rnd() * 140 + layer * 40;
            c.lineTo(x, base);
            c.lineTo(x + 90, peak);
            if (layer === 0 && !night) {
              c.lineTo(x + 105, peak + 24);
            }
            x += 180 + rnd() * 80;
          }
          c.lineTo(w, h);
          c.closePath();
          c.fill();
        }
      });
      trees(30, h * 0.9, 50, dim("#2f4a3a", 1), 8);
    }
  });
  // The camera looks down through the glass, so it sees the lower part of the
  // picture; the band from just under the horizon to the sky is what it gets.
  t.repeat.set(1, 0.62);
  t.offset.set(0, 0.24);
  viewCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------

export interface RoomParts {
  group: THREE.Group;
  /** The floor's top face, for placing and dragging pieces. */
  floor: THREE.Object3D;
  /** The back wall's face, for hanging pieces. */
  backWall: THREE.Object3D;
  /** The planes outside the windows, whose picture changes with the night. */
  views: THREE.Mesh[];
  dispose(): void;
}

export function buildRoom(k: Kit, theme: RoomTheme, which: "down" | "up", night: boolean): RoomParts {
  const finish = theme.down && which === "down" ? theme.down : theme.up;
  const g = new THREE.Group();
  const owned: (THREE.Material | THREE.BufferGeometry)[] = [];
  const keep = <T extends THREE.Material | THREE.BufferGeometry>(x: T) => {
    owned.push(x);
    return x;
  };

  // Floor, a slab with its cut edge showing at the front.
  const floorM = keep(floorMaterial(finish));
  const floor = new THREE.Mesh(keep(new THREE.BoxGeometry(ROOM_W + WALL_T * 2, 0.2, ROOM_D + WALL_T)), floorM);
  floor.position.set(-WALL_T / 2 + WALL_T / 2, -0.1, -WALL_T / 2);
  floor.receiveShadow = true;
  g.add(floor);
  const edgeM = keep(new THREE.MeshStandardMaterial({ color: "#d9d4cb", roughness: 0.9 }));
  const edge = new THREE.Mesh(keep(new THREE.BoxGeometry(ROOM_W + WALL_T * 2, 0.2, 0.02)), edgeM);
  edge.position.set(0, -0.1, ROOM_D / 2 + 0.001);
  g.add(edge);

  const win = windowSize(theme.window, BACK_WINDOW);
  const sideWin = windowSize(theme.window, SIDE_WINDOW);

  // Back wall, with the window and the door.
  const backM = keep(wallMaterial(finish.backWall, finish.wallColor));
  const backHole = windowOutline(theme.window, win.w, win.h).map(([x, y]) => [x + BACK_WINDOW.x, y + win.sill + win.h / 2] as Pt);
  const doorHole: Pt[] = [
    [DOOR.x - DOOR.w / 2, 0.001],
    [DOOR.x + DOOR.w / 2, 0.001],
    [DOOR.x + DOOR.w / 2, DOOR.h],
    [DOOR.x - DOOR.w / 2, DOOR.h],
  ];
  const back = wallMesh(-ROOM_W / 2 - WALL_T, ROOM_W / 2, [backHole, doorHole], backM);
  back.position.z = -ROOM_D / 2;
  g.add(back);

  // Side wall (x = -W/2), with its window, built the same way and turned.
  const sideM = keep(wallMaterial(finish.sideWall, finish.sideColor ?? finish.wallColor));
  // Turned and mirrored below so its local x runs along +z: the hole sits at the window's z.
  const sideHole = windowOutline(theme.window, sideWin.w, sideWin.h).map(([x, y]) => [x + SIDE_WINDOW.z, y + sideWin.sill + sideWin.h / 2] as Pt);
  const side = wallMesh(-ROOM_D / 2, ROOM_D / 2, [sideHole], sideM);
  side.rotation.y = Math.PI / 2;
  side.position.x = -ROOM_W / 2;
  side.scale.x = -1;
  g.add(side);

  // The cut along the tops of the walls.
  const capM = keep(new THREE.MeshStandardMaterial({ color: "#e4dfd6", roughness: 0.85 }));
  const capBack = new THREE.Mesh(keep(new THREE.BoxGeometry(ROOM_W + WALL_T, 0.012, WALL_T + 0.004)), capM);
  capBack.position.set(-WALL_T / 2, ROOM_H + 0.006, -ROOM_D / 2 - WALL_T / 2);
  g.add(capBack);
  const capSide = new THREE.Mesh(keep(new THREE.BoxGeometry(WALL_T + 0.004, 0.012, ROOM_D + WALL_T)), capM);
  capSide.position.set(-ROOM_W / 2 - WALL_T / 2, ROOM_H + 0.006, -WALL_T / 2);
  g.add(capSide);

  // Baseboards.
  const trimM = k.paint(theme.trim, 0.45);
  const leftOfDoor = DOOR.x - DOOR.w / 2 - 0.08 - -ROOM_W / 2;
  g.add(k.box(leftOfDoor, 0.09, 0.016, trimM, { at: [-ROOM_W / 2 + leftOfDoor / 2, 0.045, -ROOM_D / 2 + 0.008] }));
  const rightOfDoor = ROOM_W / 2 - (DOOR.x + DOOR.w / 2 + 0.08);
  g.add(k.box(rightOfDoor, 0.09, 0.016, trimM, { at: [ROOM_W / 2 - rightOfDoor / 2, 0.045, -ROOM_D / 2 + 0.008] }));
  g.add(k.box(0.016, 0.09, ROOM_D, trimM, { at: [-ROOM_W / 2 + 0.008, 0.045, 0] }));

  // Windows.
  const backWin = windowParts(k, theme.window, win.w, win.h, theme.trim);
  backWin.position.set(BACK_WINDOW.x, win.sill + win.h / 2, -ROOM_D / 2);
  g.add(backWin);
  const sideWinParts = windowParts(k, theme.window, sideWin.w, sideWin.h, theme.trim);
  sideWinParts.rotation.y = Math.PI / 2;
  sideWinParts.position.set(-ROOM_W / 2, sideWin.sill + sideWin.h / 2, SIDE_WINDOW.z);
  g.add(sideWinParts);

  // The door: casing, a panelled door, a brass handle.
  const casing = k.paint(theme.trim, 0.45);
  g.add(k.box(0.08, DOOR.h + 0.08, 0.03, casing, { at: [DOOR.x - DOOR.w / 2 - 0.04, (DOOR.h + 0.08) / 2, -ROOM_D / 2 + 0.015] }));
  g.add(k.box(0.08, DOOR.h + 0.08, 0.03, casing, { at: [DOOR.x + DOOR.w / 2 + 0.04, (DOOR.h + 0.08) / 2, -ROOM_D / 2 + 0.015] }));
  g.add(k.box(DOOR.w + 0.16, 0.08, 0.03, casing, { at: [DOOR.x, DOOR.h + 0.04, -ROOM_D / 2 + 0.015] }));
  const doorM = finish.backWall === "plaster" ? k.paint(theme.trim, 0.4) : k.wood("walnut", { gloss: 0.35 });
  g.add(k.box(DOOR.w, DOOR.h, 0.04, doorM, { at: [DOOR.x, DOOR.h / 2, -ROOM_D / 2 - 0.05] }));
  for (const [py, ph] of [
    [0.55, 0.75],
    [1.5, 0.85],
  ] as const) {
    g.add(k.box(DOOR.w - 0.24, ph, 0.012, doorM, { at: [DOOR.x, py, -ROOM_D / 2 - 0.026], r: 0.004 }));
  }
  g.add(k.sphere(0.03, k.metal("brass"), { at: [DOOR.x + DOOR.w / 2 - 0.1, 1.0, -ROOM_D / 2 - 0.01] }));

  // Outside: a picture just behind each window, unlit so it reads as daylight,
  // no taller or wider than the wall hides from every angle the camera takes:
  // seen only through the glass.
  const views: THREE.Mesh[] = [];
  const viewM = keep(new THREE.MeshBasicMaterial({ map: viewTexture(theme.view, night), toneMapped: false, color: night ? "#9aa3b8" : "#ffffff" }));
  const backTop = Math.min(win.sill + win.h + 0.05, ROOM_H - 0.35);
  const backGeo = keep(new THREE.PlaneGeometry(win.w + 0.9, backTop + 0.4));
  const backView = new THREE.Mesh(backGeo, viewM);
  backView.position.set(BACK_WINDOW.x, (backTop - 0.4) / 2, -ROOM_D / 2 - WALL_T - 0.22);
  views.push(backView);
  g.add(backView);
  const sideTop = Math.min(sideWin.sill + sideWin.h + 0.05, ROOM_H - 0.35);
  const sideGeo = keep(new THREE.PlaneGeometry(sideWin.w + 0.9, sideTop + 0.4));
  const sideView = new THREE.Mesh(sideGeo, viewM);
  sideView.rotation.y = Math.PI / 2;
  sideView.position.set(-ROOM_W / 2 - WALL_T - 0.22, (sideTop - 0.4) / 2, SIDE_WINDOW.z);
  views.push(sideView);
  g.add(sideView);

  g.add(roomDetails(k, theme, which, night, win, sideWin));

  const floorTop = new THREE.Object3D();
  floorTop.position.y = 0;
  const backFace = new THREE.Object3D();
  backFace.position.z = -ROOM_D / 2;

  return {
    group: g,
    floor: floorTop,
    backWall: backFace,
    views,
    dispose() {
      for (const o of owned) o.dispose();
      back.geometry.dispose();
      side.geometry.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// What a lived-in room has
// ---------------------------------------------------------------------------

/** Each house's curtains: linen in the cottage, canvas in the treehouse, grey in the loft, sheer by the sea, velvet in the castle. */
const CURTAINS: Record<string, { color: string; kind: "fabric" | "velvet"; full: boolean }> = {
  cottage: { color: "#b7c4ad", kind: "fabric", full: true },
  treehouse: { color: "#c9a46c", kind: "fabric", full: false },
  loft: { color: "#5f656d", kind: "fabric", full: true },
  beach: { color: "#f4f1ea", kind: "fabric", full: true },
  castle: { color: "#7a2836", kind: "velvet", full: true },
  barn: { color: "#c9c0ad", kind: "fabric", full: false },
  victorian: { color: "#8c5a86", kind: "velvet", full: true },
  adobe: { color: "#d9b36a", kind: "fabric", full: false },
  chalet: { color: "#b23b3b", kind: "fabric", full: false },
  modern: { color: "#9a9ea4", kind: "fabric", full: true },
};

/** Houses whose metalwork is black rather than brass. */
const DARK_METAL = new Set(["loft", "castle", "modern", "victorian"]);

/**
 * One curtain panel, gathered: a row of soft folds hanging from the rod,
 * built along x (its width) and down from y = 0 to -drop. `tied` pulls it in
 * at a tie-back two-thirds of the way down.
 */
function curtainPanel(k: Kit, m: THREE.Material, width: number, drop: number, tied: boolean): THREE.Group {
  const g = new THREE.Group();
  const folds = Math.max(4, Math.round(width / 0.075));
  const r = width / folds / 1.6;
  for (let i = 0; i < folds; i += 1) {
    const x = -width / 2 + (i + 0.5) * (width / folds);
    // Each fold a tall, slightly flattened column, alternately forward and back.
    const fold = k.cyl(r, r * (tied ? 0.8 : 1.05), drop, m, { at: [x, -drop / 2, (i % 2 ? 0.012 : -0.008)], seg: 10 });
    fold.scale.z = 0.7;
    g.add(fold);
  }
  if (tied) g.add(k.box(width + 0.03, 0.035, r * 2 + 0.03, m, { at: [0, -drop * 0.62, 0.004], r: 0.012 }));
  return g;
}

/** A rod above a window with a curtain each side, the window's plane (x across, +z into the room, y = the rod). */
function curtains(k: Kit, theme: RoomTheme, winW: number, drop: number): THREE.Group {
  const spec = CURTAINS[theme.id] ?? CURTAINS.cottage;
  const g = new THREE.Group();
  const cloth = spec.kind === "velvet" ? k.velvet(spec.color) : k.fabric(spec.color);
  const rodM = DARK_METAL.has(theme.id) ? k.metal("black", 0.4) : k.metal("brass", 0.35);
  const span = winW + 0.62;
  g.add(k.cyl(0.013, 0.013, span, rodM, { at: [0, 0, 0.1], rot: [0, 0, Math.PI / 2], seg: 10 }));
  for (const sx of [-1, 1]) {
    g.add(k.sphere(0.03, rodM, { at: [(sx * span) / 2, 0, 0.1], seg: 12 }));
    g.add(k.box(0.025, 0.06, 0.1, rodM, { at: [sx * (span / 2 - 0.08), 0.01, 0.05] }));
    const panel = curtainPanel(k, cloth, 0.36, drop, spec.full);
    panel.position.set(sx * (winW / 2 + 0.08), -0.02, 0.1);
    g.add(panel);
  }
  return g;
}

/** A cast-iron column radiator, standing on the floor against a wall (built along x, facing +z). */
function radiator(k: Kit, width: number, height: number, color: string): THREE.Group {
  const g = new THREE.Group();
  const m = k.paint(color, 0.55);
  const cols = Math.round(width / 0.065);
  for (let i = 0; i < cols; i += 1) {
    const x = -width / 2 + (i + 0.5) * (width / cols);
    g.add(k.box(0.045, height, 0.14, m, { at: [x, 0.08 + height / 2, 0.11], r: 0.018 }));
  }
  // The pipes along the top and bottom, the feet, and the valve.
  for (const y of [0.13, 0.03 + height]) g.add(k.cyl(0.025, 0.025, width, m, { at: [0, y, 0.11], rot: [0, 0, Math.PI / 2], seg: 10 }));
  for (const sx of [-1, 1]) g.add(k.box(0.05, 0.08, 0.12, m, { at: [sx * (width / 2 - 0.05), 0.04, 0.11] }));
  g.add(k.cyl(0.018, 0.018, 0.08, k.metal("brass", 0.3), { at: [-width / 2 - 0.05, 0.12, 0.11], seg: 10 }));
  g.add(k.cyl(0.035, 0.035, 0.03, k.metal("brass", 0.3), { at: [-width / 2 - 0.05, 0.17, 0.11], seg: 14 }));
  return g;
}

/** A switch or an outlet plate on a wall (facing +z). */
function plate(k: Kit, kind: "switch" | "outlet", trim: string): THREE.Group {
  const g = new THREE.Group();
  const face = k.plastic("#f6f4ef", 0.5);
  g.add(k.box(0.075, 0.12, 0.008, face, { at: [0, 0, 0.004], r: 0.004 }));
  if (kind === "switch") g.add(k.box(0.018, 0.035, 0.014, face, { at: [0, 0.006, 0.012], rot: [0.25, 0, 0], r: 0.003 }));
  else
    for (const y of [-0.026, 0.026]) {
      g.add(k.box(0.006, 0.014, 0.003, k.paint("#2a2a2a", 0.9), { at: [-0.011, y, 0.009] }));
      g.add(k.box(0.006, 0.014, 0.003, k.paint("#2a2a2a", 0.9), { at: [0.011, y, 0.009] }));
    }
  void trim;
  return g;
}

/** A wall sconce: a backplate, an arm and a shade that glows at night (facing +z). */
function sconce(k: Kit, theme: RoomTheme, night: boolean): THREE.Group {
  const g = new THREE.Group();
  const metal = DARK_METAL.has(theme.id) ? k.metal("black", 0.4) : k.metal("brass", 0.3);
  g.add(k.cyl(0.05, 0.05, 0.015, metal, { at: [0, 0, 0.008], rot: [Math.PI / 2, 0, 0], seg: 16 }));
  g.add(k.cyl(0.008, 0.008, 0.12, metal, { at: [0, 0.03, 0.07], rot: [Math.PI / 2 - 0.5, 0, 0], seg: 8 }));
  g.add(k.lathe([[0.03, 0], [0.075, 0], [0.05, 0.13], [0.035, 0.13]], k.glow("#f8e9cc", night, 1.8), { at: [0, 0.03, 0.13], seg: 20 }));
  g.add(k.sphere(0.022, k.glow("#ffd9a0", night, 4), { at: [0, 0.08, 0.13], seg: 10 }));
  return g;
}

/** A pot of trailing ivy for the window sill. */
function sillPlant(k: Kit): THREE.Group {
  const g = new THREE.Group();
  g.add(k.lathe([[0, 0], [0.06, 0], [0.075, 0.12], [0.082, 0.13]], k.ceramic("#e9e3d6"), { seg: 18 }));
  g.add(k.cyl(0.072, 0.072, 0.01, k.soil(), { at: [0, 0.12, 0], seg: 16 }));
  const leaf = k.leaf(0.9);
  const rnd = (() => {
    let x = 7;
    return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  })();
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const out = 0.05 + rnd() * 0.06;
    const y = 0.13 + rnd() * 0.1 - (out > 0.09 ? 0.06 : 0);
    g.add(k.sphere(0.028, leaf, { at: [Math.cos(a) * out, y, Math.sin(a) * out], scale: [1, 0.35, 0.7], rot: [0, a, 0.4], seg: 8 }));
  }
  // A few strands trailing over the edge.
  for (const a of [0.4, 2.2, 3.9]) for (let j = 0; j < 4; j += 1) g.add(k.sphere(0.022, leaf, { at: [Math.cos(a) * 0.085, 0.1 - j * 0.045, Math.sin(a) * 0.085], scale: [1, 0.35, 0.7], rot: [0, a, 0.9], seg: 8 }));
  return g;
}

/** Hooks by the door with a coat, a scarf and a cap on them (facing +z). */
function coatHooks(k: Kit, theme: RoomTheme): THREE.Group {
  const g = new THREE.Group();
  const board = theme.id === "loft" || theme.id === "modern" ? k.metal("black", 0.5) : k.wood("walnut", { gloss: 0.3 });
  g.add(k.box(0.42, 0.09, 0.02, board, { at: [0, 0, 0.01], r: 0.006 }));
  const hookM = k.metal(theme.id === "loft" || theme.id === "modern" ? "steel" : "brass", 0.35);
  for (const x of [-0.13, 0, 0.13]) g.add(k.cyl(0.008, 0.008, 0.07, hookM, { at: [x, -0.01, 0.05], rot: [Math.PI / 2 - 0.4, 0, 0], seg: 8 }));
  // The coat: shoulders on the hook, falling to a hem.
  const coat = k.fabric("#3f5a6e");
  g.add(k.box(0.24, 0.62, 0.07, coat, { at: [-0.13, -0.36, 0.06], r: 0.035 }));
  g.add(k.box(0.06, 0.5, 0.06, coat, { at: [-0.25, -0.33, 0.065], rot: [0, 0, 0.06], r: 0.025 }));
  g.add(k.box(0.06, 0.5, 0.06, coat, { at: [-0.01, -0.33, 0.065], rot: [0, 0, -0.06], r: 0.025 }));
  // A striped scarf hanging double.
  const scarf = k.fabric("#b5523b");
  g.add(k.box(0.07, 0.48, 0.02, scarf, { at: [0.11, -0.27, 0.07], rot: [0, 0, 0.03], r: 0.01 }));
  g.add(k.box(0.07, 0.4, 0.02, scarf, { at: [0.15, -0.23, 0.08], rot: [0, 0, -0.04], r: 0.01 }));
  // A cap.
  const cap = k.fabric("#d8b04a");
  g.add(k.sphere(0.075, cap, { at: [0.13, -0.05, 0.075], scale: [1, 0.7, 1], seg: 14 }));
  g.add(k.box(0.09, 0.008, 0.07, cap, { at: [0.13, -0.08, 0.14], r: 0.004 }));
  return g;
}

/** A small mirror in a frame (facing +z). */
function mirror(k: Kit, theme: RoomTheme): THREE.Group {
  const g = new THREE.Group();
  const frame = theme.id === "loft" || theme.id === "modern" ? k.metal("black", 0.4) : k.wood("oak", { gloss: 0.4 });
  g.add(k.box(0.36, 0.56, 0.03, frame, { at: [0, 0, 0.015], r: 0.01 }));
  g.add(k.box(0.3, 0.5, 0.005, k.metal("chrome", 0.04), { at: [0, 0, 0.032] }));
  return g;
}

/** Three framed prints, hung as a group (facing +z, centred on the origin): simple shapes in each house's colours. */
function prints(k: Kit, theme: RoomTheme): THREE.Group {
  const g = new THREE.Group();
  const frame = theme.id === "loft" || theme.id === "modern" ? k.metal("black", 0.4) : theme.id === "castle" || theme.id === "victorian" ? k.metal("gold", 0.35) : k.wood("oak", { gloss: 0.4 });
  const mat = k.paper("#f7f4ec");
  const palette: Record<string, [string, string, string]> = {
    cottage: ["#c9784f", "#7f9a6a", "#e5c66b"],
    treehouse: ["#6b8f4e", "#c58b4a", "#3f6070"],
    loft: ["#d14b3a", "#2d3a4a", "#e8b84a"],
    beach: ["#3c8fb0", "#f0c27a", "#e47f6a"],
    castle: ["#7a2836", "#3b4f7a", "#c9a24a"],
    barn: ["#9b2d2a", "#5c7f45", "#e5c66b"],
    victorian: ["#5b2a52", "#8c5a86", "#c9a24a"],
    adobe: ["#c8845a", "#3aa0a0", "#e0b45c"],
    chalet: ["#3f6b3f", "#b23b3b", "#8a5f3a"],
    modern: ["#1f2225", "#d14b3a", "#9a9ea4"],
  };
  const [a, b, c] = palette[theme.id] ?? palette.cottage;
  const one = (w: number, h: number, x: number, y: number, art: (cx: number, cy: number) => void) => {
    g.add(k.box(w, h, 0.025, frame, { at: [x, y, 0.0125], r: 0.006 }));
    g.add(k.box(w - 0.05, h - 0.05, 0.004, mat, { at: [x, y, 0.027] }));
    art(x, y);
  };
  // A sun over hills, a tall print in two blocks, a small round one.
  one(0.42, 0.32, -0.26, 0.06, (x, y) => {
    g.add(k.box(0.3, 0.09, 0.003, k.paint(b, 0.8), { at: [x, y - 0.06, 0.03] }));
    g.add(k.cyl(0.05, 0.05, 0.003, k.paint(c, 0.8), { at: [x + 0.07, y + 0.04, 0.03], rot: [Math.PI / 2, 0, 0], seg: 20 }));
  });
  one(0.26, 0.46, 0.14, 0.12, (x, y) => {
    g.add(k.box(0.15, 0.17, 0.003, k.paint(a, 0.8), { at: [x, y + 0.08, 0.03] }));
    g.add(k.box(0.15, 0.13, 0.003, k.paint(b, 0.8), { at: [x, y - 0.1, 0.03] }));
  });
  one(0.22, 0.22, -0.2, -0.24, (x, y) => {
    g.add(k.cyl(0.06, 0.06, 0.003, k.paint(a, 0.8), { at: [x, y, 0.03], rot: [Math.PI / 2, 0, 0], seg: 20 }));
  });
  return g;
}

/**
 * The room's own things, the same in every save: crown molding where the
 * walls meet the ceiling, curtains on both windows, a radiator under the side
 * window (where the sill is high enough), switches and outlets, sconces
 * either side of the side window, a plant on the back sill, and by the door
 * the coats downstairs and a mirror upstairs. Nothing here is placed on the
 * back wall where pieces hang, except right by the door.
 */
function roomDetails(k: Kit, theme: RoomTheme, which: "down" | "up", night: boolean, win: { w: number; h: number; sill: number }, sideWin: { w: number; h: number; sill: number }): THREE.Group {
  const g = new THREE.Group();
  const trimM = k.paint(theme.trim, 0.45);
  const back = -ROOM_D / 2;
  const side = -ROOM_W / 2;

  // Crown molding: a cove and a fillet along both walls.
  const crown = (len: number, at: [number, number, number], alongZ: boolean) => {
    const size = (a: number, b: number, c: number): [number, number, number] => (alongZ ? [c, b, a] : [a, b, c]);
    const [w1, h1, d1] = size(len, 0.11, 0.05);
    g.add(k.box(w1, h1, d1, trimM, { at: [at[0] + (alongZ ? 0.025 : 0), ROOM_H - 0.055, at[2] + (alongZ ? 0 : 0.025)] }));
    const [w2, h2, d2] = size(len, 0.035, 0.085);
    g.add(k.box(w2, h2, d2, trimM, { at: [at[0] + (alongZ ? 0.042 : 0), ROOM_H - 0.12, at[2] + (alongZ ? 0 : 0.042)], r: 0.008 }));
  };
  crown(ROOM_W, [0, 0, back], false);
  crown(ROOM_D, [side, 0, 0], true);

  // Curtains: on the back window and the side window.
  const backRod = Math.min(win.sill + win.h + 0.16, ROOM_H - 0.2);
  const spec = CURTAINS[theme.id] ?? CURTAINS.cottage;
  const dropFor = (rod: number, sill: number) => (spec.full ? rod - 0.04 : rod - sill + 0.12);
  const bc = curtains(k, theme, win.w, dropFor(backRod, win.sill));
  bc.position.set(BACK_WINDOW.x, backRod, back);
  g.add(bc);
  const sideRod = Math.min(sideWin.sill + sideWin.h + 0.16, ROOM_H - 0.2);
  const sc = curtains(k, theme, sideWin.w, dropFor(sideRod, sideWin.sill));
  sc.rotation.y = Math.PI / 2;
  sc.position.set(side, sideRod, SIDE_WINDOW.z);
  g.add(sc);

  // A radiator under the side window, if there is room under the sill.
  if (sideWin.sill >= 0.8) {
    const rad = radiator(k, Math.min(1.1, sideWin.w - 0.2), Math.min(0.55, sideWin.sill - 0.3), theme.id === "loft" ? "#2c2f33" : "#f1efe9");
    rad.rotation.y = Math.PI / 2;
    rad.position.set(side, 0, SIDE_WINDOW.z);
    g.add(rad);
  }

  // Sconces either side of the side window.
  for (const dz of [-1, 1]) {
    const s = sconce(k, theme, night);
    s.rotation.y = Math.PI / 2;
    s.position.set(side, 1.75, SIDE_WINDOW.z + dz * (sideWin.w / 2 + 0.42));
    g.add(s);
  }

  // A group of framed prints on the side wall, towards the front.
  const art = prints(k, theme);
  art.rotation.y = Math.PI / 2;
  art.position.set(side, 1.55, Math.min(ROOM_D / 2 - 0.55, SIDE_WINDOW.z + sideWin.w / 2 + 1.25));
  g.add(art);

  // A switch by the door, outlets low on the walls.
  const sw = plate(k, "switch", theme.trim);
  sw.position.set(DOOR.x - DOOR.w / 2 - 0.22, 1.2, back);
  g.add(sw);
  for (const x of [-2.3, 1.0]) {
    const o = plate(k, "outlet", theme.trim);
    o.position.set(x, 0.32, back);
    g.add(o);
  }
  const so = plate(k, "outlet", theme.trim);
  so.rotation.y = Math.PI / 2;
  so.position.set(side, 0.32, 1.4);
  g.add(so);

  // A plant on the back window's sill.
  const plant = sillPlant(k);
  plant.position.set(BACK_WINDOW.x - win.w / 2 + 0.16, win.sill + 0.001, back + 0.07);
  g.add(plant);

  // By the door: coats downstairs, a mirror upstairs, on the strip of wall past it.
  const strip = DOOR.x + DOOR.w / 2 + 0.08 + (ROOM_W / 2 - (DOOR.x + DOOR.w / 2 + 0.08)) / 2;
  if (which === "down") {
    const hooks = coatHooks(k, theme);
    hooks.position.set(strip, 1.72, back);
    g.add(hooks);
    // A doormat in front of the door.
    g.add(k.box(0.86, 0.012, 0.52, k.fabric(theme.id === "beach" ? "#c8b48a" : "#6b5a46"), { at: [DOOR.x, 0.006, back + 0.36], r: 0.004 }));
  } else {
    const m = mirror(k, theme);
    m.position.set(strip, 1.45, back);
    g.add(m);
  }
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}
