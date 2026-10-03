"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BADGES, getLevelInfo, getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { getEquippedTitleLabel } from "@/lib/bridgeys";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { ProgressBar } from "@/components/ProgressBar";
import { Icon } from "@/components/Icon";
import { BadgeMark, withoutEmoji } from "@/components/RewardMark";

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
      const title = getEquippedTitleLabel(progress);
      setEquippedTitle(title ? withoutEmoji(title) : null);
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
        <h1 className="page-title">Achievements</h1>
        <p className="page-subtitle">
          Earn XP for every problem you solve, level up, and unlock badges along the
          way. Steady practice counts for more than a perfect score.
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
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-bridge-50 text-bridge-600 ring-1 ring-inset ring-bridge-100" aria-hidden>
              <Icon name="star" size={26} />
            </span>
          </div>
          <div className="mt-4">
            <ProgressBar
              value={level.xpIntoLevel}
              max={level.xpForNextLevel}
              label="XP to next level"
              unit="XP"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{mounted ? xp : 0} total XP earned</p>
        </div>

        <div className="card flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100" aria-hidden>
            <Icon name="flame" size={26} />
          </span>
          <div>
            <p className="text-2xl font-bold text-orange-600">{mounted ? streak : 0}-day streak</p>
            <p className="mt-1 text-sm text-slate-600">
              Practice at least once a day to keep your streak alive.
            </p>
          </div>
        </div>

        <Link href="/house" className="card flex items-center gap-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-raised">
          <BridgeysLogo size={48} />
          <div>
            <p className="text-2xl font-bold text-amber-700">{mounted ? bridgeys.toLocaleString() : 0} Bridgeys</p>
            <p className="mt-1 text-sm text-slate-600">
              {equippedTitle ? (
                `Title: ${equippedTitle}`
              ) : (
                <>
                  Decorate your house and unlock titles
                  <Icon name="arrow-right" size={14} className="ml-1 inline-block align-[-2px]" />
                </>
              )}
            </p>
          </div>
        </Link>
      </section>

      <section>
        <h2 className="section-title">
          Badges {mounted && <span className="text-sm font-normal text-slate-500">({earnedBadges.length} of {BADGES.length} unlocked)</span>}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BADGES.map((badge) => {
            const earned = earnedBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`group flex items-center gap-3 rounded-2xl border p-4 transition duration-200 ease-out ${
                  earned
                    ? "border-bridge-200 bg-white shadow-panel hover:-translate-y-0.5 hover:shadow-raised"
                    : "border-dashed border-slate-300 bg-white/70"
                }`}
              >
                <BadgeMark id={badge.id} earned={earned} />
                <div className="min-w-0">
                  <p className={`font-semibold ${earned ? "text-slate-900" : "text-slate-600"}`}>{badge.title}</p>
                  <p className="text-xs text-slate-500">{badge.description}</p>
                </div>
                {earned ? (
                  <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" role="img" aria-label="Unlocked">
                    <Icon name="check" size={14} />
                  </span>
                ) : (
                  <span className="ml-auto shrink-0 text-slate-400" role="img" aria-label="Locked">
                    <Icon name="lock" size={15} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="text-center">
        <Link href="/" className="btn-primary inline-flex">
          Back to the course
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </div>
  );
}
