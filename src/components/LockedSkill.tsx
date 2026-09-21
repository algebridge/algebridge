"use client";

import Link from "next/link";
import { useState } from "react";
import type { Skill } from "@/types";
import { Icon } from "@/components/Icon";
import { SkillCheck } from "@/components/SkillCheck";
import { canTryCheck, CHECK_LENGTH, type PathStep } from "@/lib/path";
import { getSkillProgress } from "@/lib/progress";

/**
 * What a skill ahead of the learning path shows instead of its lesson: where
 * it sits on the path, the way there, the way to skip ahead for a student
 * who already knows it, and a way to look around without any of it counting.
 */
export function LockedSkill({
  skill,
  after,
  onPractice,
  startChecking = false,
}: {
  skill: Skill;
  after: PathStep;
  /** Opens the lesson in practice-only mode. */
  onPractice: () => void;
  /** Open straight onto the check, e.g. from practice mode. */
  startChecking?: boolean;
}) {
  const [checking, setChecking] = useState(startChecking);
  const canTry = canTryCheck(getSkillProgress(skill.id));

  return (
    <section className="panel">
      <div className="px-6 py-10 sm:px-10">
        {checking ? (
          <div className="mx-auto max-w-xl">
            <SkillCheck skill={skill} afterTitle={after.title} onExit={() => setChecking(false)} />
          </div>
        ) : (
          <div className="mx-auto max-w-lg text-center">
            <span className="hue-wash mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <Icon name="lock" size={22} />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Opens after {after.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Skills open in order, each one building on the last. Finish {after.title} in Unit {after.unitNumber} and this
              one opens.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link
                href={`/learn/${after.unitId}/${after.skillId}`}
                className="hue-solid inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition duration-150 ease-out hover:scale-[1.03] hover:brightness-110"
              >
                Go to {after.title}
              </Link>
              {canTry && (
                <button type="button" onClick={() => setChecking(true)} className="btn-secondary text-sm">
                  Show what you know
                </button>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              {canTry
                ? `Know this already? Get ${CHECK_LENGTH} in a row right and it opens now. One try a day.`
                : "Your next try at showing what you know opens tomorrow."}{" "}
              Teachers can also open it by assigning it to your class.
            </p>

            {/* Looking ahead, for the curious. The lesson opens as it is, and
                the path stays where it is. */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <button type="button" onClick={onPractice} className="btn-ghost text-sm">
                <Icon name="eye" size={16} />
                Just practicing
              </button>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Look ahead and try the lesson. Your progress stays as it is until this skill opens.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
