"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { TOAST_EVENT, type ToastPayload } from "@/lib/notify";

const AUTO_DISMISS_MS = 4500;
/**
 * One right answer can finish a skill, earn Bridgeys and unlock a badge at
 * once. Four stacked pop-ups read as a slot machine; two at a time is news.
 */
const MAX_VISIBLE = 2;

const TONE: Record<NonNullable<ToastPayload["tone"]>, string> = {
  success: "bg-emerald-50 text-emerald-600",
  reward: "bg-amber-50 text-amber-600",
  info: "bg-bridge-50 text-bridge-600",
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();

    function handleToast(e: Event) {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      if (!detail) return;
      setToasts((prev) => [...prev, detail]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        setToasts((prev) => prev.filter((t) => t.id !== detail.id));
      }, AUTO_DISMISS_MS);
      timers.add(timer);
    }
    window.addEventListener(TOAST_EVENT, handleToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToast);
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto"
    >
      {toasts.slice(-MAX_VISIBLE).map((toast) => (
        <div
          key={toast.id}
          className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg sm:w-96"
        >
          {toast.icon ? (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[toast.tone ?? "info"]}`}>
              <Icon name={toast.icon} size={18} />
            </span>
          ) : (
            <span className="text-2xl">{toast.emoji}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-sm text-slate-500">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
