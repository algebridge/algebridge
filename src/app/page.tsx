import { units } from "@/data/curriculum";
import { CourseHeader } from "@/components/CourseHeader";
import { AssignedWork } from "@/components/AssignedWork";
import { ContinueCard } from "@/components/ContinueCard";
import { ProgressOverview } from "@/components/ProgressOverview";
import { UnitCard } from "@/components/UnitCard";

const TOTAL_SKILLS = units.reduce((sum, u) => sum + u.skills.length, 0);

const HOW_IT_WORKS = [
  { n: "1", title: "Watch", desc: "A short lesson video from a maths teacher who explains it well." },
  { n: "2", title: "Visualize", desc: "See the idea as a graph or a number line, then spot the right one." },
  { n: "3", title: "Practice", desc: "Answer problems until you're at 80% or better on your recent tries." },
  { n: "4", title: "Complete", desc: "The skill turns green, and comes back later for review." },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <CourseHeader />

      <AssignedWork />

      <div id="continue">
        <ContinueCard />
      </div>

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

      <section className="panel">
        <div className="panel-head">
          <p className="panel-title">How each skill works</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.n}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bridge-50 text-xs font-bold text-bridge-700 ring-1 ring-inset ring-bridge-100">
                {s.n}
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
