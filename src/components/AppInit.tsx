"use client";

import { useEffect } from "react";
import { ensureDailyStreak } from "@/lib/progress";
import { touchLastSeen } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import { showToast } from "@/lib/notify";
import { Confetti } from "@/components/Confetti";
import { ToastHost } from "@/components/ToastHost";
import { WelcomeModal } from "@/components/WelcomeModal";
import { InterestsPrompt } from "@/components/InterestsPrompt";

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
    // Once a day per browser: the header shows the number all the time.
    const today = new Date().toDateString();
    let shownFor: string | null = null;
    try {
      shownFor = window.sessionStorage.getItem("algebridge-streak-toast");
    } catch {
      /* no session storage: the toast shows once per page load */
    }
    if (streak >= 2 && shownFor !== today) {
      try {
        window.sessionStorage.setItem("algebridge-streak-toast", today);
      } catch {
        /* fine */
      }
      showToast({
        icon: "flame",
        tone: "reward",
        title: `${streak}-day streak`,
        description: "Practice again tomorrow to keep it going.",
      });
    }
    for (const badge of newBadges) {
      showToast({
        icon: "trophy",
        tone: "reward",
        title: `Badge: ${badge.title}`,
        description: badge.description,
      });
    }
  }, []);

  return (
    <>
      <Confetti />
      <ToastHost />
      <WelcomeModal />
      <InterestsPrompt />
    </>
  );
}
