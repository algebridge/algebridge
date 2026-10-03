import type { Metadata } from "next";
import { LessonDemo } from "@/components/demo/LessonDemo";

export const metadata: Metadata = {
  title: "Lesson demo",
  description: "The top of a real AlgeBridge lesson: the video, the key idea, and three practice problems. Nothing is saved.",
};

/** /demo/lesson: a bare route (lib/bare-route.ts) algebridge.org frames. */
export default function LessonDemoPage() {
  return <LessonDemo />;
}
