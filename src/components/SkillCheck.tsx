"use client";

import { useEffect, useRef, useState } from "react";
import type { PracticeProblem, Skill } from "@/types";
import { getFreshProblemsForSkill } from "@/data/problem-banks";
import { MathText, PromptText } from "@/components/PromptText";
import { MistakeNote } from "@/components/MistakeNote";
import { WorkedSteps } from "@/components/WorkedSteps";
import { AnswerField, type AnswerFieldHandle } from "@/components/AnswerField";
import { ScratchpadButton, useScratchpadSurface } from "@/components/Scratchpad";
import { Icon } from "@/components/Icon";
import { diagnoseMistake } from "@/lib/diagnose";
import { gradeAnswer } from "@/lib/grading";
import { skillOffersCalculator } from "@/data/problem-banks";
import { CHECK_LENGTH, today } from "@/lib/path";
import { recordSkillCheck } from "@/lib/progress";
import { stripVariantTag } from "@/lib/personalize";

type Phase = "asking" | "right" | "passed" | "failed";

/**
 * "Show what you know": a few of the skill's problems, all to be answered
 * right in a row, to open a skill ahead of the learning path. The try is
 * spent the moment it starts, so reloading the page mid-check does not buy
 * another one. A choice is picked, then checked, so one stray tap on a
 * phone never ends the day's one try.
 */
export function SkillCheck({
  skill,
  afterTitle,
  onExit,
}: {
  skill: Skill;
  /** The skill before it on the path, which opens this one when finished. */
  afterTitle: string;
  onExit: () => void;
}) {
  const [problems] = useState<PracticeProblem[]>(() =>
    getFreshProblemsForSkill(skill.id, skill.problems)
      .filter((p) => (p.type === "numeric" || p.type === "multiple-choice") && p.answer !== undefined)
      .slice(0, CHECK_LENGTH)
  );
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("asking");
  /** The answer that ended the check, read for where it went wrong. */
  const [lastGiven, setLastGiven] = useState("");
  const answerField = useRef<AnswerFieldHandle>(null);
  const choices = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);
  /** Unfinished arithmetic or a typo, said gently: the one try of the day is not spent on it. */
  const [nudge, setNudge] = useState<string | null>(null);
  const day = useRef(today()).current;
  useScratchpadSurface(`${skill.id}:${index}`);

  useEffect(() => {
    if (problems.length) recordSkillCheck(skill.id, false, day);
  }, [skill.id, problems.length, day]);

  // The keyboard follows the question: the answer box, or the first choice;
  // and the verdict screen, so a screen reader starts reading it at once.
  useEffect(() => {
    if (phase === "asking") {
      if (answerField.current) answerField.current.focus();
      else choices.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    } else if (phase === "failed" || phase === "passed") {
      result.current?.focus({ preventScroll: true });
    }
  }, [phase, index]);

  const problem = problems[index];

  if (!problems.length) {
    return (
      <div className="text-center">
        <p className="text-sm text-slate-600">This skill opens by finishing {afterTitle}.</p>
        <button type="button" onClick={onExit} className="btn-secondary mt-4 text-sm">
          Back
        </button>
      </div>
    );
  }

  function submit(given: string) {
    if (phase !== "asking" || !given.trim()) return;
    const verdict = gradeAnswer(problem, given, { expressions: skillOffersCalculator(skill.id, skill.problems) });
    if (verdict === "simplify" || verdict === "unreadable") {
      setNudge(verdict === "simplify" ? "Finish the arithmetic, then type one number, like 12, -3 or 2/3." : "Type your answer as a number, like 12, -3, 2/3 or 0.75.");
      return;
    }
    setNudge(null);
    if (verdict !== "right") {
      setLastGiven(given);
      setPhase("failed");
      return;
    }
    if (index + 1 === problems.length) {
      recordSkillCheck(skill.id, true, day);
      setPhase("passed");
      return;
    }
    setPhase("right");
    window.setTimeout(() => {
      setIndex((i) => i + 1);
      setAnswer("");
      setPicked(null);
      setPhase("asking");
    }, 700);
  }

  if (phase === "passed") {
    // The page opens the lesson as soon as progress saves; this shows only
    // for the moment in between.
    return (
      <div ref={result} tabIndex={-1} role="status" className="text-center focus:outline-none">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <Icon name="check" size={22} />
        </span>
        <p className="mt-3 font-semibold text-slate-900">
          {problems.length} for {problems.length}. {skill.title} is open.
        </p>
      </div>
    );
  }

  if (phase === "failed") {
    const mistake = diagnoseMistake(problem, { given: lastGiven });
    return (
      <div ref={result} tabIndex={-1} className="text-center focus:outline-none">
        <p role="status" className="font-semibold text-slate-900">
          Good try. The answer was <span className="font-semibold text-slate-900"><MathText text={String(problem.answer)} /></span>.
        </p>
        {mistake.note && (
          <div className="mt-3 text-left">
            <MistakeNote diagnosis={mistake} given={lastGiven} />
          </div>
        )}
        <div className="mt-3 text-left text-sm text-slate-600">
          <WorkedSteps text={problem.explanation} />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Your next try opens tomorrow, and finishing {afterTitle} opens this skill today.
        </p>
        <button type="button" onClick={onExit} className="btn-secondary mt-4 text-sm">
          Back
        </button>
      </div>
    );
  }

  const multiple = problem.type === "multiple-choice" && !!problem.choices;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">
          Question {index + 1} of {problems.length}
        </p>
        <ScratchpadButton />
        <span className="flex gap-1" aria-hidden>
          {problems.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full ${i < index || (i === index && phase === "right") ? "bg-emerald-500" : i === index ? "hue-bar" : "bg-slate-200"}`}
            />
          ))}
        </span>
      </div>
      {/* The rule, on the screen where it applies. */}
      <p className="mt-1 text-xs text-slate-500">
        All {problems.length} right in a row opens the skill. One try a day.
      </p>
      <PromptText text={stripVariantTag(problem.prompt)} className="mt-3 text-lg leading-relaxed text-slate-800" />

      {multiple ? (
        <>
          <div ref={choices} role="group" aria-label="Answer choices" className="mt-4 grid gap-2 sm:grid-cols-2">
            {problem.choices!.map((choice, i) => {
              const on = picked === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={phase !== "asking"}
                  aria-pressed={on}
                  onClick={() => {
                    setPicked(choice);
                    setNudge(null);
                  }}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition disabled:opacity-60 ${
                    on ? "hue-tint hue-ink border-current" : "border-slate-200 bg-white text-slate-800 hover:border-bridge-300 hover:bg-bridge-50"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                      on ? "hue-solid" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <MathText text={choice} />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => (picked ? submit(picked) : setNudge("Pick an answer first."))}
            disabled={phase !== "asking"}
            className="hue-solid mt-3 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            Check
          </button>
          {nudge && (
            <p role="status" className="mt-2 text-sm font-medium text-slate-600">
              {nudge}
            </p>
          )}
        </>
      ) : (
        <div className="mt-4">
          <AnswerField
            key={index}
            handle={answerField}
            value={answer}
            onChange={(text) => {
              setAnswer(text);
              setNudge(null);
            }}
            onEnter={() => submit(answer)}
            placeholder="Your answer"
            locked={phase !== "asking"}
            full={false}
            note={nudge}
          />
          <button
            type="button"
            onClick={() => (answer.trim() ? submit(answer) : setNudge("Type your answer first."))}
            disabled={phase !== "asking"}
            className="hue-solid mt-3 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            Check
          </button>
        </div>
      )}
      <p className="mt-3 h-5 text-sm font-medium text-emerald-700" role="status">
        {phase === "right" ? "Right." : ""}
      </p>
    </div>
  );
}
