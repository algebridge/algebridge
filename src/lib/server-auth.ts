/**
 * Who is calling an API route, checked with Supabase on the server.
 *
 * Practice is saved to an account (PracticeGate), so the routes that cost
 * money per call (the test review's photo reader and reviewer) ask for the
 * session's access token in the Authorization header and confirm it with
 * /auth/v1/user. Limits are then counted per account, not per address, so one
 * student cannot spend a whole school's budget and a school's shared address
 * does not lock the class out.
 *
 * Without Supabase (local builds, the demo launch configs) there are no
 * accounts: progress lives in localStorage and every caller is "local". The
 * gate no-ops the same way PracticeGate does.
 */

export type Caller = { ok: true; id: string | null } | { ok: false; status: 401 | 503; error: string };

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { id: string; until: number }>();

export function tokenFrom(request: Request): string | null {
  const m = request.headers.get("authorization")?.match(/^Bearer\s+([\w.\-]+)$/i);
  return m ? m[1] : null;
}

export async function callerOf(request: Request): Promise<Caller> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: true, id: null };

  const token = tokenFrom(request);
  if (!token) return { ok: false, status: 401, error: "Sign in to review a test." };

  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return { ok: true, id: hit.id };

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!res) return { ok: false, status: 503, error: "Could not check your sign-in. Try again in a moment." };
  if (res.status === 401 || res.status === 403) return { ok: false, status: 401, error: "Your session has expired. Sign in again." };
  const who = res.ok ? ((await res.json().catch(() => null)) as { id?: unknown } | null) : null;
  if (!who || typeof who.id !== "string" || !who.id) {
    return { ok: false, status: 503, error: "Could not check your sign-in. Try again in a moment." };
  }
  if (cache.size > 2000) cache.clear();
  cache.set(token, { id: who.id, until: Date.now() + CACHE_MS });
  return { ok: true, id: who.id };
}
