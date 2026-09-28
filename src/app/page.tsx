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
  { icon: "play", title: "Watch", desc: "A short lesson video from a maths teacher who explains it well.", tone: "bg-sky-50 text-sky-700" },
  { icon: "spark", title: "Practice", desc: "Get five problems right, set in things you're into.", tone: "bg-violet-50 text-violet-700" },
  { icon: "check", title: "Complete", desc: "The skill turns green and opens the next one on your path.", tone: "bg-emerald-50 text-emerald-700" },
  { icon: "review", title: "Review", desc: "Finished skills come back later, so they stay sharp.", tone: "bg-amber-50 text-amber-700" },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <CourseHeader />

      <GamesBanner />

      {/* The course outline itself is behind a free account. The header above
          and the steps below stay open, so a visitor can still see how
          AlgeBridge works before signing up. */}
      <CourseGate>
        <div className="space-y-6">
          <AssignedWork />

          <section id="units">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="section-title">Course outline</h2>
              <p className="text-sm text-slate-500">
                {units.length} units · {TOTAL_SKILLS} skills
              </p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {units.map((unit) => (
                <UnitCard key={unit.id} unit={unit} />
              ))}
            </div>
          </section>

          <ProgressOverview />
        </div>
      </CourseGate>

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
