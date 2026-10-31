import { CartsDemoLink } from "@/components/games/CartsDemoLink";
import { GamesBoard } from "@/components/games/GamesBoard";

/**
 * /games, on the student's own save. The page itself lives in
 * components/games/GamesBoard.tsx, which /demo/games renders too, on a
 * progress that is never saved. The kart demo link shows for its testers.
 */
export default function GamesPage() {
  return (
    <>
      <CartsDemoLink />
      <GamesBoard />
    </>
  );
}
