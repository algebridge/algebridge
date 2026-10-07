"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archie } from "@/components/archie/Archie";
import { countClick } from "@/components/Analytics";
import { useSchoolMode } from "@/components/SchoolModePanel";
import { useAuth } from "@/lib/auth";
import { isBareRoute } from "@/lib/bare-route";
import { placeCard, tourMayStartOn, tourSteps, TOUR_DONE_KEY, TOUR_STEP_KEY, type Box } from "@/lib/tour";

/** Room around what the spotlight points at. */
const PAD = 8;

function stored(key: string, session = false): string | null {
  try {
    return (session ? window.sessionStorage : window.localStorage).getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null, session = false): void {
  try {
    const s = session ? window.sessionStorage : window.localStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* storage blocked: the tour simply shows again next time */
  }
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The welcome tour for a first visit without an account (lib/tour.ts has the
 * steps and why). It moves the visitor through the real pages and points at
 * the real thing on each, with Archie on a card beside it, and ends on a free
 * account. Outside the spotlight the page waits; inside, it works, so the
 * sample problem can be answered on the spot. Esc or Skip ends it for good;
 * "Take the tour" in the menu starts it again. Each button is counted
 * (Analytics countClick), so the admin console shows whether it helps.
 */
export function WelcomeTour() {
  const { user, loading, configured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const school = useSchoolMode();
  const steps = useMemo(() => tourSteps(school), [school]);

  const [step, setStep] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [view, setView] = useState({ w: 1024, h: 768 });
  const [cardH, setCardH] = useState(260);
  const target = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLElement>(null);
  /** The page the tour itself is opening, so a page the visitor goes to on their own ends it. */
  const opening = useRef<string | null>(null);
  /** The page a step was shown on, and which step. */
  const shownOn = useRef<string | null>(null);
  const shownStep = useRef<number | null>(null);

  const end = useCallback((label: string | null) => {
    if (label) countClick(label);
    store(TOUR_DONE_KEY, "1");
    store(TOUR_STEP_KEY, null, true);
    target.current = null;
    opening.current = null;
    shownOn.current = null;
    shownStep.current = null;
    setStep(null);
    setReady(false);
    setBox(null);
  }, []);

  const start = useCallback(() => {
    store(TOUR_STEP_KEY, "0", true);
    setStep(0);
  }, []);

  // A signed-out first visit starts it, a moment after the page is up; a
  // reload in the middle of a tour picks it up where it was.
  useEffect(() => {
    if (loading || !configured || user || step !== null || isBareRoute(pathname)) return;
    const saved = Number(stored(TOUR_STEP_KEY, true));
    if (Number.isInteger(saved) && saved > 0 && saved < steps.length) {
      setStep(saved);
      return;
    }
    if (stored(TOUR_DONE_KEY) || !tourMayStartOn(pathname)) return;
    const id = window.setTimeout(start, 1200);
    return () => window.clearTimeout(id);
  }, [loading, configured, user, pathname, step, steps.length, start]);

  // Signing in or up during the tour ends it: there is nothing left to show.
  useEffect(() => {
    if (user && step !== null) end(null);
  }, [user, step, end]);

  // Each step: open its page, then find what it points at.
  useEffect(() => {
    if (step === null) return;
    const s = steps[step];
    if (!s) return end(null);
    // The visitor went to another page on their own (the Back button, a link
    // inside the spotlight): the tour steps aside rather than pulling them back.
    if (shownStep.current === step && shownOn.current && pathname !== shownOn.current && !opening.current) {
      return end(pathname === "/login" ? "tour-signup" : "tour-left");
    }
    store(TOUR_STEP_KEY, String(step), true);
    setReady(false);
    setBox(null);
    target.current = null;
    if (s.route && pathname !== s.route) {
      if (opening.current !== s.route) {
        opening.current = s.route;
        router.push(s.route);
      }
      return;
    }
    opening.current = null;
    shownOn.current = pathname;
    shownStep.current = step;
    if (!s.target) {
      setReady(true);
      return;
    }
    let tries = 0;
    let timer = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        // There but hidden (the header's Create account on a phone): the card stands alone.
        if (r.width > 0 && r.height > 0) {
          target.current = el;
          // A tall part, or any part on a phone (where the card sits at the
          // bottom), goes to the top of the window, under the header.
          const toTop = r.height > window.innerHeight * 0.55 || window.innerWidth < 640;
          if (toTop) window.scrollTo({ top: window.scrollY + r.top - 76, behavior: reducedMotion() ? "auto" : "smooth" });
          else el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
        }
        setReady(true);
        return;
      }
      // Still loading: look again, for up to four seconds.
      if (++tries > 40) return setReady(true);
      timer = window.setTimeout(find, 100);
    };
    timer = window.setTimeout(find, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pathname]);

  // The spotlight follows its target as the page scrolls, resizes or finishes loading.
  useEffect(() => {
    if (step === null || !ready) return;
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setView((v) => (v.w === vw && v.h === vh ? v : { w: vw, h: vh }));
      if (card.current) {
        const h = card.current.offsetHeight;
        setCardH((c) => (c === h ? c : h));
      }
      const el = target.current;
      const r = el?.isConnected ? el.getBoundingClientRect() : null;
      const next: Box | null =
        r && r.width > 0 && r.height > 0
          ? (() => {
              // Kept on screen, and at most half of it: a part as tall as the
              // house is lit from its top, and the card still fits below.
              const top = Math.max(r.top - PAD, 8);
              const bottom = Math.min(r.bottom + PAD, vh - 8, top + Math.round(vh * 0.5));
              return bottom - top > 24 ? { top, left: r.left - PAD, width: r.width + PAD * 2, height: bottom - top } : null;
            })()
          : null;
      setBox((b) =>
        b && next && Math.abs(b.top - next.top) < 0.5 && Math.abs(b.left - next.left) < 0.5 && Math.abs(b.width - next.width) < 0.5 && Math.abs(b.height - next.height) < 0.5
          ? b
          : next
      );
    };
    measure();
    const id = window.setInterval(measure, 200);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [step, ready]);

  // The card takes the focus at each step, and Esc ends the tour.
  useEffect(() => {
    if (step === null || !ready) return;
    primary.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end(`tour-skip-${steps[step]?.id ?? "step"}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, ready, end, steps]);

  // Reaching the last step is counted once per tour.
  const countedDone = useRef(false);
  useEffect(() => {
    if (step === null) countedDone.current = false;
    else if (step === steps.length - 1 && ready && !countedDone.current) {
      countedDone.current = true;
      countClick("tour-done");
    }
  }, [step, ready, steps.length]);

  const watcher = (
    <Suspense fallback={null}>
      <StartFromAddress onStart={start} active={!user && configured && !loading} />
    </Suspense>
  );

  if (step === null || !ready || typeof document === "undefined") return watcher;
  const s = steps[step];
  if (!s) return watcher;
  const last = step === steps.length - 1;
  const place = placeCard(box, view.w, view.h, cardH);
  const motion = reducedMotion() ? "" : "transition-[top,left,width,height] duration-300 ease-out";

  return (
    <>
      {watcher}
      {createPortal(
        <>
          {box ? (
            <>
              {/* The dim, in four panels around a window over what the step
                  points at: around it the page waits, inside it, it works. */}
              <div aria-hidden className={`fixed inset-x-0 top-0 z-[900] bg-slate-900/60 ${motion}`} style={{ height: Math.max(0, box.top) }} />
              <div aria-hidden className={`fixed inset-x-0 bottom-0 z-[900] bg-slate-900/60 ${motion}`} style={{ top: box.top + box.height }} />
              <div aria-hidden className={`fixed left-0 z-[900] bg-slate-900/60 ${motion}`} style={{ top: box.top, height: box.height, width: Math.max(0, box.left) }} />
              <div aria-hidden className={`fixed right-0 z-[900] bg-slate-900/60 ${motion}`} style={{ top: box.top, height: box.height, left: box.left + box.width }} />
              <div
                aria-hidden
                className={`pointer-events-none fixed z-[900] rounded-lg ring-[3px] ring-white ${motion}`}
                style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
              />
            </>
          ) : (
            <div aria-hidden className="fixed inset-0 z-[900] bg-slate-900/60" />
          )}

          <div
            ref={card}
            key={s.id}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-body"
            className="animate-pop-in fixed z-[901] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-900/5"
            style={{ top: place.top, bottom: place.bottom, left: place.left, width: place.width }}
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0">
                <Archie pose={s.pose} size={52} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bridge-600">
                  {step === 0 ? "A quick tour" : `Step ${step} of ${steps.length - 1}`}
                </p>
                <h2 id="tour-title" className="text-lg font-bold leading-snug text-slate-900">
                  {s.title}
                </h2>
              </div>
            </div>
            <p id="tour-body" className="mt-2.5 text-[15px] leading-relaxed text-slate-600">
              {s.body}
            </p>

            {step > 0 && (
              <div className="mt-3 flex gap-1.5" aria-hidden>
                {steps.slice(1).map((d, i) => (
                  <span key={d.id} className={`h-1.5 rounded-full transition-all ${i + 1 === step ? "w-5 bg-bridge-600" : i + 1 < step ? "w-1.5 bg-bridge-300" : "w-1.5 bg-slate-200"}`} />
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {step === 0 ? (
                <>
                  <button type="button" onClick={() => end("tour-skip-welcome")} className="btn-ghost btn-sm">
                    Skip
                  </button>
                  <button
                    ref={primary as React.RefObject<HTMLButtonElement>}
                    type="button"
                    onClick={() => {
                      countClick("tour-start");
                      setStep(1);
                    }}
                    className="btn-primary"
                  >
                    Show me around
                  </button>
                </>
              ) : last ? (
                <>
                  <button type="button" onClick={() => end("tour-later")} className="btn-ghost btn-sm">
                    Keep exploring
                  </button>
                  <Link
                    ref={primary as React.RefObject<HTMLAnchorElement>}
                    href="/login"
                    onClick={() => end("tour-signup")}
                    className="btn-primary"
                  >
                    Create my free account
                  </Link>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => end(`tour-skip-${s.id}`)} className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
                    Skip tour
                  </button>
                  <div className="flex gap-2">
                    {step > 1 && (
                      <button type="button" onClick={() => setStep(step - 1)} className="btn-ghost btn-sm">
                        Back
                      </button>
                    )}
                    <button ref={primary as React.RefObject<HTMLButtonElement>} type="button" onClick={() => setStep(step + 1)} className="btn-primary">
                      Next
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

/**
 * "Take the tour" in the menu links to ?tour=1 on the page the visitor is on.
 * Read in its own Suspense boundary (useSearchParams), and the address is put
 * back right away, so a reload does not start it again.
 */
function StartFromAddress({ onStart, active }: { onStart: () => void; active: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asked = params.get("tour") === "1";
  useEffect(() => {
    if (!asked || !active) return;
    const rest = new URLSearchParams(params.toString());
    rest.delete("tour");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    countClick("tour-menu");
    onStart();
  }, [asked, active, params, pathname, router, onStart]);
  return null;
}
