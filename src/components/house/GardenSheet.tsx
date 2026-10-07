"use client";

import { useEffect, useRef } from "react";
import type { Material, Mesh, Texture } from "three";

/** Where each ornament stands for ?ornaments=1, stored the way saves keep them: x east, z north of the yard's middle, in metres. */
const ORNAMENT_SPOTS: { id: string; x: number; z: number }[] = [
  { id: "fountain", x: 0.9, z: -4.4 },
  { id: "pond", x: -4.3, z: -3.7 },
  { id: "bench", x: -2.6, z: 5.9 },
  { id: "lamp", x: 2.4, z: 5.7 },
  { id: "topiary", x: -0.25, z: 6.55 },
  { id: "birdbath", x: -1.7, z: 1.0 },
  { id: "flowerbed", x: 5.0, z: 1.8 },
  { id: "tree", x: 5.2, z: 4.6 },
  { id: "mailbox", x: 6.05, z: -2.4 },
  { id: "fence", x: -4.6, z: -6.0 },
];

/** Camera spots for a closer look: position and the point it looks at. */
const VIEWS: Record<string, { pos: [number, number, number]; at: [number, number, number]; fov: number }> = {
  yard: { pos: [7.4, 6.6, 13.8], at: [-0.8, 1.3, -2.2], fov: 40 },
  bed: { pos: [3.6, 2.3, 5.6], at: [1.0, 0.45, 1.4], fov: 42 },
  tree: { pos: [1.6, 3.4, 6.5], at: [-4.0, 2.6, -2.2], fov: 46 },
  house: { pos: [4.5, 3.0, 4.0], at: [1.0, 2.2, -7.2], fov: 50 },
  top: { pos: [0.01, 26, 0.02], at: [0, 0, 0], fov: 40 },
};

/**
 * The /demo/garden sheet (see its page for the address options): the
 * backyard in 3D, rendered once, with window.__sheetReady set for scripts
 * that photograph it.
 */
export function GardenSheet() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const q = new URLSearchParams(window.location.search);
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { makeKit } = await import("@/lib/house3d/kit");
      const { buildGarden, ORNAMENT_MODELS } = await import("@/lib/house3d/garden");
      const { units } = await import("@/data/curriculum");
      const { unitHue } = await import("@/lib/hues");
      const { flowerFor, plantStage, treeStage } = await import("@/lib/garden");
      const { DEFAULT_LIVE } = await import("@/lib/house3d/types");
      if (cancelled) return;

      // A sample garden: ?done is the share of each unit's skills finished. ?spread=1 runs it down
      // the course instead (the first units furthest on), so one picture shows every stage.
      const f = Math.min(1, Math.max(0, Number(q.get("done") ?? "0.5") || 0));
      const spread = q.get("spread") === "1";
      const beds = units.map((u, i) => {
        const total = u.skills.length;
        const share = spread ? Math.min(1, Math.max(0, 2 * f - i / Math.max(1, units.length - 1))) : f;
        const done = Math.round(share * total);
        return { unitId: u.id, number: u.number, title: u.title, hue: unitHue(u.id), flower: flowerFor(u.number), done, total, stage: plantStage(done, total) };
      });
      const done = beds.reduce((n, b) => n + b.done, 0);
      const total = beds.reduce((n, b) => n + b.total, 0);
      const fraction = total ? done / total : 0;
      const state = {
        beds,
        done,
        total,
        fraction,
        blooms: beds.filter((b) => b.stage === "bloom").length,
        tree: treeStage(fraction),
        swing: fraction >= 0.5,
        birdhouse: fraction >= 0.75,
        treehouse: total > 0 && done >= total,
        watered: q.get("watered") === "1",
      };
      const night = q.get("night") === "1";
      const styleId = q.get("style") ?? "cottage";

      // The renderer, set up as the room's is (engine.ts).
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(night ? "#0b1430" : "#bcd3ea");
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = env.texture;
      scene.environmentIntensity = night ? 0.08 : 0.5;
      pmrem.dispose();

      const hemi = new THREE.HemisphereLight(night ? "#5b6c9a" : "#dce8f5", night ? "#1c2418" : "#6f7d4c", night ? 0.12 : 0.55);
      scene.add(hemi);
      // A warm afternoon sun from the south-west, or a cool moon low in the same quarter.
      const sun = new THREE.DirectionalLight(night ? "#9fb3e0" : "#fff0da", night ? 0.45 : 2.7);
      sun.position.set(-11, night ? 9 : 14, 9);
      sun.target.position.set(0, 0, -1.5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(4096, 4096);
      const sc = sun.shadow.camera;
      sc.left = -15;
      sc.right = 15;
      sc.top = 15;
      sc.bottom = -15;
      sc.near = 1;
      sc.far = 60;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.03;
      sun.shadow.radius = night ? 6 : 3;
      scene.add(sun, sun.target);

      const kit = makeKit();
      const garden = buildGarden(kit, state, { night, styleId });
      scene.add(garden.group);

      // Ornaments, each standing at (x, 0, -z), its light switched on with it.
      const owned: (Material | Texture)[] = [];
      const on = q.get("off") !== "1";
      if (q.get("ornaments") === "1") {
        for (const spot of ORNAMENT_SPOTS) {
          const model = ORNAMENT_MODELS[spot.id];
          if (!model) continue;
          const [obj, own] = kit.collect(() => model.build(kit, { color: null, on, live: DEFAULT_LIVE }));
          owned.push(...own);
          obj.traverse((o) => {
            o.castShadow = true;
            o.receiveShadow = true;
          });
          obj.position.set(spot.x, 0, -spot.z);
          scene.add(obj);
          if (on && model.light) {
            const l = new THREE.PointLight(model.light.color, model.light.intensity * (night ? 1 : 0.35), model.light.distance ?? 6, 2);
            l.position.set(spot.x + model.light.at[0], model.light.at[1], -spot.z + model.light.at[2]);
            scene.add(l);
          }
        }
      }

      const view = VIEWS[q.get("view") ?? "yard"] ?? VIEWS.yard;
      const camera = new THREE.PerspectiveCamera(view.fov, 1, 0.1, 400);
      camera.position.set(...view.pos);
      camera.lookAt(...view.at);

      const draw = () => {
        const r = canvas.getBoundingClientRect();
        renderer.setSize(Math.max(2, r.width), Math.max(2, r.height), false);
        camera.aspect = r.width / Math.max(1, r.height);
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      };
      draw();
      window.addEventListener("resize", draw);

      let meshes = 0;
      scene.traverse((o) => {
        if ((o as Mesh).isMesh) meshes += 1;
      });
      const w = window as unknown as { __sheetReady?: boolean; __meshes?: number; __garden?: unknown };
      w.__meshes = meshes;
      w.__garden = { stages: beds.map((b) => b.stage), tree: state.tree, swing: state.swing, birdhouse: state.birdhouse, treehouse: state.treehouse, meshes };
      w.__sheetReady = true;

      cleanup = () => {
        window.removeEventListener("resize", draw);
        garden.dispose();
        for (const d of owned) d.dispose();
        kit.dispose();
        env.dispose();
        renderer.dispose();
      };
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <canvas ref={canvasRef} className="block h-[100vh] w-full bg-[#bcd3ea]" />;
}
