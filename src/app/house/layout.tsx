import type { ReactNode } from "react";
import { ClassGate } from "@/components/SchoolModePanel";

export const metadata = { title: "Bridgey House" };

/** A teacher's class controls can turn the house off (src/lib/class-controls.ts). */
export default function Layout({ children }: { children: ReactNode }) {
  return <ClassGate feature="house">{children}</ClassGate>;
}
