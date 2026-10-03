import { Icon } from "@/components/Icon";

// Short and steady, the way a good tutor sounds. The old lines ("Boom,
// exactly right!", "You're on fire!") with a cartoon emoji read as a game.
const RIGHT = ["Correct.", "That's right.", "Right answer.", "Exactly right.", "Correct. Nicely worked."];
const RETRY = [
  "Take another look and try again.",
  "Close. Check your steps and try again.",
  "Try it once more.",
  "Check the math and give it another go.",
  "Look back at the key idea, then try again.",
];

/** The verdict's words, also read out by the practice panel's status line. */
export function feedbackLine(state: "correct" | "wrong", seed: number): string {
  const lines = state === "correct" ? RIGHT : RETRY;
  return lines[Math.abs(seed) % lines.length];
}

/**
 * The verdict line. `flush` drops its own box, for when it opens a larger
 * note (the mistake note under a wrong answer) that already has one.
 */
export function AnswerFeedback({ state, seed, flush = false }: { state: "correct" | "wrong"; seed: number; flush?: boolean }) {
  const message = feedbackLine(state, seed);
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
        <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Icon name="check" size={14} />
        </span>
      ) : (
        <Icon name="review" size={18} className="shrink-0 text-amber-600" />
      )}
      <p>{message}</p>
    </div>
  );
}
