export const TOAST_EVENT = "algebridge-toast";
export const CONFETTI_EVENT = "algebridge-confetti";

export interface ToastPayload {
  id: string;
  emoji: string;
  title: string;
  description?: string;
}

export type ToastInput = Omit<ToastPayload, "id">;

export function showToast(payload: ToastInput): void {
  if (typeof window === "undefined") return;
  const detail: ToastPayload = { ...payload, id: `${Date.now()}-${Math.random()}` };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail }));
}

export type ConfettiIntensity = "small" | "big";

export function fireConfetti(intensity: ConfettiIntensity = "small"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ConfettiIntensity>(CONFETTI_EVENT, { detail: intensity }));
}
