import Link from "next/link";
import { notFound } from "next/navigation";
import { getUnit, units } from "@/data/curriculum";
import { CourseGate } from "@/components/CourseGate";
import { UnitPath } from "@/components/UnitPath";
import { UnitProgressHeader } from "@/components/UnitProgressHeader";
import { hueVars, unitHue } from "@/lib/hues";

export function generateStaticParams() {
  return units.map((unit) => ({ unitId: unit.id }));
}

export default async function UnitPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = await params;
  const unit = getUnit(unitId);
  if (!unit) notFound();

  return (
    <div className="space-y-6" style={hueVars(unitHue(unit.id))}>
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-bridge-600">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800">Unit {unit.number}</span>
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
                ← Previous unit
              </Link>
            ) : (
              <span />
            )}
            {unit.number < units.length ? (
              <Link href={`/unit/${units[unit.number].id}`} className="btn-primary text-sm">
                Next unit →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </div>
      </CourseGate>
    </div>
  );
}
