"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { AlgebridgeCalculator } from "@/components/calc/AlgebridgeCalculator";
import { DesmosCalculator } from "@/components/DesmosCalculator";
import {
  getCalculatorAccess,
  getServerCalculatorAccess,
  setCalculatorOpen,
  setCalculatorRect,
  subscribeCalculatorAccess,
} from "@/lib/calculator-access";
import {
  DEFAULT_MODE,
  DEFAULT_SIZES,
  DESMOS_CREDIT_URL,
  DESMOS_MODES,
  MIN_SIZE,
  desmosApiKey,
  expandedSize,
  fitSize,
  readCalculatorSizes,
  saveCalculatorSizes,
  type CalculatorMode,
} from "@/lib/desmos";
import {
  keepOnScreen,
  readOffset,
  resizeFromBottomLeft,
  saveOffset,
  type Offset,
  type ResizeStart,
  type Size,
} from "@/lib/floating-panel";
import { getServerSidebarState, getSidebarState, subscribeSidebar } from "@/lib/sidebar";

/**
 * The calculator: a launcher in the bottom-right corner and a panel that can
 * be dragged, resized and expanded. It opens on Scientific, with Graphing one
 * tap away.
 *
 * With a Desmos API key the two calculators are Desmos's own. Without one
 * (production today) they are AlgeBridge's own (components/calc): an
 * expression list over a keypad, and graph paper beside a list, the way
 * students know calculators from class. Desmos is never framed: its terms
 * say so (lib/desmos.ts has the details).
 *
 * When the AI sidebar is docked open on the right, the launcher and the panel
 * rest beside it, never under it.
 */

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

/** Expand, and the way back, in the same line style as the Icon set. */
function ExpandMark({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {expanded ? (
        <>
          <path d="M14 5.5V10h4.5M14 10l6-6" />
          <path d="M10 18.5V14H5.5M10 14l-6 6" />
        </>
      ) : (
        <>
          <path d="M14 4h6v6M20 4l-6.5 6.5" />
          <path d="M10 20H4v-6M4 20l6.5-6.5" />
        </>
      )}
    </svg>
  );
}

const NUDGE_KEY = "algebridge-calculator-position";
const PANEL_ID = "algebridge-calculator";
/** How far one arrow key press on the resize corner grows or shrinks the panel. */
const KEY_STEP = 24;
/** Where the launcher and the panel rest, from the right of the space they have and from the bottom. */
const REST_RIGHT = 20;
const REST_BOTTOM = 96;
/**
 * The slide beside an opening or closing sidebar: the same length and curve
 * as the sidebar's own (helper.css), and none while the sidebar is being
 * resized or was already open on load (html[data-helper-resizing|still]).
 */
const SHIFT_MS = 300;
const SHIFT_MOTION =
  "motion-safe:transition-[right] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)] [html[data-helper-resizing]_&]:transition-none [html[data-helper-still]_&]:transition-none";
const PANEL_SHADOW = "shadow-[0_18px_50px_-12px_rgb(15_23_42/0.28)]";

/** Below this width the panel is a bottom sheet: no dragging, no corner. */
const PHONE_QUERY = "(max-width: 639.98px)";

/** Pages with no math on them. The calculator stays off these, so its button never covers a form or a policy. */
const NO_MATH_PATHS = new Set(["/login", "/privacy", "/terms", "/safety", "/guidelines"]);
function subscribePhone(fn: () => void) {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
const getPhone = () => window.matchMedia(PHONE_QUERY).matches;
const getServerPhone = () => false;

function subscribeWindowSize(fn: () => void) {
  window.addEventListener("resize", fn);
  return () => window.removeEventListener("resize", fn);
}
const getWidth = () => window.innerWidth;
const getHeight = () => window.innerHeight;
const getServerWidth = () => 1280;
const getServerHeight = () => 800;

export function Calculator() {
  const [open, setOpen] = useState(false);
  /**
   * The panel is made the first time it is opened (so nothing loads on a page
   * where nobody wants it) and then kept, hidden while closed, so a sum or a
   * graph is still there when the student comes back to it.
   */
  const [made, setMade] = useState(false);
  /** Read in the browser once mounted: in development it can come from localStorage. */
  const [apiKey, setApiKey] = useState<string | null>(null);
  /** Desmos would not load and the student asked for AlgeBridge's own calculators instead. */
  const [ownFallback, setOwnFallback] = useState(false);
  const desmos = !!apiKey && !ownFallback;
  /** Scientific on every fresh visit; a switch lasts until the page reloads. */
  const [mode, setModeState] = useState<CalculatorMode>(DEFAULT_MODE);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const [sizes, setSizes] = useState<Record<CalculatorMode, Size>>(DEFAULT_SIZES);
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  /**
   * Where the panel was dragged, as an offset from its resting corner. The
   * launcher button never moves with it: it used to travel with the panel,
   * and a short drag left it parked under the study helper's button.
   */
  const [nudge, setNudge] = useState<Offset>({ x: 0, y: 0 });
  const appliedRef = useRef(nudge);
  appliedRef.current = nudge;
  const dragRef = useRef<{ px: number; py: number; from: Offset; last: Offset } | null>(null);
  const resizeRef = useRef<{ px: number; py: number; start: ResizeStart } | null>(null);
  /** While dragging or resizing, a cover keeps the pointer off the calculator underneath. */
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  /** Whether typing goes to the calculator right now, which the panel shows. */
  const [hasKeys, setHasKeys] = useState(false);
  const isPhone = useSyncExternalStore(subscribePhone, getPhone, getServerPhone);
  const vw = useSyncExternalStore(subscribeWindowSize, getWidth, getServerWidth);
  const vh = useSyncExternalStore(subscribeWindowSize, getHeight, getServerHeight);

  // The AI sidebar, when docked open, takes the right edge. Everything here
  // rests that much further left and keeps out of it.
  const sidebar = useSyncExternalStore(subscribeSidebar, getSidebarState, getServerSidebarState);
  const shift = isPhone ? 0 : Math.max(0, Math.round(sidebar.width || 0));
  const area: Size = { width: Math.max(0, vw - shift), height: vh };
  const areaRef = useRef(area);
  areaRef.current = area;

  // Practice tells the calculator whether the skill is one it belongs on.
  // Anywhere with no opinion (null) keeps it, so it stays a general tool.
  const access = useSyncExternalStore(subscribeCalculatorAccess, getCalculatorAccess, getServerCalculatorAccess);
  const pathname = usePathname();
  const available = access !== false && !NO_MATH_PATHS.has(pathname ?? "");
  const shown = open && available;

  const size: Size = fitSize(expanded ? expandedSize(area, sizes[mode]) : sizes[mode], area);
  /** On a phone the panel is a sheet across the screen (inset-x-2), whatever size was saved. */
  const panelWidth = isPhone ? vw - 16 : size.width;

  useEffect(() => {
    const saved = readOffset(NUDGE_KEY);
    if (saved) setNudge(saved);
    setSizes(readCalculatorSizes());
    setApiKey(desmosApiKey());
  }, []);

  // A skill the calculator is not offered on closes it rather than leaving it
  // floating over an answer box it may not be used for. Availability is set
  // per skill, so this fires on moving to a different skill, never between
  // two problems of the same one.
  useEffect(() => {
    if (available) return;
    if (document.activeElement instanceof HTMLElement && panelRef.current?.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    setOpen(false);
  }, [available]);

  useEffect(() => {
    setCalculatorOpen(shown);
    return () => setCalculatorOpen(false);
  }, [shown]);

  useEffect(() => () => setCalculatorRect(null), []);

  const publish = useCallback(() => {
    const box = panelRef.current?.getBoundingClientRect();
    if (box) setCalculatorRect({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
  }, []);

  /** Pulls the panel fully into its space, e.g. a spot saved on a wider window. */
  const settle = useCallback(() => {
    // Expanded, it is placed to fit, from its own left and top.
    if (expandedRef.current) return;
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return;
    setNudge((n) => {
      const next = keepOnScreen(box, appliedRef.current, n, areaRef.current);
      return next.x === n.x && next.y === n.y ? n : next;
    });
  }, []);

  // On opening, and whenever it moves, changes size or the window or the
  // sidebar changes, check it is in its space and tell the study helper
  // where it is. After the sidebar opens or closes, the panel slides for
  // SHIFT_MS, so it is measured once it has arrived.
  const lastShift = useRef(shift);
  useLayoutEffect(() => {
    if (!shown) {
      // A slide while it was closed has finished by the time it opens.
      lastShift.current = shift;
      setCalculatorRect(null);
      return;
    }
    const check = () => {
      if (!getPhone()) settle();
      publish();
    };
    if (lastShift.current !== shift) {
      lastShift.current = shift;
      const timer = window.setTimeout(check, SHIFT_MS + 40);
      return () => window.clearTimeout(timer);
    }
    check();
  }, [shown, nudge, size.width, size.height, isPhone, shift, vw, vh, expanded, desmos, mode, settle, publish]);

  // Who has the keyboard. Worth showing, otherwise a student types into the
  // calculator and wonders why the answer box is empty.
  useEffect(() => {
    if (!shown) {
      setHasKeys(false);
      return;
    }
    const check = () => {
      const el = document.activeElement;
      setHasKeys(!!el && el !== document.body && !!bodyRef.current?.contains(el) && !el.closest("[inert]"));
    };
    const later = () => window.setTimeout(check, 0);
    window.addEventListener("blur", later);
    window.addEventListener("focus", check);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", later);
    check();
    return () => {
      window.removeEventListener("blur", later);
      window.removeEventListener("focus", check);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", later);
    };
  }, [shown]);

  /**
   * Takes the keyboard back from inside `area` (the panel, or just the
   * calculator part of it). Chrome on a Mac does not move focus to a button
   * that is clicked, so without this a student could close the calculator
   * and go on typing into it unseen.
   */
  const takeKeysBack = useCallback((el0: HTMLElement | null, toLauncher: boolean) => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !el0?.contains(el)) return false;
    if (toLauncher && launcherRef.current) launcherRef.current.focus();
    else el.blur();
    return true;
  }, []);

  const close = useCallback(
    (returnFocus: boolean) => {
      const moved = takeKeysBack(panelRef.current, true);
      if (returnFocus && !moved) launcherRef.current?.focus();
      setOpen(false);
    },
    [takeKeysBack]
  );

  const fallBackToOwn = useCallback(() => {
    takeKeysBack(bodyRef.current, false);
    setOwnFallback(true);
  }, [takeKeysBack]);

  /**
   * The two calculators are different sizes. The panel keeps its bottom-right
   * corner, so it never grows over its own launcher, and the switch, which
   * sits at the right of the top bar, stays almost under the pointer.
   */
  const setMode = useCallback(
    (next: CalculatorMode) => {
      if (next === mode) return;
      // The calculator being put away keeps no keyboard.
      takeKeysBack(bodyRef.current, false);
      setModeState(next);
    },
    [mode, takeKeysBack]
  );

  const toggleExpanded = useCallback(() => setExpanded((e) => !e), []);

  // --- Dragging the panel by its top bar ---------------------------------------

  const canDrag = !isPhone && !expanded;

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      // The buttons live inside this drag handle. Without this guard a press
      // on one starts a drag and calls setPointerCapture, which retargets the
      // pointer events to the handle so the button's click never fires.
      if (!canDrag || (e.target as HTMLElement).closest("button, a")) return;
      dragRef.current = { px: e.clientX, py: e.clientY, from: nudge, last: nudge };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setBusy(true);
    },
    [nudge, canDrag]
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const want = { x: d.from.x + (e.clientX - d.px), y: d.from.y + (e.clientY - d.py) };
    d.last = keepOnScreen(panelRef.current?.getBoundingClientRect(), appliedRef.current, want, areaRef.current);
    setNudge(d.last);
  }, []);

  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    setBusy(false);
    if (!d) return;
    dragRef.current = null;
    // The last spot moved to, which a quick release can beat the render to.
    saveOffset(NUDGE_KEY, d.last);
  }, []);

  // --- Resizing from the bottom-left corner --------------------------------------

  const measureStart = useCallback((): ResizeStart | null => {
    const box = panelRef.current?.getBoundingClientRect();
    if (!box) return null;
    // Expanded, the panel is placed from its left and top. Resizing it hands
    // it back to its resting corner, so the offset that puts it exactly where
    // it is now is worked out from there.
    const offset = expandedRef.current
      ? {
          x: Math.round(box.right - (areaRef.current.width - REST_RIGHT)),
          y: Math.round(box.bottom - (areaRef.current.height - REST_BOTTOM)),
        }
      : appliedRef.current;
    return {
      size: { width: box.width, height: box.height },
      offset,
      rect: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
    };
  }, []);

  const applyResize = useCallback(
    (start: ResizeStart, dx: number, dy: number) => {
      const next = resizeFromBottomLeft(start, dx, dy, MIN_SIZE, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setSizes((s) => {
        const updated = { ...s, [mode]: next.size };
        sizesRef.current = updated;
        return updated;
      });
      setNudge(next.offset);
      appliedRef.current = next.offset;
      setExpanded(false);
      return next;
    },
    [mode]
  );

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      const start = measureStart();
      if (!start) return;
      e.preventDefault();
      resizeRef.current = { px: e.clientX, py: e.clientY, start };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setBusy(true);
    },
    [measureStart]
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      applyResize(r.start, e.clientX - r.px, e.clientY - r.py);
    },
    [applyResize]
  );

  const onResizeEnd = useCallback(() => {
    setBusy(false);
    if (!resizeRef.current) return;
    resizeRef.current = null;
    saveCalculatorSizes(sizesRef.current);
    saveOffset(NUDGE_KEY, appliedRef.current);
  }, []);

  /** Arrow keys on the corner: left and down grow it, right and up shrink it. */
  const onResizeKey = useCallback(
    (e: React.KeyboardEvent) => {
      const step: Record<string, [number, number]> = {
        ArrowLeft: [-KEY_STEP, 0],
        ArrowRight: [KEY_STEP, 0],
        ArrowDown: [0, KEY_STEP],
        ArrowUp: [0, -KEY_STEP],
      };
      const move = step[e.key];
      const start = move && measureStart();
      if (!move || !start) return;
      e.preventDefault();
      const next = applyResize(start, move[0], move[1]);
      saveCalculatorSizes(sizesRef.current);
      saveOffset(NUDGE_KEY, next.offset);
    },
    [applyResize, measureStart]
  );

  /**
   * Keys typed in the calculator belong to it: the practice page's Enter and
   * 1-9 shortcuts, and the study helper's Escape, never see them. Escape
   * closes this panel only.
   */
  const onPanelKey = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        close(true);
      }
    },
    [close]
  );

  // --- Where the panel goes -------------------------------------------------------

  let placement = "";
  let style: React.CSSProperties | undefined;
  if (isPhone) {
    // A bottom sheet. AlgeBridge's graphing calculator stacks its graph over
    // its list and keypad, so it takes most of the screen.
    placement = expanded ? "inset-2" : !desmos && mode === "graphing" ? "inset-x-2 bottom-2 h-[86dvh]" : "inset-x-2 bottom-2 h-[62dvh]";
  } else if (expanded) {
    // Centred in the space it has, beside an open sidebar.
    style = {
      left: Math.round((area.width - size.width) / 2),
      top: Math.round((area.height - size.height) / 2),
      width: size.width,
      height: size.height,
    };
  } else {
    placement = SHIFT_MOTION;
    style = {
      right: REST_RIGHT + shift,
      bottom: REST_BOTTOM,
      width: size.width,
      height: size.height,
      transform: `translate(${nudge.x}px, ${nudge.y}px)`,
    };
  }

  return (
    <>
      {available && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            if (open) {
              close(false);
            } else {
              setMade(true);
              setOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.stopPropagation();
              close(false);
            }
          }}
          aria-label={open ? "Close calculator" : "Open calculator"}
          aria-expanded={open}
          aria-controls={made ? PANEL_ID : undefined}
          title="Calculator"
          // On a phone it stacks over Archie's button in one 48px column at the
          // right edge, instead of a second circle beside it. z-[35] keeps both
          // under the phone menu's scrim (the header is z-40).
          style={{ right: isPhone ? 16 : REST_RIGHT + shift }}
          className="fixed bottom-5 z-[35] flex h-14 w-14 items-center max-sm:bottom-[4.5rem] max-sm:h-12 max-sm:w-12 justify-center rounded-full bg-bridge-600 text-white shadow-lg transition-[right,background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-bridge-700 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 focus-visible:ring-offset-2 motion-reduce:transition-none [html[data-helper-resizing]_&]:transition-none [html[data-helper-still]_&]:transition-none"
        >
          {open ? <Icon name="close" size={22} /> : <OperatorMark />}
        </button>
      )}

      {made && (
        <div
          ref={panelRef}
          id={PANEL_ID}
          role="dialog"
          aria-label="Calculator"
          aria-hidden={!shown}
          inert={!shown}
          onKeyDown={onPanelKey}
          data-engine={desmos ? "desmos" : "algebridge"}
          data-expanded={expanded ? "true" : undefined}
          className={`fixed z-50 flex flex-col rounded-2xl border border-slate-200 bg-white ${PANEL_SHADOW} ${placement} ${
            shown ? "animate-fade-in" : "pointer-events-none invisible"
          }`}
          style={style}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className={`flex shrink-0 select-none items-center gap-2 py-2 pl-2.5 pr-2 ${
              canDrag ? "touch-none cursor-grab active:cursor-grabbing" : ""
            }`}
          >
            {canDrag && <Icon name="grip" size={14} className="shrink-0 text-slate-300" />}
            {/* The name only where it fits beside the switch and the buttons: at the smallest size it would push Close out of the panel. */}
            {!desmos && panelWidth >= 360 && (
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">Calculator</span>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <div role="group" aria-label="Kind of calculator" className="mr-1 flex rounded-lg bg-slate-100 p-0.5">
                {DESMOS_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={mode === m.id}
                    onClick={() => setMode(m.id)}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-400 ${
                      mode === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={toggleExpanded}
                aria-pressed={expanded}
                aria-label="Expand calculator"
                title={expanded ? "Back to the usual size" : "Expand"}
                className={`rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-400 ${
                  expanded ? "bg-bridge-50 text-bridge-700 hover:bg-bridge-100" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                }`}
              >
                <ExpandMark expanded={expanded} />
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                aria-label="Close calculator"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-400"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>

          {/* The ring says where typing goes: inside it, keys are the calculator's. */}
          <div
            ref={bodyRef}
            className={`relative mx-2 min-h-0 flex-1 overflow-hidden rounded-xl border bg-white transition-colors ${
              hasKeys ? "border-bridge-400 ring-2 ring-bridge-100" : "border-slate-200"
            }`}
          >
            {desmos && apiKey ? (
              <DesmosCalculator apiKey={apiKey} mode={mode} open={shown} onUseKeypad={fallBackToOwn} />
            ) : (
              <AlgebridgeCalculator mode={mode} open={shown} />
            )}
            {busy && <div aria-hidden className="absolute inset-0" />}
          </div>

          <div className={`flex h-8 shrink-0 items-center justify-between gap-2 pr-3 ${isPhone ? "pl-3" : "pl-7"}`}>
            {/* Short enough to sit beside the credit at the smallest size; the
                ring around the calculator shows where "here" is. */}
            <p aria-live="polite" className="truncate text-[11px] font-medium text-bridge-700">
              {hasKeys && (
                <>
                  <span aria-hidden>Typing goes here</span>
                  <span className="sr-only">Typing goes to the calculator</span>
                </>
              )}
            </p>
            {desmos && (
              <a
                href={DESMOS_CREDIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded text-[11px] font-medium text-slate-500 transition-colors hover:text-bridge-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-400"
              >
                Calculator by Desmos
                <Icon name="external" size={12} />
              </a>
            )}
          </div>

          {!isPhone && (
            <button
              type="button"
              aria-label="Resize calculator. Use the arrow keys to make it bigger or smaller."
              title="Drag to resize"
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onPointerCancel={onResizeEnd}
              onKeyDown={onResizeKey}
              className="group absolute bottom-0 left-0 h-6 w-6 cursor-nesw-resize touch-none rounded-bl-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-400"
            >
              <span
                aria-hidden
                className="absolute bottom-[7px] left-[7px] h-2.5 w-2.5 rounded-bl-[3px] border-b-2 border-l-2 border-slate-300 transition-colors group-hover:border-bridge-500"
              />
            </button>
          )}
        </div>
      )}
    </>
  );
}
