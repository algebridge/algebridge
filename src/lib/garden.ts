/**
 * The garden behind the house: it grows as the student learns.
 *
 * There is a bed for every unit of the course. A bed's plant comes up by
 * how much of its unit is finished: bare soil, a sprout, leaves, a bud, and
 * a flower in the unit's own colour once every skill in it is done. A tree
 * grows with the whole course, and a treehouse goes up in it when the course
 * is complete. Practising today waters the garden.
 */

import { units } from "@/data/curriculum";
import { unitHue, type Hue } from "@/lib/hues";
import type { UserProgress } from "@/types";

export const PLANT_STAGES = ["seed", "sprout", "leaf", "bud", "bloom"] as const;
export type PlantStage = (typeof PLANT_STAGES)[number];

export const FLOWERS = ["daisy", "tulip", "poppy", "sunflower", "bell", "lavender", "rose"] as const;
export type Flower = (typeof FLOWERS)[number];

export interface GardenBed {
  unitId: string;
  number: number;
  title: string;
  hue: Hue;
  flower: Flower;
  done: number;
  total: number;
  stage: PlantStage;
}

/** How far the tree has come: 0 is a sapling, 5 a full crown. */
export type TreeStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface GardenState {
  beds: GardenBed[];
  /** Skills finished, out of all of them. */
  done: number;
  total: number;
  fraction: number;
  /** Beds in flower. */
  blooms: number;
  tree: TreeStage;
  /** A tire swing from the tree, from halfway through the course. */
  swing: boolean;
  /** A birdhouse on the trunk, from three quarters. */
  birdhouse: boolean;
  /** The treehouse, for a finished course. */
  treehouse: boolean;
  /** Something answered right today. */
  watered: boolean;
}

/** What a bed shows for `done` of `total` skills finished. */
export function plantStage(done: number, total: number): PlantStage {
  if (total <= 0 || done <= 0) return "seed";
  if (done >= total) return "bloom";
  const f = done / total;
  if (f < 1 / 3) return "sprout";
  if (f < 2 / 3) return "leaf";
  return "bud";
}

/** How the tree stands for a fraction of the course finished. */
export function treeStage(fraction: number): TreeStage {
  if (fraction <= 0) return 0;
  if (fraction < 0.2) return 1;
  if (fraction < 0.4) return 2;
  if (fraction < 0.6) return 3;
  if (fraction < 0.8) return 4;
  return 5;
}

/** Which flower a unit grows: seven kinds, taken in turn. */
export function flowerFor(unitNumber: number): Flower {
  return FLOWERS[(unitNumber - 1) % FLOWERS.length];
}

function finished(progress: UserProgress, skillId: string): boolean {
  const level = progress.skills[skillId]?.level;
  return level === "proficient" || level === "mastered";
}

/** The whole garden, read from a student's progress. `day` is today, for the watering. */
export function gardenState(progress: UserProgress, day?: string): GardenState {
  const beds = units.map((u): GardenBed => {
    const done = u.skills.filter((s) => finished(progress, s.id)).length;
    return {
      unitId: u.id,
      number: u.number,
      title: u.title,
      hue: unitHue(u.id),
      flower: flowerFor(u.number),
      done,
      total: u.skills.length,
      stage: plantStage(done, u.skills.length),
    };
  });
  const done = beds.reduce((n, b) => n + b.done, 0);
  const total = beds.reduce((n, b) => n + b.total, 0);
  const fraction = total ? done / total : 0;
  return {
    beds,
    done,
    total,
    fraction,
    blooms: beds.filter((b) => b.stage === "bloom").length,
    tree: treeStage(fraction),
    swing: fraction >= 0.5,
    birdhouse: fraction >= 0.75,
    treehouse: total > 0 && done >= total,
    watered: !!day && progress.daily?.day === day && (progress.daily?.right ?? 0) > 0,
  };
}
