// Prints every problem with the "Get the idea" data (check.ts). ONLY=a1-units-6-10 limits the report to one file's skills.
import { checkAll, checkExamples } from "../src/data/skill-ideas/check.ts";
import { WORKED_EXAMPLES } from "../src/data/worked-examples/index.ts";
import { SKILL_IDEAS } from "../src/data/skill-ideas/index.ts";
const A1 = await import("../src/data/curriculum.ts");
const A2 = await import("../src/data/algebra2.ts");
const units = (m: Record<string, unknown>) => (Object.values(m).find((v) => Array.isArray(v) && (v as { skills?: unknown }[])[0]?.skills) ?? []) as { id: string; skills: { id: string }[] }[];
const all = [...units(A1), ...units(A2)];
const ids = all.flatMap((u) => u.skills.map((s) => s.id));
let report = checkAll(SKILL_IDEAS, ids);
for (const [id, list] of Object.entries(WORKED_EXAMPLES)) report.push(...checkExamples(id, list));
if (process.env.ONLY) {
  const mod = await import(`../src/data/skill-ideas/${process.env.ONLY}.ts`);
  const mine = new Set(Object.keys(mod.IDEAS));
  const want = process.env.UNITS ? new Set(process.env.UNITS.split(",")) : null;
  const scope = new Set(want ? all.filter((u) => want.has(u.id)).flatMap((u) => u.skills.map((s) => s.id)) : mine);
  report = report.filter((r) => scope.has(r.split(":")[0]) || mine.has(r.split(":")[0]));
}
console.log(report.length ? report.join("\n") : "all good");
console.log(`${Object.keys(SKILL_IDEAS).length} of ${ids.length} skills have an idea`);
