import type * as THREE from "three";

/**
 * Compiles a scene's shaders without stalling the page, and resolves when
 * they are ready to draw.
 *
 * On a first visit the graphics card compiles every shader from scratch,
 * which takes it seconds. Asking whether a shader is done (three.js's
 * compileAsync asks over and over) makes the page wait for the answer while
 * the card is busy: that was the freeze. Here the shaders are handed over all
 * at once and a fence is dropped behind them; a fence can always be asked
 * about without waiting, so the page keeps running until the card has worked
 * through them, and only then is anything drawn.
 *
 * Safe for a scene that changes meanwhile (a piece rebuilt while it
 * compiles), which three.js's own version trips over.
 */
export async function compileQuietly(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera): Promise<void> {
  try {
    renderer.compile(scene, camera);
  } catch {
    return;
  }
  const gl = renderer.getContext();
  if (!("fenceSync" in gl)) {
    // WebGL 1: no fences; give the card a moment and draw.
    await new Promise((r) => setTimeout(r, 120));
    return;
  }
  const gl2 = gl as WebGL2RenderingContext;
  const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
  if (!sync) return;
  gl2.flush();
  await new Promise<void>((resolve) => {
    let waited = 0;
    const check = () => {
      // Never blocks: the status is updated between tasks.
      const done = gl2.getSyncParameter(sync, gl2.SYNC_STATUS) === gl2.SIGNALED;
      if (done || waited > 15000 || gl2.isContextLost()) {
        gl2.deleteSync(sync);
        resolve();
        return;
      }
      waited += 50;
      setTimeout(check, 50);
    };
    setTimeout(check, 50);
  });
}
