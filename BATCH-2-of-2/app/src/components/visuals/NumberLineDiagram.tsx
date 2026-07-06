import type { NumberLineSpec } from "@/types";

interface NumberLineDiagramProps {
  spec: NumberLineSpec;
  size?: number;
}

const WIDTH = 220;
const HEIGHT = 70;
const PAD = 18;

export function NumberLineDiagram({ spec, size = WIDTH }: NumberLineDiagramProps) {
  const { min, max, mark } = spec;
  const scale = size - PAD * 2;
  const toX = (value: number) => PAD + ((value - min) / (max - min)) * scale;
  const midY = HEIGHT / 2;
  const ticks = [];
  for (let v = Math.ceil(min); v <= Math.floor(max); v += 1) {
    ticks.push(v);
  }

  return (
    <svg viewBox={`0 0 ${size} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="number line diagram">
      <line x1={PAD} y1={midY} x2={size - PAD} y2={midY} stroke="currentColor" strokeWidth={2} className="text-slate-300" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={toX(v)} y1={midY - 5} x2={toX(v)} y2={midY + 5} stroke="currentColor" strokeWidth={1.5} className="text-slate-300" />
          {(v === min || v === max || v === 0) && (
            <text x={toX(v)} y={midY + 20} fontSize={10} textAnchor="middle" className="fill-slate-500">
              {v}
            </text>
          )}
        </g>
      ))}

      {mark.kind === "point" && (
        <circle cx={toX(mark.value)} cy={midY} r={7} className="fill-black stroke-white" strokeWidth={2} />
      )}

      {mark.kind === "ray" && (
        <>
          <line
            x1={toX(mark.boundary)}
            y1={midY}
            x2={mark.direction === "right" ? size - PAD : PAD}
            y2={midY}
            stroke="currentColor"
            strokeWidth={5}
            className="text-black"
            strokeLinecap="round"
          />
          <circle
            cx={toX(mark.boundary)}
            cy={midY}
            r={7}
            className={mark.inclusive ? "fill-black" : "fill-white stroke-black"}
            strokeWidth={2.5}
          />
        </>
      )}

      {mark.kind === "segment" && (
        <>
          <line
            x1={toX(mark.low)}
            y1={midY}
            x2={toX(mark.high)}
            y2={midY}
            stroke="currentColor"
            strokeWidth={5}
            className="text-black"
            strokeLinecap="round"
          />
          <circle
            cx={toX(mark.low)}
            cy={midY}
            r={7}
            className={mark.inclusiveLow ? "fill-black" : "fill-white stroke-black"}
            strokeWidth={2.5}
          />
          <circle
            cx={toX(mark.high)}
            cy={midY}
            r={7}
            className={mark.inclusiveHigh ? "fill-black" : "fill-white stroke-black"}
            strokeWidth={2.5}
          />
        </>
      )}
    </svg>
  );
}
