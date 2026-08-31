"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProgress } from "@/hooks/useProgress";
import { getProgress } from "@/lib/progress";
import { getMyClassesAsStudent, type StudentClass } from "@/lib/teacher";
import {
  assignmentHref,
  assignmentProgress,
  assignmentTitle,
  dueLabel,
} from "@/lib/assignments";
import type { UserProgress } from "@/types";

/**
 * "What does my teacher want me to do?", the first question a student in a
 * class has. Shown above the course itself, and silent for anyone not in one.
 */
export function AssignedWork() {
  const { user } = useAuth();
  const { stats } = useProgress();
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    if (!user) {
      setClasses([]);
      return;
    }
    let active = true;
    getMyClassesAsStudent().then((list) => active && setClasses(list));
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    setProgress(getProgress());
  }, [stats.completedSkills, stats.problemsSolved]);

  const items = classes
    .flatMap((cls) => cls.assignments.map((a) => ({ cls, assignment: a })))
    .filter(({ assignment }) => !assignmentProgress(progress, assignment).complete)
    .slice(0, 4);

  if (items.length === 0) return null;

  return (
    <section className="panel">
      <div className="panel-head">
        <p className="panel-title">Assigned to you</p>
        <Link href="/classes" className="text-xs font-medium text-bridge-700 hover:underline">
          All classes →
        </Link>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map(({ cls, assignment }) => {
          const p = assignmentProgress(progress, assignment);
          const due = dueLabel(assignment.dueDate);
          return (
            <li key={assignment.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {assignmentTitle(assignment)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {cls.name}
                  {p.total > 1 ? ` · ${p.done} of ${p.total} skills` : ""}
                </p>
              </div>
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
              <Link href={assignmentHref(assignment)} className="btn-primary btn-sm shrink-0">
                {p.done > 0 ? "Continue" : "Start"}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
