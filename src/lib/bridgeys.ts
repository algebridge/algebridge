import {
  getBestOwnedFurniture,
  getFurnitureItem,
  getHouseStyle,
  getUnplacedFurnitureIds,
  migrateSlotPlacements,
  STARTER_HOUSE_ID,
} from "@/data/house-catalog";
import { getDisplayTitle } from "@/data/titles-catalog";
import { BRIDGEY_REWARDS } from "@/lib/gamification";
import { getProgress, saveProgress } from "@/lib/progress";
import type { PlacedFurnitureEntry, UserProgress } from "@/types";

export type PurchaseResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

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
    progress.bridgeyRewardsClaimed = { visual: [], complete: [] };
  }
  if (progress.leaderboardOptIn == null) progress.leaderboardOptIn = true;

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
  return progress;
}

export function awardBridgeys(progress: UserProgress, amount: number): number {
  ensureBridgeyFields(progress);
  if (amount <= 0) return 0;
  progress.bridgeys += amount;
  progress.bridgeysLifetime = (progress.bridgeysLifetime ?? 0) + amount;
  return amount;
}

/** 5 Bridgeys for finishing Visualize It on a skill (once per skill). */
export function tryAwardVisualBridgeys(progress: UserProgress, skillId: string): number {
  ensureBridgeyFields(progress);
  const claimed = progress.bridgeyRewardsClaimed!;
  if (claimed.visual.includes(skillId)) return 0;
  claimed.visual.push(skillId);
  return awardBridgeys(progress, BRIDGEY_REWARDS.visualCompleted);
}

/** 10 Bridgeys for completing a skill/lesson (once per skill). */
export function tryAwardSkillCompleteBridgeys(progress: UserProgress, skillId: string): number {
  ensureBridgeyFields(progress);
  const claimed = progress.bridgeyRewardsClaimed!;
  if (claimed.complete.includes(skillId)) return 0;
  claimed.complete.push(skillId);
  return awardBridgeys(progress, BRIDGEY_REWARDS.skillComplete);
}

function spendBridgeys(progress: UserProgress, price: number): PurchaseResult | null {
  ensureBridgeyFields(progress);
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

export function buyFurniture(itemId: string): PurchaseResult {
  const item = getFurnitureItem(itemId);
  if (!item) return { ok: false, message: "That furniture item doesn't exist." };

  const progress = getProgress();
  ensureBridgeyFields(progress);
  if (progress.ownedFurniture.includes(itemId)) {
    return { ok: false, message: `You already own the ${item.name}. Place it in your house!` };
  }

  const cantAfford = spendBridgeys(progress, item.price);
  if (cantAfford) return cantAfford;

  progress.ownedFurniture.push(itemId);
  saveProgress(progress);
  return {
    ok: true,
    message: `${item.emoji} ${item.name} is yours! Enter your house to place it.`,
  };
}

export function placeFurnitureAt(itemId: string, x: number, y: number): PurchaseResult {
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
  });
  saveProgress(progress);
  return { ok: true, message: `${item.name} placed!` };
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
    leaderboardOptIn: progress.leaderboardOptIn ?? true,
  };
}

export { getUnplacedFurnitureIds };
