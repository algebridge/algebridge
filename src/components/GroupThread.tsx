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
import { Icon } from "@/components/Icon";
import { ReportDialog, ReportFlag, useBlockedList, type ReportTarget } from "@/components/ReportButton";
import { guardWithRecent, isBlocked, recentForGuard, sendErrorText, type GuardVerdict } from "@/lib/safety";

/**
 * A group chat. Every message from someone else has a Report button; messages
 * from someone this student blocked are folded away on this device; and the
 * personal information guard (src/lib/safety.ts) reads every message before
 * it is sent, as in direct messages, joined to the sender's last few here.
 */
export function GroupThread({ groupId }: { groupId: string }) {
  const { user, profile } = useAuth();
  const staff = profile?.role === "tutor" || profile?.role === "teacher" || !!profile?.isAdmin;
  const blockedList = useBlockedList();
  const [held, setHeld] = useState<{ text: string; verdict: Exclude<GuardVerdict, { action: "send" }> } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  /** The message being reported. Owned here, so blocking its sender does not close it. */
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
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
      // A name the profiles table would not give (a tutor reading a student
      // once the safety migration has run) comes from the directory instead.
      const unnamed = [...new Set(msgs.filter((m) => !m.senderName || m.senderName === "Member").map((m) => m.senderId))];
      for (const id of unnamed) {
        const p = await getPublicProfile(id);
        if (!active || !p?.displayName) continue;
        nameCache.current.set(id, p.displayName);
        setMessages((prev) => prev.map((m) => (m.senderId === id ? { ...m, senderName: p.displayName } : m)));
      }
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

  async function handleSend(override = false) {
    const body = draft.trim();
    if (!body || sending) return;
    if (!override) {
      const verdict = guardWithRecent(body, recentForGuard(messages, user?.id), { staff });
      if (verdict.action !== "send") {
        setHeld({ text: body, verdict });
        return;
      }
    }
    setHeld(null);
    setSendError(null);
    setSending(true);
    const { error } = await sendGroupMessage(groupId, body);
    setSending(false);
    if (!error) {
      setDraft("");
      // Realtime echoes our own insert back, so we don't append optimistically.
    } else {
      // The database's refusal, in plain words.
      setSendError(sendErrorText(error));
    }
  }

  return (
    <div className="flex h-[68vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div data-lenis-prevent className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-sm text-slate-500">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            if (!mine && isBlocked(blockedList, m.senderId)) {
              return (
                <p key={m.id} className="flex items-center gap-1.5 pl-1 text-xs text-slate-500">
                  <Icon name="eye-off" size={13} />
                  A message from someone you blocked on this device
                </p>
              );
            }
            return (
              <div key={m.id} className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && (
                  <span className="mb-0.5 ml-1 text-xs font-medium text-slate-500">
                    {m.senderName}
                  </span>
                )}
                <div className={`flex max-w-full items-center gap-1 ${mine ? "justify-end" : ""}`}>
                  <div
                    className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                      mine
                        ? "rounded-br-sm bg-bridge-600 text-white"
                        : "rounded-bl-sm bg-slate-100 text-slate-800"
                    }`}
                  >
                    {m.body}
                  </div>
                  {!mine && (
                    <ReportFlag
                      label="Report this message"
                      className="shrink-0 text-slate-500"
                      onClick={() => setReporting({ userId: m.senderId, name: m.senderName ?? null, place: "group", placeId: groupId, excerpt: m.body, messageId: m.id })}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {held && (
        <div
          role="alert"
          className={`border-t px-4 py-3 text-sm leading-relaxed ${
            held.verdict.action === "warn" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-slate-50 text-slate-800"
          }`}
        >
          <p className="flex gap-2">
            <Icon name="shield" size={17} className={`mt-0.5 shrink-0 ${held.verdict.action === "warn" ? "text-amber-700" : "text-bridge-600"}`} />
            <span>{held.verdict.message}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2 pl-6">
            {held.verdict.action === "warn" && (
              <button type="button" onClick={() => void handleSend(true)} disabled={sending} className="btn-secondary btn-sm">
                Send anyway
              </button>
            )}
            <button type="button" onClick={() => setHeld(null)} className="btn-ghost btn-sm">
              {held.verdict.action === "warn" ? "Edit it" : "OK"}
            </button>
          </div>
        </div>
      )}
      {sendError && !held && (
        <p role="alert" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {sendError}
        </p>
      )}

      <div className="flex items-end gap-2 border-t border-slate-200 p-3">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (held && e.target.value.trim() !== held.text) setHeld(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={1}
          placeholder="Message the group…"
          aria-label="Group message"
          className="max-h-32 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || !draft.trim()}
          className="btn-primary shrink-0"
        >
          Send
        </button>
      </div>
      {reporting && <ReportDialog target={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}
