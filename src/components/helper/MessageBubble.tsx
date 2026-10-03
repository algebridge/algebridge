"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Icon } from "@/components/Icon";
import { MathText } from "@/components/PromptText";
import { reactionSnippet, type ReactionId } from "@/lib/archie-reactions";
import { FormulaText } from "./FormulaText";
import { HelperAvatar } from "./HelperAvatar";
import { ArchieReactionPill, ReactionBar, ReactionPill } from "./Reactions";
import { revealParts, revealSchedule } from "./reveal";
import type { ChatMessage } from "./types";

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Brings a reply in word by word: each word fades and rises a few pixels as
 * its turn comes (helper.css .rv-on), with a soft caret riding the end, at
 * the pace revealSchedule sets. Classes are switched straight on the spans,
 * so React does not re-render once per word, and only the few words actually
 * arriving are animating at any moment. The bubble grows a line at a time
 * with the words, rather than opening at its full height as an empty box:
 * its height is capped at the bottom of the line being written, and the cap
 * moves (a 160 ms ease, helper.css .rv-live) only when the writing reaches a
 * new line, so there is one layout read per line, not per frame. A click on
 * the bubble, or any key, shows the rest at once; reduced motion shows it all
 * straight away. When the last word is in, every timer and listener is gone.
 */
function useWordReveal(
  root: RefObject<HTMLDivElement | null>,
  active: boolean,
  onDone: () => void,
  onTick?: (word: HTMLElement) => void
): void {
  const done = useRef(onDone);
  done.current = onDone;
  const tick = useRef(onTick);
  tick.current = onTick;

  useEffect(() => {
    if (!active) return;
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>(".rv-w, .rv-b") ?? []);
    if (prefersReducedMotion() || items.length === 0) {
      done.current();
      return;
    }
    const times = revealSchedule(items.map((el) => ({ text: el.textContent ?? "", eol: el.hasAttribute("data-eol") })));
    const body = root.current;
    const start = performance.now();
    let next = 0;
    let timer = 0;
    let tip: HTMLElement | null = null;
    let finished = false;
    let lineTop = Number.NaN;

    // Cap the height at the bottom of the line the newest word is on. The
    // first cap lands before anything is painted, so the bubble opens one
    // line tall; later ones ease open as each new line starts.
    const grow = (word: HTMLElement) => {
      if (!body || word.offsetTop === lineTop) return;
      lineTop = word.offsetTop;
      // Layout boxes, not the rising word's transformed one, so the cap is
      // the line's real bottom (both are measured from the bubble).
      const bottom =
        word.offsetParent === body.offsetParent
          ? word.offsetTop + word.offsetHeight - body.offsetTop
          : word.getBoundingClientRect().bottom - body.getBoundingClientRect().top;
      body.style.maxHeight = `${Math.ceil(bottom)}px`;
    };
    const release = () => {
      if (body) body.style.maxHeight = "";
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      tip?.classList.remove("rv-tip");
      release();
      done.current();
    };
    const step = () => {
      const now = performance.now() - start;
      // Catch up on anything a throttled timer skipped past.
      while (next < items.length && times[next] <= now + 4) items[next++].classList.add("rv-on");
      tip?.classList.remove("rv-tip");
      tip = items[next - 1] ?? null;
      if (tip) grow(tip);
      if (next >= items.length) {
        if (tip) tick.current?.(tip);
        finish();
        return;
      }
      tip?.classList.add("rv-tip");
      if (tip) tick.current?.(tip);
      timer = window.setTimeout(step, Math.max(0, times[next] - (performance.now() - start)));
    };
    function onKey(e: KeyboardEvent) {
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      finish();
    }
    window.addEventListener("keydown", onKey);
    step();
    return () => {
      finished = true;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      tip?.classList.remove("rv-tip");
      release();
    };
  }, [active, root]);
}

/**
 * A line of text as MathText, or, for a reply being revealed, as one span per
 * word with the spaces between kept as they are. The last word of the line is
 * marked so the reveal can take a breath there.
 */
function Words({ text, words }: { text: string; words: boolean }) {
  if (!words) return <MathText text={text} />;
  const parts = revealParts(text);
  let last = -1;
  parts.forEach((p, i) => {
    if (p && !/^\s+$/.test(p)) last = i;
  });
  return (
    <>
      {parts.map((p, i) =>
        !p ? null : /^\s+$/.test(p) ? (
          p
        ) : (
          <span key={i} className="rv-w" data-eol={i === last ? "" : undefined}>
            <MathText text={p} />
          </span>
        )
      )}
    </>
  );
}

/**
 * A reply as paragraphs, with a worked example's "1. ... 2. ..." lines drawn
 * as numbered steps. Every piece goes through MathText so powers are powers.
 */
function RichText({ text, words = false }: { text: string; words?: boolean }) {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="space-y-2">
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const steps = lines.map((l) => /^\s*(\d{1,2})[.)]\s+(.*)$/.exec(l));
        if (steps.some(Boolean)) {
          return (
            <div key={b} className="space-y-1.5">
              {lines.map((line, i) => {
                const s = steps[i];
                return s ? (
                  <div key={i} className="flex gap-2">
                    <span
                      className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-bridge-700 ring-1 ring-bridge-200 ${words ? "rv-b" : ""}`}
                    >
                      {s[1]}
                    </span>
                    <span className="min-w-0">
                      <Words text={s[2]} words={words} />
                    </span>
                  </div>
                ) : (
                  <p key={i}>
                    <Words text={line} words={words} />
                  </p>
                );
              })}
            </div>
          );
        }
        return (
          <p key={b} className="whitespace-pre-wrap">
            {words ? (
              lines.map((l, i) => (
                <span key={i}>
                  {i > 0 && "\n"}
                  <Words text={l} words />
                </span>
              ))
            ) : (
              <MathText text={lines.join("\n")} />
            )}
          </p>
        );
      })}
    </div>
  );
}

/** How long after sending a message still counts as just sent, for the rise out of the box. */
const FRESH_MS = 900;

export function UserBubble({ message }: { message: ChatMessage }) {
  // Decided once, on mount: coming back to an old conversation should not
  // replay every message flying in.
  const [fresh] = useState(() => !!message.sentAt && Date.now() - message.sentAt < FRESH_MS);
  return (
    <div className={`${fresh ? "helper-sent" : "helper-in"} flex flex-col items-end pl-10`}>
      <div className="you-bubble whitespace-pre-wrap break-words">
        <MathText text={message.content} />
      </div>
      {message.archieReaction && (
        <div className="rx-under rx-under-you">
          <ArchieReactionPill id={message.archieReaction} fresh={fresh} />
        </div>
      )}
    </div>
  );
}

function FormulaCardBody({ message }: { message: ChatMessage }) {
  const card = message.card!;
  return (
    <div>
      <p className="text-[13px] font-semibold text-slate-900">{card.name}</p>
      <p className="mt-2 rounded-xl bg-white px-3 py-2.5 text-center text-[17px] font-semibold tracking-wide text-slate-900 ring-1 ring-bridge-100">
        <FormulaText text={card.formula} />
      </p>
      <p className="mt-2 text-[13px] text-slate-600">
        <span className="font-semibold text-slate-700">How to hold on to it: </span>
        {card.mnemonic}
      </p>
    </div>
  );
}

/**
 * The tail of Archie's bubble: an arch that reaches over to his face, like
 * the span of a bridge from him to his words. Same fill and edge as the
 * bubble, and it overlaps the bubble's border, so the two read as one shape.
 * The edge is drawn round the outside only, never across the join.
 */
export function BubbleTail() {
  return (
    <svg className="archie-tail" width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" focusable="false">
      <path className="archie-tail-fill" d="M14 0H2.1C.6 0-.1 1.7.9 2.8A15.5 15.5 0 0 1 14 18Z" />
      <path className="archie-tail-edge" d="M14 0H2.1C.6 0-.1 1.7.9 2.8A15.5 15.5 0 0 1 14 18" />
    </svg>
  );
}

/**
 * A helper message: Archie's face, his bubble, and anything that hangs off it
 * (a reaction, follow-ups, a retry). The text is revealed word by word the
 * first time it appears; a click or any key shows it all at once. Screen
 * readers get the whole reply once, from a hidden copy, rather than every
 * word as it lands.
 *
 * Reactions: hovering or focusing the message shows the bar, and on a touch
 * screen a long press does. A reaction sits in a pill under the bubble, and
 * tapping the pill takes it off.
 */
export function AssistantBubble({
  message,
  latest = true,
  onRevealed,
  onTick,
  onRetry,
  onReact,
  children,
}: {
  message: ChatMessage;
  /** His newest message: only its reaction bar is a Tab stop. */
  latest?: boolean;
  onRevealed: (id: number) => void;
  onTick?: (word: HTMLElement) => void;
  onRetry?: () => void;
  onReact?: (id: number, reaction: ReactionId) => void;
  children?: ReactNode;
}) {
  const animating = !!message.animate && message.kind !== "formula";
  // Decided once, on mount, so the words do not re-flow when the reveal ends.
  const [words] = useState(animating);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  useWordReveal(bodyRef, animating, () => onRevealed(message.id), onTick);
  const isError = message.kind === "error";
  const reactable = !!onReact && !isError && !animating;

  // A long press on a touch screen opens the bar; a tap anywhere else closes it.
  const [barOpen, setBarOpen] = useState(false);
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const pressed = useRef(false);
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => cancelPress, []);
  useEffect(() => {
    if (!barOpen) return;
    const away = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setBarOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [barOpen]);

  const react = (id: ReactionId) => onReact?.(message.id, id);

  // The bar opens above the bubble. The first message has room kept above it
  // (helper.css), so only a message scrolled up to the top edge has none,
  // and then the bar sits at its bottom right corner, never on its words.
  const [inside, setInside] = useState(false);
  const place = () => {
    const bubble = rowRef.current?.querySelector(".archie-bubble");
    const log = rowRef.current?.closest('[role="log"]');
    if (!bubble || !log) return;
    // The bar stands 30 px over the bubble, 44 px on touch (helper.css), plus a little air.
    const need = window.matchMedia("(hover: none)").matches ? 48 : 34;
    setInside(bubble.getBoundingClientRect().top - log.getBoundingClientRect().top < need);
  };

  return (
    <div
      ref={rowRef}
      tabIndex={-1}
      className="archie-row archie-pop relative flex items-start gap-2.5 pr-6 focus:outline-none"
      data-rx-open={barOpen ? "" : undefined}
      onPointerEnter={reactable ? place : undefined}
      onFocus={reactable ? place : undefined}
      onPointerDown={(e) => {
        if (!reactable || e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return;
        pressed.current = false;
        cancelPress();
        const timer = window.setTimeout(() => {
          press.current = null;
          pressed.current = true;
          place();
          setBarOpen(true);
        }, 450);
        press.current = { x: e.clientX, y: e.clientY, timer };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
      }}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => {
        // The long press is ours: no copy menu over the bar.
        if (pressed.current || press.current) e.preventDefault();
      }}
    >
      <HelperAvatar size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="relative">
          <div
            onClick={animating ? () => onRevealed(message.id) : undefined}
            className={`archie-bubble ${animating ? "cursor-pointer" : ""}`}
            data-tone={isError ? "error" : undefined}
            title={animating ? "Show it all" : undefined}
          >
            <BubbleTail />
            <span className="sr-only">
              {message.card ? `${message.card.name}. ${message.card.formula}. ${message.card.mnemonic}` : message.content}
            </span>
            <div aria-hidden="true" ref={bodyRef} className={animating ? "rv-live" : undefined}>
              {message.card ? <FormulaCardBody message={message} /> : <RichText text={message.content} words={words} />}
            </div>
            {isError && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Icon name="review" size={14} />
                Retry
              </button>
            )}
          </div>
          {message.reaction && (
            <div className="rx-under">
              <ReactionPill
                key={`${message.reaction}${message.reactedAt ?? ""}`}
                id={message.reaction}
                at={message.reactedAt}
                onRemove={() => react(message.reaction!)}
              />
            </div>
          )}
          {reactable && (
            <ReactionBar
              value={message.reaction}
              inside={inside}
              snippet={reactionSnippet(message.card ? message.card.name : message.content)}
              tabbable={latest}
              onPick={react}
              onDone={(how) => {
                setBarOpen(false);
                pressed.current = false;
                // Escape hands focus back to the message, which hides the bar.
                if (how === "escape") rowRef.current?.focus({ preventScroll: true });
              }}
            />
          )}
        </div>
        {!animating && children}
      </div>
    </div>
  );
}
