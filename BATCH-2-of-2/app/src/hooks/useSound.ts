"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getProgress,
  setSoundEnabled as persistSoundEnabled,
  PROGRESS_UPDATED_EVENT,
} from "@/lib/progress";
import { getAudioContext } from "@/lib/audioContext";

function playTones(
  freqs: number[],
  durations: number[],
  type: OscillatorType = "sine"
) {
  const ctx = getAudioContext();
  if (!ctx) return;
  let t = ctx.currentTime;
  freqs.forEach((freq, i) => {
    const duration = durations[i] ?? durations[durations.length - 1] ?? 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    t += duration;
  });
}

/** Client-side hook for optional, mutable UI sound effects (off by default). */
export function useSound() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEnabled(getProgress().soundEnabled);
    setMounted(true);
    const handler = () => setEnabled(getProgress().soundEnabled);
    window.addEventListener(PROGRESS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handler);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    persistSoundEnabled(next);
    setEnabled(next);
  }, [enabled]);

  const playCorrect = useCallback(() => {
    if (!enabled) return;
    playTones([523.25, 659.25, 783.99], [0.09, 0.09, 0.18], "sine");
  }, [enabled]);

  const playWrong = useCallback(() => {
    if (!enabled) return;
    playTones([220, 174.61], [0.12, 0.2], "sine");
  }, [enabled]);

  const playLevelUp = useCallback(() => {
    if (!enabled) return;
    playTones([523.25, 659.25, 783.99, 1046.5], [0.08, 0.08, 0.08, 0.3], "triangle");
  }, [enabled]);

  return { enabled, mounted, toggle, playCorrect, playWrong, playLevelUp };
}
