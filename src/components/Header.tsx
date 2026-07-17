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
import { getUnreadCount, subscribeToIncomingMessages, MESSAGES_READ_EVENT } from "@/lib/social";

export function Header() {
  const { stats, continueTarget, mounted } = useProgress();
  const [reviewCount, setReviewCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, profile } = useAuth();
  const { enabled: soundEnabled, toggle: toggleSound, mounted: soundMounted } = useSound();
  const {
    enabled: musicEnabled,
    toggle: toggleMusic,
    mounted: musicMounted,
    nowPlaying,
  } = useBackgroundMusic();

  useEffect(() => {
    const skillMeta = units.flatMap((u) =>
      u.skills.map((s) => ({ id: s.id, title: s.title, unitId: u.id, unitTitle: u.title }))
    );
    setReviewCount(getReviewQueueCount(getProgress().skills, skillMeta));
  }, [stats.completedSkills]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    const load = () => getUnreadCount().then((n) => active && setUnread(n));
    load();
    const unsub = subscribeToIncomingMessages(user.id, load);
    window.addEventListener(MESSAGES_READ_EVENT, load);
    return () => {
      active = false;
      unsub();
      window.removeEventListener(MESSAGES_READ_EVENT, load);
    };
  }, [user?.id]);

  const tutorsHref = profile?.role === "tutor" ? "/tutor-hub" : "/tutors";
  const tutorsLabel = profile?.role === "tutor" ? "Students" : "Tutors";

  // The nav destinations, shared between the desktop bar and the mobile sheet.
  const links: { href: string; label: string; icon: string; badge?: number; show: boolean }[] = [
    { href: "/achievements", label: "Achievements", icon: "🏆", show: true },
    { href: "/house", label: "House", icon: "🏠", show: true },
    { href: "/leaderboard", label: "Leaderboard", icon: "🏅", show: true },
    { href: "/review", label: "Review", icon: "🔁", badge: reviewCount, show: true },
    { href: tutorsHref, label: tutorsLabel, icon: "🔎", show: true },
    { href: "/messages", label: "Messages", icon: "💬", badge: unread, show: !!user },
    { href: "/groups", label: "Group chats", icon: "👥", show: !!user },
    { href: "/teacher", label: "Teacher", icon: "🧑‍🏫", show: profile?.role === "teacher" },
    { href: "/admin", label: "Admin", icon: "⭐", show: !!profile?.isAdmin },
  ].filter((l) => l.show);

  const progressPct = stats.percent;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
          <Image src="/brand/logo-icon.png" alt="AlgeBridge" width={30} height={30} />
          <span className="hidden font-display text-lg tracking-wide text-black sm:inline">AlgeBridge</span>
        </Link>

        {/* Stat chips — desktop only */}
        {mounted && (
          <div className="ml-1 hidden items-center gap-2 lg:flex">
            <Link
              href="/achievements"
              title={`Level ${stats.level}: ${stats.levelTitle}`}
              className="flex items-center gap-2 rounded-full border border-bridge-200 bg-bridge-50 px-3 py-1.5 hover:bg-bridge-100"
            >
              <span className="text-xs font-bold text-bridge-800">Lvl {stats.level}</span>
              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-bridge-500"
                  style={{ width: `${stats.xpForNextLevel > 0 ? Math.min(100, (stats.xpIntoLevel / stats.xpForNextLevel) * 100) : 0}%` }}
                />
              </div>
            </Link>
            {stats.streak > 0 && (
              <span title={`${stats.streak}-day streak`} className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700">
                🔥 {stats.streak}
              </span>
            )}
            <Link
              href="/house"
              title="Bridgeys"
              className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
            >
              <BridgeysLogo size={18} />
              {stats.bridgeys.toLocaleString()}
            </Link>
          </div>
        )}

        {/* Desktop nav */}
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              title={l.label}
              className="relative rounded-lg px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-bridge-700"
            >
              {l.label}
              {!!l.badge && l.badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bridge-600 px-1 text-[10px] font-bold text-white">
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <UtilityToggles
            musicMounted={musicMounted}
            musicEnabled={musicEnabled}
            toggleMusic={toggleMusic}
            nowPlaying={nowPlaying}
            soundMounted={soundMounted}
            soundEnabled={soundEnabled}
            toggleSound={toggleSound}
          />
          {continueTarget && (
            <Link
              href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
              className="ml-1 rounded-lg bg-bridge-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-bridge-700"
            >
              Continue
            </Link>
          )}
          <Link href="/login" className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-bridge-700">
            {user ? "Account" : "Sign in"}
          </Link>
        </nav>

        {/* Mobile controls */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          {continueTarget && (
            <Link
              href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
              className="rounded-lg bg-bridge-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-bridge-700"
            >
              Continue
            </Link>
          )}
          {user && (
            <Link href="/messages" aria-label="Messages" className="relative flex h-10 w-10 items-center justify-center rounded-lg text-base hover:bg-slate-100">
              💬
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-bridge-600 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Slim progress bar — mobile/tablet at-a-glance */}
      {mounted && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-1.5 text-xs text-slate-500 sm:px-6 lg:hidden">
          <span className="shrink-0">
            {stats.completedSkills}/{stats.totalSkills} skills · {progressPct}%
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-bridge-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="flex shrink-0 items-center gap-1 font-bold text-amber-700">
            <BridgeysLogo size={14} />
            {stats.bridgeys.toLocaleString()}
          </span>
          {stats.streak > 0 && <span className="shrink-0 font-bold text-orange-600">🔥{stats.streak}</span>}
        </div>
      )}

      {/* Mobile / tablet menu sheet */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <nav className="mx-auto max-w-6xl px-3 py-2">
            {mounted && (
              <div className="mb-1 flex items-center gap-2 px-2 py-2 text-xs text-slate-500">
                <span className="rounded-full bg-bridge-50 px-2.5 py-1 font-bold text-bridge-800">⭐ Lvl {stats.level}</span>
                {stats.streak > 0 && <span className="rounded-full bg-orange-50 px-2.5 py-1 font-bold text-orange-700">🔥 {stats.streak}</span>}
              </div>
            )}
            <ul className="grid grid-cols-2 gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span className="text-base">{l.icon}</span>
                    {l.label}
                    {!!l.badge && l.badge > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-bridge-600 px-1 text-[10px] font-bold text-white">
                        {l.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 px-2 pt-2">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {user ? "⚙️ Account" : "Sign in"}
              </Link>
              <UtilityToggles
                musicMounted={musicMounted}
                musicEnabled={musicEnabled}
                toggleMusic={toggleMusic}
                nowPlaying={nowPlaying}
                soundMounted={soundMounted}
                soundEnabled={soundEnabled}
                toggleSound={toggleSound}
              />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function UtilityToggles({
  musicMounted,
  musicEnabled,
  toggleMusic,
  nowPlaying,
  soundMounted,
  soundEnabled,
  toggleSound,
}: {
  musicMounted: boolean;
  musicEnabled: boolean;
  toggleMusic: () => void;
  nowPlaying: { title: string } | null;
  soundMounted: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {musicMounted && (
        <button
          type="button"
          onClick={toggleMusic}
          title={musicEnabled ? `Turn off music${nowPlaying ? ` (${nowPlaying.title})` : ""}` : "Turn on calm background music"}
          aria-pressed={musicEnabled}
          aria-label={musicEnabled ? "Turn off background music" : "Turn on background music"}
          className={`flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 ${musicEnabled ? "text-bridge-600" : "text-slate-400 hover:text-slate-700"}`}
        >
          🎵
        </button>
      )}
      {soundMounted && (
        <button
          type="button"
          onClick={toggleSound}
          title={soundEnabled ? "Mute sound effects" : "Turn on sound effects"}
          aria-pressed={soundEnabled}
          aria-label={soundEnabled ? "Mute sound effects" : "Turn on sound effects"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
      )}
    </div>
  );
}
