import { normalizeProfile, type Profile, type ProfileStore } from "../engine/profile";

/** The standalone profile store: one JSON blob in localStorage. AlgeBridge swaps in a Supabase-backed one. */
export class LocalProfileStore implements ProfileStore {
  constructor(private readonly key = "alge-carts:profile:v1") {}

  async load(): Promise<Profile | null> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return normalizeProfile(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async save(p: Profile): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(p));
    } catch {
      /* private mode or full: progress lasts the session */
    }
  }
}
