"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { isActivePath, type NavItem, type NavSection } from "@/lib/nav";
import { useAppNavState } from "@/components/AppNavProvider";
import { UnitMark } from "@/components/UnitMark";
import { hueVars, unitHue } from "@/lib/hues";
import { navForSchool, schoolModeNow } from "@/lib/school-mode";
import { useSchoolMode } from "@/components/SchoolModePanel";

/**
 * "For schools" sits in Help, beside Feedback, for a visiting teacher or
 * district. Shared with the mobile sheet so the two lists stay the same.
 * In school mode the pages it turns off leave the menu too
 * (src/lib/school-mode.ts); the mobile sheet passes nothing and gets the
 * switch as it stands when the sheet renders: the build's, or a
 * school-managed account's (read after sign-in), or a developer's preview.
 */
const FOR_SCHOOLS: NavItem = { href: "/schools", label: "For schools", icon: "school" };

export function withSchoolsLink(sections: NavSection[], school: boolean = schoolModeNow()): NavSection[] {
  return navForSchool(sections, school).map((section) =>
    section.title === "Help" && !section.items.some((item) => item.href === FOR_SCHOOLS.href)
      ? { ...section, items: [...section.items, FOR_SCHOOLS] }
      : section
  );
}

/**
 * Persistent left rail on desktop. Keeps the course, the classroom and the
 * rewards features one click apart, which is what makes AlgeBridge feel like a
 * place you study rather than a series of pages.
 */
export function SideNav() {
  const pathname = usePathname();
  const { sections, continueTarget } = useAppNavState();
  const school = useSchoolMode();

  return (
    <aside aria-label="Site menu" className="fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-5"
      >
        <Image src="/brand/logo-icon.png" alt="" width={26} height={26} />
        <span className="font-display text-lg tracking-wide text-slate-900">AlgeBridge</span>
      </Link>

      <nav aria-label="Main" data-lenis-prevent className="flex-1 overflow-y-auto px-3 py-4">
        {withSchoolsLink(sections, school).map((section) => (
          <NavGroup key={section.title} section={section} pathname={pathname} />
        ))}
      </nav>

      {continueTarget && (
        <div className="border-t border-slate-200 p-3" style={hueVars(unitHue(continueTarget.unitId))}>
          {/* Where the student is, in that unit's color, with one tap to get back. */}
          <Link
            href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
            className="hue-banner flex items-center gap-3 rounded-xl px-3 py-3 transition duration-150 ease-out hover:brightness-110"
          >
            <span className="hue-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <UnitMark unitId={continueTarget.unitId} size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide">Continue</span>
              <span className="block truncate text-sm font-semibold">{continueTarget.skillTitle}</span>
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}

function NavGroup({ section, pathname }: { section: NavSection; pathname: string | null }) {
  if (section.items.length === 0) return null;
  return (
    <div className="mb-5 last:mb-0">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {section.title}
      </p>
      <ul className="space-y-0.5">
        {section.items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out ${
                  active
                    ? "bg-bridge-50 text-bridge-700 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-bridge-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon name={item.icon} className={active ? "text-bridge-600" : "text-slate-400"} />
                <span className="truncate">{item.label}</span>
                {!!item.badge && item.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-bridge-600 px-1.5 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
