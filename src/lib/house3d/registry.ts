/**
 * Every piece's model, by catalog id. Models live in items/*.ts in groups;
 * this joins them. A test holds that every furniture id in the catalog has
 * one, so the crate below is only ever seen while a piece is being built.
 */

import { CORE_ITEMS } from "./items/core";
import { ROOM_ITEMS } from "./items/room";
import { FUN_ITEMS } from "./items/fun";
import { STUDIO_ITEMS } from "./items/studio";
import { GRAND_ITEMS } from "./items/grand";
import { PRIZE_ITEMS } from "./items/prizes";
import { ORNAMENT_MODELS } from "./garden";
import type { ItemModel } from "./types";

export const MODELS: Record<string, ItemModel> = {
  ...ROOM_ITEMS,
  ...FUN_ITEMS,
  ...STUDIO_ITEMS,
  ...GRAND_ITEMS,
  ...PRIZE_ITEMS,
  ...CORE_ITEMS,
};

/** A plain wooden crate, for an id with no model yet. */
const CRATE: ItemModel = {
  size: [0.5, 0.45, 0.5],
  build(k) {
    const wood = k.wood("pine", { gloss: 0.2 });
    const g = k.group([k.box(0.5, 0.45, 0.5, wood, { at: [0, 0.225, 0], r: 0.01 })]);
    for (const y of [0.08, 0.225, 0.37]) g.add(k.box(0.51, 0.06, 0.51, k.wood("walnut", { gloss: 0.2 }), { at: [0, y, 0], r: 0.006 }));
    return g;
  },
};

export function modelFor(id: string): ItemModel {
  return MODELS[id] ?? CRATE;
}

export function hasModel(id: string): boolean {
  return id in MODELS;
}

/** A garden ornament's model, by catalog id. */
export function ornamentModelFor(id: string): ItemModel {
  return ORNAMENT_MODELS[id] ?? CRATE;
}

export function hasOrnamentModel(id: string): boolean {
  return id in ORNAMENT_MODELS;
}
