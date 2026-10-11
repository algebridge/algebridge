import type { WorkedExample } from "./types";
import { EXAMPLES as s0 } from "./a1-units-1-2";
import { EXAMPLES as s5 } from "./a1-units-3-5";
import { EXAMPLES as s1 } from "./a1-units-6-10";
import { EXAMPLES as s2 } from "./a1-units-11-15";
import { EXAMPLES as s3 } from "./a2-units-1-4";
import { EXAMPLES as s4 } from "./a2-units-5-8";

export type { WorkedExample, WorkedStep } from "./types";

/** Every skill's worked examples, both courses. */
export const WORKED_EXAMPLES: Record<string, WorkedExample[]> = { ...s0, ...s1, ...s2, ...s3, ...s4, ...s5 };

export function workedExamplesFor(skillId: string): WorkedExample[] {
  return WORKED_EXAMPLES[skillId] ?? [];
}
