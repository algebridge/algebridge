"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { evaluate, formatResult, CalcError } from "@/lib/calculator";
import {
  getCalculatorAccess,
  getServerCalculatorAccess,
  subscribeCalculatorAccess,
} from "@/lib/calculator-access";

/** Auto-close any parentheses the student left open, so tapping √9 = just works. */
function balanceParens(s: string): string {
  let open = 0;
  for (const ch of s) {
    if (ch === "(") open += 1;
    else if (ch === ")") open = Math.max(0, open - 1);
  }
  return s + ")".repeat(open);
}

/** Toggle the sign of the number at the end of the expression (the ± key). */
function toggleSignLastNumber(s: string): string {
  if (s === "") return "-";
  const m = s.match(/(^|[^0-9.])(-?)(\d+\.?\d*|π|e)$/i);
  if (!m) return s + "-";
  const [, boundary, sign, num] = m;
  const start = s.length - (boundary.length + sign.length + num.length);
  const newSign = sign === "-" ? "" : "-";
  return s.slice(0, start) + boundary + newSign + num;
}

type Key = {
  label: string;
  /** What gets appended (defaults to label). Special actions handled separately. */
  insert?: string;
  action?: "clear" | "back" | "equals" | "sign";
  variant?: "num" | "op" | "fn" | "accent" | "danger";
  aria: string;
};

const KEYS: Key[] = [
  { label: "C", action: "clear", variant: "danger", aria: "Clear" },
  { label: "⌫", action: "back", variant: "fn", aria: "Backspace" },
  { label: "(", variant: "fn", aria: "Open parenthesis" },
  { label: ")", variant: "fn", aria: "Close parenthesis" },
  { label: "÷", variant: "op", aria: "Divide" },

  { label: "7", variant: "num", aria: "Seven" },
  { label: "8", variant: "num", aria: "Eight" },
  { label: "9", variant: "num", aria: "Nine" },
  { label: "√", insert: "√(", variant: "fn", aria: "Square root" },
  { label: "×", variant: "op", aria: "Multiply" },

  { label: "4", variant: "num", aria: "Four" },
  { label: "5", variant: "num", aria: "Five" },
  { label: "6", variant: "num", aria: "Six" },
  { label: "x²", insert: "^2", variant: "fn", aria: "Squared" },
  { label: "−", insert: "−", variant: "op", aria: "Subtract" },

  { label: "1", variant: "num", aria: "One" },
  { label: "2", variant: "num", aria: "Two" },
  { label: "3", variant: "num", aria: "Three" },
  { label: "xʸ", insert: "^", variant: "fn", aria: "Power" },
  { label: "+", variant: "op", aria: "Add" },

  { label: "±", action: "sign", variant: "fn", aria: "Plus or minus" },
  { label: "0", variant: "num", aria: "Zero" },
  { label: ".", variant: "num", aria: "Decimal point" },
  { label: "π", insert: "π", variant: "fn", aria: "Pi" },
  { label: "=", action: "equals", variant: "accent", aria: "Equals" },
];

const VARIANT_CLASS: Record<NonNullable<Key["variant"]>, string> = {
  num: "bg-white text-slate-800 hover:bg-slate-100 border-slate-200",
  op: "bg-slate-100 text-slate-900 hover:bg-slate-200 border-slate-200 font-semibold",
  fn: "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200",
  accent: "bg-bridge-600 text-white hover:bg-bridge-700 border-bridge-600 font-bold",
  danger: "bg-red-50 text-red-600 hover:bg-red-100 border-red-100 font-semibold",
};

/** The launcher glyph: the four operations, which need no explaining. */
function OperatorMark() {
  return (
    <span
      aria-hidden
      className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[15px] font-bold leading-none"
    >
      <span>+</span>
      <span>−</span>
      <span>×</span>
      <span>÷</span>
    </span>
  );
}

/** Where the panel sits, as an offset from its resting corner. */
interface Nudge {
  x: number;
  y: number;
}

const NUDGE_KEY = "algebridge-calculator-position";

export function Calculator() {
  const [open, setOpen] = useState(false);
  /** Dragged offset from the bottom-right corner it starts in. */
  const [nudge, setNudge] = useState<Nudge>({ x: 0, y: 0 });
  const dragRef = useRef<{ px: number; py: number; from: Nudge } | null>(null);
  /**
   * Where the physical keyboard goes. The calculator only takes keystrokes
   * after the student taps it, otherwise they'd be unable to type an answer
   * (or backspace one) with the calculator sitting open beside the problem.
   */
  const [keypadActive, setKeypadActive] = useState(false);
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After "=", the next number press starts a fresh calculation.
  const replaceRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  // Practice tells the calculator whether this problem is one it belongs on.
  // Anywhere with no opinion (null) keeps it, so it stays a general tool.
  const access = useSyncExternalStore(
    subscribeCalculatorAccess,
    getCalculatorAccess,
    getServerCalculatorAccess
  );
  const available = access !== false;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NUDGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Nudge;
        if (typeof saved?.x === "number" && typeof saved?.y === "number") setNudge(saved);
      }
    } catch {
      /* a blocked or corrupt store just means it opens in the corner */
    }
  }, []);

  // A problem the calculator is not offered on closes it rather than leaving
  // it floating over an answer box it may not be used for.
  useEffect(() => {
    if (!available) {
      setOpen(false);
      setKeypadActive(false);
    }
  }, [available]);

  // Live preview of the current expression (grayed under the main line).
  let preview = "";
  if (expr.trim()) {
    try {
      const val = evaluate(balanceParens(expr));
      const formatted = formatResult(val);
      if (formatted !== expr) preview = formatted;
    } catch {
      preview = "";
    }
  }

  /**
   * Dragging keeps the panel anchored to its corner and stores an offset,
   * rather than switching to absolute coordinates. That way a window resize
   * cannot strand it off-screen: the corner moves with the viewport and the
   * offset is clamped to what is still visible.
   */
  const clampNudge = useCallback((n: Nudge): Nudge => {
    const box = panelRef.current?.getBoundingClientRect();
    const w = box?.width ?? 304;
    const h = box?.height ?? 420;
    return {
      x: Math.min(0, Math.max(-(window.innerWidth - w - 24), n.x)),
      y: Math.min(0, Math.max(-(window.innerHeight - h - 24), n.y)),
    };
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragRef.current = { px: e.clientX, py: e.clientY, from: nudge };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }, [nudge]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    // Right and bottom anchoring means both axes run backwards from the drag.
    setNudge(clampNudge({ x: d.from.x + (e.clientX - d.px), y: d.from.y + (e.clientY - d.py) }));
  }, [clampNudge]);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setNudge((n) => {
      try {
        window.localStorage.setItem(NUDGE_KEY, JSON.stringify(n));
      } catch {
        /* not being able to remember where it was put is not worth an error */
      }
      return n;
    });
  }, []);

  useEffect(() => {
    function onResize() {
      setNudge((n) => clampNudge(n));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampNudge]);

  const clearAll = useCallback(() => {
    setExpr("");
    setHistory(null);
    setError(null);
    replaceRef.current = false;
  }, []);

  const press = useCallback((key: Key) => {
    setError(null);

    if (key.action === "clear") {
      clearAll();
      return;
    }

    if (key.action === "back") {
      replaceRef.current = false;
      setExpr((e) => e.slice(0, -1));
      return;
    }

    if (key.action === "sign") {
      replaceRef.current = false;
      setExpr((e) => toggleSignLastNumber(e));
      return;
    }

    if (key.action === "equals") {
      setExpr((e) => {
        const trimmed = e.trim();
        if (!trimmed) return e;
        try {
          const val = evaluate(balanceParens(trimmed));
          const formatted = formatResult(val);
          setHistory(`${trimmed} =`);
          replaceRef.current = true;
          return formatted;
        } catch (err) {
          setError(err instanceof CalcError ? err.message : "Something went wrong");
          return e;
        }
      });
      return;
    }

    // A value/operator key.
    const text = key.insert ?? key.label;
    const isOperator = key.variant === "op" || text === "^" || text === "^2";
    setExpr((e) => {
      // After "=", a fresh number replaces the result; an operator continues from it.
      if (replaceRef.current) {
        replaceRef.current = false;
        setHistory(null);
        if (!isOperator) return text;
      }
      return e + text;
    });
  }, [clearAll]);

  // Tapping the calculator hands it the keyboard; touching anything else hands
  // the keyboard back to the page (the answer box, usually).
  useEffect(() => {
    if (!open) return;
    function isInsideCalculator(node: EventTarget | null): boolean {
      if (!(node instanceof Node)) return false;
      return !!panelRef.current?.contains(node) || !!launcherRef.current?.contains(node);
    }
    function onPointerDown(ev: PointerEvent) {
      setKeypadActive(isInsideCalculator(ev.target));
    }
    // Covers Tab-ing into the answer box, and browsers that don't focus a
    // <button> on tap (Safari), where pointerdown is the only signal.
    function onFocusIn(ev: FocusEvent) {
      setKeypadActive(isInsideCalculator(ev.target));
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [open]);

  // Keyboard support, only while the keypad holds the keyboard.
  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      const k = ev.key;
      if (k === "Escape") {
        setOpen(false);
        setKeypadActive(false);
        return;
      }
      if (!keypadActive) return;

      const map: Record<string, Key | undefined> = {
        "*": KEYS.find((x) => x.label === "×"),
        x: KEYS.find((x) => x.label === "×"),
        "/": KEYS.find((x) => x.label === "÷"),
        "-": KEYS.find((x) => x.label === "−"),
        Enter: KEYS.find((x) => x.action === "equals"),
        "=": KEYS.find((x) => x.action === "equals"),
        Backspace: KEYS.find((x) => x.action === "back"),
      };

      const direct =
        /^[0-9]$/.test(k) || k === "." || k === "+" || k === "(" || k === ")" || k === "^";
      const mapped = map[k];
      if (!direct && !mapped) return;

      // Capture phase + stopPropagation so the practice panel's own Enter and
      // 1-9 shortcuts don't also fire off the same keystroke.
      ev.preventDefault();
      ev.stopPropagation();
      press(direct ? { label: k, variant: "num", aria: k } : mapped!);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, keypadActive, press]);

  if (!available) return null;

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => {
          setOpen((o) => {
            // Opening is itself a tap on the calculator, so it takes the keyboard.
            setKeypadActive(!o);
            return !o;
          });
        }}
        aria-label={open ? "Close calculator" : "Open calculator"}
        aria-expanded={open}
        title="Calculator"
        style={{ transform: `translate(${nudge.x}px, ${nudge.y}px)` }}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-bridge-600 text-white shadow-lg transition hover:bg-bridge-700 focus:outline-none focus:ring-2 focus:ring-bridge-500 focus:ring-offset-2"
      >
        {open ? <span className="text-2xl leading-none">✕</span> : <OperatorMark />}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Calculator"
          className={`animate-fade-in fixed bottom-24 right-5 z-50 w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border bg-white p-3 shadow-2xl ${
            keypadActive ? "border-bridge-400 ring-2 ring-bridge-200" : "border-slate-200"
          }`}
          style={{ transform: `translate(${nudge.x}px, ${nudge.y}px)` }}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="mb-2 flex touch-none cursor-grab items-center justify-between px-1 active:cursor-grabbing"
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span aria-hidden className="text-slate-300">⠿</span>
              Calculator
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setKeypadActive(false);
              }}
              aria-label="Close calculator"
              className="rounded-md px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Display */}
          <div className="mb-2 rounded-xl bg-slate-900 px-4 py-3 text-right">
            <div className="h-4 text-xs text-slate-500">{history ?? ""}</div>
            <div className="min-h-[2rem] break-all font-mono text-2xl font-semibold text-white">
              {expr || "0"}
            </div>
            <div className="h-5 font-mono text-sm text-slate-400">
              {error ? <span className="text-red-400">{error}</span> : preview ? `= ${preview}` : ""}
            </div>
          </div>

          {/* Who has the keyboard. Worth saying out loud, otherwise a student
              types into the calculator and wonders why the answer box is empty. */}
          <p
            aria-live="polite"
            className={`mb-2 px-1 text-[11px] leading-snug ${
              keypadActive ? "text-bridge-700" : "text-slate-400"
            }`}
          >
            {keypadActive
              ? "Typing goes to the calculator. Click your answer box to type there."
              : "Typing goes to your answer. Tap the keypad to use it."}
          </p>

          {/* Keypad */}
          <div className="grid grid-cols-5 gap-1.5">
            {KEYS.map((key) => (
              <button
                key={key.label}
                type="button"
                onClick={() => press(key)}
                aria-label={key.aria}
                className={`h-11 rounded-lg border text-base transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-bridge-400 ${
                  VARIANT_CLASS[key.variant ?? "num"]
                }`}
              >
                {key.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
