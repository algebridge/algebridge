"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { GroupThread } from "@/components/GroupThread";
import { getGroup } from "@/lib/groups";
import type { GroupInfo } from "@/types";

export default function GroupPage() {
  const params = useParams();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : (params.groupId as string);
  const { user, loading } = useAuth();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const g = await getGroup(groupId);
      if (active) {
        setGroup(g);
        setLoadingGroup(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [groupId]);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-slate-600">Sign in to open this group.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link href="/groups" className="text-sm text-slate-500 hover:text-slate-700">
        ← All groups
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bridge-100 text-lg">
          {group?.kind === "all_tutors" ? "🧑‍🏫" : "👥"}
        </div>
        <h1 className="font-display text-xl tracking-wide text-slate-900">
          {loadingGroup ? "…" : group?.name ?? "Group"}
        </h1>
      </div>
      <GroupThread groupId={groupId} />
    </div>
  );
}
