"use client";

import Link from "next/link";
import type { Skill } from "@/types";
import { ProgressStatus } from "./ProgressStatus";
import { getSkillProgress, getSimpleStatus } from "@/lib/progress";
import { useProgress } from "@/hooks/useProgress";
import { useEffect, useState } from "react";
import type { MasteryLevel } from "@/types";

interface SkillListItemProps {
  skill: Skill;
  unitId: string;
  index: number;
}

function SkillIcon({ level, index }: { level: MasteryLevel; index: number }) {
  const status = getSimpleStatus(level);
  if (status === "complete") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-700">
        ✓
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

  useEffect(() => {
    if (!mounted) return;
    setLevel(getSkillProgress(skill.id).level);
  }, [skill.id, stats.completedSkills, mounted]);

  return (
    <Link href={`/learn/${unitId}/${skill.id}`} className="skill-card group">
      {mounted ? (
        <SkillIcon level={level} index={index} />
      ) : (
        <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-900 group-hover:text-bridge-700">
            {skill.title}
          </h3>
          {mounted ? (
            <ProgressStatus level={level} />
          ) : (
            <span className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-500">{skill.description}</p>
      </div>
      <span className="text-slate-300 group-hover:text-bridge-500">→</span>
    </Link>
  );
}
