"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedProblem, PracticeProblem, Skill } from "@/types";
import {
  generateExtraProblems,
  getInterests,
  recordProblemAttempt,
  getLevelInfo,
  PROGRESS_UPDATED_EVENT,
} from "@/lib/progress";
import { getFreshProblemsForSkill, skillOffersCalculator } from "@/data/problem-banks";
import type { MasteryLevel } from "@/types";
import { getSkillProgress, getSkillPracticeStats } from "@/lib/progress";
import { REQUIRED_CORRECT } from "@/lib/gamification";
import { fireConfetti, showToast } from "@/lib/notify";
import { useSound } from "@/hooks/useSound";
import { useSpeech } from "@/hooks/useSpeech";
import { AnswerFeedback } from "@/components/AnswerFeedback";
import { Icon } from "@/components/Icon";
import { openInterestsPicker } from "@/components/InterestsPrompt";
import { setCalculatorAccess } from "@/lib/calculator-access";
import { answerIsRight } from "@/lib/grading";
import { HUES, hueVars, topicHue } from "@/lib/hues";
import { PromptText } from "@/components/PromptText";
import { requestHelperOpen, setHelperContext } from "@/lib/helper-bridge";
import { listTopics, type InterestTopic } from "@/lib/interests";
import {
  BATCH_SIZE,
  FIRST_BATCH_SIZE,
  canPersonalize,
  stripVariantTag,
  type PersonalizableProblem,
} from "@/lib/personalize";
import { shuffleArray } from "@/lib/problem-utils";

interface PracticePanelProps {
  skill: Skill;
  onMasteryChange?: (level: MasteryLevel) => void;
  /**
   * A skill ahead of the student's path, opened to look around: answers are
   * checked and explained as usual, and nothing is written to their progress.
   * No XP, no Bridgeys, no badges, no completion, so the path stays honest.
   */
  practiceOnly?: boolean;
  /** In practice-only mode: how many they have got right this session. */
  onPracticeRight?: (count: number) => void;
}

type ActiveProblem = PracticeProblem | GeneratedProblem;

/** A problem rewritten into one of the student's interests. */
interface Scene {
  prompt: string;
  topic: string;
}

/** Wrong answers in one visit before the AI helper is offered. */
const MISSES_BEFORE_NUDGE = 3;

/**
 * How long a problem waits for its story before it is shown as it is. The
 * first of a visit waits longest: its batch is being written, checked and,
 * where a draft failed, written once more. Most students are still watching
 * the lesson video by then.
 */
const FIRST_WAIT_MS = 15_000;
const LATER_WAIT_MS = 8_000;

/** Moves problems with a story ahead of the rest, from `from` on, keeping order within each group. */
function storiesFirst<T extends { id: string }>(list: T[], from: number, hasStory: (p: T) => boolean): T[] {
  const tail = list.slice(from);
  const ready = tail.filter(hasStory);
  if (!ready.length) return list;
  const next = [...list.slice(0, from), ...ready, ...tail.filter((p) => !hasStory(p))];
  return next.every((p, i) => p === list[i]) ? list : next;
}

function getProblemSteps(problem: ActiveProblem): string[] | undefined {
  return "steps" in problem ? problem.steps : undefined;
}

/**
 * Steps start out of order. They used to start in their natural order, which
 * for nearly every step-order problem WAS the answer, so pressing Check
 * without touching anything scored a point.
 */
function scrambledOrder(count: number, correct?: number[]): number[] {
  const natural = [...Array(count).keys()];
  if (count < 2) return natural;
  const target = JSON.stringify(correct ?? natural);
  for (let i = 0; i < 12; i += 1) {
    const order = shuffleArray(natural);
    if (JSON.stringify(order) !== target) return order;
  }
  return natural.reverse();
}

// Buttons natively activate on the Space bar while focused, which caused
// answers to "submit" just by pressing space after a click. We suppress
// Space activation on action buttons; Enter and mouse clicks still work.
function ignoreSpaceKey(e: React.KeyboardEvent<HTMLButtonElement>) {
  if (e.key === " " || e.code === "Space") e.preventDefault();
}

/** The student's interest topics, kept current if they change them mid-lesson. */
function useInterestTopics() {
  const [state, setState] = useState<{ topics: InterestTopic[]; key: string; loaded: boolean }>({
    topics: [],
    key: "[]",
    loaded: false,
  });
  useEffect(() => {
    const read = () => {
      const topics = getInterests()?.topics ?? [];
      const key = JSON.stringify(topics);
      // Progress saves on every answer; only a real change should ripple out.
      setState((prev) => (prev.loaded && prev.key === key ? prev : { topics, key, loaded: true }));
    };
    read();
    window.addEventListener(PROGRESS_UPDATED_EVENT, read);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, read);
  }, []);
  return state;
}

export function PracticePanel({ skill, onMasteryChange, practiceOnly = false, onPracticeRight }: PracticePanelProps) {
  const [problemIndex, setProblemIndex] = useState(0);
  /** Right answers this session, only kept in practice-only mode. */
  const [sessionRight, setSessionRight] = useState(0);
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
  const [infiniteMode, setInfiniteMode] = useState(false);
  const [sessionProblems, setSessionProblems] = useState<ActiveProblem[]>([]);
  /** The seed the current bank was generated from; the server regenerates it to rewrite problems. */
  const [seed, setSeed] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [feedbackSeed, setFeedbackSeed] = useState(0);
  const [xpPopup, setXpPopup] = useState<{ amount: number; key: number } | null>(null);
  /** Wrong answers this visit, and where the student last waved the AI offer away. */
  const [misses, setMisses] = useState(0);
  const [nudgeDismissedAt, setNudgeDismissedAt] = useState(0);
  // getSkillPracticeStats reads from localStorage, which is empty on the
  // server. Gating it behind `mounted` keeps the first client render
  // identical to the SSR output, avoiding a hydration mismatch.
  const [mounted, setMounted] = useState(false);

  const { playCorrect, playWrong, playLevelUp } = useSound();
  const { speak, stop: stopSpeech, speaking, supported: speechSupported } = useSpeech();
  const { topics, key: topicsKey, loaded: topicsLoaded } = useInterestTopics();

  // --- Personalized problems ------------------------------------------------
  //
  // Every problem is sent to be written into the student's interests, a batch
  // ahead of where they are. Problems whose story is ready are served first;
  // one still being written waits briefly; one that came back without a story
  // is asked for once more before it is ever shown plain.
  const [scenes, setScenes] = useState<Record<string, Scene>>({});
  /** A request for stories is out. State too, because the card waits on it. */
  const [asking, setAsking] = useState(false);
  const askingRef = useRef(false);
  /** The problem whose wait for a story ran out; it is shown as it is. */
  const [expiredFor, setExpiredFor] = useState<string | null>(null);
  /** Bumped when a pause after an empty reply ends, to look again. */
  const [quietTick, setQuietTick] = useState(0);
  /**
   * What each problem showed the first time it was on screen. A story that
   * lands while a student is reading the original never swaps the text out
   * from under them.
   */
  const shownRef = useRef(new Map<string, Scene | null>());
  /** How many times each problem has been sent to be written. */
  const requestedRef = useRef(new Map<string, number>());
  const batchNoRef = useRef(0);
  /** Templates this session's stories came from, oldest first, so none repeats. */
  const seenTemplatesRef = useRef<string[]>([]);
  const requestTokenRef = useRef(0);
  const quietUntilRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Forget every story and request, e.g. for a new bank or new interests. */
  const resetStories = useCallback(() => {
    requestTokenRef.current += 1;
    askingRef.current = false;
    setAsking(false);
    requestedRef.current = new Map();
    batchNoRef.current = 0;
    seenTemplatesRef.current = [];
    quietUntilRef.current = 0;
    setScenes({});
  }, []);

  // The session is keyed on the skill's id alone. The skill object can arrive
  // again with the same content (a re-render of the page from the server),
  // and restarting on that threw away a bank mid-visit along with its stories.
  const seedProblemsRef = useRef(skill.problems);
  seedProblemsRef.current = skill.problems;

  /** A new bank of problems, from a seed the server can reproduce. */
  const startSession = useCallback(() => {
    // Generated here rather than at module scope: the seed varies per session
    // by design, so this must never run during SSR.
    const next = Math.floor(Math.random() * 0xffffffff);
    shownRef.current = new Map();
    // Ids repeat from bank to bank ("...-p3"), so nothing keyed on one may
    // carry over into the next.
    setExpiredFor(null);
    resetStories();
    setSessionRight(0);
    setSeed(next);
    setSessionProblems(getFreshProblemsForSkill(skill.id, seedProblemsRef.current, next));
    setProblemIndex(0);
  }, [skill.id, resetStories]);

  useEffect(() => {
    startSession();
    setInfiniteMode(false);
    setExtraProblems([]);
    setCombo(0);
    setMisses(0);
    setNudgeDismissedAt(0);
  }, [startSession]);

  // New interests: problems not yet on screen get written again for them.
  useEffect(() => {
    if (topicsLoaded) resetStories();
  }, [topicsKey, topicsLoaded, resetStories]);

  const allProblems: ActiveProblem[] = useMemo(() => {
    if (infiniteMode && skill.generatorKey && extraProblems.length > 0) {
      return extraProblems;
    }
    return sessionProblems.length > 0 ? sessionProblems : skill.problems;
  }, [skill, extraProblems, infiniteMode, sessionProblems]);

  const problem = allProblems[problemIndex % allProblems.length];
  const problemIndexRef = useRef(0);
  problemIndexRef.current = problemIndex;

  useEffect(() => {
    setMastery(getSkillProgress(skill.id).level);
  }, [skill.id]);

  // The calculator is decided for the whole skill. Deciding per problem was
  // the bug where it kept closing itself and its button kept disappearing.
  const calculatorAllowed = useMemo(
    () => skillOffersCalculator(skill.id, skill.problems),
    [skill.id, skill.problems]
  );

  useEffect(() => {
    setCalculatorAccess(calculatorAllowed);
    // Leaving practice hands the calculator back to the rest of the app.
    return () => setCalculatorAccess(null);
  }, [calculatorAllowed]);

  const fetchBatch = useCallback(async () => {
    if (seed === null || !topics.length || askingRef.current || infiniteMode) return;
    // The first request is small so the first problem arrives fast.
    const size = batchNoRef.current === 0 ? FIRST_BATCH_SIZE : BATCH_SIZE;
    const upcoming = sessionProblems
      .slice(problemIndex)
      .filter(
        (p) =>
          !shownRef.current.has(p.id) && !scenes[p.id] && canPersonalize(p as PersonalizableProblem)
      );
    // Never-asked problems first; then a second chance for ones that came back plain.
    let ids = upcoming.filter((p) => !requestedRef.current.get(p.id)).slice(0, size).map((p) => p.id);
    if (!ids.length) {
      ids = upcoming.filter((p) => (requestedRef.current.get(p.id) ?? 0) < 2).slice(0, size).map((p) => p.id);
    }
    if (!ids.length) return;
    ids.forEach((id) => requestedRef.current.set(id, (requestedRef.current.get(id) ?? 0) + 1));

    askingRef.current = true;
    setAsking(true);
    const token = requestTokenRef.current;
    const offset = batchNoRef.current;
    batchNoRef.current += 1;
    let gotAny = false;
    try {
      const res = await fetch("/api/problems/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillId: skill.id, seed, ids, topics, offset, seen: seenTemplatesRef.current.slice(-60) }),
      });
      const data = (await res.json()) as {
        problems?: { id?: unknown; prompt?: unknown; topic?: unknown; templateId?: unknown }[];
      };
      if (token !== requestTokenRef.current) return;
      const got: Record<string, Scene> = {};
      for (const p of data.problems ?? []) {
        if (typeof p.id === "string" && typeof p.prompt === "string") {
          got[p.id] = { prompt: p.prompt, topic: typeof p.topic === "string" ? p.topic : "" };
          if (typeof p.templateId === "string") seenTemplatesRef.current.push(p.templateId);
        }
      }
      gotAny = Object.keys(got).length > 0;
      if (gotAny) setScenes((prev) => ({ ...prev, ...got }));
    } catch {
      /* treated like an empty reply below */
    } finally {
      if (token === requestTokenRef.current) {
        askingRef.current = false;
        setAsking(false);
        // An empty reply is usually the free AI tier's per-minute limit.
        // Asking again at once would only repeat it, so pause and look again.
        if (!gotAny) {
          quietUntilRef.current = Date.now() + 20_000;
          window.setTimeout(() => setQuietTick((t) => t + 1), 20_500);
        }
      }
    }
  }, [seed, topics, sessionProblems, problemIndex, scenes, infiniteMode, skill.id]);
  const fetchBatchRef = useRef(fetchBatch);
  fetchBatchRef.current = fetchBatch;

  // Keep two stories ready ahead of the student, and ask straight away when
  // the problem on screen is still waiting for one.
  useEffect(() => {
    if (seed === null || !topicsLoaded || !topics.length || infiniteMode || asking) return;
    if (Date.now() < quietUntilRef.current) return;
    const ready = sessionProblems
      .slice(problemIndex)
      .filter((p) => !shownRef.current.has(p.id) && scenes[p.id]).length;
    const current = sessionProblems[problemIndex];
    const currentWaiting = !!current && !shownRef.current.has(current.id) && !scenes[current.id];
    if (ready < 2 || currentWaiting) void fetchBatchRef.current();
  }, [seed, topicsLoaded, topics.length, infiniteMode, asking, problemIndex, scenes, sessionProblems, quietTick]);

  // Stories first: whenever some arrive, move those problems to the front of
  // what is still to come. The bank's order is random anyway.
  useEffect(() => {
    setSessionProblems((list) => {
      const i = problemIndexRef.current;
      const current = list[i];
      const from = current && shownRef.current.has(current.id) ? i + 1 : i;
      return storiesFirst(list, from, (p) => !!scenes[p.id]);
    });
  }, [scenes]);

  // The problem on screen waits for its story, briefly: longer for the first
  // one of a visit, while its batch is still being written.
  const tries = problem ? requestedRef.current.get(problem.id) ?? 0 : 0;
  const storyCouldCome =
    asking || (tries < 2 && Date.now() >= quietUntilRef.current);
  const waitingOn =
    !infiniteMode &&
    topics.length > 0 &&
    problem &&
    !shownRef.current.has(problem.id) &&
    !scenes[problem.id] &&
    canPersonalize(problem as PersonalizableProblem) &&
    storyCouldCome &&
    expiredFor !== problem.id
      ? problem.id
      : null;
  useEffect(() => {
    if (!waitingOn) return;
    const ms = shownRef.current.size === 0 ? FIRST_WAIT_MS : LATER_WAIT_MS;
    const timer = window.setTimeout(() => setExpiredFor(waitingOn), ms);
    return () => window.clearTimeout(timer);
  }, [waitingOn]);

  // Until this visit's problems exist, and while the problem on screen is
  // waiting for its story, the card shows a short loading state instead of
  // one problem that is then swapped for another. (The server render always
  // lands here: the bank is random by design, so it is only built in the
  // browser.)
  const pending = !infiniteMode && (seed === null || !topicsLoaded || waitingOn !== null);

  let scene: Scene | null = null;
  if (problem && !pending) {
    const shown = shownRef.current;
    if (!shown.has(problem.id)) shown.set(problem.id, infiniteMode ? null : scenes[problem.id] ?? null);
    scene = shown.get(problem.id) ?? null;
  }
  const displayPrompt = problem ? scene?.prompt ?? stripVariantTag(problem.prompt) : "";

  // The helper sees what the student sees, and the answer key it must not say.
  useEffect(() => {
    if (!problem || pending) return;
    setHelperContext({
      skillTitle: skill.title,
      keyIdea: skill.keyIdea,
      problemPrompt: displayPrompt,
      hint: problem.hint,
      explanation: problem.explanation,
      answer: problem.answer !== undefined ? String(problem.answer) : undefined,
    });
  }, [skill.title, skill.keyIdea, problem, displayPrompt, pending]);
  useEffect(() => () => setHelperContext(null), []);

  useEffect(() => {
    setUserAnswer("");
    setSelectedChoice(null);
    setSelectedStep(null);
    const steps = getProblemSteps(problem);
    setStepOrder(
      steps
        ? scrambledOrder(steps.length, "correctOrder" in problem ? problem.correctOrder : undefined)
        : []
    );
    setFeedback(null);
    setShowHint(false);
    setShowExplanation(false);
    setAttempts(0);
    stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemIndex, problem]);

  const loadMoreProblems = useCallback(() => {
    // The older infinite generators are unseeded, so the server cannot
    // rebuild their problems to rewrite them. A student with interests gets a
    // fresh bank instead, which is just as endless and stays in their world.
    if (skill.generatorKey && !topics.length) {
      setExtraProblems(generateExtraProblems(skill.generatorKey, 10));
      setInfiniteMode(true);
      setProblemIndex(0);
      return;
    }
    startSession();
  }, [skill.generatorKey, startSession, topics.length]);

  const handleSubmit = useCallback(() => {
    if (!problem || feedback === "correct" || pending) return;

    // Pressing Enter on an empty box is not an attempt. It used to count as a
    // wrong one, and with first tries deciding the skill that is a point lost
    // to a stray keypress.
    const hasAnswer =
      problem.type === "error-analysis"
        ? selectedStep !== null
        : problem.type === "multiple-choice"
          ? selectedChoice !== null
          : problem.type === "step-order"
            ? true
            : userAnswer.trim() !== "";
    if (!hasAnswer) return;

    let correct = false;

    if (problem.type === "error-analysis" && "wrongStepIndex" in problem) {
      correct = selectedStep === problem.wrongStepIndex;
    } else if (problem.type === "step-order" && "correctOrder" in problem) {
      correct =
        JSON.stringify(stepOrder) === JSON.stringify(problem.correctOrder);
    } else if (problem.type === "multiple-choice") {
      correct = answerIsRight(problem, selectedChoice ?? "");
    } else {
      correct = answerIsRight(problem, userAnswer);
    }

    const firstTry = attempts === 0;
    setFeedback(correct ? "correct" : "wrong");
    setFeedbackSeed((s) => s + 1);
    setAttempts((a) => a + 1);

    if (correct) {
      setShowExplanation(true);
      playCorrect();
      setCombo((c) => c + 1);

      if (practiceOnly) {
        // Looking ahead: the answer is checked and explained, and that is all.
        setSessionRight((n) => {
          onPracticeRight?.(n + 1);
          return n + 1;
        });
        return;
      }

      const result = recordProblemAttempt(skill.id, true, { firstTry });
      setMastery(result.newLevel);
      onMasteryChange?.(result.newLevel);

      if (combo + 1 > 0 && (combo + 1) % 5 === 0) {
        fireConfetti("small");
        showToast({
          icon: "flame",
          tone: "reward",
          title: `${combo + 1} in a row`,
          description: "Every one on the first try.",
        });
      }

      if (result.xpGained > 0) {
        setXpPopup({ amount: result.xpGained, key: Date.now() });
      }
      if (result.leveledUp) {
        playLevelUp();
        const info = getLevelInfo(result.progress.xp);
        showToast({
          icon: "spark",
          tone: "info",
          title: `Level ${result.newLevelNumber}: ${info.title}`,
          description: "Your XP reached a new level.",
        });
      }
      if (result.skillJustCompleted) {
        fireConfetti(result.unitJustCompleted ? "big" : "small");
        showToast({
          icon: "check",
          tone: "success",
          title: "Skill complete",
          description: `${skill.title} is done, and the next skill on your path is open.`,
        });
      }
      if (result.bridgeysGained > 0) {
        showToast({
          icon: "coin",
          tone: "reward",
          title: `+${result.bridgeysGained} Bridgeys`,
          description: "Spend them in your house shop.",
        });
      }
      if (result.unitJustCompleted) {
        showToast({
          icon: "trophy",
          tone: "success",
          title: "Unit complete",
          description: "Every skill in this unit is done.",
        });
      }
      for (const badge of result.newBadges) {
        showToast({
          icon: "trophy",
          tone: "reward",
          title: `Badge: ${badge.title}`,
          description: badge.description,
        });
      }
    } else {
      setCombo(0);
      setMisses((m) => m + 1);
      playWrong();
      if (attempts + 1 >= 2) setShowHint(true);
      if (!practiceOnly) recordProblemAttempt(skill.id, false);
    }
  }, [
    problem,
    feedback,
    pending,
    selectedStep,
    stepOrder,
    selectedChoice,
    userAnswer,
    attempts,
    combo,
    skill.id,
    skill.title,
    onMasteryChange,
    practiceOnly,
    onPracticeRight,
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
      startSession();
      return;
    }
    setProblemIndex((i) => i + 1);
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
  }, [feedback, problem, handleSubmit]);

  if (!problem) return null;

  const ps = mounted
    ? getSkillPracticeStats(skill.id)
    : {
        attempted: 0,
        correct: 0,
        solved: 0,
        required: REQUIRED_CORRECT,
        recentAttempted: 0,
        recentCorrect: 0,
        accuracy: 0,
        problemsNeeded: 0,
        isComplete: false,
      };

  const showNudge = misses - nudgeDismissedAt >= MISSES_BEFORE_NUDGE;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {practiceOnly ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <Icon name="eye" size={16} className="text-slate-400" />
              Practice mode
            </span>
            <span className="text-slate-400" aria-hidden>·</span>
            <span>
              <strong>{sessionRight}</strong> right this session
            </span>
          </div>
        ) : ps.isComplete ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <span className="inline-flex items-center gap-2">
              <Icon name="check" size={16} />
              Skill complete. You got {ps.required} right.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {/* Progress, drawn. A student should see how close they are
                without reading a sentence. A miss never empties a pip. */}
            <SolvedPips done={ps.solved} total={ps.required} />
            <span>
              {ps.solved === 0 ? (
                <>
                  Get <strong>{ps.required} right</strong> to finish this skill. First tries count.
                </>
              ) : (
                <>
                  <strong>
                    {ps.solved} of {ps.required}
                  </strong>{" "}
                  right · {ps.problemsNeeded} to go
                </>
              )}
            </span>
          </div>
        )}
        {combo >= 2 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
            <Icon name="flame" size={14} />
            {combo} in a row
          </span>
        )}
      </div>

      {mounted && (
        <p className="px-1 text-xs text-slate-500">
          {topics.length > 0 ? (
            <>
              Your interests: {listTopics(topics)}.{" "}
              <button
                type="button"
                onClick={openInterestsPicker}
                className="font-semibold text-bridge-700 hover:underline"
              >
                Change
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={openInterestsPicker}
              className="font-semibold text-bridge-700 hover:underline"
            >
              Set these problems in things you like
            </button>
          )}
        </p>
      )}

      {/* Problem card. A story takes the color of the interest it is set in,
          so a Minecraft problem and a basketball one look like different
          places; a plain problem keeps the page's neutral card. */}
      <div
        style={hueVars(scene?.topic ? topicHue(scene.topic) : HUES.blue)}
        className={`relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm ${scene?.topic ? "hue-line" : "border-slate-200"}`}
      >
        {scene?.topic && <span aria-hidden className="hue-bar absolute inset-x-0 top-0 h-1.5" />}
        {xpPopup && (
          <span
            key={xpPopup.key}
            className="animate-float-up pointer-events-none absolute right-6 top-4 text-lg font-bold text-emerald-500"
          >
            +{xpPopup.amount} XP
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Problem {(problemIndex % allProblems.length) + 1}
            {scene?.topic && <span className="hue-wash rounded-full px-2 py-0.5 font-semibold normal-case tracking-normal">{scene.topic}</span>}
          </p>
          {speechSupported && !pending && (
            <button
              type="button"
              onClick={() => (speaking ? stopSpeech() : speak(displayPrompt))}
              title={speaking ? "Stop reading aloud" : "Read the problem aloud"}
              aria-label={speaking ? "Stop reading the problem aloud" : "Read the problem aloud"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 ${
                speaking ? "animate-pulse text-bridge-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name="speaker" size={19} />
            </button>
          )}
        </div>

        {pending ? (
          <div className="mt-3 space-y-3" aria-live="polite">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-11/12 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>
            <p className="text-sm text-slate-500">
              {topics.length ? `Setting your problems in ${listTopics(topics)}...` : "Loading your problems..."}
            </p>
          </div>
        ) : (
          <PromptText text={displayPrompt} />
        )}

        {/* Numeric input */}
        {!pending && problem.type === "numeric" && (
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
        {!pending && problem.type === "multiple-choice" && problem.choices && (
          <div className="mt-4 space-y-2">
            {problem.choices.map((choice, i) => (
              <button
                key={`${i}-${choice}`}
                type="button"
                disabled={feedback === "correct"}
                onClick={() => setSelectedChoice(choice)}
                onKeyDown={ignoreSpaceKey}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                  selectedChoice === choice ? "hue-tint hue-ink font-medium" : "border-slate-200 hover:bg-slate-50"
                } ${feedback === "correct" ? "cursor-default" : ""}`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    selectedChoice === choice ? "hue-solid" : "border border-slate-300 text-slate-400"
                  }`}
                >
                  {i + 1}
                </span>
                <span>{choice}</span>
              </button>
            ))}
            <p className="text-xs text-slate-400">Tip: press 1-{problem.choices.length} to pick an answer.</p>
          </div>
        )}

        {/* Error analysis */}
        {!pending && problem.type === "error-analysis" && getProblemSteps(problem) && (
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
                onKeyDown={ignoreSpaceKey}
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
        {!pending && problem.type === "step-order" && getProblemSteps(problem) && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-500">
              Use arrows to put steps in the correct order:
            </p>
            {stepOrder.map((stepIdx, position) => (
              <div
                key={stepIdx}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="hue-solid flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
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
            <AnswerFeedback state={feedback} seed={feedbackSeed} />
            {feedback === "correct" && showExplanation && (
              <p className="mt-2 px-1 text-sm text-slate-600">{problem.explanation}</p>
            )}
            {feedback === "wrong" && attempts === 1 && !ps.isComplete && !practiceOnly && (
              <p className="mt-2 px-1 text-xs text-slate-500">
                Fix it for practice, or skip it. Your next first try counts toward the {ps.required}.
              </p>
            )}
          </div>
        )}

        {showHint && (
          <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
            <p className="flex items-start gap-2">
              <Icon name="hint" size={17} className="mt-0.5 shrink-0 text-amber-600" />
              <span>
                <span className="font-semibold">Hint:</span> {problem.hint}
              </span>
            </p>
            {speechSupported && (
              <button
                type="button"
                onClick={() => (speaking ? stopSpeech() : speak(problem.hint))}
                title={speaking ? "Stop reading aloud" : "Read the hint aloud"}
                aria-label={speaking ? "Stop reading the hint aloud" : "Read the hint aloud"}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-amber-100 ${speaking ? "animate-pulse" : ""}`}
              >
                <Icon name="speaker" size={18} />
              </button>
            )}
          </div>
        )}

        {/* A few misses in, the AI helper is offered, opened on this problem. */}
        {showNudge && feedback !== "correct" && (
          <div className="mt-4 rounded-xl border border-bridge-100 bg-bridge-50 px-4 py-3 sm:flex sm:items-center sm:gap-3">
            <div className="min-w-0 sm:flex-1">
              <p className="text-sm font-semibold text-bridge-900">Stuck? Talk it through with the AI helper.</p>
              <p className="mt-0.5 text-xs text-bridge-800">
                It can see this problem and coaches you one step at a time.
              </p>
            </div>
            <div className="mt-3 flex shrink-0 gap-2 sm:mt-0">
              <button
                type="button"
                onClick={() => {
                  requestHelperOpen();
                  setNudgeDismissedAt(misses);
                }}
                onKeyDown={ignoreSpaceKey}
                className="btn-primary btn-sm"
              >
                Ask the AI helper
              </button>
              <button
                type="button"
                onClick={() => setNudgeDismissedAt(misses)}
                onKeyDown={ignoreSpaceKey}
                className="btn-ghost btn-sm"
              >
                Later
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          {feedback !== "correct" ? (
            <button
              type="button"
              onClick={handleSubmit}
              onKeyDown={ignoreSpaceKey}
              disabled={pending}
              className="btn-primary"
            >
              Check Answer
            </button>
          ) : (
            <button
              type="button"
              onClick={nextProblem}
              onKeyDown={ignoreSpaceKey}
              className="btn-primary"
            >
              Next Problem →
            </button>
          )}

          {attempts > 0 && feedback !== "correct" && (
            <button type="button" onClick={nextProblem} onKeyDown={ignoreSpaceKey} className="btn-secondary">
              Skip
            </button>
          )}

          {(skill.generatorKey || sessionProblems.length > 1) && !infiniteMode && (
            <button type="button" onClick={loadMoreProblems} className="btn-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="review" size={15} />
                {skill.generatorKey ? "Keep practicing" : "Shuffle problems"}
              </span>
            </button>
          )}
          <p className="ml-auto hidden self-center text-xs text-slate-400 sm:block">
            Press <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5">Enter</kbd> to
            {feedback === "correct" ? " continue" : " check"}
          </p>
        </div>
      </div>

    </div>
  );
}

/** Problems banked so far: filled for each one right, hollow for what is still owed. */
function SolvedPips({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${done} of ${total} right`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-2.5 w-2.5 rounded-full transition ${
            i < done ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
      ))}
    </span>
  );
}
