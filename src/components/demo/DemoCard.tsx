"use client";

import { useRef, type ReactNode } from "react";
import { useEmbedHeight } from "@/lib/embed";

/**
 * The card a /demo page is made of: the same white card as /try, and the
 * height report algebridge.org's frame listens for. Everything a demo shows
 * lives in React state; nothing it does is saved.
 */
export function DemoCard({ children, className = "", pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEmbedHeight(ref);
  return (
    <div ref={ref} className={`try-card ${pad ? "p-4 sm:p-5" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
