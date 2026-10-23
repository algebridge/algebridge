"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  resetStudentPassword,
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
import { makePassword } from "@/lib/student-accounts";
import { Icon } from "@/components/Icon";
import { showToast } from "@/lib/notify";
import { useDialogFocus } from "@/components/useDialogFocus";
import { prefersReducedMotion } from "@/lib/display";
import { ClassControlsTab } from "@/components/teacher/ClassControlsTab";
import { MakeAccounts } from "@/components/teacher/MakeAccounts";
import { signInName, StudentDetail } from "@/components/teacher/StudentDetail";
import { classGrade, overallAccuracy } from "@/lib/student-report";
import { StandardsChip } from "@/components/StandardsChip";
import { standardsForSkill } from "@/data/standards";
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

type Tab = "roster" | "assignments" | "controls" | "settings";

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
  const detailRef = useRef<HTMLDivElement>(null);

  /** Pick a class. Under lg the detail sits below the list, so go to it. */
  function selectClass(id: string) {
    setSelectedId(id);
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      el.focus({ preventScroll: true });
    });
  }

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
        title="Teacher tools need accounts"
        body="Classes and rosters are stored with AlgeBridge accounts, so progress follows students between devices. Accounts are not switched on for this copy of the site."
      />
    );
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to manage your classes"
        body="Teacher accounts create classes, add students by join code or school email, assign skills, and see each student's progress through the course."
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
        body="Teacher accounts need an access code from AlgeBridge. Enter your code on the account page to switch, or ask for one at info@algebridge.org."
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

      {error && <p role="alert" className="notice-error">{error}</p>}

      {/* minmax(0,1fr) on the single phone column too: an auto column grows to the roster table's width and scrolls the whole page sideways. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <NewClassForm onCreated={(id) => refreshClasses(id)} />

          <div className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Class list</h2>
              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  {showArchived ? "Hide" : "Show"} archived ({archivedCount})
                </button>
              )}
            </div>
            {classesLoading ? (
              <p className="px-5 py-4 text-sm text-slate-500">Loading classes…</p>
            ) : visibleClasses.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">
                No classes yet. Create your first one above, it takes about ten
                seconds.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleClasses.map((c, i) => (
                  <li key={c.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => selectClass(c.id)}
                      aria-pressed={selectedId === c.id}
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
                    <div className="flex shrink-0 flex-col justify-center gap-1 pr-2">
                      <button
                        type="button"
                        onClick={() => handleMove(c.id, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${c.name} up`}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Icon name="chevron-up" size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(c.id, 1)}
                        disabled={i === visibleClasses.length - 1}
                        aria-label={`Move ${c.name} down`}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <Icon name="chevron-down" size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div ref={detailRef} id="class-detail" tabIndex={-1} className="scroll-mt-16 focus:outline-none">
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

/** The standards a skill, or a whole unit when no skill is picked, teaches. */
function scopeStandardCodes(unitId: string, skillId: string): string[] {
  const unit = units.find((u) => u.id === unitId);
  const skills = skillId ? [skillId] : unit?.skills.map((s) => s.id) ?? [];
  return [...new Set(skills.flatMap((id) => standardsForSkill(id).map((s) => s.code)))];
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

function NewClassForm({ onCreated }: { onCreated: (id?: string) => void }) {
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
    const { error: createError, id } = await createClass({ name, period, gradeLevel, color });
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
    onCreated(id);
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
        <h2 className="panel-title">New class</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
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
        {error && <p role="alert" className="field-error">{error}</p>}
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
      <span className="label">Color</span>
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
  const [showCode, setShowCode] = useState(false);

  /** `quiet`: refresh in place, with no loading line, for the background checks. */
  const loadRoster = useCallback(
    async (quiet = false) => {
      if (!quiet) setRosterLoading(true);
      setRoster(await getClassRoster(classInfo.id));
      setRosterLoading(false);
    },
    [classInfo.id]
  );

  const loadAssignments = useCallback(async () => {
    const { assignments: list, unavailable } = await getClassAssignments(classInfo.id);
    setAssignments(list);
    setAssignmentsUnavailable(unavailable);
  }, [classInfo.id]);

  useEffect(() => {
    loadRoster();
    loadAssignments();
  }, [loadRoster, loadAssignments]);

  // While the roster is open, students who type the code show up on their
  // own: a check every 15 seconds while the tab is visible, and one more the
  // moment it comes back into view.
  useEffect(() => {
    if (tab !== "roster") return;
    const tick = () => {
      if (document.visibilityState === "visible") void loadRoster(true);
    };
    const timer = setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [tab, loadRoster]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(classInfo.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      showToast({ icon: "copy", tone: "success", title: "Join code copied", description: classInfo.joinCode });
    } catch {
      showToast({
        icon: "copy",
        tone: "info",
        title: `The code is ${classInfo.joinCode}`,
        description: "Read it off the screen, or use Show to class.",
      });
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "roster", label: "Roster", count: roster.length },
    { id: "assignments", label: "Assignments", count: assignments.length },
    { id: "controls", label: "Controls" },
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Join code</p>
            <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={copyCode}
                title="Copy join code"
                aria-label={`Copy join code ${classInfo.joinCode}`}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-base font-bold tracking-[0.2em] text-slate-900 transition hover:border-bridge-400 hover:bg-bridge-50"
              >
                {classInfo.joinCode}
                {copied ? (
                  <Icon name="check" size={15} className="text-emerald-600" />
                ) : (
                  <Icon name="copy" size={15} className="text-slate-400" />
                )}
              </button>
              {/* The code across the whole screen, for a projector. */}
              <button
                type="button"
                onClick={() => setShowCode(true)}
                className="btn-secondary btn-sm"
                title="Put the code on the screen in big type"
              >
                Show to class
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-1 border-t border-slate-200 px-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              aria-pressed={tab === t.id}
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

      {/* Every tab stays mounted and is hidden when it is not the one open,
          so what a teacher has in hand survives a look at another tab: the
          passwords of accounts just made, an email result, a sort, a half
          written assignment. */}
      <div hidden={tab !== "roster"}>
        <RosterTab
          classInfo={classInfo}
          roster={roster}
          assignments={assignments}
          loading={rosterLoading}
          onRefresh={() => loadRoster(true)}
          onChanged={() => {
            loadRoster();
            onChanged();
          }}
        />
      </div>

      <div hidden={tab !== "assignments"}>
        <AssignmentsTab
          classInfo={classInfo}
          assignments={assignments}
          roster={roster}
          unavailable={assignmentsUnavailable}
          onChanged={loadAssignments}
        />
      </div>

      <div hidden={tab !== "controls"}>
        <ClassControlsTab classInfo={classInfo} assignmentCount={assignments.length} />
      </div>

      <div hidden={tab !== "settings"}>
        <SettingsTab classInfo={classInfo} onChanged={onChanged} onDeleted={onDeleted} />
      </div>

      {showCode && <ShowCodeOverlay classInfo={classInfo} onClose={() => setShowCode(false)} />}
    </div>
  );
}

/**
 * The join code across the whole screen, for a projector or a shared
 * screen, with where to type it. Codes use the digits and A to F only, so
 * nobody has to tell an O from a 0.
 */
function ShowCodeOverlay({ classInfo, onClose }: { classInfo: ClassInfo; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true, onClose);
  const site = typeof window !== "undefined" ? window.location.host : "learn.algebridge.org";
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="show-code-title"
      className="fixed inset-0 z-[130] flex flex-col items-center justify-center overflow-y-auto bg-white px-6 py-10 text-center"
    >
      <p className="text-xl font-medium text-slate-600 sm:text-3xl">
        Go to <span className="font-semibold text-slate-900">{site}</span>, then{" "}
        <span className="font-semibold text-slate-900">My classes</span>
      </p>
      <h2 id="show-code-title" className="mt-6 text-2xl font-semibold text-slate-600 sm:text-4xl">
        Class code for {classInfo.name}
      </h2>
      <p className="mt-4 font-mono text-[20vw] font-bold leading-none tracking-[0.12em] text-slate-900 sm:text-[15vw]">
        {classInfo.joinCode}
      </p>
      <p className="mt-6 text-lg text-slate-500 sm:text-2xl">Codes use only 0 to 9 and A to F.</p>
      <button type="button" data-autofocus onClick={onClose} className="btn-secondary mt-10">
        Close
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

type SortKey = "name" | "progress" | "grade" | "active";

function RosterTab({
  classInfo,
  roster,
  assignments,
  loading,
  onRefresh,
  onChanged,
}: {
  classInfo: ClassInfo;
  roster: RosterStudent[];
  assignments: ClassAssignment[];
  loading: boolean;
  /** Check for new students now, in place. */
  onRefresh: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState("");
  const [emails, setEmails] = useState("");
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<BulkAddResult | null>(null);
  const [sort, setSort] = useState<SortKey>("name");
  const [openId, setOpenId] = useState<string | null>(null);
  const openStudent = roster.find((s) => s.id === openId) ?? null;
  const [reset, setReset] = useState<{ name: string; signIn: string; password: string; error: string | null } | null>(null);

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

  async function handleReset(student: RosterStudent) {
    const name = student.displayName ?? student.email ?? "this student";
    if (!confirm(`Give ${name} a new password? Their old one will stop working.`)) return;
    const password = makePassword();
    const error = await resetStudentPassword(student.id, password);
    setReset({ name, signIn: signInName(student.email), password, error });
  }

  async function handleRemove(student: RosterStudent) {
    const label = student.displayName ?? student.email ?? "this student";
    if (!confirm(`Remove ${label} from ${classInfo.name}? You can add them back later.`)) return;
    const err = await removeStudentFromClass(classInfo.id, student.id);
    setError(err ? `${label} is still in the class: ${err}` : "");
    onChanged();
  }

  const sorted = useMemo(() => {
    const list = [...roster];
    if (sort === "progress") {
      list.sort((a, b) => (b.stats?.percent ?? -1) - (a.stats?.percent ?? -1));
    } else if (sort === "grade") {
      const g = (s: RosterStudent) => classGrade(s.progress, assignments).percent ?? -1;
      list.sort((a, b) => g(b) - g(a));
    } else if (sort === "active") {
      list.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
    } else {
      list.sort((a, b) =>
        (a.displayName ?? a.email ?? "").localeCompare(b.displayName ?? b.email ?? "")
      );
    }
    return list;
  }, [roster, sort, assignments]);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="notice-error">{error}</p>}

      {/* First, the way in for students with no account yet: the common case
          in 7th to 9th grade. Then the two ways for students who have one. */}
      <MakeAccounts classInfo={classInfo} onMade={onChanged} />

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Students who already have an account</h3>
        </div>
        <div className="space-y-3 p-5">
          <div className="notice-info">
            Give them the class code <strong className="font-mono tracking-wider">{classInfo.joinCode}</strong>.
            They enter it under <strong>My classes</strong> and appear here within a few seconds.{" "}
            <strong>Show to class</strong>, above, puts the code on the screen in big type.
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
              One per line, or separated by commas, paste a whole column from your gradebook. Each student gets an
              invite to accept under My classes, so they are on the roster once they say yes.
            </p>
            <button type="submit" disabled={adding} className="btn-secondary">
              {adding ? "Adding…" : "Add to class"}
            </button>
          </form>

          {result && (
            <div role="status" className="space-y-1.5 text-sm">
              {result.added.length > 0 && (
                <p className="text-emerald-700">
                  Added {result.added.length}: {result.added.join(", ")}
                </p>
              )}
              {result.invited.length > 0 && (
                <p className="text-sky-700">
                  Invited {result.invited.length}: {result.invited.join(", ")}. They join once they accept the
                  invite under My classes.
                </p>
              )}
              {result.alreadyIn.length > 0 && (
                <p className="text-slate-500">Already in this class: {result.alreadyIn.join(", ")}</p>
              )}
              {result.notFound.length > 0 && (
                <p className="text-amber-700">
                  No account found for {result.notFound.join(", ")}, ask them to sign
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
          <h3 className="panel-title">Students</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onRefresh} className="btn-ghost btn-sm" title="Check for new students now">
              Refresh
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Sort by
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                <option value="name">Name</option>
                <option value="progress">Progress</option>
                <option value="grade">Grade</option>
                <option value="active">Last active</option>
              </select>
            </label>
          </div>
        </div>
        {/* What the columns mean, said once: a grade here is work done, a level is the game. */}
        <p className="border-b border-slate-100 px-5 py-2.5 text-xs leading-relaxed text-slate-500">
          Grade is the share of assigned work finished: A from 90%, B from 80, C from 70, D from 60. Level is the
          game level earned by practicing. New students appear on their own, about every 15 seconds.
        </p>
        {reset && (
          <div className={`${reset.error ? "notice-error" : "notice-success"} mx-5 my-3`} role="status">
            {reset.error ? (
              <>Couldn&apos;t reset {reset.name}&apos;s password: {reset.error}</>
            ) : (
              <>
                <strong>{reset.name}</strong> now signs in with{" "}
                <strong>{reset.signIn}</strong> and the password{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-sm">{reset.password}</code>.
                Write it down for them now. It won&apos;t be shown again.
              </>
            )}
            <button type="button" onClick={() => setReset(null)} className="ml-2 text-xs underline">
              Done
            </button>
          </div>
        )}
        {loading ? (
          <p role="status" className="px-5 py-6 text-sm text-slate-500">Loading roster…</p>
        ) : sorted.length === 0 ? (
          <p role="status" className="px-5 py-6 text-sm text-slate-500">
            No students yet. Make their accounts above, or share the code{" "}
            <strong className="font-mono tracking-wider text-slate-700">{classInfo.joinCode}</strong>. They appear
            here on their own once they join.
          </p>
        ) : (
          <div tabIndex={0} role="region" aria-label="Class roster" className="relative overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bridge-500">
            {/* Focusable, so a keyboard can scroll the roster sideways on a phone. `relative`, so
                the sr-only "Actions" heading (position: absolute) is clipped with the table instead
                of escaping the scroller and widening the whole page. */}
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  {/* The name stays put while the rest scrolls sideways on a phone. */}
                  <th className="sticky left-0 z-[1] bg-slate-50 shadow-[inset_-1px_0_0_#e2e8f0]">Student</th>
                  <th>Grade</th>
                  <th>Accuracy</th>
                  <th>Course progress</th>
                  <th>Level</th>
                  <th>Streak</th>
                  <th>Solved</th>
                  <th>Last active</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((student) => (
                  <tr key={student.id}>
                    <td className="sticky left-0 z-[1] bg-white shadow-[inset_-1px_0_0_#f1f5f9]">
                      <button
                        type="button"
                        onClick={() => setOpenId(student.id)}
                        className="-my-1 rounded-md py-1 text-left font-medium text-bridge-700 hover:underline"
                      >
                        {student.displayName ?? "Unnamed student"}
                      </button>
                      <p className="text-xs text-slate-500">{signInName(student.email)}</p>
                    </td>
                    <td className="text-xs">
                      {(() => {
                        const g = classGrade(student.progress, assignments);
                        return g.letter ? (
                          <span className="font-semibold text-slate-900">
                            {g.letter} <span className="font-normal text-slate-500">{g.percent}%</span>
                          </span>
                        ) : (
                          "-"
                        );
                      })()}
                    </td>
                    <td className="text-xs">
                      {(() => {
                        const a = overallAccuracy(student.progress);
                        return a.percent === null ? "-" : `${a.percent}%`;
                      })()}
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
                    <td className="text-xs">{student.stats ? student.stats.level : "-"}</td>
                    <td className="text-xs">
                      {student.stats?.streak ? `${student.stats.streak} days` : "-"}
                    </td>
                    <td className="text-xs">{student.stats?.problemsSolved ?? 0}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {formatRelative(student.lastActiveAt)}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => handleReset(student)}
                        aria-label={`Give ${student.displayName ?? "this student"} a new password`}
                        className="mr-3 py-1 text-xs text-slate-500 transition hover:text-bridge-700"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(student)}
                        aria-label={`Remove ${student.displayName ?? "this student"} from the class`}
                        className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
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
      {openStudent && (
        <StudentDetail
          student={openStudent}
          classInfo={classInfo}
          assignments={assignments}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

/** The coming Friday as yyyy-mm-dd; a week out when today is a Friday. */
function nextFriday(): string {
  const d = new Date();
  const ahead = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + ahead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [unitTouched, setUnitTouched] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Until the teacher picks a unit, offer the first one with nothing assigned
  // yet: the next thing to assign, most weeks.
  useEffect(() => {
    if (unitTouched) return;
    const next = units.find((u) => !assignments.some((a) => a.unitId === u.id));
    if (next) setUnitId(next.id);
  }, [assignments, unitTouched]);

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
    const skill = selectedUnit?.skills.find((s) => s.id === skillId);
    const what = skill ? skill.title : selectedUnit ? `Unit ${selectedUnit.number}: ${selectedUnit.title}` : "The work";
    showToast({ icon: "check", tone: "success", title: "Assigned", description: `${what} is on ${classInfo.name}'s list.` });
    setSkillId("");
    setDueDate("");
    setNote("");
    setUnitTouched(false);
    onChanged();
  }

  async function handleDelete(assignment: ClassAssignment) {
    if (!confirm(`Remove "${assignmentTitle(assignment)}" from this class?`)) return;
    const err = await deleteAssignment(assignment.id);
    if (err) setError(`That assignment is still on the list: ${err}`);
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
          {/* For whoever runs the site: assignments need the
              supabase/schema-classroom.sql update applied to the database. */}
          <h3 className="text-base font-semibold text-slate-900">Assignments aren&apos;t switched on yet</h3>
          <p className="mt-2 text-sm text-slate-600">
            Assigning units and skills with due dates is not turned on for this site yet. Everything else on this page
            works without it: your roster, join codes and every student&apos;s progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Assign work</h3>
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
                  setUnitTouched(true);
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
                What to assign
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
              <div className="mt-1 flex gap-2">
                <input
                  id="assign-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="field"
                />
                <button type="button" onClick={() => setDueDate(nextFriday())} className="btn-secondary btn-sm shrink-0">
                  Next Friday
                </button>
              </div>
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
          {/* What the chosen scope covers, so it can be matched to a pacing guide. */}
          <StandardsChip codes={scopeStandardCodes(unitId, skillId)} label="Covers" />
          {error && <p role="alert" className="field-error">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Adding…" : "Add assignment"}
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Assigned, in order</h3>
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
                  <div className="flex shrink-0 flex-col gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleMove(i, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Icon name="chevron-up" size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(i, 1)}
                      disabled={i === assignments.length - 1}
                      aria-label="Move down"
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Icon name="chevron-down" size={16} />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{assignmentTitle(a)}</p>
                    <p className="text-xs text-slate-500">{assignmentSubtitle(a)}</p>
                    <StandardsChip codes={scopeStandardCodes(a.unitId, a.skillId ?? "")} label={false} className="mt-1.5" />
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
          <h3 className="panel-title">Class details</h3>
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
            <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-sm text-emerald-700" : "field-error"}>
              {status.text}
            </p>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Archive or delete</h3>
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
