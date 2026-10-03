import type { Metadata } from "next";
import { HouseDemo } from "@/components/demo/HouseDemo";

export const metadata: Metadata = {
  title: "Bridgey House demo",
  description: "Bridgey House with a few Bridgeys to spend: buy a piece, place it, paint it. Nothing is saved.",
};

/**
 * /demo/house: the house as algebridge.org shows it inside an iframe. A bare
 * route (lib/bare-route.ts), so the card is all there is.
 */
export default function HouseDemoPage() {
  return <HouseDemo />;
}
