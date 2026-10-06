"use client";

import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { Icon } from "@/components/Icon";
import { MATH_FONT, MathField, MathText, type KeyAction, type MathFieldHandle } from "@/components/calc/MathField";

/**
 * The answer box: typed as text, drawn the way a math book prints it, the
 * same row the calculator uses (calc/MathField). A square root is a √ with
 * its bar over what is under it, and an empty box to type into until
 * something is there; a typed / stacks a fraction; ^ raises an exponent.
 *
 * Under it, the keys a phone's number pad lacks (minus, a fraction, a square
 * root, a square, a power, π, brackets, delete), and one more key opening a
 * full set with letters, the way a graphing calculator's keypad does. A key
 * press never takes the focus from the box, so the caret stays where it was.
 */

export interface AnswerFieldHandle {
  focus(): void;
  /** The box itself, for the small shake on a wrong answer. */
  readonly el: HTMLDivElement | null;
}

export type AnswerTone = "idle" | "right" | "wrong";

interface Key {
  label: ReactNode;
  aria: string;
  act: KeyAction;
  kind?: "num" | "sym" | "edit" | "go";
  span?: number;
}

const ins = (text: string, caret?: number): KeyAction => ({ t: "insert", text, caret });

const math = (s: ReactNode) => <span className={MATH_FONT}>{s}</span>;
const sup = (base: string, power: string) =>
  math(
    <span>
      <i>{base}</i>
      <sup className="ml-px text-[0.68em]">{power === "y" ? <i>y</i> : power}</sup>
    </span>
  );

/** A square root with its bar over an empty box: what the key makes. */
const ROOT_LABEL = (
  <span className="inline-flex items-end" aria-hidden>
    <span className={`${MATH_FONT} scale-y-[1.12] text-[1.05em] leading-none`}>√</span>
    <span className="mb-[0.1em] inline-block h-[0.8em] w-[0.75em] border-t-[1.5px] border-current">
      <span className="mx-auto mt-[0.14em] block h-[0.52em] w-[0.42em] rounded-[1px] border border-dashed border-current opacity-70" />
    </span>
  </span>
);

/** A fraction key, drawn as a over b. */
const FRAC_LABEL = (
  <span className={`inline-flex flex-col items-center text-[0.72em] leading-[1.08] ${MATH_FONT}`} aria-hidden>
    <i className="px-[0.2em]">a</i>
    <i className="border-t border-current px-[0.2em]">b</i>
  </span>
);

/** The keys always under the box: what a phone's number pad is missing. */
const QUICK: Key[] = [
  { label: math("−"), aria: "Minus", act: ins("-") },
  { label: FRAC_LABEL, aria: "Fraction", act: ins("/") },
  { label: ROOT_LABEL, aria: "Square root", act: ins("√()", 2) },
  { label: sup("x", "2"), aria: "Squared", act: ins("^2") },
  { label: sup("x", "y"), aria: "To the power of", act: ins("^") },
  { label: math("π"), aria: "Pi", act: ins("π") },
  { label: math("( )"), aria: "Brackets", act: ins("(") },
  { label: <Icon name="backspace" size={18} />, aria: "Delete", act: { t: "back" }, kind: "edit" },
];

/** The full set, laid out like a graphing calculator's: symbols left, digits right. */
const SYMBOLS: Key[] = [
  { label: math(<i>x</i>), aria: "x", act: ins("x") },
  { label: math(<i>y</i>), aria: "y", act: ins("y") },
  { label: sup("a", "2"), aria: "Squared", act: ins("^2") },
  { label: sup("a", "b"), aria: "To the power of", act: ins("^") },
  { label: math("("), aria: "Open bracket", act: ins("(") },
  { label: math(")"), aria: "Close bracket", act: ins(")") },
  { label: math("<"), aria: "Less than", act: ins("<") },
  { label: math(">"), aria: "Greater than", act: ins(">") },
  { label: math("|a|"), aria: "Absolute value", act: ins("||", 1) },
  { label: math(","), aria: "Comma", act: ins(",") },
  { label: math("≤"), aria: "Less than or equal to", act: ins("≤") },
  { label: math("≥"), aria: "Greater than or equal to", act: ins("≥") },
  { label: ROOT_LABEL, aria: "Square root", act: ins("√()", 2) },
  { label: math("π"), aria: "Pi", act: ins("π") },
  { label: FRAC_LABEL, aria: "Fraction", act: ins("/") },
  { label: math("±"), aria: "Plus or minus", act: ins("±") },
];

const digit = (d: string): Key => ({ label: math(d), aria: d, act: ins(d), kind: "num" });
const DIGITS: Key[] = [
  digit("7"),
  digit("8"),
  digit("9"),
  { label: math("÷"), aria: "Divide", act: ins("÷") },
  digit("4"),
  digit("5"),
  digit("6"),
  { label: math("×"), aria: "Times", act: ins("*") },
  digit("1"),
  digit("2"),
  digit("3"),
  { label: math("−"), aria: "Minus", act: ins("-") },
  digit("0"),
  { label: math("."), aria: "Point", act: ins("."), kind: "num" },
  { label: math("="), aria: "Equals", act: ins("=") },
  { label: math("+"), aria: "Plus", act: ins("+") },
];

const LETTER_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

const KEYS_PREF = "ab-math-keys";

function keyClass(kind: Key["kind"]): string {
  const tone =
    kind === "num"
      ? "border-slate-200 bg-white text-slate-900"
      : kind === "go"
        ? "border-bridge-600 bg-bridge-600 text-white hover:bg-bridge-700"
        : kind === "edit"
          ? "border-slate-200 bg-slate-200/80 text-slate-700 hover:bg-slate-300/70"
          : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100";
  return `flex h-10 w-full min-w-0 select-none items-center justify-center rounded-lg border text-[18px] shadow-[0_1px_0_rgb(15_23_42/0.06)] transition active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${tone}`;
}

function KeyButton({ k, onKey }: { k: Key; onKey: (a: KeyAction) => void }) {
  return (
    <button
      type="button"
      aria-label={k.aria}
      title={k.aria}
      tabIndex={-1}
      // The box keeps its focus and caret.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onKey(k.act)}
      className={keyClass(k.kind)}
      style={k.span ? { gridColumn: `span ${k.span} / span ${k.span}` } : undefined}
    >
      {k.label}
    </button>
  );
}

function FullKeys({ onKey, onClose }: { onKey: (a: KeyAction) => void; onClose: () => void }) {
  const [letters, setLetters] = useState(false);
  const bottom: Key[] = [
    letters
      ? { label: <span className="text-sm font-semibold">123</span>, aria: "Numbers and symbols", act: { t: "left" }, kind: "edit", span: 2 }
      : { label: <span className="text-sm font-semibold">abc</span>, aria: "Letters", act: { t: "left" }, kind: "edit", span: 2 },
    { label: <Icon name="arrow-left" size={16} />, aria: "Move left", act: { t: "left" }, kind: "edit" },
    { label: <Icon name="arrow-right" size={16} />, aria: "Move right", act: { t: "right" }, kind: "edit" },
    { label: <Icon name="backspace" size={18} />, aria: "Delete", act: { t: "back" }, kind: "edit", span: 2 },
    { label: <Icon name="enter" size={18} />, aria: "Enter", act: { t: "enter" }, kind: "go", span: 2 },
  ];
  return (
    <div role="group" aria-label="Math keys" className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
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
          {/* Twenty half-key columns, so each row sits half a key in from the one above. */}
          {LETTER_ROWS.map((row, r) => (
            <div key={row} className="grid gap-1" style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}>
              {row.split("").map((c, i) => (
                <div key={c} className="grid" style={{ gridColumn: `${i === 0 ? [1, 2, 4][r] : "auto"} / span 2` }}>
                  <KeyButton k={{ label: math(<i>{c}</i>), aria: c, act: ins(c), kind: "num" }} onKey={onKey} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: 4 }, (_, row) => [
            ...SYMBOLS.slice(row * 4, row * 4 + 4).map((k, i) => <KeyButton key={`s${row}-${i}`} k={k} onKey={onKey} />),
            ...DIGITS.slice(row * 4, row * 4 + 4).map((k, i) => <KeyButton key={`d${row}-${i}`} k={k} onKey={onKey} />),
          ])}
        </div>
      )}
      <div className="mt-1 grid grid-cols-8 gap-1">
        {bottom.map((k, i) =>
          i === 0 ? (
            <button
              key="tab"
              type="button"
              aria-label={k.aria}
              tabIndex={-1}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setLetters((l) => !l)}
              className={keyClass("edit")}
              style={{ gridColumn: "span 2 / span 2" }}
            >
              {k.label}
            </button>
          ) : (
            <KeyButton key={i} k={k} onKey={onKey} />
          )
        )}
      </div>
    </div>
  );
}

export function AnswerField({
  value,
  onChange,
  onEnter,
  label = "Your answer",
  placeholder,
  tone = "idle",
  locked = false,
  full = true,
  autoFocus = false,
  handle,
  note,
  className = "",
}: {
  value: string;
  onChange: (text: string) => void;
  onEnter: () => void;
  label?: string;
  placeholder?: string;
  tone?: AnswerTone;
  /** The problem is over: the answer is shown as it was written, and no longer edited. */
  locked?: boolean;
  /** Offer the full key set (letters and all) behind the last quick key. */
  full?: boolean;
  /** The box a dialog puts the focus in when it opens. */
  autoFocus?: boolean;
  handle?: Ref<AnswerFieldHandle>;
  /** A line right under the box, such as a note to finish the arithmetic. */
  note?: ReactNode;
  className?: string;
}) {
  const field = useRef<MathFieldHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const [keysOpen, setKeysOpen] = useState(false);

  useEffect(() => {
    if (!full) return;
    try {
      if (localStorage.getItem(KEYS_PREF) === "open") setKeysOpen(true);
    } catch {
      /* storage blocked: the full keys start closed */
    }
  }, [full]);

  function toggleKeys() {
    const next = !keysOpen;
    setKeysOpen(next);
    try {
      if (next) localStorage.setItem(KEYS_PREF, "open");
      else localStorage.removeItem(KEYS_PREF);
    } catch {
      /* remembered for this visit only */
    }
  }

  useImperativeHandle(
    handle,
    () => ({
      focus: () => field.current?.focus("end"),
      get el() {
        return box.current;
      },
    }),
    []
  );

  /** A key: into the box, at the caret, and the box keeps the focus. */
  const onKey = (a: KeyAction) => {
    const f = field.current;
    if (!f) return;
    f.focus();
    f.act(a);
  };

  const toneClass =
    tone === "right"
      ? "border-emerald-400 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-100"
      : locked
        ? "border-slate-200 bg-slate-50 text-slate-500"
        : tone === "wrong"
          ? "border-amber-400 bg-white ring-2 ring-amber-100 focus-within:border-amber-500 focus-within:ring-amber-200"
          : "border-slate-300 bg-white focus-within:border-bridge-500 focus-within:ring-2 focus-within:ring-bridge-200";

  return (
    <div className={className}>
      <div
        ref={box}
        className={`flex min-h-[3.25rem] items-center rounded-xl border px-4 text-[22px] text-slate-900 transition-colors ${toneClass}`}
        onPointerDown={(e) => {
          // A press on the box's own padding puts the caret at the end of what is written.
          if (e.target === e.currentTarget && !locked) {
            e.preventDefault();
            field.current?.focus("end");
          }
        }}
      >
        {locked ? (
          <MathText text={value} flavor="scientific" className={tone === "right" ? "font-semibold" : ""} />
        ) : (
          <MathField
            value={value}
            onChange={onChange}
            flavor="scientific"
            label={label}
            inputMode={keysOpen ? "none" : "decimal"}
            placeholder={placeholder}
            onEnter={onEnter}
            handle={field}
            autoFocus={autoFocus}
            className="min-w-0 flex-1 py-2"
          />
        )}
      </div>
      {note && !locked && (
        <p role="status" className="animate-pop-in mt-2 text-sm font-medium text-slate-600">
          {note}
        </p>
      )}
      {!locked && (
        // Two even rows on a phone, one row where there is room.
        <div className={`mt-2 grid gap-1.5 ${full ? "grid-cols-5 sm:grid-cols-9" : "grid-cols-4 sm:grid-cols-8"}`} role="group" aria-label="Answer keys">
          {QUICK.map((k) => (
            <KeyButton key={k.aria} k={k} onKey={onKey} />
          ))}
          {full && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={toggleKeys}
              aria-pressed={keysOpen}
              aria-label={keysOpen ? "Close the math keys" : "More math keys"}
              title="More math keys"
              className={`flex h-10 w-full items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
                keysOpen ? "border-bridge-400 bg-bridge-50 text-bridge-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon name="keyboard" size={19} />
            </button>
          )}
        </div>
      )}
      {!locked && full && keysOpen && <FullKeys onKey={onKey} onClose={toggleKeys} />}
    </div>
  );
}
