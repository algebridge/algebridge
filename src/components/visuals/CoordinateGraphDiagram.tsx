import type { CoordinateSpec } from "@/types";

interface CoordinateGraphDiagramProps {
  spec: CoordinateSpec;
  /** Show numbers along the axes (great for the big "Explore" view, too busy for
   *  the small quiz thumbnails). */
  showAxisNumbers?: boolean;
  /** Draw a rise/run staircase from the y-intercept — helps kids "read" slope. */
  showRiseRun?: boolean;
}

const SIZE = 240;
const PAD = 22;
const LINE_COLOR = "#2563eb"; // friendly blue
const LINE_COLOR_2 = "#f59e0b"; // amber for a second line
const POINT_COLOR = "#dc2626"; // red dot stands out

export function CoordinateGraphDiagram({
  spec,
  showAxisNumbers = false,
  showRiseRun = false,
}: CoordinateGraphDiagramProps) {
  const { range, lines = [], points = [], shade, parabola } = spec;
  const scale = SIZE - PAD * 2;

  const toSvg = (x: number, y: number): [number, number] => [
    PAD + ((x + range) / (2 * range)) * scale,
    PAD + ((range - y) / (2 * range)) * scale,
  ];
  const clampY = (y: number) => Math.max(-range * 4, Math.min(range * 4, y));

  const gridValues: number[] = [];
  for (let v = Math.ceil(-range); v <= Math.floor(range); v += 1) gridValues.push(v);
  // Label every value for small ranges, every other value once it gets crowded.
  const labelStep = range <= 6 ? 1 : 2;

  const shadeLine = shade ? lines[0] : undefined;
  const shadePolygon = shadeLine
    ? [
        toSvg(-range, clampY(shadeLine.slope * -range + shadeLine.intercept)),
        toSvg(range, clampY(shadeLine.slope * range + shadeLine.intercept)),
        toSvg(range, shade === "above" ? range * 4 : -range * 4),
        toSvg(-range, shade === "above" ? range * 4 : -range * 4),
      ]
        .map((p) => p.join(","))
        .join(" ")
    : null;

  const parabolaPath = parabola
    ? (() => {
        const steps = 60;
        const pts: string[] = [];
        for (let i = 0; i <= steps; i += 1) {
          const x = -range + (i / steps) * range * 2;
          const y = clampY(parabola.a * (x - parabola.h) ** 2 + parabola.k);
          const [sx, sy] = toSvg(x, y);
          pts.push(`${i === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`);
        }
        return pts.join(" ");
      })()
    : null;

  const [originX, originY] = toSvg(0, 0);

  // Rise/run staircase for the first line (from y-intercept to one unit right).
  const riseRun =
    showRiseRun && lines.length === 1 && Math.abs(lines[0].slope) <= 4
      ? (() => {
          const b = lines[0].intercept;
          const m = lines[0].slope;
          if (Math.abs(b) > range || Math.abs(b + m) > range) return null;
          const [x0, y0] = toSvg(0, b);
          const [x1, y1r] = toSvg(1, b);
          const [x2, y2] = toSvg(1, b + m);
          return { x0, y0, x1, y1r, x2, y2, m };
        })()
      : null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-full w-full"
      role="img"
      aria-label="coordinate plane diagram"
    >
      {/* grid */}
      {gridValues.map((v) => {
        const [gx] = toSvg(v, 0);
        const [, gy] = toSvg(0, v);
        return (
          <g key={`grid-${v}`}>
            <line x1={gx} y1={PAD} x2={gx} y2={SIZE - PAD} stroke="#e2e8f0" strokeWidth={v === 0 ? 0 : 0.7} />
            <line x1={PAD} y1={gy} x2={SIZE - PAD} y2={gy} stroke="#e2e8f0" strokeWidth={v === 0 ? 0 : 0.7} />
          </g>
        );
      })}

      {/* shaded half-plane */}
      {shadePolygon && <polygon points={shadePolygon} fill={LINE_COLOR} fillOpacity={0.14} />}

      {/* axes with arrowheads */}
      <line x1={PAD - 4} y1={originY} x2={SIZE - PAD + 4} y2={originY} stroke="#334155" strokeWidth={1.5} />
      <line x1={originX} y1={SIZE - PAD + 4} x2={originX} y2={PAD - 4} stroke="#334155" strokeWidth={1.5} />
      <polygon
        points={`${SIZE - PAD + 4},${originY} ${SIZE - PAD - 3},${originY - 4} ${SIZE - PAD - 3},${originY + 4}`}
        fill="#334155"
      />
      <polygon
        points={`${originX},${PAD - 4} ${originX - 4},${PAD + 3} ${originX + 4},${PAD + 3}`}
        fill="#334155"
      />
      <text x={SIZE - PAD + 6} y={originY + 11} fontSize={11} fontWeight={600} fill="#334155">x</text>
      <text x={originX + 6} y={PAD} fontSize={11} fontWeight={600} fill="#334155">y</text>

      {/* axis numbers */}
      {showAxisNumbers &&
        gridValues
          .filter((v) => v !== 0 && v % labelStep === 0)
          .map((v) => {
            const [gx] = toSvg(v, 0);
            const [, gy] = toSvg(0, v);
            return (
              <g key={`num-${v}`}>
                <text x={gx} y={originY + 13} fontSize={9} textAnchor="middle" fill="#94a3b8">{v}</text>
                <text x={originX - 6} y={gy + 3} fontSize={9} textAnchor="end" fill="#94a3b8">{v}</text>
              </g>
            );
          })}

      {/* rise/run helper */}
      {riseRun && (
        <g>
          <line x1={riseRun.x0} y1={riseRun.y0} x2={riseRun.x1} y2={riseRun.y1r} stroke="#16a34a" strokeWidth={2} strokeDasharray="3,2" />
          <line x1={riseRun.x1} y1={riseRun.y1r} x2={riseRun.x2} y2={riseRun.y2} stroke="#16a34a" strokeWidth={2} strokeDasharray="3,2" />
          <text x={(riseRun.x0 + riseRun.x1) / 2} y={riseRun.y1r + 12} fontSize={8} textAnchor="middle" fill="#16a34a">run 1</text>
          <text x={riseRun.x2 + 4} y={(riseRun.y1r + riseRun.y2) / 2} fontSize={8} fill="#16a34a">rise {riseRun.m}</text>
        </g>
      )}

      {/* lines */}
      {lines.map((line, i) => {
        const [x1, y1] = toSvg(-range, clampY(line.slope * -range + line.intercept));
        const [x2, y2] = toSvg(range, clampY(line.slope * range + line.intercept));
        return (
          <line
            key={`line-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={line.color ?? (i === 0 ? LINE_COLOR : LINE_COLOR_2)}
            strokeWidth={3}
            strokeDasharray={line.dashed ? "6,4" : undefined}
            strokeLinecap="round"
          />
        );
      })}

      {/* parabola */}
      {parabolaPath && (
        <path d={parabolaPath} fill="none" stroke={LINE_COLOR} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* points */}
      {points.map((point, i) => {
        const [x, y] = toSvg(point.x, point.y);
        return (
          <g key={`pt-${i}`}>
            <circle cx={x} cy={y} r={5.5} fill={POINT_COLOR} stroke="white" strokeWidth={2} />
            {point.label && (
              <text x={x + 8} y={y - 6} fontSize={10} fontWeight={600} fill="#475569">
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
