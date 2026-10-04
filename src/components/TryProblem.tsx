"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PracticeProblem, Skill, Unit } from "@/types";
import { units } from "@/data/curriculum";
import { getFreshProblemsForSkill } from "@/data/problem-banks";
import { answerIsRight } from "@/lib/grading";
import { diagnoseMistake, type Diagnosis } from "@/lib/diagnose";
import { useEmbedHeight } from "@/lib/embed";
import { requestHelperOpen, setHelperContext } from "@/lib/helper-bridge";
import { announcePractice } from "@/lib/sidebar";
import { AnswerFeedback } from "@/components/AnswerFeedback";
import { MistakeNote } from "@/components/MistakeNote";
import { WorkedSteps } from "@/components/WorkedSteps";
import { PromptText } from "@/components/PromptText";
import { Icon } from "@/components/Icon";
import { Archie } from "@/components/archie/Archie";

/** The seed behind the fixed set: the demos on algebridge.org show these same problems every time. */
const FIXED_SEED = 20261003;

/** How many problems a visitor gets before the card asks them to keep going with an account. */
const SAMPLE_SIZE = 3;

/** The first skill of the course: what a visitor meets first on the platform too. */
const FIRST_SKILL_ID = units[0].skills[0].id;

/** A skill and its unit by id; the first skill of the course for an id it does not have. */
function findSkill(skillId: string): { unit: Unit; skill: Skill } {
  for (const unit of units) {
    const skill = unit.skills.find((s) => s.id === skillId);
    if (skill) return { unit, skill };
  }
  return { unit: units[0], skill: units[0].skills[0] };
}

/**
 * A wrong answer a student could have typed: a choice, a whole number, or a
 * short decimal. Some traps are kept as the raw quotient (8 ÷ 5280 is
 * 0.0015151515151515152) so a rounded answer still matches them; shown as
 * what "you put", that reads as a glitch.
 */
function typeable(value: string | number | undefined): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return typeof value === "number" && /^-?\d+(\.\d{1,4})?$/.test(String(value));
}

/**
 * A fresh batch a visitor can answer here: typed numbers and picked choices
 * only. With `leadWithTrap` the first problem is one with a classic wrong
 * answer on file, so a card can open on the note that answer earns.
 */
function sampleFor(skill: Skill, count: number, leadWithTrap = false, seed?: number): PracticeProblem[] {
  const batch = getFreshProblemsForSkill(skill.id, skill.problems, seed).filter(
    (p) => p.type === "numeric" || p.type === "multiple-choice"
  );
  // With a seed the batch is the same every time, but the bank is still
  // shuffled on the way out, so the order is fixed here too.
  if (seed !== undefined) batch.sort((x, y) => x.prompt.localeCompare(y.prompt));
  if (leadWithTrap) {
    const i = batch.findIndex((p) => typeable(p.traps?.[0]?.value));
    if (i > 0) batch.unshift(...batch.splice(i, 1));
  }
  return batch.slice(0, count);
}

interface TryProblemProps {
  /** Inside algebridge.org's iframe: tighter padding and a link back to the app. */
  embed?: boolean;
  /** Which skill's problems. The first skill of the course by default. */
  skillId?: string;
  /** How many problems before the finish card. */
  count?: number;
  /** Open with the first problem already answered wrong, its feedback note on screen. */
  startWrong?: boolean;
  /** The same three problems on every visit, so a demo on algebridge.org is a fixture of the page rather than a new draw. */
  fixed?: boolean;
  /** Open Archie on the problem, and keep him told which problem is up. */
  helper?: boolean;
  /** Its own white card. False inside a DemoCard, which is the card then. */
  card?: boolean;
  /** Tell the framing page this card's height. False when a DemoCard around it already does. */
  reportHeight?: boolean;
  /** The visitor has moved past the last problem. */
  onFinish?: () => void;
}

/**
 * Three real practice problems with the real feedback, for someone who has
 * no account yet: the same generator, grading and mistake diagnosis the
 * course uses, and nothing saved. Lives at /try, and algebridge.org embeds
 * it in an iframe, so every link opens in the top window and the page tells
 * its parent how tall it is. The /demo pages reuse it for other skills,
 * with Archie, or opened on a wrong answer.
 */
export function TryProblem({
  embed = false,
  skillId = FIRST_SKILL_ID,
  count = SAMPLE_SIZE,
  startWrong = false,
  fixed = false,
  helper = false,
  card = true,
  reportHeight = true,
  onFinish,
}: TryProblemProps) {
  const { unit, skill } = useMemo(() => findSkill(skillId), [skillId]);
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [tries, setTries] = useState(0);
  const [state, setState] = useState<"open" | "wrong" | "right" | "shown">("open");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [given, setGiven] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const silentRef = useRef<HTMLDivElement>(null);
  /** The visitor has done something here. Until then the card takes no focus from the page around its frame. */
  const touched = useRef(false);

  // Inside algebridge.org's iframe: report the height, so the frame fits
  // the card instead of scrolling inside it. A card inside a DemoCard
  // keeps quiet; the DemoCard reports for both.
  useEmbedHeight(reportHeight ? rootRef : silentRef);

  // Generated after mount: the bank is seeded at random, and a server render
  // would disagree with the browser's. A card that opens on a wrong answer
  // gives its first problem's classic slip, so the note is there at once.
  /** Which fixed set is showing; "Three more" moves to the next one. */
  const round = useRef(0);
  const seedFor = () => (fixed ? FIXED_SEED + round.current * 7919 : undefined);

  useEffect(() => {
    const list = sampleFor(skill, count, startWrong, seedFor());
    setProblems(list);
    const trap = startWrong ? list[0]?.traps?.[0] : undefined;
    if (list[0] && trap && typeable(trap.value)) {
      const miss = String(trap.value);
      setGiven(miss);
      setTries(1);
      setDiagnosis(diagnoseMistake(list[0], { given: miss }));
      setState("wrong");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, count, startWrong, fixed]);

  const problem = problems[index];
  const loading = problems.length === 0;
  const done = problems.length > 0 && index >= problems.length;
  const seed = useMemo(() => index * 7 + tries, [index, tries]);

  // With Archie on: he opens once, and sees each problem as it comes, in the
  // shape PracticePanel hands him, so his chips work on it and the answer
  // filter has the key it must never say.
  useEffect(() => {
    if (helper) requestHelperOpen();
  }, [helper]);
  useEffect(() => {
    if (!helper || !problem) return;
    setHelperContext({
      skillTitle: skill.title,
      keyIdea: skill.keyIdea,
      problemPrompt: problem.prompt,
      hint: problem.hint,
      explanation: problem.explanation,
      answer: problem.answer !== undefined ? String(problem.answer) : undefined,
    });
  }, [helper, skill, problem]);
  useEffect(() => {
    if (!helper) return;
    return () => setHelperContext(null);
  }, [helper]);

  const check = useCallback(
    (value: string) => {
      if (!problem || state === "right" || state === "shown") return;
      touched.current = true;
      const trimmed = value.trim();
      if (!trimmed) {
        inputRef.current?.focus({ preventScroll: true });
        return;
      }
      setGiven(trimmed);
      const right = answerIsRight(problem, trimmed);
      if (helper) announcePractice(right ? "correct" : "wrong");
      if (right) {
        setState("right");
        setDiagnosis(null);
        return;
      }
      const next = tries + 1;
      setTries(next);
      setDiagnosis(diagnoseMistake(problem, { given: trimmed }));
      setState("wrong");
    },
    [problem, state, tries, helper]
  );

  function advance() {
    touched.current = true;
    if (index + 1 >= problems.length) onFinish?.();
    setIndex((i) => i + 1);
    setAnswer("");
    setTries(0);
    setState("open");
    setDiagnosis(null);
    setGiven("");
  }

  function restart() {
    touched.current = true;
    setProblems([]);
    setIndex(0);
    setState("open");
    setAnswer("");
    setTries(0);
    setDiagnosis(null);
    round.current += 1;
    setTimeout(() => setProblems(sampleFor(skill, count, false, seedFor())), 0);
  }

  // The answer box takes focus when a problem opens. Not for the first one
  // inside a frame, though: that would pull the keyboard out of the page
  // around it as it loads, and scroll that page to the frame.
  useEffect(() => {
    if (state !== "open" || problem?.type !== "numeric") return;
    if (!touched.current && window.parent !== window) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [state, problem]);

  const pad = embed ? "p-3 sm:p-5" : "p-5 sm:p-7";
  const shell = card ? `try-card ${pad}` : pad;
  const choices = !loading && !done && problem.type === "multiple-choice" ? problem.choices ?? [] : null;
  const settled = state === "right" || state === "shown";

  // One root through loading, the problems and the finish, so the height
  // report follows the card the whole way.
  return (
    <div ref={rootRef} className={shell} aria-busy={loading || undefined}>
      {loading ? (
        <p className="text-sm text-slate-500">Setting up a problem…</p>
      ) : done ? (
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
              <button type="button" onClick={restart} className="btn-secondary">
                Three more
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow text-xs">
              Unit {unit.number} · {unit.title} · {skill.title}
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
                    <button type="button" onClick={() => { touched.current = true; setState("shown"); }} className="btn-secondary btn-sm">
                      Show me how
                    </button>
                  )}
                  {!choices && (
                    <button type="button" onClick={() => { touched.current = true; setState("open"); setAnswer(""); inputRef.current?.focus({ preventScroll: true }); }} className="btn-primary btn-sm">
                      Try again
                    </button>
                  )}
                  {choices && (
                    <button type="button" onClick={() => { touched.current = true; setState("open"); }} className="btn-primary btn-sm">
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
        </>
      )}
    </div>
  );
}
