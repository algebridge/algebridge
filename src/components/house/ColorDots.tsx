"use client";

import { SWATCHES } from "@/data/furniture-art";
import { SWATCH_HEX } from "@/lib/house3d/swatches";

/** The swatches a piece can be painted in, its own colour first. */
export function ColorDots({ itemId, value, onPick, size = 18 }: { itemId: string; value: string | null | undefined; onPick: (swatch: string | null) => void; size?: number }) {
  // Each swatch is a 24 px target (WCAG 2.5.8) around a dot drawn at `size`.
  // One Tab stop for the set, the chosen swatch; the arrow keys move along it,
  // as radio buttons do (a shop of a hundred pieces was 1,500 Tab stops).
  const options: { hex: string; title: string; id: string | null }[] = [
    // Its own colour is whatever the piece is made in: shown as a split dot.
    { hex: "linear-gradient(135deg, #f1ede6 50%, #6b5a48 50%)", title: "Its own color", id: null },
    ...SWATCHES.map((s) => ({ hex: SWATCH_HEX[s.id] ?? "#888888", title: s.name, id: s.id as string | null })),
  ];
  const at = Math.max(0, options.findIndex((o) => (o.id === null ? !value : value === o.id)));
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const to = step ? (at + step + options.length) % options.length : e.key === "Home" ? 0 : e.key === "End" ? options.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onPick(options[to].id);
    (e.currentTarget.children[to] as HTMLElement | undefined)?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Color" onKeyDown={onKeyDown} className="flex flex-wrap items-center">
      {options.map((o, i) => (
        <button
          key={o.title}
          type="button"
          role="radio"
          aria-checked={i === at}
          tabIndex={i === at ? 0 : -1}
          aria-label={o.title}
          title={o.title}
          onClick={() => onPick(o.id)}
          className="group flex h-6 w-6 items-center justify-center rounded-full"
        >
          <span
            className={`block rounded-full ring-2 ring-offset-1 transition group-hover:scale-110 ${i === at ? "ring-slate-800" : "ring-transparent group-hover:ring-slate-300"}`}
            style={{ width: size, height: size, background: o.hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}
          />
        </button>
      ))}
    </div>
  );
}
