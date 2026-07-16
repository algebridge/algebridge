"use client";

import { createClient } from "@/lib/supabase/client";
import type { GroupInfo, GroupMessage } from "@/types";

let groupChannelSeq = 0;

async function myId(): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Every group I'm a member of (the All-Tutors group + any AlgeGroups). */
export async function listMyGroups(): Promise<GroupInfo[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const uid = await myId();
  if (!uid) return [];
  const { data: mem } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", uid);
  const ids = (mem ?? []).map((m) => m.group_id);
  if (ids.length === 0) return [];
  const { data: gs } = await supabase
    .from("groups")
    .select("id, name, kind, created_by")
    .in("id", ids);
  // Member counts (one extra query over the member rows for these groups).
  const { data: members } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", ids);
  const counts = new Map<string, number>();
  for (const m of members ?? []) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  return (gs ?? [])
    .map((g) => ({
      id: g.id,
      name: g.name,
      kind: g.kind as GroupInfo["kind"],
      createdBy: g.created_by ?? null,
      memberCount: counts.get(g.id) ?? 1,
    }))
    .sort((a, b) => (a.kind === "all_tutors" ? -1 : b.kind === "all_tutors" ? 1 : 0));
}

export async function getGroup(groupId: string): Promise<GroupInfo | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("groups")
    .select("id, name, kind, created_by")
    .eq("id", groupId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    kind: data.kind as GroupInfo["kind"],
    createdBy: data.created_by ?? null,
  };
}

export async function getGroupMessages(groupId: string): Promise<GroupMessage[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("group_messages")
    .select("id, group_id, sender_id, body, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = data ?? [];
  // Resolve sender names.
  const senderIds = [...new Set(rows.map((r) => r.sender_id))];
  const names = new Map<string, string | null>();
  if (senderIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", senderIds);
    for (const p of profs ?? []) names.set(p.id, p.display_name);
  }
  return rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    senderId: r.sender_id,
    senderName: names.get(r.sender_id) ?? "Member",
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function sendGroupMessage(
  groupId: string,
  body: string
): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { error: "Cloud accounts are not configured." };
  const uid = await myId();
  if (!uid) return { error: "You must be signed in." };
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message is empty." };
  const { error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: uid, body: trimmed.slice(0, 4000) });
  return { error: error?.message ?? null };
}

/** Realtime: new messages in a group. Unique topic per subscription. */
export function subscribeToGroup(
  groupId: string,
  onMessage: (m: GroupMessage) => void
): () => void {
  const supabase = createClient();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`group-${groupId}-${++groupChannelSeq}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
      (payload) => {
        const r = payload.new as {
          id: string;
          group_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        onMessage({
          id: r.id,
          groupId: r.group_id,
          senderId: r.sender_id,
          body: r.body,
          createdAt: r.created_at,
        });
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Tutor creates an AlgeGroup with the chosen students. Returns the group id. */
export async function createAlgeGroup(
  name: string,
  studentIds: string[]
): Promise<{ id: string | null; error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { id: null, error: "Cloud accounts are not configured." };
  const { data, error } = await supabase.rpc("create_algegroup", {
    group_name: name,
    student_ids: studentIds,
  });
  if (error) return { id: null, error: error.message };
  return { id: (data as string) ?? null, error: null };
}
