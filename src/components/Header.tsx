"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSound } from "@/hooks/useSound";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { Icon } from "@/components/Icon";
import { useAppNavState } from "@/components/AppNavProvider";
import { isActivePath } from "@/lib/nav";
import { initialsOf } from "@/lib/name";

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  teacher: "Teacher",
  tutor: "Tutor",
};

export function Header() {
  const pathname = usePathname();
  const { sections, continueTarget, stats, mounted, unread } = useAppNavState();
  const { user, profile, signOut, needsRealName } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const { enabled: soundEnabled, toggle: toggleSound, mounted: soundMounted } = useSound();
  const {
    enabled: musicEnabled,
    toggle: toggleMusic,
    mounted: musicMounted,
    nowPlaying,
  } = useBackgroundMusic();

  // Close the menus on navigation so they never linger over a new page.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        {/* Logo — the sidebar carries it on desktop. */}
        <Link href="/" className="flex shrink-0 items-center gap-2 lg:hidden">
          <Image src="/brand/logo-icon.png" alt="AlgeBridge" width={26} height={26} />
          <span className="font-display text-base tracking-wide text-slate-900">AlgeBridge</span>
        </Link>

        {/* Stat chips — desktop */}
        {mounted && (
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/achievements"
              title={`Level ${stats.level}: ${stats.levelTitle}`}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 transition hover:border-bridge-300 hover:bg-bridge-50"
            >
              <span className="text-xs font-semibold text-slate-700">Level {stats.level}</span>
              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-bridge-600"
                  style={{
                    width: `${stats.xpForNextLevel > 0 ? Math.min(100, (stats.xpIntoLevel / stats.xpForNextLevel) * 100) : 0}%`,
                  }}
                />
              </div>
            </Link>
            {stats.streak > 0 && (
              <span
                title={`${stats.streak}-day streak`}
                className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700"
              >
                🔥 {stats.streak}
              </span>
            )}
            <Link
              href="/house"
              title="Bridgeys"
              className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              <BridgeysLogo size={16} />
              {stats.bridgeys.toLocaleString()}
            </Link>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* Sound controls live in the mobile menu instead — the top bar is
              too tight for them on a phone. */}
          <div className="hidden lg:flex">
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

          {continueTarget && (
            <Link
              href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
              className="rounded-lg bg-bridge-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-bridge-700 lg:hidden"
            >
              Continue
            </Link>
          )}

          {/* Account */}
          {user ? (
            <div ref={accountRef} className="relative ml-1">
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100"
              >
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-bridge-600 text-xs font-bold text-white">
                  {initialsOf(profile?.displayName ?? user.email)}
                  {(unread > 0 || needsRealName) && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                  )}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:inline">
                  {profile?.displayName ?? user.email}
                </span>
                <Icon name="chevron-down" size={14} className="hidden text-slate-400 sm:block" />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  className="animate-pop-in absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-raised"
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {profile?.displayName ?? "Your account"}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="badge-neutral">
                        {ROLE_LABEL[profile?.role ?? "student"]}
                      </span>
                      {profile?.isAdmin && <span className="badge-brand">Admin</span>}
                    </div>
                  </div>
                  {needsRealName && (
                    <Link
                      href="/login"
                      className="block bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                    >
                      Add your real name to start practicing →
                    </Link>
                  )}
                  <div className="p-1.5">
                    <MenuLink href="/login" label="Account settings" />
                    <MenuLink href="/profile" label="Edit profile" />
                    <MenuLink href="/messages" label="Messages" badge={unread} />
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="ml-1 flex items-center gap-2">
              <Link href="/login?mode=signin" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/login" className="btn-primary btn-sm hidden whitespace-nowrap sm:inline-flex">
                Create account
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 lg:hidden"
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

      {/* Slim progress strip — mobile at-a-glance */}
      {mounted && (
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-1.5 text-xs text-slate-500 sm:px-6 lg:hidden">
          <span className="shrink-0">
            {stats.completedSkills}/{stats.totalSkills} skills · {stats.percent}%
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-bridge-600 transition-all"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
          <span className="flex shrink-0 items-center gap-1 font-semibold text-amber-700">
            <BridgeysLogo size={14} />
            {stats.bridgeys.toLocaleString()}
          </span>
          {stats.streak > 0 && (
            <span className="shrink-0 font-semibold text-orange-600">🔥{stats.streak}</span>
          )}
        </div>
      )}

      {/* Mobile / tablet nav sheet */}
      {menuOpen && (
        <div className="max-h-[70vh] overflow-y-auto border-t border-slate-200 bg-white lg:hidden">
          <nav className="px-3 py-3">
            {sections.map((section) => (
              <div key={section.title} className="mb-4 last:mb-0">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {section.title}
                </p>
                <ul className="grid grid-cols-2 gap-1">
                  {section.items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                            active ? "bg-bridge-50 text-bridge-700" : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Icon
                            name={item.icon}
                            className={active ? "text-bridge-600" : "text-slate-400"}
                          />
                          <span className="truncate">{item.label}</span>
                          {!!item.badge && item.badge > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-bridge-600 px-1.5 text-[10px] font-bold text-white">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-100 px-2 pt-2">
              {!user && (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary btn-sm"
                >
                  Create free account
                </Link>
              )}
              <div className="ml-auto">
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
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuLink({ href, label, badge }: { href: string; label: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
    >
      {label}
      {!!badge && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-bridge-600 px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
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
          title={
            musicEnabled
              ? `Turn off music${nowPlaying ? ` (${nowPlaying.title})` : ""}`
              : "Turn on calm background music"
          }
          aria-pressed={musicEnabled}
          aria-label={musicEnabled ? "Turn off background music" : "Turn on background music"}
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm transition hover:bg-slate-100 ${
            musicEnabled ? "text-bridge-600" : "text-slate-400 hover:text-slate-700"
          }`}
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
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
      )}
    </div>
  );
}
