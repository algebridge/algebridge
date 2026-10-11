"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { allUnits } from "@/data/curriculum";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { getSkillsDueForReview, type ReviewItem } from "@/lib/spaced-repetition";
import { PracticeGate } from "@/components/PracticeGate";
import { Icon } from "@/components/Icon";
import { useProgress } from "@/hooks/useProgress";

export default function ReviewPage() {
  return (
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

      <PracticeGate activity="use review">
        <ReviewQueue />
      </PracticeGate>
    </div>
  );
}

function ReviewQueue() {
  const [dueItems, setDueItems] = useState<ReviewItem[]>([]);
  const { stats, continueTarget } = useProgress();

  useEffect(() => {
    const skillMeta = allUnits().flatMap((u) =>
      u.skills.map((s) => ({
        id: s.id,
        title: s.title,
        unitId: u.id,
        unitTitle: u.title,
      }))
    );
    function refresh() {
      setDueItems(getSkillsDueForReview(getProgress().skills, skillMeta));
    }
    refresh();
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  if (dueItems.length === 0) {
    // What the queue does (src/lib/spaced-repetition.ts): a finished skill
    // is due once a day has passed since it was last practiced.
    const none = stats.completedSkills === 0;
    return (
      <div className="card flex flex-col items-center px-6 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bridge-50 text-bridge-600" aria-hidden>
          <Icon name="review" size={24} />
        </span>
        <h2 className="mt-3 text-base font-semibold text-slate-900">{none ? "Nothing to review yet" : "Nothing due right now"}</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
          {none
            ? "Finish a skill and it comes back here a day later for a quick check."
            : "Skills you have finished come back here a day after you last practiced them."}
        </p>
        {continueTarget ? (
          <Link href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`} className="btn-primary mt-5 inline-flex">
            Continue: {continueTarget.skillTitle}
            <Icon name="arrow-right" size={16} />
          </Link>
        ) : (
          <Link href="/" className="btn-primary mt-5 inline-flex">
            Continue the course
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <p className="panel-title">
          {dueItems.length} skill{dueItems.length !== 1 ? "s" : ""} due for review
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {dueItems.map((item) => (
          <li key={item.skillId}>
            <Link
              href={`/learn/${item.unitId}/${item.skillId}`}
              className="group flex items-center gap-4 px-5 py-3.5 transition duration-150 ease-out hover:translate-x-1 hover:bg-slate-50"
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
