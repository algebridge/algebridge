import type { HelperAction, SchedulerState } from "@/lib/helper";

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
 */
export type MessageKind = "reply" | "gate" | "formula" | "booking" | "error";

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
  /** When the student sent it (Date.now()), so a just-sent message can rise out of the box. */
  sentAt?: number;
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
}

export const EMPTY_THREAD: Thread = { messages: [], scheduler: null };
