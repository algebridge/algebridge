import { clientKey, makeRateLimiter } from "@/lib/ai-provider";
import { isLikelyBot, parseTrafficBeacon } from "@/lib/traffic";

/**
 * POST /api/traffic: one page view or one button click, from algebridge.org
 * or from the platform itself. See src/lib/traffic.ts for what a beacon holds
 * and supabase/schema-2026-10-05-console.sql for how it is counted.
 *
 * Fire and forget: the browser never reads the answer, so every outcome is an
 * empty response. Nothing about the request (address, browser) is stored; the
 * address only feeds the in-memory limit below.
 */

// A whole school can sit behind one address, so the limit is generous. It is
// there to slow a script; the database caps each visitor's day on its own.
const allow = makeRateLimiter(900, 10 * 60 * 1000);

const ORIGINS = new Set([
  "https://algebridge.org",
  "https://www.algebridge.org",
  "https://learn.algebridge.org",
  "http://localhost:4828",
  "http://127.0.0.1:4828",
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return origin && ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const answer = (status = 204) => new Response(null, { status, headers });

  if (isLikelyBot(request.headers.get("user-agent") ?? "")) return answer();
  if (!allow(clientKey(request))) return answer(429);

  const text = await request.text().catch(() => "");
  if (!text || text.length > 2000) return answer(400);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return answer(400);
  }
  const beacon = parseTrafficBeacon(raw);
  if (!beacon) return answer(400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return answer();

  const [fn, args] =
    beacon.type === "view"
      ? [
          "record_visit",
          { p_site: beacon.site, p_visitor: beacon.visitor, p_path: beacon.path, p_referrer: beacon.referrer, p_device: beacon.device },
        ]
      : ["record_event", { p_site: beacon.site, p_visitor: beacon.visitor, p_name: "cta_click", p_label: beacon.label }];

  await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(4000),
  }).catch(() => null);

  return answer();
}
