"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { createSessionRequest } from "@/lib/sessions";
import { getCalculatorRect, getServerCalculatorRect, subscribeCalculatorAccess } from "@/lib/calculator-access";
import { EDGE, keepOnScreen, readOffset, saveOffset, type Offset } from "@/lib/floating-panel";
import {
  getHelperContext,
  getHelperOpenRequests,
  getServerHelperOpenRequests,
  subscribeHelperBridge,
} from "@/lib/helper-bridge";
import {
  advanceScheduler,
  isNo,
  isYes,
  schedulerPrompt,
  type HelperMessage,
  type HelperMode,
  type SchedulerState,
} from "@/lib/helper";

/**
 * The floating study helper.
 *
 * Three modes, one rule: it will not hand over an answer. That is enforced on
 * the server in /api/helper, not here, so a student poking at the client
 * cannot talk their way around it.
 *
 * When the conversation reaches the point where a person is needed, the panel
 * takes over from the model and walks a fixed three-question booking script.
 * Deterministic on purpose: a booking is a transaction, not a chat.
 */

const POSITION_KEY = "algebridge-helper-position";

/** Where the panel rests, from the right edge, when nothing is in the way. */
const REST_RIGHT = 20;
/** The gap it keeps from an open calculator it moves beside. */
const GAP = 12;

const MODES: { id: HelperMode; label: string; blurb: string }[] = [
  { id: "tutor", label: "Tutor", blurb: "Work through a problem one step at a time." },
  { id: "reminder", label: "Reminder", blurb: "Get a formula back, with a way to keep it." },
  { id: "scheduler", label: "Scheduler", blurb: "Book time with a real tutor." },
];


export function StudyHelper() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<HelperMode>("tutor");
  const [messages, setMessages] = useState<HelperMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduler, setScheduler] = useState<SchedulerState | null>(null);
  const [note, setNote] = useState("");

  const [pos, setPos] = useState<Offset>({ x: 0, y: 0 });
  const appliedRef = useRef(pos);
  appliedRef.current = pos;
  const dragRef = useRef<{ px: number; py: number; from: Offset; last: Offset } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Both panels rest in the bottom-right corner. When the calculator is open
  // where the helper would sit, the helper rests beside it: to its left, or
  // to its right if it was dragged to the left edge. Measured from where the
  // calculator really is, since it can be dragged anywhere.
  const calculator = useSyncExternalStore(subscribeCalculatorAccess, getCalculatorRect, getServerCalculatorRect);
  const [restRight, setRestRight] = useState(REST_RIGHT);
  const restRightRef = useRef(restRight);
  restRightRef.current = restRight;
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = panelRef.current?.getBoundingClientRect();
      if (!calculator || !box) {
        setRestRight(REST_RIGHT);
        return;
      }
      const vw = window.innerWidth;
      // The panel as it would sit with each resting spot, same height.
      const clearAt = (right: number) => {
        const shift = restRightRef.current - right;
        const left = box.left + shift;
        const r = box.right + shift;
        const overlaps =
          left < calculator.right && calculator.left < r && box.top < calculator.bottom && calculator.top < box.bottom;
        return left >= EDGE && r <= vw - EDGE && !overlaps;
      };
      const spots = [
        REST_RIGHT,
        vw - calculator.left + GAP + appliedRef.current.x,
        vw - calculator.right - GAP - box.width + appliedRef.current.x,
      ];
      setRestRight(spots.find(clearAt) ?? REST_RIGHT);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, calculator]);

  // Practice asks the helper to open when a student has missed a few. It opens
  // on the problem they are on, in tutor mode, already asking the question.
  const openRequests = useSyncExternalStore(
    subscribeHelperBridge,
    getHelperOpenRequests,
    getServerHelperOpenRequests
  );
  const seenRequests = useRef(0);
  useEffect(() => {
    if (openRequests === 0 || openRequests === seenRequests.current) return;
    seenRequests.current = openRequests;
    setOpen(true);
    setMode("tutor");
    setScheduler(null);
    setNote("");
    setMessages([
      {
        role: "assistant",
        content:
          "I can see the problem you are on. What have you tried so far, or which step feels shaky? I will coach you through it one step at a time.",
      },
    ]);
  }, [openRequests]);

  useEffect(() => {
    const saved = readOffset(POSITION_KEY);
    if (saved) setPos(saved);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, scheduler]);

  // Anchored to a corner with an offset kept on screen, so a window resize or
  // a spot saved on a bigger window can never strand the panel.
  const settle = useCallback(() => {
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return;
    setPos((p) => {
      const next = keepOnScreen(box, appliedRef.current, p);
      return next.x === p.x && next.y === p.y ? p : next;
    });
  }, []);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      // The close button lives inside this drag handle. Without this guard a
      // press on it starts a drag and calls setPointerCapture, which retargets
      // the pointer events to the handle so the button's click never fires.
      // A perfectly still click closes the panel; a real one, with a pixel or
      // two of drift, just nudges it. That is the "it will not close" bug.
      if ((e.target as HTMLElement).closest("button")) return;
      dragRef.current = { px: e.clientX, py: e.clientY, from: pos, last: pos };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [pos]
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const want = { x: d.from.x + (e.clientX - d.px), y: d.from.y + (e.clientY - d.py) };
    d.last = keepOnScreen(panelRef.current?.getBoundingClientRect(), appliedRef.current, want);
    setPos(d.last);
  }, []);

  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    saveOffset(POSITION_KEY, d.last);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On opening, on moving beside the calculator, and on resizing: back on
  // screen if it is not.
  useLayoutEffect(() => {
    if (!open) return;
    settle();
    window.addEventListener("resize", settle);
    return () => window.removeEventListener("resize", settle);
  }, [open, restRight, settle]);

  function push(role: HelperMessage["role"], content: string) {
    setMessages((m) => [...m, { role, content }]);
  }

  async function finishBooking(state: SchedulerState) {
    if (!user) {
      push("assistant", "Sign in first and I can send this to a tutor for you.");
      return;
    }
    const err = await createSessionRequest(
      user.id,
      state.freeText ?? "",
      state.tutorName ?? null,
      null
    );
    push("assistant", err ? `That did not send: ${err}` : schedulerPrompt("done"));
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    setInput("");
    push("user", text);

    // Once a booking is under way the panel owns the conversation. A model
    // has no business improvising here.
    if (scheduler && scheduler.step !== "done" && scheduler.step !== "declined") {
      const next = advanceScheduler(scheduler, text);
      setScheduler(next);
      if (next.step === "done") {
        await finishBooking(next);
      } else if (next.step === "declined") {
        push("assistant", schedulerPrompt("declined"));
      } else if (next.step === scheduler.step) {
        push("assistant", "A yes or a no is all I need.");
      } else {
        push("assistant", schedulerPrompt(next.step));
      }
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The problem on screen, when there is one. Without it the helper
        // cannot see what the student means and the answer filter has
        // nothing to guard.
        body: JSON.stringify({
          mode,
          context: getHelperContext() ?? {},
          messages: [...messages, { role: "user", content: text }],
        }),
      });
      const data = (await res.json()) as { message: string; offerTutor?: boolean };
      push("assistant", data.message);
      if (data.offerTutor || mode === "scheduler") setScheduler({ step: "offered" });
    } catch {
      push("assistant", "I could not reach the helper. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: HelperMode) {
    setMode(next);
    setScheduler(next === "scheduler" ? { step: "offered" } : null);
    setMessages([]);
    setNote(MODES.find((m) => m.id === next)?.blurb ?? "");
    if (next === "scheduler") {
      setMessages([{ role: "assistant", content: schedulerPrompt("offered") }]);
    }
  }

  const awaitingYesNo = scheduler?.step === "offered";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close the study helper" : "Open the study helper"}
        aria-expanded={open}
        className="fixed bottom-5 right-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
      >
        {open ? <Icon name="close" size={22} /> : <Icon name="helper" size={24} />}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Study helper"
          className="animate-fade-in fixed bottom-24 z-50 flex max-h-[calc(100dvh-1rem)] w-[21rem] max-w-[calc(100vw-1rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ right: restRight, transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="flex touch-none cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Icon name="grip" size={14} className="text-slate-300" />
              Study helper
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the study helper"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <div className="flex gap-1 border-b border-slate-100 px-3 pb-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  mode === m.id
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div ref={logRef} className="max-h-72 min-h-[6rem] flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="px-1 text-sm text-slate-500">
                {note || MODES.find((m) => m.id === mode)?.blurb}
                <br />
                <span className="text-xs text-slate-400">
                  I&apos;m an AI study helper, not a person. I won&apos;t give you an answer, ask
                  for a step, a formula, or a real tutor.
                </span>
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-6 bg-bridge-600 text-white"
                    : "mr-6 bg-slate-100 text-slate-800"
                }`}
              >
                {m.content}
              </div>
            ))}
            {busy && <p className="px-1 text-xs text-slate-400">Thinking...</p>}
          </div>

          {awaitingYesNo ? (
            <div className="flex gap-2 border-t border-slate-100 p-3">
              <button type="button" className="btn-primary flex-1 text-sm" onClick={() => void send("yes")}>
                Yes, find a time
              </button>
              <button type="button" className="btn-secondary flex-1 text-sm" onClick={() => void send("no")}>
                Not now
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex gap-2 border-t border-slate-100 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={mode === "reminder" ? "Which formula?" : "Where are you stuck?"}
                aria-label="Message the study helper"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
              />
              <button type="submit" disabled={busy || !input.trim()} className="btn-primary text-sm disabled:opacity-50">
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

/** Exported for the tests that assert the yes/no branch is reachable. */
export const __helperYesNo = { isYes, isNo };
