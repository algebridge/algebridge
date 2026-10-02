"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { MathText } from "@/components/PromptText";
import { FormulaText } from "./FormulaText";
import { HelperAvatar } from "./HelperAvatar";
import type { ChatMessage } from "./types";

/** Brisk enough to keep up with reading, slow enough to feel like writing. */
const WORDS_PER_SECOND = 35;

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** The first n words of text, with its own spaces and line breaks kept. */
function firstWords(text: string, n: number): string {
  if (n <= 0) return "";
  let seen = 0;
  for (const m of text.matchAll(/\S+/g)) {
    seen += 1;
    if (seen === n) return text.slice(0, (m.index ?? 0) + m[0].length);
  }
  return text;
}

/**
 * Reveals text word by word while `active`, then reports that it is done.
 * Returns how many words to show.
 */
function useReveal(text: string, active: boolean, onDone: () => void, onTick?: () => void): number {
  const total = useMemo(() => (text.match(/\S+/g) ?? []).length, [text]);
  const [count, setCount] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  const tick = useRef(onTick);
  tick.current = onTick;

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion() || total === 0) {
      done.current();
      return;
    }
    let n = 0;
    setCount(0);
    const id = window.setInterval(() => {
      n += 1;
      setCount(n);
      tick.current?.();
      if (n >= total) {
        window.clearInterval(id);
        done.current();
      }
    }, 1000 / WORDS_PER_SECOND);
    return () => window.clearInterval(id);
  }, [active, total]);

  return active ? count : total;
}

/**
 * A reply as paragraphs, with a worked example's "1. ... 2. ..." lines drawn
 * as numbered steps. Every piece goes through MathText so powers are powers.
 */
function RichText({ text }: { text: string }) {
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
                    <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-bridge-50 text-[11px] font-semibold text-bridge-700 ring-1 ring-bridge-100">
                      {s[1]}
                    </span>
                    <span className="min-w-0">
                      <MathText text={s[2]} />
                    </span>
                  </div>
                ) : (
                  <p key={i}>
                    <MathText text={line} />
                  </p>
                );
              })}
            </div>
          );
        }
        return (
          <p key={b} className="whitespace-pre-wrap">
            <MathText text={lines.join("\n")} />
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
    <div className={`${fresh ? "helper-sent" : "helper-in"} flex justify-end pl-10`}>
      <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-bridge-600 px-3.5 py-2 text-white shadow-sm">
        <MathText text={message.content} />
      </div>
    </div>
  );
}

function FormulaCardBody({ message }: { message: ChatMessage }) {
  const card = message.card!;
  return (
    <div>
      <p className="text-[13px] font-semibold text-slate-900">{card.name}</p>
      <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-center text-[17px] font-semibold tracking-wide text-slate-900 ring-1 ring-slate-200">
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
 * A helper message: the avatar, the bubble, and anything that hangs off it
 * (follow-ups, a retry). The text is revealed word by word the first time it
 * appears; a click shows it all at once. Screen readers get the whole reply
 * once, from a hidden copy, rather than every word as it lands.
 */
export function AssistantBubble({
  message,
  onRevealed,
  onTick,
  onRetry,
  children,
}: {
  message: ChatMessage;
  onRevealed: (id: number) => void;
  onTick?: () => void;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  const animating = !!message.animate && message.kind !== "formula";
  const shown = useReveal(message.content, animating, () => onRevealed(message.id), onTick);
  const visible = animating ? firstWords(message.content, shown) : message.content;
  const isError = message.kind === "error";

  return (
    <div className="helper-in flex items-start gap-2 pr-6">
      <HelperAvatar size={26} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div
          onClick={animating ? () => onRevealed(message.id) : undefined}
          className={`inline-block max-w-full break-words rounded-2xl rounded-tl-md border px-3.5 py-2.5 shadow-sm ${
            isError ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-800"
          } ${animating ? "cursor-pointer" : ""}`}
          title={animating ? "Show it all" : undefined}
        >
          <span className="sr-only">
            {message.card ? `${message.card.name}. ${message.card.formula}. ${message.card.mnemonic}` : message.content}
          </span>
          <div aria-hidden="true">
            {message.card ? <FormulaCardBody message={message} /> : <RichText text={visible} />}
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
        {!animating && children}
      </div>
    </div>
  );
}
