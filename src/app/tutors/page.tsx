"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { listTutors } from "@/lib/social";
import type { TutorDirectoryEntry } from "@/types";

export default function TutorsPage() {
  const { user, loading } = useAuth();
  const [tutors, setTutors] = useState<TutorDirectoryEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setTutors(await listTutors());
      setLoadingList(false);
    })();
  }, []);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  const filtered = tutors.filter((t) =>
    (t.displayName ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (t.bio ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-wide text-slate-900">Find a Tutor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stuck on something? Message any tutor for help, or jump on a video call.
        </p>
      </div>

      {!user && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <Link href="/login" className="font-semibold underline">Sign in</Link> to message a
          tutor or start a call.
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tutors…"
        aria-label="Search tutors"
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
      />

      {loadingList ? (
        <p className="text-center text-slate-400">Loading tutors…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-slate-600">
          {tutors.length === 0
            ? "No tutors have signed up yet. Check back soon!"
            : "No tutors match your search."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((t) => (
            <div key={t.id} className="card flex flex-col">
              <div className="flex items-center gap-3">
                <Avatar name={t.displayName} url={t.avatarUrl} size={56} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {t.displayName ?? "Tutor"}
                  </p>
                  <span className="rounded-full bg-bridge-100 px-2 py-0.5 text-[10px] font-semibold text-bridge-700">
                    👩‍🏫 Tutor
                  </span>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-600">
                {t.bio || "This tutor hasn't written a bio yet."}
              </p>
              {user && (
                <div className="mt-4">
                  <Link href={`/messages/${t.id}`} className="btn-primary block w-full text-center text-sm">
                    💬 Message
                  </Link>
                  <p className="mt-2 text-center text-xs text-slate-400">
                    Message to ask for help — your tutor can start a video call with you.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
