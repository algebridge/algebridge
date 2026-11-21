import { notFound } from "next/navigation";
import Link from "next/link";
import { ArcadeGate } from "@/components/games/ArcadeGate";
import { ArcadePlayer } from "@/components/games/ArcadePlayer";
import { ARCADE_GAMES, getArcadeGame } from "@/lib/arcade/games";

export function generateStaticParams() {
  return ARCADE_GAMES.filter((g) => !g.href).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const game = getArcadeGame((await params).slug);
  return { title: game ? game.name : "Games" };
}

/** /games/play/<slug>: one arcade game, framed. Open to arcade testers only for now. */
export default async function ArcadePlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const game = getArcadeGame((await params).slug);
  if (!game) notFound();
  return (
    <ArcadeGate
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-slate-900">This game is not open yet</h1>
          <p className="mt-2 text-sm text-slate-600">
            It is still being tested.{" "}
            <Link href="/games" className="font-semibold text-indigo-700 underline">
              Back to games
            </Link>
          </p>
        </div>
      }
    >
      <ArcadePlayer game={game} />
    </ArcadeGate>
  );
}
