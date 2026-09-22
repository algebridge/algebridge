"use client";

import type { Unit } from "@/types";
import { getUnitCompletion } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { useAuth } from "@/lib/auth";
import { hueVars, unitHue } from "@/lib/hues";
import { UnitMark } from "@/components/UnitMark";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { getUnitPrize } from "@/data/house-catalog";
import { getProgress } from "@/lib/progress";
import { BRIDGEY_REWARDS, bridgeysForSkill } from "@/lib/gamification";

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
  const prize = getUnitPrize(unit.id);
  const prizeEarned = mounted && !!prize && (getProgress().ownedFurniture ?? []).includes(prize.id);
  const unitPay = unit.skills.reduce((n, s) => n + bridgeysForSkill(s.id), 0) + BRIDGEY_REWARDS.unitComplete;

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

        {/* The prize. What the unit pays is on the table before the work starts. */}
        {prize && (
          <div className="hue-chip mt-5 flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/90">
              <CartoonFurnitureArt itemId={prize.id} size={40} variant="room" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {prizeEarned ? "Earned" : "Unit prize"}
              </p>
              <p className="truncate text-sm font-semibold">
                {prize.name}
                <span className="font-normal opacity-90"> · {prizeEarned ? "in your house" : `finish all ${total} skills`}</span>
              </p>
            </div>
            <p className="shrink-0 text-right text-xs leading-tight opacity-90">
              <span className="block text-sm font-semibold">{unitPay} Bridgeys</span>
              across the unit
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
