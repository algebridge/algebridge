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

  const when = new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <section className="card relative border-l-4 border-l-bridge-500 pr-12" aria-label="Announcement">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-bridge-700">
        Announcement · {a.authorName} · {when}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{a.title}</h2>
      <p className="mt-1 whitespace-pre-line text-slate-700">{a.body}</p>
      {items.length > 1 && <p className="mt-2 text-xs text-slate-500">{items.length - 1} more after this one</p>}
      <button
        type="button"
        onClick={() => {
          dismissAnnouncement(a.id);
          setItems((xs) => xs.slice(1));
        }}
        className="btn-ghost btn-sm absolute right-3 top-3"
        aria-label="Dismiss announcement"
        title="Dismiss"
      >
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}
