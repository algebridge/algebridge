"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { hasAlgebra2Access } from "@/lib/early-access";

/**
 * Shows Algebra 2 only to the accounts in src/lib/early-access.ts. Anyone
 * else sees the same "not found" as a page that does not exist, so the
 * section stays out of sight rather than visibly locked.
 */
export function Algebra2Gate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [state, setState] = useState<"checking" | "open" | "closed">("checking");
  const email = user?.email ?? null;

  useEffect(() => {
    if (loading) return;
    let live = true;
    hasAlgebra2Access(email).then((ok) => live && setState(ok ? "open" : "closed"));
    return () => {
      live = false;
    };
  }, [email, loading]);

  if (state === "open") return <>{children}</>;
  if (state === "checking") {
    return <div aria-busy="true" className="mx-auto mt-24 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />;
  }
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <h1 className="text-2xl font-semibold text-slate-900">404</h1>
      <p className="mt-2 text-sm text-slate-600">This page could not be found.</p>
    </div>
  );
}
