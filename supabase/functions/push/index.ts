// Sends a notification to someone's phone or computer, even with AlgeBridge
// closed (Web Push). The sender's browser calls this right after it sends a
// message or rings someone:
//
//   { kind: "message", messageId }        the message it just sent
//   { kind: "ring", roomId, targetId }    the person it is ringing
//
// It runs as the signed-in sender, and the database decides
// (supabase/schema-2026-10-07-push.sql): it hands over the recipient's
// devices only for a message this sender just wrote, or a call room both are
// in with staff on one side. The words come from the database row, never
// from the request. The signing key is the function secret VAPID_PRIVATE_KEY.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "BLkTFxJAr3D4lgCDj9KjzgKoRrU6U5RcVM6JXuLdKLJX6LqkeCSw19xip-BiVi6vFRojLldfam45_u1uiQzg37M";
const RING_SECONDS = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function messagePush(senderId: string, senderName: string, body: string) {
  const text = body.replace(/\s+/g, " ").trim();
  return { kind: "message", title: `${senderName} sent you a message`, body: text.length > 140 ? `${text.slice(0, 137)}...` : text, url: `/messages/${senderId}`, tag: `dm-${senderId}` };
}

function ringPush(roomId: string, callerName: string, members: number) {
  const others = members - 2;
  return {
    kind: "ring",
    title: others > 0 ? `${callerName} is calling you and ${others} ${others === 1 ? "other" : "others"}` : `${callerName} is calling you`,
    body: others > 0 ? "Group call on AlgeBridge. Answer to join." : "Video call on AlgeBridge. Answer to join.",
    url: `/room/${roomId}`,
    tag: `ring-${roomId}`,
    caller: callerName,
    seconds: RING_SECONDS,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "post only" }, 405);
  const key = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!key) return reply({ sent: 0, reason: "not configured" });
  webpush.setVapidDetails("mailto:support@algebridge.org", VAPID_PUBLIC_KEY, key);

  const auth = req.headers.get("Authorization") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: who } = await db.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!who.user) return reply({ error: "sign in first" }, 401);

  let body: { kind?: string; messageId?: string; roomId?: string; targetId?: string };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "bad request" }, 400);
  }

  type Target = { endpoint: string; p256dh: string; auth: string };
  let targets: Target[] = [];
  let payload: { tag: string; kind: string };
  let ttl: number;
  if (body.kind === "message" && body.messageId && UUID.test(body.messageId)) {
    const { data, error } = await db.rpc("push_targets_for_message", { p_message: body.messageId });
    if (error) return reply({ sent: 0, reason: "not set up" });
    const rows = (data ?? []) as (Target & { sender_id: string; sender_name: string; body: string })[];
    if (!rows.length) return reply({ sent: 0 });
    targets = rows;
    payload = messagePush(rows[0].sender_id, rows[0].sender_name, rows[0].body);
    ttl = 24 * 3600;
  } else if (body.kind === "ring" && body.targetId && UUID.test(body.targetId) && body.roomId && body.roomId.length < 400) {
    const { data, error } = await db.rpc("push_targets_for_ring", { p_target: body.targetId, p_room: body.roomId });
    if (error) return reply({ sent: 0, reason: "not set up" });
    const rows = (data ?? []) as (Target & { caller_name: string; members: number })[];
    if (!rows.length) return reply({ sent: 0 });
    targets = rows;
    payload = ringPush(body.roomId, rows[0].caller_name, rows[0].members);
    // A ring that arrives late is no use: the push service drops it after the ring.
    ttl = RING_SECONDS;
  } else {
    return reply({ error: "bad request" }, 400);
  }

  const json = JSON.stringify(payload);
  const results = await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, json, {
          TTL: ttl,
          urgency: payload.kind === "ring" ? "high" : "normal",
          topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
        });
        return true;
      } catch (err) {
        // The device unsubscribed or the browser was reset: forget it.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.rpc("forget_push_endpoint", { p_endpoint: t.endpoint });
        return false;
      }
    })
  );
  return reply({ sent: results.filter(Boolean).length });
});
