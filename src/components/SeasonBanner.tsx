"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { HALLOWEEN_AWARD_GOAL } from "@/lib/gamification";
import { HALLOWEEN_ENDS, useSeason } from "@/lib/season";

/**
 * What is on for the season, on the course page: the award, the titles and
 * the shelf in the shop, each one tap away. Only in season (lib/season.ts).
 */
export function SeasonBanner() {
  const season = useSeason();
  if (season !== "halloween") return null;
  return (
    <section className="season-band px-5 py-4 sm:px-6" aria-label="Halloween at AlgeBridge">
      <span className="season-moon" aria-hidden="true" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-orange-200">Until {HALLOWEEN_ENDS}</p>
        <h2 className="mt-1 font-display text-2xl tracking-wide sm:text-[28px]">Halloween at AlgeBridge</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          <li>
            <Link href="/achievements" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-medium text-orange-50 ring-1 ring-inset ring-white/15 transition hover:bg-white/20">
              <Icon name="pumpkin" size={16} />
              Pumpkin Patch award: {HALLOWEEN_AWARD_GOAL} right answers
            </Link>
          </li>
          <li>
            <Link href="/house?tab=titles" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-medium text-orange-50 ring-1 ring-inset ring-white/15 transition hover:bg-white/20">
              <Icon name="ghost" size={16} />
              Six spooky titles
            </Link>
          </li>
          <li>
            <Link href="/house?tab=shop" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 font-medium text-orange-50 ring-1 ring-inset ring-white/15 transition hover:bg-white/20">
              <Icon name="house" size={16} />
              Ten pieces for your house
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
