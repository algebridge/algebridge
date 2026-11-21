import Link from "next/link";
import { arcadeHref, arcadeThumb, type ArcadeGame } from "@/lib/arcade/games";

/**
 * One game on the board: a square picture that lifts on hover and shows its
 * one-line pitch (the picture carries the title as its logo). On a touch screen,
 * with no hover, the pitch is always there.
 */
export function ArcadeTile({ game, big = false, eager = false }: { game: ArcadeGame; big?: boolean; eager?: boolean }) {
  return (
    <Link
      href={arcadeHref(game)}
      aria-label={`${game.name}. ${game.blurb}`}
      className={`arcade-tile group relative block aspect-square overflow-hidden rounded-2xl bg-slate-200 shadow-panel outline-none ring-bridge-500 ring-offset-2 transition duration-150 hover:z-10 hover:-translate-y-1 hover:scale-[1.04] hover:shadow-raised focus-visible:ring-4 ${
        big ? "col-span-2 row-span-2" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={arcadeThumb(game)} alt="" loading={eager ? "eager" : "lazy"} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-col bg-gradient-to-t from-ink-950/90 via-ink-950/55 to-transparent px-2.5 pb-2 pt-7 text-white transition duration-150 [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:translate-y-0 [@media(hover:hover)]:group-focus-visible:opacity-100`}
      >
        <span className={`line-clamp-2 font-bold leading-snug ${big ? "text-sm sm:text-base" : "text-[11px] sm:text-xs"}`}>{game.blurb}</span>
      </span>
    </Link>
  );
}
