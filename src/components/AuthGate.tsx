"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { RealNameForm } from "@/components/RealNameForm";

interface AuthGateProps {
  children: React.ReactNode;
  /** Panel heading, e.g. "Sign up to open the course". */
  title: string;
  /** One short paragraph on why the account exists. */
  blurb: string;
  /** Reasons to sign up, shown as a checklist. */
  bullets: string[];
  /** Badge in the panel head. */
  badge?: string;
  /**
   * Reassurance about what stays open without an account. Only pass it where
   * it's true, so the copy never promises something the page has gated.
   */
  freeNote?: string;
  /** Body copy for the "this account still has no real name" state. */
  nameBlurb?: string;
}

const DEFAULT_NAME_BLURB =
  "AlgeBridge uses real names, so your teacher can find you on their roster and tutors join calls with you by name. Add yours to continue.";

/**
 * The one place that decides whether a signed-out visitor sees content or a
 * sign-up wall. Both gates in the app (course content, practice) are this
 * component with different copy, so the two can never drift apart.
 */
export function AuthGate({
  children,
  title,
  blurb,
  bullets,
  badge = "Free account",
  freeNote,
  nameBlurb = DEFAULT_NAME_BLURB,
}: AuthGateProps) {
  const { user, configured, loading, needsRealName } = useAuth();
  const pathname = usePathname();

  // With no cloud backend there are no accounts to require, a local-only
  // deployment stays fully usable.
  if (!configured) return <>{children}</>;

  if (loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    );
  }

  if (!user) {
    const back = encodeURIComponent(pathname ?? "/");
    return (
      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">{title}</p>
          <span className="badge-brand">{badge}</span>
        </div>
        <div className="panel-body space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">{blurb}</p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {bullets.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden className="text-bridge-600">
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={`/login?next=${back}`} className="btn-primary">
              Create free account
            </Link>
            <Link href={`/login?mode=signin&next=${back}`} className="btn-secondary">
              I already have one
            </Link>
          </div>
          {freeNote && <p className="text-xs text-slate-500">{freeNote}</p>}
        </div>
      </div>
    );
  }

  if (needsRealName) {
    return (
      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Add your real name to continue</p>
        </div>
        <div className="panel-body space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">{nameBlurb}</p>
          <RealNameForm />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
