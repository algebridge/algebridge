import { GamesBoard } from "@/components/games/GamesBoard";

/**
 * /games, on the student's own save. The page itself lives in
 * components/games/GamesBoard.tsx, which /demo/games renders too, on a
 * progress that is never saved.
 */
export default function GamesPage() {
  return <GamesBoard />;
}
