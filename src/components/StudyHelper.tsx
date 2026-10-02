"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { createSessionRequest } from "@/lib/sessions";
import { isRealName, splitName } from "@/lib/name";
import {
  getHelperContext,
  getHelperOpenRequests,
  getServerHelperOpenRequests,
  subscribeHelperBridge,
} from "@/lib/helper-bridge";
import {
  advanceScheduler,
  BOOKING_INTRO,
  FORMULA_CARDS,
  isNo,
  isYes,
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
import { Archie, ArchieFace, reducedMotion, type ArchiePose } from "@/components/archie/Archie";
import { greeting, reactionLine } from "@/components/archie/lines";
import { Chip, ChipGrid, ChipRow, type ChipSpec } from "@/components/helper/Chips";
import { ContextCard } from "@/components/helper/ContextCard";
import { HelperAvatar } from "@/components/helper/HelperAvatar";
import { AssistantBubble, UserBubble, prefersReducedMotion } from "@/components/helper/MessageBubble";
import { TypingDots } from "@/components/helper/TypingDots";
import { EMPTY_THREAD, type ChatMessage, type MessageKind, type PadLine, type Thread } from "@/components/helper/types";

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
 * Deterministic on purpose: a booking is a transaction, not a chat.
 *
 * Archie himself reacts to practice (PRACTICE_EVENT): a hop and confetti for a
 * right answer, a fist pump for a miss, with one short line. Only while the
 * sidebar is open, and never while a reply is loading or being revealed.
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

let nextMessageId = 1;
const makeMessage = (m: Omit<ChatMessage, "id">): ChatMessage => ({ id: nextMessageId++, ...m });

/** What goes over the wire: roles and words, never the panel's own errors. */
function toWire(messages: ChatMessage[]): HelperMessage[] {
  return messages.filter((m) => m.kind !== "error").map((m) => ({ role: m.role, content: m.content }));
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
}

export function StudyHelper() {
  const { user, profile } = useAuth();
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

  const firstName = profile && isRealName(profile.displayName) ? splitName(profile.displayName).first : null;

  const update = useCallback((key: string, fn: (t: Thread) => Thread) => {
    setThreads((all) => ({ ...all, [key]: fn(all[key] ?? EMPTY_THREAD) }));
  }, []);

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
  const showReaction = useCallback((pose: ArchiePose, line: string | null, ms: number) => {
    window.clearTimeout(reactionTimer.current);
    setReaction((r) => ({ pose, line, burst: (r?.burst ?? 0) + 1 }));
    reactionTimer.current = window.setTimeout(() => setReaction(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(reactionTimer.current), []);

  // A wave hello each time he opens.
  useEffect(() => {
    if (shown) showReaction("wave", null, 2300);
  }, [shown, showReaction]);

  // What the practice listener needs to know, without re-subscribing each render.
  const live = useRef({ shown, busy, revealing, typing });
  live.current = { shown, busy, revealing, typing };
  const streak = useRef(0);
  const recentLines = useRef<string[]>([]);

  useEffect(() => {
    const onPractice = (e: Event) => {
      const result = (e as CustomEvent<{ result?: PracticeResult }>).detail?.result;
      if (result !== "correct" && result !== "wrong") return;
      streak.current = result === "correct" ? streak.current + 1 : 0;
      const now = live.current;
      // Only while he is on screen, and never over a reply being written or
      // read: a hint mid-reveal is not the moment for confetti.
      if (!now.shown || now.busy || now.revealing) return;
      // Mid-sentence, he reacts without a word.
      const line = now.typing ? null : reactionLine(result, streak.current, recentLines.current);
      if (line) recentLines.current = [line, ...recentLines.current].slice(0, 3);
      showReaction(result === "correct" ? "party" : "encourage", line, result === "correct" ? 3200 : 3400);
    };
    window.addEventListener(PRACTICE_EVENT, onPractice);
    return () => window.removeEventListener(PRACTICE_EVENT, onPractice);
  }, [showReaction]);

  const archiePose: ArchiePose = busy ? "thinking" : (reaction?.pose ?? "idle");
  const archieLine = !busy && reaction?.line ? reaction.line : null;

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
    log.scrollTop = log.scrollHeight;
  }, []);

  useEffect(() => {
    pinnedToBottom.current = true;
    // An empty conversation starts at the top, where the greeting is.
    if (thread.messages.length === 0) logRef.current?.scrollTo({ top: 0 });
    else scrollToEnd(true);
  }, [thread.messages.length, pending, thread.scheduler?.step, threadKey, open, scrollToEnd]);

  function push(key: string, message: Omit<ChatMessage, "id">) {
    update(key, (t) => ({ ...t, messages: [...t.messages, makeMessage(message)] }));
  }

  async function finishBooking(key: string, state: SchedulerState) {
    if (!user) {
      push(key, { role: "assistant", kind: "booking", content: "Sign in first and I can send this to a tutor for you." });
      return;
    }
    const err = await createSessionRequest(user.id, state.freeText ?? "", state.tutorName ?? null, null);
    push(key, {
      role: "assistant",
      kind: "booking",
      content: err ? `That did not send: ${err}` : schedulerPrompt("done"),
    });
  }

  /** Sends the conversation so far, then adds the reply, or an error with a retry, to that thread. */
  async function ask(key: string, modeAt: HelperMode, history: ChatMessage[], action?: HelperAction) {
    setPending(key);
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
        }),
      });
      if (!res.ok) throw new Error(`helper ${res.status}`);
      const data = (await res.json()) as {
        message?: string;
        source?: string;
        offerTutor?: boolean;
        card?: ChatMessage["card"];
      };
      if (typeof data.message !== "string" || !data.message.trim()) throw new Error("empty reply");
      const kind: MessageKind = data.card ? "formula" : data.source === "gate" ? "gate" : "reply";
      const reply = makeMessage({
        role: "assistant",
        content: data.message,
        kind,
        card: data.card,
        // Only a reply the student is looking at is worth animating.
        animate: key === keyRef.current && !prefersReducedMotion(),
      });
      update(key, (t) => ({
        ...t,
        messages: [...t.messages, reply],
        scheduler: data.offerTutor || modeAt === "scheduler" ? { step: "offered" } : t.scheduler,
      }));
    } catch {
      push(key, { role: "assistant", kind: "error", content: ERROR_TEXT, retryAction: action });
    } finally {
      setPending(null);
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
    const userMsg = makeMessage({ role: "user", content: text, sentAt: Date.now() });
    pinnedToBottom.current = true;

    // Once a booking is under way the panel owns the conversation. A model
    // has no business improvising here.
    const sched = current.scheduler;
    if (sched && sched.step !== "done" && sched.step !== "declined") {
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
          ? [...t.messages, userMsg, makeMessage({ role: "assistant", kind: "booking", content: replyText })]
          : [...t.messages, userMsg],
      }));
      if (next.step === "done") await finishBooking(key, next);
      return;
    }

    update(key, (t) => ({ ...t, messages: [...t.messages, userMsg] }));
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
    if (next === mode) return;
    setMode(next);
    // A booking is a fresh transaction each time it is picked.
    if (next === "scheduler") {
      update("scheduler", () => ({
        messages: [makeMessage({ role: "assistant", kind: "booking", content: BOOKING_INTRO })],
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
        { id: "start", label: "How do I start a problem?", icon: "play", onPick: () => void send("How do I start a problem?") },
        { id: "topic", label: "Explain a topic", icon: "teach", onPick: () => void send("Can you explain a topic?") },
        { id: "book", label: "Book a tutor", icon: "tutors", onPick: () => switchMode("scheduler") },
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

  // Two follow-ups hang off the newest tutor reply, once it is fully shown.
  const followUpsFor =
    mode === "tutor" && !busy && bookingStep === 0 && last?.role === "assistant" && last.kind === "reply" ? last.id : null;

  // The first hello is by name; after the student has said something, a new
  // problem gets a shorter one.
  const hello = mode === "tutor" && !spoken ? greeting(firstName) : null;
  const emptyIntro =
    mode === "reminder"
      ? "Pick a formula. You get the exact statement and a way to remember it."
      : problem
        ? spoken
          ? "New problem, fresh start. Pick one below, or tell me where you're stuck."
          : "I can see the problem you're on. Pick one below, or tell me where you're stuck. I won't give you the answer, but I'll help you find it."
        : "Ask me about any Algebra 1 step. Open a practice problem and I can see it too.";

  const placeholder =
    step === "awaiting_time"
      ? "When are you free?"
      : step === "awaiting_tutor"
        ? "A tutor's name, or anyone"
        : mode === "reminder"
          ? "Which formula?"
          : "Ask Archie about a step...";

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
        <div role="group" aria-label="Helper mode" className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {MODES.map((m) => (
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
          {/* The conversation. */}
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with Archie"
            onScroll={(e) => {
              const el = e.currentTarget;
              pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            }}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain border-t border-slate-100 bg-slate-50 px-3 py-3 text-sm leading-relaxed"
          >
            {messages.length === 0 && (
              <div className="space-y-2.5">
                <div className="helper-in flex items-start gap-2 pr-6">
                  <HelperAvatar size={26} className="mt-0.5" />
                  <p className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 shadow-sm">
                    {hello && <span className="font-semibold text-slate-900">{hello} </span>}
                    {emptyIntro}
                  </p>
                </div>
                {chips.length > 0 && (
                  <div className="pl-[34px]">
                    <ChipGrid chips={chips} disabled={busy} label={chipsLabel} />
                  </div>
                )}
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <UserBubble key={m.id} message={m} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  message={m}
                  onRevealed={onRevealed}
                  onTick={scrollToEnd}
                  onRetry={m.kind === "error" && m.id === last?.id && !busy ? () => retry(m.id) : undefined}
                >
                  {followUpsFor === m.id && (
                    <div role="group" aria-label="Follow-ups" className="mt-2 flex flex-wrap gap-1.5">
                      <Chip
                        compact
                        chip={{
                          id: "another",
                          label: "Explain it another way",
                          icon: "review",
                          onPick: () => void send("Explain it another way", "another-way"),
                        }}
                      />
                      <Chip
                        compact
                        chip={{ id: "next", label: "Next step", icon: "play", onPick: () => void send("Next step", "next-step") }}
                      />
                    </div>
                  )}
                </AssistantBubble>
              )
            )}

            {thinking && <TypingDots />}
          </div>

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
                messages.length > 0 && chips.length > 0 && <ChipRow chips={chips} disabled={busy} label={chipsLabel} />
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
