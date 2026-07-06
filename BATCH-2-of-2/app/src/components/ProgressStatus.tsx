import type { MasteryLevel } from "@/types";
import {
  getSimpleStatus,
  SIMPLE_STATUS_COLORS,
  SIMPLE_STATUS_LABELS,
} from "@/lib/progress";

interface ProgressStatusProps {
  level: MasteryLevel;
  size?: "sm" | "md";
}

export function ProgressStatus({ level, size = "sm" }: ProgressStatusProps) {
  const status = getSimpleStatus(level);
  const sizeClass = size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${SIMPLE_STATUS_COLORS[status]} ${sizeClass}`}
    >
      {status === "complete" && "✓"}
      {status === "in-progress" && "◐"}
      {status === "not-started" && "○"}
      {SIMPLE_STATUS_LABELS[status]}
    </span>
  );
}
