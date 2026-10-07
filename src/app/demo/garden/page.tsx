import type { Metadata } from "next";
import { GardenSheet } from "@/components/house/GardenSheet";

export const metadata: Metadata = {
  title: "Garden sheet",
  description: "The Bridgey House backyard in 3D, for checking the garden at any stage.",
  robots: { index: false, follow: false },
};

/**
 * /demo/garden: the 3D backyard on its own, rendered once. ?done=0.4 is the
 * share of each unit's skills finished (it sets the plants' stages and the
 * tree's), ?spread=1 finishes the course in order instead so every stage
 * shows at once, ?night=1, ?watered=1, ?style=cottage|treehouse|loft|beach|castle,
 * ?ornaments=1 sets all ten ornaments round the yard (?off=1 switches the
 * lamp off), and ?view=yard|bed|tree|house|top moves the camera.
 */
export default function GardenSheetPage() {
  return <GardenSheet />;
}
