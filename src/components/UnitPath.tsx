"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MasteryLevel, Unit } from "@/types";
import { Icon } from "@/components/Icon";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { useProgress } from "@/hooks/useProgress";
import { getSimpleStatus, getSkillProgress } from "@/lib/progress";
import { bridgeysForSkill } from "@/lib/gamification";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";

/**
 * A unit's skills as a path: a rail down the left with a node per skill,
 * filled in the unit's color as they are finished. The node the student is
 * on is the biggest thing on the page. A locked node is quiet and says what
 * opens it. The old version was five identical cards.
 */
export function UnitPath({ unit }: { unit: Unit }) {
  const { stats, mounted } = useProgress();
  const access = useCourseAccess();
  const [levels, setLevels] = useState<Record<string, MasteryLevel>>({});

  useEffect(() => {
    if (!mounted) return;
    setLevels(Object.fromEntries(unit.skills.map((s) => [s.id, getSkillProgress(s.id).level])));
  }, [unit, stats.completedSkills, mounted]);

  const ready = mounted && access.ready;
  // The first open skill that is not complete is where the student is.
  const currentId = ready
    ? unit.skills.find((s) => access.skill(s.id).open && getSimpleStatus(levels[s.id] ?? "locked") !== "complete")?.id
    : undefined;

  return (
    <ol className="relative">
      {/* The rail. */}
      <span aria-hidden className="absolute bottom-6 left-[1.4rem] top-6 w-0.5 bg-slate-200" />
      {unit.skills.map((skill, index) => {
        const level = levels[skill.id] ?? "locked";
        const status = getSimpleStatus(level);
        const state = ready ? access.skill(skill.id) : null;
        const locked = state?.open === false;
        const current = skill.id === currentId;
        const done = status === "complete";
        return (
          <li key={skill.id} className="relative flex gap-4 py-2">
            {/* The node. */}
            <span
              className={`relative z-10 mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-4 ring-slate-50 transition ${
                !ready
                  ? "animate-pulse bg-slate-100"
                  : done
                    ? "hue-solid"
                    : current
                      ? "hue-solid hue-ring"
                      : locked
                        ? "bg-white text-slate-300 ring-1 ring-inset ring-slate-200"
                        : "hue-wash ring-1 ring-inset ring-slate-200"
              }`}
              aria-hidden
            >
              {!ready ? null : done ? (
                <Icon name="check" size={18} />
              ) : locked ? (
                <Icon name="lock" size={16} />
              ) : (
                <span className="text-sm font-bold">{index + 1}</span>
              )}
            </span>

            <Link
              href={`/learn/${unit.id}/${skill.id}`}
              className={`skill-card min-w-0 flex-1 ${
                current ? "hue-line border-2 shadow-raised" : locked ? "bg-slate-50/70" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`font-semibold ${locked ? "text-slate-600" : "text-slate-900"}`}>{skill.title}</h3>
                  {/* What finishing it pays, so the trade is visible before the work. */}
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                    }`}
                    title={done ? "Bridgeys earned" : "Bridgeys for finishing this skill"}
                  >
                    <BridgeysLogo size={13} />
                    {done ? "" : "+"}
                    {bridgeysForSkill(skill.id)}
                  </span>
                  {ready ? (
                    done ? (
                      <span className="badge-success">Complete</span>
                    ) : current ? (
                      <span className="hue-wash badge">{status === "in-progress" ? "In progress" : "Up next"}</span>
                    ) : locked ? (
                      <span className="badge-neutral">Locked</span>
                    ) : status === "in-progress" ? (
                      <span className="badge-warn">In progress</span>
                    ) : null
                  ) : (
                    <span className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {locked && state && !state.open ? `Opens after ${state.after.title}. ` : ""}
                  {skill.description}
                </p>
                {current && (
                  <span className="hue-ink mt-2 inline-flex items-center gap-1 text-sm font-semibold">
                    {status === "in-progress" ? "Keep going" : "Start here"}
                    <Icon name="chevron-down" size={14} className="-rotate-90" />
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
