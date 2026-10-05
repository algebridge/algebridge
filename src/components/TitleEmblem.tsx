"use client";

import { useId } from "react";
import { hueVars, topicHue } from "@/lib/hues";
import { tierOf, type TitleTier } from "@/lib/titles";
import type { DisplayTitle } from "@/types";

/**
 * A drawn emblem for every display title, on the same 24 grid, stroke and
 * caps as src/components/Icon.tsx: line art, never emoji (emoji render
 * differently on every phone and read as a placeholder).
 */
const EMBLEMS: Record<string, React.ReactNode> = {
  // A shuriken.
  "algebra-ninja": (
    <>
      <path d="M12 2.6 L14 10 L21.4 12 L14 14 L12 21.4 L10 14 L2.6 12 L10 10Z" />
      <circle cx="12" cy="12" r="1.7" />
    </>
  ),
  // A mortarboard.
  "math-master": (
    <>
      <path d="M2.5 9 L12 4.6 L21.5 9 L12 13.4Z" />
      <path d="M6.5 11 V15.4 C6.5 17 9 18.4 12 18.4 S17.5 17 17.5 15.4 V11" />
      <path d="M21.5 9 V14.5" />
    </>
  ),
  // A star.
  "slope-superstar": <path d="M12 3.4 L14.6 8.7 L20.5 9.6 L16.2 13.7 L17.2 19.5 L12 16.7 L6.8 19.5 L7.8 13.7 L3.5 9.6 L9.4 8.7Z" />,
  // A rising line on its axes.
  "graph-guru": (
    <>
      <path d="M4 3.5 V20 H20.5" />
      <path d="M7 15.5 L11 11 L14 13.5 L19 7.5" />
      <path d="M15.6 7.5 H19 V10.9" />
    </>
  ),
  // A suspension bridge.
  "bridge-builder": (
    <>
      <path d="M2.5 15.5 H21.5" />
      <path d="M3.5 15.5 Q12 3.5 20.5 15.5" />
      <path d="M8 10.4 V15.5 M12 8.4 V15.5 M16 10.4 V15.5" />
      <path d="M2.5 19.2 H21.5" />
    </>
  ),
  // A crown.
  "equation-emperor": (
    <>
      <path d="M4 17.5 L3 8 L8 11.5 L12 5 L16 11.5 L21 8 L20 17.5Z" />
      <path d="M4 20.6 H20" />
    </>
  ),
  // A pyramid with a division sign.
  "fraction-pharaoh": (
    <>
      <path d="M2.8 19.6 L12 4.6 L21.2 19.6Z" />
      <path d="M8.2 14.2 H15.8 M12 11.2 h.01 M12 17.2 h.01" />
    </>
  ),
  // A cut gem.
  "quadratic-queen": (
    <>
      <path d="M7 4.5 H17 L21 9.5 L12 20.2 L3 9.5Z" />
      <path d="M3 9.5 H21 M8.6 9.5 L12 20.2 L15.4 9.5 M9.8 4.5 L8.6 9.5 M14.2 4.5 L15.4 9.5" />
    </>
  ),
  // A medal with an x on it.
  "variable-victor": (
    <>
      <path d="M8 2.8 L12 8.6 L16 2.8" />
      <circle cx="12" cy="15" r="5.4" />
      <path d="M10.2 13.2 L13.8 16.8 M13.8 13.2 L10.2 16.8" />
    </>
  ),
  // Lightning out of a cloud.
  "brainstorm-boss": (
    <>
      <path d="M7.2 15.4 A4 4 0 0 1 7.6 7.4 A5.2 5.2 0 0 1 17.4 8.6 A3.4 3.4 0 0 1 17.2 15.4" />
      <path d="M12.6 11.6 L10.4 15.6 H13.6 L11.4 20" />
    </>
  ),
  // A stack of coins.
  "bridgey-baron": (
    <>
      <ellipse cx="12" cy="6.6" rx="7" ry="2.6" />
      <path d="M5 6.6 V10.8 C5 12.2 8.1 13.4 12 13.4 S19 12.2 19 10.8 V6.6" />
      <path d="M5 10.8 V15 C5 16.4 8.1 17.6 12 17.6 S19 16.4 19 15 V10.8" />
    </>
  ),
  // A flame.
  "streak-champion": <path d="M12 21 C8 21 5.5 18.2 5.5 14.8 C5.5 11 8.5 9.5 9 5.5 C11.4 7 12.6 9.1 12.8 11.4 C13.7 10.6 14.3 9.4 14.4 8.2 C16.5 10.1 18 12.6 18 15 C18 18.3 15.4 21 12 21Z" />,
  // Infinity.
  "infinity-icon": <path d="M12 12 C10 9.2 8.4 8 6.5 8 A4 4 0 0 0 6.5 16 C8.4 16 10 14.8 12 12 C14 9.2 15.6 8 17.5 8 A4 4 0 0 1 17.5 16 C15.6 16 14 14.8 12 12Z" />,
  // A ringed planet and a star.
  "cosmic-calculator": (
    <>
      <circle cx="11" cy="13" r="4.6" />
      <ellipse cx="11" cy="13" rx="9.2" ry="3.2" transform="rotate(-18 11 13)" />
      <path d="M19 3.4 V7 M17.2 5.2 H20.8" />
    </>
  ),
  // A dragon's eye.
  "dragon-solver": (
    <>
      <path d="M2.4 12 C6 6.3 18 6.3 21.6 12 C18 17.7 6 17.7 2.4 12Z" />
      <path d="M12 8 C13.4 9.9 13.4 14.1 12 16 C10.6 14.1 10.6 9.9 12 8Z" />
    </>
  ),
  // An atom.
  "quantum-queen": (
    <>
      <ellipse cx="12" cy="12" rx="9.4" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9.4" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9.4" ry="3.6" transform="rotate(-60 12 12)" />
      <circle cx="12" cy="12" r="1.3" />
    </>
  ),
  // A trophy.
  "legend-of-algebridge": (
    <>
      <path d="M7 4 H17 V9 A5 5 0 0 1 7 9Z" />
      <path d="M7 5.8 H4.6 A2.6 2.6 0 0 0 7.2 10.6 M17 5.8 H19.4 A2.6 2.6 0 0 1 16.8 10.6" />
      <path d="M12 14 V17.4 M8.6 20.6 H15.4 M9.6 17.4 H14.4 V20.6 H9.6Z" />
    </>
  ),
  // A money bag with a gem.
  "bridgey-billionaire": (
    <>
      <path d="M9 6.4 H15 L13.6 3.4 H10.4Z" />
      <path d="M9 6.4 C5 9 4 12.8 4.4 15.8 C4.9 19 8 20.6 12 20.6 S19.1 19 19.6 15.8 C20 12.8 19 9 15 6.4" />
      <path d="M12 11 L14.6 13.6 L12 16.2 L9.4 13.6Z" />
    </>
  ),
  // A compass.
  "path-finder": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.6 8.4 L13.1 13.1 L8.4 15.6 L10.9 10.9Z" />
    </>
  ),
  // A key.
  "unit-unlocker": (
    <>
      <circle cx="7.6" cy="12" r="4.2" />
      <path d="M11.8 12 H21 M18 12 V15.2 M15.4 12 V14.2" />
    </>
  ),
  // An open book.
  "story-solver": (
    <>
      <path d="M12 6.6 C10 5 7 4.5 3.4 5 V18.6 C7 18 10 18.5 12 20 C14 18.5 17 18 20.6 18.6 V5 C17 4.5 14 5 12 6.6Z" />
      <path d="M12 6.6 V20" />
    </>
  ),
  // Two arrows turning back on themselves.
  "comeback-kid": (
    <>
      <path d="M19.8 10.6 A8 8 0 0 0 5.6 7 M4.2 13.4 A8 8 0 0 0 18.4 17" />
      <path d="M5.6 3.4 V7 H9.2 M18.4 20.6 V17 H14.8" />
    </>
  ),
  // A target.
  "intercept-ace": (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  // Scales.
  "inequality-judge": (
    <>
      <path d="M12 4 V19.6 M7.4 19.6 H16.6 M5 7 H19" />
      <path d="M5 7 L2.6 13 A2.4 1.6 0 0 0 7.4 13Z M19 7 L16.6 13 A2.4 1.6 0 0 0 21.4 13Z" />
    </>
  ),
  // The sun coming up.
  "early-bird-solver": (
    <>
      <path d="M2.8 18.2 H21.2 M7 18.2 A5 5 0 0 1 17 18.2" />
      <path d="M12 7.2 V9.6 M5.8 11.6 L7.4 13.2 M18.2 11.6 L16.6 13.2 M3.6 15 H5.2 M18.8 15 H20.4" />
    </>
  ),
  // A crescent moon and a star.
  "night-owl": (
    <>
      <path d="M15.2 3.6 A8.6 8.6 0 1 0 20.6 16.4 A7 7 0 0 1 15.2 3.6Z" />
      <path d="M7.4 5 V8 M5.9 6.5 H8.9" />
    </>
  ),
  // A chess rook.
  "systems-strategist": (
    <>
      <path d="M6.6 20.6 H17.4 M8 17.6 H16" />
      <path d="M9 17.6 L9.5 10.6 H14.5 L15 17.6" />
      <path d="M8 10.6 H16 V5.6 H14 V7.2 H13 V5.6 H11 V7.2 H10 V5.6 H8Z" />
    </>
  ),
  // A crystal ball.
  "sequence-seer": (
    <>
      <circle cx="12" cy="10.4" r="7" />
      <path d="M7.4 20.6 H16.6 L15 17.4 H9Z" />
      <path d="M9.4 7.4 A3.4 3.4 0 0 0 8 9.6" />
    </>
  ),
  // A square-root sign.
  "radical-rebel": <path d="M2.8 13.2 L5.6 12.2 L8.6 19.8 L12.6 4.4 H21.2" />,
  // A rocket.
  "exponent-explorer": (
    <>
      <path d="M12 2.6 C15.6 5.2 16.6 9.2 15.6 14 H8.4 C7.4 9.2 8.4 5.2 12 2.6Z" />
      <path d="M8.6 11.4 L5.6 15 L8.6 15.4 M15.4 11.4 L18.4 15 L15.4 15.4" />
      <path d="M10.4 17.2 Q12 21.6 13.6 17.2" />
      <circle cx="12" cy="8.6" r="1.6" />
    </>
  ),
  // A function machine: in, through, out.
  "function-whisperer": (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M2.6 12 H7 M17 12 H21.4 M19.4 10 L21.4 12 L19.4 14" />
      <path d="M10 10.4 L14 13.6 M14 10.4 L10 13.6" />
    </>
  ),
  // A fox.
  "factoring-fox": (
    <>
      <path d="M4 4.4 L9 9 H15 L20 4.4 L19 13.2 L12 19.6 L5 13.2Z" />
      <path d="M9.4 12.6 h.01 M14.6 12.6 h.01 M12 16 h.01" />
    </>
  ),
  // A paper plane.
  "parabola-pilot": (
    <>
      <path d="M21.4 3 L2.6 11 L10 13.6 L12.6 21Z" />
      <path d="M10 13.6 L21.4 3" />
    </>
  ),
  // Absolute-value bars around a diamond.
  "absolute-legend": (
    <>
      <path d="M5.6 4 V20 M18.4 4 V20" />
      <path d="M12 8.4 L15 12 L12 15.6 L9 12Z" />
    </>
  ),
  // A puzzle piece.
  "piecewise-pioneer": <path d="M4 8 H8 A2 2 0 1 1 12 8 H16 V12 A2 2 0 1 1 16 16 V20 H4Z" />,
  // A map grid with a marker.
  "gridmaster": (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2" />
      <path d="M3.4 9.2 H20.6 M3.4 14.8 H20.6 M9.2 3.4 V20.6 M14.8 3.4 V20.6" />
    </>
  ),
  // A lightning bolt.
  "first-try-phenom": <path d="M13 2.6 L5 13.6 H11.4 L10.4 21.4 L19 10.2 H12.6Z" />,
  // A shield with a bridge on it.
  "keeper-of-the-bridge": (
    <>
      <path d="M12 2.8 L19.6 5.8 V11.6 C19.6 16 16.4 19.4 12 21.2 C7.6 19.4 4.4 16 4.4 11.6 V5.8Z" />
      <path d="M7.4 14.6 Q12 7.8 16.6 14.6 M7 14.6 H17" />
    </>
  ),
};

/** The corners of a hexagon, point up, as unit vectors. */
const HEX: [number, number][] = [[0.0, -1.0], [0.866, -0.5], [0.866, 0.5], [0.0, 1.0], [-0.866, 0.5], [-0.866, -0.5]];
/** Twenty-four notches around a rim, as unit vectors. */
const RIM: [number, number][] = [[1.0, 0.0], [0.9659, 0.2588], [0.866, 0.5], [0.7071, 0.7071], [0.5, 0.866], [0.2588, 0.9659], [0.0, 1.0], [-0.2588, 0.9659], [-0.5, 0.866], [-0.7071, 0.7071], [-0.866, 0.5], [-0.9659, 0.2588], [-1.0, 0.0], [-0.9659, -0.2588], [-0.866, -0.5], [-0.7071, -0.7071], [-0.5, -0.866], [-0.2588, -0.9659], [0.0, -1.0], [0.2588, -0.9659], [0.5, -0.866], [0.7071, -0.7071], [0.866, -0.5], [0.9659, -0.2588]];

/** True for every title that has an emblem (a test holds the catalog to it). */
export function hasEmblem(id: string): boolean {
  return id in EMBLEMS;
}

/** A title's emblem as a line icon, in the current text color. */
export function TitleEmblem({ id, size = 18, className = "" }: { id: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {EMBLEMS[id] ?? <circle cx="12" cy="12" r="7" />}
    </svg>
  );
}

/**
 * The title's badge for the shop: its emblem in a frame its tier earns. A
 * tinted tile, a tile in its own color, a night-sky hexagon with a metal
 * edge, or a gold medallion with a notched rim.
 */
export function TitleBadge({ title, size = 56 }: { title: DisplayTitle; size?: number }) {
  const tier: TitleTier = tierOf(title);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const inner = Math.round(size * 0.46);
  const emblem = (color: string) => (
    <g transform={`translate(${(size - inner) / 2} ${(size - inner) / 2})`} style={{ color }}>
      <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {EMBLEMS[title.id] ?? <circle cx="12" cy="12" r="7" />}
      </svg>
    </g>
  );
  if (tier === "common" || tier === "rare") {
    const style = hueVars(topicHue(title.id));
    return (
      <span
        aria-hidden
        style={{ ...style, width: size, height: size }}
        className={`flex shrink-0 items-center justify-center rounded-2xl ${tier === "common" ? "tb-common" : "tb-rare"}`}
      >
        <TitleEmblem id={title.id} size={inner} />
      </span>
    );
  }
  const s = size;
  const c = s / 2;
  if (tier === "epic") {
    // A hexagon, point up.
    // Written-out unit vectors: Math.cos and Math.sin can differ in the last digit between
    // the server and the browser, which breaks hydration.
    const hex = HEX.map(([x, y]) => `${(c + (c - 2) * x).toFixed(2)},${(c + (c - 2) * y).toFixed(2)}`).join(" ");
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden className="shrink-0">
        <defs>
          <linearGradient id={`${uid}-epic`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="55%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#86198f" />
          </linearGradient>
          <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f5f3ff" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#f0abfc" />
          </linearGradient>
        </defs>
        <polygon points={hex} fill={`url(#${uid}-epic)`} stroke={`url(#${uid}-edge)`} strokeWidth="2" />
        <polygon points={hex} fill="#ffffff" opacity="0.08" transform={`translate(0 ${-s * 0.18}) scale(1 0.55)`} style={{ transformOrigin: `${c}px ${c}px` }} />
        {emblem("#f3e8ff")}
      </svg>
    );
  }
  // Legendary: a gold medallion with a notched rim and two sparkles.
  const r1 = c - 1.5;
  const r2 = c - 4.5;
  const ticks = RIM.map(([x, y]) => `M${(c + r1 * x).toFixed(2)} ${(c + r1 * y).toFixed(2)} L${(c + r2 * x).toFixed(2)} ${(c + r2 * y).toFixed(2)}`).join(" ");
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden className="shrink-0">
      <defs>
        <radialGradient id={`${uid}-gold`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r={c - 1} fill={`url(#${uid}-rim)`} />
      <path d={ticks} stroke="#fef3c7" strokeWidth="1.4" opacity="0.7" />
      <circle cx={c} cy={c} r={c - 5.5} fill={`url(#${uid}-gold)`} />
      {emblem("#78350f")}
      <path d={`M${s * 0.82} ${s * 0.1} v${s * 0.12} M${s * 0.76} ${s * 0.16} h${s * 0.12}`} stroke="#fffbeb" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M${s * 0.12} ${s * 0.8} v${s * 0.08} M${s * 0.08} ${s * 0.84} h${s * 0.08}`} stroke="#fffbeb" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
