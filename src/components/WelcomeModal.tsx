"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getProgress, markOnboarded } from "@/lib/progress";

const STEPS = [
  {
    emoji: "🎬",
    title: "Watch a short video",
    body: "Every skill starts with a quick lesson from a top math teacher on YouTube.",
  },
  {
    emoji: "📐",
    title: "Visualize it",
    body: "Spot the correct graph to build real intuition — it's quick, and it really helps the math click.",
  },
  {
    emoji: "✏️",
    title: "Practice a few problems",
    body: "Answer at least 3 problems with 80%+ correct to complete a skill. Stuck? Message a real tutor any time from the Tutors page — they can even hop on a video call with you.",
  },
  {
    emoji: "🏆",
    title: "Earn XP, streaks & badges",
    body: "Every correct answer earns XP, levels you up, and can unlock fun badges. Keep a daily streak going!",
  },
];

export function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!getProgress().onboarded) {
      setVisible(true);
    }
  }, []);

  function close() {
    markOnboarded();
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4">
      <div className="animate-modal-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <Image
            src="/brand/logo-icon.png"
            alt="AlgeBridge"
            width={64}
            height={64}
            className="animate-gentle-bounce mx-auto"
          />
          <h2 className="mt-3 font-display text-xl tracking-wide text-slate-900">Welcome to AlgeBridge!</h2>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s how to make the most of your algebra journey.
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-bridge-50 p-5 text-center">
          <span className="text-4xl">{current.emoji}</span>
          <h3 className="mt-2 font-bold text-slate-900">{current.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{current.body}</p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5">
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
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="btn-primary flex-1"
          >
            {isLast ? "Let's go! 🚀" : "Next"}
          </button>
        </div>
        {!isLast && (
          <button
            type="button"
            onClick={close}
            className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
