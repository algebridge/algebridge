"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HouseRoom } from "@/components/HouseRoom";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { CartoonFurnitureArt } from "@/components/house/CartoonFurnitureArt";
import { FURNITURE_ITEMS, HOUSE_STYLES, RARITY_STYLES } from "@/data/house-catalog";
import { DISPLAY_TITLES } from "@/data/titles-catalog";
import {
  buyFurniture,
  buyHouseStyle,
  buyTitle,
  equipTitle,
} from "@/lib/bridgeys";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { showToast } from "@/lib/notify";
import type { UserProgress } from "@/types";

type Tab = "house" | "shop" | "titles";

export default function HousePage() {
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [tab, setTab] = useState<Tab>("house");

  function refresh() {
    setProgress(getProgress());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  function handlePurchase(action: () => { ok: boolean; message: string }) {
    const result = action();
    showToast({
      emoji: result.ok ? "🪙" : "😅",
      title: result.message,
    });
    refresh();
  }

  if (!mounted || !progress) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "house", label: "My House", emoji: "🏠" },
    { id: "shop", label: "Shop", emoji: "🛒" },
    { id: "titles", label: "Titles", emoji: "🏷️" },
  ];

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 p-6 text-white shadow-[0_20px_40px_-20px_rgba(30,64,175,0.6)] sm:p-8">
        {/* soft decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-amber-300/30 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <BridgeysLogo size={40} />
              </div>
              <div>
                <h1 className="font-display text-3xl tracking-wide drop-shadow-sm sm:text-4xl">Bridgey House</h1>
                <p className="text-sm font-medium text-white/80">Your reward for mastering algebra 🎉</p>
              </div>
            </div>
            <p className="mt-3 max-w-xl text-sm text-white/90">
              Earn Bridgeys from lessons, shop for furniture and house styles, then step inside
              and walk around with the arrow keys to decorate your space.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/15 px-5 py-3 backdrop-blur">
            <BridgeysLogo size={36} />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">Your Balance</p>
              <p className="text-2xl font-bold">{progress.bridgeys.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${
              tab === t.id
                ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {tab === "house" && <HouseRoom progress={progress} onUpdate={refresh} />}

      {tab === "shop" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold text-slate-900">🏡 House Styles</h2>
            <p className="mt-1 text-sm text-slate-500">Upgrade your home&apos;s look and vibe.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HOUSE_STYLES.map((house) => {
                const owned = progress.ownedHouseStyles.includes(house.id);
                const equipped = progress.houseStyleId === house.id;
                return (
                  <div key={house.id} className="card flex flex-col overflow-hidden p-0">
            <div className="relative h-40 bg-gradient-to-b from-sky-200/60 to-green-300/60">
                      {house.exteriorImage && (
                        <Image
                          src={house.exteriorImage}
                          alt={house.name}
                          fill
                          className="object-contain p-3 drop-shadow-md"
                          sizes="(max-width: 640px) 50vw, 300px"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-bold text-slate-900">{house.emoji} {house.name}</h3>
                      <p className="mt-1 flex-1 text-xs text-slate-500">{house.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-bold text-amber-700">
                          {house.price === 0 ? "Free" : `🪙 ${house.price}`}
                        </span>
                        {equipped ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Living here
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePurchase(() => buyHouseStyle(house.id))}
                            className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            {owned ? "Move in" : "Buy"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">🛋️ Furniture</h2>
            <p className="mt-1 text-sm text-slate-500">
              Fill your house! Legendary items boost your leaderboard prestige.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {FURNITURE_ITEMS.map((item) => {
                const owned = progress.ownedFurniture.includes(item.id);
                const style = RARITY_STYLES[item.rarity];
                return (
                  <div
                    key={item.id}
                    className={`card flex flex-col items-center p-4 ring-2 ${style.ring} ${item.rarity === "legendary" ? "bg-gradient-to-b from-purple-50 to-white" : ""}`}
                  >
                    <CartoonFurnitureArt itemId={item.id} size={88} variant="shop" />
                    <h3 className="mt-3 text-center font-bold text-slate-900">{item.name}</h3>
                    <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${style.badge}`}>
                      {style.label} · ★{item.prestige}
                    </span>
                    <div className="mt-3 flex w-full items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-sm font-bold text-amber-700">
                        <BridgeysLogo size={18} />
                        {item.price.toLocaleString()}
                      </span>
                      {owned ? (
                        <span className="text-xs font-bold text-emerald-600">Owned ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handlePurchase(() => buyFurniture(item.id))}
                          className="game-btn-primary rounded-lg px-3 py-1.5 text-xs font-bold"
                        >
                          Buy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === "titles" && (
        <section>
          <h2 className="text-lg font-bold text-slate-900">🏷️ Display Titles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Show off on your profile and the nationwide leaderboard!
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DISPLAY_TITLES.map((title) => {
              const owned = progress.ownedTitles.includes(title.id);
              const equipped = progress.equippedTitleId === title.id;
              return (
                <div key={title.id} className="card flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{title.emoji}</span>
                    <div>
                      <h3 className="font-bold text-slate-900">{title.name}</h3>
                      <p className="text-xs text-slate-500">{title.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm font-bold text-amber-700">
                        <BridgeysLogo size={16} />
                        {title.price.toLocaleString()}
                      </span>
                    {equipped ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Equipped
                      </span>
                    ) : owned ? (
                      <button
                        type="button"
                        onClick={() => handlePurchase(() => equipTitle(title.id))}
                        className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Equip
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePurchase(() => buyTitle(title.id))}
                        className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/leaderboard" className="font-semibold text-bridge-600 hover:underline">
          See the nationwide leaderboard →
        </Link>
      </p>
    </div>
  );
}
