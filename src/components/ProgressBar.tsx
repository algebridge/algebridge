interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showFraction?: boolean;
  size?: "sm" | "md";
}

export function ProgressBar({
  value,
  max,
  label,
  showFraction = true,
  size = "md",
}: ProgressBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const height = size === "sm" ? "h-2" : "h-3";

  return (
    <div>
      {(label || showFraction) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          {label && <span className="font-medium text-slate-700">{label}</span>}
          {showFraction && (
            <span className="text-slate-500">
              {value} of {max} complete ({percent}%)
            </span>
          )}
        </div>
      )}
      <div className={`overflow-hidden rounded-full bg-slate-200 ${height}`}>
        <div
          className={`${height} rounded-full bg-gradient-to-r from-bridge-500 to-emerald-500 transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
