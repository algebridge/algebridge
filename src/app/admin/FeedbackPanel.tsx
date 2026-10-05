"use client";

import { useMemo, useState } from "react";
import { fullDate, shortAgo } from "@/lib/console-format";
import { StarsDisplay } from "@/components/StarRating";
import type { AdminFeedbackItem, AdminFeedbackResult } from "@/lib/admin";

/** The kinds as the feedback page names them, in the order the filters show. */
export const FEEDBACK_KINDS: { id: string; label: string }[] = [
  { id: "problem", label: "A problem reads wrong" },
  { id: "broken", label: "Something is broken" },
  { id: "confusing", label: "Something is confusing" },
  { id: "idea", label: "An idea" },
  { id: "love", label: "Something they like" },
  { id: "review", label: "Review" },
  { id: "report", label: "Report" },
  { id: "other", label: "Something else" },
];
const KIND_LABEL: Record<string, string> = Object.fromEntries(FEEDBACK_KINDS.map((k) => [k.id, k.label]));
const KIND_PILL: Record<string, string> = {
  broken: "sbc-pill is-warn",
  report: "sbc-pill is-warn",
  problem: "sbc-pill is-warn",
  love: "sbc-pill is-ok",
  review: "sbc-pill is-blue",
};

const STARS = { fill: "#f5b301", stroke: "#151714", emptyFill: "#fbfaf5", emptyStroke: "#98978e" };
const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-console-mono), "Courier New", monospace',
  fontSize: 11,
  color: "var(--muted)",
};
const FIRST = 40;

/** A page the feedback was sent from, as a link on the platform when it is a path. */
function pageHref(page: string): string | null {
  if (/^https?:\/\//i.test(page)) return page;
  if (page.startsWith("/")) return `https://learn.algebridge.org${page}`;
  return null;
}

export function FeedbackItem({ item: f }: { item: AdminFeedbackItem }) {
  const href = f.page ? pageHref(f.page) : null;
  const email = f.contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact) ? f.contact : null;
  return (
    <li style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className={KIND_PILL[f.kind] ?? "sbc-pill is-muted"}>{KIND_LABEL[f.kind] ?? f.kind}</span>
        {f.rating != null && <StarsDisplay value={f.rating} size={14} {...STARS} label={`${f.rating} of 5 stars`} />}
        <strong style={{ fontSize: 13 }} title={f.senderId ?? "Sent while signed out"}>
          {f.senderName ?? "Signed out"}
        </strong>
        {f.senderRole && <span style={MONO}>{f.senderRole}</span>}
        <span style={{ ...MONO, marginLeft: "auto" }} title={fullDate(f.createdAt)}>
          {shortAgo(f.createdAt)}
        </span>
      </div>
      <p style={{ fontSize: 13, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 }}>{f.message}</p>
      {(f.page || f.contact) && (
        <p style={{ ...MONO, overflowWrap: "anywhere", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {f.page &&
            (href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                from {f.page}
              </a>
            ) : (
              <span>from {f.page}</span>
            ))}
          {f.contact && (email ? <a href={`mailto:${email}`}>reply to {email}</a> : <span>contact: {f.contact}</span>)}
        </p>
      )}
    </li>
  );
}

/**
 * Everything people send from /feedback, newest first, through
 * admin_feedback(). The feedback table has no read policy, so this tab is the
 * only place outside the Supabase dashboard where any of it shows.
 */
export function FeedbackPanel({ data, loading }: { data: AdminFeedbackResult | null; loading: boolean }) {
  const [kind, setKind] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(
    () => (data?.status === "ok" ? data.data.items.filter((i) => kind === "all" || i.kind === kind) : []),
    [data, kind],
  );

  return (
    <section className="sbc-panel" aria-labelledby="sbc-feedback-title">
      <div className="sbc-panel-head">
        <h2 id="sbc-feedback-title">Feedback</h2>
        <span className="sbc-meta">from /feedback · admins only</span>
      </div>
      <div className="sbc-panel-body" style={{ display: "grid", gap: 12 }}>
        {!data && loading && <p style={{ fontSize: 13 }}>Loading feedback…</p>}

        {data?.status === "missing" && (
          <div className="sbc-notice is-info" role="status">
            <strong>Feedback needs the October 5 database update.</strong> Run{" "}
            <code>supabase/schema-2026-10-05-console.sql</code> in the Supabase SQL editor. Everything sent so far is kept
            and shows up here once it runs.
          </div>
        )}

        {data?.status === "error" && (
          <div className="sbc-notice" role="alert">
            The feedback could not be read: {data.message}
          </div>
        )}

        {data?.status === "ok" && (
          <>
            <div className="sbc-chips" role="group" aria-label="Show feedback of one kind">
              <button type="button" className={kind === "all" ? "is-active" : ""} onClick={() => setKind("all")}>
                Everything · {data.data.total}
              </button>
              {FEEDBACK_KINDS.filter((k) => data.data.byKind[k.id]).map((k) => (
                <button key={k.id} type="button" className={kind === k.id ? "is-active" : ""} onClick={() => setKind(k.id)}>
                  {k.label} · {data.data.byKind[k.id]}
                </button>
              ))}
            </div>

            {items.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                {data.data.total === 0 ? "Nothing sent yet. Feedback shows up here the moment someone sends it." : "Nothing of this kind yet."}
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: "1px solid var(--line)" }}>
                {(showAll ? items : items.slice(0, FIRST)).map((f) => (
                  <FeedbackItem key={f.id} item={f} />
                ))}
              </ul>
            )}

            {items.length > FIRST && (
              <div>
                <button type="button" className="sbc-btn is-small" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `Show all ${items.length}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
