"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  backspace,
  caretStops,
  charKinds,
  cut,
  deleteForward,
  insertText,
  layoutTree,
  parseRow,
  stepCaret,
  type CharKind,
  type EditState,
  type LayoutItem,
  type ParsedRow,
} from "@/lib/calc-engine";

/**
 * One row of math: typed as text, drawn the way a math book prints it.
 *
 * The text lives in a real <input> that is kept out of sight, so focus,
 * copy, paste, screen readers and phone keyboards all work the usual way.
 * What a student sees is the same text drawn with x² raised, √ with its bar
 * and log₂ lowered, and a caret placed by measuring the drawn characters.
 * Edits go through lib/calc-engine.ts (insertText, backspace, stepCaret), the
 * same rules the on-screen keypad uses.
 *
 * Nothing here animates: the caret is drawn once per change and holds still.
 */

/** What the keypad asks a row to do. */
export type KeyAction =
  | { t: "insert"; text: string; caret?: number }
  | { t: "left" }
  | { t: "right" }
  | { t: "back" }
  | { t: "enter" };

export interface MathFieldHandle {
  focus(at?: number | "end"): void;
  act(a: KeyAction): void;
}

export type Flavor = "scientific" | "graphing";

/** A book face for math, as calculators and textbooks use: variables in italic. */
export const MATH_FONT = "[font-family:'Times_New_Roman',Times,'Liberation_Serif',Tinos,serif]";

const KIND_CLASS: Record<CharKind, string> = {
  num: "",
  var: "italic",
  const: "",
  fn: "mr-[0.06em]",
  op: "mx-[0.24em]",
  word: "",
  sign: "",
  rel: "mx-[0.3em]",
  paren: "",
  punct: "mr-[0.25em]",
  space: "",
  bad: "text-red-600",
};

const GROUP_CLASS = {
  sup: "align-[0.62em] text-[0.7em]",
  sub: "align-[-0.32em] text-[0.7em]",
  idx: "mr-[-0.45em] align-[0.95em] text-[0.55em]",
  rad: "ml-[0.02em] inline-block border-t-[0.065em] border-current pl-[0.06em] pr-[0.08em] pt-[0.04em] leading-[1.15]",
  // A stacked fraction: the bar is the top border of the denominator, as wide as the wider part.
  frac: "mx-[0.1em] inline-flex flex-col items-stretch text-center align-middle",
  num: "px-[0.12em] pb-[0.04em] text-[0.88em] leading-[1.12]",
  den: "border-t-[0.07em] border-current px-[0.12em] pt-[0.06em] text-[0.88em] leading-[1.12]",
} as const;

function glyph(ch: string, kind: CharKind, flavor: Flavor): string {
  if (kind === "op" || kind === "sign") {
    if (ch === "*" || ch === "×" || ch === "·" || ch === "⋅" || ch === "∙") return flavor === "scientific" ? "×" : "·";
    if (ch === "-" || ch === "–") return "−";
    if (ch === "/") return flavor === "scientific" ? "÷" : "/";
  }
  return ch;
}

interface DrawContext {
  p: ParsedRow;
  kinds: CharKind[];
  flavor: Flavor;
  selFrom: number;
  selTo: number;
  /** Closing brackets the calculator put in, drawn pale until they are typed over or passed. */
  ghost?: ReadonlySet<number>;
}

/** Scientific reads 5,280 as one number, drawn tight; in Graphing a comma separates points. */
const readingOf = (flavor: Flavor) => (flavor === "scientific" ? SCIENTIFIC_READING : GRAPHING_READING);
const SCIENTIFIC_READING = { thousands: true };
const GRAPHING_READING = {};

const hasFrac = (it: LayoutItem): boolean => it.t === "grp" && (it.g.t === "frac" || it.items.some(hasFrac));

function draw(items: LayoutItem[], c: DrawContext): ReactNode[] {
  const out: ReactNode[] = [];
  for (let n = 0; n < items.length; n += 1) {
    const it = items[n];
    const next = items[n + 1];
    // A radical over a fraction: the √ glyph is only one line tall, so it is
    // drawn as a line that stretches to the radicand's full height and meets its bar.
    if (it.t === "ch" && c.p.layout.sign.has(it.i) && next?.t === "grp" && next.g.t === "rad" && hasFrac(next)) {
      const selected = it.i >= c.selFrom && it.i < c.selTo ? " bg-[#b6d4fe]" : "";
      out.push(
        <span key={`tall${it.i}`} className="inline-flex items-stretch align-middle">
          <span data-i={it.i} className={`relative w-[0.62em] shrink-0${selected}`}>
            <svg viewBox="0 0 12 30" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
              <path d="M0.6 17.5 2.8 16.2 6.6 29.2 12 0.5" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </span>
          {drawOne(next, c)}
        </span>
      );
      n += 1;
      continue;
    }
    out.push(drawOne(it, c));
  }
  return out;
}

function drawOne(it: LayoutItem, c: DrawContext): ReactNode {
  if (it.t === "ch") {
    const i = it.i;
    const kind = c.kinds[i];
    // A space between two numbers ("5 280") is shown, since the row says
    // to take it out. Every other space takes no room, as in a math book.
    if (kind === "space" && /\d/.test(c.p.text[i - 1] ?? "") && /^ *\d/.test(c.p.text.slice(i + 1))) {
      return <span key={i} data-i={i} className="inline-block h-[1em] w-[0.32em]" />;
    }
    if (c.p.layout.hidden.has(i) || kind === "space") return <span key={i} data-i={i} data-h="" className="inline-block h-[1em] w-0" />;
    const selected = i >= c.selFrom && i < c.selTo ? " bg-[#b6d4fe]" : "";
    if (c.p.layout.sign.has(i)) {
      return (
        <span key={i} data-i={i} className={`inline-block scale-y-[1.12] not-italic${selected}`}>
          √
        </span>
      );
    }
    let cls = KIND_CLASS[kind];
    // "of" in 20% of 50: a word with a space either side.
    if (kind === "word") cls = `${c.kinds[i - 1] === "word" ? "" : "ml-[0.1em]"} ${c.kinds[i + 1] === "word" ? "" : "mr-[0.26em]"}`;
    if (c.ghost?.has(i)) cls += " text-slate-300";
    return (
      <span key={i} data-i={i} className={`${cls}${selected}`}>
        {glyph(c.p.text[i], kind, c.flavor)}
      </span>
    );
  }
  const g = it.g;
  if (g.t === "frac") {
    // Only the two parts are stacked. What sits between them (the hidden /,
    // spaces, a numerator's hidden closing bracket) rides at the end of the
    // numerator, and anything after the denominator at its end, so the
    // caret still has a place for every position.
    const num = it.items.findIndex((x) => x.t === "grp" && x.g.t === "num");
    const den = it.items.findIndex((x) => x.t === "grp" && x.g.t === "den");
    if (num >= 0 && den > num) {
      const n = it.items[num] as Extract<LayoutItem, { t: "grp" }>;
      const d = it.items[den] as Extract<LayoutItem, { t: "grp" }>;
      const parts: LayoutItem[] = [
        { ...n, items: [...it.items.slice(0, num), ...n.items, ...it.items.slice(num + 1, den)] },
        { ...d, items: [...d.items, ...it.items.slice(den + 1)] },
      ];
      return (
        <span key={`frac${g.s}`} className={GROUP_CLASS.frac}>
          {draw(parts, c)}
        </span>
      );
    }
  }
  // Where a click on an empty box puts the caret: inside its brackets.
  const inside = c.p.layout.hidden.has(g.s) && /[([]/.test(c.p.text[g.s] ?? "") ? g.s + 1 : g.s;
  return (
    <span key={`${g.t}${g.s}`} className={GROUP_CLASS[g.t]}>
      {draw(it.items, c)}
      {it.empty && g.t !== "frac" && (
        <span
          data-ph=""
          data-ps={g.s}
          data-pe={g.e}
          data-pk={inside}
          className="mx-[0.06em] inline-block h-[0.82em] w-[0.6em] rounded-[2px] border border-dashed border-slate-400 align-[-0.08em]"
        />
      )}
    </span>
  );
}

/** Math drawn from text, with no editing: results, and rows that are not being edited. */
export function MathText({ text, flavor, className = "" }: { text: string; flavor: Flavor; className?: string }) {
  const p = useMemo(() => parseRow(text, readingOf(flavor)), [text, flavor]);
  const body = useMemo(
    () => draw(layoutTree(text.length, p.layout), { p, kinds: charKinds(p), flavor, selFrom: 0, selTo: 0 }),
    [p, text, flavor]
  );
  return <span className={`whitespace-nowrap ${MATH_FONT} ${className}`}>{body}</span>;
}

const MAX_CHARS = 400;

/**
 * Where positions in `a` are after `a` was edited into `b`: before the
 * edit they stay, after it they shift by the change in length, inside it
 * they are gone.
 */
function remap(list: readonly number[], a: string, b: string): number[] {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q += 1;
  return list.flatMap((k) => (k < p ? [k] : k >= a.length - q ? [k + b.length - a.length] : []));
}

/** The closing bracket an insertion added just after the caret ("(" made "()", the sin key made "sin()"), if any. */
function addedCloser(cur: EditState, next: EditState): number | undefined {
  const lo = Math.min(cur.start, cur.end);
  const added = next.text.length - (cur.text.length - (Math.max(cur.start, cur.end) - lo));
  const k = next.end;
  return added > 0 && next.start === k && k < lo + added && /[)\]]/.test(next.text[k] ?? "") ? k : undefined;
}

/**
 * Scrolls the list a row sits in (marked data-scroll-list) just enough to
 * show the whole row, results and slider included. Only the list moves,
 * never the page under the floating panel.
 */
function revealRow(el: HTMLElement | null) {
  const list = el?.closest<HTMLElement>("[data-scroll-list]");
  if (!el || !list) return;
  const row = el.closest<HTMLElement>("[role=listitem]") ?? el;
  const r = row.getBoundingClientRect();
  const l = list.getBoundingClientRect();
  if (r.top < l.top) list.scrollTop -= l.top - r.top;
  else if (r.bottom > l.bottom) list.scrollTop += Math.min(r.bottom - l.bottom, r.top - l.top);
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  flavor: Flavor;
  label: string;
  /**
   * "none" when the on-screen keypad is showing, so a phone does not open its
   * own keyboard over it; "decimal" for an answer box, where the phone's
   * number pad is the quickest.
   */
  inputMode: "none" | "text" | "decimal";
  /** Marks the row as the place a dialog puts the focus when it opens (see useDialogFocus). */
  autoFocus?: boolean;
  placeholder?: string;
  /** An operator typed on an empty row works on the answer above (Scientific). */
  ansFirst?: boolean;
  onEnter?: () => void;
  onLeave?: (dir: "up" | "down") => void;
  onBackspaceEmpty?: () => void;
  /** Undo with nothing left to undo in this row (a row made by Clear all): the calculator's own undo. */
  onUndoEmpty?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  handle?: Ref<MathFieldHandle>;
  className?: string;
}

export function MathField({
  value,
  onChange,
  flavor,
  label,
  inputMode,
  placeholder,
  ansFirst,
  onEnter,
  onLeave,
  onBackspaceEmpty,
  onUndoEmpty,
  onFocus,
  onBlur,
  handle,
  className = "",
  autoFocus = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const [sel, setSel] = useState({ start: value.length, end: value.length });
  const [focused, setFocused] = useState(false);
  /** Brackets put in by the calculator and not yet typed over or passed (see remap). */
  const [ghost, setGhost] = useState<readonly number[]>([]);
  const ghostRef = useRef(ghost);
  const n = value.length;
  const st: EditState = { text: value, start: Math.min(sel.start, n), end: Math.min(sel.end, n) };
  const stRef = useRef(st);
  stRef.current = st;
  const undoRef = useRef<EditState[]>([]);
  const redoRef = useRef<EditState[]>([]);
  const dragRef = useRef<number | null>(null);

  // The latest handlers, for listeners attached once.
  const live = useRef({ onChange, onEnter, onBackspaceEmpty, onUndoEmpty, ansFirst });
  live.current = { onChange, onEnter, onBackspaceEmpty, onUndoEmpty, ansFirst };

  const how = readingOf(flavor);
  const p = useMemo(() => parseRow(value, how), [value, how]);
  const kinds = useMemo(() => charKinds(p), [p]);
  const tree = useMemo(() => layoutTree(value.length, p.layout), [p, value]);
  const selFrom = Math.min(st.start, st.end);
  const selTo = Math.max(st.start, st.end);
  const ghostSet = useMemo(() => new Set(ghost), [ghost]);
  const body = useMemo(
    () => draw(tree, { p, kinds, flavor, selFrom, selTo, ghost: ghostSet }),
    [tree, p, kinds, flavor, selFrom, selTo, ghostSet]
  );

  const commit = useCallback((next: EditState, record = true, closer?: number) => {
    const cur = stRef.current;
    const text = next.text.slice(0, MAX_CHARS);
    const clamp = (k: number) => Math.max(0, Math.min(k, text.length));
    const fixed = { text, start: clamp(next.start), end: clamp(next.end) };
    // A pale bracket turns solid once the caret is past it (typing ")" over it steps past it).
    const kept = remap(ghostRef.current, cur.text, text).filter((k) => /[)\]]/.test(text[k] ?? "") && fixed.end <= k);
    if (closer !== undefined && closer < text.length) kept.push(closer);
    if (kept.length !== ghostRef.current.length || kept.some((k, i) => k !== ghostRef.current[i])) {
      ghostRef.current = kept;
      setGhost(kept);
    }
    if (text !== cur.text) {
      if (record) {
        undoRef.current.push(cur);
        if (undoRef.current.length > 100) undoRef.current.shift();
        redoRef.current = [];
      }
      live.current.onChange(text);
    }
    stRef.current = fixed;
    setSel({ start: fixed.start, end: fixed.end });
  }, []);

  /** Typing or a key: the same edit either way, and a bracket it closes by itself is drawn pale. */
  const insert = useCallback(
    (raw: string, caret?: number) => {
      const cur = stRef.current;
      const next = insertText(cur, raw, { caret, ansFirst: live.current.ansFirst });
      commit(next, true, addedCloser(cur, next));
    },
    [commit]
  );

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) {
      live.current.onUndoEmpty?.();
      return;
    }
    redoRef.current.push(stRef.current);
    commit(prev, false);
  }, [commit]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(stRef.current);
    commit(next, false);
  }, [commit]);

  /** Where the caret is drawn for position k, in the view's own coordinates. */
  const anchor = useCallback(
    (k: number): { x: number; top: number; h: number } | null => {
      const view = viewRef.current;
      if (!view) return null;
      const base = view.getBoundingClientRect();
      const at = (el: Element | null, side: "l" | "r", inset = 0) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: (side === "l" ? r.left + inset : r.right) - base.left, top: r.top - base.top, h: r.height };
      };
      const ch = (i: number) => view.querySelector(`[data-i="${i}"]`);
      const shown = (el: Element | null) => !!el && !el.hasAttribute("data-h");
      // Inside an empty box.
      const boxes = [...view.querySelectorAll<HTMLElement>("[data-ph]")].filter(
        (b) => Number(b.dataset.ps) <= k && k <= Number(b.dataset.pe)
      );
      if (boxes.length) return at(boxes[boxes.length - 1], "l", 2);
      // At the end of a raised "x^2": still inside it, since the next digit goes there.
      const run = p.layout.groups.find((g) => g.run && g.e === k && g.s < g.e);
      if (run && shown(ch(k - 1))) return at(ch(k - 1), "r");
      if (shown(ch(k))) {
        // An italic letter leans left over its own box and a bracket's curve
        // sits at its edge: the caret stands a hair to the left so it does not
        // cut through them ("+1|y", "sin(30|)").
        const a = at(ch(k), "l");
        const nudge = kinds[k] === "var" ? Math.max(1, (a?.h ?? 0) * 0.07) : kinds[k] === "paren" ? 0.5 : 0;
        return a && { ...a, x: a.x - nudge };
      }
      if (shown(ch(k - 1))) return at(ch(k - 1), "r");
      if (ch(k)) return at(ch(k), "l");
      if (ch(k - 1)) return at(ch(k - 1), "r");
      return at(view.querySelector("[data-strut]"), "l");
    },
    [p, kinds]
  );

  /** The caret position nearest a pointer. */
  const indexAt = useCallback(
    (clientX: number, clientY: number): number => {
      const view = viewRef.current;
      if (!view) return n;
      let best = n;
      let bestD = Infinity;
      const consider = (x: number, k: number, r: DOMRect) => {
        const dy = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
        const d = Math.abs(clientX - x) + dy * 0.5;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      };
      view.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => {
        const i = Number(el.dataset.i);
        const r = el.getBoundingClientRect();
        if (!el.hasAttribute("data-h")) {
          consider(r.left, i, r);
          consider(r.right, i + 1, r);
        } else if (/[)\]]/.test(value[i] ?? "")) {
          // Just past a group's hidden closing bracket: outside the group.
          consider(r.left + 0.01, i + 1, r);
        }
      });
      view.querySelectorAll<HTMLElement>("[data-ph]").forEach((el) => {
        const r = el.getBoundingClientRect();
        consider((r.left + r.right) / 2, Number(el.dataset.pk), r);
      });
      const stops = caretStops(value);
      while (best > 0 && !stops[best]) best -= 1;
      return best;
    },
    [n, value]
  );

  const move = useCallback(
    (dir: -1 | 1, extend: boolean) => {
      const cur = stRef.current;
      let next = stepCaret(cur, dir, extend, how);
      // Positions that are drawn in the same place (either side of a hidden
      // bracket) are passed over, so every press visibly moves the caret.
      if (!extend && next.text === cur.text) {
        const from = anchor(cur.end);
        for (let tries = 0; tries < 4 && from; tries += 1) {
          const to = anchor(next.end);
          if (!to || Math.abs(to.x - from.x) > 0.5 || Math.abs(to.top - from.top) > 0.5) break;
          const again = stepCaret(next, dir, false, how);
          if (again.end === next.end) break;
          next = again;
          if (again.text !== cur.text) break;
        }
      }
      commit(next, next.text !== cur.text);
    },
    [anchor, commit, how]
  );

  const pressBackspace = useCallback(() => {
    const cur = stRef.current;
    if (!cur.text && live.current.onBackspaceEmpty) live.current.onBackspaceEmpty();
    else commit(backspace(cur, how));
  }, [commit, how]);

  const paste = useCallback(
    (raw: string) => {
      const cur = stRef.current;
      const clean = raw.replace(/[\r\n\t]+/g, " ");
      const a = Math.min(cur.start, cur.end);
      const b = Math.max(cur.start, cur.end);
      commit({ text: cur.text.slice(0, a) + clean + cur.text.slice(b), start: a + clean.length, end: a + clean.length });
    },
    [commit]
  );

  useImperativeHandle(
    handle,
    () => ({
      focus(at) {
        const el = inputRef.current;
        if (!el) return;
        if (at !== undefined) {
          const k = at === "end" ? stRef.current.text.length : at;
          stRef.current = { ...stRef.current, start: k, end: k };
          setSel({ start: k, end: k });
        }
        el.focus({ preventScroll: true });
      },
      act(a) {
        switch (a.t) {
          case "insert":
            insert(a.text, a.caret);
            break;
          case "left":
            move(-1, false);
            break;
          case "right":
            move(1, false);
            break;
          case "back":
            pressBackspace();
            break;
          case "enter":
            live.current.onEnter?.();
            break;
        }
      },
    }),
    [commit, insert, move, pressBackspace]
  );

  // Edits that do not come as key presses: phone keyboards, paste, cut,
  // undo from the Edit menu. All go through the same rules.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onBeforeInput = (ev: InputEvent) => {
      const cur = stRef.current;
      switch (ev.inputType) {
        case "insertText":
        case "insertReplacementText": {
          const data = ev.data ?? ev.dataTransfer?.getData("text/plain");
          if (data == null) return;
          ev.preventDefault();
          if (data.length === 1) insert(data);
          else paste(data);
          return;
        }
        case "insertFromPaste":
        case "insertFromDrop": {
          const data = ev.dataTransfer?.getData("text/plain") ?? ev.data;
          if (data == null) return;
          ev.preventDefault();
          paste(data);
          return;
        }
        case "deleteContentBackward":
        case "deleteWordBackward":
        case "deleteSoftLineBackward":
          ev.preventDefault();
          pressBackspace();
          return;
        case "deleteContentForward":
        case "deleteWordForward":
          ev.preventDefault();
          commit(deleteForward(cur));
          return;
        case "deleteByCut":
          ev.preventDefault();
          commit(cut(cur));
          return;
        case "historyUndo":
          ev.preventDefault();
          undo();
          return;
        case "historyRedo":
          ev.preventDefault();
          redo();
          return;
        case "insertLineBreak":
        case "insertParagraph":
          ev.preventDefault();
          live.current.onEnter?.();
          return;
      }
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, [commit, insert, paste, pressBackspace, undo, redo]);

  // The hidden input's own selection follows ours, so copy copies what is highlighted.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el || document.activeElement !== el) return;
    const a = Math.min(st.start, st.end);
    const b = Math.max(st.start, st.end);
    if (el.selectionStart !== a || el.selectionEnd !== b) {
      try {
        el.setSelectionRange(a, b, st.start > st.end ? "backward" : "forward");
      } catch {
        /* an input that is not in the page yet */
      }
    }
  });

  // The caret: placed after each change, never animated. A long row scrolls to keep it in sight.
  useLayoutEffect(() => {
    const caret = caretRef.current;
    if (!caret) return;
    if (focused) revealRow(rootRef.current);
    if (!focused || st.start !== st.end) {
      caret.style.display = "none";
      return;
    }
    const a = anchor(st.end);
    if (!a) {
      caret.style.display = "none";
      return;
    }
    caret.style.display = "block";
    caret.style.transform = `translate(${Math.round(a.x * 2) / 2}px, ${Math.round(a.top)}px)`;
    caret.style.height = `${Math.max(12, Math.round(a.h))}px`;
    const scroller = scrollerRef.current;
    if (scroller) {
      const pad = 12;
      if (a.x - scroller.scrollLeft > scroller.clientWidth - pad) scroller.scrollLeft = a.x - scroller.clientWidth + pad;
      else if (a.x - scroller.scrollLeft < pad) scroller.scrollLeft = Math.max(0, a.x - pad);
    }
  }, [focused, st.start, st.end, body, anchor]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key;
    const cur = stRef.current;
    switch (k) {
      case "Enter":
        e.preventDefault();
        onEnter?.();
        return;
      case "ArrowUp":
      case "ArrowDown":
        if (onLeave) {
          e.preventDefault();
          onLeave(k === "ArrowUp" ? "up" : "down");
        }
        return;
      case "ArrowLeft":
      case "ArrowRight":
        e.preventDefault();
        move(k === "ArrowLeft" ? -1 : 1, e.shiftKey);
        return;
      case "Home":
      case "End": {
        e.preventDefault();
        const to = k === "Home" ? 0 : cur.text.length;
        commit({ text: cur.text, start: e.shiftKey ? cur.start : to, end: to }, false);
        return;
      }
      case "Backspace":
        e.preventDefault();
        pressBackspace();
        return;
      case "Delete":
        e.preventDefault();
        commit(deleteForward(cur));
        return;
    }
    if (mod && k.toLowerCase() === "a") {
      e.preventDefault();
      commit({ text: cur.text, start: 0, end: cur.text.length }, false);
      return;
    }
    if (mod && k.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && k.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    // Copy, cut and paste stay the browser's: the input's selection matches ours.
    if (mod) return;
    if (k.length === 1) {
      e.preventDefault();
      insert(k);
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const k = indexAt(e.clientX, e.clientY);
    const anchorAt = e.shiftKey && focused ? stRef.current.start : k;
    dragRef.current = anchorAt;
    commit({ text: value, start: anchorAt, end: k }, false);
    inputRef.current?.focus({ preventScroll: true });
    if (e.pointerType === "mouse") e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current === null || !(e.buttons & 1)) return;
    const k = indexAt(e.clientX, e.clientY);
    if (k !== stRef.current.end) commit({ text: value, start: dragRef.current, end: k }, false);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={rootRef}
      className={`relative cursor-text ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          // Only edits the rules above did not take reach here.
          const el = e.currentTarget;
          commit({ text: el.value, start: el.selectionStart ?? el.value.length, end: el.selectionEnd ?? el.value.length });
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setFocused(false);
          // Leaving the row settles its brackets.
          ghostRef.current = [];
          setGhost([]);
          onBlur?.();
        }}
        aria-label={label}
        // Both: data-autofocus is what a dialog focuses when it opens, and
        // autoFocus covers a box that mounts later in the same dialog (a
        // two-player steal swaps in a fresh box for the other player).
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? "" : undefined}
        inputMode={inputMode}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="enter"
        className="pointer-events-none absolute inset-0 h-full w-full text-[16px] opacity-0"
        tabIndex={0}
      />
      <div ref={scrollerRef} aria-hidden className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div ref={viewRef} className={`relative inline-block min-w-full whitespace-nowrap pr-1 ${MATH_FONT}`}>
          <span data-strut className="inline-block h-[1em] w-0" />
          {body}
          {!value && placeholder && <span className="ml-0.5 font-sans text-[0.72em] text-slate-400">{placeholder}</span>}
          <span ref={caretRef} className="pointer-events-none absolute left-0 top-0 hidden w-[1.5px] bg-slate-900" />
        </div>
      </div>
    </div>
  );
}
