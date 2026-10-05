"use client";

import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

const PHONE = "(max-width: 767.98px)";

/**
 * True on a phone, where long reference blocks fold. False on the server,
 * before the page's script runs, and while printing, so the printed handout
 * and a desktop reader always get every row.
 */
function usePhoneFold(): boolean {
  const [fold, setFold] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    let printing = false;
    const update = () => setFold(mq.matches && !printing);
    // The print snapshot is taken right after beforeprint, so open up synchronously.
    const before = () => {
      printing = true;
      flushSync(() => setFold(false));
    };
    const after = () => {
      printing = false;
      update();
    };
    update();
    mq.addEventListener("change", update);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return fold;
}

const CHEVRON = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Any long block that a phone shows folded behind one line. */
export function PhoneFold({ summary, children }: { summary: string; children: ReactNode }) {
  const fold = usePhoneFold();
  if (!fold) return <>{children}</>;
  return (
    <details className="group mt-4 rounded-2xl border border-slate-200 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{summary}</span>
        {CHEVRON}
      </summary>
      <div className="border-t border-slate-200 px-4 pb-1">{children}</div>
    </details>
  );
}

/**
 * One unit's skills and standards. On a phone, where fifteen tables made
 * this page about 20,000px tall, each unit folds to its name and opens on a
 * tap. Everywhere else, in print, and before the page's script runs, it is
 * the plain open block, so the handout and a desktop reader see every row.
 */
export function UnitStandards({
  number,
  title,
  skillCount,
  className,
  children,
}: {
  number: number;
  title: string;
  skillCount: number;
  className: string;
  children: ReactNode;
}) {
  const fold = usePhoneFold();

  const heading = (
    <>
      <span className="shrink-0 text-xs font-semibold text-bridge-700">Unit {number}</span>
      <span>{title}</span>
    </>
  );

  if (!fold) {
    return (
      <div className={className}>
        <h3 className="flex items-baseline gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-900">
          {heading}
        </h3>
        {children}
      </div>
    );
  }

  return (
    <details className={`group ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 bg-slate-50/80 px-4 py-2.5 group-open:border-b group-open:border-slate-200 [&::-webkit-details-marker]:hidden">
        <h3 className="flex min-w-0 flex-1 items-baseline gap-2 text-sm font-semibold text-slate-900">{heading}</h3>
        <span className="shrink-0 text-xs text-slate-500">
          {skillCount} {skillCount === 1 ? "skill" : "skills"}
        </span>
        {CHEVRON}
      </summary>
      {children}
    </details>
  );
}
