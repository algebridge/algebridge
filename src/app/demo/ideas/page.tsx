import { SkillIdea } from "@/components/SkillIdea";
import { units as UNITS } from "@/data/curriculum";
import { algebra2Units as ALGEBRA2_UNITS } from "@/data/algebra2";
import { ideaFor } from "@/data/skill-ideas";

export const metadata = { title: "Every lesson's idea", robots: { index: false } };

/** For review: every skill's "Get the idea" in both courses on one page, in course order. */
export default function IdeasDemo() {
  // Algebra 2 is private to a few accounts, so its ideas show here only on a development machine.
  const courses = [{ name: "Algebra 1", units: UNITS }, ...(process.env.NODE_ENV !== "production" ? [{ name: "Algebra 2", units: ALGEBRA2_UNITS }] : [])];
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Every lesson&apos;s idea</h1>
      {courses.map((c) => (
        <section key={c.name} className="space-y-8">
          <h2 className="text-xl font-semibold text-slate-900">{c.name}</h2>
          {c.units.map((u, ui) =>
            u.skills.map((s, si) => {
              const idea = ideaFor(s.id);
              return idea ? (
                <div key={s.id} id={s.id} className="scroll-mt-20">
                  <p className="mb-2 text-sm font-semibold text-slate-600">
                    Unit {ui + 1}, skill {si + 1}: {s.title}
                  </p>
                  <SkillIdea idea={idea} />
                </div>
              ) : null;
            }),
          )}
        </section>
      ))}
    </div>
  );
}
