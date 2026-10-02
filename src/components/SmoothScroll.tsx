"use client";

import { useEffect } from "react";

/**
 * In-page anchors (#units, #progress) glide instead of jump.
 *
 * This used to run Lenis momentum scrolling for the whole app. Lenis keeps a
 * requestAnimationFrame loop going on every page, 60 times a second, even when
 * nothing moves, and it re-animates trackpad scrolling that the browser
 * already smooths natively, which reads as lag on laptops (measured Oct 2026:
 * 60 animation frames a second on an idle page). Native scrolling is smoother
 * and costs nothing while idle, so only the anchor glide is kept.
 */
export function SmoothScroll() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      const href = anchor?.getAttribute("href");
      if (!href || !href.startsWith("#") || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Clear the sticky header so the heading is not hidden underneath it.
      const top = target.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
