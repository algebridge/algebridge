"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MasteryLevel, Skill, Unit } from "@/types";
import { courseOfUnit, getNextSkill, getPrevSkill } from "@/data/curriculum";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WorkedExamples } from "@/components/WorkedExamples";
import { workedExamplesFor } from "@/data/worked-examples";
import { rulesForSkill } from "@/data/skill-rules";
import { FAST_RUN, FAST_SECONDS, PracticePanel } from "@/components/PracticePanel";
import { useSkillTime } from "@/lib/insights-client";
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
import { useSeason } from "@/lib/use-season";
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
    <span aria-hidden className="hue-ink hue-line flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-surface text-sm font-semibold">
      {n}
    </span>
  );
}

/** The parts of a lesson, each of which folds from its heading. */
type PartId = "watch" | "practice" | "examples" | "learn" | "help";

/**
 * One part of the lesson. The heading is the button, so the whole row is the
 * target, and a folded part is just its heading: the page stays short, and
 * the practice stays near the top. `keep` holds the content mounted while
 * folded, for the practice, whose problem would otherwise start over.
 */
function LessonPart({
  id,
  n,
  done = false,
  title,
  badge,
  hint,
  open,
  onToggle,
  keep = false,
  children,
}: {
  id: PartId;
  n?: number;
  done?: boolean;
  title: string;
  badge?: React.ReactNode;
  /** One line under the heading, shown while the part is open. */
  hint?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  keep?: boolean;
  children: React.ReactNode;
}) {
  const bodyId = `${id}-body`;
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="section-title -mx-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
        >
          {n !== undefined && <StepMark n={n} done={done} />}
          <span className="min-w-0">{title}</span>
          {badge}
          {done && <span className="sr-only">, done</span>}
          <span aria-hidden className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-slate-500">
            {open ? "Hide" : "Show"}
            <Icon name={open ? "chevron-up" : "chevron-down"} size={16} />
          </span>
        </button>
      </h2>
      {open && hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {keep ? (
        <div id={bodyId} hidden={!open} className="mt-3">
          {children}
        </div>
      ) : open ? (
        <div id={bodyId} className="mt-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

interface LearnContentProps {
  unit: Unit;
  skill: Skill;
  unitId: string;
  skillId: string;
}

export function LearnContent({ unit, skill, unitId, skillId }: LearnContentProps) {
  const spooky = useSeason() === "halloween";
  const { stats, mounted } = useProgress();
  // Insights: seconds on this skill's page while the student is at it.
  useSkillTime(skill.id);
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

  /**
   * Which parts the student opened or folded, this visit; unset means the
   * part's own default. Kept with the skill it belongs to, so the next lesson
   * starts fresh without a flash of this one's folds.
   */
  const [folds, setFolds] = useState<{ id: string; parts: Partial<Record<PartId, boolean>> }>({ id: skill.id, parts: {} });
  const parts = folds.id === skill.id ? folds.parts : {};
  const setPart = useCallback(
    (part: PartId, open: boolean) => {
      setFolds((f) => ({ id: skill.id, parts: { ...(f.id === skill.id ? f.parts : {}), [part]: open } }));
    },
    [skill.id]
  );
  /**
   * The video starts folded once it has been watched, or the skill is done,
   * so a student coming back lands on the practice. Decided once per lesson,
   * when it first shows: a video marked watched while it plays stays up.
   */
  const watchFold = useRef<{ id: string; folded: boolean } | null>(null);
  if (state && watchFold.current?.id !== skill.id) {
    const p = getSkillProgress(skill.id);
    watchFold.current = { id: skill.id, folded: p.videoWatched || p.level === "proficient" || p.level === "mastered" };
  }
  // What you'll learn and See it done wait until they are asked for: the
  // practice is the lesson, and it should be on the screen without scrolling.
  const partDefaults: Record<PartId, boolean> = {
    watch: !(watchFold.current?.id === skill.id && watchFold.current.folded),
    practice: true,
    examples: false,
    learn: false,
    help: true,
  };
  const partOpen = (part: PartId) => parts[part] ?? partDefaults[part];

  // A link into the lesson (#watch from the house's TV, #examples from the
  // practice's own hint) opens the part it points at.
  useEffect(() => {
    const at = window.location.hash.slice(1);
    if (at === "watch" || at === "practice" || at === "examples") setPart(at, true);
  }, [skill.id, setPart]);

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
  const hasExamples = workedExamplesFor(skill.id).length > 0;

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

  // The crumb leads back to the course this unit belongs to.
  const inAlgebra2 = courseOfUnit(unitId)?.id === "algebra-2";
  const courseHome = inAlgebra2 ? "/algebra-2" : "/";
  const courseName = inAlgebra2 ? "AlgeBridge 2" : "Home";

  return (
    // One column, as wide as a lesson reads well: the practice card is the page.
    <div className="mx-auto max-w-4xl space-y-6" style={hueVars(unitHue(unit.id))}>
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href={courseHome} className="-my-1 inline-block rounded px-0.5 py-1 hover:text-bridge-600">{courseName}</Link>
        <span aria-hidden className="mx-2">/</span>
        <Link href={`/unit/${unitId}`} className="-my-1 inline-block rounded px-0.5 py-1 hover:text-bridge-600">
          Unit {unit.number}
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <span aria-current="page" className="text-slate-800">Skill {skillIndex}</span>
      </nav>

      {/* Title and description stay open so a shared lesson link still
          says what it leads to. The lesson itself needs an account. The
          unit's color and mark say where in the course this is. */}
      <header className={`relative flex items-start gap-4 ${spooky ? "season-lesson" : ""}`}>
        {spooky && <span className="season-cobweb" aria-hidden="true" />}
        {/* Walking in: fog rolls across the header once and two bats leave the web (season.css). Keyed by skill, so every lesson gets its entrance. */}
        {spooky && (
          <span key={skill.id} className="season-entrance" aria-hidden="true">
            <span className="season-fog" />
            <span className="season-lesson-bat" style={{ "--d": "0.2s", "--y": "22%" } as React.CSSProperties}>
              <svg viewBox="0 0 34 20" width="30" height="18">
                <path d="M17 9 C15.5 6 13 5 10.5 5.5 C9 3.5 6 3 4 4.5 C1.5 5.5 0.5 8.5 1 11.5 C3 10 5.2 10.2 6.5 12 C7.6 10.6 9.2 10.6 10.5 12 C11.4 10.2 13 9.8 14.5 10.8 L15.6 13 L17 15.5 L18.4 13 L19.5 10.8 C21 9.8 22.6 10.2 23.5 12 C24.8 10.6 26.4 10.6 27.5 12 C28.8 10.2 31 10 33 11.5 C33.5 8.5 32.5 5.5 30 4.5 C28 3 25 3.5 23.5 5.5 C21 5 18.5 6 17 9 Z" fill="currentColor" />
              </svg>
            </span>
            <span className="season-lesson-bat" style={{ "--d": "0.6s", "--y": "48%" } as React.CSSProperties}>
              <svg viewBox="0 0 34 20" width="22" height="13">
                <path d="M17 9 C15.5 6 13 5 10.5 5.5 C9 3.5 6 3 4 4.5 C1.5 5.5 0.5 8.5 1 11.5 C3 10 5.2 10.2 6.5 12 C7.6 10.6 9.2 10.6 10.5 12 C11.4 10.2 13 9.8 14.5 10.8 L15.6 13 L17 15.5 L18.4 13 L19.5 10.8 C21 9.8 22.6 10.2 23.5 12 C24.8 10.6 26.4 10.6 27.5 12 C28.8 10.2 31 10 33 11.5 C33.5 8.5 32.5 5.5 30 4.5 C28 3 25 3.5 23.5 5.5 C21 5 18.5 6 17 9 Z" fill="currentColor" />
              </svg>
            </span>
          </span>
        )}
        <Link
          href={`/unit/${unitId}`}
          title={`Unit ${unit.number}: ${unit.title}`}
          aria-label={`Unit ${unit.number}: ${unit.title}`}
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
            <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200/60" />
            <div className="h-80 animate-pulse rounded-2xl bg-slate-200/60" />
          </div>
        ) : !state.open && state.byTeacher ? (
          <section className="panel">
            <div className="mx-auto max-w-lg px-6 py-10 text-center sm:px-10">
              <span className="hue-wash mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                <Icon name="lock" size={22} />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">Your teacher has this closed for now</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Your class works on what your teacher assigns. Your assignments are on My classes.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href="/classes" className="btn-primary">
                  My classes
                </Link>
              </div>
            </div>
          </section>
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
                    : `You are ahead of your path, so this is for practice only and your progress stays as it is. Finish ${state.after.title} and this skill opens. Or answer ${FAST_RUN} right in a row, each within ${FAST_SECONDS} seconds, and it opens now.`}
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
          {/* Video first, then the problems, then the worked examples and the
              notes, each folding from its heading. The video folds itself once
              watched; the notes and examples wait to be asked for. #watch is
              where the house's TV and projector open the lesson. */}
          <LessonPart
            id="watch"
            n={1}
            done={videoStepSatisfied}
            title="Watch"
            hint={!videoStepSatisfied ? "Start here, or skip it if you know this." : undefined}
            open={partOpen("watch")}
            onToggle={() => setPart("watch", !partOpen("watch"))}
          >
            {video.youtubeId ? (
              <VideoPlayer
                video={video}
                backupVideo={backupVideo}
                // In practice mode the watch shows on this page and goes no further.
                onWatched={looking ? () => setVideoWatched(true) : handleVideoWatched}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">{skill.keyIdea}</p>
                <p className="mt-1">No lesson video is sourced for this skill yet. See it done, below, shows every step.</p>
              </div>
            )}
          </LessonPart>

          <LessonPart
            id="practice"
            n={2}
            done={isSkillComplete}
            title="Practice"
            badge={spooky ? <span className="season-chip">Spooky practice</span> : undefined}
            hint={
              !isSkillComplete && hasExamples ? (
                <>
                  Stuck?{" "}
                  <a href="#examples" onClick={() => setPart("examples", true)} className="font-semibold text-bridge-700 hover:underline">
                    See it done
                  </a>{" "}
                  is right below.
                </>
              ) : undefined
            }
            open={partOpen("practice")}
            onToggle={() => setPart("practice", !partOpen("practice"))}
            keep
          >
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
          </LessonPart>

          {/* Taught before it is tested: every kind of problem in the practice,
              solved step by step with the reason for each step. */}
          {hasExamples && (
            <LessonPart
              id="examples"
              n={3}
              done={isSkillComplete}
              title="See it done"
              hint="Every kind of problem in the practice, worked step by step."
              open={partOpen("examples")}
              onToggle={() => setPart("examples", !partOpen("examples"))}
            >
              <WorkedExamples skillId={skill.id} />
            </LessonPart>
          )}

          <LessonPart id="learn" title="What you'll learn" open={partOpen("learn")} onToggle={() => setPart("learn", !partOpen("learn"))}>
            <div className="card space-y-4">
              <p className="text-sm leading-relaxed text-slate-700">{skill.learningGoal}</p>
              {/* The rules fold out under the practice card; the key idea
                  stands in for them where a skill has none. */}
              {!rulesForSkill(skill.id).length && (
                <div>
                  <h3 className="font-bold text-slate-900">Key idea</h3>
                  <p className="mt-1.5 text-sm text-slate-600">{skill.keyIdea}</p>
                </div>
              )}
              {/* The Common Core standards this skill teaches, for a
                  teacher or parent checking alignment. */}
              <StandardsChip skillId={skill.id} />
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
          </LessonPart>

          <LessonPart id="help" title="Need a hand?" open={partOpen("help")} onToggle={() => setPart("help", !partOpen("help"))}>
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
          </LessonPart>

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
