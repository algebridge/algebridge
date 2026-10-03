"use client";

import { useEffect } from "react";
import { DemoCard } from "@/components/demo/DemoCard";
import { TryProblem } from "@/components/TryProblem";

/**
 * A sample problem with Archie open on it: the real study helper, docked on
 * a wide frame and a sheet on a phone, with the problem as his context. His
 * panel is fixed to the frame, so the card holds a height for it to sit in.
 * The bare-route rule hides his launcher; this page keeps it (globals.css,
 * "Bare routes"), so a visitor who closes the panel can open him again.
 */
export function ArchieDemo() {
  useEffect(() => {
    document.documentElement.setAttribute("data-demo-helper", "");
    return () => document.documentElement.removeAttribute("data-demo-helper");
  }, []);

  return (
    <DemoCard pad={false}>
      <div className="min-h-[560px] sm:min-h-[620px]">
        <TryProblem embed helper card={false} reportHeight={false} />
      </div>
    </DemoCard>
  );
}
