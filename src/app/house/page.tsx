"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HouseRoom } from "@/components/HouseRoom";
import { BridgeyPrice } from "@/components/house/BridgeyPrice";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { ColorDots } from "@/components/house/Dollhouse";
import { primaryHex, swatchHex, USABLE } from "@/data/furniture-art";
import { units } from "@/data/curriculum";
import { hueVars, unitHue } from "@/lib/hues";
import { HouseThumb } from "@/components/house/HouseThumb";
import {
  HOUSE_STYLES,
  getFurnitureItem,
  SHOP_ITEMS,
  UNIT_PRIZES,
} from "@/data/house-catalog";
import { DISPLAY_TITLES } from "@/data/titles-catalog";
import { ORNAMENTS, ornamentImage } from "@/data/ornament-catalog";
import { RINK_ITEMS } from "@/data/rink-catalog";
import {
  buyFurniture,
  buyHouseStyle,
  buyOrnament,
  buyTitle,
  equipTitle,
  buyRinkItem,
  hasUnlimitedBridgeys,
  setItemColor,
} from "@/lib/bridgeys";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { showToast } from "@/lib/notify";
import type { FurnitureItem, UserProgress } from "@/types";

type Tab = "house" | "shop" | "titles";
type Rarity = FurnitureItem["rarity"];

/**
 * Rarity is a tier, so it reads as one: a coloured dot plus a word, in the same
 * slot on every card. The previous design put a coloured ring around the whole
 * card, which looked like a focus state and was invisible next to a card that
 * genuinely had focus.
 */
const RARITY_TIERS: { id: Rarity; label: string; dot: string; note: string }[] = [
  { id: "common", label: "Common", dot: "bg-slate-400", note: "Everyday pieces to fill the room." },
  { id: "rare", label: "Rare", dot: "bg-bridge-500", note: "Costlier, and worth more prestige." },
  { id: "legendary", label: "Legendary", dot: "bg-amber-500", note: "The pieces people notice on the leaderboard." },
];

export default function HousePage() {
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [tab, setTab] = useState<Tab>("house");
  /** From the home page's "Play now": straight onto the rink. */
  const [autoSkate, setAutoSkate] = useState(false);
  /** The founder's allowance, handed over with the profile. */
  const [unlimited, setUnlimited] = useState(false);
  /** Colours tried on pieces not yet bought; a piece is bought in the colour it was tried in. */
  const [preview, setPreview] = useState<Record<string, string | null>>({});

  function refresh() {
    setProgress(getProgress());
    setUnlimited(hasUnlimitedBridgeys());
    setMounted(true);
  }

  /** A piece's colour: the one it was painted, or the one being tried on. */
  function colorOf(id: string, owned: boolean): string | null {
    if (owned) return progress?.itemColors?.[id] ?? null;
    return preview[id] ?? null;
  }

  function pickColor(id: string, owned: boolean, swatch: string | null) {
    if (owned) {
      const res = setItemColor(id, swatch);
      showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
      refresh();
    } else {
      setPreview((p) => ({ ...p, [id]: swatch }));
    }
  }

  useEffect(() => {
    refresh();
    // Read here rather than with useSearchParams, which would take this
    // prerendered page out of the static build.
    if (new URLSearchParams(window.location.search).get("play") === "rink") {
      setTab("house");
      setAutoSkate(true);
      window.history.replaceState(null, "", "/house");
    }
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  function handlePurchase(action: () => { ok: boolean; message: string }) {
    const result = action();
    showToast({
      icon: result.ok ? "coin" : "x-circle",
      tone: result.ok ? "reward" : "info",
      title: result.message,
    });
    refresh();
  }

  const balance = unlimited ? Infinity : progress?.bridgeys ?? 0;

  // Derived once per render so the House tab summary and the shop share the
  // same numbers rather than each counting for themselves.
  const stats = useMemo(() => {
    if (!progress) return null;
    const placed = progress.placedFurnitureItems ?? [];
    const prestige = progress.ownedFurniture.reduce(
      (sum, id) => sum + (getFurnitureItem(id)?.prestige ?? 0),
      0
    );
    const shopIds = new Set(SHOP_ITEMS.map((i) => i.id));
    return {
      owned: progress.ownedFurniture.filter((id) => shopIds.has(id)).length,
      total: SHOP_ITEMS.length,
      prizes: progress.ownedFurniture.filter((id) => !shopIds.has(id)).length,
      placed: placed.length,
      prestige,
      houses: progress.ownedHouseStyles.length,
      garden: (progress.ownedOrnaments ?? []).length,
      rink: (progress.ownedRinkItems ?? []).length,
      titles: progress.ownedTitles.length,
    };
  }, [progress]);

  if (!mounted || !progress || !stats) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-72 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "house", label: "My house" },
    { id: "shop", label: "Shop" },
    { id: "titles", label: "Titles" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Balance header ───────────────────────────────────────────
          This is a currency screen, so the balance is the largest thing on
          it. The old header was a three-colour gradient that said nothing and
          still managed to be the loudest element on the page. */}
      <header className="panel">
        <div className="flex flex-wrap items-center justify-between gap-6 p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-bridge-50 ring-1 ring-inset ring-bridge-100">
              <BridgeysLogo size={40} />
            </div>
            <div>
              <p className="eyebrow">Your balance</p>
              <p className="font-display text-4xl leading-none tracking-tight text-slate-900 tabular-nums sm:text-5xl">
                {unlimited ? "Unlimited" : balance.toLocaleString()}
              </p>
              <p className="mt-1.5 text-sm text-slate-600">
                {unlimited ? (
                  <>Bridgeys, with no limit on this account. Every piece in the shop is yours to take.</>
                ) : (
                  <>
                    Bridgeys, earned by finishing skills.{" "}
                    <Link href="/learn" className="font-semibold text-bridge-600 hover:underline">
                      Earn more
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* 2x2 on a phone so the four stats stay a block, one row from sm up. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:gap-x-8">
            <SummaryStat label="Furniture" value={`${stats.owned}/${stats.total}`} />
            <SummaryStat label="Houses" value={`${stats.houses}/${HOUSE_STYLES.length}`} />
            <SummaryStat label="Garden" value={`${stats.garden}`} />
            <SummaryStat label="Titles" value={`${stats.titles}/${DISPLAY_TITLES.length}`} />
            <SummaryStat label="Prestige" value={stats.prestige.toLocaleString()} />
          </dl>
        </div>
      </header>

      {/* ── Segmented tabs ──────────────────────────────────────────
          A track with a raised active chip, matching the rest of the app,
          instead of gradient pills borrowed from a different design era. */}
      <div
        role="tablist"
        aria-label="House sections"
        className="inline-flex w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg px-5 py-2 text-sm font-semibold transition sm:flex-none ${
                active
                  ? "bg-white text-bridge-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "house" && (
        <div className="space-y-4">
          <HouseRoom progress={progress} onUpdate={refresh} autoSkate={autoSkate} />

          {/* The yard art used to be followed by a screen of empty page. This
              turns that space into the next step in the loop. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <NextStepCard
              title="Decorate it"
              body={
                stats.owned + stats.prizes === 0
                  ? "Your first pieces are in the shop, bought with Bridgeys you earn from skills. Finishing a whole unit earns its prize."
                  : `You own ${stats.owned + stats.prizes} ${stats.owned + stats.prizes === 1 ? "piece" : "pieces"}${
                      stats.prizes ? ` (${stats.prizes} ${stats.prizes === 1 ? "unit prize" : "unit prizes"})` : ""
                    } and have placed ${stats.placed}. Open the house to move things around.`
              }
              action={
                <button type="button" onClick={() => setTab("shop")} className="btn-primary btn-sm">
                  Open the shop
                </button>
              }
            />
            <NextStepCard
              title="Show it off"
              body={`Prestige from your furniture counts toward your rank, and an equipped title shows next to your name. You are carrying ${stats.prestige.toLocaleString()} prestige.`}
              action={
                <Link href="/leaderboard" className="btn-secondary btn-sm">
                  See the leaderboard
                </Link>
              }
            />
          </div>
        </div>
      )}

      {tab === "shop" && (
        <div className="space-y-8">
          {/* ── House styles ───────────────────────────────────────── */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="section-title">House styles</h2>
                <p className="mt-1 text-sm text-slate-600">
                  The building itself. You keep every one you buy and can move between them.
                </p>
              </div>
              <p className="text-sm text-slate-500 tabular-nums">
                {stats.houses} of {HOUSE_STYLES.length} owned
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HOUSE_STYLES.map((house) => {
                const owned = progress.ownedHouseStyles.includes(house.id);
                const equipped = progress.houseStyleId === house.id;
                const affordable = owned || balance >= house.price;
                return (
                  <article
                    key={house.id}
                    className={`card flex flex-col overflow-hidden p-0 ${
                      equipped ? "ring-2 ring-bridge-500" : ""
                    }`}
                  >
                    <div className="relative h-44 border-b border-slate-200 bg-slate-50">
                      {/* Drawn, not photographed: the card shows the same house
                          the student will actually be standing in. */}
                      <HouseThumb styleId={house.id} />
                      {equipped && (
                        <span className="badge-brand absolute left-3 top-3">Living here</span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-semibold text-slate-900">{house.name}</h3>
                      <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-600">
                        {house.description}
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <BridgeyPrice
                            amount={house.price}
                            freeWhenZero
                            muted={!affordable}
                          />
                          {!affordable && (
                            <p className="mt-1 text-[11px] font-medium text-slate-400 tabular-nums">
                              {(house.price - balance).toLocaleString()} more to go
                            </p>
                          )}
                        </div>
                        <HouseStyleAction
                          equipped={equipped}
                          owned={owned}
                          affordable={affordable}
                          shortfall={house.price - balance}
                          onClick={() => handlePurchase(() => buyHouseStyle(house.id))}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Unit prizes: earned, never sold ────────────────────── */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="section-title">Unit prizes</h2>
                <p className="mt-1 text-sm text-slate-600">
                  One piece for each unit you finish, made for that unit. These are earned, so the shop keeps its hands off them.
                </p>
              </div>
              <p className="text-sm text-slate-500 tabular-nums">
                {stats.prizes} of {UNIT_PRIZES.length} earned
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {UNIT_PRIZES.map((item) => {
                const unit = units.find((u) => u.id === item.earnedBy);
                const earned = progress.ownedFurniture.includes(item.id);
                const hue = unit ? unitHue(unit.id) : null;
                return (
                  <article key={item.id} style={hue ? hueVars(hue) : undefined} className="card shop-card flex flex-col overflow-hidden p-0">
                    <div className={`hue-tint flex h-28 items-center justify-center border-b ${earned ? "" : "grayscale opacity-60"}`}>
                      <CartoonFurnitureArt itemId={item.id} size={84} variant="room" color={colorOf(item.id, earned)} />
                    </div>
                    <div className="flex flex-1 flex-col p-3.5">
                      <p className="hue-ink text-[11px] font-semibold uppercase tracking-[0.08em]">
                        Unit {unit?.number}
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{item.name}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.blurb}</p>
                      {earned && (
                        <div className="mt-2">
                          <ColorDots itemId={item.id} value={colorOf(item.id, true)} onPick={(s) => pickColor(item.id, true, s)} size={14} />
                        </div>
                      )}
                      <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                        <p className="text-xs text-slate-500 tabular-nums">{item.prestige} prestige</p>
                        {earned ? (
                          <span className="badge-success">Earned</span>
                        ) : (
                          <Link href={`/unit/${item.earnedBy}`} className="btn-secondary btn-sm" title={unit?.title}>
                            Finish Unit {unit?.number}
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Furniture, grouped by tier ─────────────────────────── */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="section-title">Furniture</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Buy it here, then place it from inside your house.
                </p>
              </div>
              <p className="text-sm text-slate-500 tabular-nums">
                {stats.owned} of {stats.total} owned
              </p>
            </div>

            <div className="mt-4 space-y-6">
              {RARITY_TIERS.map((tier) => {
                const items = SHOP_ITEMS.filter((i) => i.rarity === tier.id);
                if (items.length === 0) return null;
                return (
                  <div key={tier.id}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-200 pb-2">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${tier.dot}`} />
                        <span className="text-sm font-semibold text-slate-900">{tier.label}</span>
                      </span>
                      <span className="text-sm text-slate-500">{tier.note}</span>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((item) => {
                        const owned = progress.ownedFurniture.includes(item.id);
                        const affordable = balance >= item.price;
                        const color = colorOf(item.id, owned);
                        const hex = color ? swatchHex(color) : primaryHex(item.id);
                        return (
                          <article
                            key={item.id}
                            className="card shop-card flex flex-col overflow-hidden p-0"
                          >
                            {/* Same anatomy as a house-style card: art on a
                                band tinted in the piece's own colour, then
                                the details. The piece is drawn live, so what
                                moves in the house moves here too. */}
                            <div
                              className={`flex h-28 items-center justify-center border-b border-slate-100 ${
                                !owned && !affordable ? "opacity-45" : ""
                              }`}
                              style={{ background: `${hex}22` }}
                            >
                              <CartoonFurnitureArt itemId={item.id} size={84} variant="room" color={color} />
                            </div>

                            <div className="flex flex-1 flex-col p-3.5">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {item.name}
                              </h3>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                                <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                                {tier.label}
                                <span aria-hidden>·</span>
                                <span className="tabular-nums">{item.prestige} prestige</span>
                                {USABLE.has(item.id) && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>Has a switch</span>
                                  </>
                                )}
                              </p>
                              {item.blurb && <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.blurb}</p>}
                              <div className="mt-2">
                                <ColorDots itemId={item.id} value={color} onPick={(s) => pickColor(item.id, owned, s)} size={14} />
                              </div>

                              <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                                <div>
                                  <BridgeyPrice
                                    amount={item.price}
                                    size="sm"
                                    muted={!owned && !affordable}
                                  />
                                  {!owned && !affordable && (
                                    <p className="mt-1 text-[11px] font-medium text-slate-400 tabular-nums">
                                      {(item.price - balance).toLocaleString()} more to go
                                    </p>
                                  )}
                                </div>
                                {owned ? (
                                  <span className="badge-success">Owned</span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!affordable}
                                    onClick={() => handlePurchase(() => buyFurniture(item.id, preview[item.id]))}
                                    className="btn-primary btn-sm"
                                    title={
                                      affordable
                                        ? undefined
                                        : `${(item.price - balance).toLocaleString()} more Bridgeys needed`
                                    }
                                  >
                                    Buy
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          {/* ── Garden ornaments ───────────────────────────────────── */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="section-title">Garden</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Ornaments for outside. Place them from the yard, and buy more than one of
                  anything you want repeated.
                </p>
              </div>
              <p className="text-sm text-slate-500 tabular-nums">{stats.garden} owned</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ORNAMENTS.map((item) => {
                const affordable = balance >= item.price;
                const owned = (progress.ownedOrnaments ?? []).filter((o) => o === item.id).length;
                const tier = RARITY_TIERS.find((r) => r.id === item.rarity)!;
                return (
                  <article key={item.id} className="card flex flex-col overflow-hidden p-0">
                    <div
                      className={`flex h-28 items-center justify-center border-b border-slate-100 bg-slate-50 ${
                        affordable ? "" : "opacity-45"
                      }`}
                    >
                      <span className="relative block h-24 w-24">
                        <Image
                          src={ornamentImage(item.id)}
                          alt={item.name}
                          fill
                          sizes="120px"
                          className="object-contain object-bottom"
                        />
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-3.5">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {item.name}
                        {owned > 0 && (
                          <span className="ml-1.5 text-xs font-medium text-slate-500">
                            x{owned}
                          </span>
                        )}
                      </h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                        {tier.label}
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{item.prestige} prestige</span>
                      </p>
                      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-600">
                        {item.description}
                      </p>

                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <BridgeyPrice amount={item.price} size="sm" muted={!affordable} />
                          {!affordable && (
                            <p className="mt-1 text-[11px] font-medium text-slate-400 tabular-nums">
                              {(item.price - balance).toLocaleString()} more to go
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!affordable}
                          onClick={() => handlePurchase(() => buyOrnament(item.id))}
                          className="btn-primary btn-sm"
                          title={
                            affordable
                              ? undefined
                              : `${(item.price - balance).toLocaleString()} more Bridgeys needed`
                          }
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── The rink ──────────────────────────────────────────── */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="section-title">Rink</h2>
                <p className="mt-1 text-sm text-slate-600">
                  For the backyard, around the rink where Veronica skates. Each piece takes one of the seven spots.
                </p>
              </div>
              <p className="text-sm text-slate-500 tabular-nums">{stats.rink} of {RINK_ITEMS.length} owned</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {RINK_ITEMS.map((item) => {
                const affordable = balance >= item.price;
                const owned = (progress.ownedRinkItems ?? []).includes(item.id);
                const tier = RARITY_TIERS.find((r) => r.id === item.rarity)!;
                const color = colorOf(item.id, owned);
                const hex = color ? swatchHex(color) : primaryHex(item.id);
                return (
                  <article key={item.id} className="card shop-card flex flex-col overflow-hidden p-0">
                    <div className={`flex h-28 items-center justify-center border-b border-sky-100 ${!owned && !affordable ? "opacity-45" : ""}`} style={{ background: `${hex}22` }}>
                      <CartoonFurnitureArt itemId={item.id} size={92} variant="room" color={color} />
                    </div>
                    <div className="flex flex-1 flex-col p-3.5">
                      <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                        {tier.label}
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{item.prestige} prestige</span>
                        {USABLE.has(item.id) && (
                          <>
                            <span aria-hidden>·</span>
                            <span>Lights up</span>
                          </>
                        )}
                      </p>
                      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-slate-600">{item.blurb}</p>
                      <div className="mt-2">
                        <ColorDots itemId={item.id} value={color} onPick={(s) => pickColor(item.id, owned, s)} size={14} />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          <BridgeyPrice amount={item.price} size="sm" muted={!owned && !affordable} />
                          {!owned && !affordable && (
                            <p className="mt-1 text-[11px] font-medium text-slate-400 tabular-nums">
                              {(item.price - balance).toLocaleString()} more to go
                            </p>
                          )}
                        </div>
                        {owned ? (
                          <span className="badge-success">Owned</span>
                        ) : (
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => handlePurchase(() => buyRinkItem(item.id, preview[item.id]))}
                            className="btn-primary btn-sm"
                            title={affordable ? undefined : `${(item.price - balance).toLocaleString()} more Bridgeys needed`}
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === "titles" && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="section-title">Display titles</h2>
              <p className="mt-1 text-sm text-slate-600">
                One shows next to your name on your profile and the leaderboard.
              </p>
            </div>
            <p className="text-sm text-slate-500 tabular-nums">
              {stats.titles} of {DISPLAY_TITLES.length} owned
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DISPLAY_TITLES.map((title) => {
              const owned = progress.ownedTitles.includes(title.id);
              const equipped = progress.equippedTitleId === title.id;
              const affordable = balance >= title.price;
              return (
                <article
                  key={title.id}
                  className={`card flex flex-col p-4 ${equipped ? "ring-2 ring-bridge-500" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-2xl ring-1 ring-inset ring-slate-200"
                    >
                      {title.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">{title.name}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                        {title.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <BridgeyPrice
                      amount={title.price}
                      size="sm"
                      muted={!owned && !affordable}
                    />
                    {equipped ? (
                      <span className="badge-brand">Equipped</span>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => handlePurchase(() => equipTitle(title.id))}
                        className="btn-secondary btn-sm"
                      >
                        Equip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => handlePurchase(() => buyTitle(title.id))}
                        className="btn-primary btn-sm"
                        title={
                          affordable
                            ? undefined
                            : `${(title.price - balance).toLocaleString()} more Bridgeys needed`
                        }
                      >
                        Buy
                      </button>
                    )}
                  </div>

                  {!owned && !affordable && (
                    <p className="mt-2 text-[11px] font-medium text-slate-400 tabular-nums">
                      {(title.price - balance).toLocaleString()} more to go
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}

function NextStepCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{body}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function HouseStyleAction({
  equipped,
  owned,
  affordable,
  shortfall,
  onClick,
}: {
  equipped: boolean;
  owned: boolean;
  affordable: boolean;
  shortfall: number;
  onClick: () => void;
}) {
  if (equipped) return <span className="text-sm font-medium text-slate-500">Current home</span>;
  if (owned) {
    return (
      <button type="button" onClick={onClick} className="btn-secondary btn-sm">
        Move in
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={!affordable}
      onClick={onClick}
      className="btn-primary btn-sm"
      title={affordable ? undefined : `${shortfall.toLocaleString()} more Bridgeys needed`}
    >
      Buy
    </button>
  );
}
