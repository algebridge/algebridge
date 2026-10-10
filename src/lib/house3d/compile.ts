import type * as THREE from "three";
import { WebGLRenderTarget } from "three";

/** A tiny render target per renderer: compiling with it bound gives the shader variant a frame at rest is drawn with (see compileQuietly). */
const scratch = new WeakMap<THREE.WebGLRenderer, WebGLRenderTarget>();

/**
 * Compiles a scene's shaders without stalling the page, and resolves when
 * they are ready to draw.
 *
 * On a first visit the graphics card compiles every shader from scratch,
 * which takes it seconds, and a frame drawn before a shader is linked waits
 * on the card for the rest of the link: a freeze. Where the card links in
 * parallel (every current browser) it is asked, one program at a time and a
 * few times a second, whether the link is done, and the frame is drawn only
 * then. Asking about every program every few milliseconds, as three.js's
 * compileAsync does, made the page wait on the card for the answers; this
 * asks little. Without that extension a fence is dropped behind the
 * shaders and the page waits for the card to reach it.
 *
 * Safe for a scene that changes meanwhile (a piece rebuilt while it
 * compiles). Given `within`, the object is compiled as it will be lit in
 * that scene without being in it yet (a neighbour's lot, or a room built
 * ahead, before it is shown).
 */
export async function compileQuietly(renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, within?: THREE.Scene): Promise<void> {
  const materials = new Set<THREE.Material>();
  try {
    // `within`: something about to join that scene compiles with its lights, fog and sky, before it is added.
    const gather = (set: unknown) => {
      if (set instanceof Set) for (const m of set) materials.add(m as THREE.Material);
    };
    // Every material is drawn two ways, each its own shader: straight onto
    // the canvas (a moving frame) and into the finish's buffer (a frame at
    // rest: linear colour, no tone mapping). Both compile here, or the
    // first frame at rest would wait on the second.
    gather(renderer.compile(scene, camera, within));
    let target = scratch.get(renderer);
    if (!target) {
      target = new WebGLRenderTarget(4, 4);
      scratch.set(renderer, target);
    }
    const was = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    try {
      gather(renderer.compile(scene, camera, within));
    } finally {
      renderer.setRenderTarget(was);
    }
  } catch {
    return;
  }
  const gl = renderer.getContext();
  if (renderer.extensions.has("KHR_parallel_shader_compile") && materials.size) {
    // The card links shaders on its own threads and can be asked, without
    // waiting, whether one is done. Asked one program at a time and a few
    // times a second, so the asking itself is never the stall; the first
    // frame is drawn only once every program is linked, so it never waits
    // on the card either (a draw with an unfinished shader does).
    const props = (renderer as unknown as { properties: { get(m: THREE.Material): { programs?: Map<string, { isReady(): boolean }> } } }).properties;
    const pending: { isReady(): boolean }[] = [];
    for (const m of materials) for (const program of props.get(m)?.programs?.values() ?? []) pending.push(program);
    const started = performance.now();
    while (pending.length && performance.now() - started < 15000 && !gl.isContextLost()) {
      if (pending[pending.length - 1].isReady()) pending.pop();
      else await new Promise((r) => setTimeout(r, 80));
    }
    return;
  }
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
