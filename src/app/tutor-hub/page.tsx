"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { NotificationsCard } from "@/components/NotificationsCard";
import { listAllStudents, listTutors, ringUser } from "@/lib/social";
import { MAX_CALL_MEMBERS, roomIdFor } from "@/lib/call-utils";
import type { StudentDirectoryEntry, TutorDirectoryEntry } from "@/types";
import { Icon } from "@/components/Icon";

type Who = "students" | "tutors";

export default function TutorHubPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentDirectoryEntry[]>([]);
  const [tutors, setTutors] = useState<TutorDirectoryEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<Who>("students");
  /** People picked for a group call, by id, with their names for the bar. */
  const [picked, setPicked] = useState<Map<string, string>>(new Map());

  const isTutor = profile?.role === "tutor" || (profile?.isAdmin ?? false);
  const myName = profile?.displayName || user?.email?.split("@")[0] || "Tutor";
  const roomFull = picked.size >= MAX_CALL_MEMBERS - 1;

  /** Rings everyone in the call and opens the room. */
  function call(ids: string[]) {
    if (!user || !ids.length) return;
    const roomId = roomIdFor(user.id, ...ids);
    for (const id of ids) ringUser(id, { roomId, callerId: user.id, callerName: myName });
    router.push(`/room/${roomId}`);
  }

  function togglePick(id: string, name: string) {
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_CALL_MEMBERS - 1) next.set(id, name);
      return next;
    });
  }

  useEffect(() => {
    if (!isTutor) return;
    (async () => {
      const [s, t] = await Promise.all([listAllStudents(), listTutors()]);
      setStudents(s);
      setTutors(t.filter((x) => x.id !== user?.id));
      setLoadingList(false);
    })();
  }, [isTutor, user?.id]);

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const list = who === "students" ? students.map((s) => ({ id: s.id, name: s.displayName ?? "Student", sub: s.email ?? "", avatar: s.avatarUrl })) : tutors.map((t) => ({ id: t.id, name: t.displayName ?? "Tutor", sub: t.bio ?? "", avatar: t.avatarUrl }));
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q));
  }, [who, students, tutors, query]);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Tutor Hub</h1>
        <p className="text-slate-600">Sign in with a tutor account to see your students.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  if (!isTutor) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Tutor Hub</h1>
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tutor Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Message or call any student. Tick a few people for a group call: students, tutors, or both.
          </p>
        </div>
        <Link href="/messages" className="btn-secondary text-sm">
          <Icon name="messages" size={16} />
          Inbox
        </Link>
      </div>

      <NotificationsCard who="a student" />

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Who to show" className="inline-flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ["students", `Students (${students.length})`],
              ["tutors", `Tutors (${tutors.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={who === id}
              onClick={() => setWho(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${who === id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${who} by name${who === "students" ? " or email" : ""}…`}
          aria-label={`Search ${who}`}
          className="min-w-[12rem] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
        />
      </div>

      {loadingList ? (
        <p className="text-center text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card text-center text-slate-600">
          {(who === "students" ? students : tutors).length === 0 ? `No ${who} here yet.` : `No ${who} match your search.`}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {rows.map((r) => {
            const on = picked.has(r.id);
            return (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${on ? "bg-bridge-50/60" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && roomFull}
                  onChange={() => togglePick(r.id, r.name)}
                  aria-label={`Add ${r.name} to a group call`}
                  className="h-4 w-4 shrink-0 accent-bridge-600"
                />
                <Avatar name={r.name} url={r.avatar} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{r.name}</p>
                  {r.sub && <p className="truncate text-xs text-slate-500">{r.sub}</p>}
                </div>
                <Link href={`/messages/${r.id}`} className="btn-secondary text-sm" title="Message" aria-label={`Message ${r.name}`}>
                  <Icon name="messages" size={17} />
                </Link>
                <button type="button" onClick={() => call([r.id])} className="btn-secondary text-sm" title="Start a video call" aria-label={`Start a video call with ${r.name}`}>
                  <Icon name="video" size={17} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* The group call being put together. */}
      {picked.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
            <p className="min-w-0 flex-1 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">
                {picked.size + 1} in the call:
              </span>{" "}
              you, {[...picked.values()].join(", ")}
              {roomFull && <span className="block text-xs text-slate-500">That is the most for one call ({MAX_CALL_MEMBERS}).</span>}
            </p>
            <button type="button" onClick={() => setPicked(new Map())} className="btn-ghost btn-sm">
              Clear
            </button>
            <button type="button" onClick={() => call([...picked.keys()])} className="btn-primary btn-sm">
              <Icon name="video" size={15} />
              {picked.size === 1 ? "Call" : "Start group call"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
