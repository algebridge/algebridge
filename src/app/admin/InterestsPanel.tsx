"use client";

import { useMemo, useState } from "react";
import { INTEREST_OPTIONS } from "@/lib/interests";
import { shortAgo } from "@/lib/console-format";
import type { AdminInterestsResult } from "@/lib/admin";

/**
 * What students say they are into: the chips tallied, and every note and
 * line of specifics written in their own words. This is where the next
 * interest chips come from: a word that keeps showing up in the notes is a
 * chip the picker is missing. Nothing here names a student.
 */
export function InterestsPanel({ data, loading }: { data: AdminInterestsResult | null; loading: boolean }) {
  const [query, setQuery] = useState("");
  const labelOf = (id: string) => INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id;

  const tally = useMemo(() => {
    if (data?.status !== "ok") return [];
    return Object.entries(data.data.picks)
      .map(([id, n]) => ({ id, label: labelOf(id), n }))
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  }, [data]);

  /** Words from the notes and specifics, counted, so the picker's gaps show as a list rather than a read. */
  const words = useMemo(() => {
    if (data?.status !== "ok") return [];
    const counts = new Map<string, number>();
    const stop = new Set(["and", "the", "i", "my", "a", "to", "of", "in", "like", "love", "with", "it", "is", "im", "me", "on", "for", "also", "really", "play", "playing", "watch", "watching"]);
    const add = (text: string) => {
      for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
        const w = raw.replace(/^'+|'+$/g, "");
        if (w.length < 3 || stop.has(w)) continue;
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    };
    for (const n of data.data.notes) {
      if (n.note) add(n.note);
      for (const v of Object.values(n.specifics)) add(v);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  }, [data]);

  if (loading && !data) return <p className="sbc-muted">Loading…</p>;
  if (!data) return null;
  if (data.status === "missing") {
    return (
      <div className="sbc-card">
        <p className="sbc-title">Not set up yet</p>
        <p className="sbc-muted" style={{ marginTop: 6 }}>
          The database does not have admin_interests() yet. Run supabase/schema-2026-10-26-interests.sql in the SQL editor, then refresh.
        </p>
      </div>
    );
  }
  if (data.status === "error") return <p className="sbc-pill is-warn">{data.message}</p>;

  const q = query.trim().toLowerCase();
  const notes = data.data.notes.filter((n) => !q || (n.note ?? "").toLowerCase().includes(q) || Object.values(n.specifics).some((v) => v.toLowerCase().includes(q)));
  const max = tally[0]?.n ?? 1;

  return (
    <div className="sbc-stack">
      <div className="sbc-card">
        <p className="sbc-title">
          Chips tapped <span className="sbc-muted">({data.data.students} students with interests saved)</span>
        </p>
        <ul style={{ marginTop: 10, display: "grid", gap: 4 }}>
          {tally.map((t) => (
            <li key={t.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr 48px", alignItems: "center", gap: 10, fontSize: 13 }}>
              <span>{t.label}</span>
              <span style={{ height: 8, background: "var(--line, #e5e5e5)", borderRadius: 4, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.round((t.n / max) * 100)}%`, background: "var(--accent, #2563eb)" }} />
              </span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.n}</span>
            </li>
          ))}
          {tally.length === 0 && <li className="sbc-muted">Nobody has tapped a chip yet.</li>}
        </ul>
      </div>

      <div className="sbc-card">
        <p className="sbc-title">Words in what they wrote</p>
        <p className="sbc-muted" style={{ marginTop: 4 }}>
          Counted across every note and every line of specifics. A word here with no chip of its own is a chip to add.
        </p>
        <p style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {words.map(([w, n]) => (
            <button key={w} type="button" className="sbc-pill" onClick={() => setQuery(w)} title={`Show notes with "${w}"`}>
              {w} <span className="sbc-muted">{n}</span>
            </button>
          ))}
          {words.length === 0 && <span className="sbc-muted">Nothing written yet.</span>}
        </p>
      </div>

      <div className="sbc-card">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p className="sbc-title">
            In their own words <span className="sbc-muted">({notes.length})</span>
          </p>
          <input className="sbc-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the notes" aria-label="Search the notes" />
        </div>
        <ul style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {notes.map((n, i) => (
            <li key={i} style={{ borderTop: "1px solid var(--line, #e5e5e5)", paddingTop: 8, fontSize: 13 }}>
              <p style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {n.picks.map((id) => (
                  <span key={id} className="sbc-pill is-blue">
                    {labelOf(id)}
                  </span>
                ))}
                {n.updatedAt && <span className="sbc-muted">{shortAgo(n.updatedAt)}</span>}
              </p>
              {n.note && <p style={{ marginTop: 6 }}>{n.note}</p>}
              {Object.entries(n.specifics).map(([id, v]) => (
                <p key={id} className="sbc-muted" style={{ marginTop: 4 }}>
                  {labelOf(id)}: {v}
                </p>
              ))}
            </li>
          ))}
          {notes.length === 0 && <li className="sbc-muted">No notes match.</li>}
        </ul>
      </div>
    </div>
  );
}
