import { Icon, type IconName } from "@/components/Icon";

const HOW_IT_WORKS: { icon: IconName; title: string; desc: string; tone: string }[] = [
  { icon: "play", title: "Watch", desc: "A short video picked for the skill, from a channel like Khan Academy or Math Antics.", tone: "bg-sky-50 text-sky-700" },
  { icon: "pen", title: "Practice", desc: "Get five right on the first try. Problems can be set in things you're into.", tone: "bg-violet-50 text-violet-700" },
  { icon: "check", title: "Complete", desc: "The skill turns green and opens the next one on your path.", tone: "bg-emerald-50 text-emerald-700" },
  { icon: "review", title: "Review", desc: "Finished skills come back later, so they stay sharp.", tone: "bg-amber-50 text-amber-700" },
];

/** The four steps every skill goes through, the same in both courses. */
export function HowEachSkillWorks() {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">How each skill works</h2>
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
  );
}
