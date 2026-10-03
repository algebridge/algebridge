"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { GroupThread } from "@/components/GroupThread";
import { ReportButton } from "@/components/ReportButton";
import { getGroup } from "@/lib/groups";
import { createClient } from "@/lib/supabase/client";
import type { GroupInfo } from "@/types";
import { Icon } from "@/components/Icon";

/**
 * One group chat. A student can report the group as a whole, report any
 * message in it, and leave an AlgeGroup. Leaving is allowed by the database
 * once supabase/schema-2026-10-03-safety.sql has run; before that the
 * delete removes nothing, and the page says so instead of pretending.
 */
export default function GroupPage() {
  const params = useParams();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : (params.groupId as string);
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [leaving, setLeaving] = useState<"idle" | "asking" | "busy" | "not-yet">("idle");
  const isStudent = !profile || (profile.role === "student" && !profile.isAdmin);

  async function leave() {
    const supabase = createClient();
    if (!supabase || !user) return;
    setLeaving("busy");
    const { data, error } = await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .select("user_id");
    if (!error && (data?.length ?? 0) > 0) {
      router.push("/groups");
      return;
    }
    setLeaving("not-yet");
  }

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
      <Link href="/groups" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <Icon name="arrow-left" size={15} />
        All groups
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bridge-100 text-bridge-700" aria-hidden>
          <Icon name={group?.kind === "all_tutors" ? "tutors" : "groups"} size={19} />
        </div>
        <h1 className="min-w-0 flex-1 truncate font-display text-xl tracking-wide text-slate-900">
          {loadingGroup ? "…" : group?.name ?? "Group"}
        </h1>
        {!loadingGroup && group && (
          <div className="flex items-center gap-0.5">
            <ReportButton target={{ userId: null, name: group.name, place: "group", placeId: groupId }} />
            {group.kind === "algegroup" && isStudent && (
              <button type="button" onClick={() => setLeaving("asking")} className="btn-ghost btn-sm">
                <Icon name="arrow-left" size={15} />
                Leave
              </button>
            )}
          </div>
        )}
      </div>
      {(leaving === "asking" || leaving === "busy") && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <span className="min-w-0 flex-1">Leave {group?.name ?? "this group"}? You will stop seeing its messages. Your tutor can add you again.</span>
          <button type="button" onClick={() => setLeaving("idle")} className="btn-ghost btn-sm">
            Stay
          </button>
          <button type="button" disabled={leaving === "busy"} onClick={() => void leave()} className="btn-secondary btn-sm">
            {leaving === "busy" ? "Leaving..." : "Leave group"}
          </button>
        </div>
      )}
      {leaving === "not-yet" && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Leaving a group is not switched on yet. Ask your tutor to take you out, or report the group and an admin will.
        </p>
      )}
      <GroupThread groupId={groupId} />
    </div>
  );
}
