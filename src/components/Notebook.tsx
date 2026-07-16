"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { loadNotebook, saveNotebook } from "@/lib/social";

const LOCAL_KEY = "algebridge-notebook";

type SaveState = "idle" | "saving" | "saved" | "error";

interface NotebookProps {
  /** Compact styling for embedding inside the call room. */
  compact?: boolean;
  className?: string;
}

/**
 * A student's private, free-form notebook. Autosaves to Supabase when signed
 * in (so it follows them across devices) and falls back to localStorage
 * otherwise. Debounced so we don't hammer the network on every keystroke.
 */
export function Notebook({ compact = false, className = "" }: NotebookProps) {
  const { user, configured } = useAuth();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror the latest text + whether it's unsaved, so we can flush on unmount
  // WITHOUT calling setState on an unmounted component.
  const contentRef = useRef("");
  const dirtyRef = useRef(false);

  const cloud = !!user && configured;

  // Load once on mount (cloud or local).
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let text = "";
      if (cloud) {
        text = await loadNotebook();
      } else if (typeof window !== "undefined") {
        text = window.localStorage.getItem(LOCAL_KEY) ?? "";
      }
      if (active) {
        setContent(text);
        contentRef.current = text;
        dirtyRef.current = false;
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [cloud]);

  // Raw save with no React state — safe to call during unmount.
  const rawSave = useCallback(
    (text: string) => {
      if (cloud) {
        void saveNotebook(text);
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_KEY, text);
      }
    },
    [cloud]
  );

  const persist = useCallback(
    async (text: string) => {
      dirtyRef.current = false;
      if (cloud) {
        setSaveState("saving");
        const { error } = await saveNotebook(text);
        setSaveState(error ? "error" : "saved");
      } else if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_KEY, text);
        setSaveState("saved");
      }
    },
    [cloud]
  );

  function handleChange(text: string) {
    setContent(text);
    contentRef.current = text;
    dirtyRef.current = true;
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(contentRef.current), 700);
  }

  // Flush a pending save on unmount so the last edit is never lost when
  // leaving the page (e.g. jotting a note in the call room, then leaving).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        rawSave(contentRef.current);
        dirtyRef.current = false;
      }
    };
  }, [rawSave]);

  const statusText =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? cloud ? "Saved to your account" : "Saved on this device"
        : saveState === "error"
          ? "Couldn't save"
          : "";

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className={`font-bold text-slate-900 ${compact ? "text-sm" : ""}`}>📓 Notebook</h3>
        <span
          className={`text-xs ${saveState === "error" ? "text-red-500" : "text-slate-400"}`}
          aria-live="polite"
        >
          {statusText}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        placeholder={
          loading
            ? "Loading your notes…"
            : "Write your notes, steps, and questions here. It saves automatically."
        }
        className={`w-full flex-1 resize-none rounded-xl border border-slate-300 p-4 font-mono leading-relaxed focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200 ${
          compact ? "text-sm" : "min-h-[60vh] text-base"
        }`}
      />
      {!cloud && !loading && (
        <p className="mt-2 text-xs text-slate-400">
          Sign in to save your notebook to your account and open it on any device.
        </p>
      )}
    </div>
  );
}
