/**
 * Archie checks answers through the practice card, never on his own: the
 * card has the key and the grader, and an answer typed to Archie counts
 * exactly like one typed on the card (first try and all). He sends the text,
 * the card grades it, marks it, and tells him what happened.
 */
export const SUBMIT_EVENT = "algebridge:submit-answer";
export const SUBMIT_RESULT_EVENT = "algebridge:submit-result";

export interface SubmitOutcome {
  result: "correct" | "wrong" | "unreadable" | "done" | "none";
  /** One or two sentences: why it is wrong, in the student's own numbers. */
  note?: string;
  fix?: string;
  /** The worked answer, for the slip picture. */
  explanation?: string;
  /** The step the slip is in, when known. */
  step?: number;
}

let nextId = 1;

/** Hands an answer to the card on screen. Resolves with what the card made of it. */
export function submitAnswerToCard(given: string, timeoutMs = 1500): Promise<SubmitOutcome> {
  if (typeof window === "undefined") return Promise.resolve({ result: "none" });
  const id = nextId++;
  return new Promise((resolve) => {
    const done = (o: SubmitOutcome) => {
      window.removeEventListener(SUBMIT_RESULT_EVENT, onResult);
      window.clearTimeout(timer);
      resolve(o);
    };
    const onResult = (e: Event) => {
      const d = (e as CustomEvent<{ id: number; outcome: SubmitOutcome }>).detail;
      if (d?.id === id) done(d.outcome);
    };
    const timer = window.setTimeout(() => done({ result: "none" }), timeoutMs);
    window.addEventListener(SUBMIT_RESULT_EVENT, onResult);
    window.dispatchEvent(new CustomEvent(SUBMIT_EVENT, { detail: { id, given } }));
  });
}

export function replyToSubmit(id: number, outcome: SubmitOutcome): void {
  window.dispatchEvent(new CustomEvent(SUBMIT_RESULT_EVENT, { detail: { id, outcome } }));
}

/**
 * The answer inside a message, when the message is one: "-63", "x = 4",
 * "is it 2/3?", "my answer is B", "I got 12", "step 2". Anything longer or
 * chattier is a question for Archie, not an answer.
 */
export function answerInMessage(text: string): string | null {
  const t = text.trim().replace(/[?!.]+$/, "").trim();
  if (!t || t.length > 40) return null;
  const m = t.match(/^(?:(?:so\s+)?(?:my answer is|the answer is|answer is|answer:|i got|i get|is it|it'?s|is the answer)\s*:?\s*)?(.+)$/i);
  const core = (m?.[1] ?? t).trim();
  if (/^step\s*\d$/i.test(core)) return core;
  if (/^[a-d]$/i.test(core)) return core;
  // Math-looking: digits, a variable assignment, roots, i, fractions, signs, simple expressions.
  if (/^[a-z]?\s*[=≈]?\s*[-−+]?[\d.,/√∛πi()\s+−\-×*^²³xy]+$/i.test(core) && /[\d√∛π]/.test(core)) return core;
  return null;
}
