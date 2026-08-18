"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { dismissLoginPrompt, getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";

/**
 * One-line reminder for signed-out visitors that lessons are open but practice
 * needs a free account. Disappears for good once dismissed or signed in.
 */
export function LoginBanner() {
  const { user, configured, loading } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    function refresh() {
      setDismissed(getProgress().loginPromptDismissed);
    }
    refresh();
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  if (user || loading || !configured || dismissed) return null;

  function handleDismiss() {
    dismissLoginPrompt();
    setDismissed(true);
  }

  return (
    <div className="border-b border-bridge-100 bg-bridge-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Lessons are free to watch.</span>{" "}
          Create a free account to practice, track your skills, and join your class.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/login" className="btn-primary btn-sm">
            Create free account
          </Link>
          <button type="button" onClick={handleDismiss} className="btn-ghost btn-sm">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
