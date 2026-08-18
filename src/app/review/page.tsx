"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { units } from "@/data/curriculum";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { getSkillsDueForReview, type ReviewItem } from "@/lib/spaced-repetition";
import { PracticeGate } from "@/components/PracticeGate";

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

  useEffect(() => {
    const skillMeta = units.flatMap((u) =>
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
    return (
      <div className="card text-center">
        <h2 className="text-base font-semibold text-slate-900">Nothing due right now</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Complete a few more skills and they&apos;ll show up here for review.
        </p>
        <Link href="/" className="btn-primary mt-5 inline-flex">
          Continue the course
        </Link>
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
              <span className="shrink-0 text-sm text-slate-300 group-hover:text-bridge-600">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
