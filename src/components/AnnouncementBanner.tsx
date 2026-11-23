"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/auth";
import { useSchoolMode } from "@/components/SchoolModePanel";
import { dismissAnnouncement, dismissedAnnouncements, listRecentAnnouncements, type Announcement } from "@/lib/announcements";

/**
 * The newest announcement from a tutor, on the course page, for anyone signed
 * in. Dismissed ones stay dismissed on this device. Hidden in school mode,
 * where a class's teacher is the only adult who speaks to the class.
 */
export function AnnouncementBanner() {
  const { user } = useAuth();
  const school = useSchoolMode();
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    if (!user || school) return;
    let live = true;
    listRecentAnnouncements().then((all) => {
      if (!live) return;
      const gone = dismissedAnnouncements();
      setItems(all.filter((a) => !gone.has(a.id)));
    });
    return () => {
      live = false;
    };
  }, [user, school]);

  const a = items[0];
  if (!user || school || !a) return null;
  return (
    <AnnouncementCard
      announcement={a}
      more={items.length - 1}
      onDismiss={() => {
        dismissAnnouncement(a.id);
        setItems((xs) => xs.slice(1));
      }}
    />
  );
}

/** The card itself: a filled blue panel so a tutor's news can't be mistaken for one more lesson card. */
export function AnnouncementCard({
  announcement: a,
  more,
  onDismiss: dismiss,
}: {
  announcement: Announcement;
  more: number;
  onDismiss: () => void;
}) {
  const when = new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <section
      key={a.id}
      className="animate-pop-in relative overflow-hidden rounded-2xl bg-bridge-600 text-white shadow-panel ring-1 ring-bridge-700/40"
      aria-labelledby={`announcement-${a.id}`}
    >
      {/* A soft bloom of light in the corner so the card reads as news, not as one more panel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-300/30 blur-3xl"
      />
      <div className="relative flex gap-4 px-5 py-5 pr-12 sm:gap-5 sm:px-6">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 -rotate-6 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-sm"
        >
          <Icon name="megaphone" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-semibold uppercase tracking-[0.1em] text-white/80">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
            </span>
            <span className="text-amber-200">Announcement</span>
            <span className="normal-case tracking-normal text-white/80">
              from {a.authorName} · {when}
            </span>
          </p>
          <h2 id={`announcement-${a.id}`} className="mt-1.5 text-xl font-bold leading-snug sm:text-2xl">
            {a.title}
          </h2>
          <p className="mt-1.5 max-w-2xl whitespace-pre-line leading-relaxed text-white/95">{a.body}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-bridge-700 shadow-sm transition hover:-translate-y-px hover:bg-bridge-50"
            >
              {more > 0 ? "Next announcement" : "Got it"}
              <Icon name={more > 0 ? "arrow-right" : "check"} size={16} />
            </button>
            {more > 0 && <span className="text-sm text-white/80">{more} more after this one</span>}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
        aria-label="Dismiss announcement"
        title="Dismiss"
      >
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}
