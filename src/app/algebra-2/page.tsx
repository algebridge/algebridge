import type { Metadata } from "next";
import Link from "next/link";
import { COURSES } from "@/data/curriculum";
import { CourseGate } from "@/components/CourseGate";
import { UnitCard } from "@/components/UnitCard";
import { UnitTiles } from "@/components/UnitTiles";

/** Unlisted: reached by its address only, and kept out of search engines. */
export const metadata: Metadata = { title: "Algebra 2", robots: { index: false, follow: false } };

/**
 * The Algebra 2 outline. A second course beside Algebra 1: its own units,
 * its own path, the same lesson and practice pages. Open to everyone to
 * read, like the Algebra 1 outline; the unit pages gate the work.
 */
export default function Algebra2Page() {
  const course = COURSES.find((c) => c.id === "algebra-2")!;
  const totalSkills = course.units.reduce((sum, u) => sum + u.skills.length, 0);
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:text-bridge-600">Home</Link>
        <span aria-hidden className="mx-2">/</span>
        <span aria-current="page" className="text-slate-800">Algebra 2</span>
      </nav>
      <section id="units">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="section-title">Algebra 2</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Picks up where Algebra 1 ends: complex numbers, polynomials, rational and radical equations, logarithms, series and the unit circle. Skills open in order, starting with complex numbers. Know one already? Show what you know on its page opens it.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <UnitTiles variant="row" units={course.units} />
            <p className="text-sm text-slate-500">
              {course.units.length} units · {totalSkills} skills
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {course.units.map((unit) => (
            <UnitCard key={unit.id} unit={unit} />
          ))}
        </div>
      </section>
      <CourseGate quiet>
        <p className="text-xs text-slate-500">Algebra 2 is new. Something off? Use Feedback in the menu.</p>
      </CourseGate>
    </div>
  );
}
