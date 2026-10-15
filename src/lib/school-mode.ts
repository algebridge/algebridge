/**
 * School mode: one switch a district deployment turns on.
 *
 * NEXT_PUBLIC_SCHOOL_MODE="1" turns it on; anything else, or nothing, leaves
 * it off. It is read when the app is built (Next inlines NEXT_PUBLIC_ values),
 * so changing it needs a new deploy, and a student cannot turn it off from
 * their browser.
 *
 * When it is on, the parts of AlgeBridge where a student talks to or is seen
 * by people outside their class are hidden from the menus, and their pages
 * show a short "Turned off for school accounts" panel instead:
 * direct messages, group chats, video calls, the tutor directory and
 * booking, the leaderboard, and the games built around real teammates.
 * Archie stays, in his Tutor and Formulas modes, without booking.
 *
 * The /schools page states exactly this list; SCHOOL_MODE_OFF below is
 * where both read it from, so the two cannot drift.
 */

export function schoolModeFrom(value: unknown): boolean {
  return typeof value === "string" && value.trim() === "1";
}

/** The switch, as this build was made. */
export const SCHOOL_MODE: boolean = schoolModeFrom(process.env.NEXT_PUBLIC_SCHOOL_MODE);

export type SchoolFeature = "messages" | "groups" | "calls" | "tutors" | "booking" | "leaderboard" | "games";

/** What school mode turns off, in the words /schools uses. Order is the order shown. */
export const SCHOOL_MODE_OFF: { feature: SchoolFeature; name: string; detail: string }[] = [
  { feature: "messages", name: "Direct messages", detail: "Messages between students and tutors or teachers, the side menu link to them, and the unread count." },
  { feature: "groups", name: "Group chats", detail: "AlgeGroups and every other group chat." },
  { feature: "calls", name: "Video calls", detail: "Call rooms, and incoming call rings are not listened for." },
  { feature: "tutors", name: "The tutor directory", detail: "Find a tutor, the tutors' list of students, and the tutors' workspace of help requests." },
  { feature: "booking", name: "Booking a tutor", detail: "Archie's Book a tutor mode and the tutoring calendar. When a student asks Archie for a person, he points them to their teacher instead." },
  { feature: "leaderboard", name: "The leaderboard", detail: "The page is hidden, and a student's progress is not added to it." },
  { feature: "games", name: "The team games", detail: "The games built around real teammates, and their banner on the course page." },
];

/** What stays on, for the same page. */
export const SCHOOL_MODE_STAYS =
  "Lessons, practice, review, the notebook, achievements, Bridgey House, classes and assignments, and Archie in his Tutor and Formulas modes.";

/** Pages (and everything under them) that school mode turns off. */
export const SCHOOL_OFF_PATHS: Record<string, SchoolFeature> = {
  "/messages": "messages",
  "/groups": "groups",
  "/room": "calls",
  "/tutors": "tutors",
  "/tutor-hub": "tutors",
  // The tutors' workspace lists every open help request, so a tutor made with
  // the shared code on a school build must not reach it either.
  "/workspace": "tutors",
  "/calendar": "booking",
  "/leaderboard": "leaderboard",
  "/games": "games",
};

/** The feature a path belongs to, when school mode turns it off. */
export function featureForPath(pathname: string | null | undefined): SchoolFeature | null {
  if (!pathname) return null;
  for (const [base, feature] of Object.entries(SCHOOL_OFF_PATHS)) {
    if (pathname === base || pathname.startsWith(`${base}/`)) return feature;
  }
  return null;
}

/**
 * Parts of the app a teacher can turn off for their class
 * (src/lib/class-controls.ts). Everything school mode turns off, plus
 * Bridgey House and Archie.
 */
export type ClassFeature = SchoolFeature | "house" | "archie";

/** Pages a teacher's class controls can turn off. */
const CLASS_OFF_PATHS: Record<string, ClassFeature> = { ...SCHOOL_OFF_PATHS, "/house": "house" };

export function classFeatureForPath(pathname: string | null | undefined): ClassFeature | null {
  if (!pathname) return null;
  for (const [base, feature] of Object.entries(CLASS_OFF_PATHS)) {
    if (pathname === base || pathname.startsWith(`${base}/`)) return feature;
  }
  return null;
}

/**
 * Menu sections with the turned-off pages taken out, and any section left
 * empty dropped: school mode's pages when it is on, and whatever the
 * student's teacher turned off.
 */
export function navForSchool<S extends { items: { href: string }[] }>(
  sections: S[],
  on: boolean,
  blocked: ReadonlySet<ClassFeature> = classBlockedNow()
): S[] {
  if (!on && blocked.size === 0) return sections;
  const off = (href: string) => {
    if (on && featureForPath(href) !== null) return true;
    const f = classFeatureForPath(href);
    return f !== null && blocked.has(f);
  };
  return sections
    .map((s) => ({ ...s, items: s.items.filter((item) => !off(item.href)) }))
    .filter((s) => s.items.length > 0);
}

/** How each turned-off feature is named in the panel's heading. */
export const SCHOOL_FEATURE_NAMES: Record<SchoolFeature, string> = {
  messages: "Messages",
  groups: "Group chats",
  calls: "Video calls",
  tutors: "Tutors",
  booking: "Booking a tutor",
  leaderboard: "The leaderboard",
  games: "The team games",
};

/**
 * What Archie says, in school mode, instead of offering to book a tutor.
 * Fixed text, like the booking offer it replaces.
 */
export const SCHOOL_ESCALATION_REPLY =
  "That sounds like it needs a person, not a hint. Your teacher is the best person to ask, so show them this problem. I can still give you a hint on the first step.";

/**
 * In development only, a browser can preview school mode without a rebuild:
 * localStorage "algebridge:school-mode-preview" = "1". A production build
 * drops this (NODE_ENV is "production" there), so it can only ever turn
 * school mode on for a developer, never off for a student.
 */
export const SCHOOL_MODE_PREVIEW_KEY = "algebridge:school-mode-preview";
export const SCHOOL_MODE_EVENT = "algebridge:school-mode";

export function schoolModePreview(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SCHOOL_MODE_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * School mode for one account, wherever it signs in. supabase/
 * schema-2026-10-03-safety.sql adds profiles.managed, set when a student
 * joins a teacher's class; the same student at learn.algebridge.org then
 * gets the school build's menus, and the database itself refuses messages
 * and calls to them from anyone but their teacher. The app reads the flag
 * after sign-in (src/lib/social.ts loadManagedFlag) and sets it here; it is
 * cleared on sign-out. Only ever turns school mode on, never off.
 */
let managedAccount = false;

export function setManagedAccount(on: boolean): void {
  if (managedAccount === on) return;
  managedAccount = on;
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SCHOOL_MODE_EVENT));
  } catch {
    /* no window in tests */
  }
}

export function managedAccountNow(): boolean {
  return managedAccount;
}

/**
 * What this student's teachers turned off, read after sign-in
 * (src/components/ClassControlsLoader.tsx), cleared on sign-out.
 */
let classBlocked: ReadonlySet<ClassFeature> = new Set();

export function setClassBlocked(features: Iterable<ClassFeature>): void {
  const next = new Set(features);
  if (next.size === classBlocked.size && [...next].every((f) => classBlocked.has(f))) return;
  classBlocked = next;
  try {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SCHOOL_MODE_EVENT));
  } catch {
    /* no window in tests */
  }
}

export function classBlockedNow(): ReadonlySet<ClassFeature> {
  return classBlocked;
}

/** The switch in this browser: the build's, a school-managed account's, or a developer's preview. */
export function schoolModeNow(): boolean {
  return SCHOOL_MODE || managedAccount || schoolModePreview();
}
