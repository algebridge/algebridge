const CORRECT_MESSAGES = [
  "Nice work!",
  "You crushed it!",
  "Boom — exactly right!",
  "You're on fire!",
  "Excellent! Keep going!",
  "That's exactly right!",
  "Awesome job!",
  "You nailed it!",
];

const WRONG_MESSAGES = [
  "Not quite — you've got this!",
  "Close! Give it another shot.",
  "Almost! Try again.",
  "Keep thinking — you're learning!",
  "So close! One more try.",
  "That's not it, but don't give up!",
];

interface MascotProps {
  state: "correct" | "wrong";
  seed: number;
}

export function Mascot({ state, seed }: MascotProps) {
  const messages = state === "correct" ? CORRECT_MESSAGES : WRONG_MESSAGES;
  const message = messages[Math.abs(seed) % messages.length];
  const emoji = state === "correct" ? "🌉" : "🤔";

  return (
    <div
      key={`${state}-${seed}`}
      className={`animate-pop-in flex items-start gap-3 rounded-xl px-4 py-3 ${
        state === "correct" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
      }`}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <p className="pt-0.5 font-medium">
        {state === "correct" ? "✓ " : ""}
        {message}
      </p>
    </div>
  );
}
