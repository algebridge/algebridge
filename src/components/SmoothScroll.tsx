"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Momentum scrolling for the whole app.
 *
 * Two rules keep it from getting in the way:
 *  - anything a student can scroll inside (chat threads, the sidebar, the
 *    mobile menu) is marked data-lenis-prevent and keeps native scrolling;
 *  - anyone who asks for reduced motion gets plain native scrolling, because
 *    eased scroll is a common migraine and motion-sickness trigger.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      // Gentle ease-out: fast off the mark, settles without a long drift.
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      // Touch devices already have native momentum that feels better than ours.
      syncTouch: false,
    });

    let frame = 0;
    function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    }
    frame = requestAnimationFrame(raf);

    // In-page anchors (#units, #progress) should glide rather than jump.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      const href = anchor?.getAttribute("href");
      if (!href || !href.startsWith("#") || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      // Clear the sticky header so the heading isn't hidden underneath it.
      lenis.scrollTo(target as HTMLElement, { offset: -80 });
    }
    document.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
  }, []);

  return null;
}
