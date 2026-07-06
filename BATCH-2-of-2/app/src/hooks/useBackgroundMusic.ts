"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getProgress,
  setMusicEnabled as persistMusicEnabled,
  PROGRESS_UPDATED_EVENT,
} from "@/lib/progress";
import {
  startBackgroundMusic,
  stopBackgroundMusic,
  skipBackgroundMusicTrack,
  onMusicTrackChange,
  getCurrentMusicTrack,
} from "@/lib/backgroundMusic";
import type { MusicTrack } from "@/data/musicTracks";

/** Client-side hook for the optional calm background music (off by default). */
export function useBackgroundMusic() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<MusicTrack | null>(null);

  useEffect(() => {
    const initial = getProgress().musicEnabled;
    setEnabled(initial);
    setMounted(true);
    if (initial) startBackgroundMusic();
    setNowPlaying(getCurrentMusicTrack());

    const unsubscribe = onMusicTrackChange(setNowPlaying);
    const handler = () => setEnabled(getProgress().musicEnabled);
    window.addEventListener(PROGRESS_UPDATED_EVENT, handler);
    return () => {
      unsubscribe();
      window.removeEventListener(PROGRESS_UPDATED_EVENT, handler);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    persistMusicEnabled(next);
    setEnabled(next);
    if (next) {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
  }, [enabled]);

  const skipTrack = useCallback(() => {
    skipBackgroundMusicTrack();
  }, []);

  return { enabled, mounted, toggle, nowPlaying, skipTrack };
}
