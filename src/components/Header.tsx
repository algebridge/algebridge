"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { getProgress } from "@/lib/progress";
import { getReviewQueueCount } from "@/lib/spaced-repetition";
import { units } from "@/data/curriculum";
import { useEffect, useState } from "react";
import { useSound } from "@/hooks/useSound";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { getUnreadCount, subscribeToIncomingMessages } from "@/lib/social";

export function Header() {
  const { stats, continueTarget, mounted } = useProgress();
  const [reviewCount, setReviewCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const { user, profile } = useAuth();
  const { enabled: soundEnabled, toggle: toggleSound, mounted: soundMounted } = useSound();
  const {
    enabled: musicEnabled,
    toggle: toggleMusic,
    mounted: musicMounted,
    nowPlaying,
    skipTrack,
  } = useBackgroundMusic();

  useEffect(() => {
    const skillMeta = units.flatMap((u) =>
      u.skills.map((s) => ({
        id: s.id,
        title: s.title,
        unitId: u.id,
        unitTitle: u.title,
      }))
    );
    setReviewCount(getReviewQueueCount(getProgress().skills, skillMeta));
  }, [stats.completedSkills]);

  // Unread message badge — load on sign-in and bump on new incoming messages.
  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    const load = () => getUnreadCount().then((n) => active && setUnread(n));
    load();
    const unsub = subscribeToIncomingMessages(user.id, load);
    return () => {
      active = false;
      unsub();
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/brand/logo-icon.png" alt="AlgeBridge" width={32} height={32} />
          <span className="hidden font-display text-lg tracking-wide text-black sm:inline">
            AlgeBridge
          </span>
        </Link>

        {mounted && (
          <Link
            href="/achievements"
            title={`Level ${stats.level}: ${stats.levelTitle}`}
            className="hidden shrink-0 items-center gap-2 rounded-full border border-bridge-200 bg-bridge-50 px-3 py-1.5 hover:bg-bridge-100 sm:flex"
          >
            <span className="text-sm">⭐</span>
            <span className="text-xs font-bold text-bridge-800">Lvl {stats.level}</span>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-bridge-500"
                style={{
                  width: `${stats.xpForNextLevel > 0 ? Math.min(100, (stats.xpIntoLevel / stats.xpForNextLevel) * 100) : 0}%`,
                }}
              />
            </div>
          </Link>
        )}

        {mounted && stats.streak > 0 && (
          <span
            title={`${stats.streak}-day practice streak`}
            className="hidden shrink-0 items-center gap-1 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 sm:flex"
          >
            🔥 {stats.streak}
          </span>
        )}

        {mounted && (
          <Link
            href="/house"
            title="Bridgeys — spend in your house shop"
            className="hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 sm:flex"
          >
            <BridgeysLogo size={20} />
            {stats.bridgeys.toLocaleString()}
          </Link>
        )}

        <div className="hidden min-w-0 flex-1 px-2 lg:block">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {stats.completedSkills}/{stats.totalSkills} skills
            </span>
            <span>{stats.percent}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-bridge-500 transition-all"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>

        <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
          {continueTarget && (
            <Link
              href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
              className="inline-block shrink-0 rounded-lg bg-bridge-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-bridge-700 sm:px-3"
            >
              Continue
            </Link>
          )}
          <Link
            href="/achievements"
            className="text-sm text-slate-600 hover:text-bridge-600 sm:hidden"
            title="Achievements"
          >
            🏆
          </Link>
          <Link href="/achievements" className="hidden text-sm text-slate-600 hover:text-bridge-600 sm:inline">
            Achievements
          </Link>
          <Link href="/house" className="text-sm text-slate-600 hover:text-bridge-600">
            🏠 House
          </Link>
          <Link href="/leaderboard" className="hidden text-sm text-slate-600 hover:text-bridge-600 sm:inline">
            Leaderboard
          </Link>
          <Link href="/review" className="relative text-sm text-slate-600 hover:text-bridge-600">
            Review
            {reviewCount > 0 && (
              <span className="absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-span-500 text-[10px] font-bold text-white">
                {reviewCount}
              </span>
            )}
          </Link>
          <Link
            href={profile?.role === "tutor" ? "/tutor-hub" : "/tutors"}
            className="hidden text-sm text-slate-600 hover:text-bridge-600 sm:inline"
          >
            {profile?.role === "tutor" ? "👩‍🏫 Students" : "🔎 Tutors"}
          </Link>
          {user && (
            <Link
              href="/messages"
              title="Messages"
              className="relative text-sm text-slate-600 hover:text-bridge-600"
            >
              💬
              {unread > 0 && (
                <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-bridge-600 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
          )}
          {user && (
            <Link href="/groups" title="Group chats" className="text-sm text-slate-600 hover:text-bridge-600">
              👥
            </Link>
          )}
          {profile?.isAdmin && (
            <Link href="/admin" title="Admin panel" className="text-sm text-slate-600 hover:text-bridge-600">
              ⭐
            </Link>
          )}
          {profile?.role === "teacher" && (
            <Link href="/teacher" className="text-sm font-medium text-slate-600 hover:text-bridge-600">
              🧑‍🏫 Teacher
            </Link>
          )}
          {musicMounted && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={toggleMusic}
                title={
                  musicEnabled
                    ? `Turn off background music${nowPlaying ? ` (playing: ${nowPlaying.title})` : ""}`
                    : "Turn on calm background music"
                }
                aria-pressed={musicEnabled}
                aria-label={musicEnabled ? "Turn off background music" : "Turn on background music"}
                className={`flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100 ${
                  musicEnabled ? "text-bridge-600" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                🎵
              </button>
              {musicEnabled && nowPlaying && (
                <button
                  type="button"
                  onClick={skipTrack}
                  title={`Now playing: ${nowPlaying.title} — click to skip to another track`}
                  aria-label="Skip to next background music track"
                  className="hidden h-11 w-11 items-center justify-center rounded-full text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:flex"
                >
                  ⏭
                </button>
              )}
            </div>
          )}
          {soundMounted && (
            <button
              type="button"
              onClick={toggleSound}
              title={soundEnabled ? "Mute sound effects" : "Turn on sound effects"}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? "Mute sound effects" : "Turn on sound effects"}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
          )}
          <Link href="/login" className="text-sm text-slate-600 hover:text-bridge-600">
            {user ? "Account" : "Sign in"}
          </Link>
        </nav>
      </div>

      {mounted && (
        <div className="border-t border-slate-100 px-4 py-1.5 sm:px-6 lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2 text-xs text-slate-500">
            <span className="shrink-0">
              {stats.completedSkills}/{stats.totalSkills} skills · {stats.percent}%
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-bridge-500 transition-all"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
            {stats.streak > 0 && <span className="shrink-0 font-bold text-orange-600">🔥{stats.streak}</span>}
          </div>
        </div>
      )}
    </header>
  );
}
