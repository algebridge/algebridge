import type { Metadata } from "next";
import { LessonDemo } from "@/components/demo/LessonDemo";

export const metadata: Metadata = {
  title: "Lesson demo",
  description: "A real AlgeBridge skill: the key idea, the standards it covers, and three practice problems. Nothing is saved.",
};

/**
 * /demo/lesson: a bare route (lib/bare-route.ts) algebridge.org frames.
 * ?watch=1 adds the lesson's Watch step with its video player.
 */
export default async function LessonDemoPage({ searchParams }: { searchParams: Promise<{ watch?: string }> }) {
  const { watch } = await searchParams;
  return <LessonDemo watch={watch === "1"} />;
}
