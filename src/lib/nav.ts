import type { IconName } from "@/components/Icon";
import { courseOfUnit } from "@/data/curriculum";
import type { UserRole } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavContext {
  signedIn: boolean;
  role: UserRole;
  isAdmin: boolean;
  reviewCount: number;
  unreadCount: number;
}

/**
 * The single source of truth for the app's navigation, shared by the desktop
 * sidebar and the mobile sheet so the two can never drift apart.
 */
export function buildNav({
  signedIn,
  role,
  isAdmin,
  reviewCount,
  unreadCount,
}: NavContext): NavSection[] {
  const isTeacher = role === "teacher";
  const isTutor = role === "tutor";

  // Most used first. Course, the games and the house are where visitors go
  // (the admin console's busiest pages, Oct 2026), so they lead; the pages
  // few people open come last, under More.
  const learn: NavItem[] = [
    { href: "/", label: "Course", icon: "course" },
    { href: "/games", label: "Games", icon: "play" },
    { href: "/review", label: "Review", icon: "review", badge: reviewCount },
  ];

  const rewards: NavItem[] = [
    { href: "/house", label: "Bridgey House", icon: "house" },
    { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { href: "/achievements", label: "Achievements", icon: "trophy" },
  ];

  const classroom: NavItem[] = [];
  if (isTeacher) classroom.push({ href: "/teacher", label: "My classes", icon: "teach" });
  else classroom.push({ href: "/classes", label: "My classes", icon: "classes" });
  if (isTutor) classroom.push({ href: "/tutor-hub", label: "Students", icon: "students" });
  else classroom.push({ href: "/tutors", label: "Find a tutor", icon: "tutors" });
  if (signedIn) {
    classroom.push({ href: "/messages", label: "Messages", icon: "messages", badge: unreadCount });
    classroom.push({ href: "/groups", label: "Group chats", icon: "groups" });
  }
  // The shared tutoring calendar. Staff only, students have no view yet.
  if (isTutor || isAdmin) classroom.push({ href: "/calendar", label: "Calendar", icon: "clock" });

  const more: NavItem[] = [
    { href: "/notebook", label: "Notebook", icon: "notebook" },
    { href: "/feedback", label: "Feedback", icon: "hint" },
  ];
  // The welcome tour again, for a visitor who skipped it (components/WelcomeTour.tsx).
  if (!signedIn) more.push({ href: "/?tour=1", label: "Take the tour", icon: "spark" });

  const sections: NavSection[] = [
    { title: "Learn", items: learn },
    { title: "Rewards", items: rewards },
    { title: "Classroom", items: classroom },
    { title: "More", items: more },
  ];

  if (isTutor || isAdmin) {
    const staff: NavItem[] = [{ href: "/workspace", label: "Workspace", icon: "teach" }];
    if (isAdmin) staff.push({ href: "/admin", label: "Admin", icon: "admin" });
    sections.push({ title: "Staff", items: staff });
  }

  return sections;
}

/** Is `href` the section the user is currently in? */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // A unit or lesson page lights up its own course's entry.
  if (href === "/" || href === "/algebra-2") {
    const page = pathname.match(/^\/(?:unit|learn)\/([^/]+)/);
    const course = page ? courseOfUnit(page[1])?.id : null;
    if (href === "/") return pathname === "/" || course === "algebra-1";
    return pathname === "/algebra-2" || course === "algebra-2";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
