import type { SkillIdea } from "./types";
import { IDEAS as a1a } from "./a1-units-1-2";
import { IDEAS as a1b } from "./a1-units-3-5";
import { IDEAS as a1c } from "./a1-units-6-10";
import { IDEAS as a1d } from "./a1-units-11-15";
import { IDEAS as a2a } from "./a2-units-1-4";
import { IDEAS as a2b } from "./a2-units-5-8";
import { IDEAS as a2r } from "./a2-square-roots";
import { sourceId } from "@/data/skill-source";

export type { SkillIdea, Picture, Curve, Pan } from "./types";

/** Every skill's "Get the idea", both courses. */
export const SKILL_IDEAS: Record<string, SkillIdea> = { ...a1a, ...a1b, ...a1c, ...a1d, ...a2r, ...a2a, ...a2b };

export function ideaFor(skillId: string): SkillIdea | null {
  return SKILL_IDEAS[sourceId(skillId)] ?? null;
}
