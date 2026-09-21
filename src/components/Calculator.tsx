"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { balanceParens, CalcError, evaluate, formatResult, toggleSign, type Carry } from "@/lib/calculator";
import {
  getCalculatorAccess,
  getServerCalculatorAccess,
  setCalculatorOpen,
  setCalculatorRect,
  subscribeCalculatorAccess,
} from "@/lib/calculator-access";
import { keepOnScreen, readOffset, saveOffset, type Offset } from "@/lib/floating-panel";

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

  { label: "±", action: "sign", variant: "fn", aria: "Make negative or positive" },
  { label: "0", variant: "num", aria: "Zero" },
  { label: ".", variant: "num", aria: "Decimal point" },
  // Percent problems are why the calculator is offered on some skills; π is
  // never needed in the ones it is offered on.
  { label: "%", variant: "fn", aria: "Percent" },
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
    <span aria-hidden className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[15px] font-bold leading-none">
      <span>+</span>
      <span>−</span>
      <span>×</span>
      <span>÷</span>
    </span>
  );
}

/** How a screen reader should say a result: "−5" and "10^23" read badly as symbols. */
function spoken(text: string): string {
  return text.replace(/−/g, "minus ").replace(/×10\^/g, " times 10 to the power ");
}

const NUDGE_KEY = "algebridge-calculator-position";
const MAX_DISPLAY_CHARS = 80;

export function Calculator() {
  const [open, setOpen] = useState(false);
  /**
   * Where the panel was dragged, as an offset from its resting corner. The
   * launcher button never moves: it used to travel with the panel, and a
   * short drag left parked it under the study helper's button.
   */
  const [nudge, setNudge] = useState<Offset>({ x: 0, y: 0 });
  const appliedRef = useRef(nudge);
  appliedRef.current = nudge;
  const dragRef = useRef<{ px: number; py: number; from: Offset; last: Offset } | null>(null);
  /**
   * Where the physical keyboard goes. The calculator only takes keystrokes
   * after the student taps it, otherwise they'd be unable to type an answer
   * (or backspace one) with the calculator sitting open beside the problem.
   */
  const [keypadActive, setKeypadActive] = useState(false);
  const [expr, setExprState] = useState("");
  const exprRef = useRef("");
  const [history, setHistory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Said by screen readers, which cannot see a result appear. */
  const [announcement, setAnnouncement] = useState("");
  // After "=", the next number press starts a fresh calculation.
  const replaceRef = useRef(false);
  const carryRef = useRef<Carry | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const setExpr = useCallback((next: string) => {
    const capped = next.slice(0, MAX_DISPLAY_CHARS);
    exprRef.current = capped;
    setExprState(capped);
  }, []);

  // Practice tells the calculator whether the skill is one it belongs on.
  // Anywhere with no opinion (null) keeps it, so it stays a general tool.
  const access = useSyncExternalStore(subscribeCalculatorAccess, getCalculatorAccess, getServerCalculatorAccess);
  const available = access !== false;

  useEffect(() => {
    const saved = readOffset(NUDGE_KEY);
    if (saved) setNudge(saved);
  }, []);

  // A skill the calculator is not offered on closes it rather than leaving it
  // floating over an answer box it may not be used for. Availability is set
  // per skill, so this fires on moving to a different skill, never between
  // two problems of the same one.
  useEffect(() => {
    if (!available) {
      setOpen(false);
      setKeypadActive(false);
    }
  }, [available]);

  useEffect(() => {
    setCalculatorOpen(open && available);
    return () => setCalculatorOpen(false);
  }, [open, available]);

  /** Pulls the panel fully on screen, e.g. a spot saved on a wider window. */
  const settle = useCallback(() => {
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return;
    setNudge((n) => {
      const next = keepOnScreen(box, appliedRef.current, n);
      return next.x === n.x && next.y === n.y ? n : next;
    });
  }, []);

  // On opening, and whenever it moves, check it is on screen and tell the
  // study helper where it is.
  useLayoutEffect(() => {
    if (!open) {
      setCalculatorRect(null);
      return;
    }
    settle();
    const box = panelRef.current?.getBoundingClientRect();
    if (box) setCalculatorRect({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
  }, [open, nudge, settle]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      settle();
      const box = panelRef.current?.getBoundingClientRect();
      if (box) setCalculatorRect({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      setCalculatorRect(null);
    };
  }, [open, settle]);

  // Live preview of the current expression (grayed under the main line).
  let preview = "";
  if (expr.trim() && !replaceRef.current) {
    try {
      const formatted = formatResult(evaluate(balanceParens(expr), carryRef.current));
      if (formatted !== expr) preview = formatted;
    } catch {
      preview = "";
    }
  }

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      // The close button lives inside this drag handle. Without this guard a
      // press on it starts a drag and calls setPointerCapture, which retargets
      // the pointer events to the handle so the button's click never fires.
      if ((e.target as HTMLElement).closest("button")) return;
      dragRef.current = { px: e.clientX, py: e.clientY, from: nudge, last: nudge };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [nudge]
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const want = { x: d.from.x + (e.clientX - d.px), y: d.from.y + (e.clientY - d.py) };
    d.last = keepOnScreen(panelRef.current?.getBoundingClientRect(), appliedRef.current, want);
    setNudge(d.last);
  }, []);

  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    // The last spot moved to, which a quick release can beat the render to.
    saveOffset(NUDGE_KEY, d.last);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setKeypadActive(false);
  }, []);

  const press = useCallback(
    (key: Key) => {
      setError(null);
      const e = exprRef.current;
      const carry = carryRef.current;

      if (key.action === "clear") {
        setExpr("");
        setHistory(null);
        carryRef.current = null;
        replaceRef.current = false;
        return;
      }

      if (key.action === "back") {
        // An edited result no longer matches the line above it.
        if (replaceRef.current) setHistory(null);
        replaceRef.current = false;
        setExpr(e.slice(0, -1));
        return;
      }

      if (key.action === "sign") {
        setHistory(null);
        if (replaceRef.current && carry && e === carry.text) {
          // A result is negated as a whole, "6.02×10^23" included.
          const value = -carry.value;
          const text = formatResult(value);
          carryRef.current = { text, value };
          setExpr(text);
          return;
        }
        replaceRef.current = false;
        setExpr(toggleSign(e));
        return;
      }

      if (key.action === "equals") {
        const trimmed = e.trim();
        if (!trimmed) return;
        try {
          const value = evaluate(balanceParens(trimmed), carry);
          const text = formatResult(value);
          setHistory(`${balanceParens(trimmed)} =`);
          carryRef.current = { text, value };
          replaceRef.current = true;
          setExpr(text);
          setAnnouncement(`equals ${spoken(text)}`);
        } catch (err) {
          const message = err instanceof CalcError ? err.message : "Something went wrong";
          setError(message);
          setAnnouncement(message);
        }
        return;
      }

      // A value/operator key.
      const text = key.insert ?? key.label;
      const isOperator = key.variant === "op" || text === "^" || text === "^2" || text === "%";
      if (replaceRef.current) {
        replaceRef.current = false;
        setHistory(null);
        if (!isOperator) {
          // After "=", a fresh number starts a new calculation.
          carryRef.current = null;
          setExpr(text);
          return;
        }
        // An operator continues from the result. A negative or scientific
        // result goes in brackets, so "−5" then x² reads (−5)^2, which is
        // the 25 it works out to.
        if (carry && e === carry.text && !/^[0-9.]+$/.test(carry.text)) {
          carryRef.current = { text: `(${carry.text})`, value: carry.value };
          setExpr(`(${carry.text})${text}`);
          return;
        }
      }
      setExpr(e + text);
    },
    [setExpr]
  );

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
    if (!open || !keypadActive) return;
    function onKey(ev: KeyboardEvent) {
      // Browser shortcuts (zoom, copy, cut) stay the browser's.
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key;
      if (k === "Escape") {
        // Only this panel closes; the study helper stays open.
        ev.stopPropagation();
        close();
        launcherRef.current?.focus();
        return;
      }
      // A key the student tabbed to is pressed with Enter or Space, like any
      // other button, instead of Enter meaning "=".
      const target = ev.target instanceof HTMLElement ? ev.target : null;
      if ((k === "Enter" || k === " ") && target?.closest("button") && panelRef.current?.contains(target)) return;

      const map: Record<string, Key | undefined> = {
        "*": KEYS.find((x) => x.label === "×"),
        x: KEYS.find((x) => x.label === "×"),
        "/": KEYS.find((x) => x.label === "÷"),
        "-": KEYS.find((x) => x.label === "−"),
        Enter: KEYS.find((x) => x.action === "equals"),
        "=": KEYS.find((x) => x.action === "equals"),
        Backspace: KEYS.find((x) => x.action === "back"),
        Delete: KEYS.find((x) => x.action === "clear"),
      };

      const direct = /^[0-9]$/.test(k) || k === "." || k === "+" || k === "(" || k === ")" || k === "^" || k === "%";
      const mapped = map[k];
      if (!direct && !mapped) return;

      // Capture phase + stopPropagation so the practice panel's own Enter and
      // 1-9 shortcuts don't also fire off the same keystroke.
      ev.preventDefault();
      ev.stopPropagation();
      press(direct ? { label: k, variant: k === "%" || k === "^" ? "fn" : "num", aria: k } : mapped!);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, keypadActive, press, close]);

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
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-bridge-600 text-white shadow-lg transition hover:bg-bridge-700 focus:outline-none focus:ring-2 focus:ring-bridge-500 focus:ring-offset-2"
      >
        {open ? <Icon name="close" size={22} /> : <OperatorMark />}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Calculator"
          className={`animate-fade-in fixed bottom-24 right-5 z-50 max-h-[calc(100dvh-1rem)] w-[19rem] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border bg-white p-3 shadow-2xl ${
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
              <Icon name="grip" size={14} className="text-slate-300" />
              Calculator
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close calculator"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* Display */}
          <div className="mb-2 rounded-xl bg-slate-900 px-4 py-3 text-right [@media(max-height:520px)]:py-1.5">
            <div className="min-h-4 break-all text-xs text-slate-400">{history ?? ""}</div>
            <div className="min-h-[2rem] break-all font-mono text-2xl font-semibold tabular-nums text-white">
              {expr || "0"}
            </div>
            <div className="min-h-5 break-all font-mono text-sm text-slate-400">
              {error ? <span className="text-red-300">{error}</span> : preview ? `= ${preview}` : ""}
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>

          {/* Who has the keyboard. Worth saying out loud, otherwise a student
              types into the calculator and wonders why the answer box is empty. */}
          <p
            aria-live="polite"
            className={`mb-2 px-1 text-[11px] leading-snug [@media(max-height:520px)]:hidden ${
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
                className={`h-11 rounded-lg border text-base transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-bridge-400 [@media(max-height:520px)]:h-8 ${
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
