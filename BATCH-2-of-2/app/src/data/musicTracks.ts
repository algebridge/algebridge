export interface MusicTrack {
  id: string;
  title: string;
  src: string;
  /** Required attribution text for the CC BY license these tracks are released under. */
  credit: string;
}

/**
 * Calm, real (non-generated) background music for studying — solo piano and
 * gentle guitar/strings pieces, licensed under Creative Commons Attribution 3.0.
 * All tracks by Kevin MacLeod (incompetech.com).
 */
export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: "midsummer-sky",
    title: "Midsummer Sky",
    src: "/audio/midsummer-sky.mp3",
    credit: "“Midsummer Sky” by Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 3.0",
  },
  {
    id: "windswept",
    title: "Windswept",
    src: "/audio/windswept.mp3",
    credit: "“Windswept” by Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 3.0",
  },
  {
    id: "meditation-impromptu-01",
    title: "Meditation Impromptu No. 1",
    src: "/audio/meditation-impromptu-01.mp3",
    credit: "“Meditation Impromptu 01” by Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 3.0",
  },
];
