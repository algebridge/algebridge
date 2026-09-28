import type { MathQuote } from "@/data/quotes";

/**
 * A mathematician's words, with who said them and where. The source is part
 * of the card on purpose: a quote a student can check is worth more than one
 * they have to take on trust.
 */
export function QuoteCard({ quote, variant = "card" }: { quote: MathQuote; variant?: "card" | "line" | "banner" }) {
  if (variant === "line") {
    return (
      <figure className="text-sm">
        <blockquote className="italic leading-relaxed">“{quote.text}”</blockquote>
        <figcaption className="mt-1 text-xs opacity-90">
          <span className="font-semibold">{quote.who}</span>, {quote.source}
        </figcaption>
      </figure>
    );
  }
  if (variant === "banner") {
    return (
      <figure className="hue-tint rounded-2xl border px-5 py-4">
        <blockquote className="text-[15px] leading-relaxed text-slate-800">
          <span className="hue-ink mr-1 text-2xl font-bold leading-none align-[-0.3em]">“</span>
          {quote.text}
        </blockquote>
        <figcaption className="mt-2 text-xs leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">{quote.who}</span>
          <span className="text-slate-500"> · {quote.role}</span>
          <span className="block text-slate-500">{quote.source}</span>
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-3xl font-bold leading-none text-bridge-300" aria-hidden>
        “
      </span>
      <blockquote className="mt-1 flex-1 text-[15px] leading-relaxed text-slate-800">{quote.text}</blockquote>
      <figcaption className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-900">{quote.who}</span>
        <span className="block">{quote.role}</span>
        <span className="block text-slate-500">{quote.source}</span>
      </figcaption>
    </figure>
  );
}
