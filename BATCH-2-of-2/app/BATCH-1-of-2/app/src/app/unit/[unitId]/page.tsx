import Link from "next/link";
import { notFound } from "next/navigation";
import { getUnit, units } from "@/data/curriculum";
import { SkillListItem } from "@/components/SkillListItem";
import { UnitProgressHeader } from "@/components/UnitProgressHeader";

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
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-bridge-600">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800">Unit {unit.number}</span>
      </nav>

      <header className="flex items-start gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bridge-100 text-3xl">
          {unit.icon}
        </span>
        <div>
          <h1 className="font-display text-2xl tracking-wide text-slate-900 sm:text-3xl">{unit.title}</h1>
          <p className="mt-2 text-slate-600">{unit.description}</p>
        </div>
      </header>

      <UnitProgressHeader unit={unit} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Skills in this unit
        </h2>
        {unit.skills.map((skill, index) => (
          <SkillListItem
            key={skill.id}
            skill={skill}
            unitId={unit.id}
            index={index + 1}
          />
        ))}
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
  );
}
