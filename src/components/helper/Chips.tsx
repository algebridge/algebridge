import { Icon, type IconName } from "@/components/Icon";

export interface ChipSpec {
  id: string;
  label: string;
  icon?: IconName;
  onPick: () => void;
}

/** A quick action. It sends a real request, so it reads like a button, not a tag. */
export function Chip({ chip, disabled, compact = false }: { chip: ChipSpec; disabled?: boolean; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={chip.onPick}
      disabled={disabled}
      className={`helper-chip inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:border-bridge-300 hover:bg-bridge-50 hover:text-bridge-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 disabled:cursor-not-allowed disabled:opacity-50 ${
        compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]"
      }`}
    >
      {chip.icon && <Icon name={chip.icon} size={compact ? 13 : 15} className="text-bridge-600" />}
      {chip.label}
    </button>
  );
}

/** Chips that wrap, for an empty conversation where they are the main way in. */
export function ChipGrid({ chips, disabled, label }: { chips: ChipSpec[]; disabled?: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Chip key={c.id} chip={c} disabled={disabled} />
      ))}
    </div>
  );
}

/** Chips in one scrolling row above the box, once a conversation is under way. */
export function ChipRow({ chips, disabled, label }: { chips: ChipSpec[]; disabled?: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="helper-chips flex gap-1.5 overflow-x-auto px-3 pb-2 pt-1">
      {chips.map((c) => (
        <Chip key={c.id} chip={c} disabled={disabled} compact />
      ))}
    </div>
  );
}
