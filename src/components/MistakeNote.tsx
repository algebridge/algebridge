import { Icon } from "@/components/Icon";
import { MathText } from "@/components/PromptText";
import type { Diagnosis } from "@/lib/diagnose";

/**
 * What a wrong answer shows, in the student's own numbers: "Your answer is
 * exactly 7 more than it should be." Shown under the retry message while the
 * student can still fix it, so it never says the answer.
 */
export function MistakeNote({
  diagnosis,
  given,
  tone = "amber",
  flush = false,
}: {
  diagnosis: Diagnosis;
  given?: string;
  tone?: "amber" | "sky";
  /** Part of a larger note: a divider line on top instead of its own box. */
  flush?: boolean;
}) {
  if (!diagnosis.note) return null;
  const colors = tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-sky-200 bg-sky-50 text-sky-950";
  const icon = tone === "amber" ? "text-amber-600" : "text-sky-600";
  const box = flush
    ? `border-0 border-t ${tone === "amber" ? "border-amber-200/70 text-amber-950" : "border-sky-200/70 text-sky-950"} bg-transparent`
    : `animate-pop-in rounded-xl border ${colors}`;
  return (
    <div className={`px-4 py-3 text-sm ${box}`}>
      <p className="flex items-start gap-2">
        <Icon name="eye" size={16} className={`mt-0.5 shrink-0 ${icon}`} />
        <span>
          {given ? (
            <>
              You put <strong className="font-semibold"><MathText text={given} /></strong>. {diagnosis.note}
            </>
          ) : (
            diagnosis.note
          )}
        </span>
      </p>
      {diagnosis.fix && <p className="mt-1 pl-6 leading-relaxed opacity-90">{diagnosis.fix}</p>}
    </div>
  );
}
