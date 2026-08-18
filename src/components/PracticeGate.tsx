"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { RealNameForm } from "@/components/RealNameForm";

interface PracticeGateProps {
  children: React.ReactNode;
  /** What the student is trying to do, used in the prompt copy. */
  activity?: string;
  /**
   * Reassurance line about what's still free here. Only pass it where it's
   * true — a lesson page has a video above the gate, /review doesn't.
   */
  freeNote?: string;
}

/**
 * Practice on AlgeBridge requires an account under the student's real name.
 *
 * Lessons and videos stay open so anyone can look around, but anything that
 * records progress — practice problems, graded visual exercises, review — goes
 * through here, because that progress belongs to a named student on a teacher's
 * roster.
 */
export function PracticeGate({ children, activity = "practice", freeNote }: PracticeGateProps) {
  const { user, configured, loading, needsRealName } = useAuth();
  const pathname = usePathname();

  // With no cloud backend there are no accounts to require — a local-only
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
    return (
      <div className="panel">
        <div className="panel-head">
          <p className="panel-title">Sign in to {activity}</p>
          <span className="badge-brand">Free account</span>
        </div>
        <div className="panel-body space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Practice is saved to your account so your work counts toward your
            skills, your teacher can see how you&apos;re doing, and nothing is lost
            when you switch devices. Creating an account takes about 20 seconds
            and it&apos;s free.
          </p>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li className="flex gap-2">
              <span aria-hidden className="text-bridge-600">
                ✓
              </span>
              Your progress follows you to any computer or phone
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-bridge-600">
                ✓
              </span>
              Join your teacher&apos;s class with a 6-character code
            </li>
            <li className="flex gap-2">
              <span aria-hidden className="text-bridge-600">
                ✓
              </span>
              Message a real tutor when you get stuck
            </li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href={`/login?next=${encodeURIComponent(pathname ?? "/")}`}
              className="btn-primary"
            >
              Create free account
            </Link>
            <Link
              href={`/login?mode=signin&next=${encodeURIComponent(pathname ?? "/")}`}
              className="btn-secondary"
            >
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
          <p className="text-sm leading-relaxed text-slate-600">
            AlgeBridge uses real names, not usernames — your teacher has to be
            able to find you on their roster, and tutors join calls with you by
            name. Add yours to start practicing.
          </p>
          <RealNameForm />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
