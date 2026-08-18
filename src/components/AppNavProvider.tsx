"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { getProgress } from "@/lib/progress";
import { getReviewQueueCount } from "@/lib/spaced-repetition";
import { units } from "@/data/curriculum";
import { getUnreadCount, subscribeToIncomingMessages, MESSAGES_READ_EVENT } from "@/lib/social";
import { buildNav, type NavSection } from "@/lib/nav";
import type { CourseStats, ContinueTarget } from "@/lib/progress";

interface AppNavState {
  sections: NavSection[];
  continueTarget: ContinueTarget | null;
  stats: CourseStats;
  mounted: boolean;
  unread: number;
  reviewCount: number;
}

const AppNavContext = createContext<AppNavState | null>(null);

/**
 * Computes the shell's shared state (nav, unread badge, review queue) once, so
 * the sidebar and the top bar don't each open their own realtime subscription.
 */
export function AppNavProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const { stats, continueTarget, mounted } = useProgress();
  const [reviewCount, setReviewCount] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const skillMeta = units.flatMap((u) =>
      u.skills.map((s) => ({ id: s.id, title: s.title, unitId: u.id, unitTitle: u.title }))
    );
    setReviewCount(getReviewQueueCount(getProgress().skills, skillMeta));
  }, [stats.completedSkills]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    const load = () => getUnreadCount().then((n) => active && setUnread(n));
    load();
    const unsub = subscribeToIncomingMessages(user.id, load);
    window.addEventListener(MESSAGES_READ_EVENT, load);
    return () => {
      active = false;
      unsub();
      window.removeEventListener(MESSAGES_READ_EVENT, load);
    };
  }, [user?.id]);

  const sections = useMemo(
    () =>
      buildNav({
        signedIn: !!user,
        role: profile?.role ?? "student",
        isAdmin: !!profile?.isAdmin,
        reviewCount,
        unreadCount: unread,
      }),
    [user, profile?.role, profile?.isAdmin, reviewCount, unread]
  );

  const value: AppNavState = { sections, continueTarget, stats, mounted, unread, reviewCount };

  return <AppNavContext.Provider value={value}>{children}</AppNavContext.Provider>;
}

export function useAppNavState(): AppNavState {
  const ctx = useContext(AppNavContext);
  if (!ctx) throw new Error("useAppNavState must be used within AppNavProvider");
  return ctx;
}
