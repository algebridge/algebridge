import type { Metadata } from "next";
import { PictureStudio } from "@/components/house/PictureStudio";

export const metadata: Metadata = {
  title: "House pictures",
  description: "Renders the shop's pictures of every piece, for scripts/house-pictures.mjs.",
  robots: { index: false, follow: false },
};

/** /demo/pictures: used by scripts/house-pictures.mjs to render the shop's pictures ahead of time. */
export default function PicturesPage() {
  return <PictureStudio />;
}
