import type { IconName } from "@/components/Icon";
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

  const learn: NavItem[] = [
    { href: "/", label: "Course", icon: "course" },
    { href: "/review", label: "Review", icon: "review", badge: reviewCount },
    { href: "/notebook", label: "Notebook", icon: "notebook" },
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

  const progress: NavItem[] = [
    { href: "/achievements", label: "Achievements", icon: "trophy" },
    { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    { href: "/house", label: "Bridgey House", icon: "house" },
  ];

  const sections: NavSection[] = [
    { title: "Learn", items: learn },
    { title: "Classroom", items: classroom },
    { title: "Progress", items: progress },
  ];

  if (isAdmin) {
    sections.push({ title: "Staff", items: [{ href: "/admin", label: "Admin", icon: "admin" }] });
  }

  return sections;
}

/** Is `href` the section the user is currently in? */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/" || pathname.startsWith("/unit") || pathname.startsWith("/learn");
  return pathname === href || pathname.startsWith(`${href}/`);
}
