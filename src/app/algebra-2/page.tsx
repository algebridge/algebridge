import type { Metadata } from "next";
import Link from "next/link";
import { COURSES, units as algebra1Units } from "@/data/curriculum";
import { CourseHeader } from "@/components/CourseHeader";
import { CourseGate } from "@/components/CourseGate";
import { ProgressOverview } from "@/components/ProgressOverview";
import { UnitCard } from "@/components/UnitCard";
import { GamesBanner } from "@/components/GamesBanner";
import { HowEachSkillWorks } from "@/components/HowEachSkillWorks";

export const metadata: Metadata = { title: "AlgeBridge 2" };

const ALGEBRA_2 = COURSES.find((c) => c.id === "algebra-2")!;
const TOTAL_SKILLS = ALGEBRA_2.units.reduce((sum, u) => sum + u.skills.length, 0);

/**
 * The AlgeBridge 2 home, built like the Algebra 1 home: its own header and
 * numbers, its own outline and path, the same lesson and practice pages.
 * The outline is open to everyone to read; the unit pages gate the work.
 */
export default function Algebra2Page() {
  return (
    <div className="space-y-6">
      <CourseHeader course="algebra-2" />

      <section id="units">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="section-title">Course outline</h2>
          <p className="text-sm text-slate-500">
            {ALGEBRA_2.units.length} units · {TOTAL_SKILLS} skills
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {ALGEBRA_2.units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      </section>

      {/* The course before this one, for a student who wants the base first. */}
      <section id="algebra-1" className="panel">
        <div className="panel-head">
          <h2 className="panel-title">AlgeBridge 1</h2>
          <span className="badge-brand">The base</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="max-w-xl text-sm text-slate-600">
            Algebra 1 in {algebra1Units.length} units, the course this one builds on. Same lessons, same practice, same path.
          </p>
          <Link href="/#units" className="btn-primary text-sm">
            See the AlgeBridge 1 outline
          </Link>
        </div>
      </section>

      {/* A visitor gets the sign-up panel here, right under the outline. */}
      <CourseGate>
        <ProgressOverview course="algebra-2" />
      </CourseGate>

      <GamesBanner />

      <HowEachSkillWorks />

      <CourseGate quiet>
        <p className="text-xs text-slate-500">AlgeBridge 2 is new. Something off? Use Feedback in the menu.</p>
      </CourseGate>
    </div>
  );
}
