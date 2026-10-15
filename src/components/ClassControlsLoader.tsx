"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { CLASS_CONTEXT_EVENT, myClassContext } from "@/lib/my-class-context";
import { setClassBlocked } from "@/lib/school-mode";

/**
 * Reads what the signed-in student's teachers turned off and hands it to the
 * menus and page gates (src/lib/school-mode.ts). Cleared when nobody is
 * signed in, so the next person on a shared computer starts clean.
 */
export function ClassControlsLoader() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? null;
  const staff = !!profile && (profile.role === "teacher" || profile.role === "tutor" || profile.isAdmin);

  useEffect(() => {
    if (!userId || staff) {
      setClassBlocked([]);
      return;
    }
    let live = true;
    const load = () =>
      void myClassContext(userId).then((ctx) => {
        if (live) setClassBlocked(ctx.controls.blockedFeatures);
      });
    load();
    window.addEventListener(CLASS_CONTEXT_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(CLASS_CONTEXT_EVENT, load);
    };
  }, [userId, staff]);

  return null;
}
