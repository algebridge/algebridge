"use client";

import { useEffect, useState } from "react";
import type { Skill } from "@/types";
import { getVisualExercise } from "@/data/visual-exercises";
import { DiagramView } from "@/components/visuals/DiagramView";
import { VisualExplorer } from "@/components/visuals/VisualExplorer";
import { markVisualCompleted } from "@/lib/progress";
import { fireConfetti, showToast } from "@/lib/notify";
import { useSound } from "@/hooks/useSound";
import { Mascot } from "@/components/Mascot";

interface VisualizeExerciseProps {
  skill: Skill;
  onCompleted?: () => void;
}

type Tab = "explore" | "quiz";

export function VisualizeExercise({ skill, onCompleted }: VisualizeExerciseProps) {
  const [tab, setTab] = useState<Tab>("explore");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("explore")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            tab === "explore" ? "bg-white text-bridge-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🔎 Explore
        </button>
        <button
          type="button"
          onClick={() => setTab("quiz")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            tab === "quiz" ? "bg-white text-bridge-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🎯 Quiz
        </button>
      </div>

      {tab === "explore" ? (
        <div>
          <p className="mb-4 text-sm text-slate-500">
            Move the controls and watch the math change — build a picture in your head before you solve.
          </p>
          <VisualExplorer skill={skill} />
        </div>
      ) : (
        <SpotTheGraphQuiz skill={skill} onCompleted={onCompleted} />
      )}
    </div>
  );
}

function SpotTheGraphQuiz({ skill, onCompleted }: VisualizeExerciseProps) {
  const [nonce, setNonce] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [feedbackSeed, setFeedbackSeed] = useState(0);
  const { playCorrect, playWrong } = useSound();

  const exercise = getVisualExercise(skill.id, nonce);

  useEffect(() => {
    setSelectedId(null);
    setFeedback(null);
  }, [exercise.skillId, nonce]);

  function handlePick(optionId: string) {
    if (feedback === "correct") return;
    setSelectedId(optionId);
    const correct = optionId === exercise.correctOptionId;
    setFeedback(correct ? "correct" : "wrong");
    setFeedbackSeed((s) => s + 1);

    if (correct) {
      playCorrect();
      const result = markVisualCompleted(skill.id);
      onCompleted?.();
      if (result.xpGained > 0) {
        fireConfetti("small");
        showToast({
          emoji: "📐",
          title: `+${result.xpGained} XP`,
          description: "Nice visualization work!",
        });
      }
      if (result.bridgeysGained > 0) {
        showToast({
          emoji: "🪙",
          title: `+${result.bridgeysGained} Bridgeys!`,
          description: "Spend them customizing your house.",
        });
      }
      for (const badge of result.newBadges) {
        showToast({ emoji: badge.emoji, title: `Badge unlocked: ${badge.title}`, description: badge.description });
      }
    } else {
      playWrong();
    }
  }

  function tryAnother() {
    setNonce((n) => n + 1);
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Spot the correct graph</p>
      <p className="mt-2 text-base font-medium leading-relaxed text-slate-800">{exercise.prompt}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        {exercise.options.map((option, i) => {
          const isSelected = selectedId === option.id;
          const isCorrectOption = option.id === exercise.correctOptionId;
          const revealCorrect = feedback && isCorrectOption;
          const revealWrong = feedback && isSelected && !isCorrectOption;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handlePick(option.id)}
              disabled={feedback === "correct"}
              aria-label={`Graph option ${i + 1}`}
              className={`group relative aspect-square rounded-xl border-2 bg-white p-2 text-slate-700 transition ${
                revealCorrect
                  ? "border-emerald-500 bg-emerald-50"
                  : revealWrong
                    ? "border-red-400 bg-red-50"
                    : "border-slate-200 hover:border-bridge-400 hover:bg-slate-50"
              } ${feedback === "correct" ? "cursor-default" : "cursor-pointer"}`}
            >
              <DiagramView spec={option.diagram} />
              {revealCorrect && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                  ✓
                </span>
              )}
              {revealWrong && (
                <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  ✕
                </span>
              )}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="mt-4">
          <Mascot state={feedback} seed={feedbackSeed} />
          <p className="mt-2 px-1 text-sm text-slate-600">
            {feedback === "correct" ? exercise.explanation : `💡 ${exercise.hint}`}
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {feedback !== "correct" ? (
          <p className="self-center text-xs text-slate-400">Tap a graph to check it.</p>
        ) : (
          <button type="button" onClick={tryAnother} className="btn-primary">
            Try another →
          </button>
        )}
        {feedback !== "correct" && (
          <button type="button" onClick={tryAnother} className="btn-secondary">
            ↻ New example
          </button>
        )}
      </div>
    </div>
  );
}
