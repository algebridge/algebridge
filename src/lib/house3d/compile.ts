import type * as THREE from "three";

/**
 * Compiles a scene's shaders without stalling the page, and resolves when
 * they are ready to draw. It is three.js's compileAsync, made safe for a
 * scene that changes meanwhile: a piece rebuilt while its shaders compile
 * takes its old material away, which three.js's own version trips over.
 */
export function compileQuietly(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera): Promise<void> {
  let materials: Set<THREE.Material>;
  try {
    materials = renderer.compile(scene, camera) as Set<THREE.Material>;
  } catch {
    return Promise.resolve();
  }
  const parallel = renderer.extensions.get("KHR_parallel_shader_compile") !== null;
  return new Promise((resolve) => {
    const check = () => {
      for (const m of materials) {
        const program = (renderer.properties.get(m) as { currentProgram?: { isReady(): boolean } }).currentProgram;
        if (!program || program.isReady()) materials.delete(m);
      }
      if (materials.size === 0) resolve();
      else setTimeout(check, 16);
    };
    if (parallel) check();
    else setTimeout(check, 16);
  });
}
