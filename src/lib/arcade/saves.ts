import { getProgress, saveProgress } from "@/lib/progress";

/**
 * The arcade games (public/arcade) save to this origin's localStorage under
 * "arcade:<slug>:<key>". This copies those entries into the student's
 * progress, which already syncs to the account (lib/auth.tsx), and copies the
 * account's newer copy back before a game opens, so a run on one computer
 * carries over to another.
 */
const PREFIX = "arcade:";
/** When this browser last took or gave the account copy. */
const STAMP = "algebridge:arcade:syncedAt";
/** Long replays (a best-run ghost) stay on the device; everything else travels. */
const MAX_ENTRY = 24_000;
const MAX_TOTAL = 240_000;

function readLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    const v = localStorage.getItem(k);
    if (v == null || v.length > MAX_ENTRY || total + v.length > MAX_TOTAL) continue;
    out[k] = v;
    total += v.length;
  }
  return out;
}

const same = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/** Copies this browser's arcade saves into the progress (and so to the account), when they changed. */
export function snapshotArcade(): void {
  if (typeof window === "undefined") return;
  try {
    // The account's newer copy comes in first, and the two are merged, so a
    // fresh or cleared browser can never write an empty save over a full one.
    restoreArcade();
    const progress = getProgress();
    const saves = { ...(progress.arcade?.saves ?? {}), ...readLocal() };
    if (progress.arcade && same(progress.arcade.saves, saves)) return;
    const at = new Date().toISOString();
    progress.arcade = { at, saves };
    saveProgress(progress);
    localStorage.setItem(STAMP, at);
  } catch {
    /* private window or full storage: the game still saves on this device */
  }
}

/** Brings the account's arcade saves into this browser when they are newer than what it last saw. */
/** Returns true when it changed anything here. */
export function restoreArcade(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cloud = getProgress().arcade;
    if (!cloud) return false;
    const seen = localStorage.getItem(STAMP);
    if (seen && seen >= cloud.at) return false;
    for (const [k, v] of Object.entries(cloud.saves)) if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
    localStorage.setItem(STAMP, cloud.at);
    return true;
  } catch {
    return false;
  }
}
