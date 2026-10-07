"use client";

import { sendPush } from "@/lib/push";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { guardFreeText, isBlocked, readBlocked, sendErrorText } from "@/lib/safety";
import { schoolModeNow } from "@/lib/school-mode";
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
// on an already-subscribed channel throws, which crashed the messages screen
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
  if (fields.bio !== undefined) {
    // A bio is shown to students on a tutor's card, so it gets the same guard
    // as a student's message. The database refuses one too, once
    // supabase/schema-2026-10-03-safety.sql has run (guard_profile_bio).
    const refused = guardFreeText(fields.bio, "bio");
    if (refused) return { error: refused };
    patch.bio = fields.bio;
  }
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: uid, ...patch }, { onConflict: "id" });
  if (error && /contact details|22023/.test(`${error.message} ${error.code ?? ""}`)) {
    return { error: "Not saved: your bio looks like it has contact details. Bios are shown to students, so keep phone numbers, emails and other apps out of it." };
  }
  return { error: plainDbError(error, "Your profile could not be saved. Sign out and back in, then try again.") };
}

/**
 * Is this account managed by a school (it joined a teacher's class)? Read
 * from profiles.managed, which supabase/schema-2026-10-03-safety.sql adds.
 * False before that migration runs, or when nothing can be read.
 */
export async function loadManagedFlag(userId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase || !userId) return false;
  try {
    const { data, error } = await supabase.from("profiles").select("managed").eq("id", userId).maybeSingle();
    if (error || !data) return false;
    return (data as { managed?: unknown }).managed === true;
  } catch {
    return false;
  }
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
  if (upErr) return { url: null, error: plainDbError(upErr, "That photo could not be saved. Try another image.") };
  // The stored link is the photo's public address, which is what the
  // database keeps. What the page shows is a signed link, which still opens
  // once the bucket is private.
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl;
  const { error: profErr } = await supabase
    .from("profiles")
    .upsert({ id: uid, avatar_url: url }, { onConflict: "id" });
  if (profErr) return { url: null, error: plainDbError(profErr, "That photo could not be saved. Try again in a moment.") };
  const [shown] = await signAvatarUrls([url]);
  return { url: shown ?? url, error: null };
}

// ---------------------------------------------------------------------------
// Profile photos
// ---------------------------------------------------------------------------

const PUBLIC_AVATAR = "/storage/v1/object/public/avatars/";
const SIGNED_AVATAR = "/storage/v1/object/sign/avatars/";

/**
 * The file path inside the avatars bucket of a stored photo link, public or
 * signed, or null for anything else (no link, or a photo from somewhere else).
 */
export function avatarPathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const marker of [PUBLIC_AVATAR, SIGNED_AVATAR]) {
    const at = url.indexOf(marker);
    if (at >= 0) {
      try {
        return decodeURIComponent(url.slice(at + marker.length).split("?")[0]) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Photos as short-lived signed links. supabase/schema-2026-10-03-safety.sql
 * makes the avatars bucket private, after which a stored public link no
 * longer opens; a signed link does, for someone the storage policy lets see
 * that photo. Signing works the same on today's public bucket, so this is
 * safe before and after the migration.
 *
 * A photo the storage policy refuses to sign (or that is gone) comes back
 * null, and the Avatar shows initials. When signing fails as a whole (no
 * network, storage down), the stored link is handed back unchanged: it
 * still opens while the bucket is public, and once it is private the
 * Avatar falls back to initials when the image does not load.
 */
export async function signAvatarUrls(urls: (string | null | undefined)[]): Promise<(string | null)[]> {
  const supabase = createClient();
  const paths = urls.map((u) => avatarPathOf(u));
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  const unchanged = () => urls.map((u) => u ?? null);
  if (!supabase || wanted.length === 0) return unchanged();
  try {
    const { data, error } = await supabase.storage.from("avatars").createSignedUrls(wanted, 60 * 60);
    if (error || !data) return unchanged();
    const signed = new Map(data.filter((d) => d.signedUrl && !d.error && d.path).map((d) => [d.path as string, d.signedUrl]));
    return urls.map((u, i) => (paths[i] ? (signed.get(paths[i]!) ?? null) : (u ?? null)));
  } catch {
    return unchanged();
  }
}

// ---------------------------------------------------------------------------
// Names, through whichever door the database opens
// ---------------------------------------------------------------------------

export interface PersonName {
  displayName: string | null;
  /** The stored photo link, unsigned. The Avatar signs it. */
  avatarUrl: string | null;
  role: UserRole | null;
}

/**
 * Names (and photos) for a list of account ids. The profiles table first;
 * once supabase/schema-2026-10-03-safety.sql has run, a tutor can no longer
 * read a student's row and a student can no longer read a tutor's, so any id
 * still missing is looked up in student_directory, then tutor_directory
 * (names, photos and roles, never an email). Before the migration the views
 * do not exist, their errors are ignored, and the profiles read is the
 * whole answer, as it always was.
 */
export async function lookupPeople(ids: (string | null | undefined)[]): Promise<Map<string, PersonName>> {
  const found = new Map<string, PersonName>();
  const supabase = createClient();
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (!supabase || wanted.length === 0) return found;
  type Row = { id: string; display_name: string | null; avatar_url: string | null; role: string | null };
  const take = (rows: Row[] | null | undefined) => {
    for (const r of rows ?? []) {
      if (!r?.id || found.has(r.id)) continue;
      const role = r.role === "student" || r.role === "tutor" || r.role === "teacher" ? r.role : null;
      found.set(r.id, { displayName: r.display_name ?? null, avatarUrl: r.avatar_url ?? null, role });
    }
  };
  const { data } = await supabase.from("profiles").select("id, display_name, avatar_url, role").in("id", wanted);
  take(data as Row[] | null);
  for (const view of ["student_directory", "tutor_directory"] as const) {
    const missing = wanted.filter((id) => !found.has(id));
    if (missing.length === 0) break;
    const viewed = await supabase.from(view).select("id, display_name, avatar_url, role").in("id", missing);
    if (!viewed.error) take(viewed.data as Row[] | null);
  }
  return found;
}

/**
 * A database refusal in plain words. A row-level security refusal (42501)
 * reads like "new row violates row-level security policy for table ...",
 * which means nothing to a student; it becomes `refused`. A refusal the
 * database already words for people (a raised exception, such as "Students
 * now join a class themselves...") is kept as it is.
 */
export function plainDbError(
  error: { message?: string | null; code?: string | null } | null | undefined,
  refused = "AlgeBridge's safety rules do not allow that."
): string | null {
  if (!error) return null;
  const message = error.message ?? "";
  const text = `${message} ${error.code ?? ""}`;
  if (/row-level security|violates .*policy|permission denied|\bJWT\b/i.test(text)) return refused;
  if (/failed to fetch|networkerror|network request|timed? ?out|load failed/i.test(text)) {
    return "That did not go through. Check your connection and try again.";
  }
  if (/\b42501\b/.test(text) && !message.trim()) return refused;
  return message.trim() || "That did not go through. Try again in a moment.";
}

// ---------------------------------------------------------------------------
// Directories
// ---------------------------------------------------------------------------

/**
 * Every tutor, visible to any signed-in user (students browse tutors). Once
 * supabase/schema-2026-10-03-safety.sql has run, students read tutors through
 * the tutor_directory view, which has no email column; before it runs the
 * view does not exist and the tutors' profile rows are read as before.
 */
export async function listTutors(): Promise<TutorDirectoryEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const viewed = await supabase
    .from("tutor_directory")
    .select("id, display_name, avatar_url, bio")
    .eq("role", "tutor")
    .order("display_name", { ascending: true });
  let rows: { id: string; display_name: string | null; avatar_url: string | null; bio: string | null }[];
  if (!viewed.error) rows = viewed.data ?? [];
  else {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, bio")
      .eq("role", "tutor")
      .order("display_name", { ascending: true });
    rows = data ?? [];
  }
  const photos = await signAvatarUrls(rows.map((r) => r.avatar_url));
  return rows.map((r, i) => ({
    id: r.id,
    displayName: r.display_name,
    avatarUrl: photos[i],
    bio: r.bio ?? null,
  }));
}

/**
 * The students a staff account may see. Once the safety migration has run
 * this is the student_directory view: names and photos, never an email, and
 * for a tutor only the students who asked them for help or wrote to them.
 * Before it runs the view does not exist, and the old rule applies (tutors
 * read every student's row, email included).
 */
export async function listAllStudents(): Promise<StudentDirectoryEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const viewed = await supabase
    .from("student_directory")
    .select("id, display_name, avatar_url")
    .order("display_name", { ascending: true });
  let rows: { id: string; display_name: string | null; email?: string | null; avatar_url: string | null }[];
  if (!viewed.error) rows = viewed.data ?? [];
  else {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, email, avatar_url")
      .eq("role", "student")
      .order("display_name", { ascending: true });
    rows = data ?? [];
  }
  const photos = await signAvatarUrls(rows.map((r) => r.avatar_url));
  return rows.map((r, i) => ({
    id: r.id,
    displayName: r.display_name,
    email: r.email ?? null,
    avatarUrl: photos[i],
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
  let { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();
  // A tutor cannot read a student's row once the safety migration has run,
  // and a student cannot read a tutor's: the directory views give the name,
  // photo and role (never the email).
  for (const view of ["student_directory", "tutor_directory"] as const) {
    if (data) break;
    const viewed = await supabase.from(view).select("id, display_name, avatar_url, role").eq("id", userId).maybeSingle();
    if (!viewed.error) data = viewed.data;
  }
  if (!data) return null;
  const [photo] = await signAvatarUrls([data.avatar_url]);
  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: photo,
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

/**
 * Is this conversation allowed? Staff (tutor, teacher, admin) can message
 * anyone. A student can only message staff, which means a recipient whose
 * profile they are allowed to read and whose role is tutor or teacher; a
 * classmate's profile is invisible to them, so a classmate is unreachable.
 */
export async function canMessage(recipientId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const uid = await currentUserId();
  if (!uid || recipientId === uid) return false;
  const [{ data: me }, { data: admin }, { data: other }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
    supabase.rpc("is_admin"),
    supabase.from("profiles").select("role").eq("id", recipientId).maybeSingle(),
  ]);
  const staff = (role: unknown) => role === "tutor" || role === "teacher";
  if (admin === true || staff(me?.role)) return true;
  if (other) return staff(other.role);
  // After the safety migration a student reads tutors and their own teachers
  // through tutor_directory, not their profile rows.
  const viewed = await supabase.from("tutor_directory").select("role").eq("id", recipientId).maybeSingle();
  return !viewed.error && staff(viewed.data?.role);
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
  // A student may only write to staff. The database enforces the same rule
  // (schema-safety-2026-09.sql); this is the app refusing on its own as well,
  // so a message to a classmate is stopped before it is even attempted.
  if (!(await canMessage(recipientId))) {
    return { message: null, error: "Messages here go to your tutors. Ask a tutor or teacher if you need to reach someone else." };
  }
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: uid, recipient_id: recipientId, body: trimmed.slice(0, 4000) })
    .select("id, sender_id, recipient_id, body, created_at, read_at")
    .single();
  // The database's refusals are Postgres's words; the student gets plain ones.
  if (error || !data) return { message: null, error: sendErrorText(error ? `${error.message} ${error.code ?? ""}` : null) };
  // Their phone or computer gets it too, even with AlgeBridge closed.
  void sendPush({ kind: "message", messageId: data.id });
  return { message: rowToMessage(data), error: null };
}

/** All messages between me and `otherId`, oldest first. */
export async function getMessagesWith(otherId: string): Promise<DirectMessage[]> {
  const supabase = createClient();
  if (!supabase) return [];
  const uid = await currentUserId();
  if (!uid) return [];
  // Fetch the NEWEST 500 (desc) then reverse for display, so long
  // conversations show recent messages, not ancient history.
  const { data } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, created_at, read_at")
    .or(
      `and(sender_id.eq.${uid},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${uid})`
    )
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map(rowToMessage).reverse();
}

/** Fired after messages are marked read, so the nav unread badge can refresh. */
export const MESSAGES_READ_EVENT = "algebridge:messages-read";

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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
  }
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
  // Someone blocked on this device adds nothing to the unread count.
  const blocked = readBlocked(uid);
  for (const r of rows) {
    const otherId = r.sender_id === uid ? r.recipient_id : r.sender_id;
    const existing = byOther.get(otherId);
    const isUnread = r.recipient_id === uid && !r.read_at && !isBlocked(blocked, otherId);
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
  const found = [...(profs ?? [])];
  // Students a tutor can no longer read directly, from the directory view.
  const missing = otherIds.filter((id) => !found.some((p) => p.id === id));
  if (missing.length) {
    const viewed = await supabase.from("student_directory").select("id, display_name, avatar_url, role").in("id", missing);
    if (!viewed.error) found.push(...(viewed.data ?? []));
  }
  const photos = await signAvatarUrls(found.map((p) => p.avatar_url));
  const profMap = new Map(found.map((p, i) => [p.id, { ...p, avatar_url: photos[i] }]));

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

/**
 * Total unread messages addressed to me (for the nav badge). None in school
 * mode, where there are no messages, and none from someone blocked on this
 * device: the badge must not lead a student back to a person they blocked.
 */
export async function getUnreadCount(): Promise<number> {
  if (schoolModeNow()) return 0;
  const supabase = createClient();
  if (!supabase) return 0;
  const uid = await currentUserId();
  if (!uid) return 0;
  const blocked = readBlocked(uid);
  if (blocked.length === 0) {
    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", uid)
      .is("read_at", null);
    return count ?? 0;
  }
  const { data } = await supabase
    .from("direct_messages")
    .select("sender_id")
    .eq("recipient_id", uid)
    .is("read_at", null)
    .limit(500);
  return (data ?? []).filter((r) => !isBlocked(blocked, r.sender_id)).length;
}

/**
 * Subscribes to messages sent TO me in realtime. Returns an unsubscribe fn.
 * `onMessage` fires for every new incoming message row.
 */
export function subscribeToIncomingMessages(
  myId: string,
  onMessage: (msg: DirectMessage) => void
): () => void {
  // School mode has no messages, so nothing is listened for.
  if (schoolModeNow()) return () => {};
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
      (payload) => {
        const msg = rowToMessage(payload.new as Parameters<typeof rowToMessage>[0]);
        // A message from someone blocked on this device does not ring the badge
        // or open in a thread.
        if (isBlocked(readBlocked(myId), msg.senderId)) return;
        onMessage(msg);
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Blocks on the server (user_blocks)
// ---------------------------------------------------------------------------

/**
 * Records a block in the database, where supabase/schema-2026-10-03-safety.sql
 * makes the message and ring rules respect it: the blocked person can no
 * longer message or ring this account, and their messages are hidden from it
 * on every device. True only when the database kept it. Before that
 * migration runs the table does not exist, this returns false, and the block
 * lives on this device alone (src/lib/safety.ts), which is what the Block
 * button then says.
 */
export async function blockOnServer(otherId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const uid = await currentUserId();
  if (!uid || uid === otherId) return false;
  try {
    const { error } = await supabase
      .from("user_blocks")
      .upsert({ blocker_id: uid, blocked_id: otherId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

export async function unblockOnServer(otherId: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  const uid = await currentUserId();
  if (!uid) return;
  try {
    await supabase.from("user_blocks").delete().eq("blocker_id", uid).eq("blocked_id", otherId);
  } catch {
    /* no table yet: nothing to undo */
  }
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
  return { error: plainDbError(error, "Your notebook could not be saved. Sign out and back in, then try again.") };
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
  // Returns a row only if THIS update flipped the flag, prevents double pay.
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
  return plainDbError(error, "That role could not be set. Check the access code and try again.");
}

/** Joins the caller to the All-Tutors group (server checks they're a tutor/admin). */
export async function ensureAllTutorsMembership(): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  await supabase.rpc("join_all_tutors_group");
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

/** Admin-only: set another account's role (RPC enforces the admin check). */
export async function adminSetRole(userId: string, role: UserRole): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return "Cloud accounts are not configured.";
  const { error } = await supabase.rpc("set_user_role", { target: userId, new_role: role });
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

// removeChannel() is async (it round-trips an unsubscribe). If we create a
// channel on the same FIXED topic immediately after, supabase-js hands back the
// still-present, now-"leaving" channel and .subscribe() no-ops, so listeners
// bind to a dying channel. We therefore AWAIT removal before re-creating.
async function removeStaleChannels(topic: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  for (const c of supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`)) {
    await supabase.removeChannel(c);
  }
}

/**
 * May this caller ring me? A staff account: a tutor, a teacher or an
 * AlgeBridge admin. (The app gives only tutors and admins a Call button, in
 * src/app/messages/[otherId]/page.tsx; the database decides who may ring
 * whom.) An admin's own profile row may say "student" and may be unreadable
 * to the person called, so the database's profile_is_staff is asked. The
 * name is the caller's profile name, never the name the ring carries.
 */
export async function verifyCaller(callerId: string): Promise<{ ok: boolean; name: string | null }> {
  const caller = await getPublicProfile(callerId);
  if (caller?.role === "tutor") return { ok: true, name: caller.displayName?.trim() || "Your tutor" };
  const supabase = createClient();
  if (!supabase) return { ok: false, name: null };
  try {
    const { data } = await supabase.rpc("profile_is_staff", { uid: callerId });
    return data === true ? { ok: true, name: caller?.displayName?.trim() || "An AlgeBridge admin" } : { ok: false, name: null };
  } catch {
    return { ok: false, name: null };
  }
}

/** Ring a specific user (broadcast to their personal ring channel). */
export function ringUser(targetId: string, payload: RingPayload): void {
  const supabase = createClient();
  if (!supabase) return;
  const topic = `ring-${targetId}`;
  (async () => {
    await removeStaleChannels(topic);
    await supabase.realtime.setAuth();
    const ch = supabase.channel(topic, { config: { private: true } });
    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "ring", payload });
        setTimeout(() => supabase.removeChannel(ch), 2000);
      }
    });
  })();
  // And their phone or computer rings, even with AlgeBridge closed.
  void sendPush({ kind: "ring", roomId: payload.roomId, targetId });
}

/** Tell the caller their call was declined. */
export function sendCallDecline(callerId: string, byName: string): void {
  const supabase = createClient();
  if (!supabase) return;
  const topic = `ring-${callerId}`;
  (async () => {
    await removeStaleChannels(topic);
    await supabase.realtime.setAuth();
    const ch = supabase.channel(topic, { config: { private: true } });
    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "decline", payload: { byName } });
        setTimeout(() => supabase.removeChannel(ch), 2000);
      }
    });
  })();
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
  let channel: ReturnType<NonNullable<ReturnType<typeof createClient>>["channel"]> | null = null;
  let cancelled = false;
  (async () => {
    await removeStaleChannels(topic);
    if (cancelled) return;
    await supabase.realtime.setAuth();
    channel = supabase
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "ring" }, ({ payload }) => onRing(payload as RingPayload))
      .on("broadcast", { event: "decline" }, ({ payload }) =>
        onDecline((payload as { byName?: string }).byName ?? "They")
      )
      .subscribe();
  })();
  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}
