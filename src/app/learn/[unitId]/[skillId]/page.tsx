import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSkill, getUnit, isUnitVisible, visibleUnits } from "@/data/curriculum";
import { LearnContent } from "@/components/LearnContent";

export function generateStaticParams() {
  return visibleUnits().flatMap((unit) =>
    unit.skills.map((skill) => ({
      unitId: unit.id,
      skillId: skill.id,
    }))
  );
}

/** The tab names the skill and its unit, for a teacher with many open. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ unitId: string; skillId: string }>;
}): Promise<Metadata> {
  const { unitId, skillId } = await params;
  const unit = getUnit(unitId);
  const skill = getSkill(unitId, skillId);
  if (!unit || !skill) return {};
  return { title: `${skill.title}, Unit ${unit.number}` };
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ unitId: string; skillId: string }>;
}) {
  const { unitId, skillId } = await params;
  const unit = getUnit(unitId);
  const skill = getSkill(unitId, skillId);

  // A hidden course's pages, and its old lesson links, go home.
  if (unit && !isUnitVisible(unitId)) redirect("/");
  if (!unit || !skill) notFound();

  return <LearnContent unit={unit} skill={skill} unitId={unitId} skillId={skillId} />;
}
