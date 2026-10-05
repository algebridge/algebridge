"use client";

import { useEffect, useRef, useState } from "react";

/** The public OAuth client "AlgeBridge web" in the Google Cloud project algebridge. Not a secret. */
export const GOOGLE_CLIENT_ID = "132353866592-2d9sqqu7j9jt9coba9bbjb78qe4brq04.apps.googleusercontent.com";

/** The addresses listed under Authorized JavaScript origins on that client. */
export const GOOGLE_BUTTON_ORIGINS = new Set(["https://learn.algebridge.org"]);

type GoogleId = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

let scriptPromise: Promise<GoogleId | null> | null = null;
function loadGoogle(): Promise<GoogleId | null> {
  const w = window as unknown as { google?: GoogleId };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  scriptPromise ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve(w.google?.accounts?.id ? w.google : null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(w.google?.accounts?.id ? w.google : null), 8000);
  });
  return scriptPromise;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Google's own "Sign in with Google" button. Google shows the site it runs on
 * (learn.algebridge.org) in its popup. `onToken` gets the signed ID token and
 * the raw nonce, which Supabase checks against the hashed one Google signed.
 * `fallback` renders when Google's script does not load.
 */
export function GoogleIdButton({
  onToken,
  fallback,
  disabled,
}: {
  onToken: (token: string, nonce: string) => void;
  fallback: React.ReactNode;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const latest = useRef(onToken);
  latest.current = onToken;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Google refuses its button on an address the client does not list.
      // Only learn.algebridge.org is listed (Google Cloud, project AlgeBridge,
      // client "AlgeBridge web"), so everywhere else keeps the redirect button.
      if (!GOOGLE_BUTTON_ORIGINS.has(window.location.origin)) return setState("failed");
      const google = await loadGoogle();
      if (cancelled) return;
      if (!google || !host.current) return setState("failed");
      const nonce = crypto.randomUUID();
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: await sha256Hex(nonce),
        ux_mode: "popup",
        callback: (r: { credential?: string }) => {
          if (r.credential) latest.current(r.credential, nonce);
        },
      });
      google.accounts.id.renderButton(host.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "center",
        width: Math.min(400, host.current.clientWidth || 320),
      });
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "failed") return <>{fallback}</>;
  return (
    <div
      ref={host}
      className="flex min-h-[44px] w-full justify-center"
      style={disabled ? { pointerEvents: "none", opacity: 0.5 } : undefined}
      aria-busy={state === "loading"}
    />
  );
}
