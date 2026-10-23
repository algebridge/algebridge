"use client";

/**
 * Forgot password. Two halves on one page:
 *
 * 1. A student types their email and Supabase mails a link back to this page.
 * 2. The link comes back with ?code=, the browser client trades it for a
 *    session on its own (PKCE, so it only works in the browser that asked),
 *    and the student picks a new password.
 *
 * Username accounts (maria.lopez4821) have no inbox, so they are sent to
 * their teacher instead of being told a mail is on its way.
 */

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { USERNAME_DOMAIN } from "@/lib/student-accounts";
import { Icon } from "@/components/Icon";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const params = useSearchParams();
  const { user, configured } = useAuth();
  const fromLink = params.has("code");
  const linkError = params.get("error_description");

  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // The code exchange happens inside the Supabase client; give it a moment
  // before calling the link bad.
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!fromLink) return;
    const t = setTimeout(() => setWaited(true), 4000);
    return () => clearTimeout(t);
  }, [fromLink]);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const typed = email.trim().toLowerCase();
    if (!typed.includes("@") || typed.endsWith(`@${USERNAME_DOMAIN}`)) {
      setError("username");
      return;
    }
    // District mail (k12.de.us and the like) usually turns away outside
    // senders, Christina School District included, so the email would never come.
    if (/@([^@]+\.)?k12\.[a-z]{2}\.us$/.test(typed)) {
      setError("district");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(typed, {
      redirectTo: `${window.location.origin}/login/reset`,
    });
    setSubmitting(false);
    if (err && /rate|too many|seconds/i.test(err.message)) {
      setError("Too many tries in a row. Wait a minute, then try again.");
      return;
    }
    // Same answer whether or not the email has an account, so this page
    // can't be used to check who is signed up.
    setSentTo(typed);
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) {
      setError(
        /different from the old/i.test(err.message)
          ? "That's your old password. Pick a new one."
          : "That didn't save. Ask for a new link and try again."
      );
      return;
    }
    setDone(true);
  }

  let body: React.ReactNode;

  if (done) {
    body = (
      <div className="space-y-4 text-center">
        <div className="notice-success">Your password is changed and you are signed in.</div>
        <Link href="/" className="btn-primary w-full">Back to your lessons</Link>
      </div>
    );
  } else if (fromLink && user) {
    body = (
      <form onSubmit={setNewPassword} className="space-y-4">
        <p className="text-sm text-slate-600">
          Signed in as <strong>{user.email}</strong>. Pick a new password.
        </p>
        <div>
          <label htmlFor="new-password" className="label">New password</label>
          <div className="relative mt-1">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="field pr-11"
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-bridge-200"
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">Type it again</label>
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="field mt-1"
          />
        </div>
        {error && <div className="notice-error" role="alert">{error}</div>}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Saving…" : "Save new password"}
        </button>
      </form>
    );
  } else if (fromLink && !linkError && !waited) {
    body = <p className="text-center text-sm text-slate-600">Checking your link…</p>;
  } else if (fromLink || linkError) {
    body = (
      <div className="space-y-4">
        <div className="notice-warn">
          This link has expired or was opened in a different browser. Links work once, for an
          hour, in the same browser you asked from.
        </div>
        <Link href="/login/reset" className="btn-primary w-full">Send a new link</Link>
      </div>
    );
  } else if (sentTo) {
    body = (
      <div className="space-y-4">
        <div className="notice-success">
          If <strong>{sentTo}</strong> has an AlgeBridge account, a link to reset the password is
          on its way. Open it on this device.
        </div>
        <p className="text-sm text-slate-600">
          Nothing after a few minutes? Check spam, or make sure it&apos;s the email you signed up
          with. School emails sometimes block outside mail, so your teacher can help too.
        </p>
        <button type="button" onClick={() => setSentTo("")} className="btn-secondary w-full">
          Try a different email
        </button>
      </div>
    );
  } else {
    body = (
      <form onSubmit={requestLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            disabled={!configured}
            className="field mt-1"
            placeholder="you@school.edu"
          />
        </div>
        {error === "username" ? (
          <div className="notice-warn" role="alert">
            Usernames like <strong>maria.lopez4821</strong> are made by your teacher and have no
            email to send a link to. Ask your teacher: they can give you a new password from their class page.
          </div>
        ) : error === "district" ? (
          <div className="notice-warn" role="alert">
            School district email blocks messages from outside the district, so a reset link
            can&apos;t reach you. Ask your math teacher: they can give you a new password from
            their class page in a few seconds.
          </div>
        ) : (
          error && <div className="notice-error" role="alert">{error}</div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={!configured || submitting}>
          {submitting ? "Sending…" : "Email me a reset link"}
        </button>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <strong>Using a school email?</strong> Most districts block outside email. Your teacher
          can reset your password from their class page instead.
        </p>
        <p className="text-xs text-slate-500">
          Signed up with Google? There&apos;s no AlgeBridge password to reset. Use Continue with
          Google on the sign-in page.
        </p>
      </form>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 py-2">
      <div className="text-center">
        <Image src="/brand/logo-icon.png" alt="AlgeBridge" width={48} height={48} className="mx-auto" />
        <h1 className="page-title mt-3">{fromLink && user ? "Pick a new password" : "Forgot your password?"}</h1>
        {!fromLink && !sentTo && !done && (
          <p className="page-subtitle mx-auto">We&apos;ll email you a link to make a new one.</p>
        )}
      </div>
      <div className="panel">
        <div className="panel-body">{body}</div>
      </div>
      <p className="text-center text-sm text-slate-600">
        Remembered it? <Link href="/login?mode=signin" className="font-medium text-bridge-700 underline underline-offset-2">Sign in</Link>
      </p>
    </div>
  );
}
