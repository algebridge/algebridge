"use client";

import Link from "next/link";
import type { Skill } from "@/types";
import { ProgressStatus } from "./ProgressStatus";
import { getSkillProgress, getSimpleStatus } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { useEffect, useState } from "react";
import type { MasteryLevel } from "@/types";
import { Icon } from "@/components/Icon";

interface SkillListItemProps {
  skill: Skill;
  unitId: string;
  index: number;
}

function SkillIcon({ level, index }: { level: MasteryLevel; index: number }) {
  const status = getSimpleStatus(level);
  if (status === "complete") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Icon name="check" size={18} />
      </span>
    );
  }
  if (status === "in-progress") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
        {index}
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
      {index}
    </span>
  );
}

export function SkillListItem({ skill, unitId, index }: SkillListItemProps) {
  const [level, setLevel] = useState<MasteryLevel>("locked");
  const { stats, mounted } = useProgress();
  const access = useCourseAccess();
  const state = access.ready ? access.skill(skill.id) : null;
  const locked = state?.open === false;

  useEffect(() => {
    if (!mounted) return;
    setLevel(getSkillProgress(skill.id).level);
  }, [skill.id, stats.completedSkills, mounted]);

  return (
    <Link href={`/learn/${unitId}/${skill.id}`} className={`skill-card group ${locked ? "bg-slate-50/60" : ""}`}>
      {mounted && state ? (
        locked ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="lock" size={17} />
          </span>
        ) : (
          <SkillIcon level={level} index={index} />
        )
      ) : (
        <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`font-semibold group-hover:text-bridge-700 ${locked ? "text-slate-600" : "text-slate-900"}`}>
            {skill.title}
          </h3>
          {mounted && state ? (
            locked ? (
              <span className="badge-neutral">Locked</span>
            ) : (
              <ProgressStatus level={level} />
            )
          ) : (
            <span className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {locked && state && !state.open ? `Opens after ${state.after.title}. ` : ""}
          {skill.description}
        </p>
      </div>
      <span className="text-slate-300 group-hover:text-bridge-500">→</span>
    </Link>
  );
}
