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
] as const;

/** A miss, in season. Never a claim about the answer: no "close" or "almost". */
export const HALLOWEEN_WRONG_LINES = [
  "Not yet. That one's hiding like a ghost. Look again, {name}.",
  "Spooky, but not scary. Take another look, or tap a hint.",
  "Not this time. Even witches redo a spell now and then.",
  "That one slipped away into the fog. Want to check it together?",
] as const;

export const HALLOWEEN_STREAK_LINES: Readonly<Record<number, string>> = {
  3: "Three in a row, {name}! The cauldron is bubbling.",
  5: "Five in a row! That's witch-level work.",
  10: "Ten in a row! You're haunting these problems.",
};

/** Beside his name when a student is quiet on a problem. Never a question. */
export const HALLOWEEN_IDLE_NUDGES = ["Stuck? My hat has a hint in it.", "No tricks here. A hint is one tap away."] as const;

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
  "It is Halloween season and you are wearing a witch hat. Once in a while, when it fits, a light Halloween or fall pun is welcome (ghosts, pumpkins, bats, spells). Keep it rare, one line at most, never scary, and never let it get in the way of the math.";

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
];

/**
 * The usual pool with the season's lines mixed in. In season about a third
 * of what he says on his own is seasonal; the rest is still plain Archie.
 */
export function withSeason<T extends string>(base: readonly T[], seasonal: readonly string[], season: Season): readonly string[] {
  return season === "halloween" ? [...base, ...seasonal] : base;
}
