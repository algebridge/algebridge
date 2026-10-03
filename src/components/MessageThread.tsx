"use client";

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
import { Icon } from "@/components/Icon";
import { BlockButton, ReportButton, ReportDialog, ReportFlag, useIsBlocked, type ReportTarget } from "@/components/ReportButton";
import { guardWithRecent, recentForGuard, type GuardVerdict } from "@/lib/safety";

interface MessageThreadProps {
  otherId: string;
  otherName: string | null;
  otherAvatarUrl: string | null;
  otherRole?: UserRole;
  /** Provided only when the current user may call the other (tutor → student).
   *  Rings the other person, then navigates the caller into the room. */
  onStartCall?: () => void;
}

/**
 * One direct-message conversation. Every message from the other person has a
 * Report button, the header has Report and Block, and nothing is sent until
 * the personal information guard (src/lib/safety.ts) has read it: a
 * student's message with a phone number, an email, an address, a username, a
 * link or a plan to talk somewhere else is held back with the reason, and a
 * staff member is warned and may send it anyway. The guard reads the
 * sender's last few messages here too (guardWithRecent), so a phone number
 * sent in pieces is held back like a whole one.
 */
export function MessageThread({
  otherId,
  otherName,
  otherAvatarUrl,
  otherRole,
  onStartCall,
}: MessageThreadProps) {
  const { user, profile } = useAuth();
  const staff = profile?.role === "tutor" || profile?.role === "teacher" || !!profile?.isAdmin;
  const blocked = useIsBlocked(otherId);
  const [held, setHeld] = useState<{ text: string; verdict: Exclude<GuardVerdict, { action: "send" }> } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  /** The message being reported. Owned here, so blocking from the report does not close it. */
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const threadId = user ? [user.id, otherId].sort().join("--") : otherId;
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
    const { message, error } = await sendMessage(otherId, body);
    setSending(false);
    if (error || !message) {
      setSendError(error ?? "That did not send. Try again.");
      return;
    }
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
            <p className="text-xs capitalize text-slate-500">{otherRole}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <ReportButton target={{ userId: otherId, name: otherName, place: "dm", placeId: threadId }} />
          <BlockButton otherId={otherId} otherName={otherName} />
        </div>
        {onStartCall && !blocked && (
          <button type="button" onClick={onStartCall} className="btn-primary shrink-0 text-sm">
            <Icon name="video" size={16} />
            Call
          </button>
        )}
      </div>

      {/* Messages */}
      <div data-lenis-prevent className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {blocked ? (
          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200" aria-hidden>
              <Icon name="eye-off" size={19} />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-900">You blocked {otherName ?? "this person"} on this device</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Their messages are hidden here and their calls will not ring. Unblock them at the top to see this conversation again.
            </p>
          </div>
        ) : loading ? (
          <p className="text-center text-sm text-slate-500">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`group flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
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
                  // Always shown, quietly, so a student finds it without
                  // hovering: a hidden Report button is one nobody uses.
                  <ReportFlag
                    label="Report this message"
                    className="shrink-0 text-slate-500"
                    onClick={() => setReporting({ userId: otherId, name: otherName, place: "dm", placeId: threadId, excerpt: m.body, messageId: m.id })}
                  />
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* What the guard held back, or a send that failed. */}
      {!blocked && held && (
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
              <button type="button" onClick={() => void handleSend(true)} disabled={sending || draft.trim() !== held.text} className="btn-secondary btn-sm">
                Send anyway
              </button>
            )}
            <button type="button" onClick={() => setHeld(null)} className="btn-ghost btn-sm">
              {held.verdict.action === "warn" ? "Edit it" : "OK"}
            </button>
          </div>
        </div>
      )}
      {!blocked && sendError && !held && (
        <p role="alert" className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {sendError}
        </p>
      )}

      {/* Composer */}
      {!blocked && (
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
          placeholder="Type a message…"
          aria-label="Message"
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
      )}
      {reporting && <ReportDialog target={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}
