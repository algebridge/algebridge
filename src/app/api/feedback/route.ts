import { NextResponse } from "next/server";
import { clientKey, makeRateLimiter } from "@/lib/ai-provider";

/**
 * Takes a piece of feedback and keeps it in the `feedback` table (see
 * supabase/schema-feedback.sql). Until that table exists the reply says so,
 * and the page offers email instead, so feedback is never silently lost.
 */

const KINDS = new Set(["broken", "confusing", "idea", "problem", "love", "other"]);
const allow = makeRateLimiter(20, 10 * 60 * 1000);

export async function POST(request: Request) {
  let body: { kind?: unknown; message?: unknown; contact?: unknown; page?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (message.length < 3) return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  if (!allow(clientKey(request))) return NextResponse.json({ ok: false, reason: "slow-down" }, { status: 429 });

  const kind = typeof body.kind === "string" && KINDS.has(body.kind) ? body.kind : "other";
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
  const page = typeof body.page === "string" ? body.page.trim().slice(0, 300) : "";
  const token = typeof body.token === "string" ? body.token : "";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ ok: false, reason: "unconfigured" });

  // The student's own session when they have one (so user_id is set), the
  // anonymous key otherwise. The insert policy allows both.
  const res = await fetch(`${url}/rest/v1/feedback`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token || anon}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ kind, message, contact: contact || null, page: page || null }),
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);

  if (!res) return NextResponse.json({ ok: false, reason: "unreachable" });
  if (res.ok) return NextResponse.json({ ok: true });
  // 404 with PGRST205 means the table has not been created yet.
  const text = await res.text().catch(() => "");
  const reason = /PGRST205|feedback/.test(text) && res.status === 404 ? "no-table" : "rejected";
  return NextResponse.json({ ok: false, reason });
}
