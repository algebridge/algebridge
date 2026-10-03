import type { Metadata } from "next";
import { ArchieDemo } from "@/components/demo/ArchieDemo";

export const metadata: Metadata = {
  title: "Archie demo",
  description: "A real practice problem with Archie, AlgeBridge's AI study buddy, open on it. He hints and never gives the answer.",
};

/** /demo/archie: a bare route (lib/bare-route.ts) algebridge.org frames. */
export default function ArchieDemoPage() {
  return <ArchieDemo />;
}
