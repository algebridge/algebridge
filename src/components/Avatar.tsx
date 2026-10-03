"use client";

import { useEffect, useRef, useState } from "react";
import { avatarPathOf, signAvatarUrls } from "@/lib/social";

interface AvatarProps {
  name: string | null | undefined;
  url: string | null | undefined;
  size?: number;
  className?: string;
}

function initials(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic soft color from the name so avatars are visually distinct.
function colorFor(name: string | null | undefined): string {
  // Each one holds white initials at 4.5:1 or better.
  const colors = [
    "#2563eb", "#7c3aed", "#be185d", "#c2410c",
    "#15803d", "#0e7490", "#a16207", "#dc2626",
  ];
  const s = name ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return colors[h % colors.length];
}

// ---------------------------------------------------------------------------
// Photos from the avatars bucket, as signed links
// ---------------------------------------------------------------------------
//
// supabase/schema-2026-10-03-safety.sql makes the avatars bucket private, so a
// stored public link stops opening. Every Avatar signs its own photo
// (signAvatarUrls in src/lib/social.ts), whoever handed it the link, so no
// page has to remember to. Links are signed in one batch per render, kept
// for 50 minutes (they last an hour), and signed again once if an image fails
// to load (an expired link). A photo the storage policy will not sign shows
// initials. Before the migration signing works the same on the public
// bucket, and if signing fails outright the stored link is used as it is.

const SIGNED_FOR_MS = 50 * 60 * 1000;
const signed = new Map<string, { url: string | null; at: number }>();
const waiting = new Map<string, { url: string; done: ((u: string | null) => void)[] }>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function fresh(path: string): string | null | undefined {
  const hit = signed.get(path);
  return hit && Date.now() - hit.at < SIGNED_FOR_MS ? hit.url : undefined;
}

function flushSigning() {
  flushTimer = null;
  const batch = [...waiting.entries()];
  waiting.clear();
  void signAvatarUrls(batch.map(([, w]) => w.url)).then(
    (urls) => {
      batch.forEach(([path, w], i) => {
        signed.set(path, { url: urls[i], at: Date.now() });
        w.done.forEach((fn) => fn(urls[i]));
      });
    },
    () => batch.forEach(([, w]) => w.done.forEach((fn) => fn(w.url)))
  );
}

/** A signed link for a stored avatars link, batched with the others on screen. */
function signedFor(url: string): Promise<string | null> {
  const path = avatarPathOf(url);
  if (!path) return Promise.resolve(url);
  const hit = fresh(path);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const entry = waiting.get(path) ?? { url, done: [] };
    entry.done.push(resolve);
    waiting.set(path, entry);
    if (!flushTimer) flushTimer = setTimeout(flushSigning, 0);
  });
}

/** What can be shown at once: no link, a photo from elsewhere, a signed link, or one signed lately. */
function shownAtOnce(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = avatarPathOf(url);
  if (!path || url.includes("/object/sign/")) return url;
  return fresh(path) ?? null;
}

export function Avatar({ name, url, size = 48, className = "" }: AvatarProps) {
  const dim = { width: size, height: size };
  const [src, setSrc] = useState<string | null>(() => shownAtOnce(url));
  const [failed, setFailed] = useState(false);
  const signedAgain = useRef(false);

  useEffect(() => {
    signedAgain.current = false;
    setFailed(false);
    const now = shownAtOnce(url);
    setSrc(now);
    if (now || !url || !avatarPathOf(url)) return;
    let live = true;
    void signedFor(url).then((s) => {
      if (live) setSrc(s);
    });
    return () => {
      live = false;
    };
  }, [url]);

  function onError() {
    const path = avatarPathOf(url);
    if (!signedAgain.current && url && path) {
      // Most likely an expired link: sign it once more.
      signedAgain.current = true;
      signed.delete(path);
      void signedFor(url).then((s) => {
        if (s && s !== src) setSrc(s);
        else setFailed(true);
      });
      return;
    }
    setFailed(true);
  }

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Avatar"}
        style={dim}
        onError={onError}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...dim, backgroundColor: colorFor(name), fontSize: size * 0.4 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
