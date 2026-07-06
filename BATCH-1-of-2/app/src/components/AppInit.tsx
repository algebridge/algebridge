"use client";

import { useEffect } from "react";
import { ensureDailyStreak } from "@/lib/progress";
import { showToast } from "@/lib/notify";
import { Confetti } from "@/components/Confetti";
import { ToastHost } from "@/components/ToastHost";
import { WelcomeModal } from "@/components/WelcomeModal";

/** Mounted once in the root layout: handles daily streak tracking and global overlays. */
export function AppInit() {
  useEffect(() => {
    const { streak, newBadges } = ensureDailyStreak();
    if (streak >= 2) {
      showToast({
        emoji: "🔥",
        title: `${streak}-day streak!`,
        description: "Keep practicing every day to grow your streak.",
      });
    }
    for (const badge of newBadges) {
      showToast({
        emoji: badge.emoji,
        title: `Badge unlocked: ${badge.title}`,
        description: badge.description,
      });
    }
  }, []);

  return (
    <>
      <Confetti />
      <ToastHost />
      <WelcomeModal />
    </>
  );
}
