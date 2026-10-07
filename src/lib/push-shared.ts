/**
 * What the server and the service worker agree on for notifications: the
 * public half of the push key, and the shape of a push.
 */

/** The public VAPID key; its private half is VAPID_PRIVATE_KEY on the server. */
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BLkTFxJAr3D4lgCDj9KjzgKoRrU6U5RcVM6JXuLdKLJX6LqkeCSw19xip-BiVi6vFRojLldfam45_u1uiQzg37M";

/** A ring is a call notification for this long, then it says the call was missed. */
export const RING_SECONDS = 30;

export type PushPayload =
  | { kind: "message"; title: string; body: string; url: string; tag: string }
  | { kind: "ring"; title: string; body: string; url: string; tag: string; caller: string; seconds: number };

/** A message's notification: who wrote, and the start of what they wrote. */
export function messagePush(senderId: string, senderName: string, body: string): PushPayload {
  const text = body.replace(/\s+/g, " ").trim();
  return {
    kind: "message",
    title: `${senderName} sent you a message`,
    body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
    url: `/messages/${senderId}`,
    tag: `dm-${senderId}`,
  };
}

/** A call's notification: it rings, with Answer and Decline. */
export function ringPush(roomId: string, callerName: string, members: number): PushPayload {
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
