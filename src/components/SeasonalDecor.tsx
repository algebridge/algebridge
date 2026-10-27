"use client";

import { useEffect } from "react";
import { useSeason } from "@/lib/season";

/**
 * The season's dressing over the page: a few leaves drifting down and the
 * odd bat crossing the top. Only in season (lib/season.ts), only when motion
 * is welcome (season.css hides it under prefers-reduced-motion), and never in
 * the way: the layer takes no pointer events.
 *
 * Also keeps data-season on <html> in step with the season hook, for a tab
 * left open past the season or an override changed in another tab.
 */

/** Three leaf shapes, drawn once, in the season's four colors. */
const LEAF_PATHS = [
  // A maple leaf.
  "M12 2 L13.6 7.2 L18.4 4.6 L16.6 9.6 L22 10.4 L17.6 13.4 L21 17.6 L15.6 16.4 L15.4 22 L12 17.8 L8.6 22 L8.4 16.4 L3 17.6 L6.4 13.4 L2 10.4 L7.4 9.6 L5.6 4.6 L10.4 7.2 Z",
  // An oak leaf.
  "M12 1.5 C14.5 3 16 5 15.4 7.4 C18 7.4 19.6 9.4 18.6 11.6 C20.8 12.6 21 15.2 19 16.6 C20 18.8 18.4 20.8 16.2 20.2 C15.6 22.6 13.2 23.2 12 21.4 C10.8 23.2 8.4 22.6 7.8 20.2 C5.6 20.8 4 18.8 5 16.6 C3 15.2 3.2 12.6 5.4 11.6 C4.4 9.4 6 7.4 8.6 7.4 C8 5 9.5 3 12 1.5 Z",
  // A simple pointed leaf.
  "M12 1.5 C19 6 21 13 12 22.5 C3 13 5 6 12 1.5 Z",
];

const LEAVES = Array.from({ length: 14 }, (_, i) => ({
  shape: i % 3,
  color: (i * 7) % 4,
  x: (i * 61 + 13) % 100,
  size: 13 + ((i * 5) % 9),
  time: 15 + ((i * 3.7) % 11),
  delay: -((i * 4.3) % 20),
}));

const BATS = [
  { y: 8, t: 26, d: -4 },
  { y: 14, t: 34, d: -19 },
  { y: 5, t: 41, d: -29 },
];

export function SeasonalDecor() {
  const season = useSeason();

  useEffect(() => {
    if (season) document.documentElement.setAttribute("data-season", season);
    else document.documentElement.removeAttribute("data-season");
  }, [season]);

  if (season !== "halloween") return null;
  return (
    <div className="season-sky" aria-hidden="true">
      {LEAVES.map((l, i) => (
        <span
          key={i}
          className="season-leaf"
          style={
            {
              "--x": `${l.x}%`,
              "--s": `${l.size}px`,
              "--t": `${l.time}s`,
              "--d": `${l.delay}s`,
            } as React.CSSProperties
          }
        >
          <svg viewBox="0 0 24 24" style={{ color: `var(--season-leaf-${l.color + 1})` }}>
            <path d={LEAF_PATHS[l.shape]} fill="currentColor" />
            <path d="M12 22 L12 10" stroke="rgb(0 0 0 / 0.22)" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </span>
      ))}
      {BATS.map((b, i) => (
        <span key={i} className="season-bat" style={{ "--y": `${b.y}%`, "--t": `${b.t}s`, "--d": `${b.d}s` } as React.CSSProperties}>
          <svg viewBox="0 0 34 20">
            <path
              d="M17 9 C15.5 6 13 5 10.5 5.5 C9 3.5 6 3 4 4.5 C1.5 5.5 0.5 8.5 1 11.5 C3 10 5.2 10.2 6.5 12 C7.6 10.6 9.2 10.6 10.5 12 C11.4 10.2 13 9.8 14.5 10.8 L15.6 13 L17 15.5 L18.4 13 L19.5 10.8 C21 9.8 22.6 10.2 23.5 12 C24.8 10.6 26.4 10.6 27.5 12 C28.8 10.2 31 10 33 11.5 C33.5 8.5 32.5 5.5 30 4.5 C28 3 25 3.5 23.5 5.5 C21 5 18.5 6 17 9 Z"
              fill="currentColor"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
