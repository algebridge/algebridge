"use client";

import { AuthGate } from "@/components/AuthGate";
import { units } from "@/data/curriculum";

const TOTAL_UNITS = units.length;
const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);

const BULLETS = [
  `All ${TOTAL_UNITS} units and ${TOTAL_SKILLS} skills, free with no ads`,
  "Every lesson video and practice problem unlocks",
  "Your progress saves and follows you to any computer or phone",
  "Join your teacher's class, or message a real tutor when you're stuck",
];

/**
 * The course itself is behind a free account: the outline, the units, and the
 * lessons. Signed-out visitors still get the pitch above this gate on each
 * page, so they can see what they're signing up for before they do.
 */
export function CourseGate({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate
      title="Sign up to open the course"
      blurb="The whole Algebra 1 course is free. The account is what makes it yours: lessons unlock, your work saves as you go, and your teacher or tutor can see where you are. It takes about 20 seconds."
      bullets={BULLETS}
      badge="Free forever"
      nameBlurb="AlgeBridge uses real names, not usernames. Your teacher has to be able to find you on their roster, and tutors join calls with you by name. Add yours to open the course."
    >
      {children}
    </AuthGate>
  );
}
