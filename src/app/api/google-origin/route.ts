import { GOOGLE_CLIENT_ID } from "@/components/GoogleIdButton";

/**
 * GET /api/google-origin: whether Google allows this site's address on the
 * "AlgeBridge web" sign-in client, so the login page can use Google's own
 * button (which names learn.algebridge.org) only once that is true, and keep
 * the redirect button until then. Asks Google's public origin check and
 * remembers the answer for five minutes.
 */
const cache = new Map<string, { valid: boolean; at: number }>();
const TTL = 5 * 60 * 1000;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const hit = cache.get(origin);
  if (hit && Date.now() - hit.at < TTL) return Response.json({ valid: hit.valid });
  let valid = false;
  try {
    const url =
      "https://accounts.google.com/o/oauth2/iframerpc?action=checkOrigin" +
      `&origin=${encodeURIComponent(origin)}&client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}`;
    const res = await fetch(url, { headers: { "X-Requested-With": "XmlHttpRequest" }, signal: AbortSignal.timeout(4000) });
    const body = (await res.json()) as { valid?: unknown };
    valid = body.valid === true;
  } catch {
    valid = false;
  }
  cache.set(origin, { valid, at: Date.now() });
  return Response.json({ valid }, { headers: { "Cache-Control": "no-store" } });
}
