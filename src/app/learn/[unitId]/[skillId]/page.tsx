import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allUnits, courseOfUnit, getSkill, getUnit } from "@/data/curriculum";
import { LearnContent } from "@/components/LearnContent";
import { Algebra2Gate } from "@/components/Algebra2Gate";

export function generateStaticParams() {
  return allUnits().flatMap((unit) =>
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
  const unlisted = courseOfUnit(unitId)?.id === "algebra-2";
  return { title: `${skill.title}, Unit ${unit.number}`, ...(unlisted ? { robots: { index: false, follow: false } } : {}) };
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

  const lesson = <LearnContent unit={unit} skill={skill} unitId={unitId} skillId={skillId} />;
  // Algebra 2 is open to its early-access accounts only (src/lib/early-access.ts).
  return courseOfUnit(unitId)?.id === "algebra-2" ? <Algebra2Gate>{lesson}</Algebra2Gate> : lesson;
}
