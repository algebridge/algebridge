"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MasteryLevel, Skill, Unit } from "@/types";
import { getNextSkill, getPrevSkill } from "@/data/curriculum";
import { VideoPlayer } from "@/components/VideoPlayer";
import { PracticePanel } from "@/components/PracticePanel";
import { CourseGate } from "@/components/CourseGate";
import { Icon } from "@/components/Icon";
import { LockedSkill } from "@/components/LockedSkill";
import { ProgressStatus } from "@/components/ProgressStatus";
import {
  markVideoWatched,
  getSkillProgress,
  unlockSkill,
  getSkillPracticeStats,
  getUnitCompletion,
  recordSkillCheck,
} from "@/lib/progress";
import { getBackupVideoForSkill, getVideoForSkill } from "@/data/videos";
import { useProgress } from "@/hooks/useProgress";
import { useCourseAccess } from "@/hooks/useCourseAccess";
import { hueVars, unitHue } from "@/lib/hues";
import { canTryCheck, CHECK_LENGTH, today } from "@/lib/path";
import { bridgeysForSkill } from "@/lib/gamification";
import { getUnitPrize } from "@/data/house-catalog";
import { showToast } from "@/lib/notify";
import { UnitMark } from "@/components/UnitMark";
import { StandardsChip } from "@/components/StandardsChip";
import { useAuth } from "@/lib/auth";
import { useSchoolMode } from "@/components/SchoolModePanel";

/** A step of the lesson, in its heading: its number, or a check once it is done. */
function StepMark({ n, done }: { n: number; done: boolean }) {
  return done ? (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
      <Icon name="check" size={15} />
    </span>
  ) : (
    <span aria-hidden className="hue-ink hue-line flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white text-sm font-semibold">
      {n}
    </span>
  );
}

interface LearnContentProps {
  unit: Unit;
  skill: Skill;
  unitId: string;
  skillId: string;
}

export function LearnContent({ unit, skill, unitId, skillId }: LearnContentProps) {
  const { stats, mounted } = useProgress();
  // Bridgeys are the student's game; a teacher previewing a lesson is not playing it.
  const auth = useAuth();
  const teacher = auth.profile?.role === "teacher";
  // Whoever CourseGate keeps out sees the title, but no progress beside it.
  const gated = auth.configured && (!auth.user || auth.needsRealName);
  // School mode turns tutors off, so the help card points to the teacher.
  const school = useSchoolMode();
  const [mastery, setMastery] = useState<MasteryLevel>("locked");
  const [videoWatched, setVideoWatched] = useState(false);
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
    setPracticeStats(getSkillPracticeStats(skill.id));
  }

  // The learning path decides whether this lesson opens. Nothing shows until
  // the account's progress has loaded, so a skill never flashes locked.
  const access = useCourseAccess();
  const state = access.ready ? access.skill(skill.id) : null;
  const isOpen = state?.open === true;
  /**
   * "Just practicing": the lesson of a locked skill, open to look around.
   * Nothing in it writes to progress, so the path stays where it is. Held
   * per visit: a reload comes back to the locked screen, which says so.
   */
  const [practiceOnly, setPracticeOnly] = useState(false);
  const [practiceRight, setPracticeRight] = useState(0);
  const [backToCheck, setBackToCheck] = useState(false);
  const looking = practiceOnly && state?.open === false;

  useEffect(() => {
    setPracticeOnly(false);
    setPracticeRight(0);
    setBackToCheck(false);
  }, [skill.id]);

  useEffect(() => {
    if (isOpen) unlockSkill(skill.id);
    refreshSkillState();
  }, [skill.id, isOpen]);

  useEffect(() => {
    if (mounted) refreshSkillState();
  }, [mounted, stats.completedSkills, skill.id]);

  const prev = getPrevSkill(unitId, skillId);
  const next = getNextSkill(unitId, skillId);
  const nextOpen = !!next && access.ready && access.skill(next.skill.id).open;
  // A teacher sees every lesson; this says which ones their students wait for.
  const studentState = access.staff ? access.forStudents(skill.id) : null;
  const video = getVideoForSkill(skill.id, skill.video);
  const backupVideo = getBackupVideoForSkill(skill.id) ?? skill.backupVideo;
  const unitProgress = mounted
    ? getUnitCompletion(unit.skills.map((s) => s.id))
    : { completed: 0, total: unit.skills.length, percent: 0 };
  const skillIndex = unit.skills.findIndex((s) => s.id === skillId) + 1;
  const pay = bridgeysForSkill(skill.id);
  const prize = getUnitPrize(unit.id);

  function handleVideoWatched() {
    const result = markVideoWatched(skill.id);
    refreshSkillState();
    if (result.xpGained > 0) {
      showToast({
        icon: "play",
        tone: "info",
        title: `+${result.xpGained} XP`,
        description: "Lesson video watched.",
      });
    }
    for (const badge of result.newBadges) {
      showToast({
        icon: "trophy",
        tone: "reward",
        title: `Badge: ${badge.title}`,
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
  // through the video too, they've shown they know it.
  const videoStepSatisfied = videoWatched || isSkillComplete;

  return (
    <div className="space-y-6" style={hueVars(unitHue(unit.id))}>
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:text-bridge-600">Home</Link>
        <span aria-hidden className="mx-2">/</span>
        <Link href={`/unit/${unitId}`} className="hover:text-bridge-600">
          Unit {unit.number}
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <span aria-current="page" className="text-slate-800">Skill {skillIndex}</span>
      </nav>

      {/* Title and description stay open so a shared lesson link still
          says what it leads to. The lesson itself needs an account. The
          unit's color and mark say where in the course this is. */}
      <header className="flex items-start gap-4">
        <Link
          href={`/unit/${unitId}`}
          title={`Unit ${unit.number}: ${unit.title}`}
          className="hue-wash flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition hover:scale-105"
        >
          <UnitMark unitId={unit.id} size={24} />
        </Link>
        <div className="min-w-0">
          {/* Where this is, and how far along the unit is: the strip of unit
              progress that used to sit under the header said it again. */}
          <p className="hue-ink text-xs font-semibold uppercase tracking-[0.08em]">
            Unit {unit.number} · Skill {skillIndex} of {unit.skills.length}
            {mounted && !gated && unitProgress.completed > 0 && ` · ${unitProgress.completed} of ${unitProgress.total} done`}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="page-title">{skill.title}</h1>
            {/* This skill's own status, beside its own title, so a finished
                skill never reads as a finished unit. */}
            {!gated && state && (state.open || looking) && <ProgressStatus level={mastery} />}
          </div>
          <p className="page-subtitle">{skill.description}</p>
        </div>
      </header>

      <CourseGate>
        {!state ? (
          <div className="space-y-6" aria-busy="true">
            <p role="status" className="sr-only">Loading the lesson</p>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
              <div className="aspect-video animate-pulse rounded-2xl bg-slate-200/60 lg:col-span-3" />
              <div className="hidden h-72 animate-pulse rounded-2xl bg-slate-200/60 lg:col-span-2 lg:block" />
            </div>
          </div>
        ) : !state.open && !looking ? (
          <LockedSkill
            skill={skill}
            after={state.after}
            startChecking={backToCheck}
            onPractice={() => {
              setBackToCheck(false);
              setPracticeOnly(true);
            }}
          />
        ) : (
        <div className="space-y-6">
          {looking && state && !state.open && (
            <div className="hue-tint rounded-xl border px-4 py-3 sm:flex sm:items-center sm:gap-4">
              <div className="min-w-0 sm:flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Icon name="eye" size={16} className="hue-ink" />
                  Practice mode
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {practiceRight >= CHECK_LENGTH && canTryCheck(getSkillProgress(skill.id))
                    ? `${practiceRight} right already. Show what you know, ${CHECK_LENGTH} in a row, and this skill opens for real.`
                    : `You are ahead of your path, so this is for practice only and your progress stays as it is. Finish ${state.after.title} and this skill opens.`}
                </p>
              </div>
              <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                {practiceRight >= CHECK_LENGTH && canTryCheck(getSkillProgress(skill.id)) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBackToCheck(true);
                      setPracticeOnly(false);
                    }}
                    className="hue-solid inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition hover:brightness-110"
                  >
                    Show what you know
                  </button>
                ) : (
                  <Link href={`/learn/${state.after.unitId}/${state.after.skillId}`} className="btn-secondary btn-sm">
                    Go to {state.after.title}
                  </Link>
                )}
              </div>
            </div>
          )}
          {studentState && !studentState.open && (
            <p className="notice-info flex items-center gap-2 text-sm">
              <Icon name="lock" size={15} />
              Teacher view: students open this skill after finishing {studentState.after.title}, or when you assign it.
            </p>
          )}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
            <div className="min-w-0 space-y-6 lg:col-span-3">
              {/* The two steps, watch then practice, each marked done in its own heading.
                  #watch is where the house's TV and projector open the lesson. */}
              <section id="watch" className="scroll-mt-20">
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="section-title flex items-center gap-2">
                    <StepMark n={1} done={videoStepSatisfied} />
                    Watch
                    {videoStepSatisfied && <span className="sr-only">, done</span>}
                  </h2>
                  {!videoStepSatisfied && <p className="text-sm text-slate-500">Start here, or skip it if you know this.</p>}
                </div>
                <VideoPlayer
                  video={video}
                  backupVideo={backupVideo}
                  // In practice mode the watch shows on this page and goes no further.
                  onWatched={looking ? () => setVideoWatched(true) : handleVideoWatched}
                />
              </section>

              <section>
                <h2 className="section-title mb-3 flex items-center gap-2">
                  <StepMark n={2} done={isSkillComplete} />
                  Practice
                  {isSkillComplete && <span className="sr-only">, done</span>}
                </h2>
                <PracticePanel
                  skill={skill}
                  onMasteryChange={handleMasteryChange}
                  practiceOnly={looking}
                  onPracticeRight={setPracticeRight}
                  onOpenSkill={() => {
                    // A fast run opens the skill the way passing "Show what you know" does.
                    recordSkillCheck(skill.id, true, today());
                    setPracticeOnly(false);
                    showToast({
                      icon: "check",
                      tone: "reward",
                      title: `${skill.title} is open`,
                      description: "Your answers count from here.",
                    });
                  }}
                  next={next ? { href: `/learn/${next.unitId}/${next.skill.id}`, title: next.skill.title } : null}
                />
              </section>

              <section>
                <h2 className="section-title mb-3">Need a hand?</h2>
                <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {school ? (
                    <div>
                      <p className="font-semibold text-slate-900">Stuck? Ask your teacher.</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Show them this problem. Archie can give you a hint on the first step, and your
                        notebook keeps your work in one place.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-900">Stuck? Get help from a real tutor.</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Message any tutor. They can start a video call with a shared whiteboard,
                        your notebook, and a calculator, right here on AlgeBridge.
                      </p>
                    </div>
                  )}
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!school && <Link href="/tutors" className="btn-primary text-sm">Find a tutor</Link>}
                    <Link href="/notebook" className={`${school ? "btn-primary" : "btn-secondary"} text-sm`}>My notebook</Link>
                  </div>
                </div>
              </section>
            </div>

            <aside aria-label="About this skill" className="min-w-0 lg:col-span-2">
              <div className="card sticky top-24 space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900">What you&apos;ll learn</h3>
                  <p className="mt-2 text-sm text-slate-600">{skill.learningGoal}</p>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Key idea</h3>
                  <p className="mt-2 text-sm text-slate-600">{skill.keyIdea}</p>
                  {/* The Common Core standards this skill teaches, for a
                      teacher or parent checking alignment. */}
                  <StandardsChip skillId={skill.id} className="mt-3" />
                </div>
                {looking && state && !state.open ? (
                  <div className="hue-tint rounded-xl border p-3 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">You are looking ahead.</p>
                    <p className="mt-1.5 text-xs leading-relaxed">
                      This skill opens after {state.after.title}, or the moment you show what you know. Once it is open,
                      5 right on the first try completes it.
                    </p>
                  </div>
                ) : !teacher ? (
                  // How to complete the skill is in the two step headings and
                  // the practice card; what it pays is said only here.
                  <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
                    Pays <span className="font-semibold text-slate-800">{pay} Bridgeys</span>
                    {prize ? (
                      <>
                        . Finish every skill in Unit {unit.number} for the{" "}
                        <span className="font-semibold text-slate-800">{prize.name}</span>.
                      </>
                    ) : (
                      "."
                    )}
                  </p>
                ) : null}
              </div>
            </aside>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
            {prev ? (
              <Link
                href={`/learn/${prev.unitId}/${prev.skill.id}`}
                className="btn-secondary text-sm"
              >
                <Icon name="arrow-left" size={16} />
                Previous
              </Link>
            ) : (
              <span />
            )}
            {next && nextOpen ? (
              <Link
                href={`/learn/${next.unitId}/${next.skill.id}`}
                className="btn-primary text-sm"
              >
                Next skill
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : next ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                <Icon name="lock" size={15} />
                Finish this skill to open {next.skill.title}
              </span>
            ) : (
              <Link href="/" className="btn-primary text-sm">
                Back to the course
              </Link>
            )}
          </div>
        </div>
        )}
      </CourseGate>
    </div>
  );
}
