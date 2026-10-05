"use client";

import { useState } from "react";
import { BridgeyPrice } from "@/components/house/BridgeyPrice";
import { TitleBadge } from "@/components/TitleEmblem";
import { TitlePlate } from "@/components/TitlePlate";
import { DISPLAY_TITLES, getDisplayTitle } from "@/data/titles-catalog";
import { useAuth } from "@/lib/auth";
import { buyTitle, equipTitle, unequipTitle } from "@/lib/bridgeys";
import { fireConfetti, showToast } from "@/lib/notify";
import { TIER_LABEL, tierOf, titlesByTier, type TitleTier } from "@/lib/titles";
import type { UserProgress } from "@/types";

const TIER_CHIP: Record<TitleTier, string> = {
  common: "bg-slate-100 text-slate-700",
  rare: "bg-sky-50 text-sky-800",
  epic: "bg-violet-100 text-violet-800",
  legendary: "bg-amber-100 text-amber-900",
};

/**
 * The titles tab of the House: what you are wearing, shown the way everyone
 * sees it, then every title by tier, each with its badge, a preview next to
 * your own name, and what it takes to get it.
 */
export function TitlesPanel({
  progress,
  balance,
  school,
  onUpdate,
}: {
  progress: UserProgress;
  balance: number;
  school: boolean;
  onUpdate: () => void;
}) {
  const { profile } = useAuth();
  const first = profile?.displayName?.trim().split(/\s+/)[0] || "You";
  /** The title that just went on, so its plate catches the light once. */
  const [justWorn, setJustWorn] = useState<string | null>(null);
  const worn = progress.equippedTitleId ? getDisplayTitle(progress.equippedTitleId) ?? null : null;
  const owned = new Set(progress.ownedTitles);
  const where = school ? "on your profile and in your account menu" : "on your profile, in your account menu and on the leaderboard";

  function act(id: string, kind: "buy" | "wear") {
    const title = getDisplayTitle(id);
    const result = kind === "buy" ? buyTitle(id) : equipTitle(id);
    showToast({ icon: result.ok ? "coin" : "x-circle", tone: result.ok ? "reward" : "info", title: result.message });
    if (result.ok && title) {
      setJustWorn(id);
      if (kind === "buy") {
        const tier = tierOf(title);
        fireConfetti(tier === "epic" || tier === "legendary" ? "big" : "small");
      }
    }
    onUpdate();
  }

  function takeOff() {
    const result = unequipTitle();
    showToast({ icon: "check", tone: "info", title: result.message });
    setJustWorn(null);
    onUpdate();
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">Titles</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-600">One at a time, worn next to your name {where}. Pricier titles wear a finer plate.</p>
        </div>
        <div className="min-w-[10rem]">
          <p className="text-right text-sm text-slate-600 tabular-nums">
            <span className="font-semibold text-slate-900">{progress.ownedTitles.length}</span> of {DISPLAY_TITLES.length} collected
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((progress.ownedTitles.length / DISPLAY_TITLES.length) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* What everyone sees. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
        <div className="min-w-0">
          <p className="eyebrow">Wearing now</p>
          {worn ? (
            <p className="mt-2 flex flex-wrap items-center gap-2.5 text-lg font-semibold text-slate-900">
              <span>{first}</span>
              <TitlePlate key={justWorn ?? "worn"} title={worn} size="lg" shine={justWorn === worn.id} />
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Pick a title below and it shows up next to your name.</p>
          )}
        </div>
        {worn && (
          <button type="button" onClick={takeOff} className="btn-secondary btn-sm">
            Take it off
          </button>
        )}
      </div>

      {titlesByTier().map(({ tier, titles }) => {
        const have = titles.filter((t) => owned.has(t.id)).length;
        return (
          <div key={tier.id} className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] ${TIER_CHIP[tier.id]}`}>{tier.label}</span>
                <span className="text-sm font-normal text-slate-600">{tier.blurb}</span>
              </h3>
              <p className="text-xs text-slate-500 tabular-nums">
                {have} of {titles.length}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {titles.map((title) => {
                const mine = owned.has(title.id);
                const wearing = worn?.id === title.id;
                const affordable = balance >= title.price;
                const toGo = Math.max(0, title.price - (Number.isFinite(balance) ? balance : title.price));
                return (
                  <article key={title.id} className={`card flex flex-col p-4 transition ${wearing ? "ring-2 ring-amber-400" : ""}`}>
                    <div className="flex items-start gap-3">
                      <TitleBadge title={title} size={56} />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900">{title.name}</h4>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{title.description}</p>
                      </div>
                    </div>

                    {/* How it looks on you. */}
                    <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="shrink-0 text-xs font-semibold text-slate-700">{first}</span>
                      <TitlePlate title={title} size="xs" />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      {mine ? (
                        <span className="text-xs font-medium text-slate-500">In your collection</span>
                      ) : (
                        <BridgeyPrice amount={title.price} size="sm" muted={!affordable} />
                      )}
                      {wearing ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Wearing</span>
                      ) : mine ? (
                        <button type="button" onClick={() => act(title.id, "wear")} className="btn-secondary btn-sm">
                          Wear
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!affordable}
                          onClick={() => act(title.id, "buy")}
                          className="btn-primary btn-sm"
                          title={affordable ? `Buy and wear ${title.name}` : `${toGo.toLocaleString()} more Bridgeys needed`}
                        >
                          Buy and wear
                        </button>
                      )}
                    </div>

                    {!mine && !affordable && (
                      <div className="mt-2">
                        <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.round((Math.max(0, balance) / title.price) * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-slate-500 tabular-nums">{toGo.toLocaleString()} more to go</p>
                      </div>
                    )}
                    <span className="sr-only">{TIER_LABEL[tierOf(title)]} title.</span>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
