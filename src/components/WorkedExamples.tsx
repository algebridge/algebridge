"use client";

import { useState } from "react";
import { MathText, PromptText } from "@/components/PromptText";
import { workedExamplesFor } from "@/data/worked-examples";

/**
 * "See it done": every kind of problem the skill's practice deals, solved in
 * front of the student before they try one. Each step shows the work and the
 * reason for it, so the video is not the only place the method is taught.
 */
export function WorkedExamples({ skillId }: { skillId: string }) {
  const examples = workedExamplesFor(skillId);
  const [at, setAt] = useState(0);
  if (!examples.length) return null;
  const ex = examples[Math.min(at, examples.length - 1)];

  return (
    <div className="rounded-2xl border border-slate-200 bg-surface shadow-panel">
      {examples.length > 1 && (
        <div role="tablist" aria-label="Kinds of problems" className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-4 pt-3 pb-2.5">
          {examples.map((e, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === at}
              onClick={() => setAt(i)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                i === at ? "hue-solid border-transparent" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {i + 1}. {e.kind}
            </button>
          ))}
        </div>
      )}
      <div className="p-4 sm:p-5" role="tabpanel">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          Example {at + 1} of {examples.length}
          {examples.length === 1 ? `: ${ex.kind}` : ""}
        </p>
        <PromptText text={ex.card.prompt} />
        {ex.card.type === "multiple-choice" && ex.card.choices && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ex.card.choices.map((c) => (
              <li key={c} className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-700">
                <MathText text={c} />
              </li>
            ))}
          </ul>
        )}
        {ex.plan && (
          <div className="mt-4 rounded-xl bg-sky-50 px-3.5 py-2.5 ring-1 ring-sky-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">The plan</p>
            <p className="mt-0.5 text-[15px] leading-relaxed text-slate-800">
              <MathText text={ex.plan} />
            </p>
          </div>
        )}
        <ol className="mt-4 space-y-3">
          {ex.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="hue-wash mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-mono text-[14px] font-semibold leading-snug text-slate-900">
                  <MathText text={s.work} />
                </p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-slate-700">
                  <MathText text={s.why} />
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm text-emerald-900">
          Answer: <strong className="font-semibold"><MathText text={ex.answer} /></strong>
        </p>
        {ex.check && (
          <p className="mt-2 flex gap-2 text-[15px] leading-relaxed text-slate-700">
            <span className="shrink-0 font-semibold text-emerald-700">Check:</span>
            <span>
              <MathText text={ex.check} />
            </span>
          </p>
        )}
        {examples.length > 1 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setAt((at + 1) % examples.length)}
              className="text-sm font-semibold text-bridge-700 hover:underline -my-1 rounded px-1 py-1"
            >
              {at + 1 < examples.length ? `Next kind: ${examples[at + 1].kind}` : "Back to the first example"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
