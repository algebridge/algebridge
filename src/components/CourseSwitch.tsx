"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { courseOfUnit } from "@/data/curriculum";

const KEY = "algebridge:course";

const COURSE_LINKS = [
  { id: "algebra-1", n: "1", href: "/", label: "AlgeBridge 1, Algebra 1" },
  { id: "algebra-2", n: "2", href: "/algebra-2", label: "AlgeBridge 2, Algebra 2" },
] as const;

/** The course a page belongs to, or null for a page outside both (games, house). */
function courseOfPath(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname === "/") return "algebra-1";
  if (pathname === "/algebra-2") return "algebra-2";
  const page = pathname.match(/^\/(?:unit|learn)\/([^/]+)/);
  return page ? courseOfUnit(page[1])?.id ?? null : null;
}

/**
 * The 1 | 2 beside the logo, top left: one tap between AlgeBridge 1 and
 * AlgeBridge 2. On a page outside both courses it shows the last one opened.
 */
export function CourseSwitch({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const here = courseOfPath(pathname);
  const [last, setLast] = useState<string>("algebra-1");

  useEffect(() => {
    try {
      if (here) localStorage.setItem(KEY, here);
      else setLast(localStorage.getItem(KEY) ?? "algebra-1");
    } catch {
      // Storage blocked: the switch still works, it just forgets.
    }
  }, [here]);

  const current = here ?? last;
  return (
    <div role="group" aria-label="Course" className={`flex shrink-0 rounded-lg bg-slate-100 p-0.5 ${className}`}>
      {COURSE_LINKS.map((c) => {
        const on = c.id === current;
        return (
          <Link
            key={c.id}
            href={c.href}
            aria-label={c.label}
            aria-current={on ? "page" : undefined}
            title={c.label}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-sm font-semibold transition-colors duration-150 ease-out ${
              on ? "bg-white text-bridge-700 shadow-sm" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {c.n}
          </Link>
        );
      })}
    </div>
  );
}
