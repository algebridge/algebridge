"use client";

import type { RefObject } from "react";

/**
 * A minus key and a fraction bar, beside a number box.
 *
 * The box asks the phone for its number pad (inputMode="decimal"), and on an
 * iPhone that pad is digits and a point: there is no way to type -6 or 2/3.
 * A fifth of the answers in the coordinate and line units are negative. These
 * two keys work on every device; each keeps the box focused, so the phone's
 * keyboard stays up.
 */
export function SignKeys({
  value,
  onChange,
  inputRef,
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  className?: string;
}) {
  const negative = /^\s*[-−]/.test(value);
  const apply = (next: string) => {
    onChange(next);
    // After React writes the new value, put the caret at the end.
    window.requestAnimationFrame(() => {
      const el = inputRef?.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };
  const key =
    "flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40";
  return (
    <div className={`flex gap-1.5 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        // Pressing a key must leave the focus in the box, or the keyboard closes.
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => apply(negative ? value.replace(/^\s*[-−]\s*/, "") : `-${value.trimStart()}`)}
        aria-label={negative ? "Make the answer positive" : "Make the answer negative"}
        aria-pressed={negative}
        title="Negative"
        className={`${key} ${negative ? "border-bridge-400 bg-bridge-50 text-bridge-700" : ""}`}
      >
        −
      </button>
      <button
        type="button"
        disabled={disabled || value.includes("/")}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => apply(`${value.trimEnd()}/`)}
        aria-label="Add a fraction bar"
        title="Fraction"
        className={key}
      >
        /
      </button>
    </div>
  );
}
