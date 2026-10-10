import type { Video } from "@/types";

/**
 * Lesson videos for Algebra 2, keyed by skill id. Filled by the same
 * sourcing pass as src/data/videos.ts: every id verified live (oEmbed and
 * playable in an embed), 1 to 15 minutes, from a trusted channel. A skill
 * with no entry shows its key idea in place of a player.
 */
export const A2_VIDEOS: Record<string, Video> = {};
