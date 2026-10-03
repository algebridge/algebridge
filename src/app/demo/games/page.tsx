import type { Metadata } from "next";
import { GamesDemo } from "@/components/demo/GamesDemo";

export const metadata: Metadata = {
  title: "Games demo",
  description: "Skate with Veronica or play with the team: every game stops for a head-math question. Playable here; nothing is saved.",
};

/**
 * /demo/games: the Games page as a card, for algebridge.org's iframe. /demo
 * is a bare route (lib/bare-route.ts), so the app shell is hidden around it.
 */
export default function GamesDemoPage() {
  return <GamesDemo />;
}
