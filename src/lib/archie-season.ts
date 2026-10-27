/**
 * What Archie says in Halloween season (lib/season.ts), on top of his usual
 * lines in archie-persona.ts. He is wearing a witch hat and he knows it. The
 * puns are light and the math stays first: a seasonal line is mixed into
 * the usual pool, never the whole pool, so he does not turn into a Halloween
 * bot for a month.
 *
 * Same house style as every other line: US English, no em dashes, no emoji,
 * short, never a claim about the answer. Checked by the helper tests.
 */

import type { Season } from "@/lib/season";

/** The hello part, in season, for a student he has met. */
export const HALLOWEEN_GREETINGS = [
  "Boo, {name}! Just me, in a hat. Ready for some spooky-good algebra?",
  "Happy almost Halloween, {name}! I put the hat on for the occasion.",
  "Hey {name}! Welcome to the haunted house of algebra. The ghosts are all variables.",
  "Trick or treat, {name}! I only do treats, and today's treat is math.",
  "Hey {name}! Like the hat? It's for witch-level focus.",
  "Welcome back, {name}. The cauldron's bubbling and the problems are fresh.",
  "Hey {name}! Something wicked this way comes. It's a system of equations.",
  "The bats are out, {name}, and so are we. What are we solving tonight?",
  "Greetings, {name}. The witch hat says hi too. Shall we brew up some math?",
] as const;

/** The very first hello on this device, in season. */
export const HALLOWEEN_FIRST_OPEN_LINES = [
  "Hi {name}! I'm Archie, your AI study buddy. It's Halloween season, so excuse the hat. I love algebra a slightly spooky amount.",
] as const;

export const HALLOWEEN_RIGHT_LINES = [
  "Yes! That answer is scary good, {name}.",
  "Correct! That's a treat. No tricks about it.",
  "Nailed it! Even the ghosts are clapping.",
  "Right on, {name}. You cast that spell perfectly.",
  "Boom! You carved that one up like a pumpkin.",
  "Correct! The witch hat tips to you.",
  "That's right! The skeletons just rattled with joy.",
  "Correct, {name}! Spooky how good you're getting at this.",
  "Yes! One more for the candy bowl.",
  "Right! The cauldron bubbled when you got that one.",
] as const;

/** A miss, in season. Never a claim about the answer: no "close" or "almost". */
export const HALLOWEEN_WRONG_LINES = [
  "Not yet. That one's hiding like a ghost. Look again, {name}.",
  "Spooky, but not scary. Take another look, or tap a hint.",
  "Not this time. Even witches redo a spell now and then.",
  "That one slipped away into the fog. Want to check it together?",
  "Not quite, {name}. The answer's still lurking. One more try?",
  "No treat yet. Check each step, the trick is usually in one of them.",
] as const;

export const HALLOWEEN_STREAK_LINES: Readonly<Record<number, string>> = {
  3: "Three in a row, {name}! The cauldron is bubbling.",
  5: "Five in a row! That's witch-level work.",
  10: "Ten in a row! You're haunting these problems.",
};

/** Beside his name when a student is quiet on a problem. Never a question. */
export const HALLOWEEN_IDLE_NUDGES = ["Stuck? My hat has a hint in it.", "No tricks here. A hint is one tap away.", "The ghosts are patient. Take your time.", "Boo. Just checking in. Chips below."] as const;

export const HALLOWEEN_THANKS_REPLIES = [
  "Anytime, {name}! Happy haunting, I mean, happy solving.",
  "You're welcome! The hat and I are always here.",
  "Of course! Now that's what I call a treat. Got another one?",
] as const;

export const HALLOWEEN_HELLO_REPLIES = [
  "Boo! Hey {name}. How's your day going?",
  "Hey hey! The haunted house of algebra is open. What's up, {name}?",
  "Hi {name}! I've got my hat on and a cauldron of problems ready. How are you?",
] as const;

export const HALLOWEEN_MOTIVATE_LINES = [
  "Every problem you try is one more ghost that stops being scary. Keep going, {name}.",
  "Witches don't get a spell right the first time either. They just keep stirring. So do you.",
  "The scariest problem is the one you skip. The one you try always gets smaller.",
] as const;

export const HALLOWEEN_NEW_PROBLEM_LINES = [
  "A fresh one crawled out of the cauldron. Take a look.",
  "New problem, same haunted house. Where do you want to start?",
  "Ooh, this one looks spooky. Want a hint, or want to brave it first?",
] as const;

export const HALLOWEEN_BYE_LINES = [
  "Bye for now, {name}! Watch out for ghosts. And for negative signs.",
  "See you later, {name}! Happy Halloween from me and the hat.",
] as const;

/** Clean puns for the season, nothing about anyone. */
export const HALLOWEEN_JOKES = [
  "Why did the ghost fail algebra? It kept disappearing before the last step.",
  "What do witches use to solve equations? Spell-check.",
  "Why are skeletons so calm in math class? Nothing gets under their skin.",
  "What is a vampire's favorite part of a graph? The y-intercept, because it's where the line bites the axis.",
  "Why did the pumpkin get an A in algebra? It had a lot of seeds of knowledge.",
  "What do you call a bat that loves math? A counting bat. It hangs around the number line.",
  "Why did the mummy do so well with equations? It was all wrapped up in the work.",
  "What is a zombie's favorite operation? Dividing. It likes to split things apart.",
] as const;

/** Season facts with the math in them. Each one checked. */
export const HALLOWEEN_FUN_FACTS = [
  // Any triangle's angles sum to 180 degrees.
  "Most jack-o'-lantern faces are cut from triangles, and the three angles of every one of them add up to exactly 180 degrees.",
  // A spider's spiral web: each turn farther out, an arithmetic-like spacing.
  "An orb spider's web is a spiral: each turn sits a little farther out than the last, the way a sequence grows by a common difference.",
  // Pumpkins are about 90 percent water (USDA food data lists raw pumpkin at ~92%).
  "A pumpkin is about 90 percent water. A 10 pound pumpkin is carrying about 9 pounds of it.",
  // Little brown bats are often cited as eating up to about 1,000 insects an hour.
  "A little brown bat can eat up to about 1,000 insects in an hour. That's one every 3.6 seconds, if you do the division.",
] as const;

/** The note the model gets in season, on top of the persona. */
export const HALLOWEEN_PROMPT_NOTE =
  "It is Halloween season and you are wearing a witch hat, which you love. Every few replies, when it fits, slip in a light Halloween or fall touch: a pun, a ghost, a pumpkin, a spell, the cauldron, trick or treat. One short line at most, playful never scary, and the math always comes first.";

/** Every seasonal line, for the style tests. */
export const ALL_HALLOWEEN_LINES: readonly string[] = [
  ...HALLOWEEN_GREETINGS,
  ...HALLOWEEN_FIRST_OPEN_LINES,
  ...HALLOWEEN_RIGHT_LINES,
  ...HALLOWEEN_WRONG_LINES,
  ...Object.values(HALLOWEEN_STREAK_LINES),
  ...HALLOWEEN_IDLE_NUDGES,
  ...HALLOWEEN_BYE_LINES,
  ...HALLOWEEN_JOKES,
  ...HALLOWEEN_FUN_FACTS,
  ...HALLOWEEN_THANKS_REPLIES,
  ...HALLOWEEN_HELLO_REPLIES,
  ...HALLOWEEN_MOTIVATE_LINES,
  ...HALLOWEEN_NEW_PROBLEM_LINES,
];

/**
 * The usual pool with the season's lines mixed in, each seasonal line
 * counted twice: in season about half of what he says on his own is in
 * costume, and the rest is still plain Archie.
 */
export function withSeason<T extends string>(base: readonly T[], seasonal: readonly string[], season: Season): readonly string[] {
  return season === "halloween" ? [...base, ...seasonal, ...seasonal] : base;
}
