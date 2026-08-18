"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { units } from "@/data/curriculum";
import {
  addStudentsByEmail,
  createAssignment,
  createClass,
  deleteAssignment,
  deleteClass,
  getClassAssignments,
  getClassRoster,
  getMyClasses,
  removeStudentFromClass,
  reorderAssignments,
  reorderClasses,
  updateClass,
  type BulkAddResult,
} from "@/lib/teacher";
import {
  assignmentProgress,
  assignmentSubtitle,
  assignmentTitle,
  dueLabel,
} from "@/lib/assignments";
import { Icon } from "@/components/Icon";
import type { ClassAssignment, ClassColor, ClassInfo, RosterStudent } from "@/types";

const COLOR_OPTIONS: { value: ClassColor; label: string; dot: string; soft: string }[] = [
  { value: "blue", label: "Blue", dot: "bg-bridge-500", soft: "bg-bridge-50 text-bridge-700" },
  { value: "emerald", label: "Green", dot: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700" },
  { value: "amber", label: "Amber", dot: "bg-amber-500", soft: "bg-amber-50 text-amber-800" },
  { value: "violet", label: "Violet", dot: "bg-violet-500", soft: "bg-violet-50 text-violet-700" },
  { value: "rose", label: "Rose", dot: "bg-rose-500", soft: "bg-rose-50 text-rose-700" },
  { value: "slate", label: "Grey", dot: "bg-slate-400", soft: "bg-slate-100 text-slate-700" },
];

const GRADE_OPTIONS = ["7th grade", "8th grade", "9th grade", "10th grade", "Mixed"];

function colorDot(color: ClassColor): string {
  return COLOR_OPTIONS.find((c) => c.value === color)?.dot ?? "bg-bridge-500";
}

type Tab = "roster" | "assignments" | "settings";

export default function TeacherDashboardPage() {
  const { user, profile, configured, loading } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [tab, setTab] = useState<Tab>("roster");
  const [error, setError] = useState("");

  const isTeacher = profile?.role === "teacher";

  const refreshClasses = useCallback(
    async (selectId?: string) => {
      setClassesLoading(true);
      const list = await getMyClasses({ includeArchived: true });
      setClasses(list);
      setClassesLoading(false);
      setSelectedId((current) => {
        const next = selectId ?? current;
        if (next && list.some((c) => c.id === next)) return next;
        return list.find((c) => !c.archived)?.id ?? list[0]?.id ?? null;
      });
    },
    []
  );

  useEffect(() => {
    if (isTeacher) refreshClasses();
  }, [isTeacher, refreshClasses]);

  const visibleClasses = useMemo(
    () => classes.filter((c) => showArchived || !c.archived),
    [classes, showArchived]
  );
  const selectedClass = classes.find((c) => c.id === selectedId) ?? null;
  const archivedCount = classes.filter((c) => c.archived).length;

  async function handleMove(classId: string, direction: -1 | 1) {
    const ordered = [...classes].sort((a, b) => a.position - b.position);
    // Swap with the neighbour the teacher can actually see: when archived
    // classes are hidden, hopping over one would look like nothing happened.
    const visibleOrder = ordered.filter((c) => showArchived || !c.archived);
    const visibleIndex = visibleOrder.findIndex((c) => c.id === classId);
    const neighbour = visibleOrder[visibleIndex + direction];
    if (visibleIndex < 0 || !neighbour) return;
    const from = ordered.findIndex((c) => c.id === classId);
    const to = ordered.findIndex((c) => c.id === neighbour.id);
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    // Optimistic: renumber locally so the list doesn't jump while saving.
    setClasses(ordered.map((c, i) => ({ ...c, position: i + 1 })));
    const err = await reorderClasses(ordered.map((c) => c.id));
    if (err) {
      setError(err);
      await refreshClasses();
    } else {
      setError("");
    }
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  if (!configured) {
    return (
      <EmptyState
        title="Teacher tools need cloud accounts"
        body="Classes and rosters live in the cloud so progress follows students between devices. This deployment doesn't have Supabase keys configured yet."
      />
    );
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to manage your classes"
        body="Teacher accounts create classes, invite students by email or join code, and track progress skill by skill."
        action={
          <Link href="/login?mode=signin" className="btn-primary">
            Sign in
          </Link>
        }
      />
    );
  }

  if (!isTeacher) {
    return (
      <EmptyState
        title="This account isn't a teacher account"
        body="Teacher accounts are verified with an access code so students stay safe. Enter your code on the account page to switch."
        action={
          <Link href="/login" className="btn-primary">
            Go to account settings
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Teaching</p>
          <h1 className="page-title">My classes</h1>
          <p className="page-subtitle">
            Create a class, share the join code, assign units with due dates, and
            watch every student&apos;s progress in one table.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>
            <strong className="text-slate-900">{classes.filter((c) => !c.archived).length}</strong>{" "}
            active {classes.filter((c) => !c.archived).length === 1 ? "class" : "classes"}
          </span>
          <span>
            <strong className="text-slate-900">
              {classes.reduce((sum, c) => sum + c.studentCount, 0)}
            </strong>{" "}
            students
          </span>
        </div>
      </header>

      {error && <p className="notice-error">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <NewClassForm onCreated={() => refreshClasses()} />

          <div className="panel">
            <div className="panel-head">
              <p className="panel-title">Class list</p>
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  {showArchived ? "Hide" : "Show"} archived ({archivedCount})
                </button>
              )}
            </div>
            {classesLoading ? (
              <p className="px-5 py-4 text-sm text-slate-500">Loading classes…</p>
            ) : visibleClasses.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">
                No classes yet. Create your first one above — it takes about ten
                seconds.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleClasses.map((c, i) => (
                  <li key={c.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition ${
                        selectedId === c.id ? "bg-bridge-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className={`h-8 w-1.5 shrink-0 rounded-full ${colorDot(c.color)}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={`truncate text-sm font-semibold ${
                              selectedId === c.id ? "text-bridge-800" : "text-slate-900"
                            }`}
                          >
                            {c.name}
                          </span>
                          {c.archived && <span className="badge-neutral shrink-0">Archived</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {[c.period, c.gradeLevel].filter(Boolean).join(" · ") || "No period set"}
                          {" · "}
                          {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 flex-col justify-center gap-0.5 pr-2">
                      <button
                        type="button"
                        onClick={() => handleMove(c.id, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${c.name} up`}
                        className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Icon name="chevron-up" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(c.id, 1)}
                        disabled={i === visibleClasses.length - 1}
                        aria-label={`Move ${c.name} down`}
                        className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Icon name="chevron-down" size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          {selectedClass ? (
            <ClassDetail
              key={selectedClass.id}
              classInfo={selectedClass}
              tab={tab}
              onTabChange={setTab}
              onChanged={() => refreshClasses(selectedClass.id)}
              onDeleted={() => {
                setSelectedId(null);
                refreshClasses();
              }}
            />
          ) : (
            <div className="card flex min-h-[220px] items-center justify-center text-center text-sm text-slate-500">
              Select a class on the left, or create one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle mx-auto">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create a class
// ---------------------------------------------------------------------------

function NewClassForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [color, setColor] = useState<ClassColor>("blue");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the class a name.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: createError } = await createClass({ name, period, gradeLevel, color });
    setSaving(false);
    if (createError) {
      setError(createError);
      return;
    }
    setName("");
    setPeriod("");
    setGradeLevel("");
    setColor("blue");
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary w-full">
        <Icon name="plus" size={16} />
        New class
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel">
      <div className="panel-head">
        <p className="panel-title">New class</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <label htmlFor="class-name" className="label">
            Class name
          </label>
          <input
            id="class-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Algebra 1"
            className="field mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="class-period" className="label">
              Period
            </label>
            <input
              id="class-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Period 3"
              className="field mt-1"
            />
          </div>
          <div>
            <label htmlFor="class-grade" className="label">
              Grade
            </label>
            <select
              id="class-grade"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="field mt-1"
            >
              <option value="">Not set</option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ColorPicker value={color} onChange={setColor} />
        {error && <p className="field-error">{error}</p>}
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? "Creating…" : "Create class"}
        </button>
      </div>
    </form>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: ClassColor;
  onChange: (c: ClassColor) => void;
}) {
  return (
    <div>
      <span className="label">Colour</span>
      <div className="mt-1.5 flex gap-2">
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-label={c.label}
            aria-pressed={value === c.value}
            className={`h-7 w-7 rounded-full ${c.dot} transition ${
              value === c.value
                ? "ring-2 ring-slate-900 ring-offset-2"
                : "opacity-60 hover:opacity-100"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Class detail
// ---------------------------------------------------------------------------

function ClassDetail({
  classInfo,
  tab,
  onTabChange,
  onChanged,
  onDeleted,
}: {
  classInfo: ClassInfo;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [assignmentsUnavailable, setAssignmentsUnavailable] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadRoster = useCallback(async () => {
    setRosterLoading(true);
    setRoster(await getClassRoster(classInfo.id));
    setRosterLoading(false);
  }, [classInfo.id]);

  const loadAssignments = useCallback(async () => {
    const { assignments: list, unavailable } = await getClassAssignments(classInfo.id);
    setAssignments(list);
    setAssignmentsUnavailable(unavailable);
  }, [classInfo.id]);

  useEffect(() => {
    loadRoster();
    loadAssignments();
  }, [loadRoster, loadAssignments]);

  function copyCode() {
    navigator.clipboard.writeText(classInfo.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "roster", label: "Roster", count: roster.length },
    { id: "assignments", label: "Assignments", count: assignments.length },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full ${colorDot(classInfo.color)}`} />
              <h2 className="truncate text-lg font-semibold text-slate-900">{classInfo.name}</h2>
              {classInfo.archived && <span className="badge-neutral">Archived</span>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[classInfo.period, classInfo.gradeLevel].filter(Boolean).join(" · ") ||
                "No period set"}
              {" · "}
              {roster.length} student{roster.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Join code
            </p>
            <button
              type="button"
              onClick={copyCode}
              title="Copy join code"
              aria-label={`Copy join code ${classInfo.joinCode}`}
              className="mt-1 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-base font-bold tracking-[0.2em] text-slate-900 transition hover:border-bridge-400 hover:bg-bridge-50"
            >
              {classInfo.joinCode}
              {copied ? (
                <Icon name="check" size={15} className="text-emerald-600" />
              ) : (
                <Icon name="copy" size={15} className="text-slate-400" />
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-1 border-t border-slate-200 px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? "border-bridge-600 text-bridge-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-xs text-slate-400">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "roster" && (
        <RosterTab
          classInfo={classInfo}
          roster={roster}
          loading={rosterLoading}
          onChanged={() => {
            loadRoster();
            onChanged();
          }}
        />
      )}

      {tab === "assignments" && (
        <AssignmentsTab
          classInfo={classInfo}
          assignments={assignments}
          roster={roster}
          unavailable={assignmentsUnavailable}
          onChanged={loadAssignments}
        />
      )}

      {tab === "settings" && (
        <SettingsTab classInfo={classInfo} onChanged={onChanged} onDeleted={onDeleted} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

type SortKey = "name" | "progress" | "active";

function RosterTab({
  classInfo,
  roster,
  loading,
  onChanged,
}: {
  classInfo: ClassInfo;
  roster: RosterStudent[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<BulkAddResult | null>(null);
  const [sort, setSort] = useState<SortKey>("name");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!emails.trim()) return;
    setAdding(true);
    setResult(null);
    const res = await addStudentsByEmail(classInfo.id, emails);
    setAdding(false);
    setResult(res);
    if (res.added.length > 0) {
      setEmails("");
      onChanged();
    }
  }

  async function handleRemove(student: RosterStudent) {
    const label = student.displayName ?? student.email ?? "this student";
    if (!confirm(`Remove ${label} from ${classInfo.name}? You can add them back later.`)) return;
    await removeStudentFromClass(classInfo.id, student.id);
    onChanged();
  }

  const sorted = useMemo(() => {
    const list = [...roster];
    if (sort === "progress") {
      list.sort((a, b) => (b.stats?.percent ?? -1) - (a.stats?.percent ?? -1));
    } else if (sort === "active") {
      list.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
    } else {
      list.sort((a, b) =>
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? "")
      );
    }
    return list;
  }, [roster, sort]);

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Add students</p>
        </div>
        <div className="space-y-3 p-5">
          <div className="notice-info">
            The fastest way: give students the join code{" "}
            <strong className="font-mono tracking-wider">{classInfo.joinCode}</strong> and have
            them enter it under <strong>My classes</strong>. They&apos;ll appear here
            automatically.
          </div>
          <form onSubmit={handleAdd} className="space-y-2">
            <label htmlFor="bulk-emails" className="label">
              Or paste their school emails
            </label>
            <textarea
              id="bulk-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={3}
              placeholder={"maria@school.edu\njordan@school.edu\nsam@school.edu"}
              className="field font-mono text-xs"
            />
            <p className="field-hint">
              One per line, or separated by commas — paste a whole column from your
              gradebook. Students must already have an AlgeBridge account.
            </p>
            <button type="submit" disabled={adding} className="btn-secondary">
              {adding ? "Adding…" : "Add to class"}
            </button>
          </form>

          {result && (
            <div className="space-y-1.5 text-sm">
              {result.added.length > 0 && (
                <p className="text-emerald-700">
                  Added {result.added.length}: {result.added.join(", ")}
                </p>
              )}
              {result.alreadyIn.length > 0 && (
                <p className="text-slate-500">Already in this class: {result.alreadyIn.join(", ")}</p>
              )}
              {result.notFound.length > 0 && (
                <p className="text-amber-700">
                  No account found for {result.notFound.join(", ")} — ask them to sign
                  up first, then add them again.
                </p>
              )}
              {result.failed.map((f) => (
                <p key={f.email} className="text-red-600">
                  {f.email}: {f.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Students</p>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="name">Name</option>
              <option value="progress">Progress</option>
              <option value="active">Last active</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-slate-500">Loading roster…</p>
        ) : sorted.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            No students yet. Share the join code above, or add them by email.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[680px]">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course progress</th>
                  <th>Level</th>
                  <th>Streak</th>
                  <th>Solved</th>
                  <th>Last active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <p className="font-medium text-slate-900">
                        {student.displayName ?? "Unnamed student"}
                      </p>
                      <p className="text-xs text-slate-500">{student.email}</p>
                    </td>
                    <td>
                      {student.stats ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${student.stats.percent}%` }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-xs text-slate-600">
                            {student.stats.percent}% ({student.stats.completedSkills}/
                            {student.stats.totalSkills})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No activity yet</span>
                      )}
                    </td>
                    <td className="text-xs">{student.stats ? student.stats.level : "—"}</td>
                    <td className="text-xs">
                      {student.stats?.streak ? `${student.stats.streak} days` : "—"}
                    </td>
                    <td className="text-xs">{student.stats?.problemsSolved ?? 0}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {formatRelative(student.lastActiveAt)}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleRemove(student)}
                        className="text-xs text-slate-400 transition hover:text-red-600"
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
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

function AssignmentsTab({
  classInfo,
  assignments,
  roster,
  unavailable,
  onChanged,
}: {
  classInfo: ClassInfo;
  assignments: ClassAssignment[];
  roster: RosterStudent[];
  unavailable: boolean;
  onChanged: () => void;
}) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [skillId, setSkillId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedUnit = units.find((u) => u.id === unitId);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const err = await createAssignment({
      classId: classInfo.id,
      unitId,
      skillId: skillId || null,
      dueDate: dueDate || null,
      note,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setSkillId("");
    setDueDate("");
    setNote("");
    onChanged();
  }

  async function handleDelete(assignment: ClassAssignment) {
    if (!confirm(`Remove "${assignmentTitle(assignment)}" from this class?`)) return;
    await deleteAssignment(assignment.id);
    onChanged();
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const ordered = [...assignments];
    const to = index + direction;
    if (to < 0 || to >= ordered.length) return;
    [ordered[index], ordered[to]] = [ordered[to], ordered[index]];
    const err = await reorderAssignments(ordered.map((a) => a.id));
    if (err) setError(err);
    onChanged();
  }

  if (unavailable) {
    return (
      <div className="panel">
        <div className="panel-body">
          <h3 className="text-base font-semibold text-slate-900">Assignments aren&apos;t set up yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            This feature needs one database update to be run:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              supabase/schema-classroom.sql
            </code>
            . Everything else on this page works without it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="panel">
        <div className="panel-head">
          <p className="panel-title">Assign work</p>
        </div>
        <div className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="assign-unit" className="label">
                Unit
              </label>
              <select
                id="assign-unit"
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
              <label htmlFor="assign-skill" className="label">
                Scope
              </label>
              <select
                id="assign-skill"
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                className="field mt-1"
              >
                <option value="">
                  Whole unit ({selectedUnit?.skills.length ?? 0} skills)
                </option>
                {selectedUnit?.skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="assign-due" className="label">
                Due date <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="assign-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="field mt-1"
              />
            </div>
            <div>
              <label htmlFor="assign-note" className="label">
                Note for students <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="assign-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Finish before the Friday quiz"
                className="field mt-1"
              />
            </div>
          </div>
          {error && <p className="field-error">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Adding…" : "Add assignment"}
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Assigned, in order</p>
          <span className="text-xs text-slate-500">Students see this list on their dashboard</span>
        </div>
        {assignments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            Nothing assigned yet. Students can still work through the course on
            their own.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {assignments.map((a, i) => {
              const due = dueLabel(a.dueDate);
              const doneCount = roster.filter(
                (s) => assignmentProgress(s.progress, a).complete
              ).length;
              return (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleMove(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Icon name="chevron-up" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(i, 1)}
                      disabled={i === assignments.length - 1}
                      aria-label="Move down"
                      className="rounded p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Icon name="chevron-down" size={14} />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{assignmentTitle(a)}</p>
                    <p className="text-xs text-slate-500">{assignmentSubtitle(a)}</p>
                    {a.note && <p className="mt-1 text-xs italic text-slate-500">{a.note}</p>}
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
                      <span className="text-xs text-slate-500">
                        {doneCount} of {roster.length} finished
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    aria-label="Remove assignment"
                    className="shrink-0 rounded p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsTab({
  classInfo,
  onChanged,
  onDeleted,
}: {
  classInfo: ClassInfo;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(classInfo.name);
  const [period, setPeriod] = useState(classInfo.period ?? "");
  const [gradeLevel, setGradeLevel] = useState(classInfo.gradeLevel ?? "");
  const [color, setColor] = useState<ClassColor>(classInfo.color);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const err = await updateClass(classInfo.id, { name, period, gradeLevel, color });
    setSaving(false);
    setStatus(err ? { ok: false, text: err } : { ok: true, text: "Saved." });
    if (!err) onChanged();
  }

  async function handleArchive() {
    const err = await updateClass(classInfo.id, { archived: !classInfo.archived });
    if (err) setStatus({ ok: false, text: err });
    else onChanged();
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${classInfo.name}" permanently? Students keep all of their own progress, but the roster and its assignments are removed. This can't be undone.`
      )
    )
      return;
    const err = await deleteClass(classInfo.id);
    if (err) setStatus({ ok: false, text: err });
    else onDeleted();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSave} className="panel">
        <div className="panel-head">
          <p className="panel-title">Class details</p>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label htmlFor="edit-name" className="label">
              Class name
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field mt-1"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-period" className="label">
                Period
              </label>
              <input
                id="edit-period"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Period 3"
                className="field mt-1"
              />
            </div>
            <div>
              <label htmlFor="edit-grade" className="label">
                Grade
              </label>
              <select
                id="edit-grade"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="field mt-1"
              >
                <option value="">Not set</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ColorPicker value={color} onChange={setColor} />
          {status && (
            <p className={status.ok ? "text-sm text-emerald-700" : "field-error"}>{status.text}</p>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Archive or delete</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {classInfo.archived ? "Restore this class" : "Archive at the end of term"}
              </p>
              <p className="text-xs text-slate-500">
                Archiving hides the class from your list. Nothing is deleted and you
                can bring it back any time.
              </p>
            </div>
            <button type="button" onClick={handleArchive} className="btn-secondary shrink-0">
              <Icon name="archive" size={15} />
              {classInfo.archived ? "Restore" : "Archive"}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Delete this class</p>
              <p className="text-xs text-slate-500">
                Removes the roster and assignments. Students keep their own progress.
              </p>
            </div>
            <button type="button" onClick={handleDelete} className="btn-danger shrink-0">
              <Icon name="trash" size={15} />
              Delete class
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
