"use client";

import Link from "next/link";
import { useProgress } from "@/hooks/useProgress";
import { units } from "@/data/curriculum";
import { getUnitCompletion } from "@/lib/progress";
import { ProgressBar } from "./ProgressBar";

export function ProgressOverview() {
  const { stats, mounted } = useProgress();

  return (
    <section id="progress" className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your Progress</h2>
        <p className="mt-1 text-slate-600">
          Complete each skill by watching the video and answering at least 3
          practice problems with 80%+ correct on your recent tries.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card text-center">
          <p className="text-3xl font-bold text-bridge-700">
            {stats.completedSkills}/{stats.totalSkills}
          </p>
          <p className="mt-1 text-sm text-slate-600">Skills complete</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-bridge-700">
            {stats.unitsComplete}/{stats.totalUnits}
          </p>
          <p className="mt-1 text-sm text-slate-600">Units complete</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-bridge-700">{stats.problemsSolved}</p>
          <p className="mt-1 text-sm text-slate-600">Problems solved</p>
        </div>
      </div>

      <Link
        href="/achievements"
        className="card flex items-center gap-4 hover:border-bridge-300"
      >
        <span className="text-3xl">⭐</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900">
            Level {stats.level}: {stats.levelTitle}
          </p>
          <div className="mt-1.5">
            <ProgressBar
              value={stats.xpIntoLevel}
              max={stats.xpForNextLevel}
              showFraction={false}
              size="sm"
            />
          </div>
        </div>
        {stats.streak > 0 && (
          <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">
            🔥 {stats.streak}
          </span>
        )}
        <span className="shrink-0 rounded-full bg-bridge-50 px-3 py-1 text-sm font-bold text-bridge-700">
          🏆 {stats.badgeCount}
        </span>
      </Link>

      <div className="card">
        <ProgressBar
          value={stats.completedSkills}
          max={stats.totalSkills}
          label="Course completion"
        />
        {stats.inProgressSkills > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            ◐ {stats.inProgressSkills} skill{stats.inProgressSkills !== 1 ? "s" : ""} in
            progress — finish them to move forward!
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Unit breakdown</h3>
        {units.map((unit) => {
          const { completed, total } = mounted
            ? getUnitCompletion(unit.skills.map((s) => s.id))
            : { completed: 0, total: unit.skills.length };
          return (
            <Link
              key={unit.id}
              href={`/unit/${unit.id}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-bridge-300 hover:shadow-sm"
            >
              <span className="text-xl">{unit.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  Unit {unit.number}: {unit.title}
                </p>
                <div className="mt-1.5">
                  <ProgressBar
                    value={completed}
                    max={total}
                    showFraction={false}
                    size="sm"
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {completed}/{total}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
