"use client";

/**
 * The activity ticker: one line at the foot of the sticky header, on every page, running
 * from right to left without a stop, telling what students across
 * AlgeBridge are doing ("Ava solved a problem", "Shaurya earned 25
 * Bridgeys"). The newest moments go by first; when there is nothing new the
 * strip goes round the latest forty again, so it never runs dry.
 *
 * The moving part is driven by hand (requestAnimationFrame moving one flex
 * track, items added at the right edge as the left edge empties), not by a
 * CSS marquee: new lines slot in without the strip jumping back to its
 * start, and the same pool can repeat without a seam.
 *
 * Shown to signed-in accounts only (the rows are only readable signed in,
 * like the leaderboard); never on a bare route, in a video call or in the
 * arena. Under "reduce motion" the strip stands still and swaps one line
 * for the next every few seconds instead.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isBareRoute } from "@/lib/bare-route";
import { ACTIVITY_EVENT, fetchActivity } from "@/lib/activity-client";
import { activityLine, POLL_MS, POOL_MAX, RECENT_LIMIT, sameMoment, type ActivityItem } from "@/lib/activity";

/** Pixels per second. Slow enough to read, quick enough to feel alive. */
const SPEED = 44;
/** Room kept filled past the strip's right edge, so a slow frame never shows a gap. */
const LEAD_PX = 320;
/** Lines on the track at once, at most. */
const TRACK_MAX = 40;
/** Under "reduce motion": one line at a time, this long each. */
const STILL_MS = 5000;

/**
 * Placeholder lines, until the database has real moments to tell (before the
 * migration runs, or on a quiet day with nothing in the last two days). The
 * names are made up; the kinds and titles are real parts of the course and
 * the shop. They fall away the moment a real row arrives.
 */
const SAMPLE: ActivityItem[] = [
  { id: -901, at: "", name: "Shaurya", kind: "solved", amount: null, detail: null },
  { id: -902, at: "", name: "Ava", kind: "bridgeys", amount: 25, detail: null },
  { id: -903, at: "", name: "Liam", kind: "skill", amount: null, detail: "Two-Step Equations" },
  { id: -904, at: "", name: "Maya", kind: "unit", amount: null, detail: "Unit 1: Working with Units" },
  { id: -905, at: "", name: "Zack", kind: "bought", amount: null, detail: "Arcade Cabinet" },
  { id: -906, at: "", name: "Noah", kind: "game", amount: null, detail: "Bat with Liam" },
  { id: -907, at: "", name: "Priya", kind: "solved", amount: null, detail: null },
  { id: -908, at: "", name: "Jordan", kind: "bridgeys", amount: 15, detail: null },
  { id: -909, at: "", name: "Kenise", kind: "skill", amount: null, detail: "Dimensional Analysis" },
  { id: -910, at: "", name: "Mateo", kind: "bought", amount: null, detail: "Lava Lamp" },
  { id: -911, at: "", name: "Sofia", kind: "game", amount: null, detail: "Skate with Veronica" },
  { id: -912, at: "", name: "Ethan", kind: "solved", amount: null, detail: null },
  { id: -913, at: "", name: "Amara", kind: "bridgeys", amount: 40, detail: null },
  { id: -914, at: "", name: "Rayla", kind: "skill", amount: null, detail: "Equations with Fractions" },
];

const isSample = (item: ActivityItem) => item.id <= -900;

/** The placeholders in a fresh random order, so the strip reads differently on every visit. */
function shuffledSamples(): ActivityItem[] {
  const out = [...SAMPLE];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pages where a moving strip would get in the way. */
const QUIET_ROUTES = ["/room", "/arena"];

function quietRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (isBareRoute(pathname)) return true;
  return QUIET_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** One line as a DOM node: the name in bold, then the rest, then a dot before the next line. */
function renderItem(item: ActivityItem): HTMLElement {
  const { name, rest } = activityLine(item);
  const el = document.createElement("span");
  el.className = "ab-tick";
  const b = document.createElement("b");
  b.textContent = name;
  el.appendChild(b);
  el.appendChild(document.createTextNode(rest));
  const dot = document.createElement("i");
  dot.className = "ab-tick-dot";
  dot.setAttribute("aria-hidden", "true");
  el.appendChild(dot);
  return el;
}

export function ActivityTicker() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const boxRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  /** Everything the strip may tell, newest first; capped at POOL_MAX. */
  const pool = useRef<ActivityItem[]>([]);
  /** Moments not yet shown once, newest last; these go by before the pool repeats. */
  const fresh = useRef<ActivityItem[]>([]);
  const cursor = useRef(0);
  const maxId = useRef(0);
  const [hasItems, setHasItems] = useState(false);
  const [still, setStill] = useState(false);
  const [stillIndex, setStillIndex] = useState(0);

  const signedIn = !loading && !!user;
  const show = signedIn && !quietRoute(pathname);

  // Reduced motion: the strip stands still.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /** New moments in, newest first. Echoes of the student's own moment are kept; the database's copy of the same moment is not. */
  function take(items: ActivityItem[], front: boolean) {
    const added: ActivityItem[] = [];
    for (const item of items) {
      if (pool.current.some((p) => p.id === item.id || sameMoment(p, item))) continue;
      added.push(item);
      if (item.id > maxId.current) maxId.current = item.id;
    }
    if (!added.length) return;
    // A real moment puts the placeholders away for good.
    const real = added.some((a) => a.id > 0);
    const kept = real ? pool.current.filter((p) => !isSample(p)) : pool.current;
    if (real) fresh.current = fresh.current.filter((f) => !isSample(f));
    pool.current = [...added, ...kept].slice(0, POOL_MAX);
    // Newest last in the fresh queue, so a batch goes by in the order it happened.
    const chronological = [...added].reverse();
    fresh.current = front ? [...fresh.current, ...chronological] : [...chronological, ...fresh.current];
    setHasItems(true);
  }

  // The latest forty at sign-in, then every new row while the tab is visible.
  useEffect(() => {
    if (!signedIn) {
      pool.current = [];
      fresh.current = [];
      maxId.current = 0;
      setHasItems(false);
      return;
    }
    let alive = true;
    void fetchActivity(0, RECENT_LIMIT).then((rows) => {
      if (!alive) return;
      // The first batch feeds the pool only: the strip starts on the newest and cycles.
      take(rows, false);
      fresh.current = [];
      // Nothing real to tell yet: placeholders keep the strip alive.
      if (!pool.current.length) take(shuffledSamples(), false);
      fresh.current = [];
    });
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      void fetchActivity(maxId.current, RECENT_LIMIT).then((rows) => {
        if (alive) take(rows, true);
      });
    };
    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // The student's own moment, the instant it happens.
  useEffect(() => {
    const onOwn = (e: Event) => {
      const item = (e as CustomEvent<ActivityItem>).detail;
      if (item) take([item], true);
    };
    window.addEventListener(ACTIVITY_EVENT, onOwn);
    return () => window.removeEventListener(ACTIVITY_EVENT, onOwn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The next line to put on the track: something new first, else round the pool. */
  function next(): ActivityItem | null {
    const f = fresh.current.shift();
    if (f) return f;
    const p = pool.current;
    if (!p.length) return null;
    const item = p[cursor.current % p.length];
    cursor.current = (cursor.current + 1) % Math.max(1, p.length);
    return item;
  }

  // The moving track.
  useEffect(() => {
    if (!show || still) return;
    const box = boxRef.current;
    const track = trackRef.current;
    if (!box || !track) return;

    let offset = 0;
    let last = performance.now();
    let paused = false;
    let raf = 0;

    const fill = () => {
      // The first line comes in from the right edge, like every one after it:
      // an empty lead as wide as the strip goes on the track first.
      if (!track.childElementCount && box.clientWidth > 0) {
        const lead = document.createElement("span");
        lead.className = "ab-tick";
        lead.style.width = `${box.clientWidth}px`;
        lead.style.paddingRight = "0";
        track.appendChild(lead);
      }
      // Keep the track filled a little past the right edge of the strip.
      while (track.scrollWidth - offset < box.clientWidth + LEAD_PX && track.childElementCount < TRACK_MAX) {
        const item = next();
        if (!item) break;
        track.appendChild(renderItem(item));
      }
    };

    const step = (now: number) => {
      // A long pause (a background tab) moves the strip by at most a tenth of a second.
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // Hidden (nothing to tell yet, so the strip is display: none): every
      // width reads 0, so nothing is measured, added or removed until it shows.
      if (box.clientWidth === 0) {
        raf = requestAnimationFrame(step);
        return;
      }
      if (!paused && document.visibilityState === "visible") offset += SPEED * dt;
      // Lines gone past the left edge come off; the track shifts by their width.
      let first = track.firstElementChild as HTMLElement | null;
      while (first && first.offsetWidth <= offset) {
        offset -= first.offsetWidth;
        first.remove();
        first = track.firstElementChild as HTMLElement | null;
      }
      fill();
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      raf = requestAnimationFrame(step);
    };

    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
    };
    box.addEventListener("pointerenter", pause);
    box.addEventListener("pointerleave", resume);
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      box.removeEventListener("pointerenter", pause);
      box.removeEventListener("pointerleave", resume);
      track.replaceChildren();
      track.style.transform = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, still]);

  // Standing still: one line at a time.
  useEffect(() => {
    if (!show || !still) return;
    const timer = window.setInterval(() => setStillIndex((i) => i + 1), STILL_MS);
    return () => window.clearInterval(timer);
  }, [show, still]);

  if (!show) return null;

  let stillLine: { name: string; rest: string } | null = null;
  if (still && pool.current.length) {
    const f = fresh.current[0];
    stillLine = activityLine(f ?? pool.current[stillIndex % pool.current.length]);
  }

  return (
    <div
      ref={boxRef}
      className="ab-ticker text-xs"
      data-empty={hasItems ? undefined : ""}
      aria-hidden="true"
    >
      {still ? (
        <div className="flex h-7 items-center px-4 sm:px-6">
          {stillLine && (
            <span className="ab-tick truncate">
              <b>{stillLine.name}</b> {stillLine.rest}
            </span>
          )}
        </div>
      ) : (
        <div className="ab-ticker-window h-7 overflow-hidden">
          <div ref={trackRef} className="ab-ticker-track flex h-7 items-center whitespace-nowrap will-change-transform" />
        </div>
      )}
    </div>
  );
}
