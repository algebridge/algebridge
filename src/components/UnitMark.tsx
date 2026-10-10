import { units } from "@/data/curriculum";

/**
 * A line drawing for each unit: the idea of the unit in one stroke, the way a
 * ruler stands for measuring. Drawn on a 24-grid with the same stroke as the
 * app's icons, colored by wherever it sits. The curriculum's own `icon`
 * field is emoji, which the learning screens keep out.
 */
const MARKS: Record<string, React.ReactNode> = {
  // A ruler.
  "working-with-units": (
    <>
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
      <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
    </>
  ),
  // A balance.
  "solving-equations": (
    <>
      <path d="M12 4v16M6 20h12M4 9l8-2 8 2" />
      <path d="M4 9l-2 5a3 3 0 0 0 6 0L6 9M20 9l-2 5a3 3 0 0 0 6 0l-2-5" />
    </>
  ),
  // A straight line through two points, on axes.
  "linear-equations-graphs": (
    <>
      <path d="M4 4v16h16" />
      <path d="M6 17L19 6" />
      <circle cx="9" cy="14.5" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8.5" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  // Slope-intercept: a line crossing the y-axis, the intercept marked.
  "forms-linear-equations": (
    <>
      <path d="M5 4v16h15" />
      <path d="M5 14l14-8" />
      <circle cx="5" cy="14" r="1.9" fill="currentColor" stroke="none" />
    </>
  ),
  // Two lines with different slopes meeting at one point.
  "systems-equations": (
    <>
      <path d="M4 4v16h16" />
      <path d="M6 17l13-9M6 8l12 10" />
      <circle cx="11.9" cy="12.9" r="1.9" fill="currentColor" stroke="none" />
    </>
  ),
  // A shaded half-plane.
  "inequalities-systems": (
    <>
      <path d="M4 20L20 4" />
      <path d="M9 20l11-11M14 20l6-6" />
      <path d="M4 20h16" />
    </>
  ),
  // A function machine: in, f, out.
  functions: (
    <>
      <path d="M2.5 12h4.5M17 12h4.5" />
      <rect x="7.5" y="7" width="9" height="10" rx="2" />
      <path d="M13.4 9.6c-1.6-.5-2.3.6-2.5 1.8l-.6 3.4c-.2 1-.8 1.5-1.8 1.3M9.8 12.3h3.6" />
    </>
  ),
  // Terms stepping up by the same amount.
  sequences: (
    <>
      <circle cx="5" cy="17.5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="9.7" cy="13.8" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="10.1" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="6.4" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  // The square root of x.
  "exponents-radicals": (
    <>
      <path d="M3 13l2.5 6 4.5-15h11" />
      <path d="M12.5 10.5l5 5M17.5 10.5l-5 5" />
    </>
  ),
  // A curve taking off.
  "exponential-growth-decay": (
    <>
      <path d="M4 4v16h16" />
      <path d="M6 17c5 0 8-1 11-11" />
    </>
  ),
  // The area model: a box split into its four products.
  "quadratics-factoring": (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M11 5v14M4 11h16" />
    </>
  ),
  // A parabola.
  "quadratic-functions": (
    <>
      <path d="M4 5c2 12 6 15 8 15s6-3 8-15" />
      <path d="M4 12h16" />
    </>
  ),
  // A V, absolute value.
  "absolute-value-piecewise": (
    <>
      <path d="M4 6l8 12 8-12" />
      <path d="M4 20h16" />
    </>
  ),
  // A box plot: whiskers, the box, and the median line inside it.
  "data-statistics": (
    <>
      <path d="M3 12h4M17 12h4M3 9v6M21 9v6" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
      <path d="M11 7v10" />
    </>
  ),
  // A curve and the same curve moved: a function transformed.
  "modeling-functions": (
    <>
      <path d="M3 18c3-1 5-4 6-10" />
      <path d="M11 18c3-1 5-4 6-10" strokeDasharray="2 2.5" />
      <path d="M15 5h5M18 3l2 2-2 2" />
    </>
  ),

  // Algebra 2
  // The complex plane: a point off the real line.
  "complex-numbers": (
    <>
      <path d="M4 12h16M12 4v16" />
      <path d="M12 12l5-5" strokeDasharray="2 2.5" />
      <circle cx="17" cy="7" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  // A cubic's wave.
  "polynomial-functions": (
    <>
      <path d="M3 17c4-13 6-13 9-1s5 12 9-12" />
    </>
  ),
  // A parabola with its vertex marked.
  "quadratics-revisited": (
    <>
      <path d="M4 5c3 12 13 12 16 0" />
      <circle cx="12" cy="14" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  // A fraction with x above and below the bar.
  "rational-expressions": (
    <>
      <path d="M6 12h12" />
      <path d="M9.5 4.5l5 5M14.5 4.5l-5 5" />
      <path d="M9.5 14.5l5 5M14.5 14.5l-5 5" />
    </>
  ),
  // A root sign with its index.
  "radicals-rational-exponents": (
    <>
      <path d="M3 12l3 7L11 4h10" />
      <path d="M14 8h4" />
    </>
  ),
  // An exponential curve and its mirror, the log.
  "exponential-logarithmic": (
    <>
      <path d="M4 20c6 0 10-4 12-14" />
      <path d="M4 18c3-6 8-9 16-10" strokeDasharray="2 2.5" />
    </>
  ),
  // Terms adding up.
  "sequences-series": (
    <>
      <path d="M3 20h18" />
      <path d="M5.5 20v-3M10 20v-6M14.5 20v-9M19 20v-12" />
    </>
  ),
  // The unit circle, a radius and the angle it makes.
  trigonometry: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12h8M12 12l5.7-5.7" />
      <path d="M16 12a4 4 0 0 0-1.2-2.8" />
    </>
  ),
};

/** A unit's mark as bare paths on the 24-grid, to draw inside a larger SVG (a certificate's seal). */
export function unitMarkPaths(unitId: string): React.ReactNode {
  return MARKS[unitId] ?? <circle cx="12" cy="12" r="6" />;
}

export function UnitMark({ unitId, size = 22, className = "" }: { unitId: string; size?: number; className?: string }) {
  const mark = unitMarkPaths(unitId);
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
      className={className}
    >
      {mark}
    </svg>
  );
}

/** Every unit has a mark; the test suite asserts this. */
export const MARKED_UNITS = Object.keys(MARKS);
export const ALL_UNITS_MARKED = units.every((u) => u.id in MARKS);
