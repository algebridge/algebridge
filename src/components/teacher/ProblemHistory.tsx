"use client";

import { useMemo, useState } from "react";
import { allUnits } from "@/data/curriculum";
import { Icon } from "@/components/Icon";
import type { ProblemLogEntry } from "@/types";

/**
 * Every practice try the student's account kept (the newest 200), for the
 * teacher: the problem as the student saw it, what they answered, the right
 * answer, which try it was and how long it took. Newest first, grouped by day.
 */
const SKILL_TITLES: Map<string, string> = new Map(allUnits().flatMap((u) => u.skills.map((s) => [s.id, s.title] as [string, string])));

type Filter = "all" | "wrong" | "first";

function dayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Earlier" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function duration(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function ProblemHistory({ log }: { log: ProblemLogEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [skill, setSkill] = useState<string>("");
  const [open, setOpen] = useState<number | null>(null);

  const skills = useMemo(() => [...new Set(log.map((e) => e.skillId))], [log]);
  const shown = useMemo(() => {
    const rows = log
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => (skill ? e.skillId === skill : true))
      .filter(({ e }) => (filter === "wrong" ? !e.correct : filter === "first" ? e.attempt === 1 : true))
      .reverse();
    const days: { day: string; rows: typeof rows }[] = [];
    for (const r of rows) {
      const day = dayOf(r.e.at);
      const last = days[days.length - 1];
      if (last && last.day === day) last.rows.push(r);
      else days.push({ day, rows: [r] });
    }
    return days;
  }, [log, filter, skill]);

  const wrong = log.filter((e) => !e.correct).length;
  const firstTries = log.filter((e) => e.attempt === 1);
  const firstRight = firstTries.filter((e) => e.correct).length;
  const avgSeconds = log.length ? Math.round(log.reduce((n, e) => n + e.seconds, 0) / log.length) : 0;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3 className="panel-title">Problems</h3>
        <span className="text-xs text-slate-500">Latest {log.length}</span>
      </div>
      {log.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-500">
          No problems yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 border-b border-slate-100 px-5 py-3 text-center">
            <Mini label="Right on first try" value={firstTries.length ? `${Math.round((firstRight / firstTries.length) * 100)}%` : "-"} />
            <Mini label="Wrong answers" value={`${wrong}`} />
            <Mini label="Average time" value={duration(avgSeconds)} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
            {(
              [
                ["all", "All"],
                ["wrong", "Wrong only"],
                ["first", "First tries"],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f ? "bg-bridge-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {label}
              </button>
            ))}
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              aria-label="Skill"
              className="ml-auto max-w-[14rem] rounded-lg border border-slate-200 bg-surface px-2 py-1 text-xs text-slate-700"
            >
              <option value="">Every skill</option>
              {skills.map((id) => (
                <option key={id} value={id}>
                  {SKILL_TITLES.get(id) ?? id}
                </option>
              ))}
            </select>
          </div>
          {shown.length === 0 && <p className="px-5 py-4 text-sm text-slate-500">Nothing matches that filter.</p>}
          {shown.map((d) => (
            <div key={d.day}>
              <p className="bg-slate-50 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{d.day}</p>
              <ul className="divide-y divide-slate-100">
                {d.rows.map(({ e, i }) => {
                  const expanded = open === i;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : i)}
                        aria-expanded={expanded}
                        className="flex w-full items-start gap-3 px-5 py-2.5 text-left hover:bg-slate-50"
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${e.correct ? "bg-emerald-500" : "bg-red-500"}`}
                          aria-label={e.correct ? "Right" : "Wrong"}
                        >
                          <Icon name={e.correct ? "check" : "close"} size={12} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm text-slate-800 ${expanded ? "" : "line-clamp-1"}`}>{e.prompt}</span>
                          <span className="block text-xs text-slate-500">
                            {SKILL_TITLES.get(e.skillId) ?? e.skillId} · {e.attempt === 1 ? "first try" : `try ${e.attempt}`} · {duration(e.seconds)} · {timeOf(e.at)}
                          </span>
                        </span>
                        <span className={`shrink-0 max-w-[8rem] truncate rounded px-2 py-0.5 font-mono text-xs ${e.correct ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                          {e.given || "(blank)"}
                        </span>
                      </button>
                      {expanded && (
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 bg-slate-50/60 px-5 pb-3 pl-[3.25rem] text-xs">
                          <div>
                            <dt className="text-slate-500">Their answer</dt>
                            <dd className="font-mono text-slate-900">{e.given || "(blank)"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Right answer</dt>
                            <dd className="font-mono text-slate-900">{e.answer ?? "-"}</dd>
                          </div>
                        </dl>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
