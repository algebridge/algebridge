import type { Metadata } from "next";
import { ReviewDemo } from "@/components/demo/ReviewDemo";

export const metadata: Metadata = {
  title: "Review demo",
  description: "AlgeBridge's spaced-repetition review on a sample student, with three skills due. Nothing is saved.",
};

/** /demo/review: a bare route (lib/bare-route.ts) algebridge.org frames. */
export default function ReviewDemoPage() {
  return <ReviewDemo />;
}
