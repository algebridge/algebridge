"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useDialogFocus } from "@/components/useDialogFocus";
import { initialsOf } from "@/lib/name";
import { classGrade, overallAccuracy, unitReport, type Accuracy } from "@/lib/student-report";
import { USERNAME_DOMAIN } from "@/lib/student-accounts";
import { INTEREST_OPTIONS } from "@/lib/interests";
import { ProblemHistory } from "@/components/teacher/ProblemHistory";
import type { ClassAssignment, ClassInfo, RosterStudent } from "@/types";

function pct(a: Accuracy): string {
  return a.percent === null ? "-" : `${a.percent}%`;
}

function date(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Never" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "maria.lopez3309@students.algebridge.org" reads as its username. */
export function signInName(email: string | null): string {
  if (!email) return "";
  return email.endsWith(`@${USERNAME_DOMAIN}`) ? email.slice(0, -USERNAME_DOMAIN.length - 1) : email;
}

/** One student, opened from the roster: profile, grade, accuracy and every skill. */
export function StudentDetail({
  student,
  classInfo,
  assignments,
  onClose,
}: {
  student: RosterStudent;
  classInfo: ClassInfo;
  assignments: ClassAssignment[];
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const progress = student.progress;
  const grade = classGrade(progress, assignments);
  const accuracy = overallAccuracy(progress);
  const unitRows = unitReport(progress);
  const name = student.displayName ?? "Unnamed student";
  const stats = student.stats;
  const log = progress?.problemLog ?? [];
  const weekAgo = Date.now() - 7 * 86400000;
  const week = log.filter((e) => Date.parse(e.at) >= weekAgo);
  const weekDays = new Set(week.map((e) => e.at.slice(0, 10))).size;
  const weekMinutes = Math.round(week.reduce((n, e) => n + e.seconds, 0) / 60);
  const interests = progress?.interests;
  const interestText = interests
    ? [
        ...interests.picks.map((id) => {
          const label = INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id;
          const specific = interests.specifics?.[id]?.trim();
          return specific ? `${label} (${specific})` : label;
        }),
        interests.note.trim(),
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  // Focus moves in, Tab stays inside, Escape closes, and focus goes back to
  // the roster row that opened it.
  useDialogFocus(panel, true, onClose);

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-ink-900/40" onClick={onClose}>
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`${name}, student report`}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-surface px-5 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bridge-600 text-sm font-semibold text-white">
            {initialsOf(name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-slate-900">{name}</h2>
            <p className="truncate text-xs text-slate-500">
              {classInfo.name} · signs in as <span className="font-mono">{signInName(student.email)}</span>
            </p>
          </div>
          <button data-autofocus type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Grade" value={grade.letter ?? "-"} sub={grade.percent === null ? "Nothing assigned" : `${grade.percent}% of assigned`} />
            <Stat label="Accuracy" value={pct(accuracy)} sub={`${accuracy.correct} of ${accuracy.attempted} right`} />
            <Stat label="Completed" value={`${stats?.completedSkills ?? 0}`} sub={`of ${stats?.totalSkills ?? unitRows.reduce((n, u) => n + u.total, 0)} skills`} />
            <Stat label="Level" value={`${stats?.level ?? 1}`} sub={stats?.levelTitle ?? "Newcomer"} />
          </div>

          <section className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Profile</h3>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-3">
              <Field label="Name" value={name} />
              <Field label="Signs in with" value={signInName(student.email) || "-"} mono />
              <Field label="Joined the class" value={date(student.joinedAt)} />
              <Field label="Last active" value={date(student.lastActiveAt)} />
              <Field label="Streak" value={stats?.streak ? `${stats.streak} days` : "-"} />
              <Field label="Problems solved" value={`${stats?.problemsSolved ?? 0}`} />
              <Field label="XP" value={`${stats?.xp ?? 0}`} />
              <Field label="Badges" value={`${stats?.badgeCount ?? 0}`} />
              <Field label="Course progress" value={`${stats?.percent ?? 0}%`} />
              <Field label="Bridgeys" value={`${progress?.bridgeys ?? 0}`} />
              <Field label="Daily goals reached" value={`${progress?.goalDays?.length ?? 0}`} />
              <Field label="Working on" value={progress?.currentSkillId ? skillName(progress.currentSkillId, unitRows) : "-"} />
            </dl>
            <div className="border-t border-slate-100 px-5 py-3 text-sm">
              <p className="text-xs text-slate-500">Interests</p>
              <p className="mt-0.5 text-slate-900">{interestText || "None picked yet"}</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3 className="panel-title">The last 7 days</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              <Stat label="Problems" value={`${week.length}`} sub="answers given" />
              <Stat label="Right" value={`${week.filter((e) => e.correct).length}`} sub={`of ${week.length}`} />
              <Stat label="Days active" value={`${weekDays}`} sub="of 7" />
              <Stat label="Time" value={`${weekMinutes}m`} sub="answering problems" />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Grade</h3>
            </div>
            {grade.assignments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">
                Nothing assigned yet.
              </p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Assignment</th>
                    <th>Due</th>
                    <th>Done</th>
                    <th>Finished</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {grade.assignments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title}</td>
                      <td className="whitespace-nowrap text-xs">
                        {a.dueDate ?? "-"}
                        {a.late && <span className="ml-1.5 font-medium text-red-600">Late</span>}
                      </td>
                      <td className="text-xs">
                        {a.done}/{a.total}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {finishedText(a.completedAt, a.dueDate)}
                      </td>
                      <td className="text-xs font-medium">{a.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <ProblemHistory log={log} />

          <section className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Skills</h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {unitRows.map((u) => {
                const expanded = openUnit === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setOpenUnit(expanded ? null : u.id)}
                      aria-expanded={expanded}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="min-w-0 flex-1 text-sm text-slate-800">
                        <span className="font-medium">Unit {u.number}:</span> {u.title}
                      </span>
                      <span className="w-16 text-right text-xs text-slate-600">
                        {u.completed}/{u.total}
                      </span>
                      <span className="w-12 text-right text-xs text-slate-600">{pct(u.accuracy)}</span>
                      <Icon name={expanded ? "chevron-up" : "chevron-down"} size={15} className="text-slate-400" />
                    </button>
                    {expanded && (
                      <ul className="space-y-1 bg-slate-50/60 px-5 pb-3 pt-1">
                        {u.skills.map((s) => (
                          <li key={s.id} className="flex items-center gap-3 text-sm">
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${s.complete ? "bg-emerald-500 text-white" : s.started ? "bg-amber-200" : "bg-slate-200"}`}>
                              {s.complete && <Icon name="check" size={11} />}
                            </span>
                            <span className="min-w-0 flex-1 text-slate-700">{s.title}</span>
                            <span className="text-xs text-slate-500">
                              {s.complete ? "Completed" : s.started ? "Started" : "Not started"}
                            </span>
                            <span className="w-24 text-right text-xs text-slate-600">
                              {s.accuracy.attempted ? `${pct(s.accuracy)} (${s.accuracy.correct}/${s.accuracy.attempted})` : "-"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`truncate text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function skillName(id: string, rows: { skills: { id: string; title: string }[] }[]): string {
  for (const u of rows) for (const s of u.skills) if (s.id === id) return s.title;
  return id;
}

/** "Oct 30", with "late" when it came after the due date. */
export function finishedText(at: string | null, due: string | null): string {
  if (!at) return "-";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "-";
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const text = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return due && day > due ? `${text} (late)` : text;
}
