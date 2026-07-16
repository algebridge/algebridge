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
  const { user, profile, configured, signUp, signIn, signOut, syncProgress, switchRole, loading } =
    useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
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
        ? await signUp(email, password, role)
        : await signIn(email, password);

    if (err) {
      setError(err);
    } else if (configured) {
      await syncProgress();
      setMessage("Success! Your progress is synced to the cloud.");
    }
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

          {/* Role switching */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-400">
            {role !== "student" && (
              <button
                type="button"
                onClick={() => switchRole("student").then(() => setMessage("Switched to a student account."))}
                className="hover:text-slate-600"
              >
                Switch to student
              </button>
            )}
            {!isTeacher && (
              <button
                type="button"
                onClick={() => switchRole("teacher").then(() => setMessage("Switched to a teacher account."))}
                className="hover:text-slate-600"
              >
                Switch to teacher
              </button>
            )}
            {!isTutor && (
              <button
                type="button"
                onClick={() => switchRole("tutor").then(() => setMessage("Switched to a tutor account."))}
                className="hover:text-slate-600"
              >
                Switch to tutor
              </button>
            )}
          </div>

          <button type="button" onClick={() => signOut()} className="btn-secondary w-full">
            Sign Out
          </button>
          <Link href="/" className="btn-secondary block w-full text-center">
            Back to Course
          </Link>
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
