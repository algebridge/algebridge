"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import type { Season } from "@/lib/season";
import { useSeason } from "@/lib/use-season";

// Short and steady, the way a good tutor sounds. The old lines ("Boom,
// exactly right!", "You're on fire!") with a cartoon emoji read as a game.
const RIGHT = ["Correct. Good job!", "That's right. Good job!", "Right answer. Good job!", "Exactly right. Good job!", "Correct. Nicely worked, good job!"];
// The line is picked by a running count, never by how far off the answer
// was, so none of them may tell a student they are close.
const RETRY = [
  "Take another look and try again.",
  "Check your steps and try again.",
  "Try it once more.",
  "Check the math and give it another go.",
  "Look back at the key idea, then try again.",
];

// October (lib/season.ts): a few of the verdicts come in costume. Same rules:
// steady, and a miss is never told it was close.
const RIGHT_HALLOWEEN = ["Scary good. Nicely worked!", "Correct. That one's a treat.", "Right answer. Boo-tiful work!", "Correct. The ghosts are impressed."];
const RETRY_HALLOWEEN = ["No tricks here. Try it once more.", "That one's hiding. Check your steps and try again.", "Spooky, not scary. Give it another go."];

/** The verdict's words, also read out by the practice panel's status line. */
export function feedbackLine(state: "correct" | "wrong", seed: number, season: Season = null): string {
  const base = state === "correct" ? RIGHT : RETRY;
  const lines = season === "halloween" ? [...base, ...(state === "correct" ? RIGHT_HALLOWEEN : RETRY_HALLOWEEN)] : base;
  return lines[Math.abs(seed) % lines.length];
}

/** Seven spooks that fly out of a right verdict in October: bats, ghosts, pumpkins, each on its own line. */
const SPOOKS: { kind: "bat" | "ghost" | "pumpkin"; angle: number; dist: number; delay: number; size: number }[] = [
  { kind: "bat", angle: -150, dist: 120, delay: 0, size: 34 },
  { kind: "ghost", angle: -112, dist: 105, delay: 60, size: 32 },
  { kind: "pumpkin", angle: -80, dist: 115, delay: 30, size: 30 },
  { kind: "bat", angle: -45, dist: 130, delay: 90, size: 30 },
  { kind: "ghost", angle: -20, dist: 95, delay: 120, size: 28 },
  { kind: "bat", angle: -175, dist: 85, delay: 150, size: 24 },
  { kind: "pumpkin", angle: -130, dist: 75, delay: 180, size: 22 },
  { kind: "ghost", angle: -60, dist: 70, delay: 210, size: 20 },
];

function Bat({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 34 20" width={size * 1.6} height={size} aria-hidden="true">
      <path
        d="M17 9 C15.5 6 13 5 10.5 5.5 C9 3.5 6 3 4 4.5 C1.5 5.5 0.5 8.5 1 11.5 C3 10 5.2 10.2 6.5 12 C7.6 10.6 9.2 10.6 10.5 12 C11.4 10.2 13 9.8 14.5 10.8 L15.6 13 L17 15.5 L18.4 13 L19.5 10.8 C21 9.8 22.6 10.2 23.5 12 C24.8 10.6 26.4 10.6 27.5 12 C28.8 10.2 31 10 33 11.5 C33.5 8.5 32.5 5.5 30 4.5 C28 3 25 3.5 23.5 5.5 C21 5 18.5 6 17 9 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The Halloween burst: bats, ghosts and pumpkins fly out of the check mark
 * and the practice panel glows pumpkin for a moment (season.css). Felt in
 * the bones, as asked; gone in under two seconds; off under reduced motion.
 */
function SeasonBurst() {
  // The page-wide flare lives on <body>: the verdict box animates with a
  // transform, which would pin a fixed element to it instead of the window.
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  return (
    <span className="season-burst" aria-hidden="true">
      {body && createPortal(<span className="season-flare" aria-hidden="true" />, body)}
      {SPOOKS.map((sp, i) => {
        const rad = (sp.angle * Math.PI) / 180;
        return (
          <span
            key={i}
            className={`season-spook season-spook-${sp.kind}`}
            style={{ "--dx": `${Math.round(Math.cos(rad) * sp.dist)}px`, "--dy": `${Math.round(Math.sin(rad) * sp.dist)}px`, "--d": `${sp.delay}ms` } as React.CSSProperties}
          >
            {sp.kind === "bat" ? <Bat size={sp.size} /> : <Icon name={sp.kind} size={sp.size} />}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The verdict line. `flush` drops its own box, for when it opens a larger
 * note (the mistake note under a wrong answer) that already has one.
 */
export function AnswerFeedback({ state, seed, flush = false }: { state: "correct" | "wrong"; seed: number; flush?: boolean }) {
  const season = useSeason();
  const spooky = season === "halloween";
  const message = feedbackLine(state, seed, season);
  const box = flush
    ? "bg-transparent"
    : state === "correct"
      ? "animate-pop-in rounded-xl border border-emerald-200 bg-emerald-50"
      : "animate-pop-in rounded-xl border border-amber-200 bg-amber-50";
  return (
    <div
      key={`${state}-${seed}`}
      className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium ${box} ${
        state === "correct" ? "text-emerald-800" : "text-amber-900"
      }`}
    >
      {state === "correct" ? (
        spooky ? (
          // A little ghost rises out of the verdict and fades (season.css).
          <span className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Icon name="check" size={14} />
            <SeasonBurst />
          </span>
        ) : (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Icon name="check" size={14} />
          </span>
        )
      ) : (
        <Icon name="review" size={18} className="shrink-0 text-amber-600" />
      )}
      <p>{message}</p>
    </div>
  );
}
