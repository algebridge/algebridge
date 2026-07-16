"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { listAllStudents } from "@/lib/social";
import { roomIdFor } from "@/lib/call-utils";
import type { StudentDirectoryEntry } from "@/types";

export default function TutorHubPage() {
  const { user, profile, loading } = useAuth();
  const [students, setStudents] = useState<StudentDirectoryEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");

  const isTutor = profile?.role === "tutor";

  useEffect(() => {
    if (!isTutor) return;
    (async () => {
      setStudents(await listAllStudents());
      setLoadingList(false);
    })();
  }, [isTutor]);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl text-slate-900">Tutor Hub</h1>
        <p className="text-slate-600">Sign in with a tutor account to see your students.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  if (!isTutor) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl text-slate-900">Tutor Hub</h1>
        <p className="text-slate-600">
          This area is for tutors. Switch your account to a tutor account from your
          profile to see the student directory.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/login" className="btn-secondary">Account settings</Link>
          <Link href="/tutors" className="btn-primary">Find a tutor instead</Link>
        </div>
      </div>
    );
  }

  const filtered = students.filter(
    (s) =>
      (s.displayName ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (s.email ?? "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-slate-900">Tutor Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every student on AlgeBridge — message or call anyone who needs help.
          </p>
        </div>
        <Link href="/messages" className="btn-secondary text-sm">💬 Inbox</Link>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search students by name or email…"
        aria-label="Search students"
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
      />

      {loadingList ? (
        <p className="text-center text-slate-400">Loading students…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-slate-600">
          {students.length === 0
            ? "No students have signed up yet."
            : "No students match your search."}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400">{filtered.length} student{filtered.length === 1 ? "" : "s"}</p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {filtered.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={s.displayName} url={s.avatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {s.displayName ?? "Student"}
                  </p>
                  <p className="truncate text-xs text-slate-400">{s.email}</p>
                </div>
                <Link href={`/messages/${s.id}`} className="btn-secondary text-sm">
                  💬
                </Link>
                <Link
                  href={`/room/${roomIdFor(user.id, s.id)}?with=${s.id}`}
                  className="btn-secondary text-sm"
                >
                  🎥
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
