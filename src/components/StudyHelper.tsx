"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { createSessionRequest } from "@/lib/sessions";
import { isRealName, splitName } from "@/lib/name";
import { getInterests } from "@/lib/progress";
import {
  getHelperContext,
  getHelperOpenRequests,
  getServerHelperOpenRequests,
  subscribeHelperBridge,
} from "@/lib/helper-bridge";
import {
  advanceScheduler,
  BOOKING_INTRO,
  CRISIS_REPLY,
  detectCrisis,
  detectCrisisInTurns,
  FORMULA_CARDS,
  forbiddenValues,
  isNo,
  isYes,
  leaksAnswer,
  modelSignalsCrisis,
  schedulerPrompt,
  type HelperAction,
  type HelperContext,
  type HelperMessage,
  type HelperMode,
  type SchedulerState,
} from "@/lib/helper";
import {
  clampSidebarWidth,
  getSidebarOpenRequests,
  PRACTICE_EVENT,
  setSidebarState,
  SIDEBAR_BREAKPOINT,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  SIDEBAR_OPEN_KEY,
  SIDEBAR_WIDTH_KEY,
  subscribeSidebar,
  type PracticeResult,
} from "@/lib/sidebar";
import { Archie, ArchieFace, reducedMotion, type ArchieMark, type ArchiePose } from "@/components/archie/Archie";
import { HEART_QUIPS, reactionLine, STAR_QUIPS } from "@/components/archie/lines";
import {
  AFFECTION_LINES,
  AHA_LINES,
  BYE_LINES,
  chatRequestKind,
  checkQuizReply,
  CONFUSED_LINES,
  CONFUSED_PLAIN_LINES,
  DAY_REPLIES,
  EASY_QUIZ,
  FACT_OUTROS,
  fillName,
  GOOD_MOOD_REPLIES,
  GOT_IT_LINES,
  greetingFor,
  HELLO_REPLIES,
  IDLE_NUDGES,
  MATH_FUN_FACTS,
  MATH_JOKES,
  MOTIVATE_LINES,
  pickFresh,
  practiceTemplate,
  QUIZ_INTROS,
  QUIZ_REVEAL,
  QUIZ_RIGHT,
  QUIZ_TRY_AGAIN,
  quizLine,
  smallTalkKind,
  THANKS_REPLIES,
  type AgainKind,
} from "@/lib/archie-persona";
import { autoReactionFor, responseToReaction, toggleReaction, type ReactionId } from "@/lib/archie-reactions";
import { Chip, ChipGrid, ChipRow, type ChipSpec } from "@/components/helper/Chips";
import { ContextCard } from "@/components/helper/ContextCard";
import { CrisisCard } from "@/components/helper/CrisisCard";
import { useSchoolMode } from "@/components/SchoolModePanel";
import { SCHOOL_ESCALATION_REPLY } from "@/lib/school-mode";
import { guardFreeText } from "@/lib/safety";
import { AssistantBubble, UserBubble, prefersReducedMotion } from "@/components/helper/MessageBubble";
import { TypingDots } from "@/components/helper/TypingDots";
import { SlipSteps } from "@/components/SlipSteps";
import { answerInMessage, submitAnswerToCard } from "@/lib/answer-bridge";
import {
  EMPTY_THREAD,
  type ChatMessage,
  type FollowUpId,
  type MessageKind,
  type PadLine,
  type Thread,
} from "@/components/helper/types";

/**
 * Archie, the AI study buddy, in a sidebar.
 *
 * On a wide screen (1024 px and up) he docks on the right under the header,
 * full height, and the page makes room for him rather than sitting under
 * him. The left edge drags to resize, and the width and whether he was open
 * are remembered on this device. On anything narrower he is a bottom sheet
 * over the page, closed with Escape, the scrim, or a swipe down.
 *
 * Three modes, one rule: he will not hand over an answer. That is enforced on
 * the server in /api/helper, not here, so a student poking at the client
 * cannot talk their way around it. The quick actions only choose what kind
 * of help to ask for; the server still gates the words and filters the reply.
 *
 * Each problem gets its own conversation for the session, so moving to the
 * next problem starts fresh and coming back finds the old one. Check my work
 * runs entirely here, with no model: see lib/work-check.ts.
 *
 * When the conversation reaches the point where a person is needed, the panel
 * takes over from the model and walks a fixed three-question booking script.
 * Deterministic on purpose: a booking is a transaction, not a chat. In school
 * mode (lib/school-mode.ts) there is no booking: he points to the teacher.
 *
 * Before any of that, every message is checked for signs that the student is
 * in danger (detectCrisis), on its own and joined to the student's message
 * before it (detectCrisisInTurns), so "i want to" then "die" is caught. One
 * that matches is not saved into a booking, not sent to a tutor and not sent
 * to the server: the panel shows the crisis card (helper/CrisisCard.tsx) with
 * 988, the Crisis Text Line and a trusted adult, and nothing playful follows
 * it. A reply that comes back as the model's crisis signal (CRISIS) gets the
 * same card. A booking answer, which every tutor can read, gets the personal
 * information guard too (guardFreeText): no phone numbers or usernames.
 *
 * The conversation lives in memory for one person: when the signed-in
 * account changes (a sign-out on a shared Chromebook), every thread, quiz,
 * booking and reply on its way is dropped.
 *
 * Archie himself reacts to practice (PRACTICE_EVENT): a hop and confetti for a
 * right answer, a fist pump for a miss, and in Tutor mode a short buddy line
 * in the conversation (the next one replaces it, so misses do not pile up).
 * Only while the sidebar is open, and never while a reply is loading or being
 * revealed.
 *
 * He is a buddy, not a help desk: a hello by name and time of day, small talk
 * chips (how is your day, a fun fact, a pep talk, an easy quiz), and replies
 * to "thanks" or "oh, I get it" that he writes himself from the persona's
 * lines (lib/archie-persona.ts), with no model. Those match whole messages
 * only, so anything with more in it, and anything about feelings, still goes
 * to the server, where the safety rules live. Facts and quiz questions that
 * hold a number from the student's own solution are skipped.
 *
 * Reactions (lib/archie-reactions.ts): the student can react to any of his
 * messages, he answers some of them, and he reacts to theirs when a simple
 * rule says it fits. They live on the messages, so per problem, per session.
 */

// The pad pulls in the math parser, which only matters once it is opened.
const WorkPad = dynamic(() => import("@/components/helper/WorkPad").then((m) => m.WorkPad), {
  ssr: false,
  loading: () => <p className="px-3 py-6 text-sm text-slate-500">Opening the work pad...</p>,
});

const MODES: { id: HelperMode; label: string }[] = [
  { id: "tutor", label: "Tutor" },
  { id: "reminder", label: "Formulas" },
  { id: "scheduler", label: "Book a tutor" },
];

/** The formulas offered as chips, by the card name the server matches. */
const FORMULA_CHIPS: { name: string; label: string }[] = [
  { name: "Slope between two points", label: "Slope" },
  { name: "Slope-intercept form", label: "Slope-intercept form" },
  { name: "Point-slope form", label: "Point-slope form" },
  { name: "The quadratic formula", label: "Quadratic formula" },
  { name: "Exponent rules", label: "Exponent rules" },
  { name: "Difference of squares", label: "Difference of squares" },
  { name: "Distance between two points", label: "Distance formula" },
].filter((c) => FORMULA_CARDS.some((f) => f.name === c.name));

const ERROR_TEXT = "I couldn't reach the helper just now. Check your connection, then try again.";
const NAME = "Archie, your AI study buddy";
/** How long the closing slide takes, matched to helper.css. */
const LEAVE_MS = 220;
/** Set once Archie has introduced himself on this device; after that he says hello like a friend. */
const MET_KEY = "algebridge-archie-met";
/** How long a quiet student waits on a problem before Archie offers a nudge, once. */
const NUDGE_MS = 45000;

/** A beat of "typing" before a line he writes himself, longer for a longer line. */
function thinkMs(text: string): number {
  return Math.round(Math.min(1100, Math.max(450, 380 + text.length * 4)));
}

const FOLLOW_UP_LABELS: Record<FollowUpId, { label: string; icon: ChipSpec["icon"] }> = {
  "another-way": { label: "Explain it another way", icon: "review" },
  "next-step": { label: "Next step", icon: "play" },
  hint: { label: "Give me a hint", icon: "hint" },
  fact: { label: "Another fun fact", icon: "star" },
  quiz: { label: "Another question", icon: "trophy" },
  joke: { label: "Another joke", icon: "spark" },
};

let nextMessageId = 1;
const makeMessage = (m: Omit<ChatMessage, "id">): ChatMessage => ({ id: nextMessageId++, ...m });

/** The small-talk chips, and the words each one puts in the student's bubble. */
type ChatKind = "day" | "fact" | "motivate" | "quiz" | "joke";
const CHAT_ASK: Record<ChatKind, string> = {
  day: "How's your day going?",
  fact: "Tell me a math fun fact",
  motivate: "Motivate me",
  quiz: "Quiz me on something easy",
  joke: "Tell me a math joke",
};

/**
 * What Archie may know about the student when a model writes his reply:
 * their first name and the interests they picked, with the teams, players
 * and characters they named for them, nothing more. The server cleans both
 * again before they reach a prompt.
 */
function studentForPrompt(firstName: string | null): { firstName?: string; interests?: { label: string; specifics?: string }[] } {
  let interests: { label: string; specifics?: string }[] = [];
  try {
    interests = (getInterests()?.topics ?? [])
      .filter((t) => typeof t.label === "string")
      .map((t) => (t.specifics ? { label: t.label, specifics: t.specifics } : { label: t.label }))
      .slice(0, 6);
  } catch {
    /* no saved progress: no interests */
  }
  return { ...(firstName ? { firstName } : {}), ...(interests.length ? { interests } : {}) };
}

/**
 * What goes over the wire: roles and words, never the panel's own errors or
 * his hello, never a crisis turn, and never a message the panel held back:
 * those stay on this device.
 */
function toWire(messages: ChatMessage[]): HelperMessage[] {
  return messages
    .filter((m) => m.kind !== "error" && m.kind !== "greeting" && m.kind !== "crisis" && m.kind !== "held")
    .map((m) => ({ role: m.role, content: m.content }));
}

function threadKeyFor(mode: HelperMode, ctx: HelperContext | null): string {
  return mode === "tutor" ? `tutor:${ctx?.problemPrompt?.trim() ?? ""}` : mode;
}

const getNoContext = () => null;
const getNoRequests = () => 0;

// Docked or a sheet, by the same breakpoint the layout uses.
const WIDE_QUERY = `(min-width: ${SIDEBAR_BREAKPOINT}px)`;
function subscribeWide(fn: () => void): () => void {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
const getWide = () => window.matchMedia(WIDE_QUERY).matches;
const getServerWide = () => false;

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: it just will not be remembered */
  }
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea, a[href], [tabindex]:not([tabindex="-1"])';

function SendArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
    </svg>
  );
}

interface Reaction {
  pose: ArchiePose;
  line: string | null;
  burst: number;
  mark?: ArchieMark | null;
}

export function StudyHelper() {
  const { user, profile, loading: authLoading } = useAuth();
  /** School mode: no booking, and an ask for a person points to the teacher. */
  const school = useSchoolMode();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Opened from memory on page load: no slide in, no focus grab. */
  const [quiet, setQuiet] = useState(false);
  const [mode, setMode] = useState<HelperMode>("tutor");
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [spoken, setSpoken] = useState(false);
  const [sends, setSends] = useState(0);
  // No Book a tutor tab in school mode, so never sit on it.
  useEffect(() => {
    if (school && mode === "scheduler") setMode("tutor");
  }, [school, mode]);

  // Size: what the student chose, kept within what this window allows.
  const wide = useSyncExternalStore(subscribeWide, getWide, getServerWide);
  const [preferred, setPreferred] = useState(SIDEBAR_DEFAULT);
  const [vw, setVw] = useState(0);
  const width = clampSidebarWidth(preferred, vw || 1440);
  const widest = clampSidebarWidth(SIDEBAR_MAX, vw || 1440);
  const shown = open && !leaving;
  const docked = open && wide;
  const sheet = open && !wide;

  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const pinnedToBottom = useRef(true);
  const focusOnOpen = useRef(false);
  const leaveTimer = useRef(0);
  const resizing = useRef(false);
  const sheetDrag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const [sheetDy, setSheetDy] = useState(0);
  const [snapping, setSnapping] = useState(false);

  // The problem practice has on screen, if any. It names the conversation.
  const context = useSyncExternalStore(subscribeHelperBridge, getHelperContext, getNoContext);
  const problem = context?.problemPrompt?.trim() || "";
  const threadKey = threadKeyFor(mode, context);
  const keyRef = useRef(threadKey);
  keyRef.current = threadKey;
  const thread = threads[threadKey] ?? EMPTY_THREAD;
  const busy = pending !== null;
  const revealing = thread.messages.some((m) => m.animate);
  const typing = inputFocused && input.trim().length > 0;
  /** The student has said something in this conversation. */
  const hasUser = thread.messages.some((m) => m.role === "user");
  /** The newest thing here is the crisis card: Archie stays calm and quiet under it. */
  const calm = thread.messages[thread.messages.length - 1]?.kind === "crisis";

  const firstName = profile && isRealName(profile.displayName) ? splitName(profile.displayName).first : null;

  const update = useCallback((key: string, fn: (t: Thread) => Thread) => {
    setThreads((all) => ({ ...all, [key]: fn(all[key] ?? EMPTY_THREAD) }));
  }, []);

  /** What Archie said lately, so he never says the same line twice running. */
  const recentSaid = useRef<string[]>([]);
  const say = useCallback((line: string) => {
    recentSaid.current = [line, ...recentSaid.current].slice(0, 12);
    return line;
  }, []);
  /** He has said hello this session; later problems get a shorter hi. */
  const greeted = useRef(false);

  // --- Opening, closing, remembering -------------------------------------

  const openSidebar = useCallback((focus: boolean) => {
    window.clearTimeout(leaveTimer.current);
    writeStore(SIDEBAR_OPEN_KEY, "1");
    focusOnOpen.current = focus;
    setQuiet(false);
    setLeaving(false);
    setSheetDy(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    writeStore(SIDEBAR_OPEN_KEY, "0");
    const hadFocus = !!panelRef.current?.contains(document.activeElement);
    const finish = () => {
      setOpen(false);
      setLeaving(false);
      setSheetDy(0);
      setSnapping(false);
      // Back to the button that opened it, so a keyboard user is not dropped
      // at the top of the page.
      if (hadFocus) requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
    };
    if (reducedMotion()) return finish();
    setLeaving(true);
    window.clearTimeout(leaveTimer.current);
    leaveTimer.current = window.setTimeout(finish, LEAVE_MS);
  }, []);

  // On load: the width chosen last time, and open again if it was left open
  // on a wide screen. (The script in <head> already made room for it.) Never
  // on a phone, where the sheet would cover the page the student came for.
  useEffect(() => {
    setVw(window.innerWidth);
    const saved = Number(readStore(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(saved) && saved > 0) setPreferred(saved);
    if (readStore(SIDEBAR_OPEN_KEY) === "1" && window.innerWidth >= SIDEBAR_BREAKPOINT) {
      setQuiet(true);
      setOpen(true);
    }
    // Transitions on again once the restored layout has painted.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => document.documentElement.removeAttribute("data-helper-still"));
    });
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(leaveTimer.current);
    };
  }, []);

  // Tell the page and the calculator where the sidebar is. The page's right
  // padding follows --helper-w and data-helper-dock in helper.css.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const dock = docked && !leaving;
    root.style.setProperty("--helper-w", `${width}px`);
    if (dock) root.setAttribute("data-helper-dock", "");
    else root.removeAttribute("data-helper-dock");
    setSidebarState({ open: shown, width: dock ? width : 0 });
  }, [docked, leaving, shown, width]);

  useEffect(
    () => () => {
      document.documentElement.removeAttribute("data-helper-dock");
      setSidebarState({ open: false, width: 0 });
    },
    []
  );

  // Docked under the header, whatever height the header turns out to be.
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header.sticky");
    if (!header) return;
    const apply = () =>
      document.documentElement.style.setProperty("--helper-top", `${Math.round(header.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Practice asks the helper to open when a student has missed a few. It
  // opens in Tutor mode on the problem they are on, with the quick actions
  // ready, and keeps whatever was already said about that problem.
  const helperRequests = useSyncExternalStore(subscribeHelperBridge, getHelperOpenRequests, getServerHelperOpenRequests);
  const seenHelperRequests = useRef(0);
  useEffect(() => {
    if (helperRequests === 0 || helperRequests === seenHelperRequests.current) return;
    seenHelperRequests.current = helperRequests;
    setMode("tutor");
    openSidebar(true);
  }, [helperRequests, openSidebar]);

  // Anything else in the app can ask for Archie too.
  const sidebarRequests = useSyncExternalStore(subscribeSidebar, getSidebarOpenRequests, getNoRequests);
  const seenSidebarRequests = useRef(0);
  useEffect(() => {
    if (sidebarRequests === 0 || sidebarRequests === seenSidebarRequests.current) return;
    seenSidebarRequests.current = sidebarRequests;
    openSidebar(true);
  }, [sidebarRequests, openSidebar]);

  // Escape closes the sheet always, and the docked panel when focus is in it:
  // a docked panel stays put while the student uses Escape on the page.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (sheet || panelRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, sheet, close]);

  // The sheet holds the page still behind it.
  useEffect(() => {
    if (!sheet) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [sheet]);

  // Focus moves in when the student opened it: onto the box on a wide screen,
  // onto the sheet itself on a phone, so the keyboard does not jump up over
  // half of it before they have chosen anything.
  useEffect(() => {
    if (!shown || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = sheet
        ? panel
        : (panel.querySelector<HTMLElement>("[data-autofocus]") ?? inputRef.current ?? panel.querySelector<HTMLElement>("input, button"));
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [shown, sheet]);

  // --- Archie --------------------------------------------------------------

  const [reaction, setReaction] = useState<Reaction | null>(null);
  const reactionTimer = useRef(0);
  const showReaction = useCallback((pose: ArchiePose, line: string | null, ms: number, mark: ArchieMark | null = null) => {
    window.clearTimeout(reactionTimer.current);
    setReaction((r) => ({ pose, line, mark, burst: (r?.burst ?? 0) + 1 }));
    reactionTimer.current = window.setTimeout(() => setReaction(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(reactionTimer.current), []);

  // A wave hello each time he opens.
  useEffect(() => {
    if (shown) showReaction("wave", null, 2300);
  }, [shown, showReaction]);

  // What the practice listener needs to know, without re-subscribing each render.
  const live = useRef({ shown, busy, revealing, typing, mode, firstName, problem, calm });
  live.current = { shown, busy, revealing, typing, mode, firstName, problem, calm };
  const streak = useRef(0);
  /** True while an answer typed to him is being checked by the card. */
  const checkingOnCard = useRef(false);
  const recentLines = useRef<string[]>([]);

  useEffect(() => {
    const onPractice = (e: Event) => {
      const result = (e as CustomEvent<{ result?: PracticeResult }>).detail?.result;
      if (result !== "correct" && result !== "wrong") return;
      // An answer he handed to the card gets his own reply, not this line too.
      if (checkingOnCard.current) return;
      streak.current = result === "correct" ? streak.current + 1 : 0;
      const now = live.current;
      // Only while he is on screen, and never over a reply being written or
      // read: a hint mid-reveal is not the moment for confetti. Never under
      // the crisis card either.
      if (!now.shown || now.busy || now.revealing || now.calm) return;
      const pose: ArchiePose = result === "correct" ? "party" : "encourage";
      const ms = result === "correct" ? 3200 : 3400;
      // Mid-sentence, he reacts without a word.
      if (now.typing) return showReaction(pose, null, ms);
      if (now.mode !== "tutor") {
        const line = reactionLine(result, streak.current, recentLines.current);
        recentLines.current = [line, ...recentLines.current].slice(0, 3);
        return showReaction(pose, line, ms);
      }
      // In Tutor mode he says it in the conversation, where it stays, and the
      // next practice line takes its place instead of stacking up.
      const line = fillName(say(practiceTemplate(result, streak.current, recentSaid.current)), now.firstName);
      const message = makeMessage({
        role: "assistant",
        kind: "buddy",
        practice: true,
        content: line,
        sentAt: Date.now(),
        animate: !prefersReducedMotion(),
        followUps: result === "wrong" && now.problem ? ["hint"] : undefined,
      });
      pinnedToBottom.current = true;
      update(keyRef.current, (t) => {
        const lastMsg = t.messages[t.messages.length - 1];
        return { ...t, messages: [...(lastMsg?.practice ? t.messages.slice(0, -1) : t.messages), message] };
      });
      showReaction(pose, null, ms);
    };
    window.addEventListener(PRACTICE_EVENT, onPractice);
    return () => window.removeEventListener(PRACTICE_EVENT, onPractice);
  }, [showReaction, say, update]);

  // His hello at the top of each conversation, once it is on screen: by name
  // and time of day the first time this session, shorter after that. Waits
  // for sign-in, and briefly for the profile, so the name is there when it
  // can be.
  const [profileWaitOver, setProfileWaitOver] = useState(false);
  useEffect(() => {
    if (!user || profile) return;
    const id = window.setTimeout(() => setProfileWaitOver(true), 1500);
    return () => window.clearTimeout(id);
  }, [user, profile]);
  const nameReady = !authLoading && (!user || !!profile || profileWaitOver);
  useEffect(() => {
    if (!shown || mode === "scheduler" || !nameReady) return;
    const key = threadKey;
    if ((threadsRef.current[key]?.messages.length ?? 0) > 0) return;
    const text = say(
      greetingFor({
        name: firstName,
        hour: new Date().getHours(),
        met: readStore(MET_KEY) === "1",
        spoken: spoken || greeted.current,
        mode: mode === "reminder" ? "reminder" : "tutor",
        problem: !!problem,
        recent: recentSaid.current,
      })
    );
    if (mode === "tutor") greeted.current = true;
    writeStore(MET_KEY, "1");
    const hello = makeMessage({
      role: "assistant",
      kind: "greeting",
      content: text,
      sentAt: Date.now(),
      animate: !prefersReducedMotion(),
    });
    update(key, (t) => (t.messages.length ? t : { ...t, messages: [hello] }));
  }, [shown, mode, threadKey, nameReady, firstName, spoken, problem, say, update]);

  // A quiet student on a problem gets one soft nudge beside his name.
  // Not while the work pad is open: the nudges point at the chips, which it hides.
  const padShown = !!thread.padOpen;
  useEffect(() => {
    if (!shown || mode !== "tutor" || !problem || hasUser || busy || padShown) return;
    const id = window.setTimeout(() => {
      if (live.current.typing || live.current.busy || live.current.revealing) return;
      showReaction("wave", say(pickFresh(IDLE_NUDGES, recentSaid.current)), 4200);
    }, NUDGE_MS);
    return () => window.clearTimeout(id);
  }, [shown, mode, problem, hasUser, busy, padShown, threadKey, showReaction, say]);

  const archiePose: ArchiePose = calm ? "idle" : busy ? "thinking" : (reaction?.pose ?? "idle");
  const archieMark = !calm && !busy && reaction?.pose === "happy" ? (reaction.mark ?? null) : null;
  const archieLine = !calm && !busy && reaction?.line ? reaction.line : null;

  // --- Resizing the docked panel ------------------------------------------

  const saveWidth = useCallback((w: number) => {
    setPreferred(w);
    writeStore(SIDEBAR_WIDTH_KEY, String(w));
  }, []);

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    resizing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    document.documentElement.setAttribute("data-helper-resizing", "");
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizing.current) return;
    setPreferred(clampSidebarWidth(window.innerWidth - e.clientX, window.innerWidth));
  };
  const onResizeEnd = () => {
    if (!resizing.current) return;
    resizing.current = false;
    document.documentElement.removeAttribute("data-helper-resizing");
    saveWidth(width);
  };
  const onResizeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    // The handle is on the left edge, so left makes the panel wider.
    const next =
      e.key === "ArrowLeft"
        ? width + step
        : e.key === "ArrowRight"
          ? width - step
          : e.key === "Home"
            ? SIDEBAR_MIN
            : e.key === "End"
              ? widest
              : null;
    if (next === null) return;
    e.preventDefault();
    saveWidth(clampSidebarWidth(next, window.innerWidth));
  };

  // --- Swipe the sheet down to close ---------------------------------------

  const onGrabStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sheet || (e.target as HTMLElement).closest("button, input, a")) return;
    sheetDrag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    setSnapping(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onGrabMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = sheetDrag.current;
    if (!d) return;
    d.dy = Math.max(0, e.clientY - d.y);
    setSheetDy(d.dy);
  };
  const onGrabEnd = () => {
    const d = sheetDrag.current;
    if (!d) return;
    sheetDrag.current = null;
    const speed = d.dy / Math.max(1, performance.now() - d.t);
    if (d.dy > 120 || (d.dy > 28 && speed > 0.55)) close();
    else {
      setSnapping(true);
      setSheetDy(0);
    }
  };

  /** Keeps Tab inside the sheet, which covers the page like a dialog. */
  const onSheetKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!sheet || e.key !== "Tab") return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => el.offsetParent !== null
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // --- The conversation ----------------------------------------------------

  /** Follows the conversation down, unless the student has scrolled up to reread. */
  const scrollToEnd = useCallback((force = false) => {
    const log = logRef.current;
    if (!log || (!force && !pinnedToBottom.current)) return;
    // The crisis card opens at its top on a short phone sheet: its first
    // lines ("talk to a trusted adult now") are the ones that must be read.
    const last = log.lastElementChild as HTMLElement | null;
    if (last?.classList.contains("crisis-card") && last.offsetHeight > log.clientHeight - 24) {
      log.scrollTop = last.offsetTop - 12;
      return;
    }
    log.scrollTop = log.scrollHeight;
  }, []);

  useEffect(() => {
    pinnedToBottom.current = true;
    const log = logRef.current;
    if (!log) return;
    // A reply being written that is taller than the view starts at its top,
    // so its first words are not out of sight; the reveal then follows down.
    const writing = log.querySelector<HTMLElement>(".rv-live")?.closest<HTMLElement>(".archie-row");
    if (writing && writing.offsetHeight > log.clientHeight - 24) log.scrollTop = writing.offsetTop - 12;
    else scrollToEnd(true);
  }, [thread.messages.length, pending, thread.scheduler?.step, threadKey, open, scrollToEnd]);

  // Once a reply is in full, its follow-ups appear under it: keep them in
  // view. A conversation that is only his hello stays at its top, where the
  // hello starts, with the chips under it.
  const onlyHello = thread.messages.length === 1 && thread.messages[0].kind === "greeting";
  useEffect(() => {
    if (revealing) return;
    if (onlyHello) logRef.current?.scrollTo({ top: 0 });
    else scrollToEnd();
  }, [revealing, onlyHello, scrollToEnd]);

  /** Keeps the word being written in view while the student reads along at the bottom. */
  const followReveal = useCallback((word: HTMLElement) => {
    const log = logRef.current;
    if (!log) return;
    const r = word.getBoundingClientRect();
    const box = log.getBoundingClientRect();
    if (r.bottom > box.bottom - 10 && r.top - box.bottom < 80) log.scrollTop += r.bottom - box.bottom + 14;
  }, []);

  function push(key: string, message: Omit<ChatMessage, "id">) {
    update(key, (t) => ({ ...t, messages: [...t.messages, makeMessage({ sentAt: Date.now(), ...message })] }));
  }

  // Each new message of his is read out once, in full, by screen readers.
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(0);
  useEffect(() => {
    const newest = [...thread.messages].reverse().find((m) => m.role === "assistant");
    if (!newest || newest.id <= announced.current) return;
    announced.current = newest.id;
    if (!newest.sentAt || Date.now() - newest.sentAt > 4000) return;
    setAnnouncement(newest.card ? `${newest.card.name}. ${newest.card.formula}. ${newest.card.mnemonic}` : newest.content);
  }, [thread.messages]);

  // --- Archie's own replies, with no model ---------------------------------

  const localTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(localTimer.current), []);

  // --- One person's conversation ------------------------------------------
  //
  // A shared Chromebook: one student types something private, signs out from
  // the account menu (no reload), and the next student opens Archie. Nothing
  // of the first conversation may be there. Any change of account, sign-out
  // included, drops every thread, and a reply still on its way is thrown
  // away when it lands (sessionGen).
  const sessionGen = useRef(0);
  const seenUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (authLoading) return;
    const id = user?.id ?? null;
    if (seenUser.current === undefined) {
      seenUser.current = id;
      return;
    }
    if (seenUser.current === id) return;
    seenUser.current = id;
    sessionGen.current += 1;
    window.clearTimeout(localTimer.current);
    window.clearTimeout(reactionTimer.current);
    setReaction(null);
    setThreads({});
    threadsRef.current = {};
    setPending(null);
    setInput("");
    setSpoken(false);
    recentSaid.current = [];
    greeted.current = false;
    setMode("tutor");
  }, [authLoading, user?.id]);

  /**
   * A line Archie writes himself: a beat of typing dots and his thinking
   * pose first, so it lands like a reply, then it is written out.
   */
  function replyLocally(key: string, message: Omit<ChatMessage, "id" | "role">, extra?: (t: Thread) => Partial<Thread>) {
    setPending(key);
    window.clearTimeout(localTimer.current);
    localTimer.current = window.setTimeout(() => {
      const reply = makeMessage({
        role: "assistant",
        sentAt: Date.now(),
        animate: key === keyRef.current && !prefersReducedMotion(),
        ...message,
      });
      update(key, (t) => ({ ...t, ...(extra?.(t) ?? {}), messages: [...t.messages, reply] }));
      setPending(null);
    }, thinkMs(message.content));
  }

  /**
   * Numbers he must not say right now: the values in the student's own
   * solution, the same list the server's filter uses. A fun fact or a quiz
   * question holding one of them is skipped.
   */
  function forbiddenNow(): string[] {
    const ctx = getHelperContext();
    if (!ctx?.problemPrompt) return [];
    const out = forbiddenValues(ctx);
    const answer = ctx.answer?.trim();
    if (answer && /^-?\d+(?:\.\d+)?$/.test(answer) && !out.includes(answer)) out.push(answer);
    return out;
  }

  function funFact(): string {
    const forbidden = forbiddenNow();
    const clean = (l: string) => !leaksAnswer(l, forbidden);
    if (!MATH_FUN_FACTS.some(clean)) return "I'll save my fun facts for after this problem. Want a hint instead?";
    const fact = say(pickFresh(MATH_FUN_FACTS, recentSaid.current, Math.random, clean));
    return `${fact} ${say(pickFresh(FACT_OUTROS, recentSaid.current))}`;
  }

  const recentQuiz = useRef(-1);
  /** An easy quiz question, never one whose numbers are in the student's solution, and not the last one again. */
  function quizItem(): number | null {
    const forbidden = forbiddenNow();
    const last = recentQuiz.current;
    const ok = EASY_QUIZ.map((q, i) => ({ q, i })).filter(
      ({ q, i }) => i !== last && !leaksAnswer(`${q.q} ${q.answer} ${q.why}`, forbidden)
    );
    if (!ok.length) return null;
    const pick = ok[Math.floor(Math.random() * ok.length)].i;
    recentQuiz.current = pick;
    return pick;
  }

  /** A math joke, never one holding a number from the student's solution. */
  function mathJoke(): string {
    const forbidden = forbiddenNow();
    const clean = (l: string) => !leaksAnswer(l, forbidden);
    if (!MATH_JOKES.some(clean)) return "I'll save my jokes for after this problem. Want a hint instead?";
    return say(pickFresh(MATH_JOKES, recentSaid.current, Math.random, clean));
  }

  /** The small-talk chips: the student's words go in, and Archie answers himself. */
  function chat(kind: ChatKind, asWords?: string, typed?: ChatMessage) {
    if (busy) return;
    const key = threadKey;
    setSpoken(true);
    pinnedToBottom.current = true;
    const userMsg = typed ?? makeMessage({ role: "user", content: asWords ?? CHAT_ASK[kind], sentAt: Date.now() });
    update(key, (t) => ({ ...t, quiz: null, messages: [...t.messages, userMsg] }));
    const name = firstName;
    if (kind === "day") {
      replyLocally(key, { kind: "buddy", asksMood: true, content: fillName(say(pickFresh(DAY_REPLIES, recentSaid.current)), name) });
    } else if (kind === "fact") {
      replyLocally(key, { kind: "buddy", content: funFact(), followUps: ["fact"] });
    } else if (kind === "motivate") {
      replyLocally(key, { kind: "buddy", content: fillName(say(pickFresh(MOTIVATE_LINES, recentSaid.current)), name) });
    } else if (kind === "joke") {
      replyLocally(key, { kind: "buddy", content: mathJoke(), followUps: ["joke"] });
    } else {
      const item = quizItem();
      if (item === null) {
        replyLocally(key, { kind: "buddy", content: "Let's finish this problem first, then I'll quiz you. Want a hint?" });
        return;
      }
      const intro = say(pickFresh(QUIZ_INTROS, recentSaid.current));
      replyLocally(key, { kind: "buddy", content: `${intro} ${EASY_QUIZ[item].q}` }, () => ({ quiz: { item, tries: 0 } }));
    }
  }

  /**
   * The student reacts to one of Archie's messages. One reaction per message;
   * the same again takes it off. He answers some reactions, once per message.
   */
  const answeredReactions = useRef(new Set<string>());
  function react(messageId: number, picked: ReactionId) {
    const key = threadKey;
    const t = threadsRef.current[key] ?? EMPTY_THREAD;
    const m = t.messages.find((x) => x.id === messageId);
    if (!m || m.role !== "assistant") return;
    const next = toggleReaction(m.reaction, picked);
    update(key, (th) => ({
      ...th,
      messages: th.messages.map((x) => (x.id === messageId ? { ...x, reaction: next, reactedAt: Date.now() } : x)),
    }));
    const newest = [...t.messages].reverse().find((x) => x.role === "assistant");
    const tag = `${messageId}:${picked}`;
    const res = responseToReaction(picked, {
      added: next === picked,
      latest: newest?.id === messageId,
      answeredBefore: answeredReactions.current.has(tag),
      explanation: m.kind === "reply",
      busy,
    });
    if (next === picked) answeredReactions.current.add(tag);
    if (res.pose) {
      const quip =
        res.quip === "heart"
          ? say(pickFresh(HEART_QUIPS, recentSaid.current))
          : res.quip === "star"
            ? say(pickFresh(STAR_QUIPS, recentSaid.current))
            : null;
      showReaction(res.pose, quip, res.pose === "party" ? 3000 : 2600, res.mark);
    }
    if (res.say) {
      const anotherWay = res.anotherWay && mode === "tutor" && !!problem;
      // A confused line points at the "Explain it another way" chip, so it is
      // only said when that chip will be under it.
      const pool = res.say === "aha" ? AHA_LINES : res.say === "confused" && anotherWay ? CONFUSED_LINES : CONFUSED_PLAIN_LINES;
      replyLocally(key, {
        kind: "buddy",
        content: fillName(say(pickFresh(pool, recentSaid.current)), firstName),
        followUps: anotherWay ? ["another-way"] : undefined,
      });
    }
  }

  async function finishBooking(key: string, state: SchedulerState) {
    if (!user) {
      push(key, { role: "assistant", kind: "booking", content: "Sign in first and I can send this to a tutor for you." });
      return;
    }
    const gen = sessionGen.current;
    const err = await createSessionRequest(user.id, state.freeText ?? "", state.tutorName ?? null, null);
    if (gen !== sessionGen.current) return;
    push(key, {
      role: "assistant",
      kind: "booking",
      content: err ? `That did not send: ${err}` : schedulerPrompt("done"),
    });
  }

  /** Sends the conversation so far, then adds the reply, or an error with a retry, to that thread. */
  async function ask(key: string, modeAt: HelperMode, history: ChatMessage[], action?: HelperAction) {
    setPending(key);
    const gen = sessionGen.current;
    try {
      const res = await fetch("/api/helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The problem on screen, when there is one. Without it the helper
        // cannot see what the student means and the answer filter has
        // nothing to guard.
        body: JSON.stringify({
          mode: modeAt,
          action,
          context: getHelperContext() ?? {},
          messages: toWire(history),
          ...studentForPrompt(firstName),
        }),
      });
      if (!res.ok) throw new Error(`helper ${res.status}`);
      // Someone else signed in while this was on its way: it is not theirs.
      if (gen !== sessionGen.current) return;
      const data = (await res.json()) as {
        message?: string;
        source?: string;
        offerTutor?: boolean;
        crisis?: boolean;
        card?: ChatMessage["card"];
      };
      if (typeof data.message !== "string" || !data.message.trim()) throw new Error("empty reply");
      if (data.crisis || modelSignalsCrisis(data.message)) {
        // The server caught what the panel did not (an older copy of the
        // rules, say), or the model answered with the crisis signal for a
        // message the patterns missed. Same card, and that turn is kept off
        // the wire from now on.
        const card = makeMessage({ role: "assistant", kind: "crisis", content: CRISIS_REPLY, sentAt: Date.now() });
        const asked = history[history.length - 1]?.id;
        update(key, (t) => ({
          ...t,
          scheduler: null,
          messages: [...t.messages.map((m) => (m.id === asked ? { ...m, kind: "crisis" as const, archieReaction: null } : m)), card],
        }));
        return;
      }
      // School mode has no booking: an ask for a person is pointed to the teacher.
      const offer = !school && (data.offerTutor || modeAt === "scheduler");
      const kind: MessageKind = data.card ? "formula" : data.source === "gate" ? "gate" : "reply";
      const reply = makeMessage({
        role: "assistant",
        content: school && data.offerTutor ? SCHOOL_ESCALATION_REPLY : data.message,
        kind,
        card: data.card,
        sentAt: Date.now(),
        // Only a reply the student is looking at is worth animating.
        animate: key === keyRef.current && !prefersReducedMotion(),
      });
      update(key, (t) => ({
        ...t,
        messages: [...t.messages, reply],
        scheduler: offer ? { step: "offered" } : t.scheduler,
      }));
    } catch {
      if (gen === sessionGen.current) push(key, { role: "assistant", kind: "error", content: ERROR_TEXT, retryAction: action });
    } finally {
      if (gen === sessionGen.current) setPending(null);
    }
  }

  async function send(textArg?: string, action?: HelperAction) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    if (textArg === undefined) setInput("");
    setSpoken(true);
    setSends((n) => n + 1);
    const key = threadKey;
    const modeAt = mode;
    const current = threadsRef.current[key] ?? EMPTY_THREAD;
    // Archie reacts to a few kinds of message on his own: a heart on thanks,
    // a star on "I got it right", a lightbulb on "oh, I get it".
    const userMsg = makeMessage({
      role: "user",
      content: text,
      sentAt: Date.now(),
      archieReaction: modeAt === "scheduler" ? null : autoReactionFor(text),
    });
    pinnedToBottom.current = true;

    // A student who may be in danger is answered first, before their words
    // go anywhere: not into a booking, not to a tutor, not to the server.
    // The card carries the same fixed help the server would send. Read on
    // its own and joined to their message before, so a disclosure split in
    // two is caught; then both halves stay off the wire.
    const before = [...current.messages].reverse().find((m) => m.role === "user" && m.kind !== "crisis");
    const crisisAlone = detectCrisis(text);
    const crisisJoined = !crisisAlone && !!before && !!detectCrisisInTurns(before.content, text);
    if (crisisAlone || crisisJoined) {
      window.clearTimeout(reactionTimer.current);
      window.clearTimeout(localTimer.current);
      setReaction(null);
      update(key, (t) => ({
        ...t,
        quiz: null,
        scheduler: null,
        messages: [
          ...t.messages.map((m) => (crisisJoined && m.id === before!.id ? { ...m, kind: "crisis" as const, archieReaction: null } : m)),
          { ...userMsg, kind: "crisis", archieReaction: null },
          makeMessage({ role: "assistant", kind: "crisis", content: CRISIS_REPLY, sentAt: Date.now() }),
        ],
      }));
      return;
    }

    // Once a booking is under way the panel owns the conversation. A model
    // has no business improvising here.
    const sched = current.scheduler;
    if (sched && sched.step !== "done" && sched.step !== "declined") {
      // What goes into a booking is read by every tutor, so it gets the
      // personal information guard: no phone number, username or plan to
      // talk somewhere else. The same question is asked again.
      if (sched.step === "awaiting_time" || sched.step === "awaiting_tutor") {
        const refused = guardFreeText(text, "booking");
        if (refused) {
          update(key, (t) => ({
            ...t,
            messages: [...t.messages, { ...userMsg, kind: "held", archieReaction: null }, makeMessage({ role: "assistant", kind: "booking", content: refused, sentAt: Date.now() })],
          }));
          return;
        }
      }
      const next = advanceScheduler(sched, text);
      let replyText: string | null;
      if (next.step === "done") replyText = null;
      else if (next.step === "declined") replyText = schedulerPrompt("declined");
      else if (next.step === sched.step) replyText = "A yes or a no is all I need.";
      else replyText = schedulerPrompt(next.step);
      update(key, (t) => ({
        ...t,
        scheduler: next,
        messages: replyText
          ? [...t.messages, userMsg, makeMessage({ role: "assistant", kind: "booking", content: replyText, sentAt: Date.now() })]
          : [...t.messages, userMsg],
      }));
      if (next.step === "done") await finishBooking(key, next);
      return;
    }

    const name = firstName;
    const lastSaid = [...current.messages].reverse().find((m) => m.role === "assistant");

    // An answer to his own quiz question is checked here. Anything that is
    // not a bare number or a plain "idk" ends the quiz and goes on as usual.
    // An answer to the problem on screen goes to the card, which grades it
    // with its own key and marks it, exactly as if it were typed there. He
    // says good job, or why it missed in a sentence or two with the slip
    // drawn on the worked steps.
    const ctxNow = getHelperContext();
    const asAnswer = !action && !current.quiz && modeAt !== "scheduler" && ctxNow?.problemPrompt ? answerInMessage(text) : null;
    if (asAnswer) {
      checkingOnCard.current = true;
      const outcome = await submitAnswerToCard(asAnswer);
      checkingOnCard.current = false;
      if (outcome.result !== "none") {
        const right = outcome.result === "correct";
        update(key, (t) => ({ ...t, messages: [...t.messages, { ...userMsg, archieReaction: right ? "star" : null }] }));
        const twoSentences = (s: string) => (s.match(/[^.!?]+[.!?]+/g) ?? [s]).slice(0, 2).join(" ").trim();
        const content =
          outcome.result === "correct"
            ? `That's right${name ? `, ${name}` : ""}! Good job. I marked it on your card.`
            : outcome.result === "done"
              ? "You already got this one. Press Next on the card for a fresh problem."
              : outcome.result === "unreadable"
                ? outcome.note ?? "Type just your answer, like -63 or 2/3."
                : outcome.note
                  ? `That one misses. ${twoSentences(outcome.note)}`
                  : "That one misses. The steps below show where to look first.";
        replyLocally(key, {
          kind: "buddy",
          content,
          slip: outcome.result === "wrong" && outcome.explanation ? { explanation: outcome.explanation, step: outcome.step } : undefined,
          followUps: outcome.result === "wrong" ? ["hint"] : undefined,
        });
        if (outcome.result === "correct" || outcome.result === "wrong") showReaction(right ? "party" : "encourage", null, 3000);
        return;
      }
    }

    const quiz = current.quiz;
    if (quiz && !action) {
      const item = EASY_QUIZ[quiz.item];
      const verdict = item ? checkQuizReply(item, text) : null;
      if (verdict) {
        const right = verdict === "right";
        update(key, (t) => ({ ...t, messages: [...t.messages, { ...userMsg, archieReaction: right ? "star" : null }] }));
        if (right) {
          replyLocally(key, { kind: "buddy", content: quizLine(say(pickFresh(QUIZ_RIGHT, recentSaid.current)), item, name), followUps: ["quiz"] }, () => ({ quiz: null }));
          showReaction("party", null, 3000);
        } else if (verdict === "wrong" && quiz.tries === 0) {
          replyLocally(key, { kind: "buddy", content: say(pickFresh(QUIZ_TRY_AGAIN, recentSaid.current)) }, () => ({
            quiz: { ...quiz, tries: 1 },
          }));
        } else {
          replyLocally(key, { kind: "buddy", content: quizLine(say(pickFresh(QUIZ_REVEAL, recentSaid.current)), item, name), followUps: ["quiz"] }, () => ({ quiz: null }));
        }
        return;
      }
    }

    // The small-talk chips, typed out, get the same answers. "another one"
    // means more of what he just gave them: a fact, a quiz question, a joke.
    const again: AgainKind | null = quiz
      ? "quiz"
      : (["fact", "quiz", "joke"] as const).find((k) => lastSaid?.followUps?.includes(k)) ?? null;
    const asked = action || modeAt === "scheduler" ? null : chatRequestKind(text, again);
    if (asked) return chat(asked, text, userMsg);

    // A few short messages he answers himself, matched on the whole message.
    // Everything else, feelings included, goes to the server.
    const talk = action ? null : smallTalkKind(text);
    const pool =
      talk === "thanks"
        ? THANKS_REPLIES
        : talk === "aha"
          ? AHA_LINES
          : talk === "got-it"
            ? GOT_IT_LINES
            : talk === "hello"
              ? HELLO_REPLIES
              : talk === "bye"
                ? BYE_LINES
                : talk === "affection"
                  ? AFFECTION_LINES
                  : talk === "good-mood" && lastSaid?.asksMood
                    ? GOOD_MOOD_REPLIES
                    : null;
    if (pool && modeAt !== "scheduler") {
      update(key, (t) => ({ ...t, quiz: null, messages: [...t.messages, userMsg] }));
      replyLocally(key, { kind: "buddy", asksMood: talk === "hello", content: fillName(say(pickFresh(pool, recentSaid.current)), name) });
      if (talk === "got-it") showReaction("party", null, 3000);
      return;
    }

    update(key, (t) => ({ ...t, quiz: null, messages: [...t.messages, userMsg] }));
    await ask(key, modeAt, [...current.messages, userMsg], action);
  }

  function retry(errorId: number) {
    if (busy) return;
    const key = threadKey;
    const current = threadsRef.current[key] ?? EMPTY_THREAD;
    const at = current.messages.findIndex((m) => m.id === errorId);
    if (at < 0) return;
    const failed = current.messages[at];
    update(key, (t) => ({ ...t, messages: t.messages.filter((m) => m.id !== errorId) }));
    void ask(key, mode, current.messages.slice(0, at), failed.retryAction);
  }

  function switchMode(next: HelperMode) {
    if (next === mode || (school && next === "scheduler")) return;
    setMode(next);
    // A booking is a fresh transaction each time it is picked.
    if (next === "scheduler") {
      update("scheduler", () => ({
        messages: [makeMessage({ role: "assistant", kind: "booking", content: BOOKING_INTRO, sentAt: Date.now() })],
        scheduler: { step: "offered" },
      }));
    }
  }

  // Shown in full once, wherever it lives, so going back to a problem does
  // not replay its replies.
  const onRevealed = useCallback((id: number) => {
    setThreads((all) => {
      const key = Object.keys(all).find((k) => all[k].messages.some((m) => m.id === id && m.animate));
      if (!key) return all;
      const t = all[key];
      return { ...all, [key]: { ...t, messages: t.messages.map((m) => (m.id === id ? { ...m, animate: false } : m)) } };
    });
  }, []);

  const setPad = useCallback((lines: PadLine[]) => update(keyRef.current, (t) => ({ ...t, pad: lines })), [update]);
  const setPadOpen = (padOpen: boolean) => update(threadKey, (t) => ({ ...t, padOpen }));

  // --- What the panel shows -------------------------------------------------

  const messages = thread.messages;
  const step = thread.scheduler?.step;
  const bookingStep = step === "offered" ? 1 : step === "awaiting_time" ? 2 : step === "awaiting_tutor" ? 3 : 0;
  const padOpen = mode === "tutor" && !!problem && !!thread.padOpen;
  const thinking = pending === threadKey;
  const last = messages[messages.length - 1];
  /** His newest message: the only one whose reaction bar is a Tab stop. */
  const newestArchieId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  // Small talk, answered by Archie himself.
  const chatChips: ChipSpec[] = [
    { id: "day", label: CHAT_ASK.day, icon: "messages", onPick: () => chat("day") },
    { id: "fact", label: CHAT_ASK.fact, icon: "star", onPick: () => chat("fact") },
    { id: "motivate", label: CHAT_ASK.motivate, icon: "flame", onPick: () => chat("motivate") },
    { id: "quiz", label: CHAT_ASK.quiz, icon: "trophy", onPick: () => chat("quiz") },
    { id: "joke", label: CHAT_ASK.joke, icon: "spark", onPick: () => chat("joke") },
  ];
  const tutorChips: ChipSpec[] = problem
    ? [
        { id: "hint", label: "Give me a hint", icon: "hint", onPick: () => void send("Give me a hint", "hint") },
        {
          id: "first",
          label: "What's the first step?",
          icon: "play",
          onPick: () => void send("What's the first step?", "first-step"),
        },
        { id: "idea", label: "Explain the key idea", icon: "teach", onPick: () => void send("Explain the key idea", "key-idea") },
        {
          id: "example",
          label: "Show a similar example",
          icon: "copy",
          onPick: () => void send("Show a similar example", "example"),
        },
        { id: "check", label: "Check my work", icon: "pen", onPick: () => setPadOpen(true) },
      ]
    : [
        ...chatChips,
        { id: "start", label: "How do I start a problem?", icon: "play", onPick: () => void send("How do I start a problem?") },
        { id: "topic", label: "Explain a topic", icon: "teach", onPick: () => void send("Can you explain a topic?") },
        ...(school ? [] : [{ id: "book", label: "Book a tutor", icon: "tutors" as const, onPick: () => switchMode("scheduler") }]),
      ];
  const formulaChips: ChipSpec[] = FORMULA_CHIPS.map((f) => ({ id: f.name, label: f.label, onPick: () => void send(f.name) }));
  const bookingChips: ChipSpec[] =
    step === "awaiting_time"
      ? ["Weekday evenings", "After school", "This weekend"].map((t) => ({ id: t, label: t, onPick: () => void send(t) }))
      : step === "awaiting_tutor"
        ? [{ id: "anyone", label: "Anyone is fine", onPick: () => void send("anyone") }]
        : [];

  const chips = mode === "reminder" ? formulaChips : mode === "tutor" ? tutorChips : [];
  const chipsLabel = mode === "reminder" ? "Formulas" : "Quick actions";
  // Once the conversation is going, the row over the box also offers a fun fact.
  const rowChips =
    mode === "tutor" && problem
      ? [
          ...tutorChips,
          { id: "fact", label: "Fun fact", icon: "star" as const, onPick: () => chat("fact") },
          { id: "quiz", label: "Quiz me", icon: "trophy" as const, onPick: () => chat("quiz") },
          { id: "joke", label: "Math joke", icon: "spark" as const, onPick: () => chat("joke") },
        ]
      : chips;
  // The chips under his hello, until the student says something here.
  const greetingChips = !hasUser && bookingStep === 0 && mode !== "scheduler";

  // Follow-ups hang off his newest message once it is fully shown: two under
  // a tutor reply, or whatever his own line offers.
  const followUps: FollowUpId[] =
    !busy && bookingStep === 0 && last?.role === "assistant" && !last.animate
      ? mode === "tutor" && last.kind === "reply"
        ? ["another-way", "next-step"]
        : (last.followUps ?? [])
      : [];
  const pickFollowUp = (id: FollowUpId) => {
    if (id === "another-way") void send("Explain it another way", "another-way");
    else if (id === "next-step") void send("Next step", "next-step");
    else if (id === "hint") void send("Give me a hint", "hint");
    else if (id === "fact") chat("fact", "Another fun fact");
    else if (id === "joke") chat("joke", "Another joke");
    else chat("quiz", "Another question");
  };

  const placeholder =
    step === "awaiting_time"
      ? "When are you free?"
      : step === "awaiting_tutor"
        ? "A tutor's name, or anyone"
        : mode === "reminder"
          ? "Which formula?"
          : "Ask Archie anything, or just say hi...";

  const panelBody = (
    <>
      {/* Archie, his name, and what he is. On a phone this is also where the sheet is dragged. */}
      <div
        onPointerDown={onGrabStart}
        onPointerMove={onGrabMove}
        onPointerUp={onGrabEnd}
        onPointerCancel={onGrabEnd}
        className={`relative shrink-0 ${sheet ? "helper-grab" : ""}`}
      >
        {sheet && (
          <div className="flex justify-center pb-0.5 pt-2" aria-hidden="true">
            <span className="h-[5px] w-10 rounded-full bg-slate-300" />
          </div>
        )}
        <div className={`flex items-center gap-3 px-3 ${sheet ? "pb-2.5 pt-1" : "pb-2.5 pt-3"}`}>
          <div className="-mb-1 -ml-1 -mt-1 shrink-0" aria-hidden="true">
            <Archie
              pose={archiePose}
              size={64}
              look={typing ? { x: 0.3, y: 1 } : null}
              blink
              bob={archiePose === "idle" || archiePose === "thinking"}
              burst={reaction?.burst ?? 0}
              mark={archieMark}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="pr-8 font-display text-[22px] leading-none tracking-wide text-slate-900">Archie</h2>
            {/* One fixed-height row: the subtitle, or for a moment his line, so nothing below moves. */}
            <div className="mt-1 flex h-6 items-center">
              {archieLine ? (
                <p
                  key={reaction?.burst}
                  aria-hidden="true"
                  className="helper-say whitespace-nowrap rounded-xl rounded-tl-sm bg-bridge-50 px-2.5 py-[3px] text-[12.5px] font-semibold leading-[18px] text-bridge-800 ring-1 ring-bridge-100"
                >
                  {archieLine}
                </p>
              ) : (
                <p className="text-[13px] leading-[18px] text-slate-600">your AI study buddy</p>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">Archie is an AI, not a person.</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close Archie"
            title="Close"
            className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 active:scale-95"
            style={sheet ? { top: 18 } : undefined}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      </div>

      {/* The mode, as a segmented control. */}
      <div className="shrink-0 px-3 pb-2.5">
        <div role="group" aria-label="Helper mode" className={`grid ${school ? "grid-cols-2" : "grid-cols-3"} gap-1 rounded-xl bg-slate-100 p-1`}>
          {MODES.filter((m) => !school || m.id !== "scheduler").map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => switchMode(m.id)}
              className={`rounded-lg px-2 py-1.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 active:scale-[0.97] ${
                mode === m.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "tutor" && problem && <ContextCard key={problem} skillTitle={context?.skillTitle} problem={problem} />}

      {padOpen ? (
        <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100">
          <WorkPad
            problem={problem}
            lines={thread.pad}
            onChange={setPad}
            onBack={() => {
              setPadOpen(false);
              // Back where the conversation continues, not lost on the page.
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          />
        </div>
      ) : (
        <>
          {/* The conversation. Its own live region is off: the announcer
              below reads each new message once, in full, instead of the
              words and reaction buttons as they land. */}
          <div
            ref={logRef}
            role="log"
            aria-live="off"
            aria-label="Conversation with Archie"
            onScroll={(e) => {
              const el = e.currentTarget;
              pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            }}
            className="relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain border-t border-slate-100 bg-white px-3 pb-4 pt-3.5 text-sm leading-relaxed"
          >
            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} message={m} />
              ) : m.kind === "crisis" ? (
                <CrisisCard key={m.id} reply={m.content} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  message={m}
                  latest={m.id === newestArchieId}
                  onRevealed={onRevealed}
                  onTick={followReveal}
                  onReact={react}
                  onRetry={m.kind === "error" && m.id === last?.id && !busy ? () => retry(m.id) : undefined}
                >
                  {/* Under his hello: the ways in, until the student says something. */}
                  {m.kind === "greeting" && greetingChips && (chips.length > 0 || mode === "tutor") && (
                    <div className="helper-in mt-2.5 space-y-2.5">
                      {chips.length > 0 && <ChipGrid chips={chips} disabled={busy} label={chipsLabel} />}
                      {mode === "tutor" && problem && (
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Or just chat</p>
                          <div role="group" aria-label="Chat with Archie" className="flex flex-wrap gap-1.5">
                            {chatChips.map((c) => (
                              <Chip key={c.id} chip={c} disabled={busy} compact />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {m.slip && <SlipSteps explanation={m.slip.explanation} at={m.slip.step} compact />}
                  {m.id === last?.id && followUps.length > 0 && (
                    <div role="group" aria-label="Follow-ups" className="helper-in mt-2 flex flex-wrap gap-1.5">
                      {followUps.map((id) => (
                        <Chip
                          key={id}
                          compact
                          chip={{ id, label: FOLLOW_UP_LABELS[id].label, icon: FOLLOW_UP_LABELS[id].icon, onPick: () => pickFollowUp(id) }}
                        />
                      ))}
                    </div>
                  )}
                </AssistantBubble>
              )
            )}

            {thinking && <TypingDots />}
          </div>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          {/* Under the conversation: the booking buttons, or chips and the box. */}
          {step === "offered" ? (
            <div className="shrink-0 border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Booking, step 1 of 3</p>
              <div className="flex gap-2">
                <button type="button" data-autofocus className="btn-primary flex-1 text-sm" onClick={() => void send("yes")}>
                  Yes, find a time
                </button>
                <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => void send("no")}>
                  Not now
                </button>
              </div>
            </div>
          ) : (
            <div className="shrink-0 border-t border-slate-100 bg-white pt-2">
              {bookingStep > 0 && (
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Booking, step {bookingStep} of 3
                </p>
              )}
              {bookingChips.length > 0 ? (
                <ChipRow chips={bookingChips} disabled={busy} label="Quick answers" />
              ) : (
                hasUser && !calm && rowChips.length > 0 && <ChipRow chips={rowChips} disabled={busy} label={chipsLabel} />
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder={placeholder}
                  aria-label="Message Archie"
                  maxLength={500}
                  autoComplete="off"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-100"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  title="Send"
                  data-sent={sends > 0 ? "" : undefined}
                  className="helper-send flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bridge-600 text-white shadow-sm hover:bg-bridge-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                >
                  <span key={sends} className="helper-send-arrow">
                    <SendArrow />
                  </span>
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      {/* The launcher is Archie's face. It steps aside while the panel is out,
          where the panel's own close button takes over. */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (shown ? close() : openSidebar(true))}
        aria-label={shown ? "Close Archie" : `Open ${NAME}`}
        aria-expanded={shown}
        aria-hidden={shown || undefined}
        tabIndex={shown ? -1 : 0}
        title={shown ? undefined : "Ask Archie"}
        data-away={shown ? "" : undefined}
        data-tour="archie"
        className="helper-launch fixed bottom-5 right-24 z-40 h-14 w-14 rounded-full"
      >
        <ArchieFace size={56} blink={!shown} />
      </button>

      {sheet && (
        <div
          className="helper-scrim"
          data-leaving={leaving ? "" : undefined}
          aria-hidden="true"
          onClick={close}
          style={sheetDy ? { opacity: Math.max(0.15, 1 - sheetDy / 480) } : undefined}
        />
      )}

      {open && (
        <div
          ref={panelRef}
          role={sheet ? "dialog" : "complementary"}
          aria-modal={sheet || undefined}
          aria-label={NAME}
          tabIndex={sheet ? -1 : undefined}
          onKeyDown={onSheetKeyDown}
          // The page scrolls with Lenis, which otherwise takes the wheel away
          // from every scroller inside the panel and moves the page instead.
          data-lenis-prevent
          data-leaving={leaving ? "" : undefined}
          data-quiet={quiet ? "" : undefined}
          data-snap={snapping ? "" : undefined}
          className={`${docked ? "helper-dock" : "helper-sheet"} flex flex-col overflow-hidden bg-white focus:outline-none`}
          style={docked ? { width } : sheetDy ? { transform: `translateY(${sheetDy}px)` } : undefined}
        >
          {docked && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize Archie's panel"
              aria-valuemin={SIDEBAR_MIN}
              aria-valuemax={widest}
              aria-valuenow={width}
              tabIndex={0}
              title="Drag to resize"
              className="helper-resize"
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onPointerCancel={onResizeEnd}
              onDoubleClick={() => saveWidth(clampSidebarWidth(SIDEBAR_DEFAULT, window.innerWidth))}
              onKeyDown={onResizeKey}
            />
          )}
          {panelBody}
        </div>
      )}
    </>
  );
}

/** Exported for the tests that assert the yes/no branch is reachable. */
export const __helperYesNo = { isYes, isNo };
