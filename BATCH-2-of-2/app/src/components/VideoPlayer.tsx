"use client";

import { useEffect, useRef, useState } from "react";
import type { Video } from "@/types";
import { parseDurationToSeconds, youtubeEmbedUrl, youtubeWatchUrl } from "@/data/videos";
import { loadYouTubeApi, type YTPlayer } from "@/lib/youtubeApi";

interface VideoPlayerProps {
  video: Video;
  backupVideo?: Video;
  onWatched?: () => void;
}

// Consider a video "watched" once the student has actually played through
// this fraction of it (tracked via real playback time, not just page load).
const WATCH_THRESHOLD = 0.85;
// If the real YouTube API can't attach (blocked script, offline, etc.) fall
// back to a manual confirm button that unlocks after most of the runtime.
const API_TIMEOUT_MS = 4000;
// Used when a video's duration can't be determined for some reason — keeps
// the fallback/verification gates from accidentally unlocking in seconds.
const FALLBACK_DURATION_SECONDS = 300;
// Absolute floor: never mark a video watched faster than this, no matter what
// any API/timer reports — a real ~85% watch of a multi-minute lesson always
// takes at least this long, so this catches any tracking glitch or race.
const MIN_SECONDS_BEFORE_WATCHED = 20;

export function VideoPlayer({ video, backupVideo, onWatched }: VideoPlayerProps) {
  const [activeVideo, setActiveVideo] = useState(video);
  const [loaded, setLoaded] = useState(false);
  const [watched, setWatched] = useState(false);
  const [watchPercent, setWatchPercent] = useState(0);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackUnlocked, setFallbackUnlocked] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const apiTimeoutRef = useRef<number | null>(null);
  const fallbackTimeoutRef = useRef<number | null>(null);
  const watchedRef = useRef(false);
  // Real wall-clock seconds confirmed as "actively playing" — accumulated by
  // the poll ticking while state === PLAYING, never trusted from a single
  // getCurrentTime()/getDuration() read (those can glitch/report stale values).
  const secondsWatchedRef = useRef(0);
  const loadTimeRef = useRef(0);
  const knownDurationRef = useRef(0);
  const iframeId = `yt-iframe-${activeVideo.id}`;

  const watchUrl = youtubeWatchUrl(activeVideo.youtubeId);

  function requiredSeconds() {
    const fromApi = knownDurationRef.current;
    const fromLabel = parseDurationToSeconds(activeVideo.duration);
    const duration = fromApi > 0 ? fromApi : fromLabel > 0 ? fromLabel : FALLBACK_DURATION_SECONDS;
    return duration * WATCH_THRESHOLD;
  }

  function elapsedSinceLoad() {
    return loadTimeRef.current ? (Date.now() - loadTimeRef.current) / 1000 : 0;
  }

  function markWatched() {
    if (watchedRef.current) return;
    // Defense in depth: don't trust any single signal (API state, timers) —
    // require real elapsed time to have passed since the video actually loaded.
    if (elapsedSinceLoad() < MIN_SECONDS_BEFORE_WATCHED) return;
    watchedRef.current = true;
    setWatched(true);
    setWatchPercent(100);
    onWatched?.();
  }

  function cleanupTrackers() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (apiTimeoutRef.current) window.clearTimeout(apiTimeoutRef.current);
    if (fallbackTimeoutRef.current) window.clearTimeout(fallbackTimeoutRef.current);
    pollRef.current = null;
    apiTimeoutRef.current = null;
    fallbackTimeoutRef.current = null;
    try {
      playerRef.current?.destroy();
    } catch {
      // player may already be torn down
    }
    playerRef.current = null;
  }

  // Reset all tracking whenever the active video changes.
  useEffect(() => {
    cleanupTrackers();
    watchedRef.current = false;
    secondsWatchedRef.current = 0;
    loadTimeRef.current = 0;
    knownDurationRef.current = 0;
    setLoaded(false);
    setWatched(false);
    setWatchPercent(0);
    setFallbackMode(false);
    setFallbackUnlocked(false);
    return cleanupTrackers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVideo.id]);

  function handleIframeLoad() {
    // YouTube can fire onLoad more than once for the same iframe (e.g. after
    // navigating within the embed); guard against re-initializing trackers
    // and stacking duplicate timers/players on top of the existing ones.
    if (loadTimeRef.current) return;

    setLoaded(true);
    loadTimeRef.current = Date.now();

    // Give the real IFrame API a few seconds to attach; if it doesn't,
    // fall back to a time-gated manual confirmation instead.
    apiTimeoutRef.current = window.setTimeout(() => {
      if (!playerRef.current) {
        setFallbackMode(true);
        fallbackTimeoutRef.current = window.setTimeout(
          () => setFallbackUnlocked(true),
          Math.max(requiredSeconds() * 1000, MIN_SECONDS_BEFORE_WATCHED * 1000)
        );
      }
    }, API_TIMEOUT_MS);

    loadYouTubeApi()
      .then((YT) => {
        if (watchedRef.current) return;
        try {
          playerRef.current = new YT.Player(iframeId, {
            events: {
              onStateChange: (event) => {
                const isPlaying = event.data === YT.PlayerState.PLAYING;
                const isEnded = event.data === YT.PlayerState.ENDED;

                if (isEnded) {
                  // Ignore spurious/instant "ended" events — only trust it once
                  // we've independently confirmed a meaningful chunk of real
                  // playback time via the poll below.
                  if (secondsWatchedRef.current >= requiredSeconds() * 0.5) {
                    markWatched();
                  }
                  return;
                }

                if (isPlaying) {
                  if (pollRef.current) window.clearInterval(pollRef.current);
                  pollRef.current = window.setInterval(() => {
                    const player = playerRef.current;
                    if (!player) return;
                    const duration = player.getDuration();
                    if (duration > 0) knownDurationRef.current = duration;

                    // Each tick of this interval only runs while state is
                    // confirmed PLAYING, so accumulating +1s here is a much
                    // more reliable signal than trusting getCurrentTime().
                    secondsWatchedRef.current += 1;

                    const need = requiredSeconds();
                    const percent = need > 0
                      ? Math.min(100, Math.round((secondsWatchedRef.current / need) * 100))
                      : 0;
                    setWatchPercent(percent);

                    if (secondsWatchedRef.current >= need) {
                      markWatched();
                    }
                  }, 1000);
                } else if (pollRef.current) {
                  window.clearInterval(pollRef.current);
                  pollRef.current = null;
                }
              },
            },
          });
        } catch {
          setFallbackMode(true);
        }
      })
      .catch(() => setFallbackMode(true));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-lg">
      <div className="relative aspect-video w-full bg-slate-900">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm text-slate-400">Loading video…</p>
          </div>
        )}
        <iframe
          id={iframeId}
          key={activeVideo.youtubeId}
          src={youtubeEmbedUrl(activeVideo.youtubeId)}
          title={activeVideo.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
          onLoad={handleIframeLoad}
        />
      </div>
      <div className="bg-slate-900 px-4 py-3">
        <p className="font-medium text-white">{activeVideo.title}</p>
        <p className="text-sm text-slate-400">
          {activeVideo.channel} · {activeVideo.duration}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-200 hover:text-white"
          >
            Open on YouTube ↗
          </a>
          {backupVideo && (
            <button
              type="button"
              onClick={() =>
                setActiveVideo(activeVideo.id === video.id ? backupVideo : video)
              }
              className="text-xs text-slate-200 hover:text-white"
            >
              Switch video:{" "}
              {activeVideo.id === video.id ? backupVideo.title : video.title}
            </button>
          )}
        </div>

        {!watched && loaded && !fallbackMode && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${watchPercent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {watchPercent > 0
                ? `${watchPercent}% watched — press play to keep tracking your progress`
                : "Press ▶ play to start tracking your progress"}
            </p>
          </div>
        )}

        {!watched && fallbackMode && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
            <p className="text-xs text-slate-400">
              {fallbackUnlocked
                ? "Finished the video? Confirm below."
                : "Keep watching — this unlocks once you've seen most of the video."}
            </p>
            <button
              type="button"
              disabled={!fallbackUnlocked}
              onClick={markWatched}
              className="shrink-0 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-slate-600"
            >
              ✓ I watched it
            </button>
          </div>
        )}

        {watched && (
          <p className="mt-2 text-xs text-emerald-400">✓ Video marked as watched</p>
        )}
      </div>
    </div>
  );
}
