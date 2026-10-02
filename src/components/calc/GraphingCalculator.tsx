"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { AngleSwitch, Keypad } from "@/components/Keypad";
import { GraphCanvas, type GraphItem } from "@/components/calc/GraphCanvas";
import { MathField, MathText, MATH_FONT, type KeyAction, type MathFieldHandle } from "@/components/calc/MathField";
import { UndoClear, WarningMark } from "@/components/calc/ScientificCalculator";
import { readSaved, writeSaved } from "@/components/calc/saved";
import { evaluateGraph, formatTick, sliderText, type Plot } from "@/lib/calc-graph";

/**
 * AlgeBridge's graphing calculator: the list of expressions on the left
 * (each with a coloured circle that shows or hides it), graph paper on the
 * right. On a narrow panel the graph sits on top and the list under it.
 *
 * y = 2x + 3 draws a line, (2, 7) a point, y > 2x + 1 a shaded region,
 * 2x + 3y = 6 a line from standard form, and y = mx + b offers sliders for m
 * and b. The maths is lib/calc-graph.ts; the drawing is GraphCanvas.
 */

interface Row {
  id: number;
  text: string;
  hidden: boolean;
  /** Its colour (an index into GRAPH_COLORS) once it has had something to draw; −1 until then. */
  color: number;
}

/**
 * Six colours that read clearly on white and apart from each other. A row
 * gets one the first time it draws something, skipping colours already on
 * the graph, so two curves only share a colour past six; slider rows draw
 * nothing and take none.
 */
export const GRAPH_COLORS = ["#c8433a", "#2a6db5", "#2e8b48", "#6a48b2", "#df7020", "#1e252e"];

const SAVE_KEY = "algebridge-calc-graphing";

const COARSE = "(pointer: coarse)";
function subscribeCoarse(fn: () => void) {
  const mq = window.matchMedia(COARSE);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
const getCoarse = () => window.matchMedia(COARSE).matches;
const getServerCoarse = () => false;

export function GraphingCalculator({ active }: { active: boolean }) {
  const [rows, setRows] = useState<Row[]>([{ id: 1, text: "", hidden: false, color: -1 }]);
  const [current, setCurrent] = useState(0);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [degrees, setDegrees] = useState(false);
  const coarse = useSyncExternalStore(subscribeCoarse, getCoarse, getServerCoarse);
  /** On a touch screen the keypad is open from the start: a phone keyboard would cover the graph. */
  const [keypadChoice, setKeypadChoice] = useState<boolean | null>(null);
  const keypad = keypadChoice ?? coarse;
  const [narrow, setNarrow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** The rows Delete all took away, until the next edit. */
  const [cleared, setCleared] = useState<Row[] | null>(null);
  const nextId = useRef(2);
  const nextColor = useRef(0);
  const fields = useRef(new Map<number, MathFieldHandle>());
  const pendingFocus = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = readSaved(SAVE_KEY) as { rows?: unknown; degrees?: unknown } | null;
    if (Array.isArray(saved?.rows)) {
      const list = (saved.rows as unknown[])
        .filter((r): r is { text: string; hidden?: unknown; color?: unknown } => !!r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string")
        .slice(0, 100)
        .map((r, i) => ({
          id: nextId.current++,
          text: r.text.replace(/[\r\n]+/g, " ").slice(0, 400),
          hidden: r.hidden === true,
          color: Number.isInteger(r.color) && (r.color as number) >= 0 ? (r.color as number) % GRAPH_COLORS.length : -1,
        }));
      if (list.length) {
        const last = [...list].reverse().find((r) => r.color >= 0);
        if (last) nextColor.current = (last.color + 1) % GRAPH_COLORS.length;
        // A fresh row under the saved ones, so what is typed next is a new
        // expression instead of an edit to an old one.
        if (list[list.length - 1].text.trim()) list.push({ id: nextId.current++, text: "", hidden: false, color: -1 });
        setRows(list);
        setCurrent(list.length - 1);
      }
    }
    if (typeof saved?.degrees === "boolean") setDegrees(saved.degrees);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(
      () => writeSaved(SAVE_KEY, { rows: rows.map(({ id, text, hidden }) => ({ text, hidden, color: colors.current.get(id) ?? -1 })), degrees }),
      400
    );
    return () => window.clearTimeout(timer);
  }, [rows, degrees, loaded]);

  // Side by side when there is room, stacked when there is not.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 540));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const joined = rows.map((r) => r.text).join("\n");
  const ids = rows.map((r) => r.id).join(",");
  /**
   * The last plot of each row and what it depended on. A row whose
   * signature has not changed keeps its plot object, so the graph knows it
   * need not sample it again: moving the slider for m redraws y = mx + b and
   * leaves x² + y² < 9 alone.
   */
  const plots = useRef(new Map<number, { sig: string; plot: Plot }>());
  const results = useMemo(() => {
    const out = evaluateGraph(joined.split("\n"), degrees);
    const rowIds = ids.split(",").map(Number);
    const kept = new Map<number, { sig: string; plot: Plot }>();
    out.forEach((g, i) => {
      const id = rowIds[i];
      if (!g.plot || !g.sig || id === undefined) return;
      const before = plots.current.get(id);
      if (before && before.sig === g.sig) g.plot = before.plot;
      kept.set(id, { sig: g.sig, plot: g.plot });
    });
    plots.current = kept;
    return out;
  }, [joined, ids, degrees]);
  const at = Math.min(current, rows.length - 1);

  /**
   * Each row's colour, kept for good once given. A row is given one the
   * first time it draws something: the next in turn that no curve on the
   * graph is already using.
   */
  const colors = useRef(new Map<number, number>());
  const colorOf = useMemo(() => {
    const map = colors.current;
    rows.forEach((r) => {
      if (!map.has(r.id) && r.color >= 0) map.set(r.id, r.color);
    });
    rows.forEach((r, i) => {
      if (map.has(r.id) || !results[i]?.plot) return;
      const taken = new Set(rows.filter((q, k) => q.id !== r.id && !q.hidden && results[k]?.plot && map.has(q.id)).map((q) => map.get(q.id)));
      let pick = nextColor.current;
      for (let step = 0; step < GRAPH_COLORS.length && taken.has(pick); step += 1) pick = (pick + 1) % GRAPH_COLORS.length;
      map.set(r.id, pick);
      nextColor.current = (pick + 1) % GRAPH_COLORS.length;
    });
    return (id: number) => {
      const c = map.get(id);
      return c === undefined ? null : GRAPH_COLORS[c];
    };
  }, [rows, results]);

  const items = useMemo<GraphItem[]>(() => {
    const out: GraphItem[] = [];
    rows.forEach((r, i) => {
      const plot = results[i]?.plot;
      if (plot && !r.hidden) out.push({ row: i, plot, color: colorOf(r.id) ?? GRAPH_COLORS[0] });
    });
    return out;
  }, [rows, results, colorOf]);

  useEffect(() => {
    if (pendingFocus.current === null) return;
    const id = pendingFocus.current;
    pendingFocus.current = null;
    fields.current.get(id)?.focus("end");
  });

  // As in Scientific: the caret goes to the end of the current row once the saved rows are in.
  useEffect(() => {
    if (!active || !loaded) return;
    fields.current.get(rows[at]?.id)?.focus("end");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loaded]);

  const setText = useCallback((id: number, text: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, text } : r)));
    setCleared(null);
  }, []);

  const newRow = (text = ""): Row => {
    return { id: nextId.current++, text, hidden: false, color: -1 };
  };

  const focusRow = (i: number) => {
    const row = rows[i];
    if (!row) return;
    setCurrent(i);
    fields.current.get(row.id)?.focus("end");
  };

  const addRowAfter = (i: number) => {
    const row = newRow();
    setRows((rs) => [...rs.slice(0, i + 1), row, ...rs.slice(i + 1)]);
    setCurrent(i + 1);
    pendingFocus.current = row.id;
  };

  const addSliders = (i: number, names: string[]) => {
    const made = names.map((n) => newRow(`${n} = 1`));
    setRows((rs) => [...rs.slice(0, i + 1), ...made, ...rs.slice(i + 1)]);
  };

  const removeRow = (i: number, refocus: boolean) => {
    if (rows.length === 1) {
      setText(rows[0].id, "");
      if (refocus) fields.current.get(rows[0].id)?.focus(0);
      return;
    }
    const target = rows[i > 0 ? i - 1 : 1];
    setRows((rs) => rs.filter((_, k) => k !== i));
    setCurrent(i > 0 ? i - 1 : 0);
    setSelected(null);
    if (refocus) fields.current.get(target.id)?.focus("end");
  };

  const clearAll = () => {
    if (rows.some((r) => r.text.trim())) setCleared(rows);
    // A fresh start begins with the first colour again; rows brought back by Undo keep theirs.
    nextColor.current = 0;
    const row = newRow();
    setRows([row]);
    setCurrent(0);
    setSelected(null);
    pendingFocus.current = row.id;
  };

  const undoClear = () => {
    if (!cleared) return;
    setRows(cleared);
    setCurrent(cleared.length - 1);
    pendingFocus.current = cleared[cleared.length - 1].id;
    setCleared(null);
  };

  const onEnter = (i: number) => {
    if (!rows[i].text.trim()) return;
    if (i + 1 < rows.length && !rows[i + 1].text.trim()) focusRow(i + 1);
    else addRowAfter(i);
  };

  const onKey = (a: KeyAction) => {
    const field = fields.current.get(focusedId ?? rows[at]?.id);
    if (!field) return;
    if (!rootRef.current?.contains(document.activeElement)) field.focus();
    field.act(a);
  };

  const tool =
    "flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8]";

  const list = (
    <div className={`flex min-h-0 flex-col bg-white ${narrow ? "flex-1 border-t border-slate-200" : "w-[clamp(230px,38%,340px)] shrink-0 border-r border-slate-200"}`}>
      <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-[#e3e6ea] bg-[#f6f7f9] px-1.5">
        <button
          type="button"
          onClick={() => {
            const last = rows.length - 1;
            if (rows[last].text.trim()) addRowAfter(last);
            else focusRow(last);
          }}
          aria-label="Add an expression"
          title="Add an expression"
          className={tool}
        >
          <Icon name="plus" size={15} />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => setKeypadChoice(!keypad)}
          aria-pressed={keypad}
          aria-label={keypad ? "Hide the keypad" : "Show the keypad"}
          title={keypad ? "Hide the keypad" : "Show the keypad"}
          className={`${tool} ${keypad ? "bg-white text-slate-900 shadow-[0_1px_0_rgb(15_23_42/0.12)]" : ""}`}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="6" width="19" height="12" rx="2" />
            <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
          </svg>
        </button>
        <div className="ml-auto flex items-center gap-0.5">
          {cleared && <UndoClear onUndo={undoClear} what="expressions" />}
          <button type="button" onClick={clearAll} aria-label="Delete all expressions" title="Delete all" className={tool}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
      <div role="list" aria-label="Expressions" data-scroll-list="" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {rows.map((row, i) => {
          const g = results[i];
          // Slider rows draw nothing and have no colour of their own: their slider takes the keypad's blue.
          const color = colorOf(row.id) ?? "#2f6bd8";
          const isCurrent = i === at;
          const focused = focusedId === row.id;
          const showError = !!g?.error && !g.missing.length && !(g.incomplete && (focused || !row.text.trim()));
          return (
            <div key={row.id} role="listitem" className="group relative flex shrink-0 border-b border-[#e3e6ea]">
              <div
                className={`flex w-[40px] shrink-0 select-none flex-col items-center gap-1 pt-[5px] transition-colors ${
                  isCurrent ? "bg-[#e6eefc]" : "bg-[#f6f7f9]"
                }`}
              >
                <span aria-hidden className={`text-[10px] leading-none tabular-nums ${isCurrent ? "font-semibold text-[#2f6bd8]" : "text-slate-400"}`}>
                  {i + 1}
                </span>
                {g?.plot && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, hidden: !r.hidden } : r)))}
                    aria-pressed={!row.hidden}
                    aria-label={row.hidden ? `Show expression ${i + 1} on the graph` : `Hide expression ${i + 1} from the graph`}
                    title={row.hidden ? "Show on the graph" : "Hide from the graph"}
                    className="h-[22px] w-[22px] rounded-full border-[2.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8] focus-visible:ring-offset-1"
                    style={{ borderColor: color, background: row.hidden ? "#ffffff" : color }}
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 py-[5px] pl-2.5 pr-7">
                <MathField
                  handle={(h) => {
                    if (h) fields.current.set(row.id, h);
                    else fields.current.delete(row.id);
                  }}
                  value={row.text}
                  onChange={(text) => setText(row.id, text)}
                  flavor="graphing"
                  label={`Expression ${i + 1}`}
                  inputMode={keypad ? "none" : "text"}
                  placeholder={rows.length === 1 && i === 0 ? "Try y = 2x + 3" : undefined}
                  onEnter={() => onEnter(i)}
                  onLeave={(dir) => focusRow(dir === "up" ? i - 1 : i + 1)}
                  onBackspaceEmpty={() => {
                    if (rows.length > 1) removeRow(i, true);
                  }}
                  onUndoEmpty={cleared ? undoClear : undefined}
                  onFocus={() => {
                    setCurrent(i);
                    setFocusedId(row.id);
                    setSelected(i);
                  }}
                  onBlur={() => setFocusedId((f) => (f === row.id ? null : f))}
                  className="min-w-0 max-w-full flex-auto text-[20px] leading-[1.75]"
                />
                {g?.value && (
                  <div className="ml-auto shrink-0 text-[17px] leading-[1.6] text-slate-500">
                    <span className="mr-1">=</span>
                    <MathText text={g.value} flavor="graphing" />
                  </div>
                )}
                {g?.slider && (
                  <div className="flex basis-full items-center gap-2 pb-1 text-[11px] tabular-nums text-slate-400">
                    <span>{formatTick(g.slider.min, 1)}</span>
                    <input
                      type="range"
                      min={g.slider.min}
                      max={g.slider.max}
                      step={g.slider.step}
                      value={g.slider.value}
                      onChange={(e) => {
                        const s = g.slider!;
                        setText(row.id, sliderText(s.name, Number(e.target.value), s.step));
                      }}
                      aria-label={`Slider for ${g.slider.name}`}
                      className="h-5 min-w-0 flex-1 cursor-pointer"
                      style={{ accentColor: color }}
                    />
                    <span>{formatTick(g.slider.max, 1)}</span>
                  </div>
                )}
                {g && g.missing.length > 0 && (
                  <div className="flex basis-full flex-wrap items-center gap-1.5 pb-1 text-[12px] text-slate-500">
                    <span>add slider:</span>
                    {g.missing.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => addSliders(i, [m])}
                        aria-label={`Add a slider for ${m}`}
                        className={`rounded-md border border-slate-300 bg-white px-2 py-px text-[15px] italic text-slate-700 transition-colors hover:border-[#2f6bd8] hover:text-[#2f6bd8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8] ${MATH_FONT}`}
                      >
                        {m}
                      </button>
                    ))}
                    {g.missing.length > 1 && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() => addSliders(i, g.missing)}
                        aria-label="Add a slider for each"
                        className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[12px] font-semibold text-slate-600 transition-colors hover:border-[#2f6bd8] hover:text-[#2f6bd8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8]"
                      >
                        all
                      </button>
                    )}
                  </div>
                )}
                {showError && (
                  <p className={`basis-full pb-1 text-[12px] leading-snug ${g!.incomplete ? "text-slate-400" : "text-[#a85a12]"}`}>
                    {!g!.incomplete && <WarningMark />}
                    {g!.error}
                  </p>
                )}
              </div>
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => removeRow(i, false)}
                // One delete button in the Tab order, the current row's, not one per row.
                tabIndex={isCurrent ? 0 : -1}
                aria-label={`Delete expression ${i + 1}`}
                title="Delete"
                className={`absolute right-0.5 top-[8px] rounded-md p-1 text-slate-400 transition-opacity hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#2f6bd8] ${
                  isCurrent && row.text ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          );
        })}
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
    </div>
  );

  return (
    <div ref={rootRef} role="region" aria-label="Graphing calculator" className="flex h-full flex-col bg-white [container-type:size]">
      <div className={`flex min-h-0 flex-1 ${narrow ? "flex-col-reverse" : "flex-row"}`}>
        {list}
        <div className={`relative ${narrow ? "h-[50%] shrink-0" : "min-w-0 flex-1"}`}>
          <GraphCanvas
            items={items}
            selected={selected}
            onSelect={(row) => {
              setSelected(row);
              if (row !== null) setCurrent(row);
            }}
          />
        </div>
      </div>
      {keypad && (
        <Keypad
          flavor="graphing"
          onKey={onKey}
          extra={
            <>
              <AngleSwitch degrees={degrees} onDegrees={setDegrees} />
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setKeypadChoice(false)}
                aria-label="Hide the keypad"
                title="Hide the keypad"
                className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bd8]"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
