import Image from "next/image";

interface BridgeysLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/** Bridgeys currency logo, coin mark used across shop, HUD, and header. */
export function BridgeysLogo({ size = 32, showText = false, className = "" }: BridgeysLogoProps) {
  return (
    // Spans, not divs: the coin sits inside sentences and labels (a <p>, a
    // button), where a div is invalid HTML and breaks hydration.
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="relative block shrink-0 bg-transparent"
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/bridgeys-logo.png"
          alt="Bridgeys"
          fill
          unoptimized
          className="object-contain drop-shadow-sm"
          sizes={`${size}px`}
        />
      </span>
      {showText && (
        <span className="font-display text-lg tracking-wide text-amber-800">Bridgeys</span>
      )}
    </span>
  );
}
