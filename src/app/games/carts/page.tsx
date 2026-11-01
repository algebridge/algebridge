"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlgeCarts } from "@/components/games/AlgeCarts";
import { CartsLeaderboard } from "@/components/games/CartsLeaderboard";
import { useAuth } from "@/lib/auth";
import { isCartsTester, racerNameOf } from "@/lib/algecarts/testers";

/**
 * /games/carts: the kart arena, as a demo for a few testers, on a stage in
 * the page like the other games. Anyone else gets a short note and the way
 * back. A local-only deployment, with no accounts to check, opens it for
 * whoever is there.
 *
 * In development, `?guest=1` opens it for a signed-out tab as a guest with a
 * made-up name, so two local tabs can share a lobby. Read after mount, so the
 * server and the first client render agree.
 */
export default function CartsPage() {
  const { user, profile, loading, configured } = useAuth();
  const router = useRouter();
  const [devGuest, setDevGuest] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!new URLSearchParams(window.location.search).has("guest")) return;
    let id = "";
    try {
      id = sessionStorage.getItem("algebridge:carts:guest") ?? "";
      if (!id) {
        id = `guest-${Math.random().toString(36).slice(2, 6)}`;
        sessionStorage.setItem("algebridge:carts:guest", id);
      }
    } catch {
      id = "guest-local";
    }
    setDevGuest(id);
  }, []);

  if (configured && loading) return null;

  if (configured && !user && !devGuest) {
    return (
      <Note title="Sign in to open Alge Carts">
        <Link href="/login" className="font-semibold text-indigo-700 underline">
          Sign in
        </Link>{" "}
        and come back here.
      </Note>
    );
  }

  const allowed = !configured || !!devGuest || isCartsTester(profile?.displayName);
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

  const guest = !user && devGuest ? devGuest : null;
  const name = racerNameOf(profile?.displayName) || (guest ? `Guest ${guest.slice(-4)}` : "You");
  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">Alge Carts</h1>
        <p className="page-subtitle">
          Eight karts, one arena, three minutes. Drive into a question box and answer it to load the booster. The button at the top right of the
          track, or F, takes it full screen; Esc brings the page back. A demo for the testers.
        </p>
      </header>
      <AlgeCarts
        userId={user?.id ?? guest ?? "local"}
        name={name}
        displayName={profile?.displayName ?? name}
        onExit={() => router.push("/games")}
        onMatchEnd={() => setBoardKey((k) => k + 1)}
      />
      <CartsLeaderboard userId={user?.id ?? null} refresh={boardKey} />
    </div>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{children}</p>
    </div>
  );
}
