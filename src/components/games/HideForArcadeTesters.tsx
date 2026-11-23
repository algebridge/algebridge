"use client";

import { useRef, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { isArcadeTester } from "@/lib/arcade/testers";

/** True for a signed-in arcade tester (lib/arcade/testers.ts). Never on a local-only deployment. */
export function useArcadeTester(): boolean {
  const { user, profile, configured } = useAuth();
  // Same latch as ArcadeGate: a profile re-fetch on tab focus must not flip the page back and forth.
  const allowedFor = useRef<string | null>(null);
  if (!configured || !user) return false;
  if (isArcadeTester(profile?.displayName)) allowedFor.current = user.id;
  return allowedFor.current === user.id;
}

/**
 * Arcade testers get the arcade board in place of Alge Carts and the Live
 * Arena, so the ways into those two are hidden for them. Everyone else sees
 * `children` as before.
 */
export function HideForArcadeTesters({ children }: { children: ReactNode }) {
  return useArcadeTester() ? null : <>{children}</>;
}
