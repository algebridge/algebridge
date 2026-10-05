"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { MathText, PromptText } from "@/components/PromptText";
import { SignKeys } from "@/components/SignKeys";
import { ScratchpadButton } from "@/components/Scratchpad";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { MistakeNote } from "@/components/MistakeNote";
import { WorkedSteps } from "@/components/WorkedSteps";
import { diagnoseMistake } from "@/lib/diagnose";
import { hueVars, unitHue } from "@/lib/hues";
import { stripVariantTag } from "@/lib/personalize";
import { displayAnswer } from "@/lib/problem-utils";
import { rinkPayFor, type RinkProblem } from "@/lib/rink";
import { useDialogFocus } from "@/components/useDialogFocus";

/** How a game answer went: right or not, what it paid, and what was given when it was wrong. */
export interface GameVerdict {
  right: boolean;
  paid: number;
  given?: string;
  /** In a match, what a right answer means: "Point to Maya. 3 to 2." */
  note?: string;
}

/** In a two-player match: whose question it is, in their color, and whether it is a steal. */
export interface GameTurn {
  name: string;
  color: string;
  steal: boolean;
  /** Who missed it, for the steal line. */
  missedBy?: string;
  /** The choice they missed with, crossed out for the steal. */
  missedChoice?: string;
}

/**
 * The problem a game stops for, over everything: the same card on the rink
 * and on every court. Head math, so the calculator stays away; the Draw
 * button on the card is there for working it out.
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
  turn,
}: {
  open: RinkProblem;
  verdict: GameVerdict | null;
  answer: string;
  setAnswer: (v: string) => void;
  onCheck: (given: string) => void;
  onContinue: () => void;
  continueLabel: string;
  note: string;
  label: string;
  /** A match: the question belongs to one side, and pays nothing. */
  turn?: GameTurn;
}) {
  const answerRef = useRef<HTMLInputElement>(null);
  // Keyboard: the card takes the focus (the answer box, or the first choice), Tab stays in it, and the
  // focus goes back to the game when it closes.
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true);
  const problem = open.problem;
  // A wrong answer is read for where it went wrong, in the student's own numbers.
  const mistake = verdict && !verdict.right && verdict.given !== undefined ? diagnoseMistake(problem, { given: verdict.given }) : null;
  return (
    <div ref={dialogRef} className="fixed inset-0 z-[600] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={label}>
      <div style={hueVars(unitHue(open.unitId))} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="hue-banner flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide">
            Unit {open.unitNumber} · {open.skillTitle}
          </p>
          {!turn && (
            <div className="flex items-center gap-1 text-xs font-semibold">
              <BridgeysLogo size={13} />+{rinkPayFor(open.skillId)}
            </div>
          )}
        </div>
        <div className="p-4">
          {turn && !verdict && (
            <p
              key={`turn-${turn.name}-${turn.steal}`}
              className="animate-pop-in mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white"
              style={{ background: turn.color }}
              role="status"
            >
              <Icon name={turn.steal ? "flame" : "versus"} size={16} />
              {turn.steal ? `${turn.missedBy ?? "That"} missed. ${turn.name}, steal it!` : `${turn.name}'s question`}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">{note}</p>
            <ScratchpadButton />
          </div>
          <PromptText text={stripVariantTag(problem.prompt)} />
          {!verdict ? (
            problem.type === "multiple-choice" && problem.choices ? (
              <div className="mt-4 grid gap-2">
                {problem.choices.map((choice, i) => {
                  // In a steal, the choice already missed is crossed out.
                  const out = !!turn?.steal && choice === turn.missedChoice;
                  return (
                  <button
                    key={`${choice}-${turn?.steal ? "steal" : ""}`}
                    type="button"
                    disabled={out}
                    data-autofocus={i === (turn?.steal && problem.choices?.[0] === turn.missedChoice ? 1 : 0) ? "" : undefined}
                    onClick={() => onCheck(choice)}
                    className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 ${out ? "pointer-events-none text-slate-400 line-through opacity-60" : ""}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
                      {/* Numbered like practice, where the 1-4 keys pick a choice. */}
                      {i + 1}
                    </span>
                    <MathText text={choice} />
                  </button>
                  );
                })}
              </div>
            ) : (
              <form
                key={turn ? `answer-${turn.name}-${turn.steal}` : "answer"}
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  onCheck(answer);
                }}
              >
                <input
                  ref={answerRef}
                  autoFocus
                  data-autofocus=""
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
                    verdict.note ? (
                      verdict.note
                    ) : verdict.paid > 0 ? (
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
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {mistake?.note && <MistakeNote diagnosis={mistake} given={verdict.given} />}
                  <div className="px-1">
                    <WorkedSteps text={problem.explanation} />
                  </div>
                </div>
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
    <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-slate-800 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs">
      {children}
    </span>
  );
}

const HOW_TO_SEEN = "algebridge:game-howto:";
const HOW_TO_MS = 4000;
/** The demo's memory of which how-tos have shown: for the page's life, never in storage. */
const seenInDemo = new Set<string>();

/**
 * How to play, over the court. For the first 4 seconds of someone's first
 * game of each kind it sits large in the middle, where it gets read; then
 * it goes back to its small place at the bottom. Marked as seen only once
 * it has shown in full, so leaving at once shows it again next time. In
 * the demo (`demo`) it is remembered in memory, so nothing is stored.
 */
export function GameHowTo({ id, children, demo = false }: { id: string; children: React.ReactNode; demo?: boolean }) {
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    const key = HOW_TO_SEEN + id;
    try {
      if (demo ? seenInDemo.has(key) : window.localStorage.getItem(key)) return;
    } catch {
      // No storage (a private window): the line stays in its usual place.
      return;
    }
    setIntro(true);
    const timer = window.setTimeout(() => {
      setIntro(false);
      if (demo) {
        seenInDemo.add(key);
        return;
      }
      try {
        window.localStorage.setItem(key, "1");
      } catch {
        /* Remembering it is a nicety. */
      }
    }, HOW_TO_MS);
    return () => window.clearTimeout(timer);
  }, [id, demo]);
  return (
    <p
      className={
        intro
          ? "animate-pop-in pointer-events-none absolute left-1/2 top-1/2 w-max max-w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white/95 px-4 py-3 text-center text-sm font-semibold text-slate-800 shadow-lg"
          : "pointer-events-none absolute bottom-2 left-2 right-2 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-700 sm:bottom-3 sm:left-3 sm:right-auto"
      }
      style={intro ? { zIndex: 900 } : undefined}
    >
      {children}
    </p>
  );
}
