import { notFound } from "next/navigation";
import { PictureGallery } from "@/app/demo/problem-pictures/PictureGallery";

/** /demo/problem-pictures: every kind of problem picture, one sample per skill and kind. Development only. */
export default function ProblemPicturesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PictureGallery />;
}
