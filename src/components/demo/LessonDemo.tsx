"use client";

import { useState } from "react";
import { units } from "@/data/curriculum";
import { getBackupVideoForSkill, getVideoForSkill } from "@/data/videos";
import { getUnitPrize } from "@/data/house-catalog";
import { bridgeysForSkill } from "@/lib/gamification";
import { hueVars, unitHue } from "@/lib/hues";
import { DemoCard } from "@/components/demo/DemoCard";
import { Icon } from "@/components/Icon";
import { StandardsChip } from "@/components/StandardsChip";
import { TryProblem } from "@/components/TryProblem";
import { VideoPlayer } from "@/components/VideoPlayer";

/** The first lesson of the course, the one a new student opens first. */
const UNIT = units[0];
const SKILL = UNIT.skills[0];

/** A step of the lesson, in its heading: its number, or a check once it is done. (As LearnContent draws it.) */
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

/**
 * The top of the first lesson, as LearnContent lays it out: the video and
 * its step heading, the skill's aside, and the practice step, with the
 * sample card standing in for the practice panel. A watched video turns its
 * step's check green here and goes no further; nothing is saved.
 */
export function LessonDemo() {
  const [videoWatched, setVideoWatched] = useState(false);
  const video = getVideoForSkill(SKILL.id, SKILL.video);
  const backupVideo = getBackupVideoForSkill(SKILL.id) ?? SKILL.backupVideo;
  const pay = bridgeysForSkill(SKILL.id);
  const prize = getUnitPrize(UNIT.id);

  return (
    <DemoCard>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5" style={hueVars(unitHue(UNIT.id))}>
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="section-title flex items-center gap-2">
                <StepMark n={1} done={videoWatched} />
                Watch
                {videoWatched && <span className="sr-only">, done</span>}
              </h2>
              {!videoWatched && <p className="text-sm text-slate-500">Start here, or skip it if you know this.</p>}
            </div>
            <VideoPlayer video={video} backupVideo={backupVideo} onWatched={() => setVideoWatched(true)} />
          </section>

          <section>
            <h2 className="section-title mb-3 flex items-center gap-2">
              <StepMark n={2} done={false} />
              Practice
            </h2>
            <TryProblem embed skillId={SKILL.id} count={3} reportHeight={false} />
          </section>
        </div>

        <aside aria-label="About this skill" className="min-w-0 lg:col-span-2">
          <div className="card sticky top-24 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900">What you&apos;ll learn</h3>
              <p className="mt-2 text-sm text-slate-600">{SKILL.learningGoal}</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Key idea</h3>
              <p className="mt-2 text-sm text-slate-600">{SKILL.keyIdea}</p>
              <StandardsChip skillId={SKILL.id} className="mt-3" />
            </div>
            <p className="border-t border-slate-100 pt-3 text-xs text-slate-600">
              Pays <span className="font-semibold text-slate-800">{pay} Bridgeys</span>
              {prize ? (
                <>
                  . Finish every skill in Unit {UNIT.number} for the{" "}
                  <span className="font-semibold text-slate-800">{prize.name}</span>.
                </>
              ) : (
                "."
              )}
            </p>
          </div>
        </aside>
      </div>
    </DemoCard>
  );
}
