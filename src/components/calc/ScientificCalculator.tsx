"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { AngleSwitch, Keypad } from "@/components/Keypad";
import { MATH_FONT, MathField, MathText, type KeyAction, type MathFieldHandle } from "@/components/calc/MathField";
import { readSaved, savedTexts, spoken, writeSaved } from "@/components/calc/saved";
import { evaluateScientific } from "@/lib/calc-engine";

/**
 * AlgeBridge's scientific calculator: a numbered list of rows, each worked
 * out as it is typed ("= 42" in gray at the right), with the keypad under it.
 * Enter starts a new row, ans is the answer above, ans_2 is row 2's answer,
 * and a letter set in one row (a = 3) works in every other. The maths is
 * lib/calc-engine.ts.
 */

interface Row {
  id: number;
  text: string;
}

const SAVE_KEY = "algebridge-calc-scientific";

export function WarningMark() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mr-1 inline-block shrink-0 align-[-2px]">
      <path d="M12 4 2.8 19.5h18.4Z" />
      <path d="M12 10v4.2M12 17.2v.1" />
    </svg>
  );
}

/** The small switch beside an answer that shows it as a fraction or a decimal. */
function FractionToggle({ on, tabbable, onToggle }: { on: boolean; tabbable: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? "Show the answer as a decimal" : "Show the answer as a fraction"}
      title={on ? "Show as a decimal" : "Show as a fraction"}
      tabIndex={tabbable ? 0 : -1}
      className={`ml-2 flex h-[24px] w-[24px] items-center justify-center rounded-md border text-[10px] leading-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8] ${MATH_FONT} ${
        on ? "border-[#2f6bd8] bg-[#e6eefc] text-[#2f6bd8]" : "border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700"
      }`}
    >
      <span aria-hidden className="flex flex-col items-center">
        <span>1</span>
        <span className="border-t border-current px-[2px]">2</span>
      </span>
    </button>
  );
}

/**
 * The Undo button that follows Clear all, until the next edit: a clear is
 * one tap and should never cost a student their work.
 */
export function UndoClear({ onUndo, what }: { onUndo: () => void; what: string }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={onUndo}
      aria-label={`Undo: bring back the ${what}`}
      title="Undo"
      className="flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[12px] font-semibold text-[#2f6bd8] transition-colors hover:bg-[#e6eefc] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8]"
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
      Undo
    </button>
  );
}

export function ScientificCalculator({ active }: { active: boolean }) {
  const [rows, setRows] = useState<Row[]>([{ id: 1, text: "" }]);
  const [current, setCurrent] = useState(0);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [degrees, setDegrees] = useState(true);
  const [announcement, setAnnouncement] = useState("");
  const [loaded, setLoaded] = useState(false);
  /** The rows Clear all took away, until the next edit. */
  const [cleared, setCleared] = useState<Row[] | null>(null);
  /** Rows whose answer is shown as a fraction (3/4) instead of a decimal (0.75). */
  const [asFraction, setAsFraction] = useState<ReadonlySet<number>>(new Set());
  const nextId = useRef(2);
  const fields = useRef(new Map<number, MathFieldHandle>());
  const pendingFocus = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readSaved(SAVE_KEY) as { rows?: unknown; degrees?: unknown } | null;
    const texts = savedTexts(saved?.rows);
    if (texts.length) {
      // A fresh row under the saved ones, so what is typed next starts a new
      // calculation instead of landing inside an old one. New ids, so no
      // saved row inherits the empty placeholder's caret.
      if (texts[texts.length - 1].trim()) texts.push("");
      setRows(texts.map((text) => ({ id: nextId.current++, text })));
      setCurrent(texts.length - 1);
    }
    if (typeof saved?.degrees === "boolean") setDegrees(saved.degrees);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => writeSaved(SAVE_KEY, { rows: rows.map((r) => r.text), degrees }), 400);
    return () => window.clearTimeout(timer);
  }, [rows, degrees, loaded]);

  const joined = rows.map((r) => r.text).join("\n");
  const results = useMemo(() => evaluateScientific(joined.split("\n"), degrees), [joined, degrees]);
  const at = Math.min(current, rows.length - 1);

  // A row made a moment ago gets the keyboard once it is on the page.
  useEffect(() => {
    if (pendingFocus.current === null) return;
    const id = pendingFocus.current;
    pendingFocus.current = null;
    fields.current.get(id)?.focus("end");
  });

  // Opening the calculator puts the caret at the end of its row, ready to
  // type. It waits for the saved rows, or it would focus the placeholder
  // they replace.
  useEffect(() => {
    if (!active || !loaded) return;
    fields.current.get(rows[at]?.id)?.focus("end");
    // Only on opening (and once the saved rows are in), not on every row change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loaded]);

  const setText = useCallback((id: number, text: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, text } : r)));
    setCleared(null);
  }, []);

  const focusRow = (i: number) => {
    const row = rows[i];
    if (!row) return;
    setCurrent(i);
    fields.current.get(row.id)?.focus("end");
  };

  const addRowAfter = (i: number) => {
    const id = nextId.current++;
    setRows((rs) => [...rs.slice(0, i + 1), { id, text: "" }, ...rs.slice(i + 1)]);
    setCurrent(i + 1);
    pendingFocus.current = id;
  };

  const onEnter = (i: number) => {
    const r = results[i];
    if (r?.kind === "value" && r.text) setAnnouncement(`equals ${spoken(r.text)}`);
    else if (r?.kind === "error" && r.error) setAnnouncement(r.error);
    if (!rows[i].text.trim()) return;
    if (i + 1 < rows.length && !rows[i + 1].text.trim()) focusRow(i + 1);
    else addRowAfter(i);
  };

  const removeRow = (i: number, refocus: boolean) => {
    if (rows.length === 1) {
      setText(rows[0].id, "");
      if (refocus) fields.current.get(rows[0].id)?.focus(0);
      return;
    }
    const keep = i > 0 ? i - 1 : 0;
    const target = rows[i > 0 ? i - 1 : 1];
    setRows((rs) => rs.filter((_, k) => k !== i));
    setCurrent(keep);
    if (refocus) fields.current.get(target.id)?.focus("end");
  };

  const clearAll = () => {
    if (rows.some((r) => r.text.trim())) setCleared(rows);
    const id = nextId.current++;
    setRows([{ id, text: "" }]);
    setCurrent(0);
    pendingFocus.current = id;
    setAnnouncement("Cleared. Undo brings them back");
  };

  const undoClear = () => {
    if (!cleared) return;
    setRows(cleared);
    setCurrent(cleared.length - 1);
    pendingFocus.current = cleared[cleared.length - 1].id;
    setCleared(null);
    setAnnouncement("Calculations back");
  };

  const onKey = (a: KeyAction) => {
    // The row with the caret, which is the highlighted one unless focus is elsewhere.
    const field = fields.current.get(focusedId ?? rows[at]?.id);
    if (!field) return;
    if (!rootRef.current?.contains(document.activeElement)) field.focus();
    field.act(a);
  };

  return (
    <div ref={rootRef} role="region" aria-label="Scientific calculator" className="flex h-full flex-col bg-white [container-type:size]">
      <div role="list" aria-label="Calculations" data-scroll-list="" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {rows.map((row, i) => {
          const r = results[i];
          const isCurrent = i === at;
          const focused = focusedId === row.id;
          const showError = r?.kind === "error" && !(r.incomplete && (focused || !row.text.trim()));
          return (
            <div key={row.id} role="listitem" className="group relative flex shrink-0 border-b border-[#e3e6ea]">
              <div
                aria-hidden
                className={`flex w-[34px] shrink-0 select-none justify-center pt-[12px] text-[11px] tabular-nums transition-colors ${
                  isCurrent ? "bg-[#e6eefc] font-semibold text-[#2f6bd8]" : "bg-[#f6f7f9] text-slate-400"
                }`}
              >
                {i + 1}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 py-[6px] pl-3 pr-8">
                <MathField
                  handle={(h) => {
                    if (h) fields.current.set(row.id, h);
                    else fields.current.delete(row.id);
                  }}
                  value={row.text}
                  onChange={(text) => setText(row.id, text)}
                  flavor="scientific"
                  label={`Calculation ${i + 1}`}
                  inputMode="none"
                  ansFirst={i > 0}
                  placeholder={rows.length === 1 && i === 0 ? "Type a calculation" : undefined}
                  onEnter={() => onEnter(i)}
                  onLeave={(dir) => focusRow(dir === "up" ? i - 1 : i + 1)}
                  onBackspaceEmpty={() => {
                    if (rows.length > 1) removeRow(i, true);
                  }}
                  onUndoEmpty={cleared ? undoClear : undefined}
                  onFocus={() => {
                    setCurrent(i);
                    setFocusedId(row.id);
                  }}
                  onBlur={() => setFocusedId((f) => (f === row.id ? null : f))}
                  className="min-w-0 max-w-full flex-auto text-[22px] leading-[1.75]"
                />
                {r?.kind === "value" && r.show && r.text && (
                  <div className="ml-auto flex shrink-0 items-center text-[19px] leading-[1.6] text-slate-500">
                    <span className="mr-1.5">=</span>
                    <MathText text={r.fraction && asFraction.has(row.id) ? r.fraction : r.text} flavor="scientific" />
                    {r.fraction && (
                      <FractionToggle
                        on={asFraction.has(row.id)}
                        tabbable={isCurrent}
                        onToggle={() =>
                          setAsFraction((set) => {
                            const next = new Set(set);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })
                        }
                      />
                    )}
                  </div>
                )}
                {showError && (
                  <p className={`basis-full pb-1 text-[12.5px] leading-snug ${r.incomplete ? "text-slate-400" : "text-[#a85a12]"}`}>
                    {!r.incomplete && <WarningMark />}
                    {r.error}
                  </p>
                )}
              </div>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => removeRow(i, false)}
                // One delete button in the Tab order, the current row's, not one per row.
                tabIndex={isCurrent ? 0 : -1}
                aria-label={`Delete calculation ${i + 1}`}
                title="Delete"
                className={`absolute right-1 top-[9px] rounded-md p-1 text-slate-400 transition-opacity hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#2f6bd8] ${
                  isCurrent && row.text ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          );
        })}
        {/* Under the fresh row Clear all leaves, where the eye already is: room the keypad's tab strip does not have at the smallest size. */}
        {cleared && (
          <div className="shrink-0 px-2 pt-1.5">
            <UndoClear onUndo={undoClear} what="calculations" />
          </div>
        )}
        {/* The paper below the last row: a tap there goes to a fresh row. */}
        <div
          aria-hidden
          className="min-h-[44px] flex-1 cursor-text"
          onPointerDown={(e) => {
            e.preventDefault();
            const last = rows.length - 1;
            if (rows[last].text.trim()) addRowAfter(last);
            else focusRow(last);
          }}
        />
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <Keypad
        flavor="scientific"
        onKey={onKey}
        extra={
          <>
            <AngleSwitch degrees={degrees} onDegrees={setDegrees} />
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={clearAll}
              aria-label="Clear all calculations"
              title="Clear all"
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8]"
            >
              <Icon name="trash" size={15} />
            </button>
          </>
        }
      />
    </div>
  );
}
