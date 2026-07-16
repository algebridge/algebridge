"use client";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  ConversationSummary,
  DirectMessage,
  StudentDirectoryEntry,
  TutorDirectoryEntry,
  UserRole,
} from "@/types";

export function socialConfigured(): boolean {
  return isSupabaseConfigured();
}

// Every realtime subscription must use a UNIQUE channel topic. supabase-js
// returns the SAME channel instance for a repeated topic, and calling .on()
// on an already-subscribed channel throws — which crashed the messages screen
// because the Header and the open thread both subscribed to incoming messages.
let channelSeq = 0;

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Profile: bio + avatar upload
// ---------------------------------------------------------------------------

export async function updateMyProfile(fields: {
  displayName?: string;
  bio?: string;
}): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { error: "Cloud accounts are not configured." };
  const uid = await currentUserId();
  if (!uid) return { error: "You must be signed in." };
  const patch: Record<string, string> = {};
  if (fields.displayName !== undefined) patch.display_name = fields.displayName;
  if (fields.bio !== undefined) patch.bio = fields.bio;
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: uid, ...patch }, { onConflict: "id" });
  return { error: error?.message ?? null };
}

/** Uploads an avatar to the public `avatars` bucket and saves its URL. */
export async function uploadAvatar(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { url: null, error: "Cloud accounts are not configured." };
  const uid = await currentUserId();
  if (!uid) return { url: null, error: "You must be signed in." };
  if (!file.type.startsWith("image/")) {
    return { url: null, error: "Please choose an image file." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: "Image must be under 5 MB." };
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  // Stored under the user's own folder so the storage RLS policy allows it.
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (upErr) return { url: null, error: upErr.message };
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl;
  const { error: profErr } = await supabase
    .from("profiles")
    .upsert({ id: uid, avatar_url: url }, { onConflict: "id" });
  if (profErr) return { url: null, error: profErr.message };
  return { url, error: null };
}

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------

/** Every tutor — visible to any signed-in user (students browse tutors). */
export async function listTutors(): Promise<TutorDirectoryEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, bio")
    .eq("role", "tutor")
    .order("display_name", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url ?? null,
    bio: r.bio ?? null,
  }));
}

/** Every student — only readable by tutor accounts (RLS enforced). */
export async function listAllStudents(): Promise<StudentDirectoryEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url")
    .eq("role", "student")
    .order("display_name", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email,
    avatarUrl: r.avatar_url ?? null,
  }));
}

export interface PublicProfile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url ?? null,
    role: (data.role as UserRole) ?? "student",
  };
}

// ---------------------------------------------------------------------------
// Direct messaging
// ---------------------------------------------------------------------------

function rowToMessage(r: {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}): DirectMessage {
  return {
    id: r.id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

export async function sendMessage(
  recipientId: string,
  body: string
): Promise<{ message: DirectMessage | null; error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { message: null, error: "Cloud accounts are not configured." };
  const uid = await currentUserId();
  if (!uid) return { message: null, error: "You must be signed in." };
  const trimmed = body.trim();
  if (!trimmed) return { message: null, error: "Message is empty." };
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: uid, recipient_id: recipientId, body: trimmed.slice(0, 4000) })
    .select("id, sender_id, recipient_id, body, created_at, read_at")
    .single();
  if (error || !data) return { message: null, error: error?.message ?? "Send failed." };
  return { message: rowToMessage(data), error: null };
}

/** All messages between me and `otherId`, oldest first. */
export async function getMessagesWith(otherId: string): Promise<DirectMessage[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const uid = await currentUserId();
  if (!uid) return [];
  const { data } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, created_at, read_at")
    .or(
      `and(sender_id.eq.${uid},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${uid})`
    )
    .order("created_at", { ascending: true })
    .limit(500);
  return (data ?? []).map(rowToMessage);
}

/** Marks every message from `otherId` to me as read. */
export async function markConversationRead(otherId: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  const uid = await currentUserId();
  if (!uid) return;
  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", uid)
    .eq("sender_id", otherId)
    .is("read_at", null);
}

/** Groups my messages into one row per conversation partner. */
export async function getInbox(): Promise<ConversationSummary[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const uid = await currentUserId();
  if (!uid) return [];
  const { data } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, created_at, read_at")
    .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = data ?? [];

  const byOther = new Map<
    string,
    { lastMessage: string; lastAt: string; unread: number }
  >();
  for (const r of rows) {
    const otherId = r.sender_id === uid ? r.recipient_id : r.sender_id;
    const existing = byOther.get(otherId);
    const isUnread = r.recipient_id === uid && !r.read_at;
    if (!existing) {
      byOther.set(otherId, {
        lastMessage: r.body,
        lastAt: r.created_at,
        unread: isUnread ? 1 : 0,
      });
    } else if (isUnread) {
      existing.unread += 1;
    }
  }
  const otherIds = [...byOther.keys()];
  if (otherIds.length === 0) return [];

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .in("id", otherIds);
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

  return otherIds
    .map((otherId) => {
      const conv = byOther.get(otherId)!;
      const p = profMap.get(otherId);
      return {
        otherId,
        otherName: p?.display_name ?? "AlgeBridge user",
        otherAvatarUrl: p?.avatar_url ?? null,
        otherRole: (p?.role as UserRole) ?? "student",
        lastMessage: conv.lastMessage,
        lastAt: conv.lastAt,
        unread: conv.unread,
      } as ConversationSummary;
    })
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

/** Total unread messages addressed to me (for the nav badge). */
export async function getUnreadCount(): Promise<number> {
  const supabase = createClient();
  if (!supabase) return 0;
  const uid = await currentUserId();
  if (!uid) return 0;
  const { count } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", uid)
    .is("read_at", null);
  return count ?? 0;
}

/**
 * Subscribes to messages sent TO me in realtime. Returns an unsubscribe fn.
 * `onMessage` fires for every new incoming message row.
 */
export function subscribeToIncomingMessages(
  myId: string,
  onMessage: (msg: DirectMessage) => void
): () => void {
  const supabase = createClient();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`dm-inbox-${myId}-${++channelSeq}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `recipient_id=eq.${myId}`,
      },
      (payload) => onMessage(rowToMessage(payload.new as Parameters<typeof rowToMessage>[0]))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Notebook (one private notebook per user)
// ---------------------------------------------------------------------------

export async function loadNotebook(): Promise<string> {
  const supabase = createClient();
  if (!supabase) return "";
  const uid = await currentUserId();
  if (!uid) return "";
  const { data } = await supabase
    .from("notebooks")
    .select("content")
    .eq("user_id", uid)
    .maybeSingle();
  return data?.content ?? "";
}

export async function saveNotebook(content: string): Promise<{ error: string | null }> {
  const supabase = createClient();
  if (!supabase) return { error: "Cloud accounts are not configured." };
  const uid = await currentUserId();
  if (!uid) return { error: "You must be signed in." };
  const { error } = await supabase
    .from("notebooks")
    .upsert(
      { user_id: uid, content, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Call sessions
// ---------------------------------------------------------------------------

export async function startCallSession(
  roomId: string,
  studentId: string,
  tutorId: string
): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("call_sessions")
    .insert({ room_id: roomId, student_id: studentId, tutor_id: tutorId })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id;
}

export async function finishCallSession(
  callSessionId: string,
  summary: string | null
): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  await supabase
    .from("call_sessions")
    .update({ ended_at: new Date().toISOString(), summary })
    .eq("id", callSessionId);
}

/** Marks a call as having paid out Bridgeys (so it only ever pays once). */
export async function markCallBridgeysAwarded(callSessionId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("call_sessions")
    .update({ bridgeys_awarded: true })
    .eq("id", callSessionId)
    .eq("bridgeys_awarded", false)
    .select("id");
  // Returns a row only if THIS update flipped the flag — prevents double pay.
  return !error && !!data && data.length > 0;
}

// ---------------------------------------------------------------------------
// Roles + admin
// ---------------------------------------------------------------------------

/** Claim a role. Teacher/tutor require a valid access code (checked server-side). */
export async function claimRole(role: UserRole, code?: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.rpc("claim_role", {
    target_role: role,
    code: code ?? null,
  });
  return error?.message ?? null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  avatarUrl: string | null;
}

/** Admin-only: every user (RLS allows only admins to read all profiles). */
export async function adminListUsers(): Promise<AdminUser[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, avatar_url")
    .order("role", { ascending: true })
    .order("display_name", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    role: (r.role as UserRole) ?? "student",
    avatarUrl: r.avatar_url ?? null,
  }));
}

/** Admin-only (or self): delete an account (RPC enforces the check). */
export async function adminDeleteUser(userId: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.rpc("delete_user", { target: userId });
  return error?.message ?? null;
}

// ---------------------------------------------------------------------------
// Incoming-call ringing (realtime broadcast per user)
// ---------------------------------------------------------------------------

export interface RingPayload {
  roomId: string;
  callerId: string;
  callerName: string;
}

function dropStaleChannel(topic: string) {
  const supabase = createClient();
  if (!supabase) return;
  supabase
    .getChannels()
    .filter((c) => c.topic === `realtime:${topic}`)
    .forEach((c) => supabase.removeChannel(c));
}

/** Ring a specific user (broadcast to their personal ring channel). */
export function ringUser(targetId: string, payload: RingPayload): void {
  const supabase = createClient();
  if (!supabase) return;
  const topic = `ring-${targetId}`;
  dropStaleChannel(topic);
  const ch = supabase.channel(topic);
  ch.subscribe((st) => {
    if (st === "SUBSCRIBED") {
      ch.send({ type: "broadcast", event: "ring", payload });
      setTimeout(() => supabase.removeChannel(ch), 2000);
    }
  });
}

/** Tell the caller their call was declined. */
export function sendCallDecline(callerId: string, byName: string): void {
  const supabase = createClient();
  if (!supabase) return;
  const topic = `ring-${callerId}`;
  dropStaleChannel(topic);
  const ch = supabase.channel(topic);
  ch.subscribe((st) => {
    if (st === "SUBSCRIBED") {
      ch.send({ type: "broadcast", event: "decline", payload: { byName } });
      setTimeout(() => supabase.removeChannel(ch), 2000);
    }
  });
}

/** Subscribe to incoming rings addressed to me. Returns unsubscribe. */
export function subscribeToRing(
  myId: string,
  onRing: (p: RingPayload) => void,
  onDecline: (byName: string) => void
): () => void {
  const supabase = createClient();
  if (!supabase) return () => {};
  const topic = `ring-${myId}`;
  dropStaleChannel(topic);
  const channel = supabase
    .channel(topic)
    .on("broadcast", { event: "ring" }, ({ payload }) => onRing(payload as RingPayload))
    .on("broadcast", { event: "decline" }, ({ payload }) =>
      onDecline((payload as { byName?: string }).byName ?? "They")
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
