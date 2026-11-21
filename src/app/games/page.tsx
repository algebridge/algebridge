import { ArcadeGate } from "@/components/games/ArcadeGate";
import { ArcadeHub } from "@/components/games/ArcadeHub";
import { CartsCard } from "@/components/games/CartsCard";
import { GamesBoard } from "@/components/games/GamesBoard";

/**
 * /games. Arcade testers (lib/arcade/testers.ts) get the arcade board first
 * (components/games/ArcadeHub.tsx, one tile a game, Alge Carts among them);
 * everyone else gets the Alge Carts card, as before. Then the team games on
 * the student's own save: components/games/GamesBoard.tsx, which /demo/games
 * renders too, on a progress that is never saved.
 */
export default function GamesPage() {
  return (
    <div className="space-y-10">
      <ArcadeGate fallback={<CartsCard />}>
        <ArcadeHub />
      </ArcadeGate>
      <section aria-labelledby="team-games">
        <h2 id="team-games" className="mb-3 text-lg font-extrabold tracking-tight text-slate-900">
          Play with the team
        </h2>
        <GamesBoard />
      </section>
    </div>
  );
}
