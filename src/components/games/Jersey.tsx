"use client";

import { mix, useArtId } from "@/components/games/figure";
import { jerseyFor, jerseyNumberIn, type JerseyPick } from "@/lib/jerseys";

/**
 * A soccer jersey seen from the back, the name across the shoulders and the
 * number below, in its club's colors: stripes, sleeves or a band, shaded like
 * the kits the players wear. No crest, no logo.
 */

const SHIRT = "M33 9 Q50 15 67 9 L84 15 L98 33 L86 45 L80 39 L80 93 Q50 97 20 93 L20 39 L14 45 L2 33 L16 15 Z";
const SLEEVES = "M16 15 L2 33 L14 45 L20 39 L22 19 Z M84 15 L98 33 L86 45 L80 39 L78 19 Z";

/** Is a color light enough that it wants a dark edge? */
function light(hex: string): boolean {
  const v = parseInt(hex.slice(1), 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) > 150;
}

export function JerseyArt({ pick, className }: { pick: JerseyPick; className?: string }) {
  const id = useArtId();
  const { kit, name, number } = pick;
  const edge = light(kit.ink) ? mix(kit.base === "#f8fafc" ? kit.second : kit.base, "#000000", 0.55) : "#ffffff";
  const nameSize = 8.4;
  const longName = !!name && name.length > 9;
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={name ? `${pick.fullName}, number ${number}, ${kit.club}` : `Jersey number ${number}`}>
      <defs>
        <clipPath id={`${id}-shirt`}>
          <path d={SHIRT} />
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
        {kit.pattern === "sleeves" && <path d={SLEEVES} fill={kit.second} />}
        {kit.pattern === "band" && (
          <>
            <rect x="37" y="0" width="26" height="100" fill={kit.second} />
            {kit.trim !== kit.second && <path d="M37 0 V100 M63 0 V100" stroke={kit.trim} strokeWidth="2" />}
          </>
        )}
        {/* Seams where the sleeves join, and the cloth's light and shade. */}
        <path d="M22 19 L20 39 M78 19 L80 39" stroke="#000000" strokeWidth="0.8" opacity="0.18" fill="none" />
        <rect x="0" y="0" width="100" height="100" fill={`url(#${id}-shade)`} />
      </g>
      {/* Collar and cuffs in the trim. */}
      <path d="M33 9 Q50 15 67 9" stroke={kit.trim} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M2.8 34 L14 44.2 M97.2 34 L86 44.2" stroke={kit.trim} strokeWidth="2.6" strokeLinecap="round" />
      <path d={SHIRT} fill="none" stroke="#0f172a" strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" />
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
export function JerseyAnswer({ text, seed, size = "md" }: { text: string; seed: string; size?: "sm" | "md" }) {
  const read = jerseyNumberIn(text);
  const pick = read && jerseyFor(read.number, seed);
  if (!read || !pick) return null;
  const art = size === "sm" ? "h-12 w-12" : "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]";
  return (
    <span className="inline-flex items-center gap-2.5">
      {read.prefix && <span className="font-semibold">{read.prefix}</span>}
      <JerseyArt pick={pick} className={`${art} shrink-0 drop-shadow-sm`} />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-black tabular-nums text-slate-900">{pick.number}</span>
        <span className="text-xs font-semibold text-slate-500">{pick.fullName ? `${pick.fullName}, ${pick.kit.club}` : "Plain jersey"}</span>
      </span>
    </span>
  );
}
