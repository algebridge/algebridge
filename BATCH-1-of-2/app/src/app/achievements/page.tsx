"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BADGES, getLevelInfo, getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { getEquippedTitleLabel } from "@/lib/bridgeys";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { ProgressBar } from "@/components/ProgressBar";

export default function AchievementsPage() {
  const [mounted, setMounted] = useState(false);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bridgeys, setBridgeys] = useState(0);
  const [equippedTitle, setEquippedTitle] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  useEffect(() => {
    function refresh() {
      const progress = getProgress();
      setXp(progress.xp);
      setStreak(progress.streak);
      setBridgeys(progress.bridgeys ?? 0);
      setEquippedTitle(getEquippedTitleLabel(progress));
      setEarnedBadges(progress.badges);
      setMounted(true);
    }
    refresh();
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  const level = getLevelInfo(xp);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-wide text-slate-900">🏆 Achievements</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Earn XP for every problem you solve, level up, and unlock badges along the
          way. Progress and consistency matter more than getting everything perfect!
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-bridge-600">
                Level {mounted ? level.level : 1}
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{level.title}</h2>
            </div>
            <span className="text-4xl">⭐</span>
          </div>
          <div className="mt-4">
            <ProgressBar
              value={level.xpIntoLevel}
              max={level.xpForNextLevel}
              label="XP to next level"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{mounted ? xp : 0} total XP earned</p>
        </div>

        <div className="card flex items-center gap-4">
          <span className="text-4xl">🔥</span>
          <div>
            <p className="text-2xl font-bold text-orange-600">{mounted ? streak : 0}-day streak</p>
            <p className="mt-1 text-sm text-slate-600">
              Practice at least once a day to keep your streak alive.
            </p>
          </div>
        </div>

        <Link href="/house" className="card flex items-center gap-4 transition hover:border-amber-300 hover:shadow-md">
          <BridgeysLogo size={48} />
          <div>
            <p className="text-2xl font-bold text-amber-700">{mounted ? bridgeys.toLocaleString() : 0} Bridgeys</p>
            <p className="mt-1 text-sm text-slate-600">
              {equippedTitle ? `Title: ${equippedTitle}` : "Customize your house & unlock titles →"}
            </p>
          </div>
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-900">
          Badges {mounted && <span className="text-sm font-normal text-slate-500">({earnedBadges.length}/{BADGES.length} unlocked)</span>}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => {
            const earned = earnedBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`flex items-center gap-3 rounded-2xl border p-4 transition ${
                  earned
                    ? "border-bridge-200 bg-white shadow-sm"
                    : "border-dashed border-slate-200 bg-slate-50 opacity-60"
                }`}
              >
                <span className={`text-3xl ${earned ? "" : "grayscale"}`}>{badge.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{badge.title}</p>
                  <p className="text-xs text-slate-500">{badge.description}</p>
                </div>
                {earned && <span className="ml-auto shrink-0 text-emerald-500">✓</span>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="text-center">
        <Link href="/" className="btn-primary inline-flex">
          Back to Course →
        </Link>
      </div>
    </div>
  );
}
