import type { MasteryLevel } from "@/types";
import { Icon } from "@/components/Icon";
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
      {status === "complete" && <Icon name="check" size={12} />}
      {status === "in-progress" && <span aria-hidden className="h-2 w-2 rounded-full bg-current opacity-80" />}
      {status === "not-started" && <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-inset ring-current" />}
      {SIMPLE_STATUS_LABELS[status]}
    </span>
  );
}
