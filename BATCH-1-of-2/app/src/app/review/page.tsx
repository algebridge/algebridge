"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { units } from "@/data/curriculum";
import { getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";
import { getSkillsDueForReview, type ReviewItem } from "@/lib/spaced-repetition";

export default function ReviewPage() {
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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-wide text-slate-900">🔄 Bridge Review</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Spaced repetition keeps your algebra strong. Skills you&apos;ve mastered
          reappear for review at 1, 3, 7, 14, and 30 days — the same approach
          Khan Academy uses in Mastery Challenges.
        </p>
      </header>

      {dueItems.length === 0 ? (
        <div className="card text-center">
          <span className="text-4xl">✨</span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">All caught up!</h2>
          <p className="mt-2 text-slate-600">
            No skills are due for review right now. Keep learning new skills and
            check back tomorrow.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Continue Course →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            {dueItems.length} skill{dueItems.length !== 1 ? "s" : ""} due for review
          </p>
          {dueItems.map((item) => (
            <Link
              key={item.skillId}
              href={`/learn/${item.unitId}/${item.skillId}`}
              className="skill-card group"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-span-100 text-lg">
                🔄
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 group-hover:text-bridge-700">
                  {item.skillTitle}
                </h3>
                <p className="text-sm text-slate-500">
                  {item.unitTitle} · {item.dueReason}
                </p>
              </div>
              <span className="text-slate-300 group-hover:text-bridge-500">→</span>
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-bridge-200 bg-bridge-50/50 p-4 text-sm text-slate-600">
        <strong className="text-bridge-800">Why review?</strong> Research shows
        that revisiting mastered skills at increasing intervals prevents
        &quot;Swiss cheese&quot; gaps — the #1 reason students struggle in later
        math courses.
      </div>
    </div>
  );
}
