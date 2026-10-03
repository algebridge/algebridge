"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PracticeProblem } from "@/types";
import { units } from "@/data/curriculum";
import { getFreshProblemsForSkill } from "@/data/problem-banks";
import { answerIsRight } from "@/lib/grading";
import { diagnoseMistake, type Diagnosis } from "@/lib/diagnose";
import { AnswerFeedback } from "@/components/AnswerFeedback";
import { MistakeNote } from "@/components/MistakeNote";
import { WorkedSteps } from "@/components/WorkedSteps";
import { PromptText } from "@/components/PromptText";
import { Icon } from "@/components/Icon";
import { Archie } from "@/components/archie/Archie";

/** How many problems a visitor gets before the card asks them to keep going with an account. */
const SAMPLE_SIZE = 3;

/** The first skill of the course: what a visitor meets first on the platform too. */
const SKILL = units[0].skills[0];
const UNIT = units[0];

/**
 * Three real practice problems with the real feedback, for someone who has
 * no account yet: the same generator, grading and mistake diagnosis the
 * course uses, and nothing saved. Lives at /try, and algebridge.org embeds
 * it in an iframe, so every link opens in the top window and the page tells
 * its parent how tall it is.
 */
export function TryProblem({ embed = false }: { embed?: boolean }) {
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [tries, setTries] = useState(0);
  const [state, setState] = useState<"open" | "wrong" | "right" | "shown">("open");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [given, setGiven] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Generated after mount: the bank is seeded at random, and a server render
  // would disagree with the browser's.
  useEffect(() => {
    const fresh = getFreshProblemsForSkill(SKILL.id, SKILL.problems).filter(
      (p) => p.type === "numeric" || p.type === "multiple-choice"
    );
    setProblems(fresh.slice(0, SAMPLE_SIZE));
  }, []);

  // Inside algebridge.org's iframe: report the height, so the frame fits
  // the card instead of scrolling inside it.
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    const el = rootRef.current;
    if (!el) return;
    const send = () => window.parent.postMessage({ type: "algebridge-try-height", height: Math.ceil(el.getBoundingClientRect().height) }, "*");
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, [problems.length, index, state]);

  const problem = problems[index];
  const done = problems.length > 0 && index >= problems.length;
  const seed = useMemo(() => index * 7 + tries, [index, tries]);

  const check = useCallback(
    (value: string) => {
      if (!problem || state === "right" || state === "shown") return;
      const trimmed = value.trim();
      if (!trimmed) {
        inputRef.current?.focus();
        return;
      }
      setGiven(trimmed);
      if (answerIsRight(problem, trimmed)) {
        setState("right");
        setDiagnosis(null);
        return;
      }
      const next = tries + 1;
      setTries(next);
      setDiagnosis(diagnoseMistake(problem, { given: trimmed }));
      setState("wrong");
    },
    [problem, state, tries]
  );

  function advance() {
    setIndex((i) => i + 1);
    setAnswer("");
    setTries(0);
    setState("open");
    setDiagnosis(null);
    setGiven("");
  }

  useEffect(() => {
    if (state === "open" && problem?.type === "numeric") inputRef.current?.focus();
  }, [state, problem]);

  const pad = embed ? "p-4 sm:p-5" : "p-5 sm:p-7";

  if (problems.length === 0) {
    return (
      <div ref={rootRef} className={`try-card ${pad}`} aria-busy="true">
        <p className="text-sm text-slate-500">Setting up a problem…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div ref={rootRef} className={`try-card ${pad}`}>
        <div className="flex items-start gap-4">
          <Archie pose="happy" size={64} mark="star" />
          <div>
            <p className="text-lg font-semibold text-slate-900">That is the loop.</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              A problem, a check, and a note about the slip when something goes wrong. On the course every
              skill works this way, five right answers on the first try finish it, and your progress saves.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/login" target="_top" className="btn-primary">
                Create a free account
              </a>
              <button type="button" onClick={() => { setProblems([]); setIndex(0); setState("open"); setAnswer(""); setTries(0); setDiagnosis(null); setTimeout(() => setProblems(getFreshProblemsForSkill(SKILL.id, SKILL.problems).filter((p) => p.type === "numeric" || p.type === "multiple-choice").slice(0, SAMPLE_SIZE)), 0); }} className="btn-secondary">
                Three more
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const choices = problem.type === "multiple-choice" ? problem.choices ?? [] : null;
  const settled = state === "right" || state === "shown";

  return (
    <div ref={rootRef} className={`try-card ${pad}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow text-xs">
          Unit 1 · {UNIT.title} · {SKILL.title}
        </p>
        <p className="text-xs font-medium text-slate-500">
          Problem {index + 1} of {problems.length}
        </p>
      </div>

      <PromptText text={problem.prompt} className="mt-3 text-lg leading-relaxed text-slate-900" />

      {choices ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Answer choices">
          {choices.map((c) => {
            const picked = given === c && state !== "open";
            const tone = picked && state === "right" ? "border-emerald-500 bg-emerald-50 text-emerald-900" : picked ? "border-amber-400 bg-amber-50 text-amber-950" : "border-slate-200 bg-white hover:border-bridge-400";
            return (
              <button
                key={c}
                type="button"
                disabled={settled}
                onClick={() => check(c)}
                className={`rounded-xl border px-4 py-3 text-left text-base transition disabled:opacity-70 ${tone}`}
              >
                <PromptText text={c} className="text-base text-inherit" />
              </button>
            );
          })}
        </div>
      ) : (
        <form
          className="mt-4 flex flex-wrap items-stretch gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            check(answer);
          }}
        >
          <label htmlFor="try-answer" className="sr-only">
            Your answer
          </label>
          <input
            id="try-answer"
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={settled}
            inputMode="decimal"
            autoComplete="off"
            placeholder="Your answer"
            className="field min-w-0 flex-1 text-lg"
          />
          <button type="submit" disabled={settled} className="btn-primary">
            Check
          </button>
        </form>
      )}

      {state === "right" && (
        <div className="mt-4 space-y-3">
          <AnswerFeedback state="correct" seed={seed} />
          <div className="flex justify-end">
            <button type="button" onClick={advance} className="btn-primary">
              {index + 1 < problems.length ? "Next problem" : "See what is next"}
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      )}

      {state === "wrong" && diagnosis && (
        <div className="mt-4 space-y-3">
          <div className="animate-pop-in rounded-xl border border-amber-200 bg-amber-50">
            <AnswerFeedback state="wrong" seed={seed} flush />
            <MistakeNote diagnosis={diagnosis} given={given} flush />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              {tries >= 2 ? "Two tries in. Want the steps?" : "Fix it and check again."}
            </p>
            <div className="flex gap-2">
              {tries >= 2 && (
                <button type="button" onClick={() => setState("shown")} className="btn-secondary btn-sm">
                  Show me how
                </button>
              )}
              {!choices && (
                <button type="button" onClick={() => { setState("open"); setAnswer(""); inputRef.current?.focus(); }} className="btn-primary btn-sm">
                  Try again
                </button>
              )}
              {choices && (
                <button type="button" onClick={() => setState("open")} className="btn-primary btn-sm">
                  Pick again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {state === "shown" && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <p className="mb-2 font-semibold">Worked out, step by step</p>
            <WorkedSteps text={problem.explanation} />
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={advance} className="btn-primary">
              {index + 1 < problems.length ? "Next problem" : "See what is next"}
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      )}

      <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
        <Archie pose="idle" size={28} shadow={false} />
        <span>
          On the course, Archie gives hints and checks your work. He never gives the answer.{" "}
          {embed && (
            <a href="/" target="_top" className="font-medium text-bridge-700 underline underline-offset-2">
              Open AlgeBridge
            </a>
          )}
        </span>
      </p>
    </div>
  );
}
