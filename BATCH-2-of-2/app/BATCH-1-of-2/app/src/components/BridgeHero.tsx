"use client";

import Link from "next/link";
import { useProgress } from "@/hooks/useProgress";
import { ProgressBar } from "./ProgressBar";

export function BridgeHero() {
  const { stats, mounted } = useProgress();

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bridge-700 via-bridge-800 to-bridge-950 px-6 py-10 text-white sm:px-10 sm:py-12">
      <div className="relative z-10">
        <p className="text-sm font-medium text-bridge-200">Algebra 1 · Grades 7–10</p>
        <h1 className="mt-2 font-display text-4xl tracking-wide sm:text-5xl">
          Learn algebra, one skill at a time
        </h1>
        <p className="mt-3 max-w-xl text-bridge-100">
          Watch a short video, practice a few problems, and mark the skill complete.
          Your progress saves automatically.
        </p>
        <div className="mt-6 max-w-md">
          {mounted ? (
            <ProgressBar
              value={stats.completedSkills}
              max={stats.totalSkills}
              label="Your progress"
            />
          ) : (
            <div className="h-2 w-full animate-pulse rounded-full bg-white/20" />
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#continue" className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg hover:bg-slate-200">
            Continue Learning
          </a>
          <a href="#progress" className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
            See All Progress
          </a>
        </div>
      </div>
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
    </section>
  );
}
