import type { Metadata } from "next";
import { units } from "@/data/curriculum";
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
 * algebridge.org shows it inside an iframe. ?wrong=1 opens the card on a
 * wrong answer with its note showing, and ?skill=<id> picks a skill of the
 * course; an id the course does not have falls back to the first skill.
 */
export default async function TryPage({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string; wrong?: string; skill?: string }>;
}) {
  const { embed, wrong, skill } = await searchParams;
  const inFrame = embed === "1";
  const chosen = skill ? units.flatMap((u) => u.skills).find((s) => s.id === skill) : undefined;
  return (
    <div className={inFrame ? "" : "mx-auto max-w-2xl"}>
      {!inFrame && (
        <div className="mb-5">
          <h1 className="page-title">Try a problem</h1>
          <p className="page-subtitle">
            Three real practice problems from {chosen ? chosen.title : "the first skill of the course"}, with the
            same feedback a student gets. Nothing is saved.
          </p>
        </div>
      )}
      <TryProblem embed={inFrame} skillId={chosen?.id} startWrong={wrong === "1"} />
    </div>
  );
}
