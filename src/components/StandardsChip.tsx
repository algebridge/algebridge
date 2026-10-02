import { getStandard, levelLabel, standardsForSkill, type Standard } from "@/data/standards";

/**
 * The Common Core standards a skill teaches, as a row of small code chips
 * ("HSA-REI.B.3"). Hovering a chip shows our paraphrase of the standard, and
 * each chip links to the official text on thecorestandards.org.
 *
 * Quiet on purpose: it sits under a lesson title or in a teacher's table, so
 * it reads as a reference, not a badge. High school codes get the brand tint;
 * grade 6 to 8 codes, which Algebra 1 reviews, stay neutral.
 *
 *   <StandardsChip skillId={skill.id} />
 *   <StandardsChip codes={["HSA-REI.B.3"]} label={false} />
 *
 * No client hooks, so it renders on the server or the client.
 */
export function StandardsChip({
  skillId,
  codes,
  label = "Standards",
  className = "",
}: {
  /** Show every standard mapped to this skill (src/data/standards.ts). */
  skillId?: string;
  /** Or show exactly these codes. */
  codes?: string[];
  /** A small lead-in before the chips. Pass false to leave it out. */
  label?: string | false;
  className?: string;
}) {
  const standards: Standard[] = codes
    ? codes.map((c) => getStandard(c)).filter((s): s is Standard => Boolean(s))
    : skillId
      ? standardsForSkill(skillId)
      : [];
  if (standards.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {label && (
        <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          {label}
        </span>
      )}
      <ul className="flex flex-wrap items-center gap-1.5" aria-label="Common Core standards">
        {standards.map((s) => (
          <li key={s.code}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${s.code} (${levelLabel(s.level)}): ${s.summary}`}
              className={`standards-chip inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium leading-5 ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${
                s.level === "HS"
                  ? "bg-bridge-50 text-bridge-800 ring-bridge-100 hover:bg-bridge-100 hover:ring-bridge-200"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
              }`}
            >
              {s.code}
              <span className="sr-only">
                , {levelLabel(s.level)} standard: {s.summary} Opens the official standard in a new tab.
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
