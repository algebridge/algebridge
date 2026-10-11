"use client";

import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeneratedProblem, PracticeProblem, Skill } from "@/types";
import {
  dailyStatus,
  getInterests,
  getProgress,
  recordProblemAttempt,
  getLevelInfo,
  PROGRESS_UPDATED_EVENT,
} from "@/lib/progress";
import { getFreshProblemsForSkill, skillOffersCalculator } from "@/data/problem-banks";
import { loadSeen, rememberSeen, shapeKey, spreadShapes } from "@/lib/problem-order";
import type { MasteryLevel } from "@/types";
import { getSkillProgress, getSkillPracticeStats } from "@/lib/progress";
import { BRIDGEY_REWARDS, bridgeysForSkill, DAILY_GOAL, REQUIRED_CORRECT } from "@/lib/gamification";
import { allUnits, units } from "@/data/curriculum";
import { DailyGoalRing } from "@/components/DailyGoalRing";
import { BridgeysLogo } from "@/components/house/BridgeysLogo";
import { getFurnitureItem } from "@/data/house-catalog";
import { fireConfetti, showToast } from "@/lib/notify";
import { useSound } from "@/hooks/useSound";
import { useSpeech } from "@/hooks/useSpeech";
import { AnswerFeedback, feedbackLine } from "@/components/AnswerFeedback";
import { MistakeNote } from "@/components/MistakeNote";
import { QuoteCard } from "@/components/QuoteCard";
import { WorkedSteps } from "@/components/WorkedSteps";
import { quoteForFinish } from "@/data/quotes";
import { diagnoseMistake, type Attempt } from "@/lib/diagnose";
import { Icon } from "@/components/Icon";
import { openInterestsPicker } from "@/components/InterestsPrompt";
import { setCalculatorAccess } from "@/lib/calculator-access";
import { answerIsRight, gradeAnswer } from "@/lib/grading";
import { announcePractice } from "@/lib/sidebar";
import { HUES, hueVars, topicHue, unitHue } from "@/lib/hues";
import { MathText, PromptText } from "@/components/PromptText";
import { ScratchpadButton, useScratchpadSurface } from "@/components/Scratchpad";
import { AnswerField, type AnswerFieldHandle } from "@/components/AnswerField";
import { CourseCelebration } from "@/components/CourseCelebration";
import { useCertificateName } from "@/components/CertificateView";
import { requestHelperOpen, setHelperContext } from "@/lib/helper-bridge";
import { listTopics, type InterestTopic } from "@/lib/interests";
import {
  BATCH_SIZE,
  FIRST_BATCH_SIZE,
  canPersonalize,
  checkRewrite,
  stripVariantTag,
  type PersonalizableProblem,
} from "@/lib/personalize";
import { displayAnswer, shuffleArray } from "@/lib/problem-utils";

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
  /**
   * In practice-only mode, after a fast run (FAST_RUN first tries right in a
   * row, each inside FAST_SECONDS): opens the skill for real, the way passing
   * "Show what you know" does. Without it, no offer is made.
   */
  onOpenSkill?: () => void;
  /** Where the path goes after this skill, for the moment it is finished. */
  next?: { href: string; title: string } | null;
}

/** The finish moment, shown over the card until the student moves on. */
interface Celebration {
  paid: number;
  unitNumber: number | null;
  unitBonus: number;
  prizeName: string | null;
}

/** The answer as a student would write it, for "Show me how". */
function answerText(problem: ActiveProblem): string | null {
  if (problem.type === "error-analysis" && "wrongStepIndex" in problem && typeof problem.wrongStepIndex === "number") {
    return `Step ${problem.wrongStepIndex + 1}`;
  }
  if (problem.type === "step-order") return null;
  return displayAnswer(problem) || null;
}

/** Today's right answers, kept current as progress saves. */
function useDaily() {
  const [daily, setDaily] = useState({ right: 0, goal: DAILY_GOAL, met: false });
  useEffect(() => {
    const read = () => {
      const d = dailyStatus(getProgress());
      setDaily((prev) => (prev.right === d.right && prev.met === d.met ? prev : { right: d.right, goal: d.goal, met: d.met }));
    };
    read();
    window.addEventListener(PROGRESS_UPDATED_EVENT, read);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, read);
  }, []);
  return daily;
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
 * A run in practice-only mode that shows a student already knows a skill:
 * this many first tries right in a row, each answered inside FAST_SECONDS of
 * the problem appearing. Stronger evidence than "Show what you know" (three
 * in a row, untimed), so it earns the same thing: the skill opens.
 */
export const FAST_RUN = 4;
export const FAST_SECONDS = 45;

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

export function PracticePanel({ skill, onMasteryChange, practiceOnly = false, onPracticeRight, onOpenSkill, next = null }: PracticePanelProps) {
  const [problemIndex, setProblemIndex] = useState(0);
  /** Practice-only: fast first tries in a row, when the problem on screen appeared, and the offer it earns. */
  const fastRunRef = useRef(0);
  const shownAtRef = useRef(0);
  const [fastOffer, setFastOffer] = useState<number | null>(null);
  /** Right answers this session, only kept in practice-only mode. */
  const [sessionRight, setSessionRight] = useState(0);
  // The screen is paper on every problem; a new problem is clean paper.
  useScratchpadSurface(`${skill.id}:${problemIndex}`);
  const sessionRightRef = useRef(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [stepOrder, setStepOrder] = useState<number[]>([]);
  /** Where the last moved step landed, read out to a screen reader. */
  const [stepNote, setStepNote] = useState("");
  const stepArrows = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => setStepNote(""), [problemIndex]);
  /** Choices and steps already tried and wrong on this problem: crossed out, so the next try is a real one. */
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [eliminatedSteps, setEliminatedSteps] = useState<number[]>([]);
  /** "Show me how" was pressed: the worked answer is on screen and this problem is over. */
  const [revealed, setRevealed] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  /** The last unit of the course was just finished: the whole screen celebrates. */
  const [courseParty, setCourseParty] = useState(false);
  const [certificateName] = useCertificateName();
  const daily = useDaily();
  const answerField = useRef<AnswerFieldHandle>(null);
  const unitOfSkill = useMemo(() => allUnits().find((u) => u.skills.some((s) => s.id === skill.id)), [skill.id]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  // Unfinished arithmetic or a typo, said gently, with no try spent on it.
  const [nudge, setNudge] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [attempts, setAttempts] = useState(0);
  /** What was tried last, read for where it went wrong once it is marked. */
  const [lastTry, setLastTry] = useState<Attempt | null>(null);
  const [mastery, setMastery] = useState<MasteryLevel>("locked");
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

  // A wrong answer gets a small physical cue on the answer box: a short
  // shake, skipped for anyone who asked for less motion.
  useEffect(() => {
    if (feedback !== "wrong") return;
    const el = answerField.current?.el;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "ease-out" }
    );
  }, [feedback, feedbackSeed]);
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
    sessionRightRef.current = 0;
    setSessionRight(0);
    setSeed(next);
    // Questions this browser already showed for the skill go to the back.
    setSessionProblems(getFreshProblemsForSkill(skill.id, seedProblemsRef.current, next, { seen: loadSeen(skill.id) }));
    setProblemIndex(0);
  }, [skill.id, resetStories]);

  useEffect(() => {
    startSession();
    setCombo(0);
    setMisses(0);
    setNudgeDismissedAt(0);
  }, [startSession]);

  // New interests: problems not yet on screen get written again for them.
  useEffect(() => {
    if (topicsLoaded) resetStories();
  }, [topicsKey, topicsLoaded, resetStories]);

  const allProblems: ActiveProblem[] = useMemo(
    () => (sessionProblems.length > 0 ? sessionProblems : skill.problems),
    [skill, sessionProblems]
  );

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
    if (seed === null || !topics.length || askingRef.current) return;
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
      // The server finds each problem by id in a bank it builds with its own
      // copy of the generators. After a deploy that changed them, an id can
      // name a different problem than the one this tab shows, and its story
      // would be graded against this problem's key. Only a story that keeps
      // this problem's own numbers and math is used.
      const own = new Map(sessionProblems.map((sp) => [sp.id, sp]));
      for (const p of data.problems ?? []) {
        if (typeof p.id === "string" && typeof p.prompt === "string") {
          const mine = own.get(p.id);
          if (!mine || !checkRewrite(mine as PersonalizableProblem, p.prompt).ok) continue;
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
  }, [seed, topics, sessionProblems, problemIndex, scenes, skill.id]);
  const fetchBatchRef = useRef(fetchBatch);
  fetchBatchRef.current = fetchBatch;

  // Keep two stories ready ahead of the student, and ask straight away when
  // the problem on screen is still waiting for one.
  useEffect(() => {
    if (seed === null || !topicsLoaded || !topics.length || asking) return;
    if (Date.now() < quietUntilRef.current) return;
    const ready = sessionProblems
      .slice(problemIndex)
      .filter((p) => !shownRef.current.has(p.id) && scenes[p.id]).length;
    const current = sessionProblems[problemIndex];
    const currentWaiting = !!current && !shownRef.current.has(current.id) && !scenes[current.id];
    if (ready < 2 || currentWaiting) void fetchBatchRef.current();
  }, [seed, topicsLoaded, topics.length, asking, problemIndex, scenes, sessionProblems, quietTick]);

  // Stories first: whenever some arrive, move those problems to the front of
  // what is still to come. The bank's order is random anyway.
  useEffect(() => {
    setSessionProblems((list) => {
      const i = problemIndexRef.current;
      const current = list[i];
      const from = current && shownRef.current.has(current.id) ? i + 1 : i;
      // Moving stories forward can bring two of a kind together; spread them again.
      const moved = storiesFirst(list, from, (p) => !!scenes[p.id]);
      return moved === list ? list : spreadShapes(moved, from, (p) => shapeKey(p.prompt));
    });
  }, [scenes]);

  // The problem on screen waits for its story, briefly: longer for the first
  // one of a visit, while its batch is still being written.
  const tries = problem ? requestedRef.current.get(problem.id) ?? 0 : 0;
  const storyCouldCome =
    asking || (tries < 2 && Date.now() >= quietUntilRef.current);
  const waitingOn =
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
  const pending = seed === null || !topicsLoaded || waitingOn !== null;

  let scene: Scene | null = null;
  if (problem && !pending) {
    const shown = shownRef.current;
    if (!shown.has(problem.id)) shown.set(problem.id, scenes[problem.id] ?? null);
    scene = shown.get(problem.id) ?? null;
  }
  const displayPrompt = problem ? scene?.prompt ?? stripVariantTag(problem.prompt) : "";

  // Once a question is on screen it counts as asked: the next session deals it last.
  const shownPrompt = problem && !pending ? problem.prompt : null;
  useEffect(() => {
    if (shownPrompt) rememberSeen(skill.id, shownPrompt);
  }, [shownPrompt, skill.id]);

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
    setNudge(null);
    setShowHint(false);
    setShowExplanation(false);
    setAttempts(0);
    setLastTry(null);
    setEliminated([]);
    setEliminatedSteps([]);
    setRevealed(false);
    stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemIndex, problem]);

  // The clock for a fast run starts when the problem can be read, after any story is written.
  useEffect(() => {
    if (problem && !pending) shownAtRef.current = Date.now();
  }, [problemIndex, problem, pending]);

  // A new skill is a new page: last skill's finish card goes with it.
  useEffect(() => setCelebration(null), [skill.id]);

  // "Keep practicing" is a fresh bank from the same generators as every
  // session. It used to hand students without interests to a set of older,
  // unseeded generators, one of which served the same substitution problem
  // forever: typing 3 five times finished the skill.
  const loadMoreProblems = useCallback(() => startSession(), [startSession]);

  const handleSubmit = useCallback(() => {
    if (!problem || feedback === "correct" || pending || revealed) return;

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
      // Typed arithmetic counts where the calculator is offered, since that
      // is where the arithmetic is bookkeeping. Elsewhere, and for the
      // problem's own expression typed back, the student is asked to finish
      // it, and the try is not spent.
      const verdict = gradeAnswer({ ...problem, prompt: displayPrompt }, userAnswer, { expressions: calculatorAllowed });
      if (verdict === "simplify" || verdict === "unreadable") {
        setNudge(
          verdict === "simplify"
            ? "Finish the arithmetic, then type one number, like 12, -3 or 2/3."
            : "Type your answer as a number, like 12, -3, 2/3 or 0.75."
        );
        return;
      }
      correct = verdict === "right";
    }
    setNudge(null);

    setLastTry({
      given: problem.type === "multiple-choice" ? (selectedChoice ?? "") : userAnswer,
      step: selectedStep,
      order: [...stepOrder],
    });
    const firstTry = attempts === 0;
    announcePractice(correct ? "correct" : "wrong");
    setFeedback(correct ? "correct" : "wrong");
    setFeedbackSeed((s) => s + 1);
    setAttempts((a) => a + 1);

    if (correct) {
      setShowExplanation(true);
      playCorrect();
      setCombo((c) => c + 1);

      if (practiceOnly) {
        // Looking ahead: the answer is checked and explained, and that is all.
        sessionRightRef.current += 1;
        setSessionRight(sessionRightRef.current);
        onPracticeRight?.(sessionRightRef.current);
        // A quick first try keeps the run going; a slow one or a second try starts it over.
        const quick = firstTry && Date.now() - shownAtRef.current <= FAST_SECONDS * 1000;
        fastRunRef.current = quick ? fastRunRef.current + 1 : 0;
        // A slow answer ends the run, and the offer with it: "4 in a row,
        // each in under 45 seconds" stayed up after the run was over.
        setFastOffer(fastRunRef.current >= FAST_RUN && onOpenSkill ? fastRunRef.current : null);
        return;
      }

      const result = recordProblemAttempt(skill.id, true, { firstTry });
      setMastery(result.newLevel);
      onMasteryChange?.(result.newLevel);

      const run = combo + 1;
      if (run % 5 === 0) {
        fireConfetti(run >= 10 ? "big" : "small");
        showToast({
          icon: "flame",
          tone: "reward",
          title: `${run} in a row`,
          description: run >= 10 ? `${run} straight, every one on the first try.` : "Every one on the first try.",
        });
      }

      if (result.dailyBonus > 0) {
        fireConfetti("small");
        playLevelUp();
        const streak = result.progress.streak;
        showToast({
          icon: "coin",
          tone: "reward",
          title: `Daily goal · +${result.dailyBonus} Bridgeys`,
          description: `${DAILY_GOAL} right today. Come back tomorrow for day ${Math.max(1, streak) + 1} of your streak.`,
        });
      }

      if (result.xpGained > 0) {
        setXpPopup({ amount: result.xpGained, key: Date.now() });
      }
      if (result.leveledUp) {
        playLevelUp();
        const info = getLevelInfo(result.progress.xp);
        showToast({
          icon: "star",
          tone: "info",
          title: `Level ${result.newLevelNumber}: ${info.title}`,
          description: "Your XP reached a new level.",
        });
      }
      if (result.skillJustCompleted) {
        // The finish is a moment on the page, with the next step one click
        // away, rather than a toast that slides off while they keep going.
        fireConfetti(result.unitJustCompleted ? "big" : "small");
        const prize = result.unitPrizeId ? getFurnitureItem(result.unitPrizeId) : null;
        setCelebration({
          paid: bridgeysForSkill(skill.id),
          unitNumber: result.unitJustCompleted ? unitOfSkill?.number ?? null : null,
          unitBonus: result.unitJustCompleted ? BRIDGEY_REWARDS.unitComplete : 0,
          prizeName: prize?.name ?? null,
        });
        if (result.courseJustCompleted) {
          setCourseParty(true);
          window.setTimeout(() => fireConfetti("big"), 900);
        }
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
      fastRunRef.current = 0;
      setFastOffer(null);
      // The wrong pick is crossed out, so the next try is a new answer
      // rather than the same click again.
      if (problem.type === "multiple-choice" && selectedChoice !== null) {
        setEliminated((e) => (e.includes(selectedChoice) ? e : [...e, selectedChoice]));
        setSelectedChoice(null);
      }
      if (problem.type === "error-analysis" && selectedStep !== null) {
        setEliminatedSteps((e) => (e.includes(selectedStep) ? e : [...e, selectedStep]));
        setSelectedStep(null);
      }
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
    revealed,
    unitOfSkill,
    skill.id,
    skill.title,
    onMasteryChange,
    practiceOnly,
    onPracticeRight,
    onOpenSkill,
    playCorrect,
    playWrong,
    playLevelUp,
    displayPrompt,
    calculatorAllowed,
  ]);

  /** What had the focus when the student moved on (Next problem, Skip this one): the new problem takes it over. */
  const leavingFrom = useRef<Element | null>(null);
  function nextProblem() {
    leavingFrom.current = document.activeElement;
    if (problemIndex + 1 >= allProblems.length) {
      startSession();
      return;
    }
    setProblemIndex((i) => i + 1);
  }

  /** The worked answer, after two misses. Nothing is recorded: the misses already were. */
  function showMeHow() {
    if (!problem) return;
    setRevealed(true);
    setShowHint(false);
    if (problem.type === "step-order" && "correctOrder" in problem && problem.correctOrder) setStepOrder([...problem.correctOrder]);
    if (problem.type === "error-analysis" && "wrongStepIndex" in problem && typeof problem.wrongStepIndex === "number") setSelectedStep(problem.wrongStepIndex);
    if (problem.type === "multiple-choice" && problem.answer !== undefined) setSelectedChoice(String(problem.answer));
  }

  function moveStep(from: number, direction: -1 | 1) {
    const to = from + direction;
    if (to < 0 || to >= stepOrder.length) return;
    const next = [...stepOrder];
    [next[from], next[to]] = [next[to], next[from]];
    setStepOrder(next);
    // The row moves in the page, which drops the keyboard focus, and at the
    // top or bottom its arrow turns off. Put the focus back on the step that
    // moved (the other arrow at an end), and say where it landed.
    const moved = stepOrder[from];
    const atEnd = to === 0 || to === next.length - 1;
    const arrow = atEnd ? (direction === -1 ? "down" : "up") : direction === -1 ? "up" : "down";
    setStepNote(`Moved to place ${to + 1} of ${next.length}.`);
    requestAnimationFrame(() => stepArrows.current[`${moved}-${arrow}`]?.focus());
  }

  // Keyboard shortcuts: Enter submits/advances, 1-9 picks a multiple-choice answer.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const isTypingInInput =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || !!target?.isContentEditable;
      // Enter on a link, a button or any other control does what that control
      // does (open the calculator, follow a menu link, press Skip). The shortcut
      // is for when nothing in particular has the keyboard, and for an answer
      // choice that is already picked: Enter picks a choice, Enter again checks it.
      const control = target?.closest?.(
        "a[href], button, summary, select, [role=button], [role=tab], [role=link], [role=menuitem], [role=slider], [tabindex]:not([tabindex='-1'])"
      );
      const pickedChoice = !!control?.hasAttribute("data-choice") && control.getAttribute("aria-pressed") === "true";
      // The calculator and Archie take their own keys.
      const elsewhere = !!target?.closest?.("[role=dialog], [role=complementary]");

      if (e.key === "Enter" && !isTypingInInput && !elsewhere && (!control || pickedChoice)) {
        e.preventDefault();
        if (feedback === "correct" || revealed) {
          nextProblem();
        } else {
          handleSubmit();
        }
        return;
      }

      if (
        !isTypingInInput &&
        !elsewhere &&
        feedback !== "correct" &&
        !revealed &&
        problem?.type === "multiple-choice" &&
        problem.choices &&
        /^[1-9]$/.test(e.key)
      ) {
        const choice = problem.choices[Number(e.key) - 1];
        if (choice && !eliminated.includes(choice)) setSelectedChoice(choice);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, problem, handleSubmit, revealed, eliminated]);

  // Keyboard focus follows the work, for someone working by keyboard only
  // (a tap never moves it, so a phone's keyboard does not pop up). When an
  // answer is done, the focus the answer box or Check button just lost goes
  // to Next problem; after Next or Skip it goes to the new answer box, or
  // the first choice. Focus that is somewhere else (Archie, the calculator)
  // is left alone.
  const byKeyboard = useRef(false);
  const focusNewProblem = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const key = () => (byKeyboard.current = true);
    const tap = () => (byKeyboard.current = false);
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", tap, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("pointerdown", tap, true);
    };
  }, []);
  const focusIsLost = () => {
    const a = document.activeElement as HTMLElement | null;
    return !a || a === document.body || a.matches(":disabled");
  };
  useEffect(() => {
    if ((feedback === "correct" || revealed) && byKeyboard.current && focusIsLost()) nextRef.current?.focus();
  }, [feedback, revealed]);
  // A wrong pick is crossed out and turned off, which drops the focus it had:
  // it goes to the first pick still open, so the next try is one key away.
  useEffect(() => {
    if (feedback !== "wrong" || revealed || !byKeyboard.current || !focusIsLost()) return;
    document.querySelector<HTMLElement>("[data-choice]:not(:disabled)")?.focus();
  }, [feedback, revealed, eliminated, eliminatedSteps]);
  useEffect(() => {
    focusNewProblem.current = byKeyboard.current;
  }, [problemIndex]);
  useEffect(() => {
    if (!focusNewProblem.current || pending || feedback) return;
    focusNewProblem.current = false;
    // The button pressed may still hold the focus: Check answer reuses Next problem's place.
    if (!focusIsLost() && document.activeElement !== leavingFrom.current) return;
    if (answerField.current) answerField.current.focus();
    else document.querySelector<HTMLElement>("[data-choice]:not(:disabled)")?.focus();
  });

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

  const over = feedback === "correct" || revealed;

  // A wrong answer, read for where it went wrong: shown under the retry
  // message (with the answer left out) and again on the worked answer.
  const mistake = lastTry && (feedback === "wrong" || revealed) ? diagnoseMistake(problem, lastTry) : null;
  const typed = lastTry?.given && problem.type !== "error-analysis" && problem.type !== "step-order" ? lastTry.given : undefined;

  /** The hint, after two misses: a row of the wrong-answer note, or its own box. */
  const hintRow = (inNote: boolean) => (
    <div
      className={`flex items-start justify-between gap-3 px-4 py-3 text-sm text-amber-900 ${
        inNote ? "border-t border-amber-200/70" : "animate-pop-in mt-4 rounded-xl border border-amber-200 bg-amber-50"
      }`}
    >
      <p className="flex items-start gap-2">
        <Icon name="hint" size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          <span className="font-semibold">Hint:</span> <MathText text={problem.hint} />
        </span>
      </p>
      {speechSupported && (
        <button
          type="button"
          onClick={() => (speaking ? stopSpeech() : speak(problem.hint))}
          title={speaking ? "Stop reading aloud" : "Read the hint aloud"}
          aria-label={speaking ? "Stop reading the hint aloud" : "Read the hint aloud"}
          className={`-my-2.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-amber-100 ${speaking ? "animate-pulse" : ""}`}
        >
          <Icon name="speaker" size={18} />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {courseParty && <CourseCelebration progress={getProgress()} name={certificateName.trim()} onClose={() => setCourseParty(false)} />}
      {celebration && (
        <div
          style={hueVars(unitHue(unitOfSkill?.id ?? units[0].id))}
          className="hue-banner animate-pop-in relative overflow-hidden rounded-2xl px-5 py-5 shadow-sm sm:px-6"
        >
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Icon name={celebration.unitNumber ? "trophy" : "check"} size={26} />
            </span>
            {/* Read out by the practice's status line below, which is on the page before this arrives.
                min-w-[14rem]: in the 640px lesson column the text used to get 130px beside the buttons. */}
            <div className="min-w-[14rem] flex-1">
              <p className="text-lg font-bold leading-tight">
                {celebration.unitNumber ? `Unit ${celebration.unitNumber} complete` : "Skill complete"}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm opacity-95">
                <span>{skill.title} is done.</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <BridgeysLogo size={15} />+{celebration.paid + celebration.unitBonus} Bridgeys
                </span>
                {celebration.prizeName && <span>and the {celebration.prizeName} for your house.</span>}
              </p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {celebration.unitNumber && unitOfSkill && (
                <Link
                  href={`/certificate/${unitOfSkill.id}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/35 px-5 py-2 text-sm font-semibold transition hover:bg-white/10"
                >
                  <Icon name="printer" size={15} />
                  Your certificate
                </Link>
              )}
              {celebration.prizeName && (
                <Link href="/house" className="inline-flex min-h-11 items-center rounded-xl border border-white/35 px-5 py-2 text-sm font-semibold transition hover:bg-white/10">
                  Place it
                </Link>
              )}
              {next ? (
                <Link
                  href={next.href}
                  className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-px"
                >
                  Next: {next.title}
                  <Icon name="arrow-right" size={15} className="ml-1.5 shrink-0" />
                </Link>
              ) : (
                <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-px">
                  Back to the course
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setCelebration(null);
                  // The banner, and this button with it, goes away: the focus goes on to the practice.
                  requestAnimationFrame(() => (nextRef.current ? nextRef.current.focus() : answerField.current?.focus()));
                }}
                className="inline-flex min-h-11 items-center rounded-xl border border-white/35 px-5 py-2 text-sm font-semibold transition hover:bg-white/10"
              >
                Keep practicing
              </button>
            </div>
          </div>
          <div className="mt-4 border-t border-white/20 pt-3">
            <QuoteCard quote={quoteForFinish(skill.id)} variant="line" />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-panel">
        {practiceOnly ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
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
          // While the banner above is up it already says so.
          celebration ? null : (
          <div className="text-sm font-medium text-emerald-800">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Icon name="check" size={13} />
              </span>
              Skill complete. You got {ps.required} right.
            </span>
          </div>
          )
        ) : (
          <div className="flex min-w-0 items-center gap-3 text-sm text-slate-600">
            {/* Progress, drawn. A student should see how close they are
                without reading a sentence. A miss never empties a pip. */}
            <SolvedPips done={ps.solved} total={ps.required} />
            <span className="min-w-0">
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {combo >= 2 && (
            // Hotter the longer the run: amber at two, a flame-orange fill from three.
            <span
              key={combo}
              className={`animate-pop-in inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                combo >= 3
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm"
                  : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100"
              }`}
            >
              <Icon name="flame" size={14} />
              {combo} in a row
            </span>
          )}
          {mounted && !practiceOnly && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                daily.met ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-white text-slate-700 ring-slate-200"
              }`}
              title={`Daily goal: ${daily.goal} right answers, +${BRIDGEY_REWARDS.dailyGoal} Bridgeys`}
            >
              <DailyGoalRing right={daily.right} goal={daily.goal} size={20} stroke={3} />
              {daily.met ? "Daily goal met" : `${daily.right}/${daily.goal} today`}
            </span>
          )}
        </div>
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
        className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-panel sm:p-6 ${scene?.topic ? "hue-line" : "border-slate-200"}`}
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
        <div className="flex items-center justify-between gap-3">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Problem {(problemIndex % allProblems.length) + 1}
            {scene?.topic && <span className="hue-wash rounded-full px-2 py-0.5 font-semibold normal-case tracking-normal">{scene.topic}</span>}
          </p>
          <div className="flex shrink-0 items-center">
            {/* Working out, on the screen: marks clear with the next problem. */}
            <ScratchpadButton className="mr-1" />
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
          <PromptText text={displayPrompt} className="mt-3 text-lg leading-relaxed text-slate-800 [text-wrap:pretty] sm:text-xl" />
        )}

        {/* The answer, written as math: a square root with its bar, a fraction stacked. */}
        {!pending && problem.type === "numeric" && (
          <AnswerField
            key={`${problemIndex}:${problem.id}`}
            handle={answerField}
            value={userAnswer}
            onChange={(text) => {
              setUserAnswer(text);
              setNudge(null);
            }}
            onEnter={() => {
              if (feedback !== "correct") handleSubmit();
            }}
            placeholder={
              "decimalPlaces" in problem && typeof problem.decimalPlaces === "number" ? "Your answer, rounded" : "Your answer"
            }
            tone={feedback === "correct" ? "right" : feedback === "wrong" ? "wrong" : "idle"}
            locked={over}
            note={nudge}
            className="mt-4 max-w-md"
          />
        )}

        {/* Multiple choice */}
        {!pending && problem.type === "multiple-choice" && problem.choices && (
          <div className="mt-4 space-y-2">
            {problem.choices.map((choice, i) => {
              const out = eliminated.includes(choice);
              const isAnswer = revealed && answerIsRight(problem, choice);
              const picked = selectedChoice === choice && !revealed;
              return (
                <button
                  key={`${i}-${choice}`}
                  type="button"
                  disabled={over || out}
                  onClick={() => setSelectedChoice(choice)}
                  onKeyDown={ignoreSpaceKey}
                  data-choice=""
                  aria-pressed={picked}
                  aria-label={out ? `${choice}, already tried` : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    isAnswer
                      ? "border-emerald-400 bg-emerald-50 font-medium text-emerald-900"
                      : out
                        ? "cursor-not-allowed border-red-100 bg-red-50/50 text-slate-400"
                        : picked
                          ? "hue-tint hue-ink font-medium"
                          : "border-slate-200 hover:bg-slate-50"
                  } ${over ? "cursor-default" : ""}`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      isAnswer
                        ? "bg-emerald-500 text-white"
                        : out
                          ? "bg-red-100 text-red-500"
                          : picked
                            ? "hue-solid"
                            : "border border-slate-300 text-slate-400"
                    }`}
                  >
                    {isAnswer ? <Icon name="check" size={12} /> : out ? <Icon name="close" size={11} /> : i + 1}
                  </span>
                  <span className={out ? "line-through decoration-red-300" : ""}>
                    <MathText text={choice} />
                  </span>
                </button>
              );
            })}
            {/* Keyboard tips only where there is a keyboard: not on phones or touch screens. */}
            <p className="hidden text-xs text-slate-400 sm:block [@media(hover:none)]:hidden">Tip: press 1-{problem.choices.length} to pick an answer.</p>
          </div>
        )}

        {/* Error analysis */}
        {!pending && problem.type === "error-analysis" && getProblemSteps(problem) && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-500">
              Choose the step that contains the error:
            </p>
            {getProblemSteps(problem)!.map((step, i) => {
              const out = eliminatedSteps.includes(i);
              const isError = revealed && "wrongStepIndex" in problem && problem.wrongStepIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={over || out}
                  onClick={() => setSelectedStep(i)}
                  onKeyDown={ignoreSpaceKey}
                  data-choice=""
                  aria-pressed={selectedStep === i && !revealed}
                  className={`block w-full rounded-xl border px-4 py-3 text-left font-mono text-sm ${
                    isError
                      ? "border-amber-400 bg-amber-50 text-amber-950"
                      : out
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                        : selectedStep === i && !revealed
                          ? "border-red-400 bg-red-50 ring-2 ring-red-400"
                          : "border-slate-200 hover:border-red-200"
                  }`}
                >
                  Step {i + 1}:{" "}
                  <span className={out ? "line-through" : ""}>
                    <MathText text={step} />
                  </span>
                  {out && <span className="ml-2 font-sans text-xs text-slate-400">this step is right</span>}
                  {isError && <span className="ml-2 font-sans text-xs font-semibold text-amber-700">the mistake is here</span>}
                </button>
              );
            })}
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
                <span className="flex-1 text-sm">
                  <MathText text={getProblemSteps(problem)![stepIdx]} />
                </span>
                <button
                  ref={(el) => {
                    stepArrows.current[`${stepIdx}-up`] = el;
                  }}
                  type="button"
                  disabled={over || position === 0}
                  onClick={() => moveStep(position, -1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                  aria-label={`Move "${getProblemSteps(problem)![stepIdx]}" up`}
                >
                  <Icon name="chevron-up" size={18} />
                </button>
                <button
                  ref={(el) => {
                    stepArrows.current[`${stepIdx}-down`] = el;
                  }}
                  type="button"
                  disabled={over || position === stepOrder.length - 1}
                  onClick={() => moveStep(position, 1)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                  aria-label={`Move "${getProblemSteps(problem)![stepIdx]}" down`}
                >
                  <Icon name="chevron-down" size={18} />
                </button>
              </div>
            ))}
            <p role="status" className="sr-only">
              {stepNote}
            </p>
          </div>
        )}

        {/* Always on the page, so a screen reader reads each verdict as it lands. */}
        <p role="status" className="sr-only">
          {[
            feedback && !revealed ? feedbackLine(feedback, feedbackSeed) : "",
            celebration ? `${celebration.unitNumber ? `Unit ${celebration.unitNumber}` : "Skill"} complete. ${skill.title} is done.` : "",
          ]
            .filter(Boolean)
            .join(" ")}
        </p>

        {/* Feedback */}
        {feedback && !revealed && (
          <div className="mt-4">
            {feedback === "wrong" && (mistake?.note || showHint) ? (
              // One coach note, not a stack of warnings: the verdict, what went
              // wrong, and from the second miss the hint, in one box.
              <div key={`wrong-${feedbackSeed}`} className="animate-pop-in overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
                <AnswerFeedback state="wrong" seed={feedbackSeed} flush />
                {mistake?.note && <MistakeNote diagnosis={mistake} flush />}
                {showHint && hintRow(true)}
              </div>
            ) : (
              <AnswerFeedback state={feedback} seed={feedbackSeed} />
            )}
            {feedback === "correct" && showExplanation && (
              <div className="mt-2 px-1 text-sm text-slate-600">
                <WorkedSteps text={problem.explanation} />
              </div>
            )}
            {practiceOnly && fastOffer !== null && onOpenSkill && (
              <div className="hue-tint animate-pop-in mt-4 rounded-xl border px-4 py-3" role="status">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <Icon name="flame" size={17} className="hue-ink" />
                  {fastOffer} in a row, each in under {FAST_SECONDS} seconds
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  You already know {skill.title}. Open it now and your answers start counting toward it, right where you are.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFastOffer(null);
                      onOpenSkill();
                    }}
                    onKeyDown={ignoreSpaceKey}
                    className="hue-solid inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110"
                  >
                    Open this skill
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // A fresh run earns the offer again.
                      fastRunRef.current = 0;
                      setFastOffer(null);
                    }}
                    onKeyDown={ignoreSpaceKey}
                    className="btn-ghost btn-sm"
                  >
                    Keep practicing
                  </button>
                </div>
              </div>
            )}
            {feedback === "wrong" && attempts === 1 && !ps.isComplete && !practiceOnly && (
              <p className="mt-2 px-1 text-xs text-slate-500">
                Fix it for practice, or skip it. Your next first try counts toward the {ps.required}.
              </p>
            )}
          </div>
        )}

        {revealed && (
          <div className="animate-pop-in mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="hint" size={16} className="text-sky-600" />
              Here is how it goes
            </p>
            {answerText(problem) && (
              <p className="mt-1.5">
                The answer: <strong className="font-semibold"><MathText text={answerText(problem)!} /></strong>
              </p>
            )}
            {mistake?.note && (
              <p className="mt-1.5 leading-relaxed">
                {typed && (
                  <>
                    You put <strong className="font-semibold"><MathText text={typed} /></strong>.{" "}
                  </>
                )}
                {mistake.note}
                {mistake.fix ? ` ${mistake.fix}` : ""}
              </p>
            )}
            <div className="mt-2">
              <WorkedSteps text={problem.explanation} />
            </div>
            {skill.keyIdea && (
              <p className="mt-2.5 border-t border-sky-200 pt-2 text-xs leading-relaxed text-sky-900">
                <span className="font-semibold">Key idea:</span> {skill.keyIdea}
              </p>
            )}
            {!practiceOnly && !ps.isComplete && (
              <p className="mt-2 text-xs text-sky-800">The next first try counts toward the {ps.required}.</p>
            )}
          </div>
        )}

        {/* Under a wrong answer the hint is part of the note above; it stands
            alone only once a later answer has replaced that note. */}
        {showHint && !revealed && feedback !== "wrong" && hintRow(false)}

        {/* A few misses in, the AI helper is offered, opened on this problem. */}
        {showNudge && !over && (
          <div className="mt-4 rounded-xl border border-bridge-100 bg-bridge-50 px-4 py-3 sm:flex sm:items-center sm:gap-3">
            <div className="min-w-0 sm:flex-1">
              <p className="text-sm font-semibold text-bridge-900">Stuck? Talk it through with Archie.</p>
              <p className="mt-0.5 text-xs text-bridge-800">
                Archie, your AI study buddy, can see this problem and coaches you one step at a time.
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
                Ask Archie
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
          {!over ? (
            <button
              type="button"
              onClick={handleSubmit}
              onKeyDown={ignoreSpaceKey}
              disabled={pending}
              className="btn-primary"
            >
              Check answer
            </button>
          ) : (
            <button
              ref={nextRef}
              type="button"
              onClick={nextProblem}
              onKeyDown={ignoreSpaceKey}
              className="btn-primary"
            >
              Next problem
              <Icon name="arrow-right" size={16} />
            </button>
          )}

          {attempts >= 2 && !over && (
            <button type="button" onClick={showMeHow} onKeyDown={ignoreSpaceKey} className="btn-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="hint" size={15} />
                Show me how
              </span>
            </button>
          )}

          {attempts > 0 && !over && (
            <button type="button" onClick={nextProblem} onKeyDown={ignoreSpaceKey} className="btn-ghost">
              Skip this one
            </button>
          )}

          {/* A fresh bank, once the skill is done. Before that, Skip and Next
              problem already move on, and three look-alike buttons in a row
              could not be told apart. The finish banner has its own. */}
          {ps.isComplete && !celebration && sessionProblems.length > 1 && (
            <button type="button" onClick={loadMoreProblems} className="btn-secondary">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="review" size={15} />
                Keep practicing
              </span>
            </button>
          )}
          <p className="ml-auto hidden self-center text-xs text-slate-400 sm:block [@media(hover:none)]:hidden">
            Press <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5">Enter</kbd> to
            {over ? " continue" : " check"}
          </p>
        </div>
        {/* A problem that reads wrong is worth hearing about, from the card it is on. */}
        <div className="mt-3 text-right">
          <Link
            href={`/feedback?kind=problem&about=${encodeURIComponent(`${skill.title}: ${displayPrompt.slice(0, 140)}`)}`}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600 hover:underline"
          >
            Something off with this problem? Tell us
          </Link>
        </div>
      </div>

    </div>
  );
}

/** Problems banked so far: filled for each one right, hollow for what is still owed. */
function SolvedPips({ done, total }: { done: number; total: number }) {
  return (
    <span role="img" className="flex shrink-0 items-center gap-1" aria-label={`${done} of ${total} right`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-3 w-3 rounded-full transition ${
            i < done ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
      ))}
    </span>
  );
}
