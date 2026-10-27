import type { ReactNode } from "react";
import { SchoolGate } from "@/components/SchoolModePanel";

export const metadata = { title: "Live Arena", description: "A quiz show over Algebra 1: host on one screen, join from phones with a code, or share one keyboard." };

/** School mode turns the games off, and the arena with them (src/lib/school-mode.ts). */
export default function Layout({ children }: { children: ReactNode }) {
  return <SchoolGate feature="games">{children}</SchoolGate>;
}
