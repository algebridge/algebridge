"use client";

import { createContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Icon } from "@/components/Icon";

/**
 * Math keys on the screen, laid out the way a graphing calculator's keypad
 * is: letters and symbols on the left, the number pad on the right, editing
 * along the bottom, and every letter one tab away.
 *
 * It types into whichever math box on the card was used last (the answer box
 * or a line of the work pad), at the caret, and leaves that box focused. Any
 * input marked `data-math-keys` inside `scope` is a box it can type into.
 * While it is open those boxes ask a phone for no keyboard of its own
 * (inputMode="none", read from MathKeysOpen), the way a calculator app's
 * keypad takes the place of the phone's.
 */

/** Whether the keys are open, so the math boxes can hand the phone's keyboard over to them. */
export const MathKeysOpen = createContext(false);

interface Key {
  label: ReactNode;
  aria: string;
  /** Text typed at the caret. */
  text?: string;
  /** How far back from the end of `text` the caret lands, for pairs like | |. */
  back?: number;
  act?: "left" | "right" | "delete" | "enter" | "abc" | "123";
  kind?: "num" | "sym" | "edit" | "go";
  span?: number;
}

const sup = (base: string, power: string) => (
  <span>
    {base}
    <sup className="ml-px text-[0.7em]">{power}</sup>
  </span>
);

const SYMBOLS: Key[] = [
  { label: <i className="font-serif">x</i>, aria: "x", text: "x" },
  { label: <i className="font-serif">y</i>, aria: "y", text: "y" },
  { label: sup("a", "2"), aria: "squared", text: "²" },
  { label: sup("a", "b"), aria: "to the power", text: "^" },
  { label: "(", aria: "open parenthesis", text: "(" },
  { label: ")", aria: "close parenthesis", text: ")" },
  { label: "<", aria: "less than", text: " < " },
  { label: ">", aria: "greater than", text: " > " },
  { label: "|a|", aria: "absolute value", text: "||", back: 1 },
  { label: ",", aria: "comma", text: ", " },
  { label: "≤", aria: "less than or equal to", text: " ≤ " },
  { label: "≥", aria: "greater than or equal to", text: " ≥ " },
  { label: "√", aria: "square root", text: "√" },
  { label: "π", aria: "pi", text: "π" },
  { label: <span className="text-[0.85em]">a/b</span>, aria: "fraction bar", text: "/" },
  { label: "±", aria: "plus or minus", text: "±" },
];

const NUMBERS: Key[] = [
  ..."789".split("").map((d) => ({ label: d, aria: d, text: d, kind: "num" as const })),
  { label: "÷", aria: "divide", text: " ÷ " },
  ..."456".split("").map((d) => ({ label: d, aria: d, text: d, kind: "num" as const })),
  { label: "×", aria: "times", text: " × " },
  ..."123".split("").map((d) => ({ label: d, aria: d, text: d, kind: "num" as const })),
  { label: "−", aria: "minus", text: "−" },
  { label: "0", aria: "0", text: "0", kind: "num" },
  { label: ".", aria: "point", text: ".", kind: "num" },
  { label: "=", aria: "equals", text: " = " },
  { label: "+", aria: "plus", text: " + " },
];

const EDIT = (letters: boolean): Key[] => [
  letters
    ? { label: "123", aria: "Numbers and symbols", act: "123", kind: "edit", span: 2 }
    : { label: "abc", aria: "Letters", act: "abc", kind: "edit", span: 2 },
  { label: <Icon name="arrow-left" size={16} />, aria: "Move left", act: "left", kind: "edit" },
  { label: <Icon name="arrow-right" size={16} />, aria: "Move right", act: "right", kind: "edit" },
  { label: <Icon name="backspace" size={18} />, aria: "Delete", act: "delete", kind: "edit", span: 2 },
  { label: <Icon name="enter" size={18} />, aria: "Enter", act: "enter", kind: "go", span: 2 },
];

const LETTER_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Sets a React-controlled input's value the way typing does, so its onChange runs. */
function writeValue(el: HTMLInputElement, value: string, caret: number) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  placeCaret(el, caret);
}

function placeCaret(el: HTMLInputElement, caret: number) {
  el.focus({ preventScroll: true });
  const at = Math.max(0, Math.min(caret, el.value.length));
  try {
    el.setSelectionRange(at, at);
  } catch {
    // Some input types have no caret; the math boxes are all text.
  }
  // React writes the value back after the change; put the caret back after it.
  window.requestAnimationFrame(() => {
    try {
      if (document.activeElement === el) el.setSelectionRange(at, at);
    } catch {
      // As above.
    }
  });
}

/** Sends a key press to the box, so Enter and Backspace do what the box already does with them. */
function press(el: HTMLInputElement, key: string): boolean {
  const event = new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event.defaultPrevented;
}

export function MathKeyboard({
  scope,
  onClose,
  className = "",
}: {
  scope: RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
}) {
  const last = useRef<HTMLInputElement | null>(null);
  const [letters, setLetters] = useState(false);

  // Remember the math box used last, so a key goes where the student was typing.
  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.dataset.mathKeys !== undefined) last.current = el;
    };
    root.addEventListener("focusin", onFocus);
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.dataset.mathKeys !== undefined && root.contains(active)) last.current = active;
    return () => root.removeEventListener("focusin", onFocus);
  }, [scope]);

  /** The box a key types into: the one used last, else the answer box, else the last line of work. */
  function target(): HTMLInputElement | null {
    const root = scope.current;
    const used = last.current;
    if (used && used.isConnected && !used.disabled && !used.readOnly && root?.contains(used)) return used;
    const boxes = root
      ? Array.from(root.querySelectorAll<HTMLInputElement>("input[data-math-keys]")).filter((el) => !el.disabled && !el.readOnly)
      : [];
    return boxes.find((el) => el.dataset.mathKeys === "answer") ?? boxes[boxes.length - 1] ?? null;
  }

  function run(key: Key) {
    if (key.act === "abc" || key.act === "123") {
      setLetters(key.act === "abc");
      return;
    }
    const el = target();
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (key.text !== undefined) {
      // Spaced operators lose their leading space at the start of a box: "≤ 4", not " ≤ 4".
      const text = start === 0 || /\s$/.test(el.value.slice(0, start)) ? key.text.replace(/^ /, "") : key.text;
      const next = el.value.slice(0, start) + text + el.value.slice(end);
      if (el.maxLength > 0 && next.length > el.maxLength) return;
      writeValue(el, next, start + text.length - (key.back ?? 0));
      return;
    }
    switch (key.act) {
      case "left":
        placeCaret(el, start === end ? start - 1 : start);
        return;
      case "right":
        placeCaret(el, start === end ? end + 1 : end);
        return;
      case "enter":
        press(el, "Enter");
        return;
      case "delete": {
        if (start !== end) {
          writeValue(el, el.value.slice(0, start) + el.value.slice(end), start);
          return;
        }
        // An empty line of work goes away, the way Backspace on it does.
        if (start === 0) {
          if (!el.value) press(el, "Backspace");
          return;
        }
        // A spaced operator goes in one press, as it came in one.
        const before = el.value.slice(0, start);
        const cut = /\s[<>≤≥=÷×+]\s$/.test(before) ? 3 : 1;
        writeValue(el, before.slice(0, -cut) + el.value.slice(end), start - cut);
        return;
      }
    }
  }

  const keyClass = (key: Key) => {
    const tone =
      key.kind === "num"
        ? "bg-white text-slate-900 border-slate-200"
        : key.kind === "go"
          ? "bg-bridge-600 text-white border-bridge-600 hover:bg-bridge-700 active:bg-bridge-800"
          : key.kind === "edit"
            ? "bg-slate-200/80 text-slate-700 border-slate-200 hover:bg-slate-300/70"
            : "bg-slate-100 text-slate-800 border-slate-200";
    return `flex h-10 min-w-0 select-none items-center justify-center rounded-lg border text-[17px] font-medium tabular-nums shadow-[0_1px_0_rgb(15_23_42/0.06)] transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 sm:h-11 ${
      key.kind === "go" ? "" : "hover:brightness-[0.97] active:bg-slate-200"
    } ${tone}`;
  };

  const button = (key: Key, i: number) => (
    <button
      key={`${key.aria}-${i}`}
      type="button"
      aria-label={key.aria}
      title={key.aria}
      // A key must leave the focus in the box, or the caret, and a phone's selection, go with it.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(key)}
      className={keyClass(key)}
      style={key.span ? { gridColumn: `span ${key.span} / span ${key.span}` } : undefined}
    >
      {key.label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Math keys"
      className={`rounded-2xl border border-slate-200 bg-slate-50 p-2 ${className}`}
    >
      <div className="mb-1.5 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Math keys</p>
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onClose}
          className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
        >
          Close
        </button>
      </div>
      {letters ? (
        <div className="space-y-1">
          {/* Twenty half-key columns, so each row sits half a key in from the one above, as on a keyboard. */}
          {LETTER_ROWS.map((row, r) => (
            <div key={row} className="grid gap-1" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
              {row.split("").map((c, i) => (
                <div key={c} className="grid" style={{ gridColumn: `${i === 0 ? [1, 2, 4][r] : "auto"} / span 2` }}>
                  {button({ label: <i className="font-serif">{c}</i>, aria: c, text: c, kind: "num" }, i)}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 4 }, (_, row) => [
            ...SYMBOLS.slice(row * 4, row * 4 + 4).map((k, i) => button({ ...k, kind: k.kind ?? "sym" }, row * 8 + i)),
            ...NUMBERS.slice(row * 4, row * 4 + 4).map((k, i) => button({ ...k, kind: k.kind ?? "sym" }, row * 8 + 4 + i)),
          ])}
        </div>
      )}
      <div className="mt-1 grid grid-cols-8 gap-1">{EDIT(letters).map(button)}</div>
    </div>
  );
}

/** The key that opens and closes the math keys, sized like the minus and fraction keys beside the answer box. */
export function MathKeysToggle({ open, onToggle, className = "" }: { open: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onToggle}
      aria-pressed={open}
      aria-label={open ? "Close the math keys" : "Open the math keys"}
      title="Math keys"
      className={`flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
        open ? "border-bridge-400 bg-bridge-50 text-bridge-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      } ${className}`}
    >
      <Icon name="keyboard" size={20} />
    </button>
  );
}
