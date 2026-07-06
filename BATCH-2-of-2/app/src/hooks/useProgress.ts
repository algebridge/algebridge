import { useCallback, useEffect, useState } from "react";
import {
  getCourseStats,
  getContinueLearning,
  getEmptyCourseStats,
  PROGRESS_UPDATED_EVENT,
  type CourseStats,
  type ContinueTarget,
} from "@/lib/progress";

export function useProgress() {
  const [stats, setStats] = useState<CourseStats>(getEmptyCourseStats);
  const [continueTarget, setContinueTarget] = useState<ContinueTarget | null>(null);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setStats(getCourseStats());
    setContinueTarget(getContinueLearning());
  }, []);

  useEffect(() => {
    refresh();
    setMounted(true);
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, [refresh]);

  return { stats, continueTarget, refresh, mounted };
}
