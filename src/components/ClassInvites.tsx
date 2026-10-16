"use client";

import { useEffect, useState } from "react";
import { answerClassInvite, getMyClassInvites, type ClassInvite } from "@/lib/teacher";
import { loadManagedFlag } from "@/lib/social";
import { forgetMyClassContext } from "@/lib/my-class-context";
import { setManagedAccount } from "@/lib/school-mode";

/**
 * Classes a teacher invited this student to. A teacher who adds a student by
 * email sends an invite, and the student is on the roster only after saying
 * yes here. Shown on My classes beside the join code, and on the profile.
 * Renders nothing while there is nothing to answer.
 */
export function ClassInvites({ userId }: { userId: string }) {
  const [invites, setInvites] = useState<ClassInvite[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    void getMyClassInvites().then((list) => {
      if (live) setInvites(list);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  async function answer(invite: ClassInvite, accept: boolean) {
    setBusy(invite.classId);
    setNote(null);
    const err = await answerClassInvite(invite.classId, accept);
    setBusy(null);
    if (err) {
      setNote({ ok: false, text: err });
      return;
    }
    setInvites((list) => (list ?? []).filter((i) => i.classId !== invite.classId));
    if (accept) {
      forgetMyClassContext();
      // Joining a class makes this a school account: the menus follow at once.
      void loadManagedFlag(userId).then(setManagedAccount);
      setNote({ ok: true, text: `You joined ${invite.className}.` });
    } else {
      setNote({ ok: true, text: `You said no thanks to ${invite.className}.` });
    }
  }

  if (!invites || (invites.length === 0 && !note)) return null;

  return (
    <section aria-labelledby="class-invites-title" className="panel">
      <div className="panel-head">
        <h2 id="class-invites-title" className="panel-title">
          Class invites
        </h2>
      </div>
      <div className="panel-body space-y-3">
        {invites.length > 0 && (
          <p className="text-sm text-slate-600">
            Joining lets that teacher see your progress and assign you work. It also makes this a school account:
            messages, group chats and tutors turn off, and only your teacher can reach you.
          </p>
        )}
        {invites.length > 0 && (
          <ul className="space-y-2">
            {invites.map((i) => (
              <li
                key={i.classId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{i.className}</p>
                  <p className="text-sm text-slate-600">{i.teacherName ? `From ${i.teacherName}` : "From a teacher"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={busy === i.classId}
                    onClick={() => void answer(i, false)}
                    className="btn-ghost btn-sm"
                  >
                    No thanks
                  </button>
                  <button
                    type="button"
                    disabled={busy === i.classId}
                    onClick={() => void answer(i, true)}
                    className="btn-primary btn-sm"
                  >
                    Join
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {note && (
          <p role="status" className={`text-sm ${note.ok ? "text-emerald-800" : "text-red-700"}`}>
            {note.text}
          </p>
        )}
      </div>
    </section>
  );
}
