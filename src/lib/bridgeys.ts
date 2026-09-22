import { getOrnament, getUnplacedOrnamentIds } from "@/data/ornament-catalog";
import { clampToYard } from "@/lib/dollhouse";
import {
  getBestOwnedFurniture,
  getFurnitureItem,
  getHouseStyle,
  getUnplacedFurnitureIds,
  migrateSlotPlacements,
  STARTER_HOUSE_ID,
} from "@/data/house-catalog";
import { getDisplayTitle } from "@/data/titles-catalog";
import { getRinkItem } from "@/data/rink-catalog";
import { getRinkSlot, RINK_DAILY_CAP, rinkPayFor, rinkRemainingToday } from "@/lib/rink";
import { getUnitPrize, UNIT_PRIZES } from "@/data/house-catalog";
import { units } from "@/data/curriculum";
import { getSwatch, USABLE } from "@/data/furniture-art";
import { BRIDGEY_REWARDS, bridgeysForSkill } from "@/lib/gamification";
import { getProgress, PROGRESS_UPDATED_EVENT, saveProgress, touchActivity } from "@/lib/progress";
import type { HouseFloor, PlacedFurnitureEntry, UserProgress } from "@/types";

export type PurchaseResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

/* ── The founder's allowance ─────────────────────────────────────────
   Some accounts are charged nothing in the shop. Which ones is decided in
   the database (profiles.unlimited_bridgeys, admin-set and trigger-guarded)
   and handed to the app with the profile; it is never written into progress,
   so it cannot be copied from one save to another or switched on by editing
   local storage. The balance itself is untouched: earning still counts. */

let unlimited = false;

/** Set from the signed-in profile by AuthProvider. */
export function setUnlimitedBridgeys(on: boolean): void {
  if (unlimited === on) return;
  unlimited = on;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROGRESS_UPDATED_EVENT));
}

export function hasUnlimitedBridgeys(): boolean {
  return unlimited;
}

/** What the shop can spend: the balance, or no limit at all. */
export function spendable(progress: UserProgress): number {
  return unlimited ? Infinity : progress.bridgeys ?? 0;
}

function ensureBridgeyFields(progress: UserProgress): void {
  if (progress.bridgeys == null) progress.bridgeys = 25;
  if (progress.bridgeysLifetime == null) progress.bridgeysLifetime = progress.bridgeys;
  if (!progress.houseStyleId) progress.houseStyleId = STARTER_HOUSE_ID;
  if (!progress.ownedHouseStyles?.length) progress.ownedHouseStyles = [STARTER_HOUSE_ID];
  if (!progress.ownedFurniture) progress.ownedFurniture = [];
  if (!progress.placedFurniture) progress.placedFurniture = {};
  if (!progress.placedFurnitureItems) progress.placedFurnitureItems = [];
  if (!progress.ownedTitles) progress.ownedTitles = [];
  if (!progress.bridgeyRewardsClaimed) {
    progress.bridgeyRewardsClaimed = { complete: [] };
  }
  if (!progress.bridgeyRewardsClaimed.units) progress.bridgeyRewardsClaimed.units = [];
  if (progress.leaderboardOptIn == null) progress.leaderboardOptIn = false;
  if (!progress.ownedRinkItems) progress.ownedRinkItems = [];
  if (!progress.rinkDecor) progress.rinkDecor = {};

  if (!progress.housePlacementMigratedV2 && Object.keys(progress.placedFurniture).length > 0) {
    const migrated = migrateSlotPlacements(progress.placedFurniture);
    const existing = new Set(progress.placedFurnitureItems.map((p) => p.itemId));
    for (const entry of migrated) {
      if (!existing.has(entry.itemId)) {
        progress.placedFurnitureItems.push(entry);
      }
    }
    progress.housePlacementMigratedV2 = true;
  }
}

/** Call after loading progress to fill in Bridgey economy defaults. */
export function normalizeBridgeyProgress(progress: UserProgress): UserProgress {
  ensureBridgeyFields(progress);
  // Prizes for units finished before prizes existed, or on another device.
  // Only here, at load: during an answer the grant happens in
  // recordProblemAttempt, which needs to be the one to see it.
  for (const unit of units) {
    const done = unit.skills.every((s) => {
      const lvl = progress.skills[s.id]?.level;
      return lvl === "proficient" || lvl === "mastered";
    });
    if (done) grantUnitPrize(progress, unit.id);
  }
  return progress;
}

export function awardBridgeys(progress: UserProgress, amount: number): number {
  ensureBridgeyFields(progress);
  if (amount <= 0) return 0;
  progress.bridgeys += amount;
  progress.bridgeysLifetime = (progress.bridgeysLifetime ?? 0) + amount;
  return amount;
}

/** Bridgeys for completing a skill (once per skill); see bridgeysForSkill for how much. */
export function tryAwardSkillCompleteBridgeys(progress: UserProgress, skillId: string): number {
  ensureBridgeyFields(progress);
  const claimed = progress.bridgeyRewardsClaimed!;
  if (claimed.complete.includes(skillId)) return 0;
  claimed.complete.push(skillId);
  return awardBridgeys(progress, bridgeysForSkill(skillId));
}

/**
 * The prize for finishing a unit, into the student's furniture, once. Returns
 * the prize's id when it was just granted, so the moment can be celebrated.
 */
export function grantUnitPrize(progress: UserProgress, unitId: string): string | null {
  const prize = getUnitPrize(unitId);
  if (!prize) return null;
  if (!progress.ownedFurniture) progress.ownedFurniture = [];
  if (progress.ownedFurniture.includes(prize.id)) return null;
  progress.ownedFurniture.push(prize.id);
  return prize.id;
}

/** Bridgeys for finishing every skill in a unit, once per unit. */
export function tryAwardUnitCompleteBridgeys(progress: UserProgress, unitId: string): number {
  ensureBridgeyFields(progress);
  const claimed = progress.bridgeyRewardsClaimed!;
  if (claimed.units!.includes(unitId)) return 0;
  claimed.units!.push(unitId);
  return awardBridgeys(progress, BRIDGEY_REWARDS.unitComplete);
}

/** Every unit prize, with whether this student has earned it. */
export function unitPrizeStatus(progress: UserProgress): { prize: (typeof UNIT_PRIZES)[number]; earned: boolean }[] {
  return UNIT_PRIZES.map((prize) => ({ prize, earned: (progress.ownedFurniture ?? []).includes(prize.id) }));
}

function spendBridgeys(progress: UserProgress, price: number): PurchaseResult | null {
  ensureBridgeyFields(progress);
  if (unlimited) return null;
  if (price > progress.bridgeys) {
    return {
      ok: false,
      message: `You need ${price} Bridgeys but only have ${progress.bridgeys}. Keep learning to earn more!`,
    };
  }
  progress.bridgeys -= price;
  return null;
}

export function buyHouseStyle(styleId: string): PurchaseResult {
  const style = getHouseStyle(styleId);
  if (!style) return { ok: false, message: "That house style doesn't exist." };

  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (progress.ownedHouseStyles.includes(styleId)) {
    progress.houseStyleId = styleId;
    saveProgress(progress);
    return { ok: true, message: `Moved into your ${style.name}!` };
  }

  const cantAfford = spendBridgeys(progress, style.price);
  if (cantAfford) return cantAfford;

  progress.ownedHouseStyles.push(styleId);
  progress.houseStyleId = styleId;
  saveProgress(progress);
  return { ok: true, message: `Welcome to your new ${style.name}! ${style.emoji}` };
}

export function buyFurniture(itemId: string, color?: string | null): PurchaseResult {
  const item = getFurnitureItem(itemId);
  if (!item) return { ok: false, message: "That furniture item doesn't exist." };
  if (item.earnedBy) return { ok: false, message: `${item.name} is a prize for finishing a unit, so it is earned rather than bought.` };

  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (progress.ownedFurniture.includes(itemId)) {
    return { ok: false, message: `You already own the ${item.name}. Place it in your house!` };
  }

  const cantAfford = spendBridgeys(progress, item.price);
  if (cantAfford) return cantAfford;

  progress.ownedFurniture.push(itemId);
  // The colour it was chosen in comes home with it.
  if (getSwatch(color)) progress.itemColors = { ...(progress.itemColors ?? {}), [itemId]: color as string };
  saveProgress(progress);
  return {
    ok: true,
    message: `${item.name} is yours. Enter your house to place it.`,
  };
}

/** Is this an item the student owns, in any of the House's catalogs? */
function ownsItem(progress: UserProgress, itemId: string): boolean {
  return (progress.ownedFurniture ?? []).includes(itemId) || (progress.ownedRinkItems ?? []).includes(itemId);
}

/**
 * Paint a piece the student owns in one of the swatches, or hand it back its
 * own colour with null. Furniture and rink pieces alike.
 */
export function setItemColor(itemId: string, swatch: string | null): PurchaseResult {
  const item = getFurnitureItem(itemId) ?? getRinkItem(itemId);
  if (!item) return { ok: false, message: "That piece doesn't exist." };
  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (!ownsItem(progress, itemId)) return { ok: false, message: `Buy the ${item.name} first, then paint it.` };
  if (swatch !== null && !getSwatch(swatch)) return { ok: false, message: "That colour is not on the card." };
  const colors = { ...(progress.itemColors ?? {}) };
  if (swatch === null) delete colors[itemId];
  else colors[itemId] = swatch;
  progress.itemColors = colors;
  saveProgress(progress);
  return { ok: true, message: swatch === null ? `${item.name}, back in its own colour.` : `${item.name}, now in ${getSwatch(swatch)!.name.toLowerCase()}.` };
}

/** The floor a placed piece stands on; older saves have no floor and are downstairs. */
export function floorOf(entry: PlacedFurnitureEntry): HouseFloor {
  return entry.floor === "up" ? "up" : "down";
}

export function placeFurnitureAt(itemId: string, x: number, y: number, floor: HouseFloor = "down"): PurchaseResult {
  const item = getFurnitureItem(itemId);
  if (!item) return { ok: false, message: "That furniture item doesn't exist." };

  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (!progress.ownedFurniture.includes(itemId)) {
    return { ok: false, message: "You don't own that item yet. Buy it in the shop!" };
  }

  const alreadyPlaced = progress.placedFurnitureItems!.some((p) => p.itemId === itemId);
  if (alreadyPlaced) {
    return { ok: false, message: "That item is already placed. Click it in the room to pick it up first." };
  }

  const clampedX = Math.max(5, Math.min(95, x));
  const clampedY = Math.max(10, Math.min(92, y));

  progress.placedFurnitureItems!.push({
    instanceId: `${itemId}-${Date.now()}`,
    itemId,
    x: clampedX,
    y: clampedY,
    floor,
  });
  saveProgress(progress);
  return { ok: true, message: floor === "up" ? `${item.name} placed upstairs.` : `${item.name} placed!` };
}

/** Slides a placed piece to a new spot, on the same floor or the other one. */
export function moveFurniture(instanceId: string, x: number, y: number, floor?: HouseFloor): PurchaseResult {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  const entry = progress.placedFurnitureItems!.find((p) => p.instanceId === instanceId);
  if (!entry) return { ok: false, message: "That piece is not in the house." };
  const item = getFurnitureItem(entry.itemId);
  const to = floor ?? floorOf(entry);
  const moved: PlacedFurnitureEntry = { ...entry, x: Math.max(5, Math.min(95, x)), y: Math.max(10, Math.min(92, y)), floor: to };
  progress.placedFurnitureItems = progress.placedFurnitureItems!.map((p) => (p.instanceId === instanceId ? moved : p));
  saveProgress(progress);
  const changedFloor = to !== floorOf(entry);
  return { ok: true, message: changedFloor ? `${item?.name ?? "It"} is ${to === "up" ? "upstairs" : "downstairs"} now.` : `${item?.name ?? "It"} moved.` };
}

/** Sends a placed piece to the other floor, keeping its spot in the room. */
export function moveFurnitureToFloor(instanceId: string, floor: HouseFloor): PurchaseResult {
  const progress = getProgress();
  const entry = (progress.placedFurnitureItems ?? []).find((p) => p.instanceId === instanceId);
  if (!entry) return { ok: false, message: "That piece is not in the house." };
  return moveFurniture(instanceId, entry.x, entry.y, floor);
}

/** Flips a lamp, a screen, a sign: on to off and back. Only pieces with a switch. */
export function toggleFurniture(instanceId: string): PurchaseResult {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  const entry = progress.placedFurnitureItems!.find((p) => p.instanceId === instanceId);
  if (!entry) return { ok: false, message: "That piece is not in the house." };
  if (!USABLE.has(entry.itemId)) return { ok: false, message: "That one has no switch." };
  const item = getFurnitureItem(entry.itemId);
  const off = !entry.off;
  progress.placedFurnitureItems = progress.placedFurnitureItems!.map((p) => (p.instanceId === instanceId ? { ...p, off } : p));
  saveProgress(progress);
  return { ok: true, message: `${item?.name ?? "It"} is ${off ? "off" : "on"}.` };
}

/** Night falls on the house, or morning comes. */
export function setHouseNight(night: boolean): void {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  progress.houseNight = night;
  saveProgress(progress);
}

export function removePlacedFurniture(instanceId: string): void {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  progress.placedFurnitureItems = progress.placedFurnitureItems!.filter(
    (p) => p.instanceId !== instanceId
  );
  saveProgress(progress);
}

export function buyTitle(titleId: string): PurchaseResult {
  const title = getDisplayTitle(titleId);
  if (!title) return { ok: false, message: "That title doesn't exist." };

  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (progress.ownedTitles.includes(titleId)) {
    progress.equippedTitleId = titleId;
    saveProgress(progress);
    return { ok: true, message: `Equipped: ${title.name}!` };
  }

  const cantAfford = spendBridgeys(progress, title.price);
  if (cantAfford) return cantAfford;

  progress.ownedTitles.push(titleId);
  progress.equippedTitleId = titleId;
  saveProgress(progress);
  return { ok: true, message: `Unlocked & equipped: ${title.emoji} ${title.name}!` };
}

export function equipTitle(titleId: string): PurchaseResult {
  const title = getDisplayTitle(titleId);
  if (!title) return { ok: false, message: "That title doesn't exist." };

  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (!progress.ownedTitles.includes(titleId)) {
    return { ok: false, message: "Buy this title first in the shop." };
  }

  progress.equippedTitleId = titleId;
  saveProgress(progress);
  return { ok: true, message: `Now showing: ${title.emoji} ${title.name}` };
}

export function setLeaderboardOptIn(optIn: boolean): void {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  progress.leaderboardOptIn = optIn;
  saveProgress(progress);
}

export function getEquippedTitleLabel(progress: UserProgress): string | null {
  if (!progress.equippedTitleId) return null;
  const title = getDisplayTitle(progress.equippedTitleId);
  return title ? `${title.emoji} ${title.name}` : null;
}

export function getLeaderboardSnapshot(progress: UserProgress) {
  ensureBridgeyFields(progress);
  const best = getBestOwnedFurniture(progress.ownedFurniture);
  let completedSkills = 0;
  for (const skill of Object.values(progress.skills)) {
    if (skill.level === "proficient" || skill.level === "mastered") completedSkills += 1;
  }
  return {
    bridgeys: progress.bridgeysLifetime ?? progress.bridgeys,
    completedSkills,
    bestFurnitureValue: best?.prestige ?? 0,
    bestFurnitureName: best?.name ?? null,
    equippedTitle: getEquippedTitleLabel(progress),
    leaderboardOptIn: progress.leaderboardOptIn ?? false,
  };
}

export { getUnplacedFurnitureIds };

/* ── Garden ornaments ───────────────────────────────────────────
   The outdoor half of the House. Unlike furniture, ornaments can be owned
   more than once, a picket fence is only useful in multiples, so buying is
   an append rather than a membership test, and placement is matched against
   the owned list by count. */

export function buyOrnament(itemId: string): PurchaseResult {
  const item = getOrnament(itemId);
  if (!item) return { ok: false, message: "That ornament doesn't exist." };

  const progress = getProgress();
  ensureBridgeyFields(progress);

  const cantAfford = spendBridgeys(progress, item.price);
  if (cantAfford) return cantAfford;

  progress.ownedOrnaments = [...(progress.ownedOrnaments ?? []), itemId];
  saveProgress(progress);
  return { ok: true, message: `${item.name} delivered! Place it out in your yard.` };
}

export function placeOrnamentAt(itemId: string, x: number, z: number): PurchaseResult {
  const item = getOrnament(itemId);
  if (!item) return { ok: false, message: "That ornament doesn't exist." };

  const progress = getProgress();
  ensureBridgeyFields(progress);
  const owned = progress.ownedOrnaments ?? [];
  const placed = progress.placedOrnaments ?? [];

  if (!getUnplacedOrnamentIds(owned, placed).includes(itemId)) {
    return { ok: false, message: `You have no spare ${item.name} to put down.` };
  }

  const spot = clampToYard({ x, z });
  progress.placedOrnaments = [
    ...placed,
    { instanceId: `orn-${Date.now()}-${placed.length}`, itemId, x: spot.x, z: spot.z },
  ];
  saveProgress(progress);
  return { ok: true, message: `${item.name} placed.` };
}

export function removePlacedOrnament(instanceId: string): PurchaseResult {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  const placed = progress.placedOrnaments ?? [];
  const entry = placed.find((p) => p.instanceId === instanceId);
  if (!entry) return { ok: false, message: "Nothing to pick up there." };

  progress.placedOrnaments = placed.filter((p) => p.instanceId !== instanceId);
  saveProgress(progress);
  const item = getOrnament(entry.itemId);
  return { ok: true, message: `${item?.name ?? "Ornament"} picked up.` };
}

/* ── The rink ───────────────────────────────────────────────────────── */

export function buyRinkItem(itemId: string, color?: string | null): PurchaseResult {
  const item = getRinkItem(itemId);
  if (!item) return { ok: false, message: "That rink piece doesn't exist." };
  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (progress.ownedRinkItems!.includes(itemId)) {
    return { ok: false, message: `You already own the ${item.name}. Place it in the backyard.` };
  }
  const cantAfford = spendBridgeys(progress, item.price);
  if (cantAfford) return cantAfford;
  progress.ownedRinkItems!.push(itemId);
  if (getSwatch(color)) progress.itemColors = { ...(progress.itemColors ?? {}), [itemId]: color as string };
  saveProgress(progress);
  return { ok: true, message: `${item.name} is yours. It goes in the backyard, by the rink.` };
}

/** Stands a rink piece on a slot. A piece already standing elsewhere moves. */
export function placeRinkItem(slotId: string, itemId: string): PurchaseResult {
  const item = getRinkItem(itemId);
  const slot = getRinkSlot(slotId);
  if (!item || !slot) return { ok: false, message: "That spot is off the plan." };
  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (!progress.ownedRinkItems!.includes(itemId)) return { ok: false, message: `You do not own the ${item.name} yet.` };
  const decor = { ...progress.rinkDecor };
  for (const [s, id] of Object.entries(decor)) if (id === itemId) delete decor[s];
  const displaced = decor[slotId];
  decor[slotId] = itemId;
  progress.rinkDecor = decor;
  saveProgress(progress);
  return {
    ok: true,
    message: displaced ? `${item.name} takes the ${slot.label} spot; the ${getRinkItem(displaced)?.name ?? "other piece"} is back in the tray.` : `${item.name} stands at the ${slot.label}.`,
  };
}

export function clearRinkSlot(slotId: string): PurchaseResult {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  const id = progress.rinkDecor?.[slotId];
  if (!id) return { ok: false, message: "Nothing stands there." };
  const decor = { ...progress.rinkDecor };
  delete decor[slotId];
  progress.rinkDecor = decor;
  saveProgress(progress);
  return { ok: true, message: `${getRinkItem(id)?.name ?? "It"} is back in the tray.` };
}

/** Rink decorations bought and standing nowhere. */
export function unplacedRinkItems(progress: UserProgress): string[] {
  const standing = new Set(Object.values(progress.rinkDecor ?? {}));
  return (progress.ownedRinkItems ?? []).filter((id) => !standing.has(id));
}

/**
 * Pays for a problem solved on the rink, within the day's cap. Returns what
 * was paid (0 once the cap is reached) and what is left for today.
 */
export function awardRinkBridgeys(skillId: string, day: string): { paid: number; remaining: number; solved: number } {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  const r = progress.rink && progress.rink.day === day ? progress.rink : { day, earned: 0, solved: 0, best: progress.rink?.best ?? 0 };
  const remainingBefore = rinkRemainingToday({ ...progress, rink: r }, day);
  const paid = Math.min(rinkPayFor(skillId), remainingBefore);
  if (paid > 0) awardBridgeys(progress, paid);
  r.earned += paid;
  r.solved += 1;
  progress.rink = r;
  // Solving on the rink is a day of practice too.
  touchActivity(progress);
  saveProgress(progress);
  return { paid, remaining: Math.max(0, RINK_DAILY_CAP - r.earned), solved: r.solved };
}

/** Keeps the best run of right answers in a row. */
export function recordRinkRun(run: number, day: string): void {
  const progress = getProgress();
  ensureBridgeyFields(progress);
  const r = progress.rink && progress.rink.day === day ? progress.rink : { day, earned: 0, solved: 0, best: progress.rink?.best ?? 0 };
  if (run > (r.best ?? 0)) {
    r.best = run;
    progress.rink = r;
    saveProgress(progress);
  }
}
