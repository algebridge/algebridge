"use client";

import Link from "next/link";
import { useProgress } from "@/hooks/useProgress";
import { useAuth } from "@/lib/auth";

/**
 * Level / XP summary. The course header above already carries the headline
 * numbers and the unit cards carry per-unit progress, so this panel only shows
 * what neither of them does.
 */
export function ProgressOverview() {
  const { stats, mounted } = useProgress();
  const { user, configured } = useAuth();

  if (configured && !user) return null;
  if (!mounted) return null;

  const levelPercent =
    stats.xpForNextLevel > 0
      ? Math.min(100, Math.round((stats.xpIntoLevel / stats.xpForNextLevel) * 100))
      : 0;

  return (
    <section id="progress" className="panel">
      <div className="panel-head">
        <p className="panel-title">Your progress</p>
        <Link href="/achievements" className="text-xs font-medium text-bridge-700 hover:underline">
          All achievements →
        </Link>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Level {stats.level} · {stats.levelTitle}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {stats.xpForNextLevel > 0
                ? `${stats.xpIntoLevel} / ${stats.xpForNextLevel} XP to the next level`
                : `${stats.xp} XP earned`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.streak > 0 && (
              <span className="badge bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100">
                🔥 {stats.streak}-day streak
              </span>
            )}
            <span className="badge-neutral">
              {stats.badgeCount} badge{stats.badgeCount === 1 ? "" : "s"}
            </span>
            <span className="badge-neutral">
              {stats.unitsComplete}/{stats.totalUnits} units
            </span>
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-bridge-600 transition-all duration-500"
            style={{ width: `${levelPercent}%` }}
          />
        </div>

        {stats.inProgressSkills > 0 && (
          <p className="mt-3 text-sm text-amber-700">
            {stats.inProgressSkills} skill{stats.inProgressSkills !== 1 ? "s" : ""} started but not
            finished, a few more problems each and they&apos;re done.
          </p>
        )}
      </div>
    </section>
  );
}
