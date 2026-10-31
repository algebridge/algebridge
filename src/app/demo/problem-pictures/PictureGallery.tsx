"use client";

import { useMemo, useState } from "react";
import { units } from "@/data/curriculum";
import { generateProblemBank } from "@/data/skill-problem-generators";
import { ProblemPicture } from "@/components/ProblemPicture";
import { pictureFor, type Picture } from "@/lib/pictures";

interface Sample {
  skill: string;
  prompt: string;
  picture: Picture;
}

/** One practice problem per skill and picture kind, drawn, to look every drawing over at once. */
export function PictureGallery() {
  const [kind, setKind] = useState<string>("");
  const samples = useMemo(() => {
    const out: Sample[] = [];
    for (const u of units) {
      for (const s of u.skills) {
        const seen = new Set<string>();
        for (const p of generateProblemBank(s.id, s.problems)) {
          if (p.type !== "numeric" && p.type !== "multiple-choice") continue;
          const picture = pictureFor(s.id, p.prompt);
          if (!picture || seen.has(picture.kind)) continue;
          seen.add(picture.kind);
          out.push({ skill: s.id, prompt: p.prompt, picture });
        }
      }
    }
    return out;
  }, []);
  const kinds = [...new Set(samples.map((s) => s.picture.kind))].sort();
  const shown = kind ? samples.filter((s) => s.picture.kind === kind) : samples;
  return (
    <div className="space-y-4">
      <header>
        <p className="eyebrow">Development</p>
        <h1 className="page-title">Problem pictures</h1>
        <p className="mt-1 text-sm text-slate-500">
          {samples.length} samples, one per skill and kind. {kinds.length} kinds.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setKind("")} className={`rounded-full px-3 py-1 text-xs font-medium ${kind === "" ? "bg-bridge-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            All
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${kind === k ? "bg-bridge-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              {k} ({samples.filter((s) => s.picture.kind === k).length})
            </button>
          ))}
        </div>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {shown.map((s, i) => (
          <li key={i} className="panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {s.skill} · {s.picture.kind}
              {s.picture.reveals ? " · after a try" : ""}
            </p>
            <p className="mt-1 text-sm text-slate-800">{s.prompt}</p>
            <div className="mt-3">
              <ProblemPicture picture={s.picture} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
