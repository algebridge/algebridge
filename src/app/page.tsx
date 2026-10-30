import Link from "next/link";
import { COURSES, units } from "@/data/curriculum";
import { CourseHeader } from "@/components/CourseHeader";
import { AssignedWork } from "@/components/AssignedWork";
import { CourseGate } from "@/components/CourseGate";
import { ProgressOverview } from "@/components/ProgressOverview";
import { UnitCard } from "@/components/UnitCard";
import { GamesBanner } from "@/components/GamesBanner";
import { VisualizeIt } from "@/components/VisualizeIt";
import { QuoteCard } from "@/components/QuoteCard";
import { HOME_QUOTES } from "@/data/quotes";
import { SeasonBanner } from "@/components/SeasonBanner";

const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);
const ALGEBRA_2 = COURSES.find((c) => c.id === "algebra-2")!;


export default function HomePage() {
  return (
    <div className="space-y-6">
      <CourseHeader />

      {/* In October: the award, the titles and the shelf, one tap each (lib/season.ts). */}
      <SeasonBanner />

      {/* A student's class assignments, first. Nothing shows for a visitor. */}
      <CourseGate quiet>
        <AssignedWork />
      </CourseGate>

      {/* The outline is open to everyone, the same list the For schools
          page shows, so a visitor sees what the course is. Each unit's path
          and its lessons are behind a free account (the unit pages gate). */}
      <section id="units">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="section-title">Course outline</h2>
          <p className="text-sm text-slate-500">
            {units.length} units · {TOTAL_SKILLS} skills
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {/* The welcome tour points at the first unit: where the path starts. */}
          {units.map((unit, i) =>
            i === 0 ? (
              <div key={unit.id} data-tour="outline" className="grid">
                <UnitCard unit={unit} />
              </div>
            ) : (
              <UnitCard key={unit.id} unit={unit} />
            )
          )}
        </div>
      </section>

      {/* The next course, for a student who finished this one or is placed past it. */}
      <section id="algebra-2" className="panel">
        <div className="panel-head">
          <h2 className="panel-title">AlgeBridge 2</h2>
          <span className="badge-brand">New course</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="max-w-xl text-sm text-slate-600">
            Algebra 2 in {ALGEBRA_2.units.length} units, from square roots up to i to the unit circle. Same lessons, same practice, same path.
          </p>
          <Link href="/algebra-2" className="btn-primary text-sm">
            See the AlgeBridge 2 outline
          </Link>
        </div>
      </section>

      {/* A visitor gets the sign-up panel here, right under the outline. */}
      <CourseGate>
        <ProgressOverview />
      </CourseGate>

      <GamesBanner />

      {/* Why the course is worth the work, in the words of people who built
          the subject. Every quote is real and carries its source. */}
      <section className="panel" id="why-algebra">
        <div className="panel-head">
          <h2 className="panel-title">Why Algebra 1</h2>
        </div>
        <div className="p-5">
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Algebra is where a letter stands in for a number you have yet to find, and every unit here is a way of
            finding it. The rest of high school math is built on it, and so is most of science. The people who built
            the subject said why it matters better than we can.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {HOME_QUOTES.map((q) => (
              <QuoteCard key={q.id} quote={q} />
            ))}
          </div>
        </div>
      </section>

      <VisualizeIt />
    </div>
  );
}
