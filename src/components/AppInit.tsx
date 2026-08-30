"use client";

import { useEffect } from "react";
import { ensureDailyStreak } from "@/lib/progress";
import { touchLastSeen } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { showToast } from "@/lib/notify";
import { Confetti } from "@/components/Confetti";
import { ToastHost } from "@/components/ToastHost";
import { WelcomeModal } from "@/components/WelcomeModal";

/** Mounted once in the root layout: handles daily streak tracking and global overlays. */
export function AppInit() {
  const { user } = useAuth();

  // Activity heartbeat. This is what the admin console's "active in the last
  // 24h / 7d / 30d" numbers count, so it lives here rather than on one page.
  // touchLastSeen() throttles itself to one write per five minutes per tab.
  useEffect(() => {
    if (!user) return;
    void touchLastSeen();
    const onVisible = () => {
      if (document.visibilityState === "visible") void touchLastSeen();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void touchLastSeen(), 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [user]);

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
