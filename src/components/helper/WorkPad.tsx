"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { checkWork, hasLetters, startingLines, workContext, type StepMark } from "@/lib/work-check";
import type { PadLine } from "./types";

/**
 * Check my work. The student writes one step per line and each line is marked
 * the moment it is entered: a check when it keeps the same answer as the line
 * above, a flag when it changes it, and a plain note when it cannot be read
 * or looks like a final answer. Deterministic, local, free; see work-check.ts
 * for why it never grades an answer.
 */

let nextLineId = 1;
const newLine = (text = "", entered: string | null = null, given?: string): PadLine => ({ id: nextLineId++, text, entered, given });

/** A line read back from the problem, written the way the problem writes it: x² and (x + 1)², × for times, a real minus between terms. */
function asPrinted(text: string): string {
  return text
    .replace(/([a-z)])\^2(?![\d.])/g, "$1²")
    .replace(/([a-z)])\^3(?![\d.])/g, "$1³")
    .replace(/ \* /g, " × ")
    .replace(/ - /g, " − ");
}

/** What the problem states, one line each, then a line to start writing on. */
export function initialPad(problem?: string): PadLine[] {
  return [...startingLines(problem ?? "").map((t) => asPrinted(t)).map((t) => newLine(t, t, t)), newLine()];
}

function Mark({ mark, given }: { mark: StepMark; given: boolean }) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold";
  switch (mark.kind) {
    case "same":
    case "case":
      return (
        <span className={`${base} bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200`} title={mark.note}>
          <Icon name="check" size={15} />
        </span>
      );
    case "changed":
      return (
        <span className={`${base} bg-amber-50 text-amber-600 ring-1 ring-amber-200`} title={mark.note}>
          !
        </span>
      );
    case "final":
      return (
        <span className={`${base} bg-bridge-50 text-bridge-600 ring-1 ring-bridge-200`} title={mark.note}>
          <Icon name="pen" size={13} />
        </span>
      );
    case "unreadable":
    case "mismatch":
      return (
        <span className={`${base} bg-slate-100 text-slate-500 ring-1 ring-slate-200`} title={mark.note}>
          ?
        </span>
      );
    case "start":
      return (
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {given ? "Given" : "Start"}
        </span>
      );
    default:
      return <span className="h-6 w-6 shrink-0" />;
  }
}

const NOTE_STYLE: Partial<Record<StepMark["kind"], string>> = {
  changed: "text-amber-800",
  final: "text-bridge-800",
  unreadable: "text-slate-500",
  mismatch: "text-slate-500",
};

export function WorkPad({
  problem,
  lines: given,
  onChange,
  onBack,
  heading = "Check my work",
  intro = "One step per line, then Enter. I check that each line keeps the same answer as the line above, without saying what the answer is.",
  autoFocus = true,
  inline = false,
  choices,
  finalNote,
  headerAction,
}: {
  problem?: string;
  lines?: PadLine[];
  onChange: (lines: PadLine[]) => void;
  /** Archie's panel shows "Back to chat"; the practice card has nowhere to go back to. */
  onBack?: () => void;
  heading?: string;
  intro?: string;
  /** Focus the first empty line on open. Off on the practice card, where the answer box keeps it. */
  autoFocus?: boolean;
  /** On the practice card: natural height, no scrolling list of its own. */
  inline?: boolean;
  /** A multiple-choice card's choices: a line that is one of them is the answer, left for the card. */
  choices?: string[];
  /** What to say under a line that looks like the answer, where the answer goes. */
  finalNote?: string;
  /** Something for the header's right side in place of "Back to chat". */
  headerAction?: React.ReactNode;
}) {
  const [fallback] = useState(() => initialPad(problem));
  const lines = given ?? fallback;
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const focusNext = useRef<number | null>(null);
  const [announce, setAnnounce] = useState("");

  // Keep the parent's copy so the pad survives closing the panel.
  useEffect(() => {
    if (!given) onChange(fallback);
  }, [given, fallback, onChange]);

  // Focus the first empty line on open, so typing can start at once.
  useEffect(() => {
    if (!autoFocus) return;
    const target = lines.find((l) => !l.text) ?? lines[lines.length - 1];
    inputs.current.get(target.id)?.focus();
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (focusNext.current === null) return;
    inputs.current.get(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const enteredKey = lines.map((l) => l.entered ?? "").join("\n");
  const choiceKey = (choices ?? []).join("\n");
  const ctx = useMemo(() => workContext(problem ?? "", choiceKey ? choiceKey.split("\n") : undefined), [problem, choiceKey]);
  const marks = useMemo(() => checkWork(enteredKey.split("\n"), ctx), [enteredKey, ctx]);
  const start = useMemo(() => asPrinted(startingLines(problem ?? "")[0] ?? ""), [problem]);

  function setText(id: number, text: string) {
    onChange(lines.map((l) => (l.id === id ? { ...l, text } : l)));
  }

  /** Marks a line as entered, which is when it gets checked. */
  function commit(index: number, after?: (next: PadLine[]) => PadLine[]) {
    const line = lines[index];
    const entered = line.text.trim() ? line.text.trim() : null;
    let next = entered === line.entered ? lines : lines.map((l, i) => (i === index ? { ...l, entered } : l));
    if (after) next = after(next);
    if (next !== lines) onChange(next);
    if (entered && entered !== line.entered) {
      const mark = shown(checkWork(next.map((l) => l.entered ?? ""), ctx)[index], entered, index);
      setAnnounce(mark.note ? `Line ${index + 1}: ${mark.note}` : `Line ${index + 1} entered.`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    const line = lines[index];
    if (e.key === "Enter") {
      e.preventDefault();
      const last = index === lines.length - 1;
      if (last && line.text.trim()) {
        const added = newLine();
        focusNext.current = added.id;
        commit(index, (next) => [...next, added]);
      } else {
        commit(index);
        if (!last) inputs.current.get(lines[index + 1].id)?.focus();
      }
    } else if (e.key === "Backspace" && !line.text && index > 0) {
      e.preventDefault();
      focusNext.current = lines[index - 1].id;
      onChange(lines.filter((l) => l.id !== line.id));
    } else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      inputs.current.get(lines[index - 1].id)?.focus();
    } else if (e.key === "ArrowDown" && index < lines.length - 1) {
      e.preventDefault();
      inputs.current.get(lines[index + 1].id)?.focus();
    }
  }

  function addLine() {
    const added = newLine();
    focusNext.current = added.id;
    onChange([...lines, added]);
  }

  /**
   * A mark as the pad shows it. A line of plain numbers is arithmetic, kept
   * unmarked; a fresh start partway down is unmarked too, since only the top
   * line and the problem's own lines are labeled.
   */
  function shown(mark: StepMark, text: string, index: number): StepMark {
    if (mark.kind === "final" && !hasLetters(text)) return { kind: "empty", note: "" };
    if (mark.kind === "final" && finalNote) return { kind: "final", note: finalNote };
    if (mark.kind === "start" && index > 0 && !lines[index]?.given) return { kind: "empty", note: "" };
    return mark;
  }

  function startOver() {
    const fresh = initialPad(problem);
    focusNext.current = fresh[fresh.length - 1].id;
    onChange(fresh);
    setAnnounce("The work pad is cleared.");
  }

  return (
    <div className={inline ? "flex flex-col" : "flex min-h-0 flex-1 flex-col"}>
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
        <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
        {headerAction}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-bridge-700 transition hover:bg-bridge-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
          >
            Back to chat
          </button>
        )}
      </div>
      <p className="px-3 text-[13px] leading-snug text-slate-500">{intro}</p>

      <ol className={inline ? "mt-2 space-y-1.5 px-3 pb-2" : "mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-2"} aria-label="Your steps">
        {lines.map((line, i) => {
          const mark: StepMark =
            line.entered !== null && line.text.trim() === line.entered ? shown(marks[i], line.entered, i) : { kind: "empty", note: "" };
          const given = !!line.given && line.text.trim() === line.given;
          const noteId = `pad-note-${line.id}`;
          // A check speaks for itself; its words are for screen readers.
          const passed = mark.kind === "same" || mark.kind === "case";
          const showNote = mark.note && !passed;
          return (
            <li key={line.id}>
              <div className="flex items-center gap-2">
                <span className="w-4 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-400">{i + 1}</span>
                <input
                  ref={(el) => {
                    if (el) inputs.current.set(line.id, el);
                    else inputs.current.delete(line.id);
                  }}
                  value={line.text}
                  onChange={(e) => setText(line.id, e.target.value)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  onBlur={() => commit(i)}
                  aria-label={i === 0 ? "Line 1, the problem you start from" : `Line ${i + 1}`}
                  aria-describedby={mark.note ? noteId : undefined}
                  placeholder={i === 0 ? start || "Your equation, like 2x + 3 = 11" : "Your next step"}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={120}
                  className={`min-w-0 flex-1 rounded-lg border bg-white px-2.5 py-1.5 text-[14px] font-medium tabular-nums tracking-wide text-slate-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    mark.kind === "changed"
                      ? "border-amber-300 focus:border-amber-400 focus:ring-amber-100"
                      : passed
                        ? "border-emerald-200 focus:border-bridge-500 focus:ring-bridge-100"
                        : "border-slate-300 focus:border-bridge-500 focus:ring-bridge-100"
                  }`}
                />
                {/* One column wide enough for "Start", so every box lines up. */}
                <span className="flex w-11 shrink-0 justify-end">
                  <Mark mark={mark} given={given} />
                </span>
              </div>
              {showNote && (
                <p id={noteId} className={`ml-6 mr-12 mt-1 text-[12.5px] leading-snug ${NOTE_STYLE[mark.kind] ?? "text-slate-500"}`}>
                  {mark.note}
                </p>
              )}
              {passed && (
                <p className="sr-only" id={noteId}>
                  {mark.note}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
        <button type="button" onClick={addLine} className="btn-ghost btn-sm">
          <Icon name="plus" size={14} />
          Add a line
        </button>
        <button type="button" onClick={startOver} className="btn-ghost btn-sm text-slate-500">
          <Icon name="eraser" size={14} />
          Start over
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
