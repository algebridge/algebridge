"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { loadManagedFlag, updateMyProfile, uploadAvatar } from "@/lib/social";
import { answerClassInvite, getMyClassInvites, type ClassInvite } from "@/lib/teacher";
import { setManagedAccount } from "@/lib/school-mode";
import { useSchoolMode } from "@/components/SchoolModePanel";
import { InterestsPicker } from "@/components/InterestsPicker";
import { getInterests } from "@/lib/progress";
import type { InterestProfile } from "@/lib/interests";
import { Icon } from "@/components/Icon";

export default function ProfilePage() {
  const { user, profile, loading, configured, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Read after mount: interests live in this browser's copy of the progress.
  const [interests, setInterests] = useState<InterestProfile | null | undefined>(undefined);
  useEffect(() => setInterests(getInterests()), []);
  // School mode turns messages and tutors off (src/lib/school-mode.ts).
  const school = useSchoolMode();

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setBio(profile.bio ?? "");
      setAvatarUrl(profile.avatarUrl ?? null);
    }
  }, [profile]);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="page-title">Your Profile</h1>
        <p className="text-slate-600">Sign in to set up your profile and photo.</p>
        <Link href="/login" className="btn-primary inline-block">Sign in</Link>
      </div>
    );
  }

  const isTutor = profile?.role === "tutor";

  async function handleSave() {
    setSaving(true);
    setErr("");
    setMsg("");
    const { error } = await updateMyProfile({ displayName: displayName.trim(), bio: bio.trim() });
    setSaving(false);
    if (error) return setErr(error);
    await refreshProfile(user!.id);
    setMsg("Profile saved.");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr("");
    setMsg("");
    const { url, error } = await uploadAvatar(file);
    setUploading(false);
    if (error) return setErr(error);
    setAvatarUrl(url);
    await refreshProfile(user!.id);
    setMsg("Photo updated!");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="page-title">Your Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isTutor
            ? "Students see this on the Tutors page, add a friendly photo and bio."
            : school
              ? "Add a photo and a short bio so your teacher knows who you are."
              : "Add a photo and a short bio so tutors know who they're helping."}
        </p>
      </div>

      {!configured && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Cloud accounts aren&apos;t configured, so profile changes can&apos;t be saved.
        </div>
      )}

      {configured && profile?.role === "student" && <ClassInvites userId={user.id} />}

      <div className="card space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <Avatar name={displayName || profile?.displayName} url={avatarUrl} size={80} />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !configured}
              className="btn-secondary"
            >
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            <p className="mt-1 text-xs text-slate-500">JPG or PNG, up to 5 MB.</p>
          </div>
        </div>

        {/* Display name */}
        <div>
          <label htmlFor="dn" className="block text-sm font-medium text-slate-700">
            Display name
          </label>
          <input
            id="dn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
            placeholder="Your name"
          />
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-slate-700">
            {isTutor ? "About you (shown to students)" : "Short bio"}
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={400}
            rows={4}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
            placeholder={
              isTutor
                ? "e.g. Algebra 1 tutor, 3 years experience. I love making word problems click!"
                : "e.g. 8th grader working on linear equations."
            }
          />
          <p className="mt-1 text-right text-xs text-slate-500">{bio.length}/400</p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !configured}
          className="btn-primary w-full"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>

        {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{err}</p>}
        {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>}
      </div>

      {!isTutor && interests !== undefined && (
        <div id="interests" className="panel scroll-mt-24">
          <div className="panel-head">
            <p className="panel-title">What you&apos;re into</p>
            <span className="badge-brand">Sets your practice problems</span>
          </div>
          <div className="panel-body">
            <InterestsPicker initial={interests} showHeading={false} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!school && (
          <Link href="/messages" className="btn-secondary">
            <Icon name="messages" size={16} />
            Messages
          </Link>
        )}
        {!school &&
          (isTutor ? (
            <Link href="/tutor-hub" className="btn-secondary">
              <Icon name="students" size={16} />
              Tutor Hub
            </Link>
          ) : (
            <Link href="/tutors" className="btn-secondary">
              <Icon name="search" size={16} />
              Find a tutor
            </Link>
          ))}
        <Link href="/" className="btn-secondary">Back to the course</Link>
      </div>
    </div>
  );
}

/**
 * Classes a teacher invited this student to. Once
 * supabase/schema-2026-10-03-safety.sql has run, a teacher who adds a student
 * by email sends an invite, and the student is on the roster only after
 * saying yes here. Before it runs, there are no invites and nothing shows.
 */
function ClassInvites({ userId }: { userId: string }) {
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
            <li key={i.classId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{i.className}</p>
                <p className="text-sm text-slate-600">{i.teacherName ? `From ${i.teacherName}` : "From a teacher"}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={busy === i.classId} onClick={() => void answer(i, false)} className="btn-ghost btn-sm">
                  No thanks
                </button>
                <button type="button" disabled={busy === i.classId} onClick={() => void answer(i, true)} className="btn-primary btn-sm">
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
