import { BridgeysLogo } from "@/components/house/BridgeysLogo";

type PriceSize = "sm" | "md" | "lg";

const SIZES: Record<PriceSize, { coin: number; text: string }> = {
  sm: { coin: 16, text: "text-xs" },
  md: { coin: 18, text: "text-sm" },
  lg: { coin: 24, text: "text-base" },
};

interface BridgeyPriceProps {
  amount: number;
  size?: PriceSize;
  /** Renders "Free" instead of a zero coin price. */
  freeWhenZero?: boolean;
  /** Greyed out when the player cannot afford this yet. */
  muted?: boolean;
  className?: string;
}

/**
 * The single way a Bridgeys amount is ever displayed. Before this existed the
 * same price appeared as a 🪙 emoji in one grid, a 16px logo in the next and a
 * 18px logo in the HUD, which made the currency read as three different things.
 * Tabular figures keep prices aligned down a column of cards.
 */
export function BridgeyPrice({
  amount,
  size = "md",
  freeWhenZero = false,
  muted = false,
  className = "",
}: BridgeyPriceProps) {
  const { coin, text } = SIZES[size];

  if (freeWhenZero && amount === 0) {
    return (
      <span className={`badge-success ${className}`}>Free</span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${text} ${
        muted ? "text-slate-400" : "text-slate-900"
      } ${className}`}
    >
      <BridgeysLogo size={coin} className={muted ? "opacity-50 grayscale" : ""} />
      {amount.toLocaleString()}
    </span>
  );
}
