"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { skillAccess, unitIsOpen, type SkillAccess } from "@/lib/path";
import { getProgress } from "@/lib/progress";
import { CLASS_CONTEXT_EVENT, myClassContext, NO_CLASS_CONTEXT, type MyClassContext } from "@/lib/my-class-context";

/**
 * What of the course this person can open right now. See src/lib/path.ts for
 * the rules. `ready` stays false until the account's saved progress and role
 * have loaded, so nothing flashes locked for a returning student or a teacher.
 */
export function useCourseAccess() {
  const { user, profile, loading, progressLoaded } = useAuth();
  const { stats, mounted } = useProgress();
  const [classCtx, setClassCtx] = useState<MyClassContext>(NO_CLASS_CONTEXT);
  // A profile that never loads must not leave the page waiting forever.
  const [waitedOut, setWaitedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedOut(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setClassCtx(NO_CLASS_CONTEXT);
      return;
    }
    let live = true;
    const load = () => void myClassContext(userId).then((ctx) => live && setClassCtx(ctx));
    load();
    window.addEventListener(CLASS_CONTEXT_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(CLASS_CONTEXT_EVENT, load);
    };
  }, [userId]);

  const staff = !!profile && (profile.role === "teacher" || profile.role === "tutor" || profile.isAdmin);
  const ready = mounted && (waitedOut || (!loading && progressLoaded && (!user || !!profile)));
  // Re-read whenever progress changes; stats is a new object on every change.
  const progress = useMemo(() => getProgress(), [stats]); // eslint-disable-line react-hooks/exhaustive-deps

  const { assigned } = classCtx;
  const blocked = classCtx.controls.blockedSkills;
  const assignedOnly = classCtx.controls.assignedOnly;
  return useMemo(
    () => ({
      ready,
      staff,
      skill: (skillId: string): SkillAccess => skillAccess(progress, skillId, { staff, assigned, blocked, assignedOnly }),
      unit: (unitId: string): boolean => unitIsOpen(progress, unitId, { staff, assigned, blocked, assignedOnly }),
      /** What a student would see, so a teacher can tell what is locked for their class. */
      forStudents: (skillId: string): SkillAccess => skillAccess(progress, skillId, { assigned }),
    }),
    [ready, staff, progress, assigned, blocked, assignedOnly]
  );
}
