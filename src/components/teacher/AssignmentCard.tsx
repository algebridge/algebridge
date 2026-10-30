"use client";

import { useState } from "react";
import { units } from "@/data/curriculum";
import { Icon } from "@/components/Icon";
import { showToast } from "@/lib/notify";
import { assignmentProgress, assignmentSubtitle, assignmentTitle, dueLabel } from "@/lib/assignments";
import { createAssignment, updateAssignment } from "@/lib/teacher";
import type { ClassAssignment, ClassInfo, RosterStudent } from "@/types";

/** yyyy-mm-dd for a local date. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A due date moved by some days, counting from the current one, or from today when there is none. */
export function shiftDay(from: string | null, days: number): string {
  const d = from ? new Date(`${from}T12:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
}

/** Names teachers can start from, so an assignment reads like their class, not a table of contents. */
export const TITLE_IDEAS = ["Warm-up", "Homework", "Quiz review", "Challenge round", "Catch-up", "Bell ringer", "Test prep", "Extra credit"];

/**
 * One assignment on the teacher's list: what it is and who finished it, and
 * everything about it the teacher can change in place. The name, the
 * instructions, the due date (with quick pushes), what it covers, a copy in
 * this class or another one.
 */
export function AssignmentCard({
  assignment: a,
  classInfo,
  roster,
  otherClasses,
  first,
  last,
  onMove,
  onDelete,
  onChanged,
}: {
  assignment: ClassAssignment;
  classInfo: ClassInfo;
  roster: RosterStudent[];
  otherClasses: ClassInfo[];
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showWho, setShowWho] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [title, setTitle] = useState(a.title ?? "");
  const [note, setNote] = useState(a.note ?? "");
  const [dueDate, setDueDate] = useState(a.dueDate ?? "");
  const [unitId, setUnitId] = useState(a.unitId);
  const [skillId, setSkillId] = useState(a.skillId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const due = dueLabel(a.dueDate);
  const progress = roster.map((s) => ({ s, p: assignmentProgress(s.progress, a) }));
  const done = progress.filter((r) => r.p.complete);
  const notDone = progress.filter((r) => !r.p.complete).sort((x, y) => y.p.percent - x.p.percent);
  const unit = units.find((u) => u.id === unitId);

  function startEdit() {
    setTitle(a.title ?? "");
    setNote(a.note ?? "");
    setDueDate(a.dueDate ?? "");
    setUnitId(a.unitId);
    setSkillId(a.skillId ?? "");
    setError("");
    setEditing(true);
  }

  async function save(changes: Parameters<typeof updateAssignment>[1], toast?: string) {
    setBusy(true);
    setError("");
    const err = await updateAssignment(a.id, changes);
    setBusy(false);
    if (err) {
      setError(err);
      return false;
    }
    if (toast) showToast({ icon: "check", tone: "success", title: toast, description: assignmentTitle({ ...a, ...changes } as ClassAssignment) });
    onChanged();
    return true;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const ok = await save({ title, note, dueDate: dueDate || null, unitId, skillId: skillId || null }, "Saved");
    if (ok) setEditing(false);
  }

  async function copyTo(target: ClassInfo, label: string) {
    setBusy(true);
    const err = await createAssignment({
      classId: target.id,
      unitId: a.unitId,
      skillId: a.skillId,
      title: target.id === classInfo.id && a.title ? `${a.title} (copy)` : a.title,
      note: a.note,
      dueDate: a.dueDate,
    });
    setBusy(false);
    setCopyOpen(false);
    if (err) {
      setError(err);
      return;
    }
    showToast({ icon: "check", tone: "success", title: label, description: `${assignmentTitle(a)} is on ${target.name}'s list.` });
    if (target.id === classInfo.id) onChanged();
  }

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col gap-1 pt-0.5">
          <IconButton label="Move up" icon="chevron-up" disabled={first} onClick={() => onMove(-1)} />
          <IconButton label="Move down" icon="chevron-down" disabled={last} onClick={() => onMove(1)} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-900">{assignmentTitle(a)}</p>
          <p className="text-xs text-slate-500">
            {a.title ? `${assignmentTitle({ ...a, title: null })} · ` : ""}
            {assignmentSubtitle(a)}
          </p>
          {a.note && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{a.note}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={
                due.tone === "overdue"
                  ? "badge bg-red-50 text-red-700 ring-1 ring-inset ring-red-100"
                  : due.tone === "today" || due.tone === "soon"
                    ? "badge-warn"
                    : "badge-neutral"
              }
            >
              {due.text}
            </span>
            <button
              type="button"
              onClick={() => setShowWho((v) => !v)}
              aria-expanded={showWho}
              className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              {done.length} of {roster.length} finished
            </button>
            {!editing && (
              <span className="flex flex-wrap gap-1">
                <QuickButton disabled={busy} onClick={() => save({ dueDate: shiftDay(a.dueDate, 1) }, "Due date moved")}>
                  +1 day
                </QuickButton>
                <QuickButton disabled={busy} onClick={() => save({ dueDate: shiftDay(a.dueDate, 7) }, "Due date moved")}>
                  +1 week
                </QuickButton>
                {a.dueDate && (
                  <QuickButton disabled={busy} onClick={() => save({ dueDate: null }, "Due date cleared")}>
                    No due date
                  </QuickButton>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="Edit assignment" icon="pen" onClick={() => (editing ? setEditing(false) : startEdit())} />
          <div className="relative">
            <IconButton label="Copy assignment" icon="copy" onClick={() => setCopyOpen((v) => !v)} />
            {copyOpen && (
              <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-slate-200 bg-surface p-1 shadow-panel">
                <MenuItem onClick={() => copyTo(classInfo, "Duplicated")}>Duplicate in this class</MenuItem>
                {otherClasses.length > 0 && <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Copy to</p>}
                {otherClasses.map((c) => (
                  <MenuItem key={c.id} onClick={() => copyTo(c, "Copied")}>
                    {c.name}
                    {c.period ? ` · ${c.period}` : ""}
                  </MenuItem>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Remove assignment"
            className="rounded p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      {showWho && (
        <div className="ml-10 mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
          <WhoList title={`Still working (${notDone.length})`} rows={notDone.map((r) => ({ id: r.s.id, name: r.s.displayName ?? "Unnamed", detail: `${r.p.done}/${r.p.total}` }))} />
          <WhoList title={`Finished (${done.length})`} rows={done.map((r) => ({ id: r.s.id, name: r.s.displayName ?? "Unnamed", detail: "Done" }))} />
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} className="ml-10 mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor={`title-${a.id}`} className="label">
              Name it <span className="font-normal text-slate-400">(blank uses the skill&apos;s name)</span>
            </label>
            <input
              id={`title-${a.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder={assignmentTitle({ ...a, title: null })}
              className="field mt-1"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {TITLE_IDEAS.map((idea) => (
                <QuickButton key={idea} onClick={() => setTitle(idea)}>
                  {idea}
                </QuickButton>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor={`note-${a.id}`} className="label">
              Instructions for students
            </label>
            <textarea
              id={`note-${a.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Show your work in the notebook. Watch the video first if you get stuck."
              className="field mt-1"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`unit-${a.id}`} className="label">
                Unit
              </label>
              <select
                id={`unit-${a.id}`}
                value={unitId}
                onChange={(e) => {
                  setUnitId(e.target.value);
                  setSkillId("");
                }}
                className="field mt-1"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.number}: {u.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`skill-${a.id}`} className="label">
                What it covers
              </label>
              <select id={`skill-${a.id}`} value={skillId} onChange={(e) => setSkillId(e.target.value)} className="field mt-1">
                <option value="">Whole unit ({unit?.skills.length ?? 0} skills)</option>
                {unit?.skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor={`due-${a.id}`} className="label">
              Due date
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input id={`due-${a.id}`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field max-w-[11rem]" />
              <QuickButton onClick={() => setDueDate(isoDay(new Date()))}>Today</QuickButton>
              <QuickButton onClick={() => setDueDate(shiftDay(null, 1))}>Tomorrow</QuickButton>
              <QuickButton onClick={() => setDueDate(shiftDay(dueDate || null, 7))}>+1 week</QuickButton>
              <QuickButton onClick={() => setDueDate("")}>None</QuickButton>
            </div>
          </div>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
      {!editing && error && (
        <p role="alert" className="field-error ml-10 mt-2">
          {error}
        </p>
      )}
    </li>
  );
}

function IconButton({ label, icon, onClick, disabled }: { label: string; icon: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon name={icon as Parameters<typeof Icon>[0]["name"]} size={16} />
    </button>
  );
}

export function QuickButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-slate-200 bg-surface px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-bridge-300 hover:text-bridge-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full truncate rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">
      {children}
    </button>
  );
}

function WhoList({ title, rows }: { title: string; rows: { id: string; name: string; detail: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-700">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Nobody yet</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-2 text-xs text-slate-600">
              <span className="truncate">{r.name}</span>
              <span className="shrink-0 text-slate-400">{r.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
