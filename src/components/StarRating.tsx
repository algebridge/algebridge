"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Stars for reviews of AlgeBridge.
 *
 * StarRating is the input: five big buttons in an aria radio group, with a
 * roving tab stop, arrow keys, Home/End and the number keys 1 to 5, and a
 * hover preview that shows what a click would pick. StarsDisplay draws a
 * read-only rating, including part of a star for an average like 4.3.
 */

/** What each star count means, in a student's words. Index 0 is unused. */
export const STAR_LABELS = ["", "Not for me", "Needs work", "It's okay", "Really good", "Love it"] as const;

export function starCountLabel(n: number): string {
  return `${n} star${n === 1 ? "" : "s"}`;
}

const STAR_PATH = "M12 2.4L14.65 8.96L21.7 9.45L16.28 13.99L18 20.85L12 17.1L6 20.85L7.72 13.99L2.3 9.45L9.35 8.96Z";

// Gold reads as "rating" everywhere; the outline keeps an empty star visible
// on white and on the admin console's paper.
const GOLD = "#f5b301";
const GOLD_EDGE = "#d99a00";
const PREVIEW = "#fcd774";
const EMPTY_FILL = "#ffffff";
const EMPTY_EDGE = "#cbd5e1";

export function StarGlyph({
  size,
  fill,
  stroke,
  strokeWidth = 1.5,
}: {
  size: number;
  fill: string;
  stroke: string;
  strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="block shrink-0">
      <path d={STAR_PATH} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  );
}

interface StarRatingProps {
  value: number;
  onChange: (n: number) => void;
  /** id of the visible question the group answers. */
  labelledBy: string;
  /** Pixel size of each star button. 48 keeps every star an easy tap. */
  size?: number;
  /** Move focus into the group when it first appears. */
  autoFocus?: boolean;
  disabled?: boolean;
}

export function StarRating({ value, onChange, labelledBy, size = 48, autoFocus = false, disabled = false }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [popped, setPopped] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover ?? value;
  const previewing = hover !== null && hover !== value;

  useEffect(() => {
    if (autoFocus) refs.current[value ? value - 1 : 0]?.focus();
    // Only on mount: focus should not jump around while someone is choosing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!popped) return;
    const t = window.setTimeout(() => setPopped(0), 220);
    return () => window.clearTimeout(t);
  }, [popped]);

  function choose(n: number) {
    if (disabled) return;
    onChange(n);
    setPopped(n);
    refs.current[n - 1]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled || e.altKey || e.ctrlKey || e.metaKey) return;
    const current = value || 0;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, current + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, current - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    else if (/^[1-5]$/.test(e.key)) next = Number(e.key);
    if (next === null) return;
    e.preventDefault();
    setHover(null);
    choose(next);
  }

  const glyph = Math.round(size * 0.8);

  return (
    <div>
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
        className="-ml-1 flex items-center"
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= shown;
          const fill = on ? (previewing ? PREVIEW : GOLD) : EMPTY_FILL;
          const stroke = on ? GOLD_EDGE : EMPTY_EDGE;
          // Roving tab stop: the chosen star, or the first one before a choice.
          const tabbable = value ? value === n : n === 1;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${starCountLabel(n)}, ${STAR_LABELS[n]}`}
              tabIndex={tabbable ? 0 : -1}
              disabled={disabled}
              onClick={() => choose(n)}
              onMouseEnter={() => !disabled && setHover(n)}
              style={{ width: size, height: size }}
              className={`flex items-center justify-center rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-bridge-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${
                disabled ? "" : "cursor-pointer hover:bg-amber-50"
              }`}
            >
              <span
                className={`block motion-safe:transition-transform motion-safe:duration-200 ${
                  popped === n ? "motion-safe:scale-125" : hover === n ? "motion-safe:scale-110" : ""
                }`}
              >
                <StarGlyph size={glyph} fill={fill} stroke={stroke} strokeWidth={on ? 1.3 : 1.6} />
              </span>
            </button>
          );
        })}
      </div>
      {/* The radios carry their own names for screen readers; this line is the
          same words for eyes, so it stays out of the accessibility tree. */}
      <p aria-hidden="true" className="mt-1 h-5 text-sm">
        {shown ? (
          <>
            <span className="font-semibold text-slate-900">{STAR_LABELS[shown]}</span>
            <span className="text-slate-500"> &middot; {starCountLabel(shown)}</span>
          </>
        ) : (
          <span className="text-slate-500">Pick from 1 to 5 stars.</span>
        )}
      </p>
    </div>
  );
}

/** A read-only row of stars. Fractions fill part of a star (4.3 fills 4 and a third). */
export function StarsDisplay({
  value,
  size = 18,
  fill = GOLD,
  stroke = GOLD_EDGE,
  emptyFill = EMPTY_FILL,
  emptyStroke = EMPTY_EDGE,
  label,
}: {
  value: number;
  size?: number;
  fill?: string;
  stroke?: string;
  emptyFill?: string;
  emptyStroke?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(5, Number.isFinite(value) ? value : 0));
  const pct = (clamped / 5) * 100;
  const text = label ?? `${Number.isInteger(clamped) ? clamped : clamped.toFixed(1)} out of 5 stars`;
  const row = (f: string, s: string) =>
    [0, 1, 2, 3, 4].map((i) => <StarGlyph key={i} size={size} fill={f} stroke={s} strokeWidth={1.4} />);
  return (
    // w-max: as a grid or column-flex item the row would otherwise stretch,
    // and the filled overlay (a percentage of the row) would cover every star.
    <span role="img" aria-label={text} className="relative inline-flex w-max shrink-0 align-middle" style={{ height: size }}>
      <span className="flex" aria-hidden="true">
        {row(emptyFill, emptyStroke)}
      </span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden" style={{ width: `${pct}%` }} aria-hidden="true">
        {row(fill, stroke)}
      </span>
    </span>
  );
}
