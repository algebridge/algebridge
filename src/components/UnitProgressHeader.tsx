"use client";

import type { Unit } from "@/types";
import { getUnitCompletion } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { useAuth } from "@/lib/auth";
import { hueVars, unitHue } from "@/lib/hues";
import { UnitMark } from "@/components/UnitMark";

interface UnitProgressHeaderProps {
  unit: Unit;
}

/** The unit's banner and page title: its color, its mark, and how far along it is. */
export function UnitProgressHeader({ unit }: UnitProgressHeaderProps) {
  const { user } = useAuth();
  const { stats, mounted } = useProgress();
  const { completed, total } = mounted
    ? getUnitCompletion(unit.skills.map((s) => s.id))
    : { completed: 0, total: unit.skills.length };
  const percent = total ? Math.round((completed / total) * 100) : 0;
  // Progress belongs to a signed-in student; a visitor sees the unit itself.
  const showProgress = mounted && user;

  return (
    <header style={hueVars(unitHue(unit.id))} className="hue-banner relative overflow-hidden rounded-2xl">
      {/* The unit's mark, large and faint, as the banner's texture. */}
      <UnitMark unitId={unit.id} size={220} className="pointer-events-none absolute -right-6 -top-12 opacity-[0.14]" />
      <div className="relative px-6 py-7 sm:px-8">
        <div className="flex items-start gap-4">
          <span className="hue-chip flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
            <UnitMark unitId={unit.id} size={28} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-80">
              Unit {unit.number} of {stats.totalUnits} · {unit.skills.length} skills
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{unit.title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed opacity-90">{unit.description}</p>
          </div>
        </div>
        {showProgress && (
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/15">
              <div
                className="h-full rounded-full bg-white/90 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="shrink-0 text-sm font-semibold">
              {completed} of {total} done
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
