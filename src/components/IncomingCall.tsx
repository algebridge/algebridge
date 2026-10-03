"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loadManagedFlag, sendCallDecline, subscribeToRing, verifyCaller, type RingPayload } from "@/lib/social";
import { showToast } from "@/lib/notify";
import { Icon } from "@/components/Icon";
import { isBlocked, readBlocked } from "@/lib/safety";
import { useSchoolMode } from "@/components/SchoolModePanel";
import { setManagedAccount } from "@/lib/school-mode";
import { useDialogFocus } from "@/components/useDialogFocus";

/**
 * App-wide listener that "rings" the current user when someone calls them.
 * Mounted in the root layout so it works on every page while signed in.
 *
 * A ring from someone this student blocked on this device is ignored, and in
 * school mode (src/lib/school-mode.ts) there are no calls, so nothing is
 * listened for at all. The name shown is the caller's own profile name, not
 * the name the ring carries, so a ring cannot claim to be someone else. A
 * ring rings only when the caller has a staff account: tutor, teacher or
 * admin (verifyCaller).
 *
 * Mounted on every page, it also reads whether the signed-in account is
 * managed by a school (profiles.managed) and turns school mode on for it, so
 * a class member gets the school menus at learn.algebridge.org too.
 *
 * The ring is an alert dialog: a screen reader announces who is calling,
 * focus moves to Answer, Tab stays on Answer and Decline, and Escape
 * declines. A key press already on its way (a student typing an answer when
 * the ring lands) cannot answer by accident: for the first second a key does
 * not press Answer or Decline. A pointer click, or a screen reader's, counts.
 */
export function IncomingCall() {
  const { user, profile } = useAuth();
  const school = useSchoolMode();
  const router = useRouter();
  const [incoming, setIncoming] = useState<RingPayload | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  /** performance.now() when focus moved to Answer, and when a key was last pressed. */
  const shownAt = useRef(0);
  const lastKeyAt = useRef(0);
  /** A key event is being handled right now (a click it causes comes in the same task). */
  const keyNow = useRef(false);

  const myName = profile?.displayName || user?.email?.split("@")[0] || "Me";

  // School mode for a school-managed account, wherever it signs in. Cleared
  // when nobody is signed in, so the next person on a shared computer starts
  // from the build's own switch.
  useEffect(() => {
    if (!user) {
      setManagedAccount(false);
      return;
    }
    let live = true;
    loadManagedFlag(user.id).then((managed) => {
      if (live) setManagedAccount(managed);
    });
    return () => {
      live = false;
    };
  }, [user]);

  function stopSound() {
    if (audioRef.current) {
      clearInterval(audioRef.current.timer);
      audioRef.current.ctx.close().catch(() => {});
      audioRef.current = null;
    }
  }

  function stopRing() {
    stopSound();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  /** The sound only; the 30 second give-up timer is set by the ring itself. */
  function startRing() {
    stopSound();
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
      /* audio not available, the visual ring still shows */
    }
  }

  useEffect(() => {
    if (!user || school) return;
    const unsub = subscribeToRing(
      user.id,
      (payload) => {
        if (isBlocked(readBlocked(user.id), payload.callerId)) return;
        // Only staff may call (a tutor, a teacher, an admin), checked against
        // the caller's own account before anything rings. An admin whose
        // profile says "student" used to be ignored here.
        verifyCaller(payload.callerId).then((caller) => {
          if (!caller.ok) return;
          setIncoming({ ...payload, callerName: caller.name || "Your tutor" });
          // After the ring is on screen: starting audio can hold the page up.
          // Not if it was answered or declined in between (stopRing clears timeoutRef).
          window.setTimeout(() => {
            if (timeoutRef.current) startRing();
          }, 0);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            stopRing();
            setIncoming(null);
          }, 30000);
        });
      },
      (byName) => {
        showToast({ icon: "phone", tone: "info", title: `${byName} declined the call.` });
      }
    );
    return () => {
      unsub();
      stopRing();
      setIncoming(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, school]);

  useDialogFocus(dialogRef, !!incoming, () => decline());
  // Runs right after the focus moves to Answer. Key presses are timed by when
  // they happened (the event's timeStamp), so keys a student typed while the
  // page was busy still count as early.
  useEffect(() => {
    if (!incoming) return;
    shownAt.current = performance.now();
    const onKey = (e: KeyboardEvent) => {
      lastKeyAt.current = e.timeStamp;
      keyNow.current = true;
      window.setTimeout(() => {
        keyNow.current = false;
      }, 0);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
    };
  }, [incoming]);

  if (!incoming) return null;

  /**
   * A click that came from a key pressed in the ring's first second is the
   * student still typing, not an answer. A pointer click (detail above 0),
   * or a screen reader's click (no key press reached the page), always counts.
   */
  function tooSoon(e?: React.MouseEvent) {
    if (!e || e.detail !== 0 || !keyNow.current) return false;
    return lastKeyAt.current - shownAt.current < 1000;
  }

  function accept(e?: React.MouseEvent) {
    if (tooSoon(e)) return;
    const call = incoming!;
    stopRing();
    setIncoming(null);
    router.push(`/room/${call.roomId}?with=${call.callerId}`);
  }
  function decline(e?: React.MouseEvent) {
    if (tooSoon(e) || !incoming) return;
    const call = incoming;
    stopRing();
    sendCallDecline(call.callerId, myName);
    setIncoming(null);
  }

  return (
    <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="animate-pop-in flex w-full max-w-md flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
      >
        <div className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-bridge-100 text-bridge-700" aria-hidden>
          <Icon name="phone" size={20} />
        </div>
        {/* On a phone the buttons go to their own row, so the name is not cut short. */}
        <p id={titleId} className="min-w-0 flex-1 basis-28">
          <span className="block truncate font-semibold text-slate-900">{incoming.callerName}</span>{" "}
          <span className="block text-xs text-slate-600">is calling you</span>
        </p>
        <div className="ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            onClick={(e) => decline(e)}
            className="rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            Decline
          </button>
          <button
            type="button"
            data-autofocus
            onClick={(e) => accept(e)}
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          >
            Answer
          </button>
        </div>
      </div>
    </div>
  );
}
