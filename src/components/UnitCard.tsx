"use client";

import Link from "next/link";
import type { Unit } from "@/types";
import { getUnitCompletion } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { hueVars, unitHue } from "@/lib/hues";
import { Icon } from "@/components/Icon";
import { UnitMark } from "@/components/UnitMark";

interface UnitCardProps {
  unit: Unit;
}

/**
 * A unit on the course outline. Each unit has its own color, carried from
 * here to its page and its lessons, so the outline reads as a map of places
 * rather than a list of the same card thirteen times.
 */
export function UnitCard({ unit }: UnitCardProps) {
  const { mounted } = useProgress();
  const { completed, total } = mounted
    ? getUnitCompletion(unit.skills.map((s) => s.id))
    : { completed: 0, total: unit.skills.length };
  const isComplete = completed === total;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const access = useCourseAccess();
  // A unit with no skill open yet: it waits for the one before it.
  const locked = access.ready && !access.unit(unit.id);
  const hue = unitHue(unit.id);

  return (
    <Link
      href={`/unit/${unit.id}`}
      style={hueVars(hue)}
      className={`card-link group relative block overflow-hidden ${locked ? "opacity-80 saturate-50 hover:opacity-100 hover:saturate-100" : ""}`}
    >
      {/* The unit's color, as a band down the side; a locked unit keeps it, muted. */}
      <span aria-hidden className="hue-bar absolute inset-y-0 left-0 w-1.5" />
      <div className="flex items-start gap-4 pl-2">
        <span
          className={`hue-wash flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ease-out group-hover:scale-110 ${
            locked ? "text-slate-400" : ""
          }`}
        >
          {locked ? <Icon name="lock" size={18} /> : <UnitMark unitId={unit.id} size={24} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="hue-ink text-[11px] font-semibold uppercase tracking-[0.08em]">Unit {unit.number}</p>
              <h3 className={`mt-0.5 text-base font-semibold group-hover:text-slate-950 ${locked ? "text-slate-600" : "text-slate-900"}`}>
                {unit.title}
              </h3>
            </div>
            {isComplete && <span className="badge-success shrink-0">Complete</span>}
            {locked && <span className="badge-neutral shrink-0">Locked</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{unit.description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3 pl-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "hue-bar"}`}
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
