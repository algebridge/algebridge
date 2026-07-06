"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  addStudentToClass,
  createClass,
  deleteClass,
  findStudentByEmail,
  getClassRoster,
  getMyClasses,
  removeStudentFromClass,
} from "@/lib/teacher";
import type { ClassInfo, RosterStudent } from "@/types";

export default function TeacherDashboardPage() {
  const { user, profile, configured, loading, switchRole } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isTeacher = profile?.role === "teacher";

  async function refreshClasses(reselectId?: string) {
    setClassesLoading(true);
    const list = await getMyClasses();
    setClasses(list);
    setClassesLoading(false);
    if (reselectId) {
      setSelectedClass(list.find((c) => c.id === reselectId) ?? null);
    } else if (selectedClass) {
      setSelectedClass(list.find((c) => c.id === selectedClass.id) ?? null);
    }
  }

  useEffect(() => {
    if (isTeacher) refreshClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreating(true);
    setError("");
    const { error: createError } = await createClass(newClassName.trim());
    setCreating(false);
    if (createError) {
      setError(createError);
      return;
    }
    setNewClassName("");
    await refreshClasses();
  }

  async function handleDeleteClass(classId: string) {
    if (!confirm("Delete this class? Students will be removed from the roster.")) return;
    await deleteClass(classId);
    setSelectedClass(null);
    await refreshClasses();
  }

  if (loading) {
    return <p className="text-center text-slate-500">Loading…</p>;
  }

  if (!configured) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <span className="text-4xl">🧑‍🏫</span>
        <h1 className="font-display text-2xl tracking-wide text-slate-900">Teacher Dashboard</h1>
        <div className="card text-left">
          <p className="text-sm text-amber-900">
            Teacher tools need cloud accounts to track students across devices, and
            cloud login isn&apos;t configured yet on this deployment. Once Supabase
            keys are added (see <code>supabase/schema.sql</code>), this page will let
            you create classes, invite students, and track their progress.
          </p>
        </div>
        <Link href="/" className="btn-secondary inline-flex">
          Back to Course
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <span className="text-4xl">🧑‍🏫</span>
        <h1 className="font-display text-2xl tracking-wide text-slate-900">Teacher Dashboard</h1>
        <p className="text-slate-600">Sign in with a teacher account to manage classes.</p>
        <Link href="/login" className="btn-primary inline-flex">
          Sign In →
        </Link>
      </div>
    );
  }

  if (!isTeacher) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <span className="text-4xl">🧑‍🏫</span>
        <h1 className="font-display text-2xl tracking-wide text-slate-900">Teacher Dashboard</h1>
        <p className="text-slate-600">
          Your account is currently set up as a student. Switch to a teacher account
          to create classes and track student progress.
        </p>
        <button
          type="button"
          onClick={() => switchRole("teacher")}
          className="btn-primary inline-flex"
        >
          Switch to a Teacher Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-wide text-slate-900">🧑‍🏫 Teacher Dashboard</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Create a class, share the join code with students (or add them by email),
          and track their progress through AlgeBridge.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-bold text-slate-900">Create a Class</h2>
            <form onSubmit={handleCreateClass} className="mt-3 flex gap-2">
              <label htmlFor="new-class-name" className="sr-only">
                Class name
              </label>
              <input
                id="new-class-name"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g. Period 3 Algebra"
                aria-label="Class name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
              />
              <button type="submit" disabled={creating} className="btn-primary shrink-0 text-sm">
                + Add
              </button>
            </form>
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-900">My Classes</h2>
            {classesLoading ? (
              <p className="mt-3 text-sm text-slate-500">Loading classes…</p>
            ) : classes.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No classes yet — create one above to get started.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {classes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedClass(c)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                        selectedClass?.id === c.id
                          ? "border-bridge-500 bg-bridge-50"
                          : "border-slate-200 hover:border-bridge-300"
                      }`}
                    >
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          {selectedClass ? (
            <ClassRoster
              classInfo={selectedClass}
              onRosterChanged={() => refreshClasses(selectedClass.id)}
              onDeleteClass={() => handleDeleteClass(selectedClass.id)}
            />
          ) : (
            <div className="card flex h-full min-h-[200px] items-center justify-center text-center text-slate-500">
              Select a class on the left (or create one) to see its roster.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ClassRoster({
  classInfo,
  onRosterChanged,
  onDeleteClass,
}: {
  classInfo: ClassInfo;
  onRosterChanged: () => void;
  onDeleteClass: () => void;
}) {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    setRosterLoading(true);
    const data = await getClassRoster(classInfo.id);
    setRoster(data);
    setRosterLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classInfo.id]);

  async function handleFindStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchStatus("");
    const student = await findStudentByEmail(searchEmail.trim());
    if (!student) {
      setSearchStatus("No student account found with that email. They may need to sign up first.");
      setSearching(false);
      return;
    }
    const addError = await addStudentToClass(classInfo.id, student.id);
    setSearching(false);
    if (addError) {
      setSearchStatus(addError.includes("duplicate") ? "That student is already in this class." : addError);
      return;
    }
    setSearchStatus(`Added ${student.displayName ?? student.email ?? "student"}!`);
    setSearchEmail("");
    await load();
    onRosterChanged();
  }

  async function handleRemove(studentId: string, studentLabel: string) {
    if (!confirm(`Remove ${studentLabel} from ${classInfo.name}? You can always re-add them later.`)) return;
    await removeStudentFromClass(classInfo.id, studentId);
    await load();
    onRosterChanged();
  }

  function copyCode() {
    navigator.clipboard.writeText(classInfo.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{classInfo.name}</h2>
          <p className="text-sm text-slate-500">
            {roster.length} student{roster.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyCode}
            title="Copy join code"
            aria-label={`Copy join code ${classInfo.joinCode} to clipboard`}
            className="flex items-center gap-2 rounded-xl border border-dashed border-bridge-300 bg-bridge-50 px-3 py-1.5 text-sm font-mono font-bold tracking-widest text-bridge-700"
          >
            {classInfo.joinCode} {copied ? "✓" : "⧉"}
          </button>
          <button
            type="button"
            onClick={onDeleteClass}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Delete class
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Find a Student
        </p>
        <form onSubmit={handleFindStudent} className="mt-2 flex gap-2">
          <input
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="student@school.edu"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          />
          <button type="submit" disabled={searching} className="btn-secondary shrink-0 text-sm">
            Add to Class
          </button>
        </form>
        {searchStatus && <p className="mt-2 text-xs text-slate-600">{searchStatus}</p>}
        <p className="mt-2 text-xs text-slate-400">
          Or just share the join code above — students can add themselves from their
          Account page.
        </p>
      </div>

      {rosterLoading ? (
        <p className="text-sm text-slate-500">Loading roster…</p>
      ) : roster.length === 0 ? (
        <p className="text-sm text-slate-500">
          No students yet. Share the join code or add one by email above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Student</th>
                <th className="py-2 pr-3">Progress</th>
                <th className="py-2 pr-3">Level</th>
                <th className="py-2 pr-3">Streak</th>
                <th className="py-2 pr-3">Problems Solved</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {roster.map((student) => (
                <tr key={student.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-slate-900">
                      {student.displayName ?? "Student"}
                    </p>
                    <p className="text-xs text-slate-500">{student.email}</p>
                  </td>
                  <td className="py-3 pr-3">
                    {student.stats ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${student.stats.percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">
                          {student.stats.percent}% ({student.stats.completedSkills}/
                          {student.stats.totalSkills})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No activity yet</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {student.stats ? `Lvl ${student.stats.level}` : "—"}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {student.stats ? `🔥 ${student.stats.streak}` : "—"}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600">
                    {student.stats?.problemsSolved ?? 0}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(student.id, student.displayName ?? student.email ?? "this student")}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
