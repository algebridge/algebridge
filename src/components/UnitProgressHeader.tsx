"use client";

import type { Unit } from "@/types";
import { getUnitCompletion } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { ProgressBar } from "./ProgressBar";

interface UnitProgressHeaderProps {
  unit: Unit;
}

export function UnitProgressHeader({ unit }: UnitProgressHeaderProps) {
  const { stats, mounted } = useProgress();
  const { completed, total } = mounted
    ? getUnitCompletion(unit.skills.map((s) => s.id))
    : { completed: 0, total: unit.skills.length };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-600">
          Unit {unit.number} of {stats.totalUnits}
        </span>
        <span className="font-medium text-slate-800">
          {completed} of {total} skills done in this unit
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={completed} max={total} showFraction={false} size="sm" />
      </div>
    </div>
  );
}
