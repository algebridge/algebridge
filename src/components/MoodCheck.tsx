"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { MOODS, MOOD_KEY, moodAllowedOn, moodContext, moodDueAfter } from "@/lib/insights";
import { trackInsight } from "@/lib/insights-client";

const TICK_MS = 5000;
/** The card goes away on its own after this long, counted as dismissed. */
const LINGER_MS = 45_000;

function readAsked(): number | null {
  try {
    const v = Number(window.localStorage.getItem(MOOD_KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeAsked(now: number): void {
  try {
    window.localStorage.setItem(MOOD_KEY, String(now));
  } catch {
    /* storage unavailable: the card may show again next visit */
  }
}

/**
 * A small card at the top right, a few minutes into a visit, at most once
 * every six hours: "How are you feeling at this exact moment?" and five
 * words to pick from. One tap answers; the answer, the kind of page, and
 * nothing else goes to the insights count. Never shown to admins, on a live
 * call, or on the sign-in and console pages.
 */
export function MoodCheck() {
  const pathname = usePathname() ?? "/";
  const { profile, loading } = useAuth();
  const isAdmin = profile?.isAdmin ?? false;
  const [show, setShow] = useState(false);
  const [thanks, setThanks] = useState(false);
  const active = useRef(0);
  const due = useRef<number | null | undefined>(undefined);
  const lingerTimer = useRef<number | null>(null);
  const contextRef = useRef("other");
  const headingId = "mood-check-title";

  const close = useCallback((answered: boolean) => {
    if (lingerTimer.current) window.clearTimeout(lingerTimer.current);
    lingerTimer.current = null;
    setShow(false);
    if (!answered) trackInsight({ name: "mood_dismiss", label: contextRef.current });
  }, []);

  // Count active time, and open the card once it is due.
  useEffect(() => {
    if (loading || isAdmin) return;
    if (due.current === undefined) due.current = moodDueAfter(readAsked(), Date.now());
    // On a development build, ?mood=now opens the card at once, to look at it.
    if (process.env.NODE_ENV !== "production" && window.location.search.includes("mood=now")) due.current = 0;
    if (due.current === null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      active.current += TICK_MS;
      if (due.current == null || active.current < due.current) return;
      if (!moodAllowedOn(window.location.pathname)) return;
      due.current = null;
      writeAsked(Date.now());
      contextRef.current = moodContext(window.location.pathname);
      setShow(true);
      lingerTimer.current = window.setTimeout(() => close(false), LINGER_MS);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [loading, isAdmin, close]);

  // Leaving for a page where the card does not belong closes it.
  useEffect(() => {
    if (show && !moodAllowedOn(pathname)) close(false);
  }, [pathname, show, close]);

  function answer(value: number) {
    trackInsight({ name: "mood", label: contextRef.current, value });
    close(true);
    setThanks(true);
    window.setTimeout(() => setThanks(false), 2500);
  }

  if (thanks) {
    return (
      <div role="status" className="fixed right-3 top-[4.25rem] z-[190] rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-lg sm:right-4">
        Thanks for telling us.
      </div>
    );
  }
  if (!show) return null;

  return (
    <section
      role="dialog"
      aria-labelledby={headingId}
      className="fixed left-3 right-3 top-[4.25rem] z-[190] rounded-2xl bg-surface p-4 shadow-raised ring-1 ring-slate-900/10 sm:left-auto sm:right-4 sm:w-[21rem]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={headingId} className="text-[15px] font-bold leading-snug text-slate-900">
          How are you feeling at this exact moment?
        </h2>
        <button
          type="button"
          onClick={() => close(false)}
          className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          Not now
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Pick one">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => answer(m.value)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {m.word}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">One tap. Your answer is counted, never tied to your name.</p>
    </section>
  );
}
