"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getProgress, PROGRESS_UPDATED_EVENT, saveInterests } from "@/lib/progress";
import { InterestsPicker } from "@/components/InterestsPicker";

const OPEN_EVENT = "algebridge-open-interests";

/** Opens the picker from anywhere, e.g. the "Change" link on a practice problem. */
export function openInterestsPicker(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Asks a student what they are into, once: right after they sign up, or on
 * their first visit after this shipped. One mechanism covers email sign-up,
 * Google sign-up and every existing account, instead of three code paths.
 *
 * It waits for the welcome tour to finish, only asks students, and never
 * interrupts a video call. Skipping is remembered, so it does not nag; the
 * practice panel keeps a quiet link for later.
 */
export function InterestsPrompt() {
  const { user, profile, configured, loading, needsRealName } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const maybeAsk = () => {
      const progress = getProgress();
      if (progress.interests || !progress.onboarded) return;
      if (pathname?.startsWith("/room")) return;
      if (configured && (loading || !user || !profile || profile.role !== "student" || needsRealName)) return;
      setManual(false);
      setOpen(true);
    };
    maybeAsk();
    window.addEventListener(PROGRESS_UPDATED_EVENT, maybeAsk);
    return () => window.removeEventListener(PROGRESS_UPDATED_EVENT, maybeAsk);
  }, [pathname, configured, loading, user, profile, needsRealName]);

  useEffect(() => {
    const onOpen = () => {
      setManual(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function dismiss() {
    // Skipping the first ask is remembered. Cancelling a later edit changes nothing.
    if (!getProgress().interests) {
      saveInterests({
        picks: [],
        note: "",
        topics: [],
        source: "picks",
        updatedAt: new Date().toISOString(),
        skipped: true,
      });
    }
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interests-title"
    >
      <div
        data-lenis-prevent
        className="animate-modal-in max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <InterestsPicker
          initial={getProgress().interests}
          onDone={() => setOpen(false)}
          onSkip={dismiss}
          skipLabel={manual ? "Cancel" : "Skip for now"}
        />
      </div>
    </div>
  );
}
