"use client";

import { Icon } from "@/components/Icon";
import { useSeason, type Season } from "@/lib/season";

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
            <span className="season-ghost-up" aria-hidden="true">
              <Icon name="ghost" size={18} />
            </span>
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
