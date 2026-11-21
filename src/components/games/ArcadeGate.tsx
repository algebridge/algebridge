"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { isArcadeTester } from "@/lib/arcade/testers";

/**
 * The arcade is open to its testers only (lib/arcade/testers.ts). A
 * local-only deployment, with no accounts to check, opens it for whoever is
 * there. Everyone else gets `fallback`.
 */
export function ArcadeGate({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { profile, loading, configured } = useAuth();
  if (!configured) return <>{children}</>;
  if (loading) return null;
  return <>{isArcadeTester(profile?.displayName) ? children : fallback}</>;
}
