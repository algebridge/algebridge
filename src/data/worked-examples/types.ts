/**
 * A problem solved in front of the student before they practice: the
 * "See it done" step of every lesson. One per kind of problem the skill's
 * practice deals, each step with the work and the reason for it.
 *
 * `card` is written exactly the way the skill's generator writes that kind
 * of problem, so the same independent solver that checks practice problems
 * (npm run test:problems) checks every worked example's answer.
 */
export interface WorkedStep {
  /** The math written on this line. */
  work: string;
  /** Why this step, in plain words: what is being done and the reason it is allowed or useful (one or two sentences). */
  why: string;
}

export interface WorkedExample {
  /** What kind of problem this is, e.g. "Multiplying two negative roots". */
  kind: string;
  /** Before any work: what the problem tells us, what it asks for, and the plan, in plain words (one or two sentences). */
  plan?: string;
  /** After the answer: putting it back in (or another quick test) to show it is right, with the numbers. */
  check?: string;
  card: {
    type: "numeric" | "multiple-choice";
    prompt: string;
    answer: string | number;
    choices?: string[];
    decimalPlaces?: number;
  };
  steps: WorkedStep[];
  /** The answer as the student would write it. */
  answer: string;
}

export type WorkedExamples = Record<string, WorkedExample[]>;
