import type { Metadata } from "next";
import { FurnitureSheet } from "@/components/house/FurnitureSheet";

export const metadata: Metadata = {
  title: "Furniture sheet",
  description: "Every Bridgey House piece, photographed in the studio or set in a room.",
  robots: { index: false, follow: false },
};

/**
 * /demo/furniture: every piece of the 3D house on one page, for checking the
 * models (and the shop's pictures) side by side. ?ids=desk,bed picks pieces,
 * ?color=blue paints them, ?off=1 switches them off, ?room=1 sets them in a
 * room instead (with ?theme=loft and ?floor=up). A bare route: nothing else
 * on the page.
 */
export default function FurnitureSheetPage() {
  return <FurnitureSheet />;
}
