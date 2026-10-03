"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * A modal a keyboard can use (WCAG 2.1.2, 2.4.3). While `open`: focus moves
 * into the dialog, to the element marked `data-autofocus` or else its first
 * control; Tab and Shift+Tab wrap inside it instead of wandering to the page
 * behind; Escape calls `onEscape` when one is given. On close, focus goes
 * back to where it was before the dialog opened.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onEscape?: () => void) {
  const escape = useRef(onEscape);
  escape.current = onEscape;

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const before = document.activeElement as HTMLElement | null;
    // What Tab can reach: shown, and not taken out of the Tab order (a roving set's other members).
    const controls = () => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
    (root.querySelector<HTMLElement>("[data-autofocus]") ?? controls()[0])?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escape.current) {
        e.preventDefault();
        escape.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = controls();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const inside = root.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (before && before !== document.body && before.isConnected) before.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
