"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { showToast } from "@/lib/notify";
import {
  ANNOUNCEMENT_DAYS,
  ANNOUNCEMENT_LIMITS,
  checkAnnouncement,
  deleteAnnouncement,
  listRecentAnnouncements,
  postAnnouncement,
  type Announcement,
} from "@/lib/announcements";

/** Tutor hub: write one announcement for everyone on AlgeBridge, and see or take down recent ones. */
export function AnnouncementComposer({ myId, isAdmin }: { myId: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Announcement[]>([]);

  const reload = () => listRecentAnnouncements().then(setRecent);
  useEffect(() => {
    reload();
  }, []);

  async function send() {
    setBusy(true);
    const res = await postAnnouncement(title, body);
    setBusy(false);
    setConfirming(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setTitle("");
    setBody("");
    setError(null);
    setOpen(false);
    showToast({ icon: "check", tone: "success", title: "Announcement posted for everyone" });
    reload();
  }

  async function remove(id: string) {
    const res = await deleteAnnouncement(id);
    if (res.error) showToast({ icon: "x-circle", tone: "info", title: res.error });
    else reload();
  }

  const mine = recent.filter((a) => isAdmin || a.authorId === myId);

  return (
    <section className="card space-y-3" aria-label="Announcements">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Announce to everyone</h2>
          <p className="text-sm text-slate-500">
            Shows on the course page for every signed-in student and tutor for {ANNOUNCEMENT_DAYS} days. Up to {ANNOUNCEMENT_LIMITS.perDay} a day.
          </p>
        </div>
        {!open && (
          <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}>
            <Icon name="plus" size={15} />
            New announcement
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-2">
          <input
            value={title}
            maxLength={ANNOUNCEMENT_LIMITS.title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
              setConfirming(false);
            }}
            placeholder="Title, like: Review session Thursday"
            aria-label="Announcement title"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          />
          <textarea
            value={body}
            maxLength={ANNOUNCEMENT_LIMITS.body}
            rows={4}
            onChange={(e) => {
              setBody(e.target.value);
              setError(null);
              setConfirming(false);
            }}
            placeholder="What everyone should know"
            aria-label="Announcement message"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
          />
          <p className="text-right text-xs text-slate-500">
            {body.length}/{ANNOUNCEMENT_LIMITS.body}
          </p>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setOpen(false); setConfirming(false); setError(null); }}>
              Cancel
            </button>
            {confirming ? (
              <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={send}>
                {busy ? "Posting…" : "Yes, post it for everyone"}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => {
                  const why = checkAnnouncement(title, body);
                  if (why) setError(why);
                  else setConfirming(true);
                }}
              >
                Post
              </button>
            )}
          </div>
        </div>
      )}

      {mine.length > 0 && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-1">
          {mine.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.authorName} · {new Date(a.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => remove(a.id)} aria-label={`Take down ${a.title}`} title="Take down">
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
