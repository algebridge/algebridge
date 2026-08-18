"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { buildNav, isActivePath, type NavSection } from "@/lib/nav";
import { useAppNavState } from "@/components/AppNavProvider";

/**
 * Persistent left rail on desktop. Keeps the course, the classroom and the
 * rewards features one click apart, which is what makes AlgeBridge feel like a
 * place you study rather than a series of pages.
 */
export function SideNav() {
  const pathname = usePathname();
  const { sections, continueTarget } = useAppNavState();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200 px-5"
      >
        <Image src="/brand/logo-icon.png" alt="" width={26} height={26} />
        <span className="font-display text-lg tracking-wide text-slate-900">AlgeBridge</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <NavGroup key={section.title} section={section} pathname={pathname} />
        ))}
      </nav>

      {continueTarget && (
        <div className="border-t border-slate-200 p-3">
          <Link
            href={`/learn/${continueTarget.unitId}/${continueTarget.skillId}`}
            className="btn-primary w-full"
          >
            Continue learning
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
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
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
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-bridge-50 text-bridge-700"
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
