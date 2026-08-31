"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createSessionRequest } from "@/lib/sessions";
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

const MODES: { id: HelperMode; label: string; blurb: string }[] = [
  { id: "tutor", label: "Tutor", blurb: "Work through a problem one step at a time." },
  { id: "reminder", label: "Reminder", blurb: "Get a formula back, with a way to keep it." },
  { id: "scheduler", label: "Scheduler", blurb: "Book time with a real tutor." },
];

interface Position {
  x: number;
  y: number;
}

export function StudyHelper() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<HelperMode>("tutor");
  const [messages, setMessages] = useState<HelperMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduler, setScheduler] = useState<SchedulerState | null>(null);
  const [note, setNote] = useState("");

  const [pos, setPos] = useState<Position>({ x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number; from: Position } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(POSITION_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Position;
        if (typeof saved?.x === "number" && typeof saved?.y === "number") setPos(saved);
      }
    } catch {
      /* a blocked store just means it opens in the corner */
    }
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, scheduler]);

  // Anchored to a corner with a clamped offset, so a window resize can never
  // strand the panel off-screen.
  const clamp = useCallback((p: Position): Position => {
    const box = panelRef.current?.getBoundingClientRect();
    const w = box?.width ?? 340;
    const h = box?.height ?? 460;
    return {
      x: Math.min(0, Math.max(-(window.innerWidth - w - 24), p.x)),
      y: Math.min(0, Math.max(-(window.innerHeight - h - 24), p.y)),
    };
  }, []);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { px: e.clientX, py: e.clientY, from: pos };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [pos]
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setPos(clamp({ x: d.from.x + (e.clientX - d.px), y: d.from.y + (e.clientY - d.py) }));
    },
    [clamp]
  );

  const onDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPos((p) => {
      try {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(p));
      } catch {
        /* not remembering where it was put is not worth an error */
      }
      return p;
    });
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

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
        body: JSON.stringify({ mode, context: {}, messages: [...messages, { role: "user", content: text }] }),
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
        className="fixed bottom-5 right-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-xl text-white shadow-lg transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
      >
        ✳
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Study helper"
          className="animate-fade-in fixed bottom-24 right-5 z-50 flex w-[21rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="flex touch-none cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span aria-hidden className="text-slate-300">⠿</span>
              Study helper
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the study helper"
              className="rounded-md px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
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

          <div ref={logRef} className="max-h-72 min-h-[9rem] space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="px-1 text-sm text-slate-500">
                {note || MODES.find((m) => m.id === mode)?.blurb}
                <br />
                <span className="text-xs text-slate-400">
                  I will not give you an answer. Ask for a step, a formula, or a tutor.
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
