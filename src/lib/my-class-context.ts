/**
 * The signed-in student's classes, as the rest of the app needs them: which
 * skills their teachers assigned, and what those teachers turned off. Read
 * once per account and shared by every page.
 */

import { assignmentSkillIds } from "@/lib/assignments";
import { getMyControls, mergeControls, type MergedControls } from "@/lib/class-controls";
import { getMyClassesAsStudent } from "@/lib/teacher";

export interface MyClassContext {
  assigned: Set<string>;
  controls: MergedControls;
}

export const NO_CLASS_CONTEXT: MyClassContext = { assigned: new Set(), controls: mergeControls([]) };

let cache: { userId: string; value: Promise<MyClassContext> } | null = null;

export function myClassContext(userId: string): Promise<MyClassContext> {
  if (cache?.userId !== userId) {
    cache = {
      userId,
      value: (async () => {
        const classes = await getMyClassesAsStudent();
        const assigned = new Set(classes.flatMap((c) => c.assignments.flatMap(assignmentSkillIds)));
        const controls = mergeControls(await getMyControls(new Set(classes.map((c) => c.id))));
        return { assigned, controls };
      })().catch(() => NO_CLASS_CONTEXT),
    };
  }
  return cache.value;
}

/** After joining or leaving a class, read it again. */
export const CLASS_CONTEXT_EVENT = "algebridge:class-context";

export function forgetMyClassContext(): void {
  cache = null;
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(CLASS_CONTEXT_EVENT));
  } catch {
    /* no window in tests */
  }
}
