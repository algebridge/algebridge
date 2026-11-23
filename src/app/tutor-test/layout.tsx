import type { ReactNode } from "react";
import { SchoolGate } from "@/components/SchoolModePanel";

export const metadata = { title: "Tutor check" };

/** School mode turns this page off, like the Tutor Hub (src/lib/school-mode.ts). */
export default function Layout({ children }: { children: ReactNode }) {
  return <SchoolGate feature="tutors">{children}</SchoolGate>;
}
