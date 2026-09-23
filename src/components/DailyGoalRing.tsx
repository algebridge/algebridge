/**
 * Today's goal, drawn as a ring that fills with each right answer and turns
 * green with a check when it is met. The number sits beside it rather than
 * inside, so the ring can stay small wherever it goes.
 */
export function DailyGoalRing({
  right,
  goal,
  size = 28,
  stroke = 4,
  className = "",
  tone = "light",
}: {
  right: number;
  goal: number;
  size?: number;
  stroke?: number;
  className?: string;
  /** "light" on a white or tinted surface; "onColor" on a colored banner. */
  tone?: "light" | "onColor";
}) {
  const met = right >= goal;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, goal > 0 ? right / goal : 0);
  const track = tone === "onColor" ? "rgba(255,255,255,0.28)" : "#e2e8f0";
  const fill = met ? "#10b981" : tone === "onColor" ? "#ffffff" : "#f59e0b";
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={met ? `Daily goal met: ${right} right today` : `${right} of ${goal} right today`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={fill}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * filled} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 500ms cubic-bezier(0.22, 0.9, 0.28, 1)" }}
      />
      {met && (
        <path
          d={`M${size * 0.32} ${size * 0.52} L${size * 0.45} ${size * 0.64} L${size * 0.69} ${size * 0.38}`}
          fill="none"
          stroke={fill}
          strokeWidth={Math.max(2, stroke * 0.7)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
