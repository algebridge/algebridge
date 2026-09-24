"use client";

import { useRef } from "react";
import { Icon } from "@/components/Icon";
import { MathText, PromptText } from "@/components/PromptText";
import { SignKeys } from "@/components/SignKeys";
import { ScratchpadButton } from "@/components/Scratchpad";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { hueVars, unitHue } from "@/lib/hues";
import { stripVariantTag } from "@/lib/personalize";
import { displayAnswer } from "@/lib/problem-utils";
import { rinkPayFor, type RinkProblem } from "@/lib/rink";

/**
 * The problem a game stops for, over everything: the same card on the rink
 * and on every court. Head math, so the calculator stays away; the pen in
 * the corner is there for working it out.
 */
export function GameProblemDialog({
  open,
  verdict,
  answer,
  setAnswer,
  onCheck,
  onContinue,
  continueLabel,
  note,
  label,
}: {
  open: RinkProblem;
  verdict: { right: boolean; paid: number } | null;
  answer: string;
  setAnswer: (v: string) => void;
  onCheck: (given: string) => void;
  onContinue: () => void;
  continueLabel: string;
  note: string;
  label: string;
}) {
  const answerRef = useRef<HTMLInputElement>(null);
  const problem = open.problem;
  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <div style={hueVars(unitHue(open.unitId))} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="hue-banner flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide">
            Unit {open.unitNumber} · {open.skillTitle}
          </p>
          <div className="flex items-center gap-1 text-xs font-semibold">
            <BridgeysLogo size={13} />+{rinkPayFor(open.skillId)}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">{note}</p>
            <ScratchpadButton />
          </div>
          <PromptText text={stripVariantTag(problem.prompt)} />
          {!verdict ? (
            problem.type === "multiple-choice" && problem.choices ? (
              <div className="mt-4 grid gap-2">
                {problem.choices.map((choice, i) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => onCheck(choice)}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <MathText text={choice} />
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onCheck(answer);
                }}
              >
                <input
                  ref={answerRef}
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="Your answer"
                  placeholder="Your answer"
                  className="field min-w-0 flex-1 text-lg"
                />
                <SignKeys value={answer} onChange={setAnswer} inputRef={answerRef} />
                <button type="submit" disabled={!answer.trim()} className="hue-solid rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50">
                  Check
                </button>
              </form>
            )
          ) : (
            <div className="mt-4">
              <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ${verdict.right ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                <Icon name={verdict.right ? "check" : "review"} size={18} className="shrink-0" />
                <p>
                  {verdict.right ? (
                    verdict.paid > 0 ? (
                      `Right. +${verdict.paid} Bridgeys.`
                    ) : (
                      "Right. The games have paid today's cap, so this one is for practice."
                    )
                  ) : (
                    <>
                      The answer was <MathText text={displayAnswer(problem)} />.
                    </>
                  )}
                </p>
              </div>
              {!verdict.right && (
                <p className="mt-2 px-1 text-sm text-slate-600">
                  <MathText text={problem.explanation} />
                </p>
              )}
              <button type="button" autoFocus onClick={onContinue} className="btn-primary mt-4 w-full">
                {continueLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A small label on the game stage. */
export function GameChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-slate-800 backdrop-blur-sm sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs">
      {children}
    </span>
  );
}
