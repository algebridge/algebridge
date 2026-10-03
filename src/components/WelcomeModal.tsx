"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { isBareRoute } from "@/lib/bare-route";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getProgress, markOnboarded } from "@/lib/progress";
import { Icon, type IconName } from "@/components/Icon";
import { useDialogFocus } from "@/components/useDialogFocus";

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "play",
    title: "Watch a short video",
    body: "Every skill starts with a short YouTube lesson from a math teacher who explains it clearly.",
  },
  {
    icon: "check",
    title: "Practice until it clicks",
    body: "Get five right on the first try and the skill is done. Every one you get stays banked, even after a miss. Stuck? Ask Archie, your AI study buddy, or message a real tutor from the Tutors page.",
  },
  {
    icon: "lock",
    title: "Follow your path",
    body: "Skills open in order, each one building on the last. Know one already? Show what you know and it opens early. XP and a daily streak track your work as you go.",
  },
];

export function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  // Opens once there is an account to welcome (or when accounts are off and
  // the app is local), never on top of the sign-up pitch a visitor sees
  // first, and never on a bare route.
  const { user, configured, loading } = useAuth();
  const pathname = usePathname();
  useEffect(() => {
    if (loading || (configured && !user) || isBareRoute(pathname)) return;
    if (!getProgress().onboarded) setVisible(true);
  }, [user, configured, loading, pathname]);

  function close() {
    markOnboarded();
    setVisible(false);
  }

  // Keyboard: focus starts on the main button, Tab stays in the card, Escape skips the intro.
  const cardRef = useRef<HTMLDivElement>(null);
  useDialogFocus(cardRef, visible, close);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4">
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="animate-modal-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="text-center">
          <Image
            src="/brand/logo-icon.png"
            alt=""
            width={64}
            height={64}
            className="animate-gentle-bounce mx-auto"
          />
          <h2 id="welcome-title" className="mt-3 font-display text-2xl tracking-wide text-slate-900">Welcome to AlgeBridge</h2>
          <p className="mt-1 text-sm text-slate-500">Here is how every skill works, in three steps.</p>
        </div>

        {/* Next swaps this card in place, so it is read out when it changes. */}
        <div className="mt-6 rounded-2xl bg-bridge-50 p-5 text-center" aria-live="polite">
          <span className="sr-only">
            Step {step + 1} of {STEPS.length}.{" "}
          </span>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-bridge-600 shadow-panel ring-1 ring-bridge-100">
            <Icon name={current.icon} size={24} />
          </span>
          <h3 className="mt-3 font-bold text-slate-900">{current.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{current.body}</p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-bridge-600" : "w-1.5 bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-secondary flex-1">
              Back
            </button>
          )}
          <button
            type="button"
            data-autofocus
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="btn-primary flex-1"
          >
            {isLast ? "Start learning" : "Next"}
          </button>
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full py-1.5 text-center text-xs text-slate-400 hover:text-slate-600"
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
