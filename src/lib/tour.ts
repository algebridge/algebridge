/**
 * The welcome tour: someone on AlgeBridge for the first time, without an
 * account, is walked through it one real page at a time, the course, a real
 * problem, Archie, the games and the house, up to making a free account.
 *
 * Pure data and rules, so the tests hold every line to house style and every
 * fact to the course as it is. The tour itself is components/WelcomeTour.tsx;
 * each step points at an element marked data-tour="<target>".
 */

import { units } from "@/data/curriculum";
import type { ArchiePose } from "@/components/archie/Archie";
import { featureForPath } from "@/lib/school-mode";

export interface TourStep {
  id: string;
  /** The page the step shows, opened when the step starts. None: wherever the visitor is. */
  route?: string;
  /** What it points at: a data-tour name on that page. None: the card sits in the middle. */
  target?: string;
  title: string;
  body: string;
  pose: ArchiePose;
}

const SKILLS = units.reduce((n, u) => n + u.skills.length, 0);

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to AlgeBridge",
    body: `Free Algebra 1, start to finish: ${units.length} units and ${SKILLS} skills. Here is a one-minute look at what you can do.`,
    pose: "wave",
  },
  {
    id: "course",
    route: "/",
    target: "outline",
    title: "Your path through Algebra 1",
    body: "Each skill is a short video, then practice. Get five right on the first try and the next skill opens, and every unit you finish earns a certificate.",
    pose: "happy",
  },
  {
    id: "try",
    route: "/try",
    target: "try",
    title: "Try a real problem",
    body: "Answer it right here. Every answer gets a note on what happened, so even a miss teaches you something.",
    pose: "encourage",
  },
  {
    id: "archie",
    route: "/try",
    target: "archie",
    title: "Meet Archie, your study buddy",
    body: "Archie is an AI that loves math. Stuck? He gives a hint or the first step and helps you find the answer yourself.",
    pose: "wave",
  },
  {
    id: "games",
    route: "/games",
    target: "games",
    title: "Play with the team",
    body: "Five games: skating, wrestling, cheer, volleyball and soccer. Each one stops for a quick math question. Play solo for Bridgeys, or 1v1 with a friend on one computer.",
    pose: "party",
  },
  {
    id: "house",
    route: "/house",
    target: "house",
    title: "Build your Bridgey House",
    body: "Finished skills, daily goals and game answers all pay Bridgeys. Spend them on furniture and colors for your house, and wear the titles you earn.",
    pose: "happy",
  },
  {
    id: "account",
    target: "signup",
    title: "Keep it all with a free account",
    body: "Your progress, Bridgeys, house and certificates save to your account and follow you to any device. You can join your class with its code too.",
    pose: "party",
  },
];

/** The steps for this build: a page school mode turns off (the games) is left out. */
export function tourSteps(school: boolean): TourStep[] {
  return TOUR_STEPS.filter((s) => !school || !s.route || featureForPath(s.route) === null);
}

/** Pages a visitor reaches with a job of their own: signing in, a teacher reading /schools, the fine print. */
const QUIET_PATHS = ["/login", "/schools", "/privacy", "/terms", "/safety", "/guidelines", "/admin", "/workspace", "/teacher", "/tutor-hub", "/certificate"];

/** Can the tour start on this page by itself? It still runs here once started. */
export function tourMayStartOn(pathname: string | null): boolean {
  if (!pathname) return false;
  return !QUIET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Set for good once the tour is finished or skipped. */
export const TOUR_DONE_KEY = "ab-tour-done";
/** The step a tour in progress is on, kept for a reload in the middle of it. */
export const TOUR_STEP_KEY = "ab-tour-step";

/** Where the card goes: beside the spotlight on a wide screen, at the bottom or the top of a phone. */
export interface CardPlace {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * The card's place for a spotlight `box` in a `vw` by `vh` window, for a card
 * `cardH` tall. On a phone it spans the width, at the bottom unless what it
 * points at is down there (Archie's launcher), then at the top. On a wider
 * screen it sits under the spotlight, or over it, or beside it, kept inside
 * the window. With nothing to point at, it is centered.
 */
export function placeCard(box: Box | null, vw: number, vh: number, cardH: number): CardPlace {
  const gap = 14;
  const margin = 12;
  if (vw < 640) {
    const width = vw - margin * 2;
    if (box && box.top + box.height / 2 > vh * 0.55) return { top: margin, left: margin, width };
    return { bottom: margin, left: margin, width };
  }
  const width = Math.min(380, vw - margin * 2);
  if (!box) return { top: Math.max(margin, (vh - cardH) / 2), left: (vw - width) / 2, width };
  const centered = Math.min(Math.max(box.left + box.width / 2 - width / 2, margin), vw - width - margin);
  if (box.top + box.height + gap + cardH <= vh - margin) return { top: box.top + box.height + gap, left: centered, width };
  if (box.top - gap - cardH >= margin) return { top: box.top - gap - cardH, left: centered, width };
  // Too tall for either: beside it, on the side with more room.
  const right = box.left + box.width + gap;
  const left = right + width <= vw - margin ? right : Math.max(margin, box.left - gap - width);
  return { top: Math.min(Math.max(box.top, margin), vh - cardH - margin), left, width };
}
