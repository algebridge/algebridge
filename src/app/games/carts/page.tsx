"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlgeCarts } from "@/components/games/AlgeCarts";
import { useAuth } from "@/lib/auth";
import { firstNameOf, isCartsTester } from "@/lib/algecarts/testers";

/**
 * /games/carts: the kart arena, as a demo for a few testers. Anyone else
 * gets a short note and the way back. A local-only deployment, with no
 * accounts to check, opens it for whoever is there.
 */
export default function CartsPage() {
  const { user, profile, loading, configured } = useAuth();
  const router = useRouter();

  if (configured && loading) return null;

  if (configured && !user) {
    return (
      <Note title="Sign in to open Alge Carts">
        <Link href="/login" className="font-semibold text-indigo-700 underline">
          Sign in
        </Link>{" "}
        and come back here.
      </Note>
    );
  }

  const allowed = !configured || isCartsTester(profile?.displayName);
  if (!allowed) {
    return (
      <Note title="Alge Carts is a demo for a few testers right now">
        It opens for everyone once it is ready.{" "}
        <Link href="/games" className="font-semibold text-indigo-700 underline">
          Back to the games
        </Link>
        .
      </Note>
    );
  }

  const name = firstNameOf(profile?.displayName) || "You";
  return <AlgeCarts userId={user?.id ?? "local"} name={name} onExit={() => router.push("/games")} />;
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{children}</p>
    </div>
  );
}
