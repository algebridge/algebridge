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

export function AnswerFeedback({ state, seed }: { state: "correct" | "wrong"; seed: number }) {
  const lines = state === "correct" ? RIGHT : RETRY;
  const message = lines[Math.abs(seed) % lines.length];
  return (
    <div
      key={`${state}-${seed}`}
      className={`animate-pop-in flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium ${
        state === "correct" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
      }`}
    >
      <Icon name={state === "correct" ? "check" : "review"} size={18} className="shrink-0" />
      <p>{message}</p>
    </div>
  );
}
