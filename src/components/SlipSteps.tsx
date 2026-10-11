"use client";

import { useEffect, useState } from "react";
import { MathText } from "@/components/PromptText";
import { explanationSteps } from "@/lib/diagnose";

/**
 * Where a wrong answer went off track, drawn instead of written out: the
 * worked steps up to the slip, with the slip's step marked. The steps after
 * it stay folded, so the card does not hand over the answer while the
 * student can still fix it.
 *
 * When the slip is not known (an answer no trap explains), it walks the
 * steps one at a time instead: compare your work with each line in turn.
 * The last step, the one that holds the answer, is never shown here.
 */
export function SlipSteps({ explanation, at, compact = false }: { explanation: string; at?: number | null; compact?: boolean }) {
  const steps = explanationSteps(explanation);
  const known = typeof at === "number" && at >= 0 && at < steps.length;
  // Never past the step before the answer, unless the slip is in the last step itself.
  const lastShowable = known ? at! : Math.max(0, steps.length - 2);
  const [shown, setShown] = useState(known ? at! + 1 : 1);
  useEffect(() => setShown(known ? at! + 1 : 1), [explanation, at, known]);
  if (steps.length < 2) return null;

  const visible = steps.slice(0, Math.min(shown, lastShowable + 1));
  const hidden = steps.length - visible.length;
  return (
    <div className={compact ? "mt-2" : "mt-2.5"}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {known ? "Where it went off track" : "Check your work line by line"}
      </p>
      <ol className="mt-1.5 space-y-1">
        {visible.map((step, i) => {
          const slip = known && i === at;
          return (
            <li
              key={i}
              className={`flex items-start gap-2 rounded-lg px-2 py-1 ${
                slip ? "bg-rose-50 ring-2 ring-rose-400" : "bg-white/60"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  slip ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {i + 1}
              </span>
              <span className={`min-w-0 leading-relaxed ${slip ? "font-semibold text-rose-900" : "text-slate-700"}`}>
                <MathText text={step} />
                {slip && <span className="ml-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-rose-600">Your slip</span>}
              </span>
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="flex items-center gap-2 px-2 text-xs text-slate-500">
            <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-300">
              …
            </span>
            {known
              ? `${hidden} more step${hidden === 1 ? "" : "s"}: fix this one and finish it yourself.`
              : `${hidden} more step${hidden === 1 ? "" : "s"}.`}
            {!known && visible.length <= lastShowable && (
              <button type="button" onClick={() => setShown((n) => n + 1)} className="font-semibold text-bridge-700 hover:underline">
                Show the next step
              </button>
            )}
          </li>
        )}
      </ol>
    </div>
  );
}
