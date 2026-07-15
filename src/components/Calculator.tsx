"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { evaluate, formatResult, CalcError } from "@/lib/calculator";

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

export function Calculator() {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [history, setHistory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After "=", the next number press starts a fresh calculation.
  const replaceRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Keyboard support while the calculator is open.
  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      const k = ev.key;
      const map: Record<string, Key | undefined> = {
        "*": KEYS.find((x) => x.label === "×"),
        x: KEYS.find((x) => x.label === "×"),
        "/": KEYS.find((x) => x.label === "÷"),
        "-": KEYS.find((x) => x.label === "−"),
        Enter: KEYS.find((x) => x.action === "equals"),
        "=": KEYS.find((x) => x.action === "equals"),
        Backspace: KEYS.find((x) => x.action === "back"),
      };
      if (k === "Escape") {
        setOpen(false);
        return;
      }
      if (/^[0-9]$/.test(k) || k === "." || k === "+" || k === "(" || k === ")" || k === "^") {
        ev.preventDefault();
        press({ label: k, variant: "num", aria: k });
        return;
      }
      const mapped = map[k];
      if (mapped) {
        ev.preventDefault();
        press(mapped);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, press]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close calculator" : "Open calculator"}
        aria-expanded={open}
        title="Calculator"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-bridge-600 text-2xl text-white shadow-lg transition hover:scale-105 hover:bg-bridge-700 focus:outline-none focus:ring-2 focus:ring-bridge-500 focus:ring-offset-2"
      >
        {open ? "✕" : "🧮"}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Calculator"
          className="animate-modal-in fixed bottom-24 right-5 z-50 w-[19rem] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Calculator
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close calculator"
              className="rounded-md px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Display */}
          <div className="mb-3 rounded-xl bg-slate-900 px-4 py-3 text-right">
            <div className="h-4 text-xs text-slate-500">{history ?? ""}</div>
            <div className="min-h-[2rem] break-all font-mono text-2xl font-semibold text-white">
              {expr || "0"}
            </div>
            <div className="h-5 font-mono text-sm text-slate-400">
              {error ? <span className="text-red-400">{error}</span> : preview ? `= ${preview}` : ""}
            </div>
          </div>

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
