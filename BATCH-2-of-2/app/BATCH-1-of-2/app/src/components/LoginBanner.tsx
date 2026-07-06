"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dismissLoginPrompt, getProgress, PROGRESS_UPDATED_EVENT } from "@/lib/progress";

export function LoginBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function refresh() {
      const progress = getProgress();
      const hasActivity = Object.keys(progress.skills).length > 0;
      setVisible(hasActivity && !progress.loginPromptDismissed);
    }
    refresh();
    window.addEventListener(PROGRESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, refresh);
  }, []);

  if (!visible) return null;

  function handleDismiss() {
    dismissLoginPrompt();
    setVisible(false);
  }

  return (
    <div className="border-b border-span-200 bg-gradient-to-r from-span-50 to-bridge-50">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden>
            💾
          </span>
          <div>
            <p className="font-semibold text-slate-800">
              Your progress is saved on this device
            </p>
            <p className="text-sm text-slate-600">
              Create a free account to sync across devices and never lose your
              bridge progress.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/login" className="btn-primary text-sm">
            Create Free Account
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="btn-secondary text-sm"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
