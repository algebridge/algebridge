import type { Metadata } from "next";
import { TryProblem } from "@/components/TryProblem";

export const metadata: Metadata = {
  title: "Try a problem",
  description:
    "Three real Algebra 1 practice problems with the course's own feedback, no account needed.",
};

/**
 * /try: a sample of the practice loop for someone without an account. With
 * ?embed=1 the page is the card alone (the app's menus and footer are hidden
 * by the bare-route rule in layout.tsx and globals.css), which is how
 * algebridge.org shows it inside an iframe.
 */
export default async function TryPage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const { embed } = await searchParams;
  const inFrame = embed === "1";
  return (
    <div className={inFrame ? "" : "mx-auto max-w-2xl"}>
      {!inFrame && (
        <div className="mb-5">
          <h1 className="page-title">Try a problem</h1>
          <p className="page-subtitle">
            Three real practice problems from the first skill of the course, with the same feedback a
            student gets. Nothing is saved.
          </p>
        </div>
      )}
      <TryProblem embed={inFrame} />
    </div>
  );
}
