"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArchieFace } from "@/components/archie/Archie";
import { REACTIONS, reactionName, reactLabel, type ReactionId } from "@/lib/archie-reactions";

/**
 * Reactions as drawn line icons, never emoji: thumbs up, heart, lightbulb
 * (aha), laugh, a puzzled face (confused) and star. The bar is an ARIA
 * toolbar with arrow keys between buttons, and only the newest message's bar
 * is a tab stop, so Tab does not walk through one bar per message; older
 * bars open on hover, or when the message or a button in it is focused. The
 * pill under a message shows the reaction on it, with a pop when it is new.
 */

const PATHS: Record<ReactionId, ReactNode> = {
  thumbs: (
    <path d="M7 10.5V20H4.5a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1H7Zm0 0L10.6 4a1.9 1.9 0 0 1 3.5 1.4L13.3 9.5h5.2a2 2 0 0 1 2 2.4l-1.3 6.4a2.1 2.1 0 0 1-2 1.7H7" />
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  aha: <path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3Z" />,
  laugh: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 10.2q1.2-1.6 2.4 0M13.6 10.2q1.2-1.6 2.4 0M7.8 13.6h8.4a4.2 4.2 0 0 1-8.4 0Z" />
    </>
  ),
  // A face, like laugh, so it does not read as "help" in the pill under a hint.
  confused: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9.8h.01M15 9.8h.01M8 15.5q1-1 2 0t2 0 2 0 2 0" />
    </>
  ),
  star: <path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.6l-5 2.7.9-5.6-4-4 5.6-.8Z" />,
};

/** Each reaction's color once it is on a message: ink for the line, a soft fill inside. */
const TONE: Record<ReactionId, { ink: string; fill: string }> = {
  thumbs: { ink: "#1d4ed8", fill: "#dbeafe" },
  heart: { ink: "#db2777", fill: "#fbcfe8" },
  aha: { ink: "#b45309", fill: "#fde68a" },
  laugh: { ink: "#15803d", fill: "#dcfce7" },
  confused: { ink: "#6d28d9", fill: "#ede9fe" },
  star: { ink: "#b45309", fill: "#fcd34d" },
};

export function ReactionIcon({ id, size = 18, filled = false }: { id: ReactionId; size?: number; filled?: boolean }) {
  const tone = TONE[id];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? tone.fill : "none"}
      stroke={filled ? tone.ink : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {PATHS[id]}
    </svg>
  );
}

/**
 * The bar of six. Shown on hover or focus (and by a long press on touch, by
 * the message that owns it). `onDone` hands focus back after a pick or Escape.
 */
export function ReactionBar({
  value,
  inside = false,
  snippet = "",
  tabbable = true,
  onPick,
  onDone,
}: {
  value: ReactionId | null | undefined;
  /** No room above the bubble: sit at its bottom right corner instead. */
  inside?: boolean;
  /** The start of the message, so each bar says which message it reacts to. */
  snippet?: string;
  /** Only the newest message's bar is a Tab stop. */
  tabbable?: boolean;
  onPick: (id: ReactionId) => void;
  onDone?: (how: "pick" | "escape") => void;
}) {
  const start = Math.max(
    0,
    REACTIONS.findIndex((r) => r.id === value)
  );
  const [active, setActive] = useState(start);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (to: number) => {
    const i = (to + REACTIONS.length) % REACTIONS.length;
    setActive(i);
    refs.current[i]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") move(active + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(active - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(REACTIONS.length - 1);
    else if (e.key === "Escape") {
      // Closes the bar, not the whole panel.
      e.preventDefault();
      onDone?.("escape");
      return;
    } else return;
    e.preventDefault();
  };

  return (
    <div
      role="toolbar"
      aria-label={snippet ? `React to Archie: ${snippet}` : "React to Archie's message"}
      className="rx-bar"
      data-inside={inside ? "" : undefined}
      onKeyDown={onKeyDown}
    >
      {REACTIONS.map((r, i) => {
        const on = value === r.id;
        return (
          <button
            key={r.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            tabIndex={tabbable && i === active ? 0 : -1}
            aria-pressed={on}
            aria-label={reactLabel(r.id)}
            title={r.title}
            data-rx={r.id}
            onFocus={() => setActive(i)}
            onClick={(e) => {
              onPick(r.id);
              // A mouse pick should not leave the bar pinned open by focus.
              if (e.detail > 0) e.currentTarget.blur();
              onDone?.("pick");
            }}
            className="rx-btn"
          >
            <ReactionIcon id={r.id} filled={on} />
          </button>
        );
      })}
    </div>
  );
}

/** The student's reaction under one of Archie's messages. Tapping it takes it off. */
export function ReactionPill({ id, at, onRemove }: { id: ReactionId; at?: number; onRemove: () => void }) {
  // Pops when it is new, not every time the conversation is shown again.
  const [fresh] = useState(() => !!at && Date.now() - at < 1500);
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`You reacted with ${reactionName(id)}. Remove it`}
      title="Tap to remove"
      className={`rx-pill rx-pill-btn ${fresh ? "rx-pop" : ""}`}
    >
      <ReactionIcon id={id} size={14} filled />
    </button>
  );
}

/** Archie's reaction under one of the student's messages, with his face so it is clear who reacted. */
export function ArchieReactionPill({ id, fresh }: { id: ReactionId; fresh: boolean }) {
  return (
    <span role="img" aria-label={`Archie reacted with ${reactionName(id)}`} className={`rx-pill ${fresh ? "rx-pop rx-late" : ""}`}>
      <ArchieFace size={14} />
      <ReactionIcon id={id} size={14} filled />
    </span>
  );
}
