"use client";

/**
 * The activity ticker: one line at the foot of the sticky header, on every page, running
 * from right to left without a stop, telling what students across
 * AlgeBridge are doing ("Ava solved a problem", "Shaurya earned 25
 * Bridgeys"). The newest moments go by first; when there is nothing new the
 * strip goes round the latest forty again, so it never runs dry. Each round
 * goes in a mixed order, so the names are spread out and the same student
 * does not come twice in a row (mixNames in lib/activity.ts).
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
import { activityLine, mixNames, POLL_MS, POOL_MAX, RECENT_LIMIT, sameMoment, seededRand, type ActivityItem } from "@/lib/activity";

/** Pixels per second. Slow enough to read, quick enough to feel alive. */
const SPEED = 44;
/** Room kept filled past the strip's right edge, so a slow frame never shows a gap. */
const LEAD_PX = 320;
/** Lines on the track at once, at most. */
const TRACK_MAX = 40;
/** Under "reduce motion": one line at a time, this long each. */
const STILL_MS = 5000;

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
  /** The rest of the current round round the pool, in mixed order. */
  const round = useRef<ActivityItem[]>([]);
  /** The first name on the line most recently put on the strip. */
  const lastName = useRef("");
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
    pool.current = [...added, ...pool.current].slice(0, POOL_MAX);
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
      round.current = [];
      lastName.current = "";
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

  /** The next line to put on the track: something new first, else round the pool in a mixed order. */
  function next(): ActivityItem | null {
    const f = fresh.current.shift();
    if (f) {
      lastName.current = f.name;
      return f;
    }
    if (!pool.current.length) return null;
    if (!round.current.length) round.current = mixNames(pool.current, Math.random, lastName.current);
    const item = round.current.shift() ?? null;
    if (item) lastName.current = item.name;
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
    // The same mixed order on every render while the pool is unchanged (a fixed seed from it).
    const seed = pool.current.reduce((n, it) => (n * 31 + it.id) | 0, pool.current.length);
    const mixed = mixNames(pool.current, seededRand(seed));
    stillLine = activityLine(f ?? mixed[stillIndex % mixed.length]);
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
