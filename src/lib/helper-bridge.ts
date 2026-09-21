import type { HelperContext } from "@/lib/helper";

/**
 * How practice talks to the study helper, which lives in the layout.
 *
 * Two things cross over. The problem on screen, so the helper knows what the
 * student is stuck on and the answer filter knows what it must never say:
 * before this the helper always sent an empty context, so it started blind
 * and had nothing to filter against. And a request to open, which is how the
 * "talk to the AI" nudge after a few misses opens the panel on the problem.
 */

let context: HelperContext | null = null;
let openRequests = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function setHelperContext(next: HelperContext | null): void {
  context = next;
  notify();
}

export function getHelperContext(): HelperContext | null {
  return context;
}

/** Ask the helper to open on the current problem. */
export function requestHelperOpen(): void {
  openRequests += 1;
  notify();
}

export function getHelperOpenRequests(): number {
  return openRequests;
}

export function getServerHelperOpenRequests(): number {
  return 0;
}

export function subscribeHelperBridge(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
