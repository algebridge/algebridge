"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../console.css";
import { useAuth } from "@/lib/auth";
import { consoleFontClass } from "@/lib/console-fonts";
import { fullDate, shortAgo } from "@/lib/console-format";
import {
  fetchAdminOverview,
  fetchAdminUserRows,
  grantAdmin,
  type AdminOverview,
  type AdminUserRow,
} from "@/lib/admin";
import { adminDeleteUser } from "@/lib/social";

type Tab = "overview" | "people";
type RoleFilter = "all" | "student" | "tutor" | "teacher" | "nontutor";
type SeenFilter = "all" | "1d" | "7d" | "30d" | "dormant";

const CSV_HEAD = ["id", "email", "display_name", "role", "is_admin", "created_at", "last_seen_at"];

/**
 * Deleting an account is irreversible and cascades progress, messages, and
 * notebooks. Export first, so the record outlives the accounts.
 */
function exportCsv(rows: AdminUserRow[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((u) =>
    [u.id, u.email, u.displayName, u.role, u.isAdmin, u.createdAt, u.lastSeenAt].map(esc).join(",")
  );
  const blob = new Blob([[CSV_HEAD.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `algebridge-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ROLE_CLASS: Record<string, string> = {
  student: "sbc-pill is-muted",
  tutor: "sbc-pill is-ok",
  teacher: "sbc-pill is-blue",
};

function seenWithin(iso: string | null, days: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= days * 86_400_000;
}

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const isAdmin = profile?.isAdmin ?? false;

  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [seenFilter, setSeenFilter] = useState<SeenFilter>("all");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");

  const refresh = useCallback(async () => {
    setLoadingData(true);
    const [o, r] = await Promise.all([fetchAdminOverview(), fetchAdminUserRows()]);
    setOverview(o);
    setRows(r);
    setSelected(new Set());
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (roleFilter === "nontutor" && u.role === "tutor") return false;
      if (roleFilter !== "all" && roleFilter !== "nontutor" && u.role !== roleFilter) return false;
      if (seenFilter === "1d" && !seenWithin(u.lastSeenAt, 1)) return false;
      if (seenFilter === "7d" && !seenWithin(u.lastSeenAt, 7)) return false;
      if (seenFilter === "30d" && !seenWithin(u.lastSeenAt, 30)) return false;
      if (seenFilter === "dormant" && seenWithin(u.lastSeenAt, 30)) return false;
      if (!q) return true;
      return (
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        u.role.includes(q)
      );
    });
  }, [rows, query, roleFilter, seenFilter]);

  /**
   * Never offer to bulk-delete an admin or the signed-in account. Removing
   * either one locks somebody out of the console with no way back except SQL.
   */
  const deletable = useMemo(
    () => filtered.filter((u) => !u.isAdmin && u.id !== user?.id),
    [filtered, user?.id]
  );
  const chosen = useMemo(() => deletable.filter((u) => selected.has(u.id)), [deletable, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkDelete() {
    if (chosen.length === 0) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const failures: string[] = [];
    for (const u of chosen) {
      const e = await adminDeleteUser(u.id);
      if (e) failures.push(`${u.email ?? u.id}: ${e}`);
    }
    const done = chosen.length - failures.length;
    setBusy(false);
    setConfirmText("");
    if (failures.length) setErr(`${failures.length} could not be deleted. ${failures[0]}`);
    setMsg(`Deleted ${done} account${done === 1 ? "" : "s"}.`);
    await refresh();
  }

  async function deleteOne(u: AdminUserRow) {
    if (!window.confirm(`Permanently delete ${u.displayName ?? u.email}? This cannot be undone.`)) return;
    setBusy(true);
    setErr("");
    const e = await adminDeleteUser(u.id);
    setBusy(false);
    if (e) setErr(e);
    else {
      setMsg(`Deleted ${u.displayName ?? u.email}.`);
      await refresh();
    }
  }

  async function runPromote() {
    const email = promoteEmail.trim();
    if (!email) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const e = await grantAdmin(email);
    setBusy(false);
    if (e) setErr(e);
    else {
      setMsg(`${email} is now an admin.`);
      setPromoteEmail("");
      await refresh();
    }
  }

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Admin</h1>
        <p className="text-slate-600">This area is for administrators only.</p>
        <Link href="/" className="btn-primary inline-block">Back to Course</Link>
      </div>
    );
  }

  const confirmWord = String(chosen.length);
  const seenByDay = overview?.seenByDay ?? [];
  const histoMax = Math.max(1, ...seenByDay.map((d) => d.n));

  return (
    <div className={`sbc ${consoleFontClass}`}>
      <div className="sbc-head">
        <div>
          <p className="sbc-eyebrow">AlgeBridge operator console</p>
          <h1>Admin</h1>
        </div>
        <div className="sbc-actions">
          <Link href="/calendar" className="sbc-btn">Calendar</Link>
          <button type="button" className="sbc-btn" onClick={() => void refresh()} disabled={loadingData}>
            {loadingData ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="sbc-tabs">
        <button type="button" className={tab === "overview" ? "is-active" : ""} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button type="button" className={tab === "people" ? "is-active" : ""} onClick={() => setTab("people")}>
          People{rows.length ? ` (${rows.length})` : ""}
        </button>
      </div>

      {err && <div className="sbc-notice">{err}</div>}
      {msg && <div className="sbc-notice is-ok">{msg}</div>}

      {tab === "overview" && (
        <>
          {!overview && !loadingData && (
            <div className="sbc-notice is-info">
              These numbers come from <code>admin_overview()</code>. If this stays empty, run{" "}
              <code>supabase/schema-admin-console.sql</code> in the Supabase SQL editor first.
            </div>
          )}

          <div className="sbc-stats">
            <article className="sbc-stat">
              <strong>{overview?.total ?? "-"}</strong>
              <span>Accounts</span>
              <b className="is-quiet">
                {overview
                  ? `${overview.students} student · ${overview.tutors} tutor · ${overview.teachers} teacher`
                  : ""}
              </b>
            </article>
            <article className="sbc-stat">
              <strong>{overview?.active1d ?? "-"}</strong>
              <span>Active · 24 hours</span>
            </article>
            <article className="sbc-stat">
              <strong>{overview?.active7d ?? "-"}</strong>
              <span>Active · 7 days</span>
            </article>
            <article className="sbc-stat">
              <strong>{overview?.active30d ?? "-"}</strong>
              <span>Active · 30 days</span>
            </article>
          </div>

          <div className="sbc-stats">
            <article className="sbc-stat">
              <strong>{overview?.new7d ?? "-"}</strong>
              <span>Joined · 7 days</span>
              <b className="is-quiet">{overview ? `${overview.new30d} in 30 days` : ""}</b>
            </article>
            <article className="sbc-stat">
              <strong>{overview?.dormant ?? "-"}</strong>
              <span>Dormant · 30 days+</span>
            </article>
            <article className="sbc-stat">
              <strong>{overview?.sessionsNext7 ?? "-"}</strong>
              <span>Calendar · next 7 days</span>
              <b className="is-quiet">{overview ? `${overview.sessions7d} in the last 7` : ""}</b>
            </article>
          </div>

          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>Last seen, by day</h2>
              <span className="sbc-meta">30 days</span>
            </div>
            <div className="sbc-panel-body">
              <div className="sbc-histo">
                {seenByDay.map((d) => (
                  <span
                    key={d.day}
                    className={`sbc-histo-col${d.n === 0 ? " is-empty" : ""}`}
                    title={`${d.day}: ${d.n} account${d.n === 1 ? "" : "s"} last seen`}
                  >
                    <i style={{ height: d.n === 0 ? 2 : `${Math.round((d.n / histoMax) * 100)}%` }} />
                  </span>
                ))}
              </div>
              <div className="sbc-axis">
                <span>{seenByDay[0]?.day ?? ""}</span>
                <span>{seenByDay[seenByDay.length - 1]?.day ?? ""}</span>
              </div>
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                Every account is counted once, on the day it was last seen. This is a decay curve,
                not daily actives. A tall bar today means many people were here today; a tall bar
                three weeks ago means many people have not been back since.
              </p>
            </div>
          </div>

          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>What &ldquo;active&rdquo; counts</h2>
            </div>
            <div
              className="sbc-panel-body"
              style={{ fontSize: 13, color: "var(--muted)", display: "grid", gap: 8 }}
            >
              <p>
                Active means the account opened AlgeBridge while signed in. The app sends a
                heartbeat at most once every five minutes per tab.
              </p>
              <p>
                Anything dated before this console shipped was backfilled from each account&rsquo;s
                last progress sync, which only ran on the leaderboard, the login page, and the
                manual Sync button. Read those older dates as a floor, not a measurement.
              </p>
            </div>
          </div>
        </>
      )}

      {tab === "people" && (
        <>
          <div className="sbc-filters">
            <div className="sbc-search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, or role…"
                aria-label="Search accounts"
              />
            </div>
            <label className="sbc-field">
              <span>Role</span>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}>
                <option value="all">All roles</option>
                <option value="student">Student</option>
                <option value="tutor">Tutor</option>
                <option value="teacher">Teacher</option>
                <option value="nontutor">Everyone except tutors</option>
              </select>
            </label>
            <button
              type="button"
              className="sbc-btn"
              disabled={filtered.length === 0}
              onClick={() => exportCsv(filtered)}
              title="Download the rows shown, so the record survives a deletion"
            >
              Export {filtered.length} as CSV
            </button>
            <label className="sbc-field">
              <span>Last seen</span>
              <select value={seenFilter} onChange={(e) => setSeenFilter(e.target.value as SeenFilter)}>
                <option value="all">Any time</option>
                <option value="1d">Past 24 hours</option>
                <option value="7d">Past 7 days</option>
                <option value="30d">Past 30 days</option>
                <option value="dormant">Dormant 30 days+</option>
              </select>
            </label>
          </div>

          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>Accounts</h2>
              <span className="sbc-meta">
                {filtered.length} of {rows.length}
                {chosen.length > 0 ? ` · ${chosen.length} selected` : ""}
              </span>
            </div>

            {chosen.length > 0 && (
              <div className="sbc-panel-body" style={{ borderBottom: "1.5px solid var(--ink)" }}>
                <div className="sbc-notice">
                  <p style={{ marginBottom: 8 }}>
                    <strong>{chosen.length}</strong> account{chosen.length === 1 ? "" : "s"} will be
                    permanently deleted, along with their progress, messages, and notebooks. This
                    cannot be undone. Export the list first if you want any record of who was here.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <label className="sbc-field" style={{ minWidth: 170 }}>
                      <span>Type {confirmWord} to confirm</span>
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        inputMode="numeric"
                        aria-label="Confirm deletion count"
                      />
                    </label>
                    <button
                      type="button"
                      className="sbc-btn is-danger"
                      disabled={busy || confirmText.trim() !== confirmWord}
                      onClick={() => void runBulkDelete()}
                    >
                      {busy ? "Deleting…" : `Delete ${chosen.length}`}
                    </button>
                    <button type="button" className="sbc-btn" onClick={() => setSelected(new Set())}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="sbc-panel-body is-flush sbc-table-wrap">
              <table className="sbc-table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <input
                        type="checkbox"
                        aria-label="Select every account shown"
                        checked={deletable.length > 0 && chosen.length === deletable.length}
                        onChange={(e) =>
                          setSelected(e.target.checked ? new Set(deletable.map((u) => u.id)) : new Set())
                        }
                      />
                    </th>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Last seen</th>
                    <th>Joined</th>
                    <th className="sbc-cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const locked = u.isAdmin || u.id === user.id;
                    return (
                      <tr key={u.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${u.displayName ?? u.email ?? "account"}`}
                            disabled={locked}
                            checked={selected.has(u.id)}
                            onChange={() => toggle(u.id)}
                          />
                        </td>
                        <td>
                          <strong>{u.displayName ?? "(no name)"}</strong>
                          <small>{u.email ?? "no email"}</small>
                        </td>
                        <td>
                          <span className={ROLE_CLASS[u.role] ?? "sbc-pill is-muted"}>{u.role}</span>
                          {u.isAdmin && (
                            <span className="sbc-pill is-blue" style={{ marginLeft: 4 }}>
                              admin
                            </span>
                          )}
                        </td>
                        <td className="sbc-num" title={fullDate(u.lastSeenAt)}>
                          {shortAgo(u.lastSeenAt)}
                        </td>
                        <td className="sbc-num" title={fullDate(u.createdAt)}>
                          {shortAgo(u.createdAt)}
                        </td>
                        <td className="sbc-cell-actions">
                          <Link href={`/messages/${u.id}`} className="sbc-btn is-small">
                            Message
                          </Link>{" "}
                          <button
                            type="button"
                            className="sbc-btn is-small is-danger"
                            disabled={busy || locked}
                            title={locked ? "Admins and your own account are protected here" : "Delete account"}
                            onClick={() => void deleteOne(u)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!loadingData && filtered.length === 0 && (
                <div className="sbc-empty">
                  <strong>Nothing matches</strong>
                  <p>Try a different role or a wider last-seen window.</p>
                </div>
              )}
            </div>
          </div>

          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>Add an admin</h2>
            </div>
            <div className="sbc-panel-body" style={{ display: "grid", gap: 10 }}>
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                The account has to exist already. Have them sign up at{" "}
                <Link href="/login">/login</Link>, then promote the address here.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label className="sbc-field" style={{ flex: 1, minWidth: 220 }}>
                  <span>Email</span>
                  <input
                    value={promoteEmail}
                    onChange={(e) => setPromoteEmail(e.target.value)}
                    placeholder="name@algebridge.org"
                    type="email"
                  />
                </label>
                <button
                  type="button"
                  className="sbc-btn is-primary"
                  disabled={busy || !promoteEmail.trim()}
                  onClick={() => void runPromote()}
                >
                  Make admin
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
