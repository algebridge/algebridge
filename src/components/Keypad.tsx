"use client";

import { useState, type ReactNode } from "react";
import type { Flavor, KeyAction } from "@/components/calc/MathField";
import { MATH_FONT } from "@/components/calc/MathField";

/**
 * The on-screen keypad under AlgeBridge's calculators: three tabs (main, abc,
 * func) on the left and, on the right, % and a/b over the keys that move and
 * finish a row (arrows, backspace, the blue enter key), in a soft gray tray.
 * Digits and operators are set in the same book face as the rows.
 *
 * A key press never takes focus from the row being typed in: the keys keep
 * the pointer's press to themselves, so the caret stays where it was. The
 * keys are left out of the Tab order: on a keyboard every one of them can be
 * typed (sqrt, pi, <=, /), and forty tab stops between a row and the next
 * control would only be in the way. The tabs (main, abc, func) and the
 * buttons beside them stay reachable.
 */

type Tone = "num" | "op" | "fn" | "nav" | "enter";

interface KeyDef {
  label: ReactNode;
  aria: string;
  act: KeyAction;
  tone: Tone;
  /** Columns it spans (2 for the wide keys). */
  span?: number;
  /** Variables are set in the italic book face, as they are drawn in a row. */
  math?: boolean;
}

const ins = (text: string, aria: string, tone: Tone = "fn", caret?: number, label?: ReactNode, math = false): KeyDef => ({
  label: label ?? text,
  aria,
  act: { t: "insert", text, caret },
  tone,
  math,
});

const sup = (base: ReactNode, raised: ReactNode) => (
  <span>
    {base}
    <sup className="ml-px text-[0.68em]">{raised}</sup>
  </span>
);

const ANS = ins("ans", "Answer above", "fn", undefined, <span className="text-[0.86em]">ans</span>);

/** The digits block. Its last row ends in ans on Scientific, where it is used, and = on Graphing. */
const digits = (flavor: Flavor): KeyDef[] => [
  ins("7", "7", "num"),
  ins("8", "8", "num"),
  ins("9", "9", "num"),
  // ÷ stays a ÷ in the row; a/b makes a stacked fraction.
  ins("÷", "Divide", "op"),
  ins("4", "4", "num"),
  ins("5", "5", "num"),
  ins("6", "6", "num"),
  ins("*", "Times", "op", undefined, "×"),
  ins("1", "1", "num"),
  ins("2", "2", "num"),
  ins("3", "3", "num"),
  ins("-", "Minus", "op", undefined, "−"),
  ins("0", "0", "num"),
  ins(".", "Decimal point", "num"),
  flavor === "scientific" ? ANS : ins("=", "Equals sign", "op"),
  ins("+", "Plus", "op"),
];

const SQUARE = ins("^2", "Squared", "fn", undefined, sup(<i className={MATH_FONT}>x</i>, "2"));
const POWER = ins("^", "To the power of", "fn", undefined, sup(<i className={MATH_FONT}>x</i>, <i className={MATH_FONT}>y</i>));
const ROOT = ins("√()", "Square root", "fn", 2, "√");
const NTH_ROOT = ins(
  "root(,)",
  "Nth root",
  "fn",
  5,
  <span>
    <span className="mr-[-1px] align-[0.45em] text-[0.62em]">n</span>√
  </span>
);
const ABS = ins(
  "||",
  "Absolute value",
  "fn",
  1,
  <>
    |<i className={MATH_FONT}>a</i>|
  </>
);
/** The fraction key, drawn as a over b. */
const FRAC = ins(
  "/",
  "Fraction",
  "fn",
  undefined,
  <span className={`inline-flex flex-col items-center text-[0.74em] leading-[1.08] ${MATH_FONT}`}>
    <i className="px-[0.2em]">a</i>
    <i className="border-t border-current px-[0.2em]">b</i>
  </span>
);
const PERCENT = ins("%", "Percent", "fn");
const PI = ins("π", "Pi", "fn");
const E = ins("e", "e, about 2.718", "fn", undefined, <i className={MATH_FONT}>e</i>);
const COMMA = ins(",", "Comma", "fn");
const OPEN = ins("(", "Open bracket", "fn");
const CLOSE = ins(")", "Close bracket", "fn");

const fn = (name: string, aria: string, label: ReactNode = name) => ins(`${name}()`, aria, "fn", name.length + 1, label);
// Function names are sized to the calculator's width (cqw), so seven of them
// still fit across the func tab at the panel's smallest size.
const small = (s: string) => <span className="text-[clamp(10.5px,3.6cqw,14.5px)]">{s}</span>;
/** A name of four or more letters, smaller again so "median" fits a narrow key. */
const smaller = (s: string) => <span className="text-[clamp(8px,2.7cqw,13.5px)] tracking-[-0.02em]">{s}</span>;

/** The keys left of the digits: 3 columns on Scientific, 4 on Graphing, as school graphing calculators lay them out. */
const MAIN: Record<Flavor, KeyDef[]> = {
  scientific: [
    SQUARE,
    POWER,
    ABS,
    ROOT,
    NTH_ROOT,
    PI,
    fn("sin", "Sine", small("sin")),
    fn("cos", "Cosine", small("cos")),
    fn("tan", "Tangent", small("tan")),
    OPEN,
    CLOSE,
    COMMA,
  ],
  graphing: [
    ins("x", "x", "fn", undefined, <i className={MATH_FONT}>x</i>, true),
    ins("y", "y", "fn", undefined, <i className={MATH_FONT}>y</i>, true),
    SQUARE,
    POWER,
    OPEN,
    CLOSE,
    ins("<", "Less than", "fn"),
    ins(">", "Greater than", "fn"),
    ABS,
    COMMA,
    ins("≤", "Less than or equal to", "fn"),
    ins("≥", "Greater than or equal to", "fn"),
    NTH_ROOT,
    ROOT,
    PI,
    E,
  ],
};
const inverse = (name: string) => (
  <span className="whitespace-nowrap text-[clamp(9px,3.1cqw,13.3px)] tracking-[-0.01em]">
    {name}
    <sup className="ml-px text-[0.66em]">−1</sup>
  </span>
);

/** Functions and statistics: none of them a repeat of a main key except π beside e. The angle switch is in the tab strip. */
const FUNC: KeyDef[] = [
  fn("sin", "Sine", small("sin")),
  fn("cos", "Cosine", small("cos")),
  fn("tan", "Tangent", small("tan")),
  fn("ln", "Natural log", small("ln")),
  fn("log", "Log base 10", small("log")),
  ins("log_()", "Log with a base", "fn", 4, small("logₙ")),
  ins("!", "Factorial", "fn", undefined, small("n!")),

  ins("sin^-1()", "Inverse sine", "fn", 7, inverse("sin")),
  ins("cos^-1()", "Inverse cosine", "fn", 7, inverse("cos")),
  ins("tan^-1()", "Inverse tangent", "fn", 7, inverse("tan")),
  ins("e^", "e to the power of", "fn", undefined, sup(<i className={MATH_FONT}>e</i>, <i className={MATH_FONT}>x</i>)),
  ins("10^", "10 to the power of", "fn", undefined, sup("10", <i className={MATH_FONT}>x</i>)),
  E,
  PI,

  fn("round", "Round", smaller("round")),
  fn("floor", "Round down", smaller("floor")),
  fn("ceil", "Round up", smaller("ceil")),
  fn("mod", "Remainder after dividing", small("mod")),
  fn("gcd", "Greatest common factor", small("gcd")),
  fn("lcm", "Least common multiple", small("lcm")),
  COMMA,

  fn("mean", "Mean", smaller("mean")),
  fn("median", "Median", smaller("median")),
  fn("stdev", "Standard deviation", smaller("stdev")),
  fn("min", "Smallest", small("min")),
  fn("max", "Largest", small("max")),
  fn("nCr", "Combinations, n choose r", small("nCr")),
  fn("nPr", "Permutations", small("nPr")),
];

const ABC: KeyDef[] = [
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) =>
    c === "e" ? E : ins(c, c, "fn", undefined, <i className={MATH_FONT}>{c}</i>, true)
  ),
  ins("=", "Equals sign", "op"),
  COMMA,
];

function Icon({ d }: { d: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The column right of the digits: % and a/b, the arrows, backspace, enter. The same on every tab. */
const NAV: KeyDef[] = [
  PERCENT,
  FRAC,
  { label: <Icon d="M15 6l-6 6 6 6" />, aria: "Move left", act: { t: "left" }, tone: "nav" },
  { label: <Icon d="M9 6l6 6-6 6" />, aria: "Move right", act: { t: "right" }, tone: "nav" },
  { label: <Icon d="M9 5h11v14H9l-6-7Zm3.5 4.5 5 5m0-5-5 5" />, aria: "Backspace", act: { t: "back" }, tone: "nav", span: 2 },
  { label: <Icon d="M19 6v5a3 3 0 0 1-3 3H6m4-4-4 4 4 4" />, aria: "Enter", act: { t: "enter" }, tone: "enter", span: 2 },
];

const TONE: Record<Tone, string> = {
  num: "bg-white text-slate-900 shadow-[0_1px_0_rgb(15_23_42/0.22)] hover:bg-[#f7f8fa]",
  op: "bg-[#f3f4f6] text-slate-900 shadow-[0_1px_0_rgb(15_23_42/0.2)] hover:bg-[#e9ebee]",
  fn: "bg-[#e3e6ea] text-slate-800 shadow-[0_1px_0_rgb(15_23_42/0.18)] hover:bg-[#d9dde2]",
  nav: "bg-[#ccd1d8] text-slate-800 shadow-[0_1px_0_rgb(15_23_42/0.2)] hover:bg-[#c2c8d0]",
  enter: "bg-[#2f6bd8] text-white shadow-[0_1px_0_rgb(15_23_42/0.3)] hover:bg-[#285fc2]",
};

/**
 * Key height follows the calculator's height (container units): roomy in a
 * tall panel, still usable in a short one. On a touch screen keys are never
 * under 40px, a fingertip's size.
 */
const KEY_H = "h-[clamp(30px,8.2cqh,46px)] [@media(pointer:coarse)]:h-[clamp(40px,8.6cqh,50px)]";

export type KeypadTab = "main" | "abc" | "func";

/** Radians or degrees, as two segments: the one in use is dark. */
function AngleSegments({ degrees }: { degrees: boolean }) {
  return (
    <span className="flex h-full w-full items-stretch overflow-hidden rounded-[6px] text-[12px] font-semibold uppercase tracking-wide">
      {(["rad", "deg"] as const).map((m) => {
        const on = (m === "deg") === degrees;
        return (
          <span key={m} className={`flex flex-1 items-center justify-center px-1.5 ${on ? "bg-slate-700 text-white" : "text-slate-600"}`}>
            {m}
          </span>
        );
      })}
    </span>
  );
}

/** The angle switch for the tab strip: a control, not a label, so it reads as something to press. */
export function AngleSwitch({ degrees, onDegrees }: { degrees: boolean; onDegrees: (degrees: boolean) => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => onDegrees(!degrees)}
      aria-label={`Angles in ${degrees ? "degrees" : "radians"}. Switch to ${degrees ? "radians" : "degrees"}`}
      aria-pressed={degrees}
      title="Radians or degrees"
      className="h-[24px] w-[86px] rounded-[7px] bg-[#e3e6ea] p-[2px] shadow-[0_1px_0_rgb(15_23_42/0.14)] transition-colors hover:bg-[#d9dde2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8]"
    >
      <AngleSegments degrees={degrees} />
    </button>
  );
}

export function Keypad({
  flavor,
  onKey,
  extra,
}: {
  flavor: Flavor;
  onKey: (a: KeyAction) => void;
  /** Buttons for the right end of the tab strip (the angle switch, clear, hide). */
  extra?: ReactNode;
}) {
  const [tab, setTab] = useState<KeypadTab>("main");

  const key = (k: KeyDef, i: number) => (
    <button
      key={`${tab}-${i}`}
      type="button"
      aria-label={k.aria}
      tabIndex={-1}
      // The row being typed in keeps its focus and caret.
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => onKey(k.act)}
      style={k.span ? { gridColumn: `span ${k.span} / span ${k.span}` } : undefined}
      className={`${KEY_H} flex min-w-0 select-none items-center justify-center overflow-hidden rounded-[7px] text-[17px] leading-none transition-colors active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8] ${TONE[k.tone]} ${
        // Variables, digits and operators in the rows' book face, so a key looks like what it types.
        k.math || k.tone === "num" || k.tone === "op" ? `${MATH_FONT} text-[19px]` : ""
      }`}
    >
      {k.label}
    </button>
  );

  const nav = <div className="grid flex-[2] grid-cols-2 gap-[5px]">{NAV.map((k, i) => key(k, 100 + i))}</div>;

  return (
    <div className="shrink-0 border-t border-slate-200 bg-[#eceef1] px-1.5 pb-1.5 pt-1" data-keypad="">
      <div className="mb-1 flex items-center gap-1 px-0.5" role="tablist" aria-label="Keys">
        {(["main", "abc", "func"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => setTab(t)}
            className={`rounded-md px-2.5 py-[3px] text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8] ${
              tab === t ? "bg-white text-slate-900 shadow-[0_1px_0_rgb(15_23_42/0.15)]" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">{extra}</div>
      </div>
      <div className="mx-auto flex max-w-[620px] gap-2">
        {tab === "main" ? (
          <>
            <div className={`grid gap-[5px] ${flavor === "scientific" ? "flex-[3] grid-cols-3" : "flex-[4] grid-cols-4"}`}>{MAIN[flavor].map(key)}</div>
            <div className="grid flex-[4] grid-cols-4 gap-[5px]">{digits(flavor).map(key)}</div>
          </>
        ) : (
          <div className="grid flex-[7] grid-cols-7 gap-[5px]">{(tab === "abc" ? ABC : FUNC).map(key)}</div>
        )}
        {nav}
      </div>
    </div>
  );
}
