import { units } from "@/data/curriculum";
import { CourseHeader } from "@/components/CourseHeader";
import { AssignedWork } from "@/components/AssignedWork";
import { CourseGate } from "@/components/CourseGate";
import { ProgressOverview } from "@/components/ProgressOverview";
import { UnitCard } from "@/components/UnitCard";
import { GamesBanner } from "@/components/GamesBanner";
import { Icon, type IconName } from "@/components/Icon";
import { QuoteCard } from "@/components/QuoteCard";
import { HOME_QUOTES } from "@/data/quotes";

const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);

const HOW_IT_WORKS: { icon: IconName; title: string; desc: string; tone: string }[] = [
  { icon: "play", title: "Watch", desc: "A short video picked for the skill, from a channel like Khan Academy or Math Antics.", tone: "bg-sky-50 text-sky-700" },
  { icon: "pen", title: "Practice", desc: "Get five right on the first try. Problems can be set in things you're into.", tone: "bg-violet-50 text-violet-700" },
  { icon: "check", title: "Complete", desc: "The skill turns green and opens the next one on your path.", tone: "bg-emerald-50 text-emerald-700" },
  { icon: "review", title: "Review", desc: "Finished skills come back later, so they stay sharp.", tone: "bg-amber-50 text-amber-700" },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <CourseHeader />

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

      {/* A visitor gets the sign-up panel here, right under the outline. */}
      <CourseGate>
        <ProgressOverview />
      </CourseGate>

      <GamesBanner />

      {/* Why the course is worth the work, in the words of people who built
          the subject. Every quote is real and carries its source. */}
      <section className="panel" id="why-algebra">
        <div className="panel-head">
          <p className="panel-title">Why Algebra 1</p>
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

      <section className="panel">
        <div className="panel-head">
          <p className="panel-title">How each skill works</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.title}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}>
                <Icon name={s.icon} size={18} />
              </span>
              <h3 className="mt-2.5 text-sm font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
