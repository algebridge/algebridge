"use client";

import { useEffect, useState } from "react";
import { GraphingCalculator } from "@/components/calc/GraphingCalculator";
import { ScientificCalculator } from "@/components/calc/ScientificCalculator";
import type { CalculatorMode } from "@/lib/desmos";

/**
 * AlgeBridge's own calculators, for when there is no calculator API key: Scientific
 * (what the panel opens on) and Graphing, one tap away. Both stay mounted once
 * made, hidden when not in use, so a switch back finds the work where it was.
 * Graphing is only made the first time it is asked for. Neither does anything
 * while it sits still: no timers, no animation loop.
 */
export function AlgebridgeCalculator({ mode, open }: { mode: CalculatorMode; open: boolean }) {
  const [graphMade, setGraphMade] = useState(mode === "graphing");
  useEffect(() => {
    if (mode === "graphing") setGraphMade(true);
  }, [mode]);

  return (
    <>
      <div className={`absolute inset-0 ${mode === "scientific" ? "" : "hidden"}`}>
        <ScientificCalculator active={open && mode === "scientific"} />
      </div>
      {(graphMade || mode === "graphing") && (
        <div className={`absolute inset-0 ${mode === "graphing" ? "" : "hidden"}`}>
          <GraphingCalculator active={open && mode === "graphing"} />
        </div>
      )}
    </>
  );
}
