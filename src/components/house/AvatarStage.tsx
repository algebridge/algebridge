"use client";

import { useEffect, useRef } from "react";
import { avatarKey } from "@/lib/avatar";
import type { AvatarSpec } from "@/types";

interface Stage {
  setSpec(spec: AvatarSpec): void;
  dispose(): void;
}

/**
 * A character on a little turntable: the same figure the porch shows, in
 * the same light, turning slowly so every side of a choice can be seen.
 * Drag it to turn it yourself; it carries on by itself a moment after you
 * let go. Drawn only while on screen.
 */
export function AvatarStage({ spec, className = "" }: { spec: AvatarSpec; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const pending = useRef<AvatarSpec>(spec);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { makeKit } = await import("@/lib/house3d/kit");
      const { buildFigure, poseFigure } = await import("@/lib/house3d/figure");
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.debug.checkShaderErrors = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = env.texture;
      scene.environmentIntensity = 0.65;
      pmrem.dispose();
      // A warm key from the front left, a cool rim from behind, and the room's bounce.
      const key = new THREE.DirectionalLight("#fff4e6", 2.3);
      key.position.set(-2.5, 5, 3.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.radius = 5;
      key.shadow.bias = -0.0005;
      const rim = new THREE.DirectionalLight("#dbe8ff", 1.1);
      rim.position.set(2.5, 3.5, -3);
      scene.add(key, key.target, rim, new THREE.HemisphereLight("#ffffff", "#c9c2b8", 0.5));
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.18 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
      camera.position.set(0, 1.2, 4.9);
      camera.lookAt(0, 0.86, 0);
      const holder = new THREE.Group();
      holder.rotation.y = 0.35;
      scene.add(holder);
      const kit = makeKit();
      let current = "";
      let t = 0;
      const setSpec = (s: AvatarSpec) => {
        const k = avatarKey(s);
        if (k === current) return;
        current = k;
        holder.clear();
        const fig = buildFigure(kit, s);
        poseFigure(fig, "stand", 0, t);
        holder.add(fig.root);
      };
      const fit = () => {
        const r = canvas.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        renderer.setSize(r.width, r.height, false);
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(canvas);
      // Dragging turns the figure; the turntable takes over again a moment later.
      let dragging = false;
      let lastX = 0;
      let heldUntil = 0;
      const down = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        canvas.setPointerCapture(e.pointerId);
      };
      const move = (e: PointerEvent) => {
        if (!dragging) return;
        holder.rotation.y += (e.clientX - lastX) * 0.012;
        lastX = e.clientX;
        heldUntil = performance.now() + 2500;
      };
      const up = () => {
        dragging = false;
      };
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      let frame = 0;
      let last = performance.now();
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (document.hidden) return;
        t += dt;
        if (!dragging && now > heldUntil) holder.rotation.y += dt * 0.6;
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(tick);
      setSpec(pending.current);
      stage.current = {
        setSpec,
        dispose() {
          cancelAnimationFrame(frame);
          ro.disconnect();
          canvas.removeEventListener("pointerdown", down);
          canvas.removeEventListener("pointermove", move);
          canvas.removeEventListener("pointerup", up);
          canvas.removeEventListener("pointercancel", up);
          kit.dispose();
          env.dispose();
          renderer.dispose();
        },
      };
    })();
    return () => {
      disposed = true;
      stage.current?.dispose();
      stage.current = null;
    };
  }, []);

  useEffect(() => {
    pending.current = spec;
    stage.current?.setSpec(spec);
  }, [spec]);

  return <canvas ref={canvasRef} aria-hidden className={`block cursor-grab touch-none active:cursor-grabbing ${className}`} />;
}
