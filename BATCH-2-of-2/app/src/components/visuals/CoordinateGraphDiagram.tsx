import type { CoordinateSpec } from "@/types";

interface CoordinateGraphDiagramProps {
  spec: CoordinateSpec;
}

const SIZE = 220;
const PAD = 16;

export function CoordinateGraphDiagram({ spec }: CoordinateGraphDiagramProps) {
  const { range, lines = [], points = [], shade, parabola } = spec;
  const scale = SIZE - PAD * 2;

  const toSvg = (x: number, y: number): [number, number] => [
    PAD + ((x + range) / (2 * range)) * scale,
    PAD + ((range - y) / (2 * range)) * scale,
  ];

  const gridValues = [];
  for (let v = Math.ceil(-range); v <= Math.floor(range); v += 1) gridValues.push(v);

  const shadeLine = shade ? lines[0] : undefined;
  const shadePolygon = shadeLine
    ? [
        toSvg(-range, shadeLine.slope * -range + shadeLine.intercept),
        toSvg(range, shadeLine.slope * range + shadeLine.intercept),
        toSvg(range, shade === "above" ? range * 3 : -range * 3),
        toSvg(-range, shade === "above" ? range * 3 : -range * 3),
      ]
        .map((p) => p.join(","))
        .join(" ")
    : null;

  const parabolaPath = parabola
    ? (() => {
        const steps = 40;
        const pts: string[] = [];
        for (let i = 0; i <= steps; i += 1) {
          const x = -range + (i / steps) * range * 2;
          const y = parabola.a * (x - parabola.h) ** 2 + parabola.k;
          const [sx, sy] = toSvg(x, y);
          pts.push(`${i === 0 ? "M" : "L"}${sx},${sy}`);
        }
        return pts.join(" ");
      })()
    : null;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label="coordinate plane diagram">
      {gridValues.map((v) => {
        const [gx] = toSvg(v, 0);
        const [, gy] = toSvg(0, v);
        return (
          <g key={v}>
            <line x1={gx} y1={PAD} x2={gx} y2={SIZE - PAD} stroke="currentColor" strokeWidth={v === 0 ? 1.5 : 0.5} className={v === 0 ? "text-slate-400" : "text-slate-200"} />
            <line x1={PAD} y1={gy} x2={SIZE - PAD} y2={gy} stroke="currentColor" strokeWidth={v === 0 ? 1.5 : 0.5} className={v === 0 ? "text-slate-400" : "text-slate-200"} />
          </g>
        );
      })}

      {shadePolygon && (
        <polygon points={shadePolygon} className="fill-black" fillOpacity={0.12} />
      )}

      {lines.map((line, i) => {
        const [x1, y1] = toSvg(-range, line.slope * -range + line.intercept);
        const [x2, y2] = toSvg(range, line.slope * range + line.intercept);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={line.color ?? "black"}
            strokeWidth={2.5}
            strokeDasharray={line.dashed ? "5,4" : undefined}
            strokeLinecap="round"
          />
        );
      })}

      {parabolaPath && (
        <path d={parabolaPath} fill="none" stroke="black" strokeWidth={2.5} strokeLinecap="round" />
      )}

      {points.map((point, i) => {
        const [x, y] = toSvg(point.x, point.y);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={5} className="fill-black stroke-white" strokeWidth={1.5} />
            {point.label && (
              <text x={x + 8} y={y - 6} fontSize={10} className="fill-slate-600">
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
