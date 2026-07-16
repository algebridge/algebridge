"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { getInbox, subscribeToIncomingMessages } from "@/lib/social";
import type { ConversationSummary } from "@/types";

export default function MessagesPage() {
  const { user, profile, loading } = useAuth();
  const [convos, setConvos] = useState<ConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  async function refresh() {
    const list = await getInbox();
    setConvos(list);
    setLoadingList(false);
  }

  useEffect(() => {
    if (!user) return;
    refresh();
    const unsub = subscribeToIncomingMessages(user.id, () => refresh());
    return unsub;
  }, [user]);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl text-slate-900">Messages</h1>
        <p className="text-slate-600">Sign in to message tutors and classmates.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  const isTutor = profile?.role === "tutor";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-wide text-slate-900">Messages</h1>
        <Link href={isTutor ? "/tutor-hub" : "/tutors"} className="btn-secondary text-sm">
          {isTutor ? "👩‍🏫 All students" : "🔎 Find a tutor"}
        </Link>
      </div>

      {loadingList ? (
        <p className="text-center text-slate-400">Loading conversations…</p>
      ) : convos.length === 0 ? (
        <div className="card text-center">
          <p className="text-slate-600">No conversations yet.</p>
          <Link
            href={isTutor ? "/tutor-hub" : "/tutors"}
            className="btn-primary mt-4 inline-block"
          >
            {isTutor ? "Message a student" : "Message a tutor"}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {convos.map((c) => (
            <li key={c.otherId}>
              <Link
                href={`/messages/${c.otherId}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <Avatar name={c.otherName} url={c.otherAvatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{c.otherName}</p>
                    {c.otherRole === "tutor" && (
                      <span className="rounded-full bg-bridge-100 px-2 py-0.5 text-[10px] font-semibold text-bridge-700">
                        Tutor
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-500">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-bridge-600 px-1.5 text-xs font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
