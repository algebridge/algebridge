import { MathText } from "@/components/PromptText";
import { rulesForSkill } from "@/data/skill-rules";

/**
 * The golden rules of a skill, as margin notes beside the problem: each rule
 * in one sentence, with a tiny worked example under it. On a wide screen it
 * sits in the sticky column to the right of the practice card; on a phone,
 * where that column falls below everything, it folds out under the problem.
 */
export function SkillRules({ skillId, variant }: { skillId: string; variant: "side" | "fold" }) {
  const rules = rulesForSkill(skillId);
  if (!rules.length) return null;

  const list = (
    <ol className="space-y-3">
      {rules.map((r, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="hue-wash mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          >
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-snug text-slate-800">
              <MathText text={r.rule} />
            </p>
            {r.example && (
              <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-[12.5px] leading-snug text-slate-600">
                <MathText text={r.example} />
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );

  if (variant === "fold") {
    return (
      <details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-panel lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-800">
          Rules to remember
          <span aria-hidden className="text-slate-400 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="mt-3">{list}</div>
      </details>
    );
  }

  return (
    <div>
      <h3 className="font-bold text-slate-900">Rules to remember</h3>
      <div className="mt-3">{list}</div>
    </div>
  );
}
