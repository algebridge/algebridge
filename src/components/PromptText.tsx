"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { mathSpans } from "@/lib/personalize";

/**
 * A power written with a caret ("x^3", "10^5", "x^(1/3)", "2^(−3)"), found so
 * it can be drawn as a superscript. The exponent is a bracketed group, a
 * signed number, or a single letter.
 */
const POWER = /\^(\([^()]{1,12}\)|[-−]?\d+(?:\.\d+)?|[a-z])/g;

/**
 * Text with its powers drawn as powers. Students type "^" into the
 * calculator, but nobody writes it on paper, and "x^(1/3)" on a problem card
 * reads as code rather than algebra.
 */
export function MathText({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of String(text ?? "").matchAll(POWER)) {
    const at = m.index ?? 0;
    if (at > cursor) out.push(<Fragment key={key++}>{text.slice(cursor, at)}</Fragment>);
    // "(1/3)" draws as a raised 1/3; the brackets were only there for the caret.
    const exp = m[1].startsWith("(") ? m[1].slice(1, -1) : m[1];
    out.push(
      <sup key={key++} className="ml-px text-[0.72em] font-semibold">
        {exp.replace(/^-/, "−")}
      </sup>
    );
    cursor = at + m[0].length;
  }
  if (cursor < text.length) out.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);
  return <>{out}</>;
}

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
            <MathText text={part.text} />
          </span>
        ) : (
          <span key={i}>
            <MathText text={part.text} />
          </span>
        )
      )}
    </p>
  );
}
