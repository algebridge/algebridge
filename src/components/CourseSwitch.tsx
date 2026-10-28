"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COURSES, courseOfUnit, type CourseId } from "@/data/curriculum";
import { Icon } from "@/components/Icon";

const KEY = "algebridge:course";

const COURSE_LINKS: { id: CourseId; name: string; subject: string; href: string }[] = [
  { id: "algebra-1", name: "AlgeBridge 1", subject: "Algebra 1", href: "/" },
  { id: "algebra-2", name: "AlgeBridge 2", subject: "Algebra 2", href: "/algebra-2" },
];

/** The course a page belongs to, or null for a page outside both (games, house). */
function courseOfPath(pathname: string | null): CourseId | null {
  if (!pathname) return null;
  if (pathname === "/") return "algebra-1";
  if (pathname === "/algebra-2") return "algebra-2";
  const page = pathname.match(/^\/(?:unit|learn)\/([^/]+)/);
  return page ? courseOfUnit(page[1])?.id ?? null : null;
}

/**
 * The course the current page belongs to; on a page outside both courses,
 * the last one opened. The course menu, the header progress and Continue
 * all follow it.
 */
export function useCurrentCourse(): CourseId {
  const pathname = usePathname();
  const here = courseOfPath(pathname);
  const [last, setLast] = useState<CourseId>("algebra-1");

  useEffect(() => {
    try {
      if (here) localStorage.setItem(KEY, here);
      else setLast(localStorage.getItem(KEY) === "algebra-2" ? "algebra-2" : "algebra-1");
    } catch {
      // Storage blocked: the menu still works, it just forgets.
    }
  }, [here]);

  return here ?? last;
}

/**
 * The logo and the course name, top left. The logo goes to the course's home;
 * the name opens a menu to switch between AlgeBridge 1 and AlgeBridge 2.
 */
export function CourseSwitch({ size = "base", className = "" }: { size?: "base" | "lg"; className?: string }) {
  const current = useCurrentCourse();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const course = COURSE_LINKS.find((c) => c.id === current) ?? COURSE_LINKS[0];

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative flex min-w-0 items-center gap-2 ${className}`}>
      <Link href={course.href} aria-label={`${course.name} home`} className="shrink-0">
        <Image src="/brand/logo-icon.png" alt="" width={26} height={26} />
      </Link>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Course: ${course.name}. Switch course`}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 items-center gap-1 rounded-lg py-1 pl-1 pr-1.5 transition-colors duration-150 ease-out hover:bg-slate-100"
      >
        <span className={`truncate font-display tracking-wide text-slate-900 ${size === "lg" ? "text-lg" : "text-base"}`}>
          {course.name}
        </span>
        <Icon
          name="chevron-down"
          size={16}
          className={`shrink-0 text-slate-500 transition-transform duration-150 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Courses"
          className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-lg"
        >
          {COURSE_LINKS.map((c) => {
            const on = c.id === current;
            const units = COURSES.find((k) => k.id === c.id)?.units ?? [];
            const skills = units.reduce((sum, u) => sum + u.skills.length, 0);
            return (
              <Link
                key={c.id}
                href={c.href}
                role="menuitem"
                aria-current={on ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ease-out ${
                  on ? "bg-bridge-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block font-display text-base tracking-wide ${on ? "text-bridge-700" : "text-slate-900"}`}>
                    {c.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {c.subject} · {units.length} units · {skills} skills
                  </span>
                </span>
                {on && <Icon name="check" size={16} className="shrink-0 text-bridge-600" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
