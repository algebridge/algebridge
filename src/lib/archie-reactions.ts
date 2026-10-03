/**
 * Reactions in Archie's conversation, as data and rules.
 *
 * The student can put one reaction on any of Archie's messages; picking the
 * same one again takes it off. Archie answers some of them (a confused face
 * gets another way in, an aha gets a cheer, a heart or a star gets a happy
 * pose), once per message. He also reacts to the student's own messages on
 * his own, but only when a simple rule says it fits: a heart on "thanks", a
 * star when they say they got it right, a lightbulb on "oh, I get it". Never
 * on every message, and never on one that sounds upset.
 *
 * Pure, so the helper tests can pin the rules down. The icons are drawn line
 * SVGs (components/helper/Reactions.tsx), never emoji.
 */

export const REACTIONS = [
  { id: "thumbs", label: "thumbs up", title: "Thumbs up" },
  { id: "heart", label: "heart", title: "Love it" },
  { id: "aha", label: "aha", title: "Aha!" },
  { id: "laugh", label: "laugh", title: "Ha" },
  { id: "confused", label: "confused", title: "Confused" },
  { id: "star", label: "star", title: "Star" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];

const IDS = new Set<string>(REACTIONS.map((r) => r.id));

export function isReactionId(value: unknown): value is ReactionId {
  return typeof value === "string" && IDS.has(value);
}

/** "React with heart": the label on each button in the bar. */
export function reactLabel(id: ReactionId): string {
  return `React with ${REACTIONS.find((r) => r.id === id)!.label}`;
}

/** What a reaction is called in a sentence: "heart", "thumbs up". */
export function reactionName(id: ReactionId): string {
  return REACTIONS.find((r) => r.id === id)!.label;
}

/**
 * The start of a message, for its reaction bar's label, so a screen reader
 * hears which message each bar is for: "React to Archie: Here is a hint:
 * Subtract 6 from both...". About 40 characters, cut at a word.
 */
export function reactionSnippet(text: string, max = 40): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?]+$/, "")}...`;
}

/** One reaction per message: the same one again removes it, a different one replaces it. */
export function toggleReaction(current: ReactionId | null | undefined, picked: ReactionId): ReactionId | null {
  return current === picked ? null : picked;
}

// ---------------------------------------------------------------------------
// How Archie answers a reaction
// ---------------------------------------------------------------------------

export type ReactionPose = "happy" | "party" | null;

export interface ReactionResponse {
  /** How he moves in the header. */
  pose: ReactionPose;
  /** A small drawn mark that floats up beside him. */
  mark: "heart" | "star" | null;
  /** A line in the conversation, from this pool in the persona. */
  say: "confused" | "confused-plain" | "aha" | null;
  /** Offer the "Explain it another way" follow-up under that line. */
  anotherWay: boolean;
  /** A short quip beside his name, from this pool in archie/lines.ts. */
  quip: "heart" | "star" | null;
}

const NONE: ReactionResponse = { pose: null, mark: null, say: null, anotherWay: false, quip: null };

export interface ReactionSituation {
  /** The reaction was just added (not taken off). */
  added: boolean;
  /** It is on his newest message. Older ones get a pose, never a new line. */
  latest: boolean;
  /** He already answered this reaction on this message. */
  answeredBefore: boolean;
  /** The message was an explanation the server wrote, so "another way" means something. */
  explanation: boolean;
  /** A reply is loading or being written. */
  busy: boolean;
}

/**
 * The rule for answering a reaction. Taking one off gets nothing. A line goes
 * into the conversation only for the newest message, only once per message
 * and reaction, and never over a reply being written.
 */
export function responseToReaction(id: ReactionId, s: ReactionSituation): ReactionResponse {
  if (!s.added) return NONE;
  const talk = s.latest && !s.answeredBefore && !s.busy;
  switch (id) {
    case "confused":
      return talk
        ? { ...NONE, say: s.explanation ? "confused" : "confused-plain", anotherWay: s.explanation }
        : NONE;
    case "aha":
      return { ...NONE, pose: "party", say: talk ? "aha" : null };
    case "heart":
      return { ...NONE, pose: "happy", mark: "heart", quip: s.answeredBefore ? null : "heart" };
    case "star":
      return { ...NONE, pose: "happy", mark: "star", quip: s.answeredBefore ? null : "star" };
    case "thumbs":
    case "laugh":
      return { ...NONE, pose: "happy" };
  }
}

// ---------------------------------------------------------------------------
// When Archie reacts to the student
// ---------------------------------------------------------------------------

/**
 * Words that mean the message may be about something hard. Archie does not
 * put a heart on "thanks, I want to give up on everything". Deliberately
 * broad: a missed heart costs nothing.
 */
const UPSET =
  /\b(?:die|dying|dead|death|kill\w*|suicid\w*|hurt\w*|harm\w*|cut\w*|sad|cry\w*|hate\w*|scared|afraid|alone|lonely|depress\w*|anxi\w*|abus\w*|unsafe|danger\w*|bull(?:y|ied|ies|ying)|stress\w*|worst|awful|terrible|horrible|upset|angry|mad|give up|quit|stupid|dumb|idiot|useless|fail\w*)\b/;

/** "thanks for nothing", "I didn't get it right", "no thanks". */
const NEGATED = /\b(?:not|no|nope|dont|doesnt|didnt|cant|cannot|never|nothing|wasnt|isnt|still|wrong|but)\b/;

const SAYS_RIGHT =
  /\b(?:i got it right|got it right|i got it correct|i got the (?:right )?answer|it was right|it was correct|i did it|i solved it|nailed it|it worked|i was right)\b/;
const SAYS_AHA =
  /(?:^|\b)(?:o+h+|a+h+|aha+)\b.*\b(?:get it|see|understand|makes sense)\b|\b(?:i get it now|now i get it|i understand now|now i understand|that makes sense|makes sense now|it makes sense|it clicked|that clicked)\b|^(?:i get it|i see|(?:i )?got it(?: now)?)$/;
const SAYS_THANKS = /\b(?:thanks|thank you|thank u|thx|ty|tysm|appreciate it|you helped|that helped|so helpful)\b/;
/**
 * "love you", "be my friend", "you're the best". He answers these honestly in
 * words (he is an AI, their people are their team), and a heart on top would
 * say the opposite.
 */
const AFFECTION =
  /\b(?:(?:love|luv) (?:you|u|ya)|ily(?:sm)?|be my (?:best |only )?friend|(?:youre|you are|ur) (?:the best|my (?:best|only) friend)|date me|marry me)\b/;

/**
 * The reaction Archie puts on a student's message, or null for almost every
 * message. Star beats lightbulb beats heart when a message says more than one.
 */
export function autoReactionFor(text: string): ReactionId | null {
  const t = text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 120) return null;
  if (UPSET.test(t) || NEGATED.test(t) || AFFECTION.test(t)) return null;
  if (SAYS_RIGHT.test(t)) return "star";
  if (SAYS_AHA.test(t)) return "aha";
  if (SAYS_THANKS.test(t)) return "heart";
  return null;
}
