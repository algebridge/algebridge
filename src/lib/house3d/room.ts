/**
 * The room itself: floor, the back wall and the side wall with real openings
 * (so the sun through the side window lands on the floor), window frames and
 * glass, the door, baseboards, a cut along the top of the walls like a real
 * dollhouse, and what you see outside, painted soft as a camera focused on
 * the room would see it.
 */

import * as THREE from "three";
import { canvasTexture, TEX, type Kit } from "./kit";
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
  const m = (map: THREE.Texture, roughness: number, tint = "#ffffff") => new THREE.MeshStandardMaterial({ map, color: tint, roughness, metalness: 0 });
  switch (kind) {
    case "brick":
      return m(TEX.brick([0.85, 0.85]), 0.9);
    case "logs":
      return m(TEX.logs([0.57, 0.57]), 0.85);
    case "bamboo":
      return m(TEX.bamboo([0.9, 0.9]), 0.7);
    case "stone":
      return m(TEX.stoneBlocks([0.36, 0.36]), 0.88);
    default:
      return new THREE.MeshStandardMaterial({ color, map: TEX.plaster([0.5, 0.5]), roughness: 0.92 });
  }
}

function floorMaterial(f: RoomFinish): THREE.Material {
  const w = ROOM_W + 0.3;
  const d = ROOM_D + 0.2;
  switch (f.floor) {
    case "carpet":
      return new THREE.MeshStandardMaterial({ color: f.floorColor, map: TEX.carpet([6, 5]), roughness: 1 });
    case "concrete":
      return new THREE.MeshPhysicalMaterial({ color: f.floorColor, map: TEX.concrete([3, 2.5]), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });
    case "tiles":
      return new THREE.MeshStandardMaterial({ map: TEX.tiles(f.floorColor, [w / 2, d / 2]), roughness: 0.35 });
    case "stone":
      return new THREE.MeshStandardMaterial({ map: TEX.stoneBlocks([w / 2.8, d / 2.8]), color: "#d8d4ce", roughness: 0.7 });
    default:
      return new THREE.MeshPhysicalMaterial({ map: TEX.planks(f.floorColor, [w / 1.44, d / 1.44]), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 });
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
  const sideM = keep(wallMaterial(finish.sideWall, finish.wallColor));
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
