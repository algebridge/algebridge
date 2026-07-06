"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MasteryLevel, Skill, Unit } from "@/types";
import { getNextSkill, getPrevSkill } from "@/data/curriculum";
import { VideoPlayer } from "@/components/VideoPlayer";
import { PracticePanel } from "@/components/PracticePanel";
import { VisualizeExercise } from "@/components/VisualizeExercise";
import { ProgressStatus } from "@/components/ProgressStatus";
import { ProgressBar } from "@/components/ProgressBar";
import {
  markVideoWatched,
  getSkillProgress,
  unlockSkill,
  getSkillPracticeStats,
  getUnitCompletion,
} from "@/lib/progress";
import { getBackupVideoForSkill, getVideoForSkill } from "@/data/videos";
import { useProgress } from "@/hooks/useProgress";
import { showToast } from "@/lib/notify";

interface LearnContentProps {
  unit: Unit;
  skill: Skill;
  unitId: string;
  skillId: string;
}

export function LearnContent({ unit, skill, unitId, skillId }: LearnContentProps) {
  const { stats, mounted } = useProgress();
  const [mastery, setMastery] = useState<MasteryLevel>("locked");
  const [videoWatched, setVideoWatched] = useState(false);
  const [visualized, setVisualized] = useState(false);
  const [practiceStats, setPracticeStats] = useState({
    attempted: 0,
    correct: 0,
    accuracy: 0,
    problemsNeeded: 3,
    isComplete: false,
  });

  function refreshSkillState() {
    const prog = getSkillProgress(skill.id);
    setMastery(prog.level);
    setVideoWatched(prog.videoWatched);
    setVisualized(!!prog.visualized);
    setPracticeStats(getSkillPracticeStats(skill.id));
  }

  useEffect(() => {
    unlockSkill(skill.id);
    refreshSkillState();
  }, [skill.id]);

  useEffect(() => {
    if (mounted) refreshSkillState();
  }, [mounted, stats.completedSkills, skill.id]);

  const prev = getPrevSkill(unitId, skillId);
  const next = getNextSkill(unitId, skillId);
  const video = getVideoForSkill(skill.id, skill.video);
  const backupVideo = getBackupVideoForSkill(skill.id) ?? skill.backupVideo;
  const unitProgress = mounted
    ? getUnitCompletion(unit.skills.map((s) => s.id))
    : { completed: 0, total: unit.skills.length, percent: 0 };
  const skillIndex = unit.skills.findIndex((s) => s.id === skillId) + 1;

  function handleVideoWatched() {
    const result = markVideoWatched(skill.id);
    refreshSkillState();
    if (result.xpGained > 0) {
      showToast({
        emoji: "🎬",
        title: `+${result.xpGained} XP`,
        description: "Nice — you watched the lesson video.",
      });
    }
    for (const badge of result.newBadges) {
      showToast({
        emoji: badge.emoji,
        title: `Badge unlocked: ${badge.title}`,
        description: badge.description,
      });
    }
  }

  function handleMasteryChange(level: MasteryLevel) {
    setMastery(level);
    setPracticeStats(getSkillPracticeStats(skill.id));
  }

  const isSkillComplete =
    mastery === "proficient" || mastery === "mastered";
  // If a student already nails the practice problems, don't force them to sit
  // through the video too — they've shown they know it.
  const videoStepSatisfied = videoWatched || isSkillComplete;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-bridge-600">Home</Link>
        <span className="mx-2">/</span>
        <Link href={`/unit/${unitId}`} className="hover:text-bridge-600">
          Unit {unit.number}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800">Skill {skillIndex}</span>
      </nav>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Unit {unit.number} · Skill {skillIndex} of {unit.skills.length}
          </p>
          <ProgressStatus level={mastery} />
        </div>
        <div className="mt-2">
          <ProgressBar
            value={unitProgress.completed}
            max={unitProgress.total}
            showFraction={false}
            size="sm"
          />
        </div>
      </div>

      <header>
        <h1 className="font-display text-2xl tracking-wide text-slate-900 sm:text-3xl">{skill.title}</h1>
        <p className="mt-2 text-slate-600">{skill.description}</p>
      </header>

      {/* 3-step checklist */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 ${
            videoStepSatisfied
              ? "border-emerald-200 bg-emerald-50"
              : "border-bridge-200 bg-bridge-50"
          }`}
        >
          <span className="text-xl">{videoStepSatisfied ? "✅" : "1️⃣"}</span>
          <div>
            <p className="font-medium text-slate-900">Watch the video</p>
            <p className="text-xs text-slate-500">
              {videoWatched
                ? "Done!"
                : isSkillComplete
                  ? "Skipped — you already know this!"
                  : "Start here (or skip if you already know it)"}
            </p>
          </div>
        </div>
        <div
          className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 ${
            visualized ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
          }`}
        >
          <span className="text-xl">{visualized ? "✅" : "2️⃣"}</span>
          <div>
            <p className="font-medium text-slate-900">Visualize it</p>
            <p className="text-xs text-slate-500">
              {visualized ? "Done!" : "Spot the correct graph (optional but helpful)"}
            </p>
          </div>
        </div>
        <div
          className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 ${
            isSkillComplete
              ? "border-emerald-200 bg-emerald-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <span className="text-xl">{isSkillComplete ? "✅" : "3️⃣"}</span>
          <div>
            <p className="font-medium text-slate-900">Practice problems</p>
            <p className="text-xs text-slate-500">
              {isSkillComplete
                ? "Skill complete!"
                : practiceStats.attempted === 0
                  ? "Answer 3 problems (80%+ correct)"
                  : `${practiceStats.correct}/${practiceStats.attempted} correct so far`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">Step 1: Watch</h2>
            <VideoPlayer
              video={video}
              backupVideo={backupVideo}
              onWatched={handleVideoWatched}
            />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">Step 2: Visualize</h2>
            <p className="mb-3 text-sm text-slate-500">
              Build intuition by matching the math to its picture — pick the graph that&apos;s actually correct.
            </p>
            <VisualizeExercise skill={skill} onCompleted={refreshSkillState} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-slate-900">Step 3: Practice</h2>
            <PracticePanel skill={skill} onMasteryChange={handleMasteryChange} />
          </section>
        </div>

        <aside className="lg:col-span-2">
          <div className="card sticky top-24 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900">What you&apos;ll learn</h3>
              <p className="mt-2 text-sm text-slate-600">{skill.learningGoal}</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Key idea</h3>
              <p className="mt-2 text-sm text-slate-600">{skill.keyIdea}</p>
            </div>
            <div className="rounded-xl bg-bridge-50 p-3 text-sm text-slate-600">
              <p className="font-medium text-slate-800">How to complete this skill:</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-xs">
                <li>Watch the video above</li>
                <li>Try the visualize exercise (optional)</li>
                <li>Answer at least 3 practice problems</li>
                <li>Get 80% or more correct</li>
              </ol>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Overall: {stats.completedSkills}/{stats.totalSkills} skills complete
            </div>
          </div>
        </aside>
      </div>

      <div className="flex justify-between border-t border-slate-200 pt-6">
        {prev ? (
          <Link
            href={`/learn/${prev.unitId}/${prev.skill.id}`}
            className="btn-secondary text-sm"
          >
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/learn/${next.unitId}/${next.skill.id}`}
            className="btn-primary text-sm"
          >
            {isSkillComplete ? "Next skill →" : "Skip to next →"}
          </Link>
        ) : (
          <Link href="/" className="btn-primary text-sm">
            🎉 Back to course
          </Link>
        )}
      </div>
    </div>
  );
}
