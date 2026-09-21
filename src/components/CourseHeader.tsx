"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { units } from "@/data/curriculum";
import { DotPattern } from "@/components/ui/dot-pattern";
import { UnitMark } from "@/components/UnitMark";
import { UnitTiles } from "@/components/UnitTiles";
import { hueVars, unitHue } from "@/lib/hues";

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

  // Nobody is authenticated on the first paint, so the prerendered HTML, what
  // a visitor and a search engine see, is the course pitch, not an empty
  // dashboard. Signed-in students swap to their own numbers once auth resolves.
  if (!user) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bridge-800 via-bridge-900 to-violet-950 text-white">
        <DotPattern
          width={20}
          height={20}
          cr={1}
          className="fill-white/15 [mask-image:radial-gradient(420px_circle_at_15%_20%,white,transparent)]"
        />
        {/* The course's thirteen units as tiles, beside the text on wide
            screens and as a strip under it on phones. */}
        <div className="pointer-events-none absolute inset-y-0 right-8 hidden items-center md:flex lg:right-12">
          <UnitTiles variant="mosaic" />
        </div>
        <div className="relative z-10 px-6 py-9 sm:px-10 sm:py-11 md:pr-64 lg:pr-72">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-bridge-300">
            Algebra 1 · Grades 7-10
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
            <Link
              href="/login?mode=signin"
              className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
          <div className="mt-7 md:hidden">
            <UnitTiles variant="row" />
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

  // The header takes the color of the unit the student is in, so coming
  // back to the course looks like coming back to a place.
  const hue = unitHue(continueTarget?.unitId ?? units[0].id);
  return (
    <section style={hueVars(hue)} className="hue-banner relative overflow-hidden rounded-2xl">
      {continueTarget && (
        <UnitMark unitId={continueTarget.unitId} size={220} className="pointer-events-none absolute -right-6 -top-12 opacity-[0.14]" />
      )}
      <div className="relative flex flex-wrap items-start justify-between gap-4 px-6 py-6 sm:px-8">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] opacity-80">Algebra 1 · Grades 7-10</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">
            {mounted && continueTarget ? `Unit ${continueTarget.unitNumber}: ${continueTarget.unitTitle}` : "Your course"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed opacity-90">
            {mounted && continueTarget
              ? `Up next: ${continueTarget.skillTitle}.`
              : mounted
                ? "Every skill is done. Review keeps them sharp."
                : "Start with Unit 1, or jump to whatever your class is working on."}
          </p>
        </div>
        {continueTarget && (
          <Link
            href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
            className="shrink-0 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:scale-[1.03] hover:bg-slate-50"
          >
            Continue learning
          </Link>
        )}
      </div>

      {mounted && (
        <div className="relative border-t border-white/15 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/15">
              <div
                className="h-full rounded-full bg-white/90 transition-all duration-500"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            <span className="text-sm font-semibold">{stats.percent}%</span>
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
      <dt className="text-xs opacity-80">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
