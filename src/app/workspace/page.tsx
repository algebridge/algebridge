"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../console.css";
import { useAuth } from "@/lib/auth";
import { consoleFontClass } from "@/lib/console-fonts";
import { fullDate, shortAgo } from "@/lib/console-format";
import {
  claimSessionRequest,
  closeSessionRequest,
  fetchWorkspaceCounts,
  listSessionRequests,
  type SessionRequest,
  type WorkspaceCounts,
} from "@/lib/sessions";
import { listEvents, type CalendarEvent } from "@/lib/calendar";

/**
 * The tutor workspace: one place for the queue of students asking for a
 * person, what is on the calendar, the staff room, and, for admins, the
 * console. Everything staff-facing lives behind one door rather than being
 * scattered across the student app.
 */

type Tab = "desk" | "requests" | "room";

const STATUS_CLASS: Record<SessionRequest["status"], string> = {
  open: "sbc-pill is-warn",
  claimed: "sbc-pill is-ok",
  scheduled: "sbc-pill is-blue",
  closed: "sbc-pill is-muted",
};

export default function WorkspacePage() {
  const { user, profile, loading } = useAuth();
  const isStaff = profile?.role === "tutor" || (profile?.isAdmin ?? false);

  const [tab, setTab] = useState<Tab>("desk");
  const [counts, setCounts] = useState<WorkspaceCounts | null>(null);
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setLoadingData(true);
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 86_400_000);
    const [c, r, e] = await Promise.all([
      fetchWorkspaceCounts(),
      listSessionRequests(),
      listEvents(now.toISOString(), in14.toISOString()),
    ]);
    setCounts(c);
    setRequests(r);
    setUpcoming(e);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (isStaff) void refresh();
  }, [isStaff, refresh]);

  const open = useMemo(() => requests.filter((r) => r.status === "open"), [requests]);
  const mine = useMemo(
    () => requests.filter((r) => r.claimedBy === user?.id && r.status !== "closed"),
    [requests, user?.id]
  );

  if (loading) return <p className="text-center text-slate-500">Loading...</p>;

  if (!user || !isStaff) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Workspace</h1>
        <p className="text-slate-600">The workspace is for tutors and administrators.</p>
        <Link href="/" className="btn-primary inline-block">Back to Course</Link>
      </div>
    );
  }

  async function claim(r: SessionRequest) {
    setBusy(r.id);
    setErr("");
    const e = await claimSessionRequest(r.id, user!.id);
    setBusy(null);
    if (e) setErr(e);
    else {
      setMsg(`Picked up ${r.studentName ?? "the request"}. Message them to agree a time, then add it to the calendar.`);
      await refresh();
    }
  }

  async function close(r: SessionRequest) {
    setBusy(r.id);
    setErr("");
    const e = await closeSessionRequest(r.id);
    setBusy(null);
    if (e) setErr(e);
    else await refresh();
  }

  function requestTable(rows: SessionRequest[], showClaim: boolean) {
    if (rows.length === 0) {
      return (
        <div className="sbc-empty">
          <strong>Nothing waiting</strong>
          <p>When a student asks the helper for a person, they land here.</p>
        </div>
      );
    }
    return (
      <table className="sbc-table">
        <thead>
          <tr>
            <th>Student</th>
            <th>Free</th>
            <th>Asked for</th>
            <th>Waiting</th>
            <th>Status</th>
            <th className="sbc-cell-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.studentName ?? "Unnamed student"}</strong>
                {r.topic && <small>{r.topic}</small>}
              </td>
              <td>{r.availability}</td>
              <td>{r.preferredTutor ?? "anyone"}</td>
              <td className="sbc-num" title={fullDate(r.createdAt)}>{shortAgo(r.createdAt)}</td>
              <td><span className={STATUS_CLASS[r.status]}>{r.status}</span></td>
              <td className="sbc-cell-actions">
                <Link href={`/messages/${r.studentId}`} className="sbc-btn is-small">Message</Link>{" "}
                {showClaim && r.status === "open" && (
                  <button
                    type="button"
                    className="sbc-btn is-small is-accent"
                    disabled={busy === r.id}
                    onClick={() => void claim(r)}
                  >
                    {busy === r.id ? "..." : "Pick up"}
                  </button>
                )}{" "}
                {r.status !== "closed" && (
                  <button
                    type="button"
                    className="sbc-btn is-small"
                    disabled={busy === r.id}
                    onClick={() => void close(r)}
                  >
                    Close
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className={`sbc ${consoleFontClass}`}>
      <div className="sbc-head">
        <div>
          <p className="sbc-eyebrow">AlgeBridge staff</p>
          <h1>Workspace</h1>
          <p>Requests, calendar, and the staff room in one place.</p>
        </div>
        <div className="sbc-actions">
          <Link href="/calendar" className="sbc-btn">Calendar</Link>
          <Link href="/tutor-hub" className="sbc-btn">Students</Link>
          {profile?.isAdmin && <Link href="/admin" className="sbc-btn is-primary">Admin console</Link>}
          <button type="button" className="sbc-btn" onClick={() => void refresh()} disabled={loadingData}>
            {loadingData ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="sbc-tabs">
        <button type="button" className={tab === "desk" ? "is-active" : ""} onClick={() => setTab("desk")}>
          Desk
        </button>
        <button type="button" className={tab === "requests" ? "is-active" : ""} onClick={() => setTab("requests")}>
          Requests{open.length ? ` (${open.length})` : ""}
        </button>
        <button type="button" className={tab === "room" ? "is-active" : ""} onClick={() => setTab("room")}>
          Staff room
        </button>
      </div>

      {err && <div className="sbc-notice">{err}</div>}
      {msg && <div className="sbc-notice is-ok">{msg}</div>}

      {tab === "desk" && (
        <>
          <div className="sbc-stats">
            <article className="sbc-stat">
              <strong>{counts?.openRequests ?? "-"}</strong>
              <span>Waiting for a tutor</span>
              {counts && counts.openRequests > 0 && <b className="is-warn">needs picking up</b>}
            </article>
            <article className="sbc-stat">
              <strong>{counts?.claimedRequests ?? "-"}</strong>
              <span>Picked up</span>
            </article>
            <article className="sbc-stat">
              <strong>{counts?.sessionsToday ?? "-"}</strong>
              <span>Sessions today</span>
            </article>
            <article className="sbc-stat">
              <strong>{counts?.sessionsNext7 ?? "-"}</strong>
              <span>Sessions, next 7 days</span>
            </article>
          </div>

          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>Yours to follow up</h2>
              <span className="sbc-meta">{mine.length} picked up by you</span>
            </div>
            <div className="sbc-panel-body is-flush sbc-table-wrap">{requestTable(mine, false)}</div>
          </div>

          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>Next on the calendar</h2>
              <span className="sbc-meta">next 14 days</span>
            </div>
            <div className="sbc-panel-body is-flush sbc-table-wrap">
              {upcoming.length === 0 ? (
                <div className="sbc-empty">
                  <strong>Nothing booked</strong>
                  <p>
                    Add a session from the <Link href="/calendar">calendar</Link>.
                  </p>
                </div>
              ) : (
                <table className="sbc-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>What</th>
                      <th>Tutor</th>
                      <th>Student</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.slice(0, 8).map((e) => (
                      <tr key={e.id}>
                        <td className="sbc-num">
                          {new Date(e.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                          {new Date(e.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td>
                          <strong>{e.title}</strong>
                          <small>{e.location ?? ""}</small>
                        </td>
                        <td>{e.tutorName ?? "-"}</td>
                        <td>{e.studentName ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {tab === "requests" && (
        <div className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Every request</h2>
            <span className="sbc-meta">{requests.length} total, {open.length} open</span>
          </div>
          <div className="sbc-panel-body is-flush sbc-table-wrap">{requestTable(requests, true)}</div>
        </div>
      )}

      {tab === "room" && (
        <>
          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>Staff room</h2>
            </div>
            <div className="sbc-panel-body" style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <p style={{ color: "var(--muted)" }}>
                Every tutor is in the All Tutors group automatically when they claim the role. That
                is the room for talking to each other.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href="/groups" className="sbc-btn is-primary">Open the staff room</Link>
                <Link href="/messages" className="sbc-btn">Direct messages</Link>
              </div>
            </div>
          </div>

          <div className="sbc-panel">
            <div className="sbc-panel-head">
              <h2>Notifications</h2>
              <span className="sbc-meta">what lands here</span>
            </div>
            <div className="sbc-panel-body" style={{ display: "grid", gap: 8, fontSize: 13 }}>
              <p>
                <strong>{open.length}</strong> student{open.length === 1 ? "" : "s"} waiting for a
                tutor to pick them up.
              </p>
              <p>
                <strong>{counts?.sessionsToday ?? 0}</strong> session
                {counts?.sessionsToday === 1 ? "" : "s"} on the calendar today.
              </p>
              <p style={{ color: "var(--muted)" }}>
                These count live from the database each time you open the workspace. Push
                notifications are not wired up yet.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
