/**
 * What Archie says on his own, outside the conversation: a greeting and one
 * short line when practice checks an answer. Pure data and pure functions, so
 * the helper tests can hold every line to house style.
 *
 * Voice: warm, brief, a friend who is good at math. Never babyish, never
 * more than one line, and never a claim about the answer itself: a wrong line
 * cannot say "close", because Archie does not know how close it was.
 */

export type PracticeOutcome = "correct" | "wrong";

export const CORRECT_LINES = [
  "Nice one. Want to try the next?",
  "That's it. Nicely done.",
  "Yes. You worked that out.",
  "Solid work.",
  "Clean work. Keep it going.",
  "Look at you go.",
  "You made that look easy.",
] as const;

export const WRONG_LINES = [
  "Not yet. Take another look.",
  "Tricky one. Give it another go.",
  "Misses teach. One more try?",
  "Check each step, then try again.",
  "Want a hint? I'm right here.",
  "Shake it off. You've got this.",
] as const;

/** Said instead of a correct line when the run reaches one of these. The count is the student's own, this session. */
export const STREAK_LINES: Readonly<Record<number, string>> = {
  3: "Three in a row. On a roll.",
  5: "Five in a row. Real skill.",
  10: "Ten in a row. Impressive.",
};

/** A random line from the pool, skipping the ones said most recently. */
export function pickLine(pool: readonly string[], recent: readonly string[], random: () => number = Math.random): string {
  const fresh = pool.filter((l) => !recent.includes(l));
  const from = fresh.length ? fresh : pool;
  return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
}

/** The line for one checked answer. `streak` counts correct answers in a row, this one included. */
export function reactionLine(
  outcome: PracticeOutcome,
  streak: number,
  recent: readonly string[],
  random: () => number = Math.random
): string {
  if (outcome === "correct" && STREAK_LINES[streak]) return STREAK_LINES[streak];
  return pickLine(outcome === "correct" ? CORRECT_LINES : WRONG_LINES, recent, random);
}

/** The first thing Archie says, by first name when he knows it. */
export function greeting(firstName: string | null | undefined): string {
  const name = firstName?.trim();
  return name ? `Hi ${name}, I'm Archie.` : "Hi, I'm Archie.";
}

/** Beside his name when the student puts a heart on one of his messages. */
export const HEART_QUIPS = ["Aw, glad that helped!", "Ooh, a heart! Glad it clicked.", "Thanks! That one was fun."] as const;

/** Beside his name when the student gives one of his messages a star. */
export const STAR_QUIPS = ["A star? I'm honored.", "Ooh, a gold star!", "Starred! Thank you."] as const;

/** Every line Archie can say on his own, for the style tests. */
export const ALL_LINES: readonly string[] = [
  ...CORRECT_LINES,
  ...WRONG_LINES,
  ...Object.values(STREAK_LINES),
  ...HEART_QUIPS,
  ...STAR_QUIPS,
];
