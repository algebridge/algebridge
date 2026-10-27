import { clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { parseInsightBeacon, rpcArgs } from "@/lib/insights";
import { isLikelyBot } from "@/lib/traffic";

/**
 * POST /api/insights: one fact about what a student is doing on the
 * platform. See src/lib/insights.ts for what a beacon holds and
 * supabase/schema-2026-10-27-insights.sql for how it is kept.
 *
 * Fire and forget: the browser never reads the answer, so every outcome is
 * an empty response. Nothing about the request (address, browser) is
 * stored; the address only feeds the in-memory limit below.
 */

// A class of thirty answering problems sits behind one address, so the
// limit is generous. The database caps each visitor's day on its own.
const allow = makeRateLimiter(3000, 10 * 60 * 1000);

export async function POST(request: Request) {
  const answer = (status = 204) => new Response(null, { status });

  if (isLikelyBot(request.headers.get("user-agent") ?? "")) return answer();
  if (!allow(clientKey(request))) return answer(429);

  const text = await request.text().catch(() => "");
  if (!text || text.length > 1000) return answer(400);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return answer(400);
  }
  const beacon = parseInsightBeacon(raw);
  if (!beacon) return answer(400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return answer();

  await fetch(`${url}/rest/v1/rpc/record_learning_event`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify(rpcArgs(beacon)),
    signal: AbortSignal.timeout(4000),
  }).catch(() => null);

  return answer();
}
