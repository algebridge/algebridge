"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { units } from "@/data/curriculum";

const TOTAL_UNITS = units.length;
const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);

/**
 * Top of the course page. Signed-out visitors get the pitch; signed-in
 * students get their own numbers, because by then the product has to look
 * like a place they're working, not a landing page.
 */
export function CourseHeader() {
  const { user } = useAuth();
  const { stats, continueTarget, mounted } = useProgress();

  // Nobody is authenticated on the first paint, so the prerendered HTML — what
  // a visitor and a search engine see — is the course pitch, not an empty
  // dashboard. Signed-in students swap to their own numbers once auth resolves.
  if (!user) {
    return (
      <section className="overflow-hidden rounded-2xl border border-bridge-900 bg-bridge-900 text-white">
        <div className="px-6 py-9 sm:px-10 sm:py-11">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-bridge-300">
            Algebra 1 · Grades 7–10
          </p>
          <h1 className="mt-2.5 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            The full Algebra 1 course, one skill at a time.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-bridge-100">
            Watch a short lesson, see the idea drawn out, then practice until it
            sticks. Teachers run their classes here; students get a real tutor when
            they&apos;re stuck. Free, with no ads.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-bridge-900 transition hover:bg-bridge-50"
            >
              Create free account
            </Link>
            <a
              href="#units"
              className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Browse the course
            </a>
          </div>
          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-6 border-t border-white/15 pt-5">
            <Stat label="Units" value={String(TOTAL_UNITS)} />
            <Stat label="Skills" value={String(TOTAL_SKILLS)} />
            <Stat label="Cost" value="Free" />
          </dl>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div>
          <p className="eyebrow">Algebra 1 · Grades 7–10</p>
          <h1 className="page-title mt-1">Your course</h1>
          <p className="page-subtitle">
            {mounted && stats.completedSkills > 0
              ? `You've completed ${stats.completedSkills} of ${stats.totalSkills} skills. Keep going.`
              : "Start with Unit 1, or jump to whatever your class is working on."}
          </p>
        </div>
        {continueTarget && (
          <Link
            href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
            className="btn-primary shrink-0"
          >
            Continue learning
          </Link>
        )}
      </div>

      {mounted && (
        <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Course progress</span>
            <span className="font-semibold text-slate-900">{stats.percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-bridge-600 transition-all duration-500"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MiniStat label="Skills complete" value={`${stats.completedSkills}/${stats.totalSkills}`} />
            <MiniStat label="Problems solved" value={stats.problemsSolved.toLocaleString()} />
            <MiniStat label="Day streak" value={String(stats.streak)} />
            <MiniStat label="Level" value={`${stats.level} · ${stats.levelTitle}`} />
          </dl>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-bridge-300">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold">{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
