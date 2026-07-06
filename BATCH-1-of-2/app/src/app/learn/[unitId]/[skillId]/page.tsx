import { notFound } from "next/navigation";
import { getSkill, getUnit, units } from "@/data/curriculum";
import { LearnContent } from "@/components/LearnContent";

export function generateStaticParams() {
  return units.flatMap((unit) =>
    unit.skills.map((skill) => ({
      unitId: unit.id,
      skillId: skill.id,
    }))
  );
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ unitId: string; skillId: string }>;
}) {
  const { unitId, skillId } = await params;
  const unit = getUnit(unitId);
  const skill = getSkill(unitId, skillId);

  if (!unit || !skill) notFound();

  return <LearnContent unit={unit} skill={skill} unitId={unitId} skillId={skillId} />;
}
