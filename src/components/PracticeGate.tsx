"use client";

import { AuthGate } from "@/components/AuthGate";

interface PracticeGateProps {
  children: React.ReactNode;
  /** What the student is trying to do, used in the prompt copy. */
  activity?: string;
  /**
   * Reassurance line about what's still free here. Only pass it where it's
   * true — /review has nothing above the gate to fall back to.
   */
  freeNote?: string;
}

const BULLETS = [
  "Your progress follows you to any computer or phone",
  "Join your teacher's class with a 6-character code",
  "Message a real tutor when you get stuck",
];

/**
 * Anything that records progress goes through here, because that progress
 * belongs to a named student on a teacher's roster. Course pages sit behind
 * CourseGate, so in practice this is the gate for standalone activities like
 * /review that a signed-in student can still reach without a real name.
 */
export function PracticeGate({ children, activity = "practice", freeNote }: PracticeGateProps) {
  return (
    <AuthGate
      title={`Sign in to ${activity}`}
      blurb="Practice is saved to your account so your work counts toward your skills, your teacher can see how you're doing, and nothing is lost when you switch devices. Creating an account takes about 20 seconds and it's free."
      bullets={BULLETS}
      freeNote={freeNote}
      nameBlurb="AlgeBridge uses real names, not usernames. Your teacher has to be able to find you on their roster, and tutors join calls with you by name. Add yours to start practicing."
    >
      {children}
    </AuthGate>
  );
}
