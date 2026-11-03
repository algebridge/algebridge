"use client";

import { useEffect, useState } from "react";
import { fetchCartsBoard, type CartsRow } from "@/lib/algecarts/leaderboard";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * The Alge Carts board under the stage: the top ten by smashes, with the bots
 * on it until ten students have raced. `refresh` changes after each match.
 */
export function CartsLeaderboard({ userId, refresh }: { userId: string | null; refresh: number }) {
  const [rows, setRows] = useState<CartsRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let live = true;
    void fetchCartsBoard(userId).then((r) => {
      if (!live) return;
      setRows(r.rows);
      setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [userId, refresh]);
  if (!isSupabaseConfigured()) return null;
  return (
    <section aria-labelledby="carts-board-title" className="panel">
      <div className="panel-head flex items-center justify-between gap-3">
        <h2 id="carts-board-title" className="text-base font-bold text-slate-900">
          Alge Carts leaderboard
        </h2>
        <p className="text-xs text-slate-500">Smashes across every match.</p>
      </div>
      <div className="panel-body">
        {error ? (
          <p className="text-sm text-slate-500">The board is on its way.</p>
        ) : rows === null ? (
          <p className="text-sm text-slate-500">Loading the board.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nobody has raced yet. The first match puts you on it.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Racer</th>
                  <th className="px-4 py-2 text-right">Smashes</th>
                  <th className="px-4 py-2 text-right">Wins</th>
                  <th className="px-4 py-2 text-right">Matches</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className={r.isMe ? "bg-bridge-50 font-semibold" : "bg-surface"}>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">{r.rank}</td>
                    <td className="px-4 py-2.5 text-slate-900">
                      {r.name}
                      {r.isMe && <span className="ml-2 text-xs font-semibold text-bridge-700">you</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{r.smashes}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{r.wins}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{r.matches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
