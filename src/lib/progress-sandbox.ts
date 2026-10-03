"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setProgressStore } from "@/lib/bridgeys";
import type { UserProgress } from "@/types";

/**
 * A progress that lives only as long as the component does. The /demo pages
 * run the real house, shop and economy on one of these, so a visitor can buy
 * and place pieces and nothing reaches localStorage or the cloud.
 *
 * While mounted, the economy's load and save point here (setProgressStore in
 * lib/bridgeys.ts); on unmount they go back to the student's own save. The
 * load hands out a copy, the way getProgress parses a fresh object from
 * storage, so the economy's in-place edits never touch the object React is
 * rendering and every save is a new object, which is what re-renders.
 */
export function useProgressSandbox(seed: () => UserProgress): { progress: UserProgress; refresh: () => void } {
  const [progress, setProgress] = useState<UserProgress>(seed);
  const current = useRef(progress);

  useEffect(() => {
    setProgressStore({
      get: () => structuredClone(current.current),
      save: (next) => {
        current.current = next;
        setProgress(next);
      },
    });
    return () => setProgressStore(null);
  }, []);

  // The house calls this after every change, as /house calls getProgress.
  const refresh = useCallback(() => setProgress(current.current), []);

  return { progress, refresh };
}
