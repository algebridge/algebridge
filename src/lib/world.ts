/**
 * Plots in real cities, bought with Bridgeys: which cities there are, what
 * a plot costs, a student's plots checked against them, and the ground's
 * height at a spot. Pure, so it is tested; the city itself (its terrain,
 * imagery and buildings) is baked by scripts/world-cities.mjs and drawn by
 * components/house/CitySheet.tsx.
 *
 * The cities are famous places, chosen from this list: a plot says where a
 * student's house stands in the game, never where the student lives.
 */
import { CITIES as LIST, CITY_SIZE } from "@/data/world-cities.mjs";

export interface City {
  id: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
  price: number;
}

export const CITIES: City[] = LIST;
export { CITY_SIZE };

/** A plot a student owns: the city and the plot's id there. */
export interface CityPlot {
  city: string;
  plot: string;
}

/** What a baked city holds (public/world/<id>/data.json). */
export interface CityData {
  id: string;
  size: number;
  grid: number;
  heights: number[];
  /** [height (negative for a tower that narrows), x0, z0, x1, z1, ...], metres from the landmark, z to the south. */
  buildings: number[][];
  plots: { id: string; x: number; z: number }[];
}

export const MAX_PLOTS = 24;
const PLOT_ID = /^p\d{2}$/;

export function cityById(id: string): City | undefined {
  return CITIES.find((c) => c.id === id);
}

/** Plots read from a save or from another student's row: known cities, well-formed ids, each once, a limited number. */
export function sanitizePlots(raw: unknown): CityPlot[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CityPlot[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const { city, plot } = p as Record<string, unknown>;
    if (typeof city !== "string" || typeof plot !== "string" || !cityById(city) || !PLOT_ID.test(plot)) continue;
    const key = `${city}/${plot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ city, plot });
    if (out.length >= MAX_PLOTS) break;
  }
  return out;
}

/** The ground's height at a spot, from the baked grid (bilinear). */
export function heightAt(d: Pick<CityData, "size" | "grid" | "heights">, x: number, z: number): number {
  const n = d.grid;
  const fx = Math.min(n - 1.0001, Math.max(0, ((x + d.size / 2) / d.size) * (n - 1)));
  const fz = Math.min(n - 1.0001, Math.max(0, ((z + d.size / 2) / d.size) * (n - 1)));
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const tx = fx - ix;
  const tz = fz - iz;
  const h = (i: number, j: number) => d.heights[j * n + i] ?? 0;
  return (h(ix, iz) * (1 - tx) + h(ix + 1, iz) * tx) * (1 - tz) + (h(ix, iz + 1) * (1 - tx) + h(ix + 1, iz + 1) * tx) * tz;
}
