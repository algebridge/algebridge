import Link from "next/link";
import { Icon } from "@/components/Icon";

/** The way into Alge Carts, at the top of the games page. */
export function CartsCard() {
  return (
    <Link
      href="/games/carts"
      className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-surface px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-raised"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-amber-300">
          <Icon name="kart" size={22} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            Alge Carts
            <span className="rounded-full bg-amber-400 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-slate-900">New</span>
          </span>
          <span className="block truncate text-xs text-slate-600">Eight karts, one arena, three minutes. A question unlocks every booster.</span>
        </span>
      </span>
      <span className="shrink-0 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-slate-900">Play</span>
    </Link>
  );
}
