"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/push";
import { showToast } from "@/lib/notify";
import { useSchoolMode } from "@/components/SchoolModePanel";

/**
 * Turns on messages and calls on this device: a phone or a computer gets
 * them even with AlgeBridge closed. `compact` is the one-line version for the
 * top of the messages list; the full card sits in the tutor hub and profile.
 */
export function NotificationsCard({ compact = false, who = "your tutor" }: { compact?: boolean; who?: string }) {
  const { user } = useAuth();
  const school = useSchoolMode();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    pushState().then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, []);

  if (!user || school || state === null || state === "unsupported") return null;
  // Already on: the compact card steps aside; the full one offers to turn it off.
  if (state === "on" && compact) return null;

  async function turnOn() {
    setBusy(true);
    const res = await enablePush();
    setBusy(false);
    showToast({ icon: res.ok ? "check" : "x-circle", tone: res.ok ? "success" : "info", title: res.message });
    setState(await pushState());
  }

  async function turnOff() {
    setBusy(true);
    await disablePush();
    setBusy(false);
    showToast({ icon: "check", tone: "info", title: "Notifications are off for this device." });
    setState(await pushState());
  }

  const line =
    state === "needs-install"
      ? "On iPhone and iPad: tap Share, then Add to Home Screen. Open AlgeBridge from your Home Screen and turn notifications on there."
      : state === "blocked"
        ? "Notifications are blocked for AlgeBridge. Allow them in this browser's site settings, then come back."
        : state === "on"
          ? `This device gets a notification for every message, and rings for every call, even with AlgeBridge closed.`
          : `Get a notification on this device when ${who} messages you, and a ring when they call, even with AlgeBridge closed.`;

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border border-bridge-100 bg-bridge-50/60 ${compact ? "px-4 py-3" : "p-4"}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-bridge-700 ring-1 ring-bridge-100" aria-hidden>
        <Icon name="phone" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        {!compact && <p className="text-sm font-semibold text-slate-900">Notifications on this device</p>}
        <p className="text-sm text-slate-700">{line}</p>
      </div>
      {state === "off" && (
        <button type="button" onClick={turnOn} disabled={busy} className="btn-primary btn-sm">
          {busy ? "Turning on..." : "Turn on"}
        </button>
      )}
      {state === "on" && (
        <button type="button" onClick={turnOff} disabled={busy} className="btn-secondary btn-sm">
          Turn off
        </button>
      )}
    </div>
  );
}
