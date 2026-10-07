/**
 * Notifications on this device (Web Push), from the browser's side.
 *
 * The service worker (public/sw.js) shows them, even with AlgeBridge closed.
 * This file registers it, asks to turn notifications on (only ever from a
 * button press: browsers refuse a request that is not), saves this device
 * for the signed-in account, forgets it at sign-out so the next person on a
 * shared computer never gets the last one's messages, and asks the server
 * (the Edge Function in supabase/functions/push) to send after a message or a ring.
 */

import { createClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY } from "@/lib/push-shared";

export type PushState = "unsupported" | "needs-install" | "blocked" | "off" | "on";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function standalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Where this device stands: on, off, blocked in the browser, or (iPhone) to be added to the Home Screen first. */
export async function pushState(): Promise<PushState> {
  if (isIos() && !standalone()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function save(sub: PushSubscription): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  const j = sub.toJSON();
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return false;
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  return !error;
}

/** Turns notifications on for this device. Call it from a button press. */
export async function enablePush(): Promise<{ ok: boolean; message: string }> {
  if (isIos() && !standalone()) return { ok: false, message: "On iPhone, add AlgeBridge to your Home Screen first, then open it from there." };
  if (!pushSupported()) return { ok: false, message: "This browser cannot show notifications." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, message: "Notifications are blocked for AlgeBridge in this browser's settings." };
  const reg = await registration();
  if (!reg) return { ok: false, message: "Notifications could not start in this browser." };
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
    } catch {
      return { ok: false, message: "Notifications could not start in this browser." };
    }
  }
  return (await save(sub)) ? { ok: true, message: "Notifications are on for this device." } : { ok: false, message: "Notifications could not be saved. Try again in a minute." };
}

/** Turns them off for this device. */
export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const supabase = createClient();
  await supabase?.rpc("forget_push_endpoint", { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => false);
}

/**
 * On every visit while signed in: keep this device saved for this account
 * (the browser may have renewed its subscription, or someone else signed in
 * here last). Never asks for anything.
 */
export async function refreshPush(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await save(sub);
}

/** At sign-out: this device stops getting this account's notifications. */
export async function forgetThisDevice(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const supabase = createClient();
    await supabase?.rpc("forget_push_endpoint", { p_endpoint: sub.endpoint });
  } catch {
    /* signed out all the same */
  }
}

/**
 * Asks the server to notify: the message just sent, or the person being rung.
 * The sending is the Supabase Edge Function "push" (supabase/functions/push),
 * which holds the signing key and asks the database who may be reached.
 */
export async function sendPush(body: { kind: "message"; messageId: string } | { kind: "ring"; roomId: string; targetId: string }): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;
  try {
    await supabase.functions.invoke("push", { body });
  } catch {
    /* the in-app message or ring still arrives */
  }
}
