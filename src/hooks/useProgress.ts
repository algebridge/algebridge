import { useCallback, useEffect, useState } from "react";
import type { CourseId } from "@/data/curriculum";
import {
  getCourseStats,
  getContinueLearning,
  getEmptyCourseStats,
  unitsOfCourse,
  PROGRESS_UPDATED_EVENT,
  type CourseStats,
  type ContinueTarget,
} from "@/lib/progress";

/** Progress in one course (Algebra 1 unless named): its skills, its units, its next lesson. */
export function useProgress(courseId: CourseId = "algebra-1") {
  const [stats, setStats] = useState<CourseStats>(() => getEmptyCourseStats(unitsOfCourse(courseId)));
  const [continueTarget, setContinueTarget] = useState<ContinueTarget | null>(null);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    const courseUnits = unitsOfCourse(courseId);
    setStats(getCourseStats(courseUnits));
    setContinueTarget(getContinueLearning(courseUnits));
  }, [courseId]);

  useEffect(() => {
    refresh();
    setMounted(true);
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, [refresh]);

  return { stats, continueTarget, refresh, mounted };
}
