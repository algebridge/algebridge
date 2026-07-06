"use client";

import Link from "next/link";
import { useProgress } from "@/hooks/useProgress";
import { ProgressBar } from "./ProgressBar";

export function ContinueCard() {
  const { stats, continueTarget, mounted } = useProgress();

  if (!mounted) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
        <div className="h-6 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-8 w-64 rounded bg-slate-200" />
        <div className="mt-5 h-2 w-full rounded bg-slate-200" />
      </div>
    );
  }

  if (!continueTarget) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <span className="text-4xl">🎉</span>
        <h2 className="mt-3 text-xl font-bold text-emerald-900">
          You finished the whole course!
        </h2>
        <p className="mt-2 text-emerald-700">
          All {stats.totalSkills} skills complete. Use Bridge Review to stay sharp.
        </p>
        <Link href="/review" className="btn-primary mt-4 inline-flex">
          Bridge Review →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-bridge-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-bridge-600">
            Pick up where you left off
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            {continueTarget.skillTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Unit {continueTarget.unitNumber}: {continueTarget.unitTitle}
          </p>
        </div>
        <Link
          href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
          className="btn-primary shrink-0 text-center"
        >
          Continue →
        </Link>
      </div>
      <div className="mt-5">
        <ProgressBar
          value={stats.completedSkills}
          max={stats.totalSkills}
          label="Overall progress"
        />
      </div>
    </div>
  );
}
