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

/**
 * Client-side hook for optional, mutable UI sound effects (off by default).
 * `muted`: the /demo pages, which play nothing and read no setting, so a
 * demo touches no storage.
 */
export function useSound({ muted = false }: { muted?: boolean } = {}) {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (muted) return;
    setEnabled(getProgress().soundEnabled);
    setMounted(true);
    const handler = () => setEnabled(getProgress().soundEnabled);
    window.addEventListener(PROGRESS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, handler);
  }, [muted]);

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

  /** A right answer in a run: the chime climbs a step with each one, up to an octave. */
  const playCombo = useCallback((run: number) => {
    if (!enabled) return;
    const up = Math.pow(2, Math.min(12, Math.max(0, run - 1)) / 12);
    playTones([523.25 * up, 659.25 * up, 783.99 * up], [0.07, 0.07, 0.16], run >= 5 ? "triangle" : "sine");
  }, [enabled]);

  /** A run of two or more ends: a short falling crack. */
  const playBreak = useCallback(() => {
    if (!enabled) return;
    playTones([392, 196, 98], [0.05, 0.08, 0.22], "square");
  }, [enabled]);

  return { enabled, mounted, toggle, playCorrect, playWrong, playLevelUp, playCombo, playBreak };
}
