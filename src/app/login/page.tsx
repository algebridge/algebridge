"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/lib/auth";
import { exportProgressForSync, importProgressFromSync } from "@/lib/progress";
import { checkFullName } from "@/lib/name";
import { RealNameForm } from "@/components/RealNameForm";
import type { UserRole } from "@/types";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-sm text-slate-500">Loading…</p>}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const {
    user, profile, configured, needsRealName, signUp, signIn, signInWithGoogle,
    signOut, syncProgress, switchRole, deleteAccount, loading,
  } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  const [mode, setMode] = useState<"signup" | "signin">(
    params.get("mode") === "signin" ? "signin" : "signup"
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [roleCode, setRoleCode] = useState("");
  const [switchCode, setSwitchCode] = useState("");
  const [switchFeedback, setSwitchFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (mode === "signup") {
      const check = checkFullName(`${firstName} ${lastName}`);
      if (!check.ok) {
        setError(check.error);
        return;
      }
      setSubmitting(true);
      const err = await signUp(email, password, check.formatted, role, roleCode.trim() || undefined);
      setSubmitting(false);
      if (err) {
        setError(err);
        return;
      }
      await syncProgress();
      if (next) router.push(next);
      else setMessage("You're all set, your progress now saves to your account.");
      return;
    }

    setSubmitting(true);
    const err = await signIn(email, password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    await syncProgress();
    if (next) router.push(next);
    else setMessage("Signed in. Your progress is synced.");
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
      setSwitchFeedback({ ok: true, text: `Your account is now a ${target} account.` });
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

  function handleExportProgress() {
    navigator.clipboard.writeText(exportProgressForSync());
    setMessage("Progress copied to clipboard.");
  }

  function handleImportProgress() {
    const data = prompt("Paste your saved progress JSON:");
    if (data && importProgressFromSync(data)) setMessage("Progress restored.");
    else if (data) setError("That progress data couldn't be read.");
  }

  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-500">Loading…</p>;
  }

  // ---- Signed in: account settings ----------------------------------
  if (user) {
    const currentRole = profile?.role ?? "student";
    const isTeacher = currentRole === "teacher";
    const isTutor = currentRole === "tutor";
    const isAdmin = profile?.isAdmin ?? false;
    const roleLabel = isTutor ? "Tutor" : isTeacher ? "Teacher" : "Student";

    return (
      <div className="mx-auto max-w-xl space-y-5">
        <header>
          <p className="eyebrow">Account</p>
          <h1 className="page-title">{profile?.displayName ?? "Your account"}</h1>
          <p className="page-subtitle">{user.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="badge-neutral">{roleLabel} account</span>
            {isAdmin && <span className="badge-brand">Admin</span>}
          </div>
        </header>

        {needsRealName && (
          <div className="panel border-amber-200">
            <div className="panel-head border-amber-200 bg-amber-50">
              <p className="panel-title text-amber-900">Add your real name</p>
            </div>
            <div className="panel-body space-y-3">
              <p className="text-sm text-slate-600">
                AlgeBridge uses real names so teachers can find you on a roster and
                tutors know who they&apos;re helping. Practice stays locked until this
                is set.
              </p>
              <RealNameForm />
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-head">
            <p className="panel-title">Your progress</p>
            <span className="badge-success">Syncing</span>
          </div>
          <div className="panel-body space-y-3">
            <p className="text-sm text-slate-600">
              Everything you complete is saved to your account and available on any
              device you sign in on.
            </p>
            <button
              type="button"
              onClick={() => syncProgress().then(() => setMessage("Progress synced."))}
              className="btn-secondary"
            >
              Sync now
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <p className="panel-title">Go to</p>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            <Link href="/profile" className="btn-secondary justify-start">Edit profile</Link>
            <Link href="/messages" className="btn-secondary justify-start">Messages</Link>
            <Link href="/groups" className="btn-secondary justify-start">Group chats</Link>
            {isTeacher ? (
              <Link href="/teacher" className="btn-secondary justify-start">Teacher dashboard</Link>
            ) : (
              <Link href="/classes" className="btn-secondary justify-start">My classes</Link>
            )}
            {isTutor ? (
              <Link href="/tutor-hub" className="btn-secondary justify-start">Tutor hub</Link>
            ) : (
              <Link href="/tutors" className="btn-secondary justify-start">Find a tutor</Link>
            )}
            {isAdmin && (
              <Link href="/admin" className="btn-secondary justify-start">Admin panel</Link>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <p className="panel-title">Account type</p>
          </div>
          <div className="panel-body space-y-3">
            <p className="text-sm text-slate-600">
              Teacher and tutor accounts are verified with an access code so students
              stay safe.
            </p>
            {!isAdmin && (
              <input
                value={switchCode}
                onChange={(e) => setSwitchCode(e.target.value)}
                placeholder="Access code"
                aria-label="Role access code"
                className="field"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {currentRole !== "student" && (
                <button type="button" disabled={switching} onClick={() => handleSwitch("student")} className="btn-secondary btn-sm">
                  Switch to student
                </button>
              )}
              {!isTeacher && (
                <button type="button" disabled={switching} onClick={() => handleSwitch("teacher")} className="btn-secondary btn-sm">
                  Switch to teacher
                </button>
              )}
              {!isTutor && (
                <button type="button" disabled={switching} onClick={() => handleSwitch("tutor")} className="btn-secondary btn-sm">
                  Switch to tutor
                </button>
              )}
            </div>
            {switching && <p className="text-xs text-slate-400">Switching…</p>}
            {switchFeedback && (
              <p className={`text-sm ${switchFeedback.ok ? "text-emerald-700" : "text-red-600"}`}>
                {switchFeedback.text}
              </p>
            )}
          </div>
        </div>

        {error && <p className="notice-error">{error}</p>}
        {message && <p className="notice-success">{message}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button type="button" onClick={() => signOut()} className="btn-secondary">
            Sign out
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="text-xs text-slate-400 transition hover:text-red-600"
          >
            Delete my account
          </button>
        </div>
      </div>
    );
  }

  // ---- Signed out: sign up / sign in --------------------------------
  return (
    <div className="mx-auto max-w-md space-y-5 py-2">
      <div className="text-center">
        <Image src="/brand/logo-icon.png" alt="AlgeBridge" width={48} height={48} className="mx-auto" />
        <h1 className="page-title mt-3">
          {mode === "signup" ? "Create your free account" : "Welcome back"}
        </h1>
        <p className="page-subtitle mx-auto">
          {mode === "signup"
            ? "An account is what turns lessons into progress: practice is saved, your teacher can see it, and it follows you between devices."
            : "Sign in to pick up exactly where you left off."}
        </p>
      </div>

      <div className="panel">
        <div className="panel-body">
          {!configured && (
            <div className="notice-warn mb-4">
              Cloud accounts aren&apos;t configured on this deployment, so progress is
              saved in this browser only.
            </div>
          )}

          <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                mode === "signin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <span className="label">I am a…</span>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {([
                      ["student", "Student"],
                      ["teacher", "Teacher"],
                      ["tutor", "Tutor"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRole(value)}
                        className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition ${
                          role === value
                            ? "border-bridge-500 bg-bridge-50 text-bridge-700"
                            : "border-slate-300 text-slate-600 hover:border-slate-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {role !== "student" && (
                    <div className="mt-3">
                      <label htmlFor="role-code" className="label">
                        {role === "tutor" ? "Tutor" : "Teacher"} access code
                      </label>
                      <input
                        id="role-code"
                        value={roleCode}
                        onChange={(e) => setRoleCode(e.target.value)}
                        className="field mt-1"
                        placeholder="Enter the code you were given"
                      />
                      <p className="field-hint">
                        {role === "tutor" ? "Tutor" : "Teacher"} accounts are verified with a
                        code to keep students safe.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="first-name" className="label">
                      First name
                    </label>
                    <input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      autoComplete="given-name"
                      disabled={!configured}
                      className="field mt-1"
                      placeholder="Maria"
                    />
                  </div>
                  <div>
                    <label htmlFor="last-name" className="label">
                      Last name
                    </label>
                    <input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      autoComplete="family-name"
                      disabled={!configured}
                      className="field mt-1"
                      placeholder="Alvarez"
                    />
                  </div>
                </div>
                <p className="-mt-2 text-xs text-slate-500">
                  Use your real name, not a username, it&apos;s how your teacher finds
                  you on the roster and how tutors greet you on a call.
                </p>
              </>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={!configured}
                className="field mt-1"
                placeholder="you@school.edu"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                disabled={!configured}
                className="field mt-1"
                placeholder="At least 8 characters"
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={!configured || submitting}>
              {submitting
                ? "Working…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={!configured}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
            Continue with Google
          </button>

          {error && <p className="notice-error mt-4">{error}</p>}
          {message && <p className="notice-success mt-4">{message}</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-900">Just looking around?</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Every lesson video is free to watch without an account. Practice, progress
          tracking and classes need one.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/" className="btn-secondary btn-sm">
            Browse the course
          </Link>
          <button type="button" onClick={handleExportProgress} className="btn-ghost btn-sm">
            Export local progress
          </button>
          <button type="button" onClick={handleImportProgress} className="btn-ghost btn-sm">
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
