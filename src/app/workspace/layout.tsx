import type { ReactNode } from "react";
import { SchoolGate } from "@/components/SchoolModePanel";

/**
 * School mode turns this page off (src/lib/school-mode.ts): the workspace
 * lists every open help request, with the student's name and words.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return <SchoolGate feature="tutors">{children}</SchoolGate>;
}
