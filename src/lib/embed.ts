"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The message an embedded card posts to the page framing it. */
export const EMBED_HEIGHT_MESSAGE = "algebridge-embed-height";

/**
 * Inside algebridge.org's iframe: report this element's height whenever it
 * changes, so the frame fits the card instead of scrolling inside it. Does
 * nothing when the page is the top window.
 *
 * Runs after every render and re-observes when the ref points at a new
 * node: a card that swaps its root between states ("Setting up a problem"
 * and the problem itself) would otherwise leave the observer on a detached
 * element, and the frame stuck at the loading height.
 */
export function useEmbedHeight(ref: RefObject<HTMLElement | null>): void {
  const watched = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const lastSent = useRef(-1);

  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const el = ref.current;
    const send = () => {
      if (!el) return;
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height === lastSent.current) return;
      lastSent.current = height;
      window.parent.postMessage({ type: EMBED_HEIGHT_MESSAGE, height }, "*");
    };
    if (el !== watched.current) {
      observer.current?.disconnect();
      observer.current = null;
      watched.current = el;
      if (el) {
        const ro = new ResizeObserver(send);
        ro.observe(el);
        observer.current = ro;
      }
    }
    // After every render too: a browser throttles the resize observer of a
    // frame that is scrolled out of view, and an effect it does not, so the
    // height a render produced still reaches the page framing this one.
    send();
  });

  useEffect(() => () => observer.current?.disconnect(), []);
}
