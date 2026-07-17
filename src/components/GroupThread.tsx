"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  getGroupMessages,
  sendGroupMessage,
  subscribeToGroup,
} from "@/lib/groups";
import { getPublicProfile } from "@/lib/social";
import type { GroupMessage } from "@/types";

export function GroupThread({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Cache sender names so realtime inserts (which have no name) can be labelled.
  const nameCache = useRef<Map<string, string | null>>(new Map());

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const msgs = await getGroupMessages(groupId);
      if (!active) return;
      for (const m of msgs) nameCache.current.set(m.senderId, m.senderName ?? "Member");
      setMessages(msgs);
      setLoading(false);
      scrollToEnd();
    })();
    return () => {
      active = false;
    };
  }, [groupId, scrollToEnd]);

  useEffect(() => {
    const unsub = subscribeToGroup(groupId, (msg) => {
      const known = nameCache.current.get(msg.senderId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, { ...msg, senderName: known ?? "…" }];
      });
      scrollToEnd();
      // Backfill the name for a sender we haven't seen yet (e.g. a newly-added
      // group member whose messages weren't in the initial load).
      if (known === undefined) {
        getPublicProfile(msg.senderId).then((p) => {
          const name = p?.displayName ?? "Member";
          nameCache.current.set(msg.senderId, name);
          setMessages((prev) =>
            prev.map((m) => (m.senderId === msg.senderId ? { ...m, senderName: name } : m))
          );
        });
      }
    });
    return unsub;
  }, [groupId, scrollToEnd]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await sendGroupMessage(groupId, body);
    setSending(false);
    if (!error) {
      setDraft("");
      // Realtime echoes our own insert back, so we don't append optimistically.
    }
  }

  return (
    <div className="flex h-[68vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-slate-400">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-400">
            No messages yet — start the conversation! 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && (
                  <span className="mb-0.5 ml-1 text-xs font-medium text-slate-400">
                    {m.senderName}
                  </span>
                )}
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
          placeholder="Message the group…"
          aria-label="Group message"
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
