"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { assignmentSkillIds } from "@/lib/assignments";
import { skillAccess, unitIsOpen, type SkillAccess } from "@/lib/path";
import { getProgress } from "@/lib/progress";
import { getMyClassesAsStudent } from "@/lib/teacher";

/** One read of a student's class assignments per account, shared by every list on the page. */
let assignedCache: { userId: string; skills: Promise<Set<string>> } | null = null;

function assignedSkills(userId: string): Promise<Set<string>> {
  if (assignedCache?.userId !== userId) {
    assignedCache = {
      userId,
      skills: getMyClassesAsStudent()
        .then((classes) => new Set(classes.flatMap((c) => c.assignments.flatMap(assignmentSkillIds))))
        .catch(() => new Set<string>()),
    };
  }
  return assignedCache.skills;
}

/**
 * What of the course this person can open right now. See src/lib/path.ts for
 * the rules. `ready` stays false until the account's saved progress and role
 * have loaded, so nothing flashes locked for a returning student or a teacher.
 */
export function useCourseAccess() {
  const { user, profile, loading, progressLoaded } = useAuth();
  const { stats, mounted } = useProgress();
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set());
  // A profile that never loads must not leave the page waiting forever.
  const [waitedOut, setWaitedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedOut(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setAssigned(new Set());
      return;
    }
    let live = true;
    void assignedSkills(userId).then((skills) => live && setAssigned(skills));
    return () => {
      live = false;
    };
  }, [userId]);

  const staff = !!profile && (profile.role === "teacher" || profile.role === "tutor" || profile.isAdmin);
  const ready = mounted && (waitedOut || (!loading && progressLoaded && (!user || !!profile)));
  // Re-read whenever progress changes; stats is a new object on every change.
  const progress = useMemo(() => getProgress(), [stats]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () => ({
      ready,
      staff,
      skill: (skillId: string): SkillAccess => skillAccess(progress, skillId, { staff, assigned }),
      unit: (unitId: string): boolean => unitIsOpen(progress, unitId, { staff, assigned }),
      /** What a student would see, so a teacher can tell what is locked for their class. */
      forStudents: (skillId: string): SkillAccess => skillAccess(progress, skillId, { assigned }),
    }),
    [ready, staff, progress, assigned]
  );
}
