import type { MasteryLevel } from "@/types";
import { ProgressStatus } from "./ProgressStatus";

interface MasteryBadgeProps {
  level: MasteryLevel;
  size?: "sm" | "md";
}

/** @deprecated Use ProgressStatus — kept for compatibility */
export function MasteryBadge({ level, size }: MasteryBadgeProps) {
  return <ProgressStatus level={level} size={size} />;
}
