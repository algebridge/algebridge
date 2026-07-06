"use client";

import Link from "next/link";
import type { Unit } from "@/types";
import { getUnitCompletion } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { ProgressBar } from "./ProgressBar";

interface UnitCardProps {
  unit: Unit;
}

export function UnitCard({ unit }: UnitCardProps) {
  const { stats, mounted } = useProgress();
  const { completed, total } = mounted
    ? getUnitCompletion(unit.skills.map((s) => s.id))
    : { completed: 0, total: unit.skills.length };
  const isComplete = completed === total;

  return (
    <Link href={`/unit/${unit.id}`} className="card group block">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bridge-100 text-2xl group-hover:bg-bridge-200">
          {isComplete ? "✅" : unit.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-bridge-600">
            Unit {unit.number} of {stats.totalUnits}
          </p>
          <h3 className="mt-0.5 text-lg font-bold text-slate-900 group-hover:text-bridge-700">
            {unit.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{unit.description}</p>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar value={completed} max={total} showFraction={false} size="sm" />
        <p className="mt-1.5 text-xs text-slate-500">
          {isComplete
            ? "Unit complete!"
            : `${completed} of ${total} skills done · ${total - completed} left`}
        </p>
      </div>
    </Link>
  );
}
