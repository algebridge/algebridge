"use client";

import { Whiteboard } from "@/components/Whiteboard";
import { DemoCard } from "@/components/demo/DemoCard";

/**
 * /demo/whiteboard: the whiteboard from a tutoring call, drawn on alone.
 * The room page mounts this same component inside its tool card and sends
 * each stroke down the call's channel; here the card is the DemoCard and
 * the stroke callbacks go nowhere, so a line lives on this screen only.
 */
export function WhiteboardDemo() {
  const noop = () => {};
  return (
    <DemoCard>
      {/* The room gives the board h-[70vh]. An iframe sized to its content has no
          usable vh, so this is the toolbar row plus the canvas's 320px floor;
          below sm the toolbar wraps to a second row. */}
      <div className="h-[388px] sm:h-[356px]">
        <Whiteboard onSegment={noop} onClear={noop} />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        The whiteboard a tutor and student share on a call. Demo: nothing is saved.
      </p>
    </DemoCard>
  );
}
