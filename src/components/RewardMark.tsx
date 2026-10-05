import { Icon, type IconName } from "@/components/Icon";
import { hueVars, topicHue } from "@/lib/hues";

/**
 * Rewards drawn the way the rest of the app is drawn. Badges and titles
 * still carry an emoji in their data, but an emoji looks different on every
 * phone and laptop, so the screens show a line icon or a monogram instead.
 */

const BADGE_ICONS: Record<string, IconName> = {
  "first-skill": "check",
  "first-unit": "course",
  "perfect-five": "star",
  "streak-3": "flame",
  "streak-7": "flame",
  century: "pen",
  grit: "review",
  "video-buff": "play",
  "level-5": "leaderboard",
  "course-complete": "trophy",
};

/** A badge's mark: its icon in a tile, muted until it is earned. */
export function BadgeMark({ id, earned, size = 44 }: { id: string; earned: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-xl ${
        earned ? "bg-bridge-50 text-bridge-700 ring-1 ring-inset ring-bridge-100" : "bg-slate-100 text-slate-400"
      }`}
    >
      <Icon name={BADGE_ICONS[id] ?? "trophy"} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** Two letters from a title's first and last words: "Graph Guru" is GG, "Gridmaster" is GR. */
export function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z\s-]/g, "").split(/[\s-]+/).filter(Boolean);
  const skip = new Set(["of", "the", "and"]);
  const main = words.filter((w) => !skip.has(w.toLowerCase()));
  if (main.length >= 2) return (main[0][0] + main[main.length - 1][0]).toUpperCase();
  const one = main[0] ?? name;
  return one.slice(0, 2).toUpperCase();
}

/**
 * Text without emoji, for labels that were written with one built in (an
 * equipped title reads "<emoji> Graph Guru" in saved progress and on the
 * leaderboard rows). Pictographs, flags, keycaps and their joiners go;
 * letters, digits and math symbols stay.
 */
export function withoutEmoji(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
