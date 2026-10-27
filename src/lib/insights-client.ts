"use client";

/**
 * The browser side of learning insights (src/lib/insights.ts): one call,
 * trackInsight(), that sends a fact to /api/insights when counting is
 * allowed, and a hook that measures time on a skill.
 *
 * Who is using the site is only known once the account's profile has loaded,
 * so facts sent before then wait in a small queue; AppInit sets the identity
 * and the queue flushes, or is dropped for an admin.
 */

import { useEffect, useRef } from "react";
import { allUnits, courseOfSkill } from "@/data/curriculum";
import { countingAllowed, type AnalyticsContext } from "@/lib/analytics";
import { isBareRoute } from "@/lib/bare-route";
import type { InsightEvent, InsightRole } from "@/lib/insights";
import { VISITOR_KEY, dailyVisitorId, localDay, randomId } from "@/lib/traffic";

type Identity = { role: InsightRole; admin: boolean };

let identity: Identity | null = null;
const queue: InsightEvent[] = [];
const QUEUE_MAX = 60;

/** Called by AppInit once the signed-in account (or its absence) is known. */
export function setInsightsIdentity(next: Identity | null): void {
  identity = next;
  if (!identity) return;
  const waiting = queue.splice(0, queue.length);
  if (identity.admin) return;
  for (const e of waiting) send(e, identity.role);
}

function allowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const ctx: AnalyticsContext = {
      framed: window.top !== window.self,
      bareRoute: isBareRoute(window.location.pathname),
      hostname: window.location.hostname,
      globalPrivacyControl: nav.globalPrivacyControl === true,
    };
    return countingAllowed(ctx);
  } catch {
    return false;
  }
}

function visitorId(): string {
  return dailyVisitorId(
    () => window.localStorage.getItem(VISITOR_KEY),
    (value) => window.localStorage.setItem(VISITOR_KEY, value),
    localDay(new Date()),
    randomId,
  );
}

function send(e: InsightEvent, role: InsightRole): void {
  const json = JSON.stringify({ ...e, v: visitorId(), role });
  try {
    if (navigator.sendBeacon?.("/api/insights", new Blob([json], { type: "text/plain" }))) return;
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/insights", { method: "POST", body: json, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(
    () => {},
  );
}

/**
 * One fact about what the student is doing. Never throws, never waits.
 * Dropped for admins, inside frames, on local hosts and under Global
 * Privacy Control, like a page view.
 */
export function trackInsight(e: InsightEvent): void {
  try {
    // On a development build, a page that sets window.__insights = [] sees
    // every fact that would be sent, since a local host never sends any.
    if (process.env.NODE_ENV !== "production") (window as Window & { __insights?: InsightEvent[] }).__insights?.push(e);
    if (!allowed()) return;
    if (!identity) {
      if (queue.length < QUEUE_MAX) queue.push(e);
      return;
    }
    if (identity.admin) return;
    send(e, identity.role);
  } catch {
    /* a count is never worth an error */
  }
}

/** The course and unit a skill belongs to, for tagging a fact. */
export function placeOfSkill(skillId: string): { course: string | null; unit: string | null } {
  const unit = allUnits().find((u) => u.skills.some((s) => s.id === skillId));
  return { course: courseOfSkill(skillId)?.id ?? null, unit: unit?.id ?? null };
}

/** Problems answered since the skill timer last flushed, counted by trackInsight callers. */
let answeredSinceFlush = 0;
export function noteAnswered(): void {
  answeredSinceFlush += 1;
}

const TICK_MS = 15_000;
const IDLE_MS = 3 * 60 * 1000;
const FLUSH_MIN_S = 5;
const STRETCH_MAX_S = 2 * 60 * 60;

/**
 * Time on one skill's page: seconds while the tab is visible and the student
 * has touched the page in the last three minutes. Sent as one skill_time
 * fact when the skill changes, the page closes or the tab is hidden for a
 * while, with how many problems were answered in that stretch.
 */
export function useSkillTime(skillId: string): void {
  const seconds = useRef(0);
  const lastTouch = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    seconds.current = 0;
    answeredSinceFlush = 0;
    lastTouch.current = Date.now();
    const place = placeOfSkill(skillId);

    const flush = () => {
      const s = Math.min(Math.round(seconds.current), STRETCH_MAX_S);
      const n = answeredSinceFlush;
      seconds.current = 0;
      answeredSinceFlush = 0;
      if (s < FLUSH_MIN_S) return;
      trackInsight({ name: "skill_time", skill: skillId, ...place, value: s, n });
    };
    const touch = () => {
      lastTouch.current = Date.now();
    };
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastTouch.current > IDLE_MS) return;
      seconds.current += TICK_MS / 1000;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    const timer = window.setInterval(tick, TICK_MS);
    const opts = { passive: true } as const;
    window.addEventListener("pointerdown", touch, opts);
    window.addEventListener("keydown", touch, opts);
    window.addEventListener("scroll", touch, opts);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
      window.removeEventListener("scroll", touch);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [skillId]);
}
