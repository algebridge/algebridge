"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { MessageThread } from "@/components/MessageThread";
import { getPublicProfile, type PublicProfile } from "@/lib/social";
import { roomIdFor } from "@/lib/call-utils";

export default function ConversationPage() {
  const params = useParams();
  const otherId = Array.isArray(params.otherId) ? params.otherId[0] : (params.otherId as string);
  const { user, profile, loading } = useAuth();
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [loadingOther, setLoadingOther] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingOther(true);
      const p = await getPublicProfile(otherId);
      if (active) {
        setOther(p);
        setLoadingOther(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [otherId]);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-slate-600">Sign in to message.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  // A student↔tutor pair can start a video call. Both sides compute the same
  // deterministic room id from their two user ids so they land together.
  const myRole = profile?.role ?? "student";
  const otherRole = other?.role ?? "student";
  const isTutorPair =
    (myRole === "tutor" && otherRole === "student") ||
    (myRole !== "tutor" && otherRole === "tutor");
  const callHref = isTutorPair
    ? `/room/${roomIdFor(user.id, otherId)}?with=${otherId}`
    : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link href="/messages" className="text-sm text-slate-500 hover:text-slate-700">
        ← All messages
      </Link>
      {loadingOther ? (
        <p className="text-center text-slate-400">Loading conversation…</p>
      ) : (
        <MessageThread
          otherId={otherId}
          otherName={other?.displayName ?? null}
          otherAvatarUrl={other?.avatarUrl ?? null}
          otherRole={other?.role}
          callHref={callHref}
        />
      )}
    </div>
  );
}
