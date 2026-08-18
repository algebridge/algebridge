"use client";

import Link from "next/link";
import { useProgress } from "@/hooks/useProgress";
import { useAuth } from "@/lib/auth";

export function ContinueCard() {
  const { stats, continueTarget, mounted } = useProgress();
  const { user, configured } = useAuth();

  if (!mounted) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-6 w-64 rounded bg-slate-200" />
      </div>
    );
  }

  // Signed-out visitors have no progress to continue — nudge them once here
  // rather than showing an empty "pick up where you left off".
  if (configured && !user) return null;

  if (!continueTarget) {
    return (
      <div className="panel border-emerald-200">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              You finished all {stats.totalSkills} skills.
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              Use Review to keep the early units sharp.
            </p>
          </div>
          <Link href="/review" className="btn-primary shrink-0">
            Go to Review
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">Pick up where you left off</p>
          <h2 className="mt-1 truncate text-base font-semibold text-slate-900">
            {continueTarget.skillTitle}
          </h2>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            Unit {continueTarget.unitNumber}: {continueTarget.unitTitle}
          </p>
        </div>
        <Link
          href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
          className="btn-primary shrink-0"
        >
          Continue
        </Link>
      </div>
    </div>
  );
}
