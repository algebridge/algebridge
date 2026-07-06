"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedProblem, PracticeProblem, Skill } from "@/types";
import {
  generateExtraProblems,
  recordProblemAttempt,
  getLevelInfo,
} from "@/lib/progress";
import { getShuffledProblemsForSkill } from "@/data/problem-banks";
import { fetchAiTutorHint } from "@/lib/tutor";
import type { MasteryLevel } from "@/types";
import { getSkillProgress, getSkillPracticeStats } from "@/lib/progress";
import { fireConfetti, showToast } from "@/lib/notify";
import { useSound } from "@/hooks/useSound";
import { useSpeech } from "@/hooks/useSpeech";
import { Mascot } from "@/components/Mascot";

interface PracticePanelProps {
  skill: Skill;
  onMasteryChange?: (level: MasteryLevel) => void;
}

type ActiveProblem = PracticeProblem | GeneratedProblem;

function getProblemSteps(problem: ActiveProblem): string[] | undefined {
  return "steps" in problem ? problem.steps : undefined;
}

function normalizeAnswer(val: string | number): string {
  return String(val).trim().toLowerCase().replace(/\s+/g, "");
}

function checkAnswer(problem: ActiveProblem, userAnswer: string): boolean {
  if (problem.type === "multiple-choice") {
    return normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer ?? "");
  }
  if (problem.type === "numeric") {
    const expected = Number(problem.answer);
    const given = Number(userAnswer);
    if (!Number.isNaN(expected) && !Number.isNaN(given)) {
      return Math.abs(expected - given) < 0.001;
    }
    return normalizeAnswer(userAnswer) === normalizeAnswer(problem.answer ?? "");
  }
  return false;
}

export function PracticePanel({ skill, onMasteryChange }: PracticePanelProps) {
  const [problemIndex, setProblemIndex] = useState(0);
  const [extraProblems, setExtraProblems] = useState<GeneratedProblem[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [stepOrder, setStepOrder] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [mastery, setMastery] = useState<MasteryLevel>("locked");
  const [showAiTutor, setShowAiTutor] = useState(false);
  const [tutorMessage, setTutorMessage] = useState("");
  const [tutorSource, setTutorSource] = useState<"ai" | "local" | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [infiniteMode, setInfiniteMode] = useState(false);
  const [sessionProblems, setSessionProblems] = useState<ActiveProblem[]>([]);
  const [combo, setCombo] = useState(0);
  const [feedbackSeed, setFeedbackSeed] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ amount: number; key: number } | null>(null);
  // getSkillPracticeStats reads from localStorage, which is empty on the
  // server. Gating it behind `mounted` keeps the first client render
  // identical to the SSR output, avoiding a hydration mismatch.
  const [mounted, setMounted] = useState(false);

  const { playCorrect, playWrong, playLevelUp } = useSound();
  const { speak, stop: stopSpeech, speaking, supported: speechSupported } = useSpeech();

  // Guards against a stale AI Tutor response landing after the student has
  // moved to a different problem or closed the modal.
  const tutorRequestIdRef = useRef(0);
  const tutorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const tutorCloseRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSessionProblems(getShuffledProblemsForSkill(skill.id, skill.problems));
    setProblemIndex(0);
    setInfiniteMode(false);
    setExtraProblems([]);
    setCombo(0);
  }, [skill.id, skill.problems]);

  const allProblems: ActiveProblem[] = useMemo(() => {
    if (infiniteMode && skill.generatorKey && extraProblems.length > 0) {
      return extraProblems;
    }
    return sessionProblems.length > 0 ? sessionProblems : skill.problems;
  }, [skill, extraProblems, infiniteMode, sessionProblems]);

  const problem = allProblems[problemIndex % allProblems.length];

  useEffect(() => {
    setMastery(getSkillProgress(skill.id).level);
  }, [skill.id]);

  useEffect(() => {
    setUserAnswer("");
    setSelectedChoice(null);
    setSelectedStep(null);
    setStepOrder(
      (() => {
        const steps = getProblemSteps(problem);
        return steps ? [...Array(steps.length).keys()] : [];
      })()
    );
    setFeedback(null);
    setShowHint(false);
    setShowExplanation(false);
    setAttempts(0);
    stopSpeech();
    // A new problem invalidates any in-flight or previously shown AI Tutor
    // response, so it never gets attached to the wrong question.
    tutorRequestIdRef.current += 1;
    setShowAiTutor(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemIndex, problem]);

  const loadMoreProblems = useCallback(() => {
    if (skill.generatorKey) {
      setExtraProblems(generateExtraProblems(skill.generatorKey, 10));
      setInfiniteMode(true);
      setProblemIndex(0);
      return;
    }
    setSessionProblems(getShuffledProblemsForSkill(skill.id, skill.problems));
    setProblemIndex(0);
  }, [skill.generatorKey, skill.id, skill.problems]);

  const handleSubmit = useCallback(() => {
    if (!problem || feedback === "correct") return;

    let correct = false;

    if (problem.type === "error-analysis" && "wrongStepIndex" in problem) {
      correct = selectedStep === problem.wrongStepIndex;
    } else if (problem.type === "step-order" && "correctOrder" in problem) {
      correct =
        JSON.stringify(stepOrder) === JSON.stringify(problem.correctOrder);
    } else if (problem.type === "multiple-choice") {
      correct = checkAnswer(problem, selectedChoice ?? "");
    } else {
      correct = checkAnswer(problem, userAnswer);
    }

    const firstTry = attempts === 0;
    setFeedback(correct ? "correct" : "wrong");
    setFeedbackSeed((s) => s + 1);
    setAttempts((a) => a + 1);

    if (correct) {
      const result = recordProblemAttempt(skill.id, true, { firstTry });
      setMastery(result.newLevel);
      onMasteryChange?.(result.newLevel);
      setShowExplanation(true);
      playCorrect();

      setCombo((c) => {
        const next = c + 1;
        if (next > 0 && next % 5 === 0) {
          fireConfetti("small");
          showToast({
            emoji: "🔥",
            title: `${next} in a row!`,
            description: "You're on a roll — keep it up!",
          });
        }
        return next;
      });

      if (result.xpGained > 0) {
        setXpPopup({ amount: result.xpGained, key: Date.now() });
      }
      if (result.leveledUp) {
        playLevelUp();
        const info = getLevelInfo(result.progress.xp);
        showToast({
          emoji: "🚀",
          title: `Level ${result.newLevelNumber}: ${info.title}!`,
          description: "You're leveling up your algebra skills.",
        });
      }
      if (result.skillJustCompleted) {
        fireConfetti(result.unitJustCompleted ? "big" : "small");
        showToast({
          emoji: "✅",
          title: "Skill complete!",
          description: `${skill.title} is now mastered enough to move on.`,
        });
      }
      if (result.bridgeysGained > 0) {
        showToast({
          emoji: "🪙",
          title: `+${result.bridgeysGained} Bridgeys!`,
          description: "Spend them in your house shop.",
        });
      }
      if (result.unitJustCompleted) {
        showToast({
          emoji: "🌉",
          title: "Unit complete!",
          description: "You finished every skill in this unit. Amazing work!",
        });
      }
      for (const badge of result.newBadges) {
        showToast({
          emoji: badge.emoji,
          title: `Badge unlocked: ${badge.title}`,
          description: badge.description,
        });
      }
    } else {
      setCombo(0);
      playWrong();
      if (attempts + 1 >= 2) {
        setShowHint(true);
        recordProblemAttempt(skill.id, false);
      } else {
        recordProblemAttempt(skill.id, false);
      }
    }
  }, [
    problem,
    feedback,
    selectedStep,
    stepOrder,
    selectedChoice,
    userAnswer,
    attempts,
    skill.id,
    skill.title,
    onMasteryChange,
    playCorrect,
    playWrong,
    playLevelUp,
  ]);

  function nextProblem() {
    if (problemIndex + 1 >= allProblems.length) {
      if (skill.generatorKey && infiniteMode) {
        loadMoreProblems();
        return;
      }
      setSessionProblems(getShuffledProblemsForSkill(skill.id, skill.problems));
      setProblemIndex(0);
      return;
    }
    setProblemIndex((i) => i + 1);
  }

  useEffect(() => {
    if (showAiTutor) {
      tutorCloseRef.current?.focus();
    }
  }, [showAiTutor]);

  function closeAiTutor() {
    stopSpeech();
    setShowAiTutor(false);
    tutorTriggerRef.current?.focus();
  }

  async function openAiTutor() {
    const requestId = tutorRequestIdRef.current + 1;
    tutorRequestIdRef.current = requestId;
    setShowAiTutor(true);
    setTutorLoading(true);
    setTutorMessage("");

    const result = await fetchAiTutorHint({
      skillTitle: skill.title,
      keyIdea: skill.keyIdea,
      learningGoal: skill.learningGoal,
      problemPrompt: problem.prompt,
      hint: problem.hint,
      explanation: problem.explanation,
      userAttempt: userAnswer || selectedChoice || undefined,
      wrongAttempts: attempts,
    });

    // Ignore this response if the student already closed the modal or
    // re-opened it for a different problem while we were waiting.
    if (tutorRequestIdRef.current !== requestId) return;
    setTutorMessage(result.message);
    setTutorSource(result.source);
    setTutorLoading(false);
  }

  function moveStep(from: number, direction: -1 | 1) {
    const to = from + direction;
    if (to < 0 || to >= stepOrder.length) return;
    const next = [...stepOrder];
    [next[from], next[to]] = [next[to], next[from]];
    setStepOrder(next);
  }

  // Keyboard shortcuts: Enter submits/advances, 1-9 picks a multiple-choice answer.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showAiTutor) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeAiTutor();
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTypingInInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (e.key === "Enter" && !isTypingInInput) {
        e.preventDefault();
        if (feedback === "correct") {
          nextProblem();
        } else {
          handleSubmit();
        }
        return;
      }

      if (
        !isTypingInInput &&
        feedback !== "correct" &&
        problem?.type === "multiple-choice" &&
        problem.choices &&
        /^[1-9]$/.test(e.key)
      ) {
        const choice = problem.choices[Number(e.key) - 1];
        if (choice) setSelectedChoice(choice);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, problem, handleSubmit, showAiTutor]);

  if (!problem) return null;

  const ps = mounted
    ? getSkillPracticeStats(skill.id)
    : {
        attempted: 0,
        correct: 0,
        recentAttempted: 0,
        recentCorrect: 0,
        accuracy: 0,
        problemsNeeded: 0,
        isComplete: false,
      };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {ps.isComplete ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ Skill complete! Recent accuracy: {ps.recentCorrect}/{ps.recentAttempted}.
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {ps.attempted === 0 ? (
              <>Answer <strong>3 problems</strong> with at least <strong>80% correct</strong> to complete this skill.</>
            ) : (
              <>
                Progress (last {ps.recentAttempted}): <strong>{ps.recentCorrect}/{ps.recentAttempted} correct</strong>
                {ps.problemsNeeded > 0 && <> · {ps.problemsNeeded} more to try</>}
              </>
            )}
          </div>
        )}
        {combo >= 2 && (
          <span className="animate-pop-in inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-700">
            🔥 {combo} in a row!
          </span>
        )}
      </div>

      {/* Problem card */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {xpPopup && (
          <span
            key={xpPopup.key}
            className="animate-float-up pointer-events-none absolute right-6 top-4 text-lg font-bold text-emerald-500"
          >
            +{xpPopup.amount} XP
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Problem {(problemIndex % allProblems.length) + 1}
          </p>
          {speechSupported && (
            <button
              type="button"
              onClick={() => (speaking ? stopSpeech() : speak(problem.prompt))}
              title={speaking ? "Stop reading aloud" : "Read the problem aloud"}
              aria-label={speaking ? "Stop reading the problem aloud" : "Read the problem aloud"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base hover:bg-slate-100 ${
                speaking ? "animate-pulse text-bridge-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              🔊
            </button>
          )}
        </div>
        <p className="mt-2 text-base font-medium leading-relaxed text-slate-800">
          {problem.prompt}
        </p>

        {/* Numeric input */}
        {problem.type === "numeric" && (
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && feedback !== "correct" && handleSubmit()}
            placeholder="Your answer"
            aria-label="Your answer"
            disabled={feedback === "correct"}
            className="mt-4 w-full max-w-xs rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200 disabled:bg-slate-50"
          />
        )}

        {/* Multiple choice */}
        {problem.type === "multiple-choice" && problem.choices && (
          <div className="mt-4 space-y-2">
            {problem.choices.map((choice, i) => (
              <button
                key={`${i}-${choice}`}
                type="button"
                disabled={feedback === "correct"}
                onClick={() => setSelectedChoice(choice)}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selectedChoice === choice
                    ? "border-bridge-500 bg-bridge-50 text-bridge-900"
                    : "border-slate-200 hover:border-bridge-300 hover:bg-slate-50"
                } ${feedback === "correct" ? "cursor-default" : ""}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400">
                  {i + 1}
                </span>
                <span>{choice}</span>
              </button>
            ))}
            <p className="text-xs text-slate-400">Tip: press 1–{problem.choices.length} to pick an answer.</p>
          </div>
        )}

        {/* Error analysis */}
        {problem.type === "error-analysis" && getProblemSteps(problem) && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-500">
              Click the step that contains the error:
            </p>
            {getProblemSteps(problem)!.map((step, i) => (
              <button
                key={i}
                type="button"
                disabled={feedback === "correct"}
                onClick={() => setSelectedStep(i)}
                className={`block w-full rounded-xl border px-4 py-3 text-left font-mono text-sm ${
                  selectedStep === i
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 hover:border-red-200"
                }`}
              >
                Step {i + 1}: {step}
              </button>
            ))}
          </div>
        )}

        {/* Step ordering */}
        {problem.type === "step-order" && getProblemSteps(problem) && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-500">
              Use arrows to put steps in the correct order:
            </p>
            {stepOrder.map((stepIdx, position) => (
              <div
                key={stepIdx}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bridge-600 text-xs font-bold text-white">
                  {position + 1}
                </span>
                <span className="flex-1 text-sm">{getProblemSteps(problem)![stepIdx]}</span>
                <button
                  type="button"
                  disabled={feedback === "correct" || position === 0}
                  onClick={() => moveStep(position, -1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                  aria-label={`Move "${getProblemSteps(problem)![stepIdx]}" up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={feedback === "correct" || position === stepOrder.length - 1}
                  onClick={() => moveStep(position, 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                  aria-label={`Move "${getProblemSteps(problem)![stepIdx]}" down`}
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className="mt-4">
            <Mascot state={feedback} seed={feedbackSeed} />
            {feedback === "correct" && showExplanation && (
              <p className="mt-2 px-1 text-sm text-slate-600">{problem.explanation}</p>
            )}
          </div>
        )}

        {showHint && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
            <p>💡 Hint: {problem.hint}</p>
            {speechSupported && (
              <button
                type="button"
                onClick={() => (speaking ? stopSpeech() : speak(problem.hint))}
                title={speaking ? "Stop reading aloud" : "Read the hint aloud"}
                aria-label={speaking ? "Stop reading the hint aloud" : "Read the hint aloud"}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm hover:bg-amber-100 ${speaking ? "animate-pulse" : ""}`}
              >
                🔊
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {feedback !== "correct" ? (
            <button type="button" onClick={handleSubmit} className="btn-primary">
              Check Answer
            </button>
          ) : (
            <button type="button" onClick={nextProblem} className="btn-primary">
              Next Problem →
            </button>
          )}

          <button
            ref={tutorTriggerRef}
            type="button"
            onClick={openAiTutor}
            className="btn-secondary"
          >
            🤖 AI Tutor Hint
          </button>

          {(skill.generatorKey || sessionProblems.length > 1) && !infiniteMode && (
            <button type="button" onClick={loadMoreProblems} className="btn-secondary">
              {skill.generatorKey ? "∞ Infinite Practice" : "↻ Shuffle Problems"}
            </button>
          )}
          <p className="ml-auto hidden self-center text-xs text-slate-400 sm:block">
            Press <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5">Enter</kbd> to
            {feedback === "correct" ? " continue" : " check"}
          </p>
        </div>
      </div>

      {/* AI Tutor modal */}
      {showAiTutor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeAiTutor}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-tutor-heading"
            className="max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h4 id="ai-tutor-heading" className="text-lg font-bold text-slate-900">
                🤖 Bridge Tutor
              </h4>
              {speechSupported && !tutorLoading && tutorMessage && (
                <button
                  type="button"
                  onClick={() => (speaking ? stopSpeech() : speak(tutorMessage))}
                  title={speaking ? "Stop voiceover" : "Read this hint aloud"}
                  aria-label={speaking ? "Stop reading the hint aloud" : "Read this hint aloud"}
                  className={`flex h-11 shrink-0 items-center justify-center rounded-full px-2 text-sm hover:bg-slate-100 ${
                    speaking ? "animate-pulse text-bridge-600" : "text-slate-400"
                  }`}
                >
                  {speaking ? "⏹ Stop" : "🔊 Read aloud"}
                </button>
              )}
            </div>
            {tutorSource && (
              <p className="mt-1 text-xs text-slate-500">
                {tutorSource === "ai" ? "Powered by AI" : "Smart built-in tutor"}
                {speechSupported && " · tap 🔊 to hear it read aloud"}
              </p>
            )}
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl bg-bridge-50 p-4 text-sm text-bridge-900 whitespace-pre-wrap">
              {tutorLoading ? "Thinking…" : tutorMessage || "Loading hint…"}
            </div>
            <button
              ref={tutorCloseRef}
              type="button"
              onClick={closeAiTutor}
              className="btn-primary mt-4 w-full"
            >
              Got it — let me try again
            </button>
          </div>
        </div>
      )}

      {/* Pedagogy note */}
      <div className="rounded-xl border border-dashed border-bridge-200 bg-bridge-50/50 p-4 text-sm text-slate-600">
        <strong className="text-bridge-800">Research-backed tip:</strong>{" "}
        {skill.keyIdea}
      </div>
    </div>
  );
}
