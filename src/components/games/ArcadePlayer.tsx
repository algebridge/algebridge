"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArcadeTile } from "@/components/games/ArcadeTile";
import { ARCADE_RECENT_KEY, readRecent } from "@/components/games/ArcadeHub";
import { useArcadeTester } from "@/components/games/HideForArcadeTesters";
import { ARCADE_GAMES as ALL_GAMES, type ArcadeGame } from "@/lib/arcade/games";

/**
 * One arcade game on its stage. The game is a static page under
 * public/arcade/<slug>/, framed here so it keeps its own loop, sound and keys
 * away from the site. Opening a game puts it first in "Jump back in".
 */
export function ArcadePlayer({ game }: { game: ArcadeGame }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const tester = useArcadeTester();
  const ARCADE_GAMES = tester ? ALL_GAMES.filter((g) => g.slug !== "carts") : ALL_GAMES;

  useEffect(() => {
    try {
      const next = [game.slug, ...readRecent().filter((s) => s !== game.slug)].slice(0, 6);
      localStorage.setItem(ARCADE_RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private window: nothing to remember */
    }
  }, [game.slug]);

  const full = () => {
    const el = frame.current;
    if (!el) return;
    el.requestFullscreen?.().catch(() => {});
    el.focus();
  };

  const more = [
    ...ARCADE_GAMES.filter((g) => g.slug !== game.slug && g.tags.some((t) => game.tags.includes(t))),
    ...ARCADE_GAMES.filter((g) => g.slug !== game.slug && !g.tags.some((t) => game.tags.includes(t))),
  ].slice(0, 8);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-sm font-semibold text-slate-500">
        <Link href="/games" className="text-bridge-700 hover:underline">
          Games
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-slate-700">{game.name}</span>
      </nav>

      <div className="mx-auto overflow-hidden rounded-2xl bg-ink-950 shadow-raised" style={{ width: "min(100%, calc((100dvh - 13rem) * 16 / 9))" }}>
        <iframe
          ref={frame}
          src={`/arcade/${game.slug}/index.html`}
          title={game.name}
          allow="fullscreen; autoplay; clipboard-write"
          className="block aspect-video w-full border-0"
          onLoad={() => frame.current?.focus()}
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-surface p-4 shadow-panel">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{game.name}</h1>
          <p className="mt-0.5 text-sm text-slate-600">{game.blurb}</p>
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-bold text-slate-900">The math</dt>
              <dd className="text-slate-600">{game.math}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-bold text-slate-900">Controls</dt>
              <dd className="text-slate-600">{game.controls}</dd>
            </div>
          </dl>
        </div>
        <button type="button" onClick={full} className="shrink-0 rounded-full bg-bridge-600 px-5 py-2 text-sm font-extrabold text-white transition hover:bg-bridge-700">
          Full screen
        </button>
      </div>

      <section aria-label="More games">
        <h2 className="mb-2 text-sm font-bold text-slate-700">More games</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {more.map((g) => (
            <ArcadeTile key={g.slug} game={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
