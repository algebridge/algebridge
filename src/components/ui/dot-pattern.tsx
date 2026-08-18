"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

interface DotPatternProps extends React.SVGProps<SVGSVGElement> {
  /** Grid cell size — the gap between dots. */
  width?: number;
  height?: number;
  /** Offset of the whole grid. */
  x?: number;
  y?: number;
  /** Dot position inside its cell, and its radius. */
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
}

/**
 * Tiled dot grid, drawn as one SVG <pattern> rather than thousands of nodes.
 * Colour comes from the `fill-*` class; fade it with a Tailwind [mask-image:…].
 */
function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  ...props
}: DotPatternProps) {
  // useId returns things like ":r0:" (React 18) or "«r0»" (React 19). Those are
  // legal HTML ids but make a fragile url(#…) reference, so strip to word chars.
  const id = `dots-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-neutral-400/80",
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}

export { DotPattern };
