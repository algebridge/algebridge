import { MUSIC_TRACKS, type MusicTrack } from "@/data/musicTracks";

/**
 * Plays real, calm background music (real recordings, not synthesized tones)
 * through a single shared <audio> element. Tracks are shuffled into a
 * playlist that loops forever, with soft fade-in/fade-out so it never feels
 * abrupt. Volume is kept low — this is meant to sit quietly behind the app.
 */

const TARGET_VOLUME = 0.28;
const FADE_MS = 1400;

interface MusicState {
  audio: HTMLAudioElement | null;
  playing: boolean;
  order: number[];
  orderIndex: number;
  fadeTimer: ReturnType<typeof setInterval> | null;
  listeners: Set<(track: MusicTrack | null) => void>;
}

const state: MusicState = {
  audio: null,
  playing: false,
  order: [],
  orderIndex: 0,
  fadeTimer: null,
  listeners: new Set(),
};

function shuffledOrder(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clearFade() {
  if (state.fadeTimer) {
    clearInterval(state.fadeTimer);
    state.fadeTimer = null;
  }
}

function fadeVolume(audio: HTMLAudioElement, target: number, durationMs: number, onDone?: () => void) {
  clearFade();
  const start = audio.volume;
  const steps = Math.max(1, Math.round(durationMs / 50));
  let step = 0;
  state.fadeTimer = setInterval(() => {
    step += 1;
    audio.volume = Math.max(0, Math.min(1, start + (target - start) * (step / steps)));
    if (step >= steps) {
      clearFade();
      onDone?.();
    }
  }, 50);
}

function currentTrack(): MusicTrack | null {
  if (state.order.length === 0) return null;
  return MUSIC_TRACKS[state.order[state.orderIndex]] ?? null;
}

function notifyListeners() {
  const track = state.playing ? currentTrack() : null;
  state.listeners.forEach((cb) => cb(track));
}

function ensureAudioElement(): HTMLAudioElement {
  if (!state.audio) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("ended", () => advanceTrack());
    state.audio = audio;
  }
  return state.audio;
}

function playCurrent(fadeIn: boolean) {
  const audio = ensureAudioElement();
  const track = currentTrack();
  if (!track) return;
  audio.src = track.src;
  audio.volume = fadeIn ? 0 : TARGET_VOLUME;
  audio.play().catch(() => {
    // Autoplay can be blocked outside a user gesture — the toggle button
    // click is itself a gesture, so this normally succeeds.
  });
  if (fadeIn) fadeVolume(audio, TARGET_VOLUME, FADE_MS);
  notifyListeners();
}

function advanceTrack() {
  if (!state.playing) return;
  state.orderIndex += 1;
  if (state.orderIndex >= state.order.length) {
    state.order = shuffledOrder(MUSIC_TRACKS.length);
    state.orderIndex = 0;
  }
  playCurrent(true);
}

export function startBackgroundMusic(): void {
  if (typeof window === "undefined" || state.playing || MUSIC_TRACKS.length === 0) return;
  if (state.order.length === 0) {
    state.order = shuffledOrder(MUSIC_TRACKS.length);
    state.orderIndex = 0;
  }
  state.playing = true;
  playCurrent(true);
}

export function stopBackgroundMusic(): void {
  if (!state.playing || !state.audio) return;
  state.playing = false;
  const audio = state.audio;
  fadeVolume(audio, 0, FADE_MS, () => {
    audio.pause();
  });
  notifyListeners();
}

/** Skips ahead to a new (still shuffled) track without waiting for the current one to end. */
export function skipBackgroundMusicTrack(): void {
  if (!state.playing) return;
  advanceTrack();
}

export function isBackgroundMusicPlaying(): boolean {
  return state.playing;
}

export function getCurrentMusicTrack(): MusicTrack | null {
  return state.playing ? currentTrack() : null;
}

/** Subscribe to "now playing" changes (e.g. to show the track title in the UI). Returns an unsubscribe function. */
export function onMusicTrackChange(cb: (track: MusicTrack | null) => void): () => void {
  state.listeners.add(cb);
  return () => state.listeners.delete(cb);
}
