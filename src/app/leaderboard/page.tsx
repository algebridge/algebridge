"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { Icon } from "@/components/Icon";
import { withoutEmoji } from "@/components/RewardMark";
import { useAuth } from "@/lib/auth";
import { setLeaderboardOptIn } from "@/lib/bridgeys";
import { fetchMyStanding, fetchNationwideLeaderboard, type LeaderboardSort } from "@/lib/leaderboard";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import type { LeaderboardEntry } from "@/types";

const SORT_OPTIONS: { id: LeaderboardSort; label: string; unit: string }[] = [
  { id: "bridgeys", label: "Bridgeys", unit: "Bridgeys" },
  { id: "lessons", label: "Lessons", unit: "lessons" },
  { id: "prestige", label: "Best house piece", unit: "prestige" },
];

const TOP = 5;

function valueFor(entry: LeaderboardEntry, sort: LeaderboardSort): number {
  return sort === "bridgeys" ? entry.bridgeys : sort === "prestige" ? entry.bestFurnitureValue : entry.completedSkills;
}

/**
 * The top five students across AlgeBridge, then where you stand, then
 * everyone else. Rows are kept current by the autosave: every time a
 * student's progress is written to their account, their leaderboard row
 * goes with it, so there is nothing to press.
 */
export default function LeaderboardPage() {
  const { user, profile, configured, syncProgress } = useAuth();
  const [sort, setSort] = useState<LeaderboardSort>("bridgeys");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [standing, setStanding] = useState<{ rank: number; value: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [optIn, setOptIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadBoard = useCallback(
    async (currentSort: LeaderboardSort) => {
      setLoading(true);
      const result = await fetchNationwideLeaderboard(currentSort);
      setEntries(result.entries);
      setTotal(result.total);
      setError(result.error);
      setStanding(user ? await fetchMyStanding(currentSort, user.id) : null);
      setLoading(false);
    },
    [user]
  );

  useEffect(() => {
    setOptIn(getProgress().leaderboardOptIn === true);
    setMounted(true);
    void loadBoard(sort);
  }, [sort, loadBoard]);

  useEffect(() => {
    function refresh() {
      setOptIn(getProgress().leaderboardOptIn === true);
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  async function handleOptIn(checked: boolean) {
    setJoining(true);
    setLeaderboardOptIn(checked);
    setOptIn(checked);
    if (user) {
      await syncProgress();
      await loadBoard(sort);
    }
    setJoining(false);
  }

  const unit = SORT_OPTIONS.find((o) => o.id === sort)!.unit;
  const top = entries.slice(0, TOP);
  const rest = entries.slice(TOP);
  const mine = user ? entries.find((e) => e.userId === user.id) ?? null : null;
  const myRank = mine?.rank ?? standing?.rank ?? null;
  const myValue = mine ? valueFor(mine, sort) : standing?.value ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Leaderboard</h1>
        <p className="page-subtitle">
          The top five students across AlgeBridge, kept current as everyone learns. Only students who choose to show
          themselves are on it, as a first name and an initial.
        </p>
      </header>

      {/* A visitor: the board's rows are only readable to signed-in
          accounts, so this is a locked door, said once, not an error. The
          outline of the podium shows what is behind it, with no names or
          numbers in it. */}
      {!user && (
        <section aria-labelledby="board-locked" className="space-y-4">
          <div aria-hidden className="grid grid-cols-5 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5].map((rank) => (
              <div
                key={rank}
                className="flex h-24 flex-col rounded-2xl border border-slate-200 bg-white p-2.5 sm:h-40 sm:p-4"
              >
                <span className="scale-75 self-start sm:scale-100">
                  <RankBadge rank={rank} />
                </span>
                <span className="mt-2 h-2.5 w-3/4 rounded bg-slate-100 sm:mt-4 sm:h-3" />
                <span className="mt-2 hidden h-3 w-1/2 rounded bg-slate-100 sm:block" />
                <span className="mt-auto h-4 w-1/2 rounded bg-slate-100 sm:h-6" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bridge-50 text-bridge-600">
              <Icon name="leaderboard" size={24} />
            </span>
            <h2 id="board-locked" className="mt-3 text-base font-semibold text-slate-900">
              The board is for signed-in students
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-600">
              Sign in to see who is on top. You are not on it unless you choose to be, and then only as your first name
              and an initial.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/login?mode=signin" className="btn-primary">
                Sign in
              </Link>
              <Link href="/login" className="btn-secondary">
                Create free account
              </Link>
            </div>
          </div>
        </section>
      )}

      {user && !configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Cloud sync isn&apos;t configured on this server, so the board is local only.
        </div>
      )}

      {user && (
      <>
      <div role="tablist" aria-label="Rank by" className="inline-flex w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto">
        {SORT_OPTIONS.map((option) => {
          const active = sort === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSort(option.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${
                active ? "bg-white text-bridge-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          <p>{error}</p>
        </div>
      ) : top.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          <p className="font-semibold text-slate-800">The board is empty so far.</p>
          <p className="mt-1 text-sm">Finish a skill and earn Bridgeys to take the first place.</p>
        </div>
      ) : (
        <>
          {/* ── The top five ─────────────────────────────────────── */}
          <section aria-labelledby="top-five">
            <h2 id="top-five" className="sr-only">
              Top five
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {top.map((entry) => {
                const isMe = user?.id === entry.userId;
                return (
                  <li
                    key={entry.userId}
                    className={`card relative flex flex-col p-4 ${entry.rank <= 3 ? "lg:-mt-1" : ""} ${
                      isMe ? "ring-2 ring-bridge-500" : ""
                    }`}
                  >
                    <RankBadge rank={entry.rank} />
                    <p className="mt-3 truncate text-base font-semibold text-slate-900" title={entry.displayName}>
                      {entry.displayName}
                      {isMe && <span className="ml-1.5 text-xs font-medium text-bridge-600">you</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{entry.equippedTitle ? withoutEmoji(entry.equippedTitle) : "Student"}</p>
                    <p className="mt-3 flex items-baseline gap-1.5">
                      <span className="font-display text-3xl leading-none tracking-tight text-slate-900 tabular-nums">
                        {valueFor(entry, sort).toLocaleString()}
                      </span>
                      <span className="text-xs font-medium text-slate-500">{unit}</span>
                    </p>
                    <dl className="mt-3 space-y-1 text-xs text-slate-500">
                      {sort !== "bridgeys" && (
                        <div className="flex items-center gap-1.5">
                          <BridgeysLogo size={12} />
                          <dd className="tabular-nums">{entry.bridgeys.toLocaleString()} Bridgeys</dd>
                        </div>
                      )}
                      {sort !== "lessons" && <dd className="tabular-nums">{entry.completedSkills} lessons</dd>}
                      {sort !== "prestige" && entry.bestFurnitureName && (
                        <dd className="truncate">{entry.bestFurnitureName}</dd>
                      )}
                    </dl>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ── Everyone else ───────────────────────────────────── */}
          {rest.length > 0 && (
            <section aria-labelledby="the-rest" className="overflow-hidden rounded-xl border border-slate-200">
              <h2 id="the-rest" className="sr-only">
                Places six onward
              </h2>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Title</th>
                    <th className="px-4 py-3 text-right">{SORT_OPTIONS.find((o) => o.id === sort)!.label}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rest.map((entry) => {
                    const isMe = user?.id === entry.userId;
                    return (
                      <tr key={entry.userId} className={isMe ? "bg-bridge-50" : "bg-white"}>
                        <td className="px-4 py-2.5 font-semibold text-slate-600 tabular-nums">#{entry.rank}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-900">
                          {entry.displayName}
                          {isMe && <span className="ml-2 text-xs text-bridge-600">you</span>}
                        </td>
                        <td className="px-4 py-2.5 hidden text-slate-600 sm:table-cell">{entry.equippedTitle ? withoutEmoji(entry.equippedTitle) : "-"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{valueFor(entry, sort).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      </>
      )}

      {/* ── Where you stand ─────────────────────────────────────── */}
      {mounted && user && configured && (
        <section className="panel">
          <div className="panel-head">
            <p className="panel-title">Where you stand</p>
          </div>
          <div className="panel-body flex flex-wrap items-center justify-between gap-4">
            {optIn && myRank ? (
              <p className="text-sm text-slate-700">
                <span className="font-display text-2xl tracking-tight text-slate-900 tabular-nums">#{myRank}</span>
                <span className="ml-1.5 text-slate-500">of {Math.max(total, myRank).toLocaleString()}</span>
                <span className="ml-3 tabular-nums">
                  {(myValue ?? 0).toLocaleString()} {unit}
                </span>
              </p>
            ) : optIn ? (
              <p className="text-sm text-slate-600">
                You are on the board, as your first name and an initial. Your next save places you.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                You are hidden from the board. Show yourself and your rank follows your work from then on, as your
                first name and an initial.
              </p>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={optIn}
                disabled={joining}
                onChange={(e) => void handleOptIn(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              {optIn ? "Shown on the board" : "Show me on the board"}
            </label>
          </div>
        </section>
      )}

      {profile && (
        <p className="text-center text-xs text-slate-400">Signed in as {profile.displayName ?? profile.email}</p>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/house" className="font-semibold text-bridge-600 hover:underline">
          Back to your house and shop
        </Link>
      </p>
    </div>
  );
}

/** 1, 2, 3 in gold, silver and bronze; the rest in slate. */
function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1
      ? "bg-amber-400 text-amber-950"
      : rank === 2
        ? "bg-slate-300 text-slate-800"
        : rank === 3
          ? "bg-orange-300 text-orange-950"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums ${tone}`} aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  );
}
