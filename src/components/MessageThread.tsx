"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import {
  getMessagesWith,
  markConversationRead,
  sendMessage,
  subscribeToIncomingMessages,
} from "@/lib/social";
import type { DirectMessage, UserRole } from "@/types";

interface MessageThreadProps {
  otherId: string;
  otherName: string | null;
  otherAvatarUrl: string | null;
  otherRole?: UserRole;
  /** Optional: show a "Start video call" button (student ↔ tutor). */
  callHref?: string;
}

export function MessageThread({
  otherId,
  otherName,
  otherAvatarUrl,
  otherRole,
  callHref,
}: MessageThreadProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const msgs = await getMessagesWith(otherId);
      if (!active) return;
      setMessages(msgs);
      setLoading(false);
      scrollToEnd();
      await markConversationRead(otherId);
    })();
    return () => {
      active = false;
    };
  }, [otherId, scrollToEnd]);

  // Realtime: append messages this person sends me while the thread is open.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToIncomingMessages(user.id, (msg) => {
      if (msg.senderId !== otherId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      markConversationRead(otherId);
      scrollToEnd();
    });
    return unsub;
  }, [user, otherId, scrollToEnd]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const { message, error } = await sendMessage(otherId, body);
    setSending(false);
    if (error || !message) return;
    setDraft("");
    setMessages((prev) => [...prev, message]);
    scrollToEnd();
  }

  return (
    <div className="flex h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Avatar name={otherName} url={otherAvatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{otherName ?? "AlgeBridge user"}</p>
          {otherRole && (
            <p className="text-xs capitalize text-slate-400">{otherRole}</p>
          )}
        </div>
        {callHref && (
          <Link href={callHref} className="btn-primary shrink-0 text-sm">
            🎥 Video call
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-slate-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-400">
            No messages yet — say hi! 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? "rounded-br-sm bg-bridge-600 text-white"
                      : "rounded-bl-sm bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-slate-200 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder="Type a message…"
          aria-label="Message"
          className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="btn-primary shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
