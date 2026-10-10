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
 * Drawn only while on screen.
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
      scene.environmentIntensity = 0.7;
      pmrem.dispose();
      const key = new THREE.DirectionalLight("#fff4e6", 2.4);
      key.position.set(-2.5, 5, 3.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.radius = 5;
      key.shadow.bias = -0.0005;
      scene.add(key, key.target, new THREE.HemisphereLight("#ffffff", "#c9c2b8", 0.55));
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.ShadowMaterial({ opacity: 0.2 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
      camera.position.set(0, 1.25, 4.9);
      camera.lookAt(0, 0.88, 0);
      const holder = new THREE.Group();
      scene.add(holder);
      const kit = makeKit();
      let current = "";
      const setSpec = (s: AvatarSpec) => {
        const k = avatarKey(s);
        if (k === current) return;
        current = k;
        holder.clear();
        const fig = buildFigure(kit, s);
        poseFigure(fig, "stand");
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
      let frame = 0;
      let last = performance.now();
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (document.hidden) return;
        holder.rotation.y += dt * 0.7;
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(tick);
      setSpec(pending.current);
      stage.current = {
        setSpec,
        dispose() {
          cancelAnimationFrame(frame);
          ro.disconnect();
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

  return <canvas ref={canvasRef} aria-hidden className={`block ${className}`} />;
}
