"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useClassBlocked } from "@/components/SchoolModePanel";

/**
 * The way into Test review from where a student lands after a test: the
 * course page and Review. Short and honest about what it does. Gone when a
 * teacher turned off AI help for the class, like the menu entry.
 */
export function TestReviewCard({ className = "" }: { className?: string }) {
  const blocked = useClassBlocked();
  if (blocked.has("archie")) return null;
  return (
    <Link href="/test-review" className={`card-link flex items-center gap-4 p-4 ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bridge-50 text-bridge-600" aria-hidden>
        <Icon name="check" size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-900">Got a test back?</span>
        <span className="block text-sm text-slate-600">
          Photograph it. See where each point went and why, then practice those exact skills.
        </span>
      </span>
      <Icon name="arrow-right" size={18} className="shrink-0 text-slate-400" />
    </Link>
  );
}
