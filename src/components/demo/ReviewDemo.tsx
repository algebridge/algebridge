"use client";

import { useMemo, useState } from "react";
import type { UserProgress } from "@/types";
import { units } from "@/data/curriculum";
import { normalizeProgress } from "@/lib/progress";
import { getSkillsDueForReview } from "@/lib/spaced-repetition";
import { DemoCard } from "@/components/demo/DemoCard";
import { Icon } from "@/components/Icon";
import { TryProblem } from "@/components/TryProblem";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long ago each skill of Unit 1 was last practiced: one per early review interval, so all three are due. */
const DAYS_AGO = [1, 3, 7];

const SKILL_META = units.flatMap((u) =>
  u.skills.map((s) => ({ id: s.id, title: s.title, unitId: u.id, unitTitle: u.title }))
);

/** A student who finished Unit 1 and has not been back for a bit. In memory only. */
function unitOneFinished(): UserProgress {
  const now = Date.now();
  const skills: UserProgress["skills"] = {};
  units[0].skills.forEach((s, i) => {
    skills[s.id] = {
      skillId: s.id,
      level: "proficient",
      problemsAttempted: 7,
      problemsCorrect: 6,
      solved: 5,
      videoWatched: true,
      // A minute past the interval, so "a day ago" is still a full day when the list is built.
      lastPracticed: new Date(now - (DAYS_AGO[i] ?? 7) * DAY_MS - 60_000).toISOString(),
    };
  });
  return normalizeProgress({ skills });
}

/** The next lesson for this progress, as the course's own Continue button picks it. */
function nextLesson(progress: UserProgress) {
  for (const unit of units) {
    for (const skill of unit.skills) {
      const level = progress.skills[skill.id]?.level;
      if (level !== "proficient" && level !== "mastered") return { unitId: unit.id, skillId: skill.id, title: skill.title };
    }
  }
  return null;
}

/**
 * The Review page on a made-up student: Unit 1 done, its three skills due at
 * 1, 3 and 7 days. A row opens the sample card for that skill in place of a
 * lesson page; finishing it counts as practiced today, so it leaves the list.
 */
export function ReviewDemo() {
  const [progress, setProgress] = useState(unitOneFinished);
  const [openId, setOpenId] = useState<string | null>(null);
  const dueItems = useMemo(() => getSkillsDueForReview(progress.skills, SKILL_META), [progress]);

  function markReviewed(skillId: string) {
    setProgress((p) => ({
      ...p,
      skills: { ...p.skills, [skillId]: { ...p.skills[skillId], lastPracticed: new Date().toISOString() } },
    }));
  }

  const next = nextLesson(progress);

  return (
    <DemoCard>
      <div className="space-y-6">
        <header>
          <p className="eyebrow">Spaced repetition</p>
          <h1 className="page-title">Review</h1>
          <p className="page-subtitle">
            Skills you&apos;ve completed come back for a quick check at 1, 3, 7, 14
            and 30 days, so what you learn in Unit 1 is still there when you need it
            in Unit 8.
          </p>
        </header>

        {openId ? (
          <div className="space-y-4">
            <div>
              <button type="button" onClick={() => setOpenId(null)} className="btn-secondary btn-sm">
                <Icon name="arrow-left" size={16} />
                Back to review
              </button>
            </div>
            <TryProblem key={openId} embed fixed skillId={openId} count={3} reportHeight={false} onFinish={() => markReviewed(openId)} />
          </div>
        ) : dueItems.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bridge-50 text-bridge-600" aria-hidden>
              <Icon name="review" size={24} />
            </span>
            <h2 className="mt-3 text-base font-semibold text-slate-900">Nothing due right now</h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
              Skills you have finished come back here a day after you last practiced them.
            </p>
            {next ? (
              <a href={`/learn/${next.unitId}/${next.skillId}`} target="_top" className="btn-primary mt-5 inline-flex">
                Continue: {next.title}
                <Icon name="arrow-right" size={16} />
              </a>
            ) : (
              <a href="/" target="_top" className="btn-primary mt-5 inline-flex">
                Continue the course
              </a>
            )}
          </div>
        ) : (
          <div className="panel">
            <div className="panel-head">
              <p className="panel-title">
                {dueItems.length} skill{dueItems.length !== 1 ? "s" : ""} due for review
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {dueItems.map((item) => (
                <li key={item.skillId}>
                  <button
                    type="button"
                    onClick={() => setOpenId(item.skillId)}
                    className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition duration-150 ease-out hover:translate-x-1 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-slate-900 group-hover:text-bridge-700">
                        {item.skillTitle}
                      </h3>
                      <p className="truncate text-xs text-slate-500">
                        {item.unitTitle} · {item.dueReason}
                      </p>
                    </div>
                    <Icon name="arrow-right" size={16} className="shrink-0 text-slate-300 group-hover:text-bridge-600" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </DemoCard>
  );
}
