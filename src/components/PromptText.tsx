"use client";

import { useMemo } from "react";
import { mathSpans } from "@/lib/personalize";

/**
 * The problem, with its math picked out. The equation is what gets solved and
 * the sentence around it is context, so the eye should be able to land on
 * the math without reading the rest.
 */
export function PromptText({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: { text: string; math: boolean }[] = [];
    let cursor = 0;
    for (const span of mathSpans(text)) {
      const at = text.indexOf(span, cursor);
      if (at < 0) continue;
      if (at > cursor) out.push({ text: text.slice(cursor, at), math: false });
      out.push({ text: span, math: true });
      cursor = at + span.length;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), math: false });
    return out;
  }, [text]);

  return (
    <p className="mt-2 text-base leading-relaxed text-slate-700">
      {parts.map((part, i) =>
        part.math ? (
          <span
            key={i}
            className={`font-semibold text-slate-950 ${part.text.length <= 28 ? "whitespace-nowrap" : ""}`}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </p>
  );
}
