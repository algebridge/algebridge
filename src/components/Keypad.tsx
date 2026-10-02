"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { balanceParens, CalcError, evaluate, formatResult, toggleSign, type Carry } from "@/lib/calculator";

/**
 * AlgeBridge's own keypad calculator: the display, the keys and the physical
 * keyboard. The calculator panel shows it when there is no Desmos API key, so
 * every student always has a calculator that works, with Desmos one tap away
 * in a window of its own. The maths is lib/calculator.ts, which never uses
 * eval: kid-typed input never runs as code.
 */

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

/** How a screen reader should say a result: "−5" and "10^23" read badly as symbols. */
function spoken(text: string): string {
  return text.replace(/−/g, "minus ").replace(/×10\^/g, " times 10 to the power ");
}

const MAX_DISPLAY_CHARS = 80;

export function Keypad({
  open,
  panelRef,
  launcherRef,
  onClose,
  onKeysChange,
}: {
  /** Whether the panel is showing. Keys are only taken while it is. */
  open: boolean;
  /** The whole panel: a tap anywhere in it hands the keypad the keyboard. */
  panelRef: RefObject<HTMLElement | null>;
  /** The launcher counts as the calculator too: opening it is a tap on it. */
  launcherRef: RefObject<HTMLElement | null>;
  /** Escape while the keypad has the keyboard. */
  onClose: () => void;
  /** Tells the panel whether typing goes to the keypad, so it can show it. */
  onKeysChange?: (active: boolean) => void;
}) {
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

  const setExpr = useCallback((next: string) => {
    const capped = next.slice(0, MAX_DISPLAY_CHARS);
    exprRef.current = capped;
    setExprState(capped);
  }, []);

  // Opening is itself a tap on the calculator, so it takes the keyboard;
  // closing gives it back.
  useEffect(() => {
    setKeypadActive(open);
  }, [open]);

  useEffect(() => {
    onKeysChange?.(open && keypadActive);
  }, [open, keypadActive, onKeysChange]);

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
  }, [open, panelRef, launcherRef]);

  // Keyboard support, only while the keypad holds the keyboard.
  useEffect(() => {
    if (!open || !keypadActive) return;
    function onKey(ev: KeyboardEvent) {
      // Browser shortcuts (zoom, copy, cut) stay the browser's.
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key;
      if (k === "Escape") {
        // Only this panel closes; the study helper stays open.
        ev.preventDefault();
        ev.stopPropagation();
        onClose();
        return;
      }
      // A key the student tabbed to is pressed with Enter or Space, like any
      // other button, instead of Enter meaning "=".
      const target = ev.target instanceof HTMLElement ? ev.target : null;
      if ((k === "Enter" || k === " ") && target?.closest("button, a") && panelRef.current?.contains(target)) return;

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
  }, [open, keypadActive, press, onClose, panelRef]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="rounded-xl bg-slate-900 px-4 py-3 text-right [@media(max-height:520px)]:py-1.5">
        <div className="min-h-4 break-all text-xs text-slate-400">{history ?? ""}</div>
        <div
          data-testid="keypad-display"
          className="min-h-[2rem] break-all font-mono text-2xl font-semibold tabular-nums text-white"
        >
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
        className={`px-1 text-[11px] leading-snug [@media(max-height:520px)]:hidden ${
          keypadActive ? "text-bridge-700" : "text-slate-500"
        }`}
      >
        {keypadActive
          ? "Typing goes to the calculator. Click your answer box to type there."
          : "Typing goes to your answer. Tap the keypad to use it."}
      </p>

      <div className="grid grid-cols-5 gap-1.5">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            onClick={() => press(key)}
            aria-label={key.aria}
            className={`h-11 rounded-lg border text-base transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-400 [@media(max-height:520px)]:h-8 ${
              VARIANT_CLASS[key.variant ?? "num"]
            }`}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
