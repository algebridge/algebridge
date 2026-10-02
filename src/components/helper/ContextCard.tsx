"use client";

import { useMemo, useState } from "react";
import { MathText } from "@/components/PromptText";
import { mathSpans } from "@/lib/personalize";

/**
 * "Working on": the problem practice published, with its math picked out the
 * way the problem card does it, so the student can see the helper is looking
 * at the same thing they are.
 */
export function ContextCard({ skillTitle, problem }: { skillTitle?: string; problem: string }) {
  const [full, setFull] = useState(false);
  const parts = useMemo(() => {
    const out: { text: string; math: boolean }[] = [];
    let cursor = 0;
    for (const span of mathSpans(problem)) {
      const at = problem.indexOf(span, cursor);
      if (at < 0) continue;
      if (at > cursor) out.push({ text: problem.slice(cursor, at), math: false });
      out.push({ text: span, math: true });
      cursor = at + span.length;
    }
    if (cursor < problem.length) out.push({ text: problem.slice(cursor), math: false });
    return out;
  }, [problem]);
  const long = problem.length > 150;

  return (
    <section
      key={problem}
      aria-label="The problem you are working on"
      className="helper-in mx-3 mb-2 rounded-xl border border-bridge-100 bg-bridge-50 px-3 py-2"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-bridge-700">Working on</span>
        {skillTitle && (
          <span className="truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-bridge-800 ring-1 ring-bridge-100">
            {skillTitle}
          </span>
        )}
      </div>
      <p className={`mt-1 text-[13px] leading-snug text-slate-700 ${full ? "" : "line-clamp-3"}`}>
        {parts.map((part, i) =>
          part.math ? (
            <span key={i} className="font-semibold text-slate-950">
              <MathText text={part.text} />
            </span>
          ) : (
            <span key={i}>
              <MathText text={part.text} />
            </span>
          )
        )}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setFull((v) => !v)}
          className="mt-0.5 text-[11px] font-semibold text-bridge-700 hover:text-bridge-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-400"
        >
          {full ? "Show less" : "Show all"}
        </button>
      )}
    </section>
  );
}
