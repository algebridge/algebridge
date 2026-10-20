"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { spendable } from "@/lib/bridgeys";
import { SHOP_ITEMS } from "@/data/house-catalog";
import { answerPay, COMBO_TIERS, nextComboTier } from "@/lib/gamification";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { Icon } from "@/components/Icon";

/** The balance and the cheapest piece the student does not own yet, kept current. */
function useWallet() {
  const [wallet, setWallet] = useState<{ balance: number; goal: { name: string; price: number } | null } | null>(null);
  useEffect(() => {
    const read = () => {
      const p = getProgress();
      const balance = spendable(p);
      const owned = new Set(p.ownedFurniture ?? []);
      // The cheapest piece not owned yet: what the next answers are for.
      const goal = SHOP_ITEMS.filter((i) => !owned.has(i.id) && i.price > 0).sort((a, b) => a.price - b.price)[0] ?? null;
      setWallet({ balance, goal: goal ? { name: goal.name, price: goal.price } : null });
    };
    read();
    window.addEventListener(PROGRESS_UPDATED_EVENT, read);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, read);
  }, []);
  return wallet;
}

/**
 * The game on the problem card: a combo meter that pays more the longer the
 * run, the Bridgeys each answer drops into the wallet, and what they are
 * saving toward in the house. A miss cracks the meter.
 */
export function RunHud({
  combo,
  pay,
  broke,
}: {
  /** First-try right answers in a row. */
  combo: number;
  /** The last answer's pay, keyed so the coin flies once per answer. */
  pay: { amount: number; key: number } | null;
  /** The run a miss just ended (keyed), so the meter can crack. */
  broke: { run: number; key: number } | null;
}) {
  const wallet = useWallet();
  const rate = answerPay(Math.max(1, combo + 1));
  const next = nextComboTier(combo);
  const from = [...COMBO_TIERS].reverse().find((t) => t.run <= combo)?.run ?? 0;
  const fill = next ? Math.min(1, (combo - from) / Math.max(1, next.run - from)) : 1;
  const hot = combo >= 5 ? "run-hot-3" : combo >= 3 ? "run-hot-2" : combo >= 1 ? "run-hot-1" : "";
  const showBreak = broke && broke.run >= 2;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="off">
      <div
        key={showBreak ? `b${broke.key}` : "meter"}
        className={`run-meter ${hot} ${showBreak ? "run-crack" : ""}`}
        title={next ? `${next.run} in a row pays ${next.pay} Bridgeys an answer` : "Top rate"}
      >
        <Icon name="flame" size={15} />
        <span className="font-bold tabular-nums">{combo}</span>
        <span className="run-bar" aria-hidden>
          <span style={{ width: `${Math.round(fill * 100)}%` }} />
        </span>
        <span className="text-[11px] font-semibold opacity-80">
          {showBreak && combo === 0 ? `Run of ${broke.run} over` : `+${rate} next`}
        </span>
      </div>
      {wallet && (
        <Link href="/house" className="run-wallet" title="Your Bridgeys. Spend them in your house.">
          <span key={`w${pay?.key ?? 0}`} className={pay ? "run-wallet-pulse inline-flex items-center gap-1.5" : "inline-flex items-center gap-1.5"}>
            <BridgeysLogo size={15} />
            <span className="font-bold tabular-nums">{Number.isFinite(wallet.balance) ? wallet.balance : "Unlimited"}</span>
          </span>
          {Number.isFinite(wallet.balance) && wallet.goal && (
            <span className="hidden text-[11px] font-medium text-slate-500 sm:inline">
              {wallet.goal.price > wallet.balance ? `${wallet.goal.price - wallet.balance} more for the ${wallet.goal.name}` : `Enough for the ${wallet.goal.name}`}
            </span>
          )}
          {pay && pay.amount > 0 && (
            <span key={`c${pay.key}`} className="run-coin" aria-hidden>
              +{pay.amount}
            </span>
          )}
        </Link>
      )}
      <span className="sr-only" role="status">
        {pay && pay.amount > 0 ? `Plus ${pay.amount} ${pay.amount === 1 ? "Bridgey" : "Bridgeys"}. ${combo} in a row.` : showBreak && combo === 0 ? `Run of ${broke.run} over.` : ""}
      </span>
    </div>
  );
}
