"use client";

import { useEffect, useMemo, useState } from "react";
import { ArcadeTile } from "@/components/games/ArcadeTile";
import { ARCADE_GAMES, ARCADE_TAGS, type ArcadeTag } from "@/lib/arcade/games";

export const ARCADE_RECENT_KEY = "algebridge:arcade:recent";

export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(ARCADE_RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

/**
 * The games board: every game as a picture tile on one dense grid, a few of
 * them double size, with a search box and a row of kinds to narrow it. The
 * games a student opened last on this device lead the page.
 */
export function ArcadeHub() {
  const [tag, setTag] = useState<ArcadeTag | "all">("all");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);

  const q = query.trim().toLowerCase();
  const narrowed = tag !== "all" || q !== "";
  const shown = useMemo(
    () =>
      ARCADE_GAMES.filter(
        (g) => (tag === "all" || g.tags.includes(tag)) && (!q || `${g.name} ${g.blurb} ${g.math} ${g.tags.join(" ")}`.toLowerCase().includes(q))
      ),
    [tag, q]
  );
  const again = recent.map((s) => ARCADE_GAMES.find((g) => g.slug === s)).filter((g): g is (typeof ARCADE_GAMES)[number] => !!g);

  return (
    <section aria-label="Games" className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Games</h1>
          <p className="page-subtitle">Pick one and play. Every game has a little math in it, and the math is how you win.</p>
        </div>
        <label className="relative block w-full sm:w-64">
          <span className="sr-only">Search games</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5 21 21" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games"
            className="w-full rounded-full border border-slate-200 bg-surface py-2 pl-9 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          />
        </label>
      </header>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Kinds of games">
        {ARCADE_TAGS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tag === t.id}
            onClick={() => setTag(t.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${
              tag === t.id ? "bg-bridge-600 text-white shadow-panel" : "border border-slate-200 bg-surface text-slate-700 hover:border-bridge-300 hover:text-bridge-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!narrowed && again.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-bold text-slate-700">Jump back in</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {again.map((g) => (
              <ArcadeTile key={g.slug} game={g} eager />
            ))}
          </div>
        </div>
      )}

      {shown.length > 0 ? (
        <div className="grid grid-flow-dense grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {shown.map((g, i) => (
            <ArcadeTile key={g.slug} game={g} big={!narrowed && !!g.big} eager={i < 10} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm font-medium text-slate-600">
          No game matches that. Try a shorter word.
        </p>
      )}
    </section>
  );
}
