"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  exportProgressForSync,
  importProgressFromSync,
} from "@/lib/progress";
import { joinClassByCode } from "@/lib/teacher";
import type { UserRole } from "@/types";

export default function LoginPage() {
  const {
    user, profile, configured, signUp, signIn, signInWithGoogle, signOut,
    syncProgress, switchRole, deleteAccount, loading,
  } = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [roleCode, setRoleCode] = useState("");
  const [switchCode, setSwitchCode] = useState("");
  const [switchFeedback, setSwitchFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const err =
      mode === "signup"
        ? await signUp(email, password, role, roleCode.trim() || undefined)
        : await signIn(email, password);

    if (err) {
      setError(err);
    } else if (configured) {
      await syncProgress();
      setMessage("Success! Your progress is synced to the cloud.");
    }
  }

  async function handleGoogle() {
    setError("");
    const err = await signInWithGoogle();
    if (err) setError(err);
  }

  async function handleSwitch(target: UserRole) {
    setError("");
    setMessage("");
    setSwitchFeedback(null);
    const isAdmin = profile?.isAdmin ?? false;
    const code = switchCode.trim();
    // Teacher/tutor need an access code (admins are exempt). Catch the empty
    // case up front so the user gets a clear prompt instead of "nothing happens".
    if (!isAdmin && target !== "student" && !code) {
      setSwitchFeedback({ ok: false, text: `Enter the ${target} access code above first.` });
      return;
    }
    setSwitching(true);
    const err = await switchRole(target, code || undefined);
    setSwitching(false);
    if (err) {
      setSwitchFeedback({ ok: false, text: err });
    } else {
      setSwitchFeedback({ ok: true, text: `You're now a ${target}! 🎉` });
      setSwitchCode("");
    }
  }

  async function handleDeleteAccount() {
    if (
      !window.confirm(
        "Delete your account permanently? This erases your progress, messages, and profile. This cannot be undone."
      )
    )
      return;
    const err = await deleteAccount();
    if (err) setError(err);
    else setMessage("Your account has been deleted.");
  }

  async function handleJoinClass(e: React.FormEvent) {
    e.preventDefault();
    setJoinMessage("");
    const { className, error: joinError } = await joinClassByCode(joinCode);
    if (joinError) {
      setJoinMessage(joinError);
    } else {
      setJoinMessage(`Joined "${className}"! Your teacher can now see your progress.`);
      setJoinCode("");
    }
  }

  function handleExportProgress() {
    const data = exportProgressForSync();
    navigator.clipboard.writeText(data);
    setMessage("Progress copied to clipboard!");
  }

  function handleImportProgress() {
    const data = prompt("Paste your saved progress JSON:");
    if (data && importProgressFromSync(data)) {
      setMessage("Progress restored successfully!");
    } else if (data) {
      setError("Invalid progress data.");
    }
  }

  if (loading) {
    return <p className="text-center text-slate-500">Loading…</p>;
  }

  if (user) {
    const role = profile?.role ?? "student";
    const isTeacher = role === "teacher";
    const isTutor = role === "tutor";
    const isAdmin = profile?.isAdmin ?? false;
    const roleBadge =
      isTutor ? "👩‍🏫 Tutor account" : isTeacher ? "🧑‍🏫 Teacher account" : "🎓 Student account";
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <Image src="/brand/logo-icon.png" alt="AlgeBridge" width={56} height={56} className="mx-auto" />
          <h1 className="mt-3 font-display text-2xl tracking-wide text-slate-900">Your Account</h1>
          <p className="mt-2 text-slate-600">{user.email}</p>
          {profile && (
            <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {roleBadge}
            </span>
          )}
          {isAdmin && (
            <span className="ml-2 mt-2 inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
              ⭐ Admin
            </span>
          )}
        </div>
        <div className="card space-y-4">
          <p className="text-sm text-emerald-700">
            ✓ Signed in — your bridge progress syncs to the cloud automatically.
          </p>
          <button
            type="button"
            onClick={() => syncProgress().then(() => setMessage("Progress synced!"))}
            className="btn-primary w-full"
          >
            Sync Progress Now
          </button>

          <Link href="/profile" className="btn-secondary block w-full text-center">
            ⚙️ Edit Profile {isTutor && "& Photo"}
          </Link>
          <Link href="/messages" className="btn-secondary block w-full text-center">
            💬 Messages
          </Link>
          <Link href="/groups" className="btn-secondary block w-full text-center">
            👥 Group Chats
          </Link>

          {isTutor && (
            <Link href="/tutor-hub" className="btn-secondary block w-full text-center">
              👩‍🏫 Go to Tutor Hub
            </Link>
          )}
          {isTeacher && (
            <Link href="/teacher" className="btn-secondary block w-full text-center">
              🧑‍🏫 Go to Teacher Dashboard
            </Link>
          )}
          {!isTutor && (
            <Link href="/tutors" className="btn-secondary block w-full text-center">
              🔎 Find a Tutor
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className="btn-secondary block w-full text-center">
              ⭐ Admin Panel
            </Link>
          )}

          {/* Role switching. Teacher/tutor need an access code (admins don't). */}
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">Switch account type</p>
            {!isAdmin && (
              <input
                value={switchCode}
                onChange={(e) => setSwitchCode(e.target.value)}
                placeholder="Access code (for teacher/tutor)"
                aria-label="Role access code"
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
              />
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {role !== "student" && (
                <button type="button" disabled={switching} onClick={() => handleSwitch("student")} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50">
                  🎓 Student
                </button>
              )}
              {!isTeacher && (
                <button type="button" disabled={switching} onClick={() => handleSwitch("teacher")} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50">
                  🧑‍🏫 Teacher
                </button>
              )}
              {!isTutor && (
                <button type="button" disabled={switching} onClick={() => handleSwitch("tutor")} className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50">
                  👩‍🏫 Tutor
                </button>
              )}
            </div>
            {switching && <p className="mt-2 text-xs text-slate-400">Switching…</p>}
            {switchFeedback && (
              <p className={`mt-2 text-xs font-medium ${switchFeedback.ok ? "text-emerald-600" : "text-red-600"}`}>
                {switchFeedback.text}
              </p>
            )}
          </div>

          <button type="button" onClick={() => signOut()} className="btn-secondary w-full">
            Sign Out
          </button>
          <Link href="/" className="btn-secondary block w-full text-center">
            Back to Course
          </Link>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="w-full text-center text-xs text-red-400 hover:text-red-600"
          >
            Delete my account
          </button>
        </div>

        {!isTeacher && (
          <div className="card space-y-3">
            <h2 className="font-bold text-slate-900">Join a Class</h2>
            <p className="text-sm text-slate-600">
              Ask your teacher for their 6-character class code so they can track your progress.
            </p>
            <form onSubmit={handleJoinClass} className="flex gap-2">
              <label htmlFor="join-code" className="sr-only">
                Class code
              </label>
              <input
                id="join-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                aria-label="Class code"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 uppercase tracking-widest focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
              />
              <button type="submit" className="btn-primary shrink-0">
                Join
              </button>
            </form>
            {joinMessage && <p className="text-sm text-bridge-800">{joinMessage}</p>}
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>
        )}
        {message && (
          <p className="rounded-xl bg-bridge-50 p-3 text-sm text-bridge-800">{message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div className="text-center">
        <Image src="/brand/logo-icon.png" alt="AlgeBridge" width={56} height={56} className="mx-auto" />
        <h1 className="mt-3 font-display text-2xl tracking-wide text-slate-900">
          {mode === "signup" ? "Create Free Account" : "Sign In"}
        </h1>
        <p className="mt-2 text-slate-600">
          Save your bridge progress across devices. Always free.
        </p>
      </div>

      <div className="card">
        {!configured && (
          <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Cloud login isn&apos;t configured yet. Your progress is saved locally
            in this browser. Ask your developer to add Supabase keys, or use
            export/import below.
          </div>
        )}

        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "signup"
                ? "bg-white text-bridge-700 shadow-sm"
                : "text-slate-600"
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "signin"
                ? "bg-white text-bridge-700 shadow-sm"
                : "text-slate-600"
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium text-slate-700">I am a…</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {([
                  ["student", "🎓 Student"],
                  ["teacher", "🧑‍🏫 Teacher"],
                  ["tutor", "👩‍🏫 Tutor"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition ${
                      role === value
                        ? "border-bridge-500 bg-bridge-50 text-bridge-700"
                        : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {role === "tutor" && (
                <p className="mt-2 text-xs text-slate-500">
                  Tutors get a profile, can see all students, message them, and run video calls.
                </p>
              )}
              {role !== "student" && (
                <div className="mt-3">
                  <label htmlFor="role-code" className="block text-sm font-medium text-slate-700">
                    {role === "tutor" ? "Tutor" : "Teacher"} access code
                  </label>
                  <input
                    id="role-code"
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
                    placeholder="Enter the code you were given"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {role === "tutor" ? "Tutor" : "Teacher"} accounts are verified with a code to
                    keep students safe.
                  </p>
                </div>
              )}
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!configured}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200 disabled:bg-slate-100"
              placeholder="you@school.edu"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={!configured}
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200 disabled:bg-slate-100"
              placeholder="At least 8 characters"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={!configured}>
            {mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
        </div>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={!configured}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
          </svg>
          Continue with Google
        </button>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>
        )}
        {message && (
          <p className="mt-4 rounded-xl bg-bridge-50 p-3 text-sm text-bridge-800">{message}</p>
        )}
      </div>

      <div className="card border-dashed">
        <h2 className="font-bold text-slate-900">Continue without an account</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your progress is automatically saved in this browser.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={handleExportProgress} className="btn-secondary text-sm">
            Export Progress
          </button>
          <button type="button" onClick={handleImportProgress} className="btn-secondary text-sm">
            Import Progress
          </button>
          <Link href="/" className="btn-primary text-sm">
            Keep Learning →
          </Link>
        </div>
      </div>
    </div>
  );
}
