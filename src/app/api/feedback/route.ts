import { NextResponse } from "next/server";
import { clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { cleanReport, reportColumns, reportMessage } from "@/lib/safety";

/**
 * Takes a piece of feedback, or a star review, and keeps it in the `feedback`
 * table (see supabase/schema-feedback.sql). Until that table exists the reply
 * says so, and the page offers email instead, so feedback is never silently
 * lost.
 *
 * A review is kind "review" with a 1 to 5 `rating` column, added by
 * supabase/schema-2026-10-01-reviews.sql. Until that migration runs, PostgREST
 * refuses the unknown column (PGRST204), so the review is stored again
 * without it and the stars go into the first line of the message instead
 * ("Rating: 4 of 5 stars"). The migration reads that line back into the column.
 *
 * A report about a person (the Report button on messages, group chats, calls
 * and profiles) is kind "report", from a signed-in account only. The server
 * builds its message from the checked fields (src/lib/safety.ts), so the
 * reason, the place, the reported account and the reported message read whole
 * in the table. supabase/schema-2026-10-03-safety.sql adds columns for them
 * and admin_reports() for the admin console; until it runs, the report is
 * stored with everything in its message, the same way ratings were.
 */

const KINDS = new Set(["review", "broken", "confusing", "idea", "problem", "love", "other", "report"]);
const MAX_MESSAGE = 2000;
const allow = makeRateLimiter(20, 10 * 60 * 1000);

/** PostgREST's answer when the rating column has not been added yet. */
function missingRatingColumn(status: number, text: string): boolean {
  if (!/rating/i.test(text)) return false;
  // PGRST204: unknown column in PostgREST's schema cache. 42703: Postgres itself.
  return (status === 400 && /PGRST204/.test(text)) || /42703/.test(text);
}

/** PostgREST's answer when the report columns have not been added yet. */
function missingReportColumns(status: number, text: string): boolean {
  if (!/report_|reported_user_id/i.test(text)) return false;
  return (status === 400 && /PGRST204/.test(text)) || /42703/.test(text);
}

/** 404 with PGRST205 means the table has not been created yet. */
function noTable(status: number, text: string): boolean {
  return status === 404 && /PGRST205|feedback/.test(text);
}

export async function POST(request: Request) {
  let body: { kind?: unknown; message?: unknown; contact?: unknown; page?: unknown; token?: unknown; rating?: unknown; report?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (body.kind === "report") return storeReport(request, body);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";
  if (message.length < 3) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });

  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "other";
  // Only a review carries stars, and a review always does.
  let rating: number | null = null;
  if (kind === "review") {
    const n = typeof body.rating === "number" ? body.rating : Number(body.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json({ ok: false, reason: "rating" }, { status: 400 });
    }
    rating = n;
  }

  if (!allow(clientKey(request))) return NextResponse.json({ ok: false, reason: "slow-down" }, { status: 429 });

  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
  const page = typeof body.page === "string" ? body.page.trim().slice(0, 300) : "";
  const token = typeof body.token === "string" ? body.token : "";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ ok: false, reason: "unconfigured" });

  // The student's own session when they have one (the table fills user_id
  // from it once the reviews migration has run), the anonymous key otherwise.
  // The insert policy allows both.
  const insert = (row: Record<string, unknown>) =>
    fetch(`${url}/rest/v1/feedback`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token || anon}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

  const base = { kind, message, contact: contact || null, page: page || null };
  let res = await insert(rating === null ? base : { ...base, rating });
  let stored: "column" | "message" | null = rating === null ? null : "column";

  if (res && !res.ok && rating !== null) {
    const text = await res.text().catch(() => "");
    if (!missingRatingColumn(res.status, text)) {
      return NextResponse.json({ ok: false, reason: noTable(res.status, text) ? "no-table" : "rejected" });
    }
    // The migration has not run yet: the stars ride in the message instead.
    const head = `Rating: ${rating} of 5 stars\n\n`;
    res = await insert({ ...base, message: head + message.slice(0, MAX_MESSAGE - head.length) });
    stored = "message";
  }

  if (!res) return NextResponse.json({ ok: false, reason: "unreachable" });
  if (res.ok) return NextResponse.json(stored ? { ok: true, rating: stored } : { ok: true });
  const text = await res.text().catch(() => "");
  return NextResponse.json({ ok: false, reason: noTable(res.status, text) ? "no-table" : "rejected" });
}

/**
 * A report about a person. Signed in only. The session is checked with
 * Supabase (/auth/v1/user) and the reporter's id written into user_id, so the
 * table records who reported, whichever migrations have run; once they
 * have, the insert policy also requires user_id to be the session's own.
 */
async function storeReport(request: Request, body: { report?: unknown; page?: unknown; token?: unknown }) {
  const report = cleanReport(body.report);
  if (!report) return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ ok: false, reason: "sign-in" }, { status: 401 });
  if (!allow(clientKey(request))) return NextResponse.json({ ok: false, reason: "slow-down" }, { status: 429 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ ok: false, reason: "unconfigured" });

  const who = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!who) return NextResponse.json({ ok: false, reason: "unreachable" });
  const reporter = who.ok ? ((await who.json().catch(() => null)) as { id?: unknown } | null)?.id : null;
  if (typeof reporter !== "string" || !reporter) return NextResponse.json({ ok: false, reason: "sign-in" }, { status: 401 });

  const page = typeof body.page === "string" ? body.page.trim().slice(0, 300) : "";
  const insert = (row: Record<string, unknown>) =>
    fetch(`${url}/rest/v1/feedback`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(6000),
    }).catch(() => null);

  const base = { kind: "report", user_id: reporter, message: reportMessage(report).slice(0, MAX_MESSAGE), contact: null, page: page || null };
  let res = await insert({ ...base, ...reportColumns(report) });
  let stored: "columns" | "message" = "columns";
  if (res && !res.ok) {
    const text = await res.text().catch(() => "");
    if (!missingReportColumns(res.status, text)) {
      return NextResponse.json({ ok: false, reason: noTable(res.status, text) ? "no-table" : "rejected" });
    }
    // The migration has not run yet: the message already carries every field.
    res = await insert(base);
    stored = "message";
  }
  if (!res) return NextResponse.json({ ok: false, reason: "unreachable" });
  if (res.ok) return NextResponse.json({ ok: true, stored });
  const text = await res.text().catch(() => "");
  return NextResponse.json({ ok: false, reason: noTable(res.status, text) ? "no-table" : "rejected" });
}
