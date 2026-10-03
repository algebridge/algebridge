import type { HelperAction, SchedulerState } from "@/lib/helper";
import type { ReactionId } from "@/lib/archie-reactions";

/** A formula card as the server sends it with a Formulas reply. */
export interface FormulaCardView {
  name: string;
  formula: string;
  mnemonic: string;
}

/**
 * reply: an answer from the model or the local engine, which gets follow-ups.
 * gate: a fixed answer from the server's rules (a refusal, an offer of a tutor).
 * formula: a formula card. booking: a line of the booking script.
 * error: the request did not come back; it offers a retry.
 * greeting: Archie's hello at the top of a conversation (never sent to the server).
 * buddy: something Archie says on his own, with no model: a cheer after a
 * practice answer, a fun fact, a quiz question, a reply to "thanks".
 * crisis: the fixed reply to a student who may be in danger, drawn as a card
 * with the people to reach (CrisisCard), never as a bubble.
 * held: a student's message the panel kept back (a booking answer with a
 * phone number or a username). Shown to them, never sent to the server.
 */
export type MessageKind = "reply" | "gate" | "formula" | "booking" | "error" | "greeting" | "buddy" | "crisis" | "held";

/** A quick follow-up offered under one of Archie's messages while it is the newest. */
export type FollowUpId = "another-way" | "next-step" | "hint" | "fact" | "quiz" | "joke";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  kind?: MessageKind;
  card?: FormulaCardView;
  /** Reveal word by word when it first appears. Cleared once shown in full. */
  animate?: boolean;
  /** On an error, the quick action the failed request carried, if any. */
  retryAction?: HelperAction;
  /** When it was sent or written (Date.now()), so only a fresh message animates in or is announced. */
  sentAt?: number;
  /** The student's reaction on one of Archie's messages. One per message. */
  reaction?: ReactionId | null;
  /** When the student last reacted, so only a fresh reaction pops. */
  reactedAt?: number;
  /** Archie's own reaction on one of the student's messages. */
  archieReaction?: ReactionId | null;
  /** Follow-ups to offer while this is the newest message. */
  followUps?: FollowUpId[];
  /** A line about a practice answer: the next one replaces it rather than stacking up. */
  practice?: boolean;
  /** Archie asked how the student is doing, so a plain "good" can be answered here. */
  asksMood?: boolean;
}

/** Archie's own quiz question, waiting for an answer. */
export interface QuizState {
  /** Index into EASY_QUIZ. */
  item: number;
  tries: number;
}

/** One line of the work pad. `entered` is the text as last committed, which is what gets checked. */
export interface PadLine {
  id: number;
  text: string;
  entered: string | null;
}

/** One conversation: per problem in Tutor mode, one each for Formulas and Book a tutor. */
export interface Thread {
  messages: ChatMessage[];
  scheduler: SchedulerState | null;
  pad?: PadLine[];
  padOpen?: boolean;
  quiz?: QuizState | null;
}

export const EMPTY_THREAD: Thread = { messages: [], scheduler: null };
