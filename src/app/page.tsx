import { units } from "@/data/curriculum";
import { BridgeHero } from "@/components/BridgeHero";
import { ContinueCard } from "@/components/ContinueCard";
import { ProgressOverview } from "@/components/ProgressOverview";
import { UnitCard } from "@/components/UnitCard";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <BridgeHero />

      <div id="continue">
        <ContinueCard />
      </div>

      <section id="units">
        <h2 className="text-2xl font-bold text-slate-900">All Units</h2>
        <p className="mt-1 text-slate-600">
          {units.length} units · Work through them in order, or jump to any unit
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      </section>

      <ProgressOverview />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">How each skill works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "1", title: "Watch", desc: "A short YouTube lesson from a top math teacher." },
            { n: "2", title: "Visualize", desc: "Spot the correct graph to build real intuition." },
            { n: "3", title: "Practice", desc: "Answer 3+ problems with 80%+ correct on your recent tries." },
            { n: "4", title: "Complete", desc: "The skill turns green. Move to the next one!" },
          ].map((s) => (
            <div key={s.n} className="rounded-xl bg-slate-50 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bridge-600 text-sm font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-2 font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
