"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { QuoteCard } from "@/components/QuoteCard";
import { quoteForFinish } from "@/data/quotes";
import { useDialogFocus } from "@/components/useDialogFocus";
import { units } from "@/data/curriculum";
import { hueVars, unitHue } from "@/lib/hues";
import type { Skill, Unit } from "@/types";

/** What the finish earned, worked out by the practice when the last problem lands. */
export interface SkillDoneFacts {
  paid: number;
  unitNumber: number | null;
  unitBonus: number;
  prizeName: string | null;
}

/**
 * The finish, where the student is: a card over the page the moment the last
 * problem lands, so nobody scrolls up to find out the skill is done. The
 * confetti falls over it (its canvas sits above), Escape, the backdrop and
 * Keep practicing close it, and focus goes back to the practice.
 */
export function SkillDone({
  facts,
  skill,
  unit,
  required,
  next,
  onClose,
}: {
  facts: SkillDoneFacts;
  skill: Skill;
  unit: Unit | undefined;
  /** How many right on the first try finished it, drawn as filled pips. */
  required: number;
  next: { href: string; title: string } | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, true, onClose);

  // The page under it holds still while it is up.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const unitDone = facts.unitNumber !== null;
  const earned = facts.paid + facts.unitBonus;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div aria-hidden onClick={onClose} className="animate-done-fade absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-done-title"
        style={hueVars(unitHue(unit?.id ?? units[0].id))}
        className="hue-banner animate-done-in relative w-full max-w-md overflow-hidden rounded-3xl px-6 pb-6 pt-8 text-center shadow-2xl sm:px-8"
      >
        <DoneMark trophy={unitDone} />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] opacity-90">
          {unitDone ? `Unit ${facts.unitNumber} complete` : "Skill complete"}
        </p>
        <h2 id="skill-done-title" className="mt-2 text-2xl font-bold leading-tight">
          {skill.title}
        </h2>

        <div className="mt-4 flex items-center justify-center gap-1.5" role="img" aria-label={`${required} of ${required} right on the first try`}>
          {Array.from({ length: required }, (_, i) => (
            <span key={i} aria-hidden className="done-pip h-3 w-3 rounded-full bg-white shadow-sm" style={{ animationDelay: `${250 + i * 90}ms` }} />
          ))}
        </div>
        <p className="mt-2 text-sm opacity-95">
          {required} right on the first try.
          {" "}
          <span className="inline-flex items-center gap-1 font-semibold">
            <BridgeysLogo size={15} />+{earned} Bridgeys
          </span>
          {facts.prizeName && <span> and the {facts.prizeName} for your house.</span>}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {next ? (
            <Link
              data-autofocus
              href={next.href}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-surface px-5 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              Next: {next.title}
              <Icon name="arrow-right" size={16} className="ml-1.5 shrink-0" />
            </Link>
          ) : (
            <Link
              data-autofocus
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-surface px-5 py-2.5 text-base font-semibold text-slate-900 shadow-sm transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              Back to the course
            </Link>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {unitDone && unit && (
              <Link
                href={`/certificate/${unit.id}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/35 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
              >
                <Icon name="printer" size={15} />
                Your certificate
              </Link>
            )}
            {facts.prizeName && (
              <Link
                href="/house"
                className="inline-flex min-h-11 items-center rounded-xl border border-white/35 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
              >
                Place it
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-xl border border-white/35 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              Keep practicing
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-white/20 pt-3 text-left">
          <QuoteCard quote={quoteForFinish(skill.id)} variant="line" />
        </div>
      </div>
    </div>
  );
}

/** The ring draws itself around the mark, then the mark pops into it (globals.css). */
function DoneMark({ trophy }: { trophy: boolean }) {
  return (
    <span className="relative mx-auto flex h-20 w-20 items-center justify-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="40" cy="40" r="36" fill="rgba(255,255,255,0.14)" />
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" pathLength={100} className="done-ring" />
      </svg>
      <span className="animate-done-icon relative">
        <Icon name={trophy ? "trophy" : "check"} size={36} />
      </span>
    </span>
  );
}
