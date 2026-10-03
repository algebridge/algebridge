"use client";

import { useEffect, type RefObject } from "react";

/** The message an embedded card posts to the page framing it. */
export const EMBED_HEIGHT_MESSAGE = "algebridge-embed-height";

/**
 * Inside algebridge.org's iframe: report this element's height whenever it
 * changes, so the frame fits the card instead of scrolling inside it. Does
 * nothing when the page is the top window.
 */
export function useEmbedHeight(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const el = ref.current;
    if (!el) return;
    const send = () =>
      window.parent.postMessage({ type: EMBED_HEIGHT_MESSAGE, height: Math.ceil(el.getBoundingClientRect().height) }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, [ref]);
}
