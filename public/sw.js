/*
 * AlgeBridge's service worker: notifications only.
 *
 * It shows a message or a ringing call on the phone or computer even when
 * AlgeBridge is closed, and opens the right page when it is tapped. It has no
 * fetch handler and caches nothing, so it can never serve an old version of
 * the site.
 *
 * A ring is a call notification that keeps buzzing (requireInteraction,
 * vibrate) with Answer and Decline, and after the ring time it turns into
 * "Missed call". A visible AlgeBridge tab rings by itself, so a ring is not
 * shown twice; a message is skipped only when that very conversation is open.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function visibleClients() {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  return all.filter((c) => c.visibilityState === "visible");
}

self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data || !data.title) return;
  event.waitUntil(show(data));
});

async function show(data) {
  const open = await visibleClients();
  const icon = "/brand/app-192.png";
  if (data.kind === "message") {
    const path = new URL(data.url, self.location.origin).pathname;
    if (open.some((c) => new URL(c.url).pathname === path)) return;
    await self.registration.showNotification(data.title, {
      body: data.body,
      icon,
      badge: icon,
      tag: data.tag,
      renotify: true,
      data: { url: data.url },
    });
    return;
  }
  if (data.kind === "ring") {
    // An open, visible AlgeBridge tab rings on the page itself.
    if (open.length) return;
    await self.registration.showNotification(data.title, {
      body: data.body,
      icon,
      badge: icon,
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [700, 400, 700, 400, 700, 400, 700, 400, 700, 400, 700],
      actions: [
        { action: "answer", title: "Answer" },
        { action: "decline", title: "Decline" },
      ],
      data: { url: data.url, ring: true },
    });
    // After the ring, the call notification becomes a missed call (if it is still there).
    await new Promise((resolve) => setTimeout(resolve, (data.seconds || 30) * 1000));
    const still = await self.registration.getNotifications({ tag: data.tag });
    if (still.length) {
      still.forEach((n) => n.close());
      await self.registration.showNotification(`Missed call from ${data.caller || "your tutor"}`, {
        body: "Open AlgeBridge to message them back.",
        icon,
        badge: icon,
        tag: data.tag,
        silent: true,
        data: { url: "/messages" },
      });
    }
  }
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  n.close();
  if (event.action === "decline") return;
  const url = new URL((n.data && n.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const mine = all.find((c) => new URL(c.url).origin === self.location.origin);
      if (mine) {
        await mine.focus();
        if ("navigate" in mine) await mine.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
