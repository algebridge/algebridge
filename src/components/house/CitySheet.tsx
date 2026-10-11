"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { buyCityPlot, spendable } from "@/lib/bridgeys";
import { fetchCityResidents, type CityResident } from "@/lib/leaderboard";
import { CITIES, heightAt, sanitizePlots, type CityData } from "@/lib/world";
import { themeFor } from "@/lib/house3d/themes";
import type { UserProgress } from "@/types";

type Pick = { plot: string; owner: "you" | "open" | CityResident } | null;

interface View {
  show(data: CityData, mine: Set<string>, others: CityResident[], styleId: string): void;
  dispose(): void;
}

/**
 * Real cities, where a student buys a plot with Bridgeys and their house
 * stands on it: the city's own ground (its terrain, satellite picture,
 * streets, parks and water) and every building at its real footprint and
 * height, baked ahead by scripts/world-cities.mjs and loaded as one file.
 * Other students' houses stand on the plots they bought. Drawn only while
 * it moves; its own renderer, gone when the sheet closes.
 */
export function CitySheet({ progress, user, onClose, onUpdate, showMessage }: { progress: UserProgress; user: boolean; onClose: () => void; onUpdate: () => void; showMessage: (ok: boolean, text: string) => void }) {
  const [cityId, setCityId] = useState(CITIES[1].id);
  const [data, setData] = useState<CityData | null>(null);
  const [others, setOthers] = useState<CityResident[]>([]);
  const [pick, setPick] = useState<Pick>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View | null>(null);
  const pickRef = useRef<(id: string | null) => void>(() => undefined);
  const city = CITIES.find((c) => c.id === cityId)!;
  const mine = new Set(sanitizePlots(progress.cityPlots).filter((p) => p.city === cityId).map((p) => p.plot));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The city's file, and who else lives there.
  useEffect(() => {
    let live = true;
    setData(null);
    setPick(null);
    setOthers([]);
    fetch(`/world/${cityId}/data.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: CityData) => live && setData(d))
      .catch(() => live && setFailed(true));
    if (user) fetchCityResidents(cityId).then((o) => live && setOthers(o));
    return () => {
      live = false;
    };
  }, [cityId, user]);

  pickRef.current = (id) => {
    if (!id) return setPick(null);
    if (mine.has(id)) return setPick({ plot: id, owner: "you" });
    const o = others.find((r) => r.plot === id);
    setPick({ plot: id, owner: o ?? "open" });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { compileQuietly } = await import("@/lib/house3d/compile");
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      } catch {
        setFailed(true);
        return;
      }
      renderer.debug.checkShaderErrors = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#cfdde8");
      scene.fog = new THREE.Fog("#cfdde8", 700, 1900);
      const camera = new THREE.PerspectiveCamera(42, 1, 2, 4000);
      camera.position.set(520, 430, 640);
      scene.add(new THREE.HemisphereLight("#eef3fa", "#6b6a5f", 1.3));
      const sun = new THREE.DirectionalLight("#fff1dc", 2.2);
      sun.position.set(-400, 700, 300);
      scene.add(sun);
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.12;
      controls.maxPolarAngle = 1.38;
      controls.minDistance = 40;
      controls.maxDistance = 1300;
      controls.screenSpacePanning = false;
      let frame = 0;
      let calm = 0;
      const draw = () => {
        frame = 0;
        const moved = controls.update();
        renderer.render(scene, camera);
        calm = moved ? 0 : calm + 1;
        if (calm < 20) frame = requestAnimationFrame(draw);
      };
      const wake = () => {
        calm = 0;
        if (!frame && !disposed) frame = requestAnimationFrame(draw);
      };
      controls.addEventListener("change", wake);
      const size = () => {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (w < 2 || h < 2) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        wake();
      };
      const ro = new ResizeObserver(size);
      ro.observe(canvas);
      size();

      let city: InstanceType<typeof THREE.Group> | null = null;
      const owned: { dispose(): void }[] = [];
      const pads: InstanceType<typeof THREE.Mesh>[] = [];
      const free = () => {
        if (city) scene.remove(city);
        for (const o of owned.splice(0)) o.dispose();
        pads.length = 0;
      };

      /** A house in its style's colours: walls with windows, a pitched or flat roof, a door. */
      const facade = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d")!;
        g.fillStyle = "#f4f2ee";
        g.fillRect(0, 0, 128, 128);
        for (const fy of [0.22, 0.62]) for (const fx of [0.16, 0.5, 0.84]) {
          g.fillStyle = "#38424d";
          g.fillRect(128 * fx - 9, 128 * fy, 18, 24);
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
      })();
      const house = (styleId: string, x: number, y: number, z: number, glow: string) => {
        const look = themeFor(styleId);
        const g = new THREE.Group();
        const wall = new THREE.MeshStandardMaterial({ map: facade, color: look.look.wall?.color ?? look.down.wallColor, roughness: 0.85 });
        const roof = new THREE.MeshStandardMaterial({ color: look.look.roofTint ?? "#5b4a42", roughness: 0.9 });
        const pad = new THREE.MeshStandardMaterial({ color: glow, roughness: 0.8 });
        const S = 1.6;
        const walls = new THREE.BoxGeometry(11 * S, 6.1 * S, 7.6 * S).translate(0, 3.05 * S, 0);
        const flatRoof = look.look.roof === "flat" || look.look.roof === "battlements";
        const roofG = flatRoof
          ? new THREE.BoxGeometry(11.3 * S, 0.4 * S, 7.9 * S).translate(0, 6.3 * S, 0)
          : new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-4.2 * S, 0), new THREE.Vector2(4.2 * S, 0), new THREE.Vector2(0, 2.9 * S)]), { depth: 11.6 * S, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-5.8 * S, 6.1 * S, 0);
        const ground = new THREE.BoxGeometry(26, 0.6, 26).translate(0, 0.3, 0);
        g.add(new THREE.Mesh(walls, wall), new THREE.Mesh(roofG, roof), new THREE.Mesh(ground, pad));
        g.position.set(x, y, z);
        owned.push(walls, roofG, ground, wall, roof, pad);
        return g;
      };

      view.current = {
        show(d, mineNow, othersNow, styleId) {
          free();
          const g = new THREE.Group();
          city = g;
          // The ground, shaped by the city's terrain and wearing its picture.
          const n = d.grid;
          const groundG = new THREE.PlaneGeometry(d.size, d.size, n - 1, n - 1).rotateX(-Math.PI / 2);
          const pos = groundG.getAttribute("position");
          for (let i = 0; i < pos.count; i += 1) pos.setY(i, d.heights[i] ?? 0);
          groundG.computeVertexNormals();
          const tex = new THREE.TextureLoader().load(`/world/${d.id}/ground.jpg`, wake);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          const groundM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
          g.add(new THREE.Mesh(groundG, groundM));
          // Land beyond the square, so the city does not end at a cliff.
          const skirtG = new THREE.RingGeometry(d.size * 0.71, d.size * 2.2, 64).rotateX(-Math.PI / 2);
          const skirtM = new THREE.MeshStandardMaterial({ color: "#8a907c", roughness: 1 });
          const skirt = new THREE.Mesh(skirtG, skirtM);
          skirt.position.y = -0.5;
          g.add(skirt);
          const edgeG = new THREE.PlaneGeometry(d.size * 4.4, d.size * 4.4).rotateX(-Math.PI / 2);
          const edge = new THREE.Mesh(edgeG, skirtM);
          edge.position.y = -0.6;
          owned.push(groundG, tex, groundM, skirtG, skirtM, edgeG);
          // Every building, merged a few hundred at a time between frames.
          const wallsM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
          owned.push(wallsM);
          let at = 0;
          const tone = new THREE.Color();
          const chunk = () => {
            if (disposed || city !== g) return;
            const posA: number[] = [];
            const colA: number[] = [];
            const end = Math.min(d.buildings.length, at + 150);
            for (; at < end; at += 1) {
              const b = d.buildings[at];
              const h = Math.abs(b[0]);
              const taper = b[0] < 0;
              const ring: [number, number][] = [];
              for (let i = 1; i + 1 < b.length; i += 2) ring.push([b[i], b[i + 1]]);
              if (ring.length < 3) continue;
              let cx = 0;
              let cz = 0;
              for (const [x, z] of ring) {
                cx += x;
                cz += z;
              }
              cx /= ring.length;
              cz /= ring.length;
              const base = Math.min(...ring.map(([x, z]) => heightAt(d, x, z))) - 0.5;
              const top = base + 0.5 + h;
              if (taper) {
                // A tower narrows the way the Eiffel Tower does: quickly at first, then a long thin spire. Dark iron.
                const steps = 12;
                const at2 = (t: number) => 0.025 + 0.975 * Math.pow(1 - t, 2.6);
                for (let si = 0; si < steps; si += 1) {
                  const t0 = si / steps;
                  const t1 = (si + 1) / steps;
                  const k0 = at2(t0);
                  const k1 = at2(t1);
                  const y0 = base + (h + 0.5) * t0;
                  const y1 = base + (h + 0.5) * t1;
                  for (let i = 0; i < ring.length; i += 1) {
                    const [x0, z0] = ring[i];
                    const [x1, z1] = ring[(i + 1) % ring.length];
                    const p = (x: number, z: number, k: number, y: number) => [cx + (x - cx) * k, y, cz + (z - cz) * k];
                    posA.push(...p(x0, z0, k0, y0), ...p(x1, z1, k0, y0), ...p(x1, z1, k1, y1), ...p(x0, z0, k0, y0), ...p(x1, z1, k1, y1), ...p(x0, z0, k1, y1));
                    for (let v = 0; v < 6; v += 1) colA.push(0.36, 0.3, 0.26);
                  }
                }
                continue;
              }
              const k = 1;
              const tx = (x: number) => cx + (x - cx) * k;
              const tz = (z: number) => cz + (z - cz) * k;
              // Each building its own shade of stone, taller ones a little cooler.
              const r0 = ((at * 2654435761) >>> 0) / 4294967296;
              tone.setHSL(0.08 + r0 * 0.06 - Math.min(0.05, h / 3000), 0.12 + r0 * 0.1, 0.72 + r0 * 0.12 - Math.min(0.12, h / 900));
              const roofTone = tone.clone().multiplyScalar(0.78);
              for (let i = 0; i < ring.length; i += 1) {
                const [x0, z0] = ring[i];
                const [x1, z1] = ring[(i + 1) % ring.length];
                posA.push(x0, base, z0, x1, base, z1, tx(x1), top, tz(z1), x0, base, z0, tx(x1), top, tz(z1), tx(x0), top, tz(z0));
                for (let v = 0; v < 6; v += 1) colA.push(tone.r, tone.g, tone.b);
              }
              const contour = ring.map(([x, z]) => new THREE.Vector2(tx(x), tz(z)));
              const tris = THREE.ShapeUtils.triangulateShape(contour, []);
              for (const [a, b2, c] of tris) {
                posA.push(contour[a].x, top, contour[a].y, contour[b2].x, top, contour[b2].y, contour[c].x, top, contour[c].y);
                for (let v = 0; v < 3; v += 1) colA.push(roofTone.r, roofTone.g, roofTone.b);
              }
            }
            if (posA.length) {
              const geo = new THREE.BufferGeometry();
              geo.setAttribute("position", new THREE.Float32BufferAttribute(posA, 3));
              geo.setAttribute("color", new THREE.Float32BufferAttribute(colA, 3));
              geo.computeVertexNormals();
              owned.push(geo);
              const mesh = new THREE.Mesh(geo, wallsM);
              mesh.material.side = THREE.DoubleSide;
              g.add(mesh);
              wake();
            }
            if (at < d.buildings.length) (window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 16)))(chunk);
          };
          chunk();
          // The plots: yours with your house, others' with theirs, the rest for sale.
          const padOpen = new THREE.MeshBasicMaterial({ color: "#f2c230", transparent: true, opacity: 0.7, depthWrite: false });
          const padG = new THREE.CylinderGeometry(13, 13, 1.2, 40);
          const postG = new THREE.CylinderGeometry(0.6, 0.6, 22, 8).translate(0, 11, 0);
          const flagG = new THREE.BoxGeometry(9, 5, 0.4).translate(4.5, 19.5, 0);
          const flagM = new THREE.MeshStandardMaterial({ color: "#f2c230", emissive: "#6b4f00", roughness: 0.6 });
          owned.push(padOpen, padG, postG, flagG, flagM);
          for (const p of d.plots) {
            const y = heightAt(d, p.x, p.z);
            const who = othersNow.find((o) => o.plot === p.id);
            let obj: InstanceType<typeof THREE.Object3D>;
            if (mineNow.has(p.id)) obj = house(styleId, p.x, y, p.z, "#3f8f5a");
            else if (who) obj = house(who.styleId, p.x, y, p.z, "#5b7fb0");
            else {
              const s = new THREE.Group();
              s.add(new THREE.Mesh(padG, padOpen), new THREE.Mesh(postG, flagM), new THREE.Mesh(flagG, flagM));
              s.position.set(p.x, y + 0.6, p.z);
              obj = s;
            }
            obj.traverse((o) => (o.userData.plot = p.id));
            g.add(obj);
            obj.traverse((o) => {
              if ((o as InstanceType<typeof THREE.Mesh>).isMesh) pads.push(o as InstanceType<typeof THREE.Mesh>);
            });
          }
          // Shaders compile in the background first, so opening a city never freezes the page.
          g.visible = false;
          scene.add(g);
          controls.target.set(0, 0, 0);
          const reveal = () => {
            if (city !== g || g.visible) return;
            g.visible = true;
            setShown(d.id);
            wake();
          };
          void compileQuietly(renderer, g, camera, scene).then(reveal);
          window.setTimeout(reveal, 6000);
        },
        dispose() {
          free();
          facade.dispose();
          ro.disconnect();
          controls.dispose();
          renderer.dispose();
          if (frame) cancelAnimationFrame(frame);
        },
      };
      // A tap (not a drag) on a plot opens its card.
      const ray = new THREE.Raycaster();
      let down: { x: number; y: number } | null = null;
      canvas.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
      canvas.addEventListener("pointerup", (e) => {
        if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
        const r = canvas.getBoundingClientRect();
        ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const hit = ray.intersectObjects(pads, false)[0];
        pickRef.current((hit?.object.userData.plot as string) ?? null);
      });
      setReady((n) => n + 1);
    })();
    return () => {
      disposed = true;
      view.current?.dispose();
      view.current = null;
    };
  }, []);

  const [ready, setReady] = useState(0);
  const mineKey = [...mine].join(",");
  const othersKey = others.map((o) => `${o.plot}:${o.styleId}`).join(",");
  useEffect(() => {
    if (data && view.current) view.current.show(data, new Set(mineKey ? mineKey.split(",") : []), others, progress.houseStyleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready, mineKey, othersKey, progress.houseStyleId]);

  const balance = spendable(progress);
  const buy = () => {
    if (!pick) return;
    const res = buyCityPlot(cityId, pick.plot);
    showMessage(res.ok, res.message);
    if (res.ok) {
      onUpdate();
      setPick({ plot: pick.plot, owner: "you" });
    }
  };
  const plotNumber = pick ? Number(pick.plot.slice(1)) : 0;

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="city-title" className="animate-modal-in flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-[88vh] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <p className="eyebrow">Real cities</p>
            <h2 id="city-title" className="mt-0.5 text-lg font-semibold text-slate-900">
              {city.name}: {city.place}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">Every building at its real size and place. Tap a gold flag to buy that plot; your house goes up on it.</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div role="tablist" aria-label="Cities" className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-5 py-2">
          {CITIES.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === cityId} onClick={() => setCityId(c.id)} className={`btn-sm shrink-0 ${c.id === cityId ? "btn-primary" : "btn-secondary"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="relative min-h-0 flex-1 bg-[#cfdde8]">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label={`${city.name} in 3D. Drag to turn, scroll or pinch to zoom, tap a plot.`} />
          {shown !== cityId && !failed && <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white/95 px-3 py-1.5 text-sm text-slate-700 shadow-sm">Loading {city.name}</p>}
          {failed && <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm text-slate-700">This browser cannot draw the city in 3D.</p>}
          {pick && (
            <div className="absolute bottom-3 left-3 right-3 max-w-sm rounded-2xl bg-white/97 p-4 shadow-lg ring-1 ring-slate-200 sm:right-auto">
              <p className="text-sm font-semibold text-slate-900">
                Plot {plotNumber} in {city.name}
              </p>
              {pick.owner === "you" ? (
                <p className="mt-1 text-sm text-slate-600">Yours. Your house stands here.</p>
              ) : pick.owner === "open" ? (
                <>
                  <p className="mt-1 text-sm text-slate-600">
                    For sale: {city.price} Bridgeys. You have {balance === Infinity ? "unlimited" : balance}.
                  </p>
                  <button type="button" onClick={buy} className="btn-primary btn-sm mt-3">
                    <Icon name="house" size={15} />
                    Buy this plot
                  </button>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">{pick.owner.name}&apos;s house stands here.</p>
              )}
            </div>
          )}
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-[11px] leading-snug text-slate-500">
          Imagery: Sentinel-2 cloudless 2016 by EOX (contains modified Copernicus Sentinel data). Buildings, streets and water: © OpenStreetMap contributors. Terrain: Terrain Tiles on AWS.
        </p>
      </div>
    </div>
  );
}
