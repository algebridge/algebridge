import { MathText } from "@/components/PromptText";
import { explanationSteps } from "@/lib/diagnose";

/**
 * A worked answer, one line per step. Generators write their working with
 * arrows ("3x + 4 = 19 → 3x = 15 → x = 5"); a student reads it better as a
 * numbered list than as one long line. A sentence with no arrows stays a
 * sentence.
 */
export function WorkedSteps({ text, className = "" }: { text: string; className?: string }) {
  const steps = explanationSteps(text);
  if (steps.length < 2) {
    return (
      <p className={`leading-relaxed ${className}`}>
        <MathText text={text} />
      </p>
    );
  }
  return (
    <ol className={`space-y-1.5 ${className}`}>
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-[11px] font-bold text-slate-600 ring-1 ring-black/10">
            {i + 1}
          </span>
          <span className="leading-relaxed">
            <MathText text={step} />
          </span>
        </li>
      ))}
    </ol>
  );
}
