"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { setLeaderboardOptIn } from "@/lib/bridgeys";
import { fetchNationwideLeaderboard, type LeaderboardSort } from "@/lib/leaderboard";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import type { LeaderboardEntry } from "@/types";

const SORT_OPTIONS: { id: LeaderboardSort; label: string; emoji: string }[] = [
  { id: "lessons", label: "Most Lessons", emoji: "📚" },
  { id: "bridgeys", label: "Most Bridgeys", emoji: "🪙" },
  { id: "prestige", label: "Best House Item", emoji: "👑" },
];

export default function LeaderboardPage() {
  const { user, profile, configured, syncProgress } = useAuth();
  const [sort, setSort] = useState<LeaderboardSort>("lessons");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [optIn, setOptIn] = useState(true);
  const [mounted, setMounted] = useState(false);

  async function loadBoard(currentSort: LeaderboardSort) {
    setLoading(true);
    const result = await fetchNationwideLeaderboard(currentSort);
    setEntries(result.entries);
    setError(result.error);
    setLoading(false);
  }

  useEffect(() => {
    setOptIn(getProgress().leaderboardOptIn ?? true);
    setMounted(true);
    loadBoard(sort);
  }, [sort]);

  useEffect(() => {
    function refresh() {
      setOptIn(getProgress().leaderboardOptIn ?? true);
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  async function handleOptInToggle(checked: boolean) {
    setLeaderboardOptIn(checked);
    setOptIn(checked);
    if (user) {
      await syncProgress();
      loadBoard(sort);
    }
  }

  async function handleSync() {
    if (user) {
      await syncProgress();
      loadBoard(sort);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl tracking-wide text-slate-900">🏆 Nationwide Leaderboard</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Compete with AlgeBridge students across the country! Rankings update when you sign in and
          sync your progress.
        </p>
      </header>

      {!user && (
        <div className="rounded-xl border border-bridge-200 bg-bridge-50 p-4 text-sm text-bridge-800">
          <Link href="/login" className="font-semibold underline">
            Sign in
          </Link>{" "}
          to appear on the nationwide leaderboard and sync your Bridgeys, lessons, and house prestige.
        </div>
      )}

      {user && !configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Cloud sync isn&apos;t configured on this server — leaderboard data is local only.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSort(option.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              sort === option.id ? "bg-black text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {option.emoji} {option.label}
          </button>
        ))}
      </div>

      {mounted && user && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(e) => handleOptInToggle(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Show me on the nationwide leaderboard
          </label>
          <button
            type="button"
            onClick={handleSync}
            className="rounded-lg bg-bridge-600 px-4 py-2 text-sm font-semibold text-white hover:bg-bridge-700"
          >
            Sync my stats
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
          <p>{error}</p>
          {user && (
            <button
              type="button"
              onClick={handleSync}
              className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              Try syncing again
            </button>
          )}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
          <p className="text-4xl">🌉</p>
          <p className="mt-3 font-semibold">No rankings yet — be the first!</p>
          <p className="mt-1 text-sm">Complete lessons, earn Bridgeys, and sync your account.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 hidden sm:table-cell">Title</th>
                <th className="px-4 py-3">Lessons</th>
                <th className="px-4 py-3 hidden md:table-cell">Bridgeys</th>
                <th className="px-4 py-3 hidden lg:table-cell">Best Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const isMe = user?.id === entry.userId;
                const medal =
                  entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
                return (
                  <tr
                    key={entry.userId}
                    className={isMe ? "bg-bridge-50" : "bg-white"}
                  >
                    <td className="px-4 py-3 font-bold text-slate-700">
                      {medal ?? `#${entry.rank}`}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {entry.displayName}
                      {isMe && (
                        <span className="ml-2 text-xs text-bridge-600">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden text-slate-600 sm:table-cell">
                      {entry.equippedTitle ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">{entry.completedSkills}</td>
                    <td className="px-4 py-3 hidden md:table-cell">🪙 {entry.bridgeys}</td>
                    <td className="px-4 py-3 hidden text-slate-600 lg:table-cell">
                      {entry.bestFurnitureName ? (
                        <span>{entry.bestFurnitureName} ★{entry.bestFurnitureValue}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {profile && (
        <p className="text-center text-xs text-slate-400">
          Logged in as {profile.displayName ?? profile.email}
        </p>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/house" className="font-semibold text-bridge-600 hover:underline">
          ← Back to your house & shop
        </Link>
      </p>
    </div>
  );
}
