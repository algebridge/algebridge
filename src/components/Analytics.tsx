"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isBareRoute } from "@/lib/bare-route";
import { GA_ID, GA_CONFIG, GA_SCRIPT_ORIGIN, analyticsAllowed } from "@/lib/analytics";

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

/**
 * Counts page views in Google Analytics 4 when NEXT_PUBLIC_GA_ID is set.
 * Renders nothing. Each client-side navigation sends its own page_view, so
 * the first load is counted once (the config sends none of its own).
 */
export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const allowed = analyticsAllowed(GA_ID, {
      framed: window.top !== window.self,
      bareRoute: isBareRoute(pathname),
      hostname: window.location.hostname,
      globalPrivacyControl: nav.globalPrivacyControl === true,
    });
    if (!allowed) return;
    load();
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);
  return null;
}
