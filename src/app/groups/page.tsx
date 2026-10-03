"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { createAlgeGroup, listMyGroups } from "@/lib/groups";
import { listAllStudents } from "@/lib/social";
import type { GroupInfo, StudentDirectoryEntry } from "@/types";
import { Icon } from "@/components/Icon";
import { useDialogFocus } from "@/components/useDialogFocus";

export default function GroupsPage() {
  const { user, profile, loading } = useAuth();
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [students, setStudents] = useState<StudentDirectoryEntry[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // The New AlgeGroup dialog: focus moves in, Tab stays inside, Escape closes,
  // and focus goes back to the button that opened it.
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, creating, () => setCreating(false));

  const isTutor = profile?.role === "tutor" || (profile?.isAdmin ?? false);

  async function refresh() {
    setGroups(await listMyGroups());
    setLoadingList(false);
  }

  useEffect(() => {
    if (!user) return;
    refresh();
  }, [user]);

  async function openCreate() {
    setCreating(true);
    setErr("");
    if (students.length === 0) setStudents(await listAllStudents());
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitCreate() {
    setBusy(true);
    setErr("");
    const { error } = await createAlgeGroup(name.trim() || "AlgeGroup", [...picked]);
    setBusy(false);
    if (error) return setErr(error);
    setCreating(false);
    setName("");
    setPicked(new Set());
    await refresh();
  }

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Group Chats</h1>
        <p className="text-slate-600">Sign in to join group chats and AlgeGroups.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Group Chats</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isTutor
              ? "The All-Tutors room, plus AlgeGroups you run with your students."
              : "AlgeGroups your tutor added you to."}
          </p>
        </div>
        {isTutor && (
          <button type="button" onClick={openCreate} className="btn-primary text-sm">
            + New AlgeGroup
          </button>
        )}
      </div>

      {loadingList ? (
        <p className="text-center text-slate-500">Loading groups…</p>
      ) : groups.length === 0 ? (
        <div className="card text-center text-slate-600">
          You&apos;re not in any groups yet.
          {isTutor && " Create an AlgeGroup to tutor several students at once."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bridge-100 text-bridge-700" aria-hidden>
                  <Icon name={g.kind === "all_tutors" ? "tutors" : "groups"} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{g.name}</p>
                    {g.kind === "all_tutors" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        All Tutors
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{g.memberCount ?? 1} members</p>
                </div>
                <Icon name="arrow-right" size={16} className="text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Create AlgeGroup modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreating(false)}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-group-title"
            aria-describedby="new-group-help"
            className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div className="min-w-0 flex-1">
                <h2 id="new-group-title" className="font-bold text-slate-900">New AlgeGroup</h2>
                <p id="new-group-help" className="text-xs text-slate-600">A group of students you tutor together.</p>
                <label htmlFor="new-group-name" className="mt-3 block text-xs font-semibold text-slate-700">
                  Group name
                </label>
                <input
                  id="new-group-name"
                  data-autofocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Period 3 Algebra"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
                />
              </div>
              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div data-lenis-prevent className="max-h-64 overflow-y-auto p-2" role="group" aria-label="Students to add">
              {students.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">No students found.</p>
              ) : (
                students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={picked.has(s.id)}
                    onClick={() => toggle(s.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
                      picked.has(s.id) ? "bg-bridge-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <Avatar name={s.displayName} url={s.avatarUrl} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                      {s.displayName ?? s.email}
                    </span>
                    <span className={picked.has(s.id) ? "text-bridge-600" : "text-slate-500"} aria-hidden>
                      <Icon name={picked.has(s.id) ? "check" : "plus"} size={16} />
                    </span>
                  </button>
                ))
              )}
            </div>
            {err && <p role="alert" className="px-4 text-sm text-red-700">{err}</p>}
            <div className="flex gap-2 border-t border-slate-100 p-4">
              <button type="button" onClick={() => setCreating(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="button" onClick={submitCreate} disabled={busy} className="btn-primary flex-1">
                {busy ? "Creating…" : `Create (${picked.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
