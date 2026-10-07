"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isBareRoute } from "@/lib/bare-route";
import {
  GA_ID,
  GA_CONFIG,
  GA_SCRIPT_ORIGIN,
  analyticsAllowed,
  countingAllowed,
  type AnalyticsContext,
} from "@/lib/analytics";
import {
  VISITOR_KEY,
  dailyVisitorId,
  deviceClass,
  localDay,
  normalizePath,
  randomId,
  referrerHost,
} from "@/lib/traffic";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js expects the Arguments object itself on the data layer, as in Google's snippet.
  window.gtag = function gtag() {
    window.dataLayer!.push(arguments);
  };
  const s = document.createElement("script");
  s.async = true;
  s.src = GA_SCRIPT_ORIGIN + "/gtag/js?id=" + encodeURIComponent(GA_ID);
  document.head.appendChild(s);
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, GA_CONFIG);
}

/** One beacon to /api/traffic. sendBeacon survives the page closing; fetch is the fallback. */
function sendBeacon(body: Record<string, unknown>): void {
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/traffic", new Blob([json], { type: "text/plain" }))) return;
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/traffic", { method: "POST", body: json, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(
    () => {},
  );
}

/**
 * One button click, counted in AlgeBridge's own daily totals like a page view
 * and under the same rule (never framed, on a bare route, or with Global
 * Privacy Control). `label` is short kebab-case, like "tour-start"; the admin
 * console's Traffic tab names them.
 */
export function countClick(label: string): void {
  if (typeof window === "undefined" || !/^[a-z0-9-]{1,40}$/.test(label)) return;
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const ctx: AnalyticsContext = {
      framed: window.top !== window.self,
      bareRoute: isBareRoute(window.location.pathname),
      hostname: window.location.hostname,
      globalPrivacyControl: nav.globalPrivacyControl === true,
    };
    if (!countingAllowed(ctx)) return;
    sendBeacon({ t: "click", s: "app", v: visitorId(), l: label });
  } catch {
    /* a count is never worth an error */
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

/**
 * Counts each page view twice over: once in AlgeBridge's own daily totals for
 * the admin console, and once in Google Analytics 4 when a measurement ID is
 * set. Renders nothing.
 *
 * Both get the page with ids taken out (/messages/:id), never the full URL.
 * Admins are left out: the component waits for a signed-in account's profile
 * before counting, so the team's own visits never reach either count.
 */
export function Analytics() {
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();
  const counted = useRef<string | null>(null);
  const isAdmin = profile?.isAdmin ?? false;
  const waiting = loading || (Boolean(user) && !profile);

  useEffect(() => {
    if (waiting || !pathname || counted.current === pathname) return;
    counted.current = pathname;
    if (isAdmin) return;

    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const ctx: AnalyticsContext = {
      framed: window.top !== window.self,
      bareRoute: isBareRoute(pathname),
      hostname: window.location.hostname,
      globalPrivacyControl: nav.globalPrivacyControl === true,
    };
    if (!countingAllowed(ctx)) return;

    const path = normalizePath(pathname);
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    sendBeacon({
      t: "view",
      s: "app",
      v: visitorId(),
      p: path,
      r: referrerHost(document.referrer, window.location.hostname),
      d: deviceClass(coarse, Math.min(window.screen.width, window.screen.height)),
    });

    if (analyticsAllowed(GA_ID, ctx)) {
      load();
      // "set" first, so Google's own events on this page (scrolls, outbound
      // clicks) carry the cleaned page too, not the address bar.
      const page_location = window.location.origin + path;
      window.gtag?.("set", { page_location, page_path: path });
      window.gtag?.("event", "page_view", { page_location, page_path: path, page_title: document.title });
    }
  }, [pathname, waiting, isAdmin]);

  return null;
}
