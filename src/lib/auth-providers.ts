import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Which third-party sign-in providers the Supabase project actually has
 * turned on.
 *
 * Rendering a "Continue with Google" button when the provider is disabled
 * produces a 400 and a raw error string, which reads to the user as the site
 * being broken. Asking the project what it supports means the button appears
 * exactly when it can work, and starts working on its own the moment the
 * provider is enabled, with no deploy.
 */

let cached: Promise<Set<string>> | null = null;

export function fetchEnabledProviders(): Promise<Set<string>> {
  if (cached) return cached;
  cached = (async () => {
    if (!isSupabaseConfigured()) return new Set<string>();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return new Set<string>();
    try {
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
      if (!res.ok) return new Set<string>();
      const data = (await res.json()) as { external?: Record<string, boolean> };
      return new Set(Object.entries(data.external ?? {}).filter(([, on]) => on).map(([name]) => name));
    } catch {
      // A network failure should not hide email sign-in, so fail closed on
      // the third-party buttons only.
      return new Set<string>();
    }
  })();
  return cached;
}
