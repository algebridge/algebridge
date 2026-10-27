/**
 * How the arena's host and players talk (lib/arena-live.ts for what they say).
 *
 * Over the network it is one Supabase Realtime channel per room, `arena-CODE`,
 * broadcast only: the host sends `host` events, players send `player`
 * events. Nothing is stored; a room lives as long as its host's tab. The
 * channel is public (no sign-in needed to join from a phone), which is fine
 * because the room holds nothing but first names, answers and scores, and
 * the code is six letters from twenty-three, picked at random.
 *
 * On one computer the same messages go through a loop in memory, so the
 * host screen and the seats are the same code paths as the real thing.
 */

import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { HostMessage, PlayerMessage } from "@/lib/arena-live";

export interface ArenaTransport {
  /** Resolves once the room can carry messages (or rejects when it cannot). */
  ready: Promise<void>;
  sendHost(m: HostMessage): void;
  sendPlayer(m: PlayerMessage): void;
  onHost(fn: (m: HostMessage) => void): () => void;
  onPlayer(fn: (m: PlayerMessage) => void): () => void;
  close(): void;
}

export function channelName(code: string): string {
  return `arena-${code}`;
}

/** A room over Supabase Realtime. */
export function realtimeTransport(code: string): ArenaTransport | null {
  if (!isSupabaseConfigured()) return null;
  // Its own client, not the app's shared one: the shared client hands back
  // the same channel object for the same topic, so a room closed and reopened
  // in the same tab (React's development double-mount does exactly that)
  // would get a channel that is half torn down.
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { isSingleton: false });
  const hostFns = new Set<(m: HostMessage) => void>();
  const playerFns = new Set<(m: PlayerMessage) => void>();
  const channel = supabase.channel(channelName(code), { config: { broadcast: { self: false, ack: false } } });
  channel
    .on("broadcast", { event: "host" }, ({ payload }) => {
      for (const fn of hostFns) fn(payload as HostMessage);
    })
    .on("broadcast", { event: "player" }, ({ payload }) => {
      for (const fn of playerFns) fn(payload as PlayerMessage);
    });
  const ready = new Promise<void>((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") resolve();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(err ?? new Error(status));
    });
  });
  return {
    ready,
    sendHost(m) {
      void channel.send({ type: "broadcast", event: "host", payload: m });
    },
    sendPlayer(m) {
      void channel.send({ type: "broadcast", event: "player", payload: m });
    },
    onHost(fn) {
      hostFns.add(fn);
      return () => hostFns.delete(fn);
    },
    onPlayer(fn) {
      playerFns.add(fn);
      return () => playerFns.delete(fn);
    },
    close() {
      void supabase.removeChannel(channel).then(() => supabase.realtime.disconnect());
    },
  };
}

/** A room inside one tab: the host and every seat share it. */
export function localTransport(): ArenaTransport {
  const hostFns = new Set<(m: HostMessage) => void>();
  const playerFns = new Set<(m: PlayerMessage) => void>();
  const later = (fn: () => void) => window.setTimeout(fn, 0);
  return {
    ready: Promise.resolve(),
    sendHost(m) {
      later(() => {
        for (const fn of hostFns) fn(m);
      });
    },
    sendPlayer(m) {
      later(() => {
        for (const fn of playerFns) fn(m);
      });
    },
    onHost(fn) {
      hostFns.add(fn);
      return () => hostFns.delete(fn);
    },
    onPlayer(fn) {
      playerFns.add(fn);
      return () => playerFns.delete(fn);
    },
    close() {
      hostFns.clear();
      playerFns.clear();
    },
  };
}
