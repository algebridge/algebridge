import { hasUnlimitedBridgeys, spendable } from "@/lib/bridgeys";
import { getProgress, saveProgress } from "@/lib/progress";
import { newProfile, normalizeProfile, type Profile, type ProfileStore } from "./engine/profile";

/** What an unlimited account sees in the garage instead of infinity. */
export const UNLIMITED_SHOWN = 999999;

/**
 * The kart profile on AlgeBridge: what the student owns, wears and has
 * reached stays in localStorage per account for the demo, while the coins
 * are the student's real Bridgeys. The garage's buy() lowers profile.coins;
 * save() turns that into a real spend. Nothing in the race adds coins: right
 * answers pay through awardRinkBridgeys like every other game.
 */
export class BridgeysProfileStore implements ProfileStore {
  constructor(
    private readonly userId: string,
    private readonly name: string,
  ) {}

  private key(): string {
    return `algebridge:carts:${this.userId}`;
  }

  balance(): number {
    const s = spendable(getProgress());
    return Number.isFinite(s) ? Math.floor(s) : UNLIMITED_SHOWN;
  }

  async load(): Promise<Profile | null> {
    let p: Profile;
    try {
      const raw = localStorage.getItem(this.key());
      p = raw ? normalizeProfile(JSON.parse(raw)) : newProfile(this.name);
    } catch {
      p = newProfile(this.name);
    }
    if (!p.name) p.name = this.name;
    p.coins = this.balance();
    return p;
  }

  async save(p: Profile): Promise<void> {
    const real = this.balance();
    if (p.coins < real && !hasUnlimitedBridgeys()) {
      const progress = getProgress();
      progress.bridgeys = Math.max(0, (progress.bridgeys ?? 0) - (real - p.coins));
      saveProgress(progress);
    }
    p.coins = this.balance();
    try {
      localStorage.setItem(this.key(), JSON.stringify({ ...p, coins: 0 }));
    } catch {
      /* private mode: the outfit lasts the session */
    }
  }
}
