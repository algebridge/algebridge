import type { ReactNode } from "react";
import { SchoolGate } from "@/components/SchoolModePanel";

export const metadata = { title: "Calendar" };

/** School mode turns this page off (src/lib/school-mode.ts). */
export default function Layout({ children }: { children: ReactNode }) {
  return <SchoolGate feature="booking">{children}</SchoolGate>;
}
