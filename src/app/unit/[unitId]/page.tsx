import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allUnits, courseOfUnit, getUnit } from "@/data/curriculum";
import { CourseGate } from "@/components/CourseGate";
import { UnitPath } from "@/components/UnitPath";
import { UnitProgressHeader } from "@/components/UnitProgressHeader";
import { QuoteCard } from "@/components/QuoteCard";
import { quoteForUnit } from "@/data/quotes";
import { hueVars, unitHue } from "@/lib/hues";
import { Icon } from "@/components/Icon";

export function generateStaticParams() {
  return allUnits().map((unit) => ({ unitId: unit.id }));
}

/** The tab says which unit, for a teacher with many open. */
export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }): Promise<Metadata> {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) return {};
  const unlisted = courseOfUnit(unitId)?.id === "algebra-2";
  return { title: `Unit ${unit.number}: ${unit.title}`, ...(unlisted ? { robots: { index: false, follow: false } } : {}) };
}

export default async function UnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) notFound();
  const course = courseOfUnit(unitId);
  const units = course?.units ?? [];
  const home = course?.id === "algebra-2" ? "/algebra-2" : "/";

  return (
    <div className="space-y-6" style={hueVars(unitHue(unit.id))}>
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href={home} className="hover:text-bridge-600">{course?.id === "algebra-2" ? "Algebra 2" : "Home"}</Link>
        <span aria-hidden className="mx-2">/</span>
        <span aria-current="page" className="text-slate-800">Unit {unit.number}</span>
      </nav>

      {/* The unit's banner stays open so a shared link still says what it
          leads to. The skills behind it need an account. */}
      <UnitProgressHeader unit={unit} />

      <CourseGate>
        <div className="space-y-6">

          <div>
            <h2 className="eyebrow mb-2">Your path through this unit</h2>
            <UnitPath unit={unit} />
          </div>

          <div className="flex justify-between border-t border-slate-200 pt-4">
            {unit.number > 1 ? (
              <Link href={`/unit/${units[unit.number - 2].id}`} className="btn-secondary text-sm">
                <Icon name="arrow-left" size={16} />
                Previous unit
              </Link>
            ) : (
              <span />
            )}
            {unit.number < units.length ? (
              <Link href={`/unit/${units[unit.number].id}`} className="btn-primary text-sm">
                Next unit
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </CourseGate>

      {/* A mathematician on this unit's ground, source and all. Below the
          path, so the path is the first thing under the unit's banner. */}
      <QuoteCard quote={quoteForUnit(unit.id)} variant="banner" />
    </div>
  );
}
