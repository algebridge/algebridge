import type { NumberLineSpec } from "@/types";

interface NumberLineDiagramProps {
  spec: NumberLineSpec;
  size?: number;
  /** Label every integer tick (used in the big Explore view). */
  showAllNumbers?: boolean;
}

const WIDTH = 240;
const HEIGHT = 74;
const PAD = 20;
const MARK_COLOR = "#2563eb";

export function NumberLineDiagram({ spec, size = WIDTH, showAllNumbers = false }: NumberLineDiagramProps) {
  const { min, max, mark } = spec;
  const scale = size - PAD * 2;
  const toX = (value: number) => PAD + ((value - min) / (max - min)) * scale;
  const midY = HEIGHT / 2;

  const ticks: number[] = [];
  for (let v = Math.ceil(min); v <= Math.floor(max); v += 1) ticks.push(v);
  const span = max - min;
  const labelStep = showAllNumbers ? (span <= 16 ? 1 : 2) : Math.max(1, Math.round(span / 8));

  return (
    <svg viewBox={`0 0 ${size} ${HEIGHT}`} className="h-full w-full" role="img" aria-label="number line diagram">
      {/* main line with arrowheads on both ends */}
      <line x1={PAD - 6} y1={midY} x2={size - PAD + 6} y2={midY} stroke="#475569" strokeWidth={2} />
      <polygon points={`${size - PAD + 8},${midY} ${size - PAD},${midY - 4} ${size - PAD},${midY + 4}`} fill="#475569" />
      <polygon points={`${PAD - 8},${midY} ${PAD},${midY - 4} ${PAD},${midY + 4}`} fill="#475569" />

      {ticks.map((v) => {
        const showLabel = v === min || v === max || v === 0 || v % labelStep === 0;
        return (
          <g key={v}>
            <line x1={toX(v)} y1={midY - 5} x2={toX(v)} y2={midY + 5} stroke="#94a3b8" strokeWidth={1.3} />
            {showLabel && (
              <text x={toX(v)} y={midY + 19} fontSize={9} textAnchor="middle" fill="#64748b">
                {v}
              </text>
            )}
          </g>
        );
      })}

      {mark.kind === "point" && (
        <g>
          <line x1={toX(mark.value)} y1={midY - 11} x2={toX(mark.value)} y2={midY + 11} stroke={MARK_COLOR} strokeWidth={1} opacity={0.4} />
          <circle cx={toX(mark.value)} cy={midY} r={7} fill={MARK_COLOR} stroke="white" strokeWidth={2} />
        </g>
      )}

      {mark.kind === "ray" && (
        <>
          <line
            x1={toX(mark.boundary)}
            y1={midY}
            x2={mark.direction === "right" ? size - PAD : PAD}
            y2={midY}
            stroke={MARK_COLOR}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <circle
            cx={toX(mark.boundary)}
            cy={midY}
            r={7}
            fill={mark.inclusive ? MARK_COLOR : "white"}
            stroke={MARK_COLOR}
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
            stroke={MARK_COLOR}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <circle
            cx={toX(mark.low)}
            cy={midY}
            r={7}
            fill={mark.inclusiveLow ? MARK_COLOR : "white"}
            stroke={MARK_COLOR}
            strokeWidth={2.5}
          />
          <circle
            cx={toX(mark.high)}
            cy={midY}
            r={7}
            fill={mark.inclusiveHigh ? MARK_COLOR : "white"}
            stroke={MARK_COLOR}
            strokeWidth={2.5}
          />
        </>
      )}
    </svg>
  );
}
