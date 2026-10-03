"use client";

import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { useDialogFocus } from "@/components/useDialogFocus";
import { useAuth } from "@/lib/auth";
import { showToast } from "@/lib/notify";
import { blockOnServer, unblockOnServer } from "@/lib/social";
import { createClient } from "@/lib/supabase/client";
import { CRISIS_REPLY, detectCrisis } from "@/lib/helper";
import { CrisisCard } from "@/components/helper/CrisisCard";
import {
  blockKey,
  blockOnDevice,
  BLOCKS_EVENT,
  isBlocked,
  readBlocked,
  REPORT_LIMITS,
  REPORT_REASONS,
  unblockOnDevice,
  type BlockedPerson,
  type ReportPlace,
  type ReportReason,
} from "@/lib/safety";

/**
 * Report and Block, wherever a student meets another person: on each message
 * in a direct message or group chat, in a video call, and on a person's card
 * at the top of a conversation.
 *
 * A report goes to /api/feedback as kind "report", with the reason, the place,
 * the reported account and the reported message's id, saved for an
 * AlgeBridge admin to read. Nobody is alerted when one arrives yet, and the
 * copy says it is not read right away. The database quotes the reported
 * message itself from its id, so a report cannot carry a made-up quote.
 *
 * What a student types in "Anything else?" is read for signs they are in
 * danger (detectCrisis), and the crisis card is shown with the thank-you.
 * A block hides that person's messages and calls on this device
 * (localStorage, src/lib/safety.ts) and is also offered to the database,
 * which keeps it once supabase/schema-2026-10-03-safety.sql has run. The
 * copy says which of the two happened.
 */

const SUPPORT = "support@algebridge.org";

// ---------------------------------------------------------------------------
// The block list on this device
// ---------------------------------------------------------------------------

function subscribeBlocks(fn: () => void): () => void {
  window.addEventListener(BLOCKS_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(BLOCKS_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

/** This account's block list on this device, kept current. */
export function useBlockedList(): BlockedPerson[] {
  const { user } = useAuth();
  const me = user?.id ?? null;
  // The raw stored string is the snapshot: a primitive, so React sees a
  // change only when the list really changed.
  const raw = useSyncExternalStore(
    subscribeBlocks,
    () => {
      if (!me) return "";
      try {
        return window.localStorage.getItem(blockKey(me)) ?? "";
      } catch {
        return "";
      }
    },
    () => ""
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readBlocked(me), [me, raw]);
}

/** Is this person blocked on this device? */
export function useIsBlocked(otherId: string | null | undefined): boolean {
  return isBlocked(useBlockedList(), otherId);
}

async function sessionToken(): Promise<string> {
  try {
    const { data } = (await createClient()?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// A modal, shared by Report and Block
// ---------------------------------------------------------------------------

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(ref, true, onClose);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-raised sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-0.5 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportTarget {
  /** The person being reported, when there is one. */
  userId: string | null;
  name: string | null;
  place: ReportPlace;
  /** The thread, group or room id. */
  placeId: string;
  /** The message being reported, as the student sees it. Shown in the dialog. */
  excerpt?: string | null;
  /** The reported message's id; what the server stores in place of the text. */
  messageId?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SendState = "idle" | "sending" | "sent" | "failed" | "sign-in";

/**
 * The report form, then its thank-you. A thread that lists many messages
 * owns one of these itself (see ReportFlag), so the dialog stays open when
 * blocking from it hides the message it was opened from.
 */
export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<SendState>("idle");
  const [alsoBlocked, setAlsoBlocked] = useState<"no" | "device" | "everywhere">("no");
  const blocked = useIsBlocked(target.userId);
  const who = target.name?.trim() || "this person";
  const groupName = useId();
  /** The student's own words sounded like they are in danger. */
  const [crisis, setCrisis] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || state === "sending") return;
    if (detectCrisis(details)) setCrisis(true);
    setState("sending");
    const token = await sessionToken();
    if (!token) {
      setState("sign-in");
      return;
    }
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "report",
          token,
          page: window.location.pathname,
          report: {
            reason,
            details: details.trim() || undefined,
            reportedUserId: target.userId,
            place: target.place,
            placeId: target.placeId,
            // The id when the message has one; the database quotes it. The
            // text is only sent for something without an id.
            ...(target.messageId && UUID_RE.test(target.messageId)
              ? { messageId: target.messageId }
              : { excerpt: target.excerpt ?? null }),
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      setState(data.ok ? "sent" : data.reason === "sign-in" ? "sign-in" : "failed");
    } catch {
      setState("failed");
    }
  }

  async function blockToo() {
    if (!user || !target.userId) return;
    if (!blockOnDevice(user.id, { id: target.userId, name: target.name })) return;
    setAlsoBlocked((await blockOnServer(target.userId)) ? "everywhere" : "device");
  }

  if (state === "sent") {
    return (
      <Modal title="Report sent" onClose={onClose}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100" aria-hidden>
            <Icon name="check" size={20} />
          </span>
          <p className="text-sm leading-relaxed text-slate-700">
            Thank you for telling us. Your report is saved for an AlgeBridge admin to read, and {who} is not told who
            sent it. It is not read right away, so if you feel unsafe now, tell a trusted adult.
          </p>
        </div>
        {crisis && (
          <div className="mt-4">
            <CrisisCard reply={CRISIS_REPLY} voice="plain" />
          </div>
        )}
        {target.userId && user && target.userId !== user.id && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
            {alsoBlocked === "no" && !blocked ? (
              <>
                <p className="text-sm text-slate-700">You can also block {who}, so their messages and calls stop showing up here.</p>
                <button type="button" onClick={() => void blockToo()} className="btn-secondary btn-sm mt-2.5">
                  <Icon name="eye-off" size={14} />
                  Block {who}
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-700" role="status">
                {alsoBlocked === "everywhere"
                  ? `${who} is blocked. They can no longer message or call you, and their messages are hidden.`
                  : `${who} is blocked on this device. Their messages and calls are hidden here, not on your other devices.`}
              </p>
            )}
          </div>
        )}
        {!crisis && (
          <p className="mt-4 text-xs leading-relaxed text-slate-600">
            If you are in danger right now, call 911. You can also talk to a parent, a teacher or your school counselor.
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <button type="button" data-autofocus onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={target.excerpt ? "Report this message" : `Report ${who}`} onClose={onClose}>
      <form onSubmit={submit}>
        {target.excerpt && (
          <blockquote className="mb-4 line-clamp-3 rounded-xl border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {target.excerpt}
          </blockquote>
        )}
        <fieldset>
          <legend id={groupName} className="text-sm font-semibold text-slate-900">
            What happened?
          </legend>
          <div className="mt-2 space-y-1.5">
            {REPORT_REASONS.map((r, i) => (
              <label
                key={r.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                  reason === r.id ? "border-bridge-400 bg-bridge-50 text-slate-900" : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  data-autofocus={i === 0 ? "" : undefined}
                  className="h-4 w-4 border-slate-300 text-bridge-600 focus:ring-bridge-500"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block text-sm font-semibold text-slate-900">
          Anything else? <span className="font-normal text-slate-500">(optional)</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={REPORT_LIMITS.details}
            rows={3}
            className="mt-1.5 block w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          />
        </label>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          Reports are saved for an AlgeBridge admin to read, not sent to {who}, and are not read right away.
          {target.excerpt ? " The message above is included." : ""} If you are in danger right now, call 911.
        </p>
        {crisis && state !== "sending" && (
          <div className="mt-3">
            <CrisisCard reply={CRISIS_REPLY} voice="plain" />
          </div>
        )}
        {state === "failed" && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This did not send. Please email{" "}
            <a className="font-semibold underline" href={`mailto:${SUPPORT}?subject=Report`}>
              {SUPPORT}
            </a>{" "}
            and tell us what happened.
          </p>
        )}
        {state === "sign-in" && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Sign in again to send a report, or email{" "}
            <a className="font-semibold underline" href={`mailto:${SUPPORT}?subject=Report`}>
              {SUPPORT}
            </a>
            .
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={!reason || state === "sending"} className="btn-primary">
            <Icon name="flag" size={15} />
            {state === "sending" ? "Sending..." : "Send report"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The small flag beside a message. The thread opens its own ReportDialog. */
export function ReportFlag({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${className}`}
    >
      <Icon name="flag" size={15} />
    </button>
  );
}

/**
 * The Report button. "icon" is the small flag beside a message, "text" a
 * labelled button for a header.
 */
export function ReportButton({
  target,
  variant = "text",
  className = "",
}: {
  target: ReportTarget;
  variant?: "icon" | "text";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = target.excerpt ? "Report this message" : `Report ${target.name?.trim() || "this person"}`;
  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className={`rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bridge-500 ${className}`}
        >
          <Icon name="flag" size={15} />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`btn-ghost btn-sm ${className}`}>
          <Icon name="flag" size={15} />
          Report
        </button>
      )}
      {open && <ReportDialog target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

/**
 * Block or unblock one person. Blocking asks first, and says plainly that the
 * block is on this device; the database's own block is used too when it
 * exists, and the result line says when it took.
 */
export function BlockButton({ otherId, otherName, className = "" }: { otherId: string; otherName: string | null; className?: string }) {
  const { user } = useAuth();
  const blocked = useIsBlocked(otherId);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const who = otherName?.trim() || "this person";

  const block = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const kept = blockOnDevice(user.id, { id: otherId, name: otherName });
    const everywhere = kept ? await blockOnServer(otherId) : false;
    setBusy(false);
    setAsking(false);
    showToast(
      !kept
        ? { icon: "x-circle", tone: "info", title: "This browser could not save the block.", description: "Private windows sometimes refuse. Report them instead, and an admin will look." }
        : everywhere
          ? { icon: "eye-off", tone: "info", title: `${who} is blocked.`, description: "They can no longer message or call you, and their messages are hidden." }
          : { icon: "eye-off", tone: "info", title: `${who} is blocked on this device.`, description: "Their messages and calls are hidden here, not on your other devices." }
    );
  }, [user, otherId, otherName, who]);

  const unblock = useCallback(async () => {
    if (!user) return;
    unblockOnDevice(user.id, otherId);
    await unblockOnServer(otherId);
    showToast({ icon: "eye", tone: "info", title: `${who} is unblocked.`, description: "Their messages show here again." });
  }, [user, otherId, who]);

  if (!user || user.id === otherId) return null;

  return (
    <>
      {blocked ? (
        <button type="button" onClick={() => void unblock()} className={`btn-ghost btn-sm ${className}`}>
          <Icon name="eye" size={15} />
          Unblock
        </button>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={`btn-ghost btn-sm ${className}`}>
          <Icon name="eye-off" size={15} />
          Block
        </button>
      )}
      {asking && (
        <Modal title={`Block ${who}?`} onClose={() => setAsking(false)}>
          <p className="text-sm leading-relaxed text-slate-700">
            Their messages will be hidden and their calls will not ring for you on this device. They are not told.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            On your other phones or computers, block them there too. If they did something wrong, report them as well, so
            an admin can look.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" data-autofocus disabled={busy} onClick={() => void block()} className="btn-primary">
              <Icon name="eye-off" size={15} />
              {busy ? "Blocking..." : "Block"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
