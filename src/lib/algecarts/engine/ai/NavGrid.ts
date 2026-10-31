import type { Arena } from "../world/Arena";
import { STEP } from "../world/Arena";

/**
 * A coarse grid over the arena for bot routes. Each cell knows the height of
 * whatever a kart would stand on there and whether a kart fits. Moving to a
 * neighbour is allowed when it is open and at most a step higher (so ramps
 * are the way up) or any amount lower (dropping off a ledge is fine). A* over
 * it gives a path that goes round pillars and up the right ramp.
 */
export class NavGrid {
  readonly cell = 1.5;
  readonly n: number;
  readonly origin: number;
  readonly h: Float32Array;
  readonly open: Uint8Array;
  private readonly gScore: Float32Array;
  private readonly from: Int32Array;
  private readonly closed: Uint8Array;
  private readonly heap: number[] = [];
  private readonly fScore: Float32Array;

  constructor(arena: Arena) {
    const half = arena.half;
    this.n = Math.ceil((half * 2) / this.cell);
    this.origin = -half;
    const n2 = this.n * this.n;
    this.h = new Float32Array(n2);
    this.open = new Uint8Array(n2);
    this.gScore = new Float32Array(n2);
    this.fScore = new Float32Array(n2);
    this.from = new Int32Array(n2);
    this.closed = new Uint8Array(n2);
    const r = 0.95;
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const idx = j * this.n + i;
        const x = this.origin + (i + 0.5) * this.cell;
        const z = this.origin + (j + 0.5) * this.cell;
        const top = arena.topAt(x, z);
        this.h[idx] = top;
        let ok = Math.abs(x) < half - 1.1 && Math.abs(z) < half - 1.1;
        if (ok) {
          ok =
            !arena.blockedAt(x + r, z, top) &&
            !arena.blockedAt(x - r, z, top) &&
            !arena.blockedAt(x, z + r, top) &&
            !arena.blockedAt(x, z - r, top) &&
            !arena.blockedAt(x, z, top);
        }
        this.open[idx] = ok ? 1 : 0;
      }
    }
  }

  cellOf(x: number, z: number): number {
    const i = Math.max(0, Math.min(this.n - 1, Math.floor((x - this.origin) / this.cell)));
    const j = Math.max(0, Math.min(this.n - 1, Math.floor((z - this.origin) / this.cell)));
    return j * this.n + i;
  }

  center(idx: number): { x: number; z: number } {
    const i = idx % this.n;
    const j = Math.floor(idx / this.n);
    return { x: this.origin + (i + 0.5) * this.cell, z: this.origin + (j + 0.5) * this.cell };
  }

  /** The nearest open cell to a point, searching a small ring outward. */
  nearestOpen(x: number, z: number): number {
    const start = this.cellOf(x, z);
    if (this.open[start]) return start;
    const si = start % this.n;
    const sj = Math.floor(start / this.n);
    for (let ring = 1; ring <= 4; ring++) {
      let best = -1;
      let bd = Infinity;
      for (let dj = -ring; dj <= ring; dj++) {
        for (let di = -ring; di <= ring; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
          const i = si + di;
          const j = sj + dj;
          if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
          const idx = j * this.n + i;
          if (!this.open[idx]) continue;
          const d = di * di + dj * dj;
          if (d < bd) {
            bd = d;
            best = idx;
          }
        }
      }
      if (best >= 0) return best;
    }
    return start;
  }

  private canStep(a: number, b: number): boolean {
    return this.open[b] === 1 && this.h[b] - this.h[a] <= STEP + 0.05;
  }

  /** A* from one point to another. Returns cell centres, start excluded, or null. */
  findPath(x0: number, z0: number, x1: number, z1: number, maxExpand = 6000): { x: number; z: number }[] | null {
    const n = this.n;
    const start = this.nearestOpen(x0, z0);
    const goal = this.nearestOpen(x1, z1);
    if (start === goal) return [];
    const gi = goal % n;
    const gj = Math.floor(goal / n);
    this.closed.fill(0);
    this.gScore.fill(Infinity);
    this.heap.length = 0;
    this.gScore[start] = 0;
    this.fScore[start] = this.heur(start, gi, gj);
    this.push(start);
    let expanded = 0;
    while (this.heap.length && expanded++ < maxExpand) {
      const cur = this.pop();
      if (cur === goal) return this.rebuild(start, goal);
      if (this.closed[cur]) continue;
      this.closed[cur] = 1;
      const ci = cur % n;
      const cj = Math.floor(cur / n);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= n || j >= n) continue;
          const nb = j * n + i;
          if (this.closed[nb] || !this.canStep(cur, nb)) continue;
          // No cutting corners past a blocked cell.
          if (di !== 0 && dj !== 0 && (!this.canStep(cur, cj * n + i) || !this.canStep(cur, j * n + ci))) continue;
          const drop = this.h[cur] - this.h[nb];
          const cost = (di !== 0 && dj !== 0 ? 1.4142 : 1) + (drop > STEP ? 0.6 : 0);
          const g = this.gScore[cur] + cost;
          if (g < this.gScore[nb]) {
            this.gScore[nb] = g;
            this.from[nb] = cur;
            this.fScore[nb] = g + this.heur(nb, gi, gj);
            this.push(nb);
          }
        }
      }
    }
    return null;
  }

  private heur(idx: number, gi: number, gj: number): number {
    const i = idx % this.n;
    const j = Math.floor(idx / this.n);
    const dx = Math.abs(i - gi);
    const dz = Math.abs(j - gj);
    return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
  }

  private rebuild(start: number, goal: number): { x: number; z: number }[] {
    const out: { x: number; z: number }[] = [];
    let cur = goal;
    let guard = 0;
    while (cur !== start && guard++ < 10000) {
      out.push(this.center(cur));
      cur = this.from[cur];
    }
    out.reverse();
    return out;
  }

  // A small binary heap on fScore.
  private push(idx: number): void {
    const h = this.heap;
    h.push(idx);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.fScore[h[p]] <= this.fScore[h[i]]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }

  private pop(): number {
    const h = this.heap;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && this.fScore[h[l]] < this.fScore[h[m]]) m = l;
        if (r < h.length && this.fScore[h[r]] < this.fScore[h[m]]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
}
