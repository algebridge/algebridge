"use client";

import Link from "next/link";
import type { Unit } from "@/types";
import { getUnitCompletion } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";

interface UnitCardProps {
  unit: Unit;
}

export function UnitCard({ unit }: UnitCardProps) {
  const { mounted } = useProgress();
  const { completed, total } = mounted
    ? getUnitCompletion(unit.skills.map((s) => s.id))
    : { completed: 0, total: unit.skills.length };
  const isComplete = completed === total;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Link href={`/unit/${unit.id}`} className="card-link group block">
      <div className="flex items-start gap-3.5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
            isComplete
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100"
              : "bg-slate-100 text-slate-600 group-hover:bg-bridge-50 group-hover:text-bridge-700"
          }`}
        >
          {unit.number}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-bridge-700">
              {unit.title}
            </h3>
            {isComplete && <span className="badge-success shrink-0">Complete</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {unit.description}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              isComplete ? "bg-emerald-500" : "bg-bridge-600"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="shrink-0 text-xs font-medium text-slate-500">
          {completed}/{total} skills
        </p>
      </div>
    </Link>
  );
}
