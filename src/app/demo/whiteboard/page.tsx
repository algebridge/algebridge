import type { Metadata } from "next";
import { WhiteboardDemo } from "@/components/demo/WhiteboardDemo";

export const metadata: Metadata = {
  title: "Whiteboard demo",
  description: "The whiteboard a tutor and student share on an AlgeBridge call. Draw on it; nothing is saved.",
};

/**
 * /demo/whiteboard: the card alone, for algebridge.org's iframe. /demo is a
 * bare route (lib/bare-route.ts), so the app shell is hidden around it.
 */
export default function WhiteboardDemoPage() {
  return <WhiteboardDemo />;
}
