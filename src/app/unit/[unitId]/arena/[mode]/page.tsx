import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allUnits, getUnit } from "@/data/curriculum";
import { CourseGate } from "@/components/CourseGate";
import { ArenaPlay } from "@/components/ArenaPlay";
import { ARENA_MODES, type ArenaMode } from "@/lib/arena";
import { hueVars, unitHue } from "@/lib/hues";

const MODES = Object.keys(ARENA_MODES) as ArenaMode[];

export function generateStaticParams() {
  return allUnits().flatMap((unit) => MODES.map((mode) => ({ unitId: unit.id, mode })));
}

export async function generateMetadata({ params }: { params: Promise<{ unitId: string; mode: string }> }): Promise<Metadata> {
  const { unitId, mode } = await params;
  const unit = getUnit(unitId);
  const m = ARENA_MODES[mode as ArenaMode];
  if (!unit || !m) return {};
  return { title: `${m.title}: Unit ${unit.number}` };
}

export default async function ArenaPage({ params }: { params: Promise<{ unitId: string; mode: string }> }) {
  const { unitId, mode } = await params;
  const unit = getUnit(unitId);
  if (!unit || !MODES.includes(mode as ArenaMode)) notFound();
  return (
    <div className="space-y-6" style={hueVars(unitHue(unit.id))}>
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href={`/unit/${unit.id}`} className="-my-1 inline-block rounded px-0.5 py-1 hover:text-bridge-600">
          Unit {unit.number}
        </Link>
        <span aria-hidden className="mx-2">/</span>
        <span aria-current="page" className="text-slate-800">{ARENA_MODES[mode as ArenaMode].title}</span>
      </nav>
      <CourseGate>
        <ArenaPlay unit={unit} mode={mode as ArenaMode} />
      </CourseGate>
    </div>
  );
}
