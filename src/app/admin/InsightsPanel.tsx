"use client";

import { allUnits, getUnit } from "@/data/curriculum";
import { GAME_CARDS } from "@/lib/games";
import { MOODS } from "@/lib/insights";
import type { AdminInsights, AdminInsightsResult } from "@/lib/admin";
import { Bars } from "./TrafficPanel";

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** Seconds as "2h 10m", "14m" or "40s". */
function clock(seconds: number | null | undefined): string {
  if (seconds == null) return "–";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m - h * 60}m`;
}

function pct(rate: number | null | undefined): string {
  return rate == null ? "–" : `${Math.round(rate * 100)}%`;
}

const skillTitles = new Map<string, string>();
for (const u of allUnits()) for (const s of u.skills) skillTitles.set(s.id, s.title);

function skillName(id: string): string {
  return skillTitles.get(id) ?? id;
}

function unitName(id: string): string {
  const u = getUnit(id);
  return u ? `Unit ${u.number} · ${u.title}` : id;
}

function gameName(id: string): string {
  return GAME_CARDS.find((g) => g.id === id)?.title ?? id;
}

const CONTEXT_NAMES: Record<string, string> = {
  practice: "On a skill page",
  games: "In the games",
  house: "In the house",
  social: "Messages and tutors",
  progress: "Review and progress pages",
  home: "The home page",
  other: "Elsewhere",
};

const MODE_NAMES: Record<string, string> = {
  tutor: "Help with a problem",
  reminder: "A reminder or formula",
  scheduler: "Booking a tutor",
  action: "A quick action button",
};

const PROBLEM_TYPES: Record<string, string> = {
  numeric: "Typed answer",
  "multiple-choice": "Multiple choice",
  "error-analysis": "Find the mistake",
  "step-order": "Put the steps in order",
  expression: "Typed expression",
};

/** The day series as one row of small bars, with the day on hover. */
function DayBars({ days, pick, title, unit }: { days: AdminInsights["days"]; pick: (d: AdminInsights["days"][number]) => number; title: string; unit: string }) {
  const max = Math.max(1, ...days.map(pick));
  return (
    <div className="sbc-pairs" role="img" aria-label={title}>
      {days.map((d) => {
        const v = pick(d);
        return (
          <span key={d.day} className={`sbc-pair${v === 0 ? " is-empty" : ""}`} title={`${d.day}: ${v.toLocaleString()} ${unit}`}>
            <i className="is-app" style={{ height: v ? `${Math.round((v / max) * 100)}%` : 2 }} />
          </span>
        );
      })}
    </div>
  );
}

/**
 * What students do on the platform, counted by AlgeBridge itself
 * (src/lib/insights.ts, supabase/schema-2026-10-27-insights.sql): time by
 * unit and skill, time per problem, Archie, the games, and the mood survey.
 */
export function InsightsPanel({ data, loading }: { data: AdminInsightsResult | null; loading: boolean }) {
  if (loading && !data) {
    return (
      <div className="sbc-notice is-info" role="status">
        Reading the insights…
      </div>
    );
  }
  if (!data) return null;
  if (data.status === "missing") {
    return (
      <div className="sbc-notice is-info" role="status">
        <strong>Insights need the October 27 database update.</strong> Run <code>supabase/schema-2026-10-27-insights.sql</code> in
        the Supabase SQL editor. Until then the platform still sends its facts, and the database turns them away.
      </div>
    );
  }
  if (data.status === "error") {
    return (
      <div className="sbc-notice" role="alert">
        The insights could not be read: {data.message}
      </div>
    );
  }

  const t = data.data;
  const span = t.days.length;
  const archieShare = t.archie.activeDays ? t.archie.talkingDays / t.archie.activeDays : null;
  const gamesShare = t.games.activeDays ? t.games.playingDays / t.games.activeDays : null;
  const moodAsked = t.mood.answered + t.mood.dismissed;
  const moodRate = moodAsked ? t.mood.answered / moodAsked : null;
  const moodMax = Math.max(1, ...t.mood.counts.map((c) => c.n));
  const unitsSeconds = t.units.reduce((s, u) => s + u.seconds, 0);

  return (
    <>
      <div className="sbc-stats">
        <article className="sbc-stat">
          <strong>{t.totals.activeDays.toLocaleString()}</strong>
          <span>Active browser-days · {span} days</span>
          <b className="is-quiet">{t.roles.map((r) => `${r.activeDays} ${r.role}`).join(" · ") || "nobody yet"}</b>
        </article>
        <article className="sbc-stat">
          <strong>{clock(t.problem.medianSeconds)}</strong>
          <span>Typical time to solve one problem</span>
          <b className="is-quiet">
            half take {clock(t.problem.p25Seconds)} to {clock(t.problem.p75Seconds)} · {plural(t.totals.solved, "solved problem")}
          </b>
        </article>
        <article className="sbc-stat">
          <strong>{clock(t.skillVisit.medianSeconds)}</strong>
          <span>Typical time on one skill, per visit</span>
          <b className="is-quiet">
            mean {clock(t.skillVisit.meanSeconds)} · {plural(t.skillVisit.visits, "skill visit")}
          </b>
        </article>
        <article className="sbc-stat">
          <strong>{pct(t.totals.firstTryRate)}</strong>
          <span>Right on the first try</span>
          <b className="is-quiet">
            {plural(t.problem.skips, "skip")} · {plural(t.problem.reveals, "worked answer")} shown
          </b>
        </article>
        <article className="sbc-stat">
          <strong>{pct(archieShare)}</strong>
          <span>Browser-days that talked to Archie</span>
          <b className="is-quiet">
            {plural(t.archie.messages, "message")} · median {t.archie.medianPerTalkingDay ?? "–"} per talking day
          </b>
        </article>
        <article className="sbc-stat">
          <strong>{pct(gamesShare)}</strong>
          <span>Browser-days that played a game</span>
          <b className="is-quiet">
            {plural(t.games.starts, "game")} · {clock(t.games.totalSeconds)} in all
          </b>
        </article>
        <article className="sbc-stat">
          <strong>{t.mood.mean == null ? "–" : t.mood.mean.toFixed(1)}</strong>
          <span>Mood, 1 to 5</span>
          <b className="is-quiet">
            {plural(t.mood.answered, "answer")} · {pct(moodRate)} answered when asked
          </b>
        </article>
      </div>

      <section className="sbc-panel" aria-labelledby="sbc-insights-days">
        <div className="sbc-panel-head">
          <h2 id="sbc-insights-days">By day</h2>
          <span className="sbc-meta">
            {span} days · {clock(t.totals.skillSeconds)} on skill pages
          </span>
        </div>
        <div className="sbc-panel-body" style={{ display: "grid", gap: 14 }}>
          {(
            [
              { title: "Active browser-days", unit: "active", pick: (d: AdminInsights["days"][number]) => d.active },
              { title: "Problems solved", unit: "solved", pick: (d: AdminInsights["days"][number]) => d.solved },
              { title: "Messages to Archie", unit: "messages", pick: (d: AdminInsights["days"][number]) => d.archie },
              { title: "Games started", unit: "games", pick: (d: AdminInsights["days"][number]) => d.games },
            ] as const
          ).map((row) => (
            <div key={row.title} style={{ display: "grid", gap: 4 }}>
              <div className="sbc-legend">
                <span className="is-app">{row.title}</span>
              </div>
              <DayBars days={t.days} pick={row.pick} title={row.title} unit={row.unit} />
            </div>
          ))}
          <div className="sbc-axis">
            <span>{t.days[0]?.day ?? ""}</span>
            <span>{t.days[span - 1]?.day ?? ""}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
            A browser-day is one browser on one day that did at least one thing here: answered a problem, spent time on a
            skill, talked to Archie, played a game or answered the mood survey. The id changes every day, so nothing
            follows one student across days. Admins, framed demos and local hosts are left out. Days run on New York time.
            {t.firstDay ? ` Counting started ${t.firstDay}.` : " Nothing has been counted yet; the first fact shows up within seconds."}
          </p>
        </div>
      </section>

      <div className="sbc-grid2">
        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Time by unit</h2>
            <span className="sbc-meta">{clock(unitsSeconds)} · {span} days</span>
          </div>
          <div className="sbc-panel-body">
            <Bars
              label="Time by unit"
              rows={t.units.map((u) => ({
                key: `${u.course}/${u.unit}`,
                text: unitName(u.unit),
                n: Math.round(u.seconds / 60),
                title: `${clock(u.seconds)} over ${plural(u.visits, "visit")} · ${plural(u.solved, "solved")} · ${pct(u.firstTryRate)} first try · ${clock(u.medianProblemSeconds)} per problem`,
              }))}
            />
            {t.units.length > 0 && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Minutes. Hover a row for visits, accuracy and time per problem.</p>}
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Hardest skills</h2>
            <span className="sbc-meta">lowest first-try rate · 10+ solves</span>
          </div>
          <div className="sbc-panel-body">
            {t.hardest.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nothing with ten solves yet.</p>
            ) : (
              <div className="sbc-table-wrap">
                <table className="sbc-table">
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>First try</th>
                      <th>Per problem</th>
                      <th>Solved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.hardest.map((h) => (
                      <tr key={h.skill}>
                        <td>
                          {skillName(h.skill)}
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{unitName(h.unit)}</div>
                        </td>
                        <td>{pct(h.firstTryRate)}</td>
                        <td>{clock(h.medianProblemSeconds)}</td>
                        <td>{h.solved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="sbc-panel">
        <div className="sbc-panel-head">
          <h2>Time by skill</h2>
          <span className="sbc-meta">top {t.skills.length} · {span} days</span>
        </div>
        <div className="sbc-panel-body is-flush sbc-table-wrap">
          {t.skills.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)", padding: 14 }}>Nothing counted yet.</p>
          ) : (
            <table className="sbc-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Time</th>
                  <th>Visits</th>
                  <th>Per visit</th>
                  <th>Solved</th>
                  <th>First try</th>
                  <th>Per problem</th>
                  <th>Skips</th>
                </tr>
              </thead>
              <tbody>
                {t.skills.map((s) => (
                  <tr key={s.skill}>
                    <td>
                      {skillName(s.skill)}
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{unitName(s.unit)}</div>
                    </td>
                    <td>{clock(s.seconds)}</td>
                    <td>{s.visits}</td>
                    <td>{clock(s.medianVisitSeconds)}</td>
                    <td>{s.solved}</td>
                    <td>{pct(s.firstTryRate)}</td>
                    <td>{clock(s.medianProblemSeconds)}</td>
                    <td>{s.skips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="sbc-grid2">
        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>One problem</h2>
            <span className="sbc-meta">time to the right answer, by kind</span>
          </div>
          <div className="sbc-panel-body">
            {t.problem.byType.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nothing counted yet.</p>
            ) : (
              <div className="sbc-table-wrap">
                <table className="sbc-table">
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Typical</th>
                      <th>First try</th>
                      <th>Solved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.problem.byType.map((p) => (
                      <tr key={p.type}>
                        <td>{PROBLEM_TYPES[p.type] ?? p.type}</td>
                        <td>{clock(p.medianSeconds)}</td>
                        <td>{pct(p.firstTryRate)}</td>
                        <td>{p.solved}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              Typical is the median: half of the right answers came faster. The clock starts when the problem can be read.
            </p>
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Archie</h2>
            <span className="sbc-meta">
              {plural(t.archie.opens, "open")} · median message {t.archie.medianChars ?? "–"} characters
            </span>
          </div>
          <div className="sbc-panel-body" style={{ display: "grid", gap: 14 }}>
            <Bars label="Messages by kind" rows={t.archie.byMode.map((m) => ({ key: m.mode, text: MODE_NAMES[m.mode] ?? m.mode, n: m.n }))} />
            {t.archie.topSkills.length > 0 && (
              <div>
                <div className="sbc-legend">
                  <span className="is-app">Skills Archie is asked about most</span>
                </div>
                <Bars label="Skills Archie is asked about" rows={t.archie.topSkills.map((s) => ({ key: s.skill, text: skillName(s.skill), n: s.n }))} />
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--muted)" }}>What students write to Archie is never stored here; only that a message was sent, and how long it was.</p>
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Games</h2>
            <span className="sbc-meta">
              {plural(t.games.matches, "two-player match", "two-player matches")} · typical game {clock(t.games.medianSeconds)}
            </span>
          </div>
          <div className="sbc-panel-body">
            <Bars
              label="Games started"
              rows={t.games.byGame.map((g) => ({ key: g.game, text: gameName(g.game), n: g.starts, title: `${clock(g.seconds)} played` }))}
            />
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>How students say they feel</h2>
            <span className="sbc-meta">
              {plural(moodAsked, "survey")} shown · {plural(t.mood.answered, "answer")}
            </span>
          </div>
          <div className="sbc-panel-body" style={{ display: "grid", gap: 14 }}>
            <ul className="sbc-bars" aria-label="Mood answers">
              {t.mood.counts.map((c) => (
                <li key={c.mood}>
                  <span>{MOODS.find((m) => m.value === c.mood)?.word ?? c.mood}</span>
                  <b>{c.n.toLocaleString()}</b>
                  <i aria-hidden="true">
                    <em style={{ width: `${Math.max(2, Math.round((c.n / moodMax) * 100))}%` }} />
                  </i>
                </li>
              ))}
            </ul>
            {t.mood.byContext.length > 0 && (
              <div className="sbc-table-wrap">
                <table className="sbc-table">
                  <thead>
                    <tr>
                      <th>Where they were</th>
                      <th>Answers</th>
                      <th>Mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.mood.byContext.map((c) => (
                      <tr key={c.context}>
                        <td>{CONTEXT_NAMES[c.context] ?? c.context}</td>
                        <td>{c.n}</td>
                        <td>{c.mean == null ? "–" : c.mean.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {t.mood.byHour.length > 0 && (
              <div>
                <div className="sbc-legend">
                  <span className="is-app">Mean mood by hour of day, New York time</span>
                </div>
                <div className="sbc-table-wrap">
                  <table className="sbc-table">
                    <thead>
                      <tr>
                        <th>Hour</th>
                        <th>Answers</th>
                        <th>Mean</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.mood.byHour.map((h) => (
                        <tr key={h.hour}>
                          <td>{`${h.hour}:00`}</td>
                          <td>{h.n}</td>
                          <td>{h.mean == null ? "–" : h.mean.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--muted)" }}>
              The card asks &ldquo;How are you feeling at this exact moment?&rdquo; a few minutes into a visit, at most once every six hours per browser.
              Frustrated is 1, Great is 5.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
