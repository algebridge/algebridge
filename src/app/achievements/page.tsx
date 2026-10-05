"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BADGES, getLevelInfo, getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { ProgressBar } from "@/components/ProgressBar";
import { Icon } from "@/components/Icon";
import { BadgeMark } from "@/components/RewardMark";
import { StoredTitlePlate } from "@/components/TitlePlate";
import { UnitMark } from "@/components/UnitMark";
import { certificateDateText, certificateList, type CertificateEntry } from "@/lib/certificates";
import { unitHue } from "@/lib/hues";

export default function AchievementsPage() {
  const [mounted, setMounted] = useState(false);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bridgeys, setBridgeys] = useState(0);
  const [equippedTitle, setEquippedTitle] = useState<string | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [certificates, setCertificates] = useState<CertificateEntry[]>([]);

  useEffect(() => {
    function refresh() {
      const progress = getProgress();
      setXp(progress.xp);
      setStreak(progress.streak);
      setBridgeys(progress.bridgeys ?? 0);
      setEquippedTitle(progress.equippedTitleId ?? null);
      setEarnedBadges(progress.badges);
      setCertificates(certificateList(progress));
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

      {/* Three stats, one shape: an icon tile, a label, the number in the
          display face, and a line under it. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card flex flex-col gap-3">
          <StatTile tone="bg-bridge-50 text-bridge-600 ring-bridge-100">
            <Icon name="star" size={20} />
          </StatTile>
          <div>
            <p className="eyebrow">Level</p>
            <p className="mt-1.5 font-display text-4xl leading-none text-slate-900 tabular-nums">{mounted ? level.level : 1}</p>
            <p className="mt-1.5 text-sm text-slate-600">{level.title}</p>
          </div>
          <div className="mt-auto">
            <ProgressBar
              value={level.xpIntoLevel}
              max={level.xpForNextLevel}
              label="XP to next level"
              unit="XP"
            />
            <p className="mt-2 text-xs text-slate-500">{mounted ? xp : 0} total XP earned</p>
          </div>
        </div>

        <div className="card flex flex-col gap-3">
          <StatTile tone="bg-orange-50 text-orange-600 ring-orange-100">
            <Icon name="flame" size={20} />
          </StatTile>
          <div>
            <p className="eyebrow">Streak</p>
            <p className="mt-1.5 font-display text-4xl leading-none text-slate-900 tabular-nums">
              {mounted ? streak : 0} {(mounted ? streak : 0) === 1 ? "day" : "days"}
            </p>
            <p className="mt-1.5 text-sm text-slate-600">
              {mounted && streak > 0
                ? "Practice at least once a day to keep your streak alive."
                : "Practice today to start a streak."}
            </p>
          </div>
        </div>

        <Link href="/house" className="card flex flex-col gap-3 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-raised">
          <StatTile tone="bg-amber-50 ring-amber-100">
            <BridgeysLogo size={24} />
          </StatTile>
          <div>
            <p className="eyebrow">Bridgeys</p>
            <p className="mt-1.5 font-display text-4xl leading-none text-slate-900 tabular-nums">
              {mounted ? bridgeys.toLocaleString() : 0}
            </p>
            <p className="mt-1.5 text-sm text-slate-600">
              {equippedTitle ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  Wearing <StoredTitlePlate stored={equippedTitle} size="sm" />
                </span>
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
        {/* Two columns: ten badges make five even rows, and each description fits on a line or two. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

      <section id="certificates" className="scroll-mt-24">
        <h2 className="section-title">
          Certificates{" "}
          {mounted && (
            <span className="text-sm font-normal text-slate-500">
              ({certificates.filter((c) => c.earnedAt).length} of {certificates.length} earned)
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-slate-600">One for each unit you finish, and one for the whole course. Print them or save them as pictures.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((c) => {
            const hue = c.unit ? unitHue(c.unit.id) : null;
            const label = c.unit ? `Unit ${c.unit.number}: ${c.unit.title}` : "Algebra 1, the whole course";
            const seal = (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={c.earnedAt ? { background: hue?.solid ?? "#b7862c", color: hue?.onSolid ?? "#ffffff" } : undefined}
              >
                {c.unit ? <UnitMark unitId={c.unit.id} size={20} /> : <Icon name="trophy" size={19} />}
              </span>
            );
            return c.earnedAt ? (
              <Link
                key={c.id}
                href={`/certificate/${c.id}`}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-panel transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-raised ${c.unit ? "border-slate-200" : "border-amber-300 sm:col-span-2 lg:col-span-3"}`}
              >
                {seal}
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">Earned {certificateDateText(c.earnedAt)}</span>
                </span>
                <Icon name="arrow-right" size={16} className="ml-auto shrink-0 text-slate-400" />
              </Link>
            ) : (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-slate-400 ${c.unit ? "" : "sm:col-span-2 lg:col-span-3"}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                  {c.unit ? <UnitMark unitId={c.unit.id} size={20} /> : <Icon name="trophy" size={19} />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-600">{label}</span>
                  <span className="block text-xs text-slate-500">
                    {c.unit ? `Finish all ${c.unit.skills.length} skills to earn it` : "Finish every unit to earn it"}
                  </span>
                </span>
                <Icon name="lock" size={15} className="ml-auto shrink-0" />
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

/** The 40px icon tile at the top of each stat card. */
function StatTile({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${tone}`} aria-hidden>
      {children}
    </span>
  );
}
