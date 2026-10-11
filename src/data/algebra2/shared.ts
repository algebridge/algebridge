import type { Video } from "@/types";
import { A2_VIDEOS } from "@/data/algebra2/videos";

/**
 * Algebra 2 lessons have no sourced video yet (see the YouTube sourcing
 * pipeline, which verifies every id before it ships). An empty youtubeId
 * tells the lesson page to skip the player instead of embedding nothing.
 */
export const NO_VIDEO: Video = { id: "a2-no-video", title: "", channel: "", duration: "0:00", youtubeId: "" };

/** The sourced video for a skill, or the placeholder that hides the player. */
export function videoFor(skillId: string): Video {
  return A2_VIDEOS[skillId] ?? NO_VIDEO;
}
