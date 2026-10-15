"use client";

import { mix, useArtId } from "@/components/games/figure";
import { jerseyFor, jerseyNumberIn, type JerseyPick, type Sport } from "@/lib/jerseys";

/**
 * A jersey seen from the back, the name across the shoulders and the number
 * below, in its team's colors: stripes, sleeves or a band, shaded like the
 * kits the players wear. No crest, no logo. Each sport has its own cut: a
 * soccer shirt, a volleyball jersey with cap sleeves, a basketball tank, a
 * football jersey over shoulder pads with striped sleeves.
 */

interface Cut {
  shirt: string;
  /** Sleeves (or a tank's side panels), for the "sleeves" pattern. */
  sleeves: string;
  /** Trim at the neck, and at the cuffs or armholes. */
  collar: string;
  cuffs: string;
  /** Faint seams where the sleeves join. */
  seams: string;
  /** Stripes around the sleeves (football). */
  bands?: string;
}

const SOCCER: Cut = {
  shirt: "M33 9 Q50 15 67 9 L84 15 L98 33 L86 45 L80 39 L80 93 Q50 97 20 93 L20 39 L14 45 L2 33 L16 15 Z",
  sleeves: "M16 15 L2 33 L14 45 L20 39 L22 19 Z M84 15 L98 33 L86 45 L80 39 L78 19 Z",
  collar: "M33 9 Q50 15 67 9",
  cuffs: "M2.8 34 L14 44.2 M97.2 34 L86 44.2",
  seams: "M22 19 L20 39 M78 19 L80 39",
};

const CUTS: Record<Sport, Cut> = {
  soccer: SOCCER,
  volleyball: {
    shirt: "M33 9 Q50 15 67 9 L82 14 L94 28 L84 37 L80 33 L80 93 Q50 97 20 93 L20 33 L16 37 L6 28 L18 14 Z",
    sleeves: "M18 14 L6 28 L16 37 L20 33 L22 18 Z M82 14 L94 28 L84 37 L80 33 L78 18 Z",
    collar: "M33 9 Q50 15 67 9",
    cuffs: "M6.8 29 L16 36.4 M93.2 29 L84 36.4",
    seams: "M22 18 L20 33 M78 18 L80 33",
  },
  basketball: {
    shirt: "M31 6 Q50 13 69 6 L77 7 Q77 27 86 34 L84 94 Q50 98 16 94 L14 34 Q23 27 23 7 Z",
    sleeves: "M14 34 Q23 27 23 7 L27 7 Q27 30 20 40 L16 94 L14 94 Z M86 34 Q77 27 77 7 L73 7 Q73 30 80 40 L84 94 L86 94 Z",
    collar: "M31 6 Q50 13 69 6",
    cuffs: "M23 7 Q23 27 14 34 M77 7 Q77 27 86 34",
    seams: "",
  },
  football: {
    shirt: "M34 8 Q50 13 66 8 L88 14 L97 36 L84 40 L80 34 L80 93 Q50 97 20 93 L20 34 L16 40 L3 36 L12 14 Z",
    sleeves: "M12 14 L3 36 L16 40 L20 34 L22 16 Z M88 14 L97 36 L84 40 L80 34 L78 16 Z",
    collar: "M34 8 Q50 13 66 8",
    cuffs: "M3.6 35.6 L15.8 39.4 M96.4 35.6 L84.2 39.4",
    seams: "M22 16 L20 34 M78 16 L80 34",
    bands: "M5.4 30.6 L17.6 34.4 M7.2 26.4 L18.6 30.2 M94.6 30.6 L82.4 34.4 M92.8 26.4 L81.4 30.2",
  },
};

/** Is a color light enough that it wants a dark edge? */
function light(hex: string): boolean {
  const v = parseInt(hex.slice(1), 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) > 150;
}

export function JerseyArt({ pick, className }: { pick: JerseyPick; className?: string }) {
  const id = useArtId();
  const { kit, name, number } = pick;
  const cut = CUTS[pick.sport] ?? SOCCER;
  const edge = light(kit.ink) ? mix(kit.base === "#f8fafc" ? kit.second : kit.base, "#000000", 0.55) : "#ffffff";
  const nameSize = 8.4;
  const longName = !!name && name.length > 9;
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={name ? `${pick.fullName}, number ${number}, ${kit.club}` : `Jersey number ${number}`}>
      <defs>
        <clipPath id={`${id}-shirt`}>
          <path d={cut.shirt} />
        </clipPath>
        <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="0.42" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000000" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-shirt)`}>
        <rect x="0" y="0" width="100" height="100" fill={kit.base} />
        {kit.pattern === "stripes" &&
          [10, 30, 50, 70, 90].map((x) => <rect key={x} x={x - 5} y="0" width="10" height="100" fill={kit.second} />)}
        {kit.pattern === "sleeves" && <path d={cut.sleeves} fill={kit.second} />}
        {kit.pattern === "band" && (
          <>
            <rect x="37" y="0" width="26" height="100" fill={kit.second} />
            {kit.trim !== kit.second && <path d="M37 0 V100 M63 0 V100" stroke={kit.trim} strokeWidth="2" />}
          </>
        )}
        {/* Seams where the sleeves join, and the cloth's light and shade. */}
        <path d={cut.seams} stroke="#000000" strokeWidth="0.8" opacity="0.18" fill="none" />
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id}-shade)`} />
      </g>
      {/* Collar and cuffs in the trim. */}
      {cut.bands && <path d={cut.bands} stroke={kit.trim} strokeWidth="2.2" strokeLinecap="round" />}
      <path d={cut.collar} stroke={kit.trim} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={cut.cuffs} stroke={kit.trim} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d={cut.shirt} fill="none" stroke="#0f172a" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" />
      {name && (
        <text
          x="50"
          y="31"
          textAnchor="middle"
          fontSize={nameSize}
          fontWeight="800"
          letterSpacing="0.6"
          fill={kit.ink}
          stroke={edge}
          strokeWidth="1.2"
          paintOrder="stroke"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          {...(longName ? { textLength: 54, lengthAdjust: "spacingAndGlyphs" } : {})}
        >
          {name}
        </text>
      )}
      <text
        x="50"
        y={name ? 76 : 70}
        textAnchor="middle"
        fontSize="40"
        fontWeight="900"
        fill={kit.ink}
        stroke={edge}
        strokeWidth="2.2"
        paintOrder="stroke"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        className="tabular-nums"
      >
        {number}
      </text>
    </svg>
  );
}

/**
 * An answer as the soccer game shows it: a whole number from 0 to 99 (or
 * "x = 10") becomes a jersey with the name under it; anything else is null,
 * so the caller shows it as it was.
 */
export function JerseyAnswer({ text, seed, size = "md", sport = "soccer" }: { text: string; seed: string; size?: "sm" | "md"; sport?: Sport }) {
  const read = jerseyNumberIn(text);
  const pick = read && jerseyFor(read.number, seed, sport);
  if (!read || !pick) return null;
  const art = size === "sm" ? "h-12 w-12" : "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]";
  return (
    <span className="inline-flex items-center gap-2.5">
      {read.prefix && <span className="font-semibold">{read.prefix}</span>}
      <JerseyArt pick={pick} className={`${art} shrink-0 drop-shadow-sm`} />
      <JerseyCaption pick={pick} />
    </span>
  );
}

/** The number, and whose it is. */
export function JerseyCaption({ pick, lead }: { pick: JerseyPick; lead?: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-base font-black tabular-nums text-slate-900">{lead ?? pick.number}</span>
      <span className="text-xs font-semibold text-slate-500">{pick.fullName ? `${pick.fullName}, ${pick.kit.club}` : "Plain jersey"}</span>
    </span>
  );
}
