"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getPublicProfile, sendCallDecline, subscribeToRing, type RingPayload } from "@/lib/social";
import { showToast } from "@/lib/notify";

/**
 * App-wide listener that "rings" the current user when someone calls them.
 * Mounted in the root layout so it works on every page while signed in.
 */
export function IncomingCall() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [incoming, setIncoming] = useState<RingPayload | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myName = profile?.displayName || user?.email?.split("@")[0] || "Me";

  function stopRing() {
    if (audioRef.current) {
      clearInterval(audioRef.current.timer);
      audioRef.current.ctx.close().catch(() => {});
      audioRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function startRing() {
    stopRing();
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const beep = () => {
        // Two quick tones = a phone-ring cadence.
        [0, 0.4].forEach((t) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = 520;
          osc.type = "sine";
          gain.gain.setValueAtTime(0.0001, ctx.currentTime + t);
          gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(ctx.currentTime + t);
          osc.stop(ctx.currentTime + t + 0.32);
        });
      };
      beep();
      const timer = setInterval(beep, 2500);
      audioRef.current = { ctx, timer };
    } catch {
      /* audio not available — the visual ring still shows */
    }
  }

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRing(
      user.id,
      (payload) => {
        // Only tutors may call. Verify the caller is actually a tutor before
        // ringing — a non-tutor caller's profile is either role!='tutor' or
        // not readable (RLS), so the ring is ignored.
        getPublicProfile(payload.callerId).then((caller) => {
          if (caller?.role !== "tutor") return;
          setIncoming(payload);
          startRing();
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            stopRing();
            setIncoming(null);
          }, 30000);
        });
      },
      (byName) => {
        showToast({ emoji: "📵", title: `${byName} declined the call.` });
      }
    );
    return () => {
      unsub();
      stopRing();
      setIncoming(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!incoming) return null;

  function accept() {
    const call = incoming!;
    stopRing();
    setIncoming(null);
    router.push(`/room/${call.roomId}?with=${call.callerId}`);
  }
  function decline() {
    const call = incoming!;
    stopRing();
    sendCallDecline(call.callerId, myName);
    setIncoming(null);
  }

  return (
    <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div className="animate-pop-in flex w-full max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-bridge-100 text-xl">
          📞
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{incoming.callerName}</p>
          <p className="text-xs text-slate-500">is calling you…</p>
        </div>
        <button
          type="button"
          onClick={decline}
          className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={accept}
          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Join
        </button>
      </div>
    </div>
  );
}
