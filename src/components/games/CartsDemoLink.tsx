"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { isCartsTester } from "@/lib/algecarts/testers";

/** The way into the kart demo, on the games page, for the testers only. */
export function CartsDemoLink() {
  const { profile, configured, loading } = useAuth();
  if (configured && (loading || !isCartsTester(profile?.displayName))) return null;
  return (
    <Link
      href="/games/carts"
      className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-surface px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-raised"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">Alge Carts</span>
        <span className="block truncate text-xs text-slate-600">Eight karts, one arena, three minutes. A question unlocks every booster. Demo for testers.</span>
      </span>
      <span className="shrink-0 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-extrabold text-slate-900">Play</span>
    </Link>
  );
}
