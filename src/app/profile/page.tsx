"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { updateMyProfile, uploadAvatar } from "@/lib/social";

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
        <h1 className="font-display text-2xl text-slate-900">Your Profile</h1>
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
        <h1 className="font-display text-2xl tracking-wide text-slate-900">Your Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isTutor
            ? "Students see this on the Tutors page — add a friendly photo and bio."
            : "Add a photo and a short bio so tutors know who they're helping."}
        </p>
      </div>

      {!configured && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Cloud accounts aren&apos;t configured, so profile changes can&apos;t be saved.
        </div>
      )}

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
            <p className="mt-1 text-xs text-slate-400">JPG or PNG, up to 5 MB.</p>
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
          <p className="mt-1 text-right text-xs text-slate-400">{bio.length}/400</p>
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

      <div className="flex flex-wrap gap-2">
        <Link href="/messages" className="btn-secondary">💬 Messages</Link>
        {isTutor ? (
          <Link href="/tutor-hub" className="btn-secondary">👩‍🏫 Tutor Hub</Link>
        ) : (
          <Link href="/tutors" className="btn-secondary">🔎 Find a Tutor</Link>
        )}
        <Link href="/" className="btn-secondary">Back to Course</Link>
      </div>
    </div>
  );
}
