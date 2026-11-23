"use client";

import { useRef, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { isArcadeTester } from "@/lib/arcade/testers";

/**
 * The arcade is open to its testers only (lib/arcade/testers.ts). A
 * local-only deployment, with no accounts to check, opens it for whoever is
 * there. Everyone else gets `fallback`.
 *
 * Once a signed-in account is let in, it stays in for as long as the page is
 * open and the same account is signed in. Supabase re-checks the session every
 * time the tab comes back into view and every hour, and the profile is
 * fetched again each time; a slow or failed fetch would briefly look like
 * "not a tester", which unmounted the game and restarted it mid-play.
 */
export function ArcadeGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { user, profile, loading, configured } = useAuth();
  const allowedFor = useRef<string | null>(null);
  if (!configured) return <>{children}</>;
  if (user && isArcadeTester(profile?.displayName)) allowedFor.current = user.id;
  if (user && allowedFor.current === user.id) return <>{children}</>;
  if (loading || (user && !profile)) return null;
  return <>{fallback}</>;
}
