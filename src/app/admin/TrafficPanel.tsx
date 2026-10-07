"use client";

import type { AdminTraffic, AdminTrafficResult, TrafficCount } from "@/lib/admin";

/** What each data-cta button on algebridge.org says, and where it sits. */
export const CTA_LABELS: Record<string, string> = {
  "hero-start": "Hero · Start learning",
  "hero-schools": "Hero · For teachers and schools",
  "nav-start": "Top bar · Start learning",
  "nav-login": "Top bar · Log in",
  "sheet-start": "Phone menu · Start learning",
  "sheet-login": "Phone menu · Log in",
  "sticky-start": "Phone bottom bar · Start learning, free",
  "demo-open": "Demo · Open the platform",
  "curriculum-start": "Curriculum · Start learning",
  "students-start": "Students · Create a free account",
  "parents-safety": "Parents · Read the safety page",
  "teachers-schools": "Teachers · For schools",
  "close-start": "Closing · Start learning",
  "close-schools": "Closing · Bring it to a school",
};

/**
 * The welcome tour's buttons (components/WelcomeTour.tsx), in the order a
 * visitor meets them, so the list reads as a funnel: started, finished, and
 * where the rest stopped.
 */
const TOUR_ROWS: { label: string; text: string }[] = [
  { label: "tour-start", text: "Started: Show me around" },
  { label: "tour-menu", text: "Started from the menu" },
  { label: "tour-done", text: "Reached the last step" },
  { label: "tour-signup", text: "Went to Create account" },
  { label: "tour-later", text: "Chose Keep exploring" },
  { label: "tour-left", text: "Left for another page" },
];

export function tourRows(clicks: { site: string; label: string; n: number }[]): { key: string; text: string; n: number }[] {
  const app = clicks.filter((c) => c.site === "app" && c.label.startsWith("tour-"));
  const count = (label: string) => app.filter((c) => c.label === label).reduce((sum, c) => sum + c.n, 0);
  const skips = app.filter((c) => c.label.startsWith("tour-skip-"));
  return [
    ...TOUR_ROWS.map((r) => ({ key: r.label, text: r.text, n: count(r.label) })),
    ...[...new Set(skips.map((c) => c.label))].map((label) => ({ key: label, text: `Skipped at: ${label.slice("tour-skip-".length)}`, n: count(label) })),
  ].filter((r) => r.n > 0);
}

const GA_PROPERTY = "557361067";
const GOOGLE_LINKS = [
  { href: `https://analytics.google.com/analytics/web/#/p${GA_PROPERTY}/realtime/overview`, label: "Google Analytics · Realtime" },
  { href: `https://analytics.google.com/analytics/web/#/p${GA_PROPERTY}/reports/intelligenthome`, label: "Google Analytics · Reports" },
  { href: "https://search.google.com/search-console?resource_id=https%3A%2F%2Falgebridge.org%2F", label: "Search Console · algebridge.org" },
  { href: "https://search.google.com/search-console?resource_id=https%3A%2F%2Flearn.algebridge.org%2F", label: "Search Console · platform" },
];

const SITE_NAME = { site: "algebridge.org", app: "Platform" } as const;

/** Visitors and page views added up over the last `n` days of the series. */
export function lastDays(t: AdminTraffic, n: number) {
  const recent = t.days.slice(-n);
  return {
    siteVisitors: recent.reduce((s, d) => s + d.siteVisitors, 0),
    siteViews: recent.reduce((s, d) => s + d.siteViews, 0),
    appVisitors: recent.reduce((s, d) => s + d.appVisitors, 0),
    appViews: recent.reduce((s, d) => s + d.appViews, 0),
  };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

function sourceLabel(c: TrafficCount): string {
  if (c.label === "(direct)") return "Direct, a bookmark or an app";
  if (c.site === "app" && c.label === "algebridge.org") return "algebridge.org, the home page";
  return c.label;
}

function Bars({ rows, label }: { rows: { key: string; text: string; n: number; title?: string }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (rows.length === 0) return <p style={{ fontSize: 13, color: "var(--muted)" }}>Nothing counted yet.</p>;
  return (
    <ul className="sbc-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} title={r.title}>
          <span>{r.text}</span>
          <b>{r.n.toLocaleString()}</b>
          <i aria-hidden="true">
            <em style={{ width: `${Math.max(2, Math.round((r.n / max) * 100))}%` }} />
          </i>
        </li>
      ))}
    </ul>
  );
}

/**
 * Visits to algebridge.org and the platform, counted by AlgeBridge itself
 * (src/lib/traffic.ts, supabase/schema-2026-10-05-console.sql). Google
 * Analytics and Search Console have more detail; the panel links to both.
 */
export function TrafficPanel({ data, loading }: { data: AdminTrafficResult | null; loading: boolean }) {
  if (!data) {
    return loading ? <p style={{ fontSize: 13 }}>Loading visits…</p> : null;
  }
  if (data.status === "missing") {
    return (
      <div className="sbc-notice is-info" role="status">
        <strong>Visit counts need the October 5 database update.</strong> Run{" "}
        <code>supabase/schema-2026-10-05-console.sql</code> in the Supabase SQL editor. Until then the sites still send
        their visits, and the database turns them away.
      </div>
    );
  }
  if (data.status === "error") {
    return (
      <div className="sbc-notice" role="alert">
        The visit counts could not be read: {data.message}
      </div>
    );
  }

  const t = data.data;
  const today = t.days[t.days.length - 1];
  const week = lastDays(t, 7);
  const month = lastDays(t, t.days.length);
  const max = Math.max(1, ...t.days.map((d) => Math.max(d.siteVisitors, d.appVisitors)));
  const clicks = t.clicks.filter((c) => c.site === "site");
  const clickTotal = clicks.reduce((s, c) => s + c.n, 0);

  return (
    <>
      <div className="sbc-stats">
        <article className="sbc-stat">
          <strong>{today?.siteVisitors ?? 0}</strong>
          <span>algebridge.org · today</span>
          <b className="is-quiet">{plural(today?.siteViews ?? 0, "page view")}</b>
        </article>
        <article className="sbc-stat">
          <strong>{week.siteVisitors}</strong>
          <span>algebridge.org · 7 days</span>
          <b className="is-quiet">{plural(week.siteViews, "page view")}</b>
        </article>
        <article className="sbc-stat">
          <strong>{today?.appVisitors ?? 0}</strong>
          <span>Platform · today</span>
          <b className="is-quiet">{plural(today?.appViews ?? 0, "page view")}</b>
        </article>
        <article className="sbc-stat">
          <strong>{week.appVisitors}</strong>
          <span>Platform · 7 days</span>
          <b className="is-quiet">{plural(week.appViews, "page view")}</b>
        </article>
        <article className="sbc-stat">
          <strong>{clickTotal}</strong>
          <span>Button clicks · 30 days</span>
          <b className="is-quiet">{clicks[0] ? `most: ${CTA_LABELS[clicks[0].label] ?? clicks[0].label}` : "on algebridge.org"}</b>
        </article>
      </div>

      <section className="sbc-panel" aria-labelledby="sbc-visits-title">
        <div className="sbc-panel-head">
          <h2 id="sbc-visits-title">Visitors by day</h2>
          <span className="sbc-meta">
            {t.days.length} days · {plural(month.siteVisitors, "visit")} to algebridge.org · {plural(month.appVisitors, "visit")} to the platform
          </span>
        </div>
        <div className="sbc-panel-body" style={{ display: "grid", gap: 10 }}>
          <div className="sbc-legend">
            <span>algebridge.org</span>
            <span className="is-app">Platform</span>
          </div>
          <div className="sbc-pairs">
            {t.days.map((d) => (
              <span
                key={d.day}
                className={`sbc-pair${d.siteVisitors + d.appVisitors === 0 ? " is-empty" : ""}`}
                title={`${d.day}: ${d.siteVisitors} on algebridge.org (${d.siteViews} views), ${d.appVisitors} on the platform (${d.appViews} views)`}
              >
                <i style={{ height: d.siteVisitors ? `${Math.round((d.siteVisitors / max) * 100)}%` : 2 }} />
                <i className="is-app" style={{ height: d.appVisitors ? `${Math.round((d.appVisitors / max) * 100)}%` : 2 }} />
              </span>
            ))}
          </div>
          <div className="sbc-axis">
            <span>{t.days[0]?.day ?? ""}</span>
            <span>{today?.day ?? ""}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
            A visitor is one browser on one day: someone who comes back on three days counts three times, and the 7-day
            numbers add the days up. Admins, bots and browsers that send Global Privacy Control are left out. Days run on
            New York time.
            {t.firstDay ? ` Counting started ${t.firstDay}.` : " Nothing has been counted yet; the first visit shows up within seconds."}
          </p>
        </div>
      </section>

      <div className="sbc-grid2">
        {(["site", "app"] as const).map((s) => (
          <section className="sbc-panel" key={`ref-${s}`}>
            <div className="sbc-panel-head">
              <h2>Where {SITE_NAME[s] === "Platform" ? "platform" : "algebridge.org"} visitors came from</h2>
              <span className="sbc-meta">30 days</span>
            </div>
            <div className="sbc-panel-body">
              <Bars
                label={`Sources for ${SITE_NAME[s]}`}
                rows={t.referrers.filter((r) => r.site === s).map((r) => ({ key: r.label, text: sourceLabel(r), n: r.n }))}
              />
            </div>
          </section>
        ))}

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Busiest platform pages</h2>
            <span className="sbc-meta">page views · 30 days</span>
          </div>
          <div className="sbc-panel-body">
            <Bars
              label="Busiest platform pages"
              rows={t.pages.filter((p) => p.site === "app").map((p) => ({ key: p.label, text: p.label, n: p.n }))}
            />
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Buttons clicked on algebridge.org</h2>
            <span className="sbc-meta">30 days</span>
          </div>
          <div className="sbc-panel-body">
            <Bars
              label="Buttons clicked on algebridge.org"
              rows={clicks.map((c) => ({ key: c.label, text: CTA_LABELS[c.label] ?? c.label, n: c.n, title: c.label }))}
            />
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Welcome tour</h2>
            <span className="sbc-meta">first visits without an account · 30 days</span>
          </div>
          <div className="sbc-panel-body">
            <Bars label="Welcome tour" rows={tourRows(t.clicks)} />
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>Devices</h2>
            <span className="sbc-meta">visitors · 30 days</span>
          </div>
          <div className="sbc-panel-body">
            <Bars
              label="Devices"
              rows={t.devices.map((d) => ({ key: `${d.site}-${d.label}`, text: `${SITE_NAME[d.site]} · ${d.label}`, n: d.n }))}
            />
          </div>
        </section>

        <section className="sbc-panel">
          <div className="sbc-panel-head">
            <h2>More from Google</h2>
            <span className="sbc-meta">signed in as the account that owns them</span>
          </div>
          <div className="sbc-panel-body" style={{ display: "grid", gap: 8, fontSize: 13 }}>
            {GOOGLE_LINKS.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            ))}
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>
              Google Analytics counts the same visits its own way, so its numbers will differ a little: ad blockers stop
              it more often. Search Console shows what people searched on Google before they clicked through.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
