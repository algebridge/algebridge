"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../console.css";
import { useAuth } from "@/lib/auth";
import { consoleFontClass } from "@/lib/console-fonts";
import { dayKey, timeOfDay, toLocalInput } from "@/lib/console-format";
import {
  createEvent,
  deleteEvent,
  listEvents,
  listStudentOptions,
  updateEvent,
  type CalendarEvent,
  type EventDraft,
  type EventKind,
  type StudentOption,
} from "@/lib/calendar";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHIPS_PER_DAY = 3;

/** The Sunday on or before the 1st of the month. */
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  return new Date(year, month, 1 - first.getDay());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function emptyDraft(day: Date): EventDraft {
  const start = new Date(day);
  start.setHours(16, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: "",
    kind: "session",
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    studentId: null,
    location: null,
    notes: null,
  };
}

export default function CalendarPage() {
  const { user, profile, loading } = useAuth();
  const isStaff = profile?.role === "tutor" || (profile?.isAdmin ?? false);

  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [err, setErr] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useMemo(() => gridStart(year, month), [year, month]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(start, i)), [start]);

  const refresh = useCallback(async () => {
    setLoadingData(true);
    const from = start.toISOString();
    const to = addDays(start, 42).toISOString();
    setEvents(await listEvents(from, to));
    setLoadingData(false);
  }, [start]);

  useEffect(() => {
    if (isStaff) void refresh();
  }, [isStaff, refresh]);

  useEffect(() => {
    if (isStaff) void listStudentOptions().then(setStudents);
  }, [isStaff]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      if (mineOnly && e.tutorId !== user?.id) continue;
      const key = dayKey(new Date(e.startsAt));
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events, mineOnly, user?.id]);

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => new Date(e.endsAt).getTime() >= Date.now())
        .filter((e) => !mineOnly || e.tutorId === user?.id)
        .slice(0, 6),
    [events, mineOnly, user?.id]
  );

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user || !isStaff) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Calendar</h1>
        <p className="text-slate-600">
          The tutoring calendar is for tutors and administrators.
        </p>
        <Link href="/tutors" className="btn-primary inline-block">Find a tutor</Link>
      </div>
    );
  }

  const canEdit = (e: CalendarEvent) => e.tutorId === user.id || (profile?.isAdmin ?? false);

  function openNew(day: Date) {
    setEditing(null);
    setDraft(emptyDraft(day));
  }

  function openExisting(e: CalendarEvent) {
    setEditing(e);
    setDraft({
      title: e.title,
      kind: e.kind,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      studentId: e.studentId,
      location: e.location,
      notes: e.notes,
    });
  }

  function closeModal() {
    setEditing(null);
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      setErr("Give the entry a title.");
      return;
    }
    if (new Date(draft.endsAt) <= new Date(draft.startsAt)) {
      setErr("The end time has to be after the start time.");
      return;
    }
    setBusy(true);
    setErr("");
    const e = editing ? await updateEvent(editing.id, draft) : await createEvent(user!.id, draft);
    setBusy(false);
    if (e) {
      setErr(e);
      return;
    }
    closeModal();
    await refresh();
  }

  async function remove() {
    if (!editing) return;
    if (!window.confirm(`Delete "${editing.title}"?`)) return;
    setBusy(true);
    const e = await deleteEvent(editing.id);
    setBusy(false);
    if (e) setErr(e);
    else {
      closeModal();
      await refresh();
    }
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const todayKey = dayKey(today);
  const editable = editing ? canEdit(editing) : true;

  return (
    <div className={`sbc ${consoleFontClass}`}>
      <div className="sbc-head">
        <div>
          <p className="sbc-eyebrow">AlgeBridge operator console</p>
          <h1>{monthLabel}</h1>
          <p>Everyone&rsquo;s sessions and events. You can only edit your own.</p>
        </div>
        <div className="sbc-actions">
          {profile?.isAdmin && (
            <Link href="/admin" className="sbc-btn">Admin</Link>
          )}
          <button
            type="button"
            className={`sbc-btn${mineOnly ? " is-accent" : ""}`}
            onClick={() => setMineOnly((v) => !v)}
          >
            {mineOnly ? "Showing mine" : "Showing everyone"}
          </button>
          <button
            type="button"
            className="sbc-btn"
            onClick={() => {
              const d = new Date(year, month - 1, 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth());
            }}
          >
            ‹ Prev
          </button>
          <button
            type="button"
            className="sbc-btn"
            onClick={() => {
              setYear(today.getFullYear());
              setMonth(today.getMonth());
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="sbc-btn"
            onClick={() => {
              const d = new Date(year, month + 1, 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth());
            }}
          >
            Next ›
          </button>
          <button type="button" className="sbc-btn is-primary" onClick={() => openNew(new Date())}>
            + Add
          </button>
        </div>
      </div>

      {err && !draft && <div className="sbc-notice">{err}</div>}

      <div>
        <div className="sbc-cal-head">
          {DAY_LABELS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="sbc-cal">
          {days.map((d) => {
            const key = dayKey(d);
            const list = byDay.get(key) ?? [];
            const outside = d.getMonth() !== month;
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                className={`sbc-day${outside ? " is-outside" : ""}${key === todayKey ? " is-today" : ""}`}
                onClick={() => openNew(d)}
                onKeyDown={(ev) => {
                  if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) {
                    ev.preventDefault();
                    openNew(d);
                  }
                }}
                aria-label={`Add an entry on ${d.toDateString()}`}
              >
                <span className="sbc-day-num">{d.getDate()}</span>
                {list.slice(0, CHIPS_PER_DAY).map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    className={`sbc-chip${e.kind === "event" ? " is-event" : ""}${
                      e.tutorId === user.id ? " is-mine" : ""
                    }`}
                    title={`${e.title} · ${e.tutorName ?? "tutor"}${
                      e.studentName ? ` with ${e.studentName}` : ""
                    }`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openExisting(e);
                    }}
                  >
                    <time>{timeOfDay(e.startsAt)}</time>
                    {e.title}
                  </button>
                ))}
                {list.length > CHIPS_PER_DAY && (
                  <span className="sbc-more">+{list.length - CHIPS_PER_DAY} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sbc-panel">
        <div className="sbc-panel-head">
          <h2>Next up</h2>
          <span className="sbc-meta">{loadingData ? "loading…" : `${events.length} this view`}</span>
        </div>
        <div className="sbc-panel-body is-flush sbc-table-wrap">
          {upcoming.length === 0 ? (
            <div className="sbc-empty">
              <strong>Nothing scheduled</strong>
              <p>Click any day to add a session or an event.</p>
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
                {upcoming.map((e) => (
                  <tr key={e.id} onClick={() => openExisting(e)}>
                    <td className="sbc-num">
                      {new Date(e.startsAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      {timeOfDay(e.startsAt)}
                    </td>
                    <td>
                      <strong>{e.title}</strong>
                      <small>
                        <span className={`sbc-pill${e.kind === "session" ? " is-ok" : " is-warn"}`}>
                          {e.kind}
                        </span>
                        {e.location ? ` ${e.location}` : ""}
                      </small>
                    </td>
                    <td>{e.tutorName ?? "—"}</td>
                    <td>{e.studentName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {draft && (
        <div className="sbc-modal-back" onClick={closeModal} role="presentation">
          <div
            className={`sbc-modal ${consoleFontClass}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit calendar entry" : "New calendar entry"}
          >
            <h2>{editing ? "Edit entry" : "New entry"}</h2>

            {editing && !editable && (
              <div className="sbc-notice is-info">
                This is {editing.tutorName ?? "another tutor"}&rsquo;s entry, so it is read-only for
                you.
              </div>
            )}
            {err && <div className="sbc-notice">{err}</div>}

            <label className="sbc-field">
              <span>Title</span>
              <input
                value={draft.title}
                disabled={!editable}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Algebra 1 session"
                maxLength={120}
              />
            </label>

            <div className="sbc-field-row">
              <label className="sbc-field">
                <span>Kind</span>
                <select
                  value={draft.kind}
                  disabled={!editable}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as EventKind })}
                >
                  <option value="session">Tutoring session</option>
                  <option value="event">Event</option>
                </select>
              </label>
              <label className="sbc-field">
                <span>Student</span>
                <select
                  value={draft.studentId ?? ""}
                  disabled={!editable}
                  onChange={(e) => setDraft({ ...draft, studentId: e.target.value || null })}
                >
                  <option value="">No student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="sbc-field-row">
              <label className="sbc-field">
                <span>Starts</span>
                <input
                  type="datetime-local"
                  disabled={!editable}
                  value={toLocalInput(new Date(draft.startsAt))}
                  onChange={(e) => {
                    const next = new Date(e.target.value);
                    if (Number.isNaN(next.getTime())) return;
                    const span = new Date(draft.endsAt).getTime() - new Date(draft.startsAt).getTime();
                    setDraft({
                      ...draft,
                      startsAt: next.toISOString(),
                      endsAt: new Date(next.getTime() + Math.max(span, 60_000)).toISOString(),
                    });
                  }}
                />
              </label>
              <label className="sbc-field">
                <span>Ends</span>
                <input
                  type="datetime-local"
                  disabled={!editable}
                  value={toLocalInput(new Date(draft.endsAt))}
                  onChange={(e) => {
                    const next = new Date(e.target.value);
                    if (Number.isNaN(next.getTime())) return;
                    setDraft({ ...draft, endsAt: next.toISOString() });
                  }}
                />
              </label>
            </div>

            <label className="sbc-field">
              <span>Where</span>
              <input
                value={draft.location ?? ""}
                disabled={!editable}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Room link, library, class period…"
                maxLength={200}
              />
            </label>

            <label className="sbc-field">
              <span>Notes</span>
              <textarea
                value={draft.notes ?? ""}
                disabled={!editable}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="What to cover, what to bring…"
                maxLength={2000}
              />
            </label>

            <div className="sbc-modal-foot">
              {editing && editable && (
                <button type="button" className="sbc-btn is-danger" disabled={busy} onClick={() => void remove()}>
                  Delete
                </button>
              )}
              <span className="sbc-spacer" />
              <button type="button" className="sbc-btn" onClick={closeModal}>
                {editable ? "Cancel" : "Close"}
              </button>
              {editable && (
                <button type="button" className="sbc-btn is-primary" disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : editing ? "Save" : "Add"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
