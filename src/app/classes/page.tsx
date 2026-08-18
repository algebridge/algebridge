"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { getProgress } from "@/lib/progress";
import { getMyClassesAsStudent, joinClassByCode, leaveClass, type StudentClass } from "@/lib/teacher";
import {
  assignmentHref,
  assignmentProgress,
  assignmentSubtitle,
  assignmentTitle,
  dueLabel,
} from "@/lib/assignments";
import { Icon } from "@/components/Icon";
import type { ClassAssignment, UserProgress } from "@/types";

export default function StudentClassesPage() {
  const { user, configured, loading } = useAuth();
  const { stats } = useProgress();
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setListLoading(true);
    setClasses(await getMyClassesAsStudent());
    setListLoading(false);
  }, []);

  useEffect(() => {
    if (user) load();
    else setListLoading(false);
  }, [user, load]);

  // Progress lives in localStorage; re-read it whenever the course stats change
  // so assignment completion stays in step with practice.
  useEffect(() => {
    setProgress(getProgress());
  }, [stats.completedSkills, stats.problemsSolved]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    setStatus(null);
    const { className, error } = await joinClassByCode(code.trim());
    setJoining(false);
    if (error) {
      setStatus({ ok: false, text: error });
      return;
    }
    setStatus({ ok: true, text: `You joined ${className}. Your teacher can see your progress now.` });
    setCode("");
    load();
  }

  async function handleLeave(cls: StudentClass) {
    if (!confirm(`Leave ${cls.name}? Your progress stays with you, but your teacher won't see it.`))
      return;
    await leaveClass(cls.id);
    load();
  }

  if (loading) return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;

  if (!configured || !user) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="page-title">Join your class</h1>
        <p className="page-subtitle mx-auto">
          Sign in with your AlgeBridge account, then enter the 6-character code
          your teacher gave you. Your practice will show up on their roster.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/login" className="btn-primary">
            Create free account
          </Link>
          <Link href="/login?mode=signin" className="btn-secondary">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Classroom</p>
        <h1 className="page-title">My classes</h1>
        <p className="page-subtitle">
          Everything your teacher has assigned, in the order they want you to work
          through it.
        </p>
      </header>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Join a class</p>
        </div>
        <div className="p-5">
          <form onSubmit={handleJoin} className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="join-code" className="label">
                Class code
              </label>
              <input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                className="field mt-1 w-40 font-mono text-base uppercase tracking-[0.25em]"
              />
            </div>
            <button type="submit" disabled={joining} className="btn-primary">
              {joining ? "Joining…" : "Join class"}
            </button>
          </form>
          {status && (
            <p className={`mt-3 text-sm ${status.ok ? "text-emerald-700" : "text-red-600"}`}>
              {status.text}
            </p>
          )}
        </div>
      </div>

      {listLoading ? (
        <p className="text-sm text-slate-500">Loading your classes…</p>
      ) : classes.length === 0 ? (
        <div className="card text-center">
          <h2 className="text-base font-semibold text-slate-900">You&apos;re not in a class yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            That&apos;s fine — you can work through the whole course on your own. If
            your teacher gives you a code, enter it above.
          </p>
          <Link href="/" className="btn-primary mt-5 inline-flex">
            Go to the course
          </Link>
        </div>
      ) : (
        classes.map((cls) => (
          <ClassPanel
            key={cls.id}
            cls={cls}
            progress={progress}
            onLeave={() => handleLeave(cls)}
          />
        ))
      )}
    </div>
  );
}

function ClassPanel({
  cls,
  progress,
  onLeave,
}: {
  cls: StudentClass;
  progress: UserProgress | null;
  onLeave: () => void;
}) {
  const done = cls.assignments.filter((a) => assignmentProgress(progress, a).complete).length;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-title">{cls.name}</p>
          {cls.period && <p className="text-xs text-slate-500">{cls.period}</p>}
        </div>
        <div className="flex items-center gap-3">
          {cls.assignments.length > 0 && (
            <span className="text-xs text-slate-500">
              {done} of {cls.assignments.length} assignments done
            </span>
          )}
          <button
            type="button"
            onClick={onLeave}
            className="text-xs text-slate-400 transition hover:text-red-600"
          >
            Leave
          </button>
        </div>
      </div>

      {cls.assignments.length === 0 ? (
        <p className="px-5 py-5 text-sm text-slate-500">
          Nothing assigned yet. Keep going through the course at your own pace.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {cls.assignments.map((a) => (
            <AssignmentRow key={a.id} assignment={a} progress={progress} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AssignmentRow({
  assignment,
  progress,
}: {
  assignment: ClassAssignment;
  progress: UserProgress | null;
}) {
  const p = assignmentProgress(progress, assignment);
  const due = dueLabel(assignment.dueDate);

  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          p.complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
        }`}
      >
        <Icon name={p.complete ? "check" : "clock"} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{assignmentTitle(assignment)}</p>
        <p className="text-xs text-slate-500">{assignmentSubtitle(assignment)}</p>
        {assignment.note && (
          <p className="mt-1 text-xs italic text-slate-500">{assignment.note}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={
              p.complete
                ? "badge-success"
                : due.tone === "overdue"
                  ? "badge bg-red-50 text-red-700 ring-1 ring-inset ring-red-100"
                  : due.tone === "today" || due.tone === "soon"
                    ? "badge-warn"
                    : "badge-neutral"
            }
          >
            {p.complete ? "Complete" : due.text}
          </span>
          {p.total > 1 && (
            <span className="text-xs text-slate-500">
              {p.done} of {p.total} skills
            </span>
          )}
        </div>
      </div>
      <Link
        href={assignmentHref(assignment)}
        className={p.complete ? "btn-secondary btn-sm shrink-0" : "btn-primary btn-sm shrink-0"}
      >
        {p.complete ? "Review" : p.done > 0 ? "Continue" : "Start"}
      </Link>
    </li>
  );
}
