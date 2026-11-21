"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { isArcadeTester } from "@/lib/arcade/testers";

/** True for a signed-in arcade tester (lib/arcade/testers.ts). Never on a local-only deployment. */
export function useArcadeTester(): boolean {
  const { profile, configured } = useAuth();
  return configured && isArcadeTester(profile?.displayName);
}

/**
 * Arcade testers get the arcade board in place of Alge Carts and the Live
 * Arena, so the ways into those two are hidden for them. Everyone else sees
 * `children` as before.
 */
export function HideForArcadeTesters({ children }: { children: ReactNode }) {
  return useArcadeTester() ? null : <>{children}</>;
}
