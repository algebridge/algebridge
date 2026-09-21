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
};

export function UnitMark({ unitId, size = 22, className = "" }: { unitId: string; size?: number; className?: string }) {
  const mark = MARKS[unitId] ?? <circle cx="12" cy="12" r="6" />;
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
