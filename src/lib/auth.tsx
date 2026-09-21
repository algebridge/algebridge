"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  exportProgressForSync,
  importProgressFromSync,
  clearLocalProgress,
  getProgress,
  PROGRESS_UPDATED_EVENT,
} from "@/lib/progress";
import { getLeaderboardSnapshot } from "@/lib/bridgeys";
import { syncLeaderboardStats } from "@/lib/leaderboard";
import { getMyProfile, setMyRole } from "@/lib/teacher";
import { claimRole, ensureAllTutorsMembership } from "@/lib/social";
import { setDisplayName } from "@/lib/profile";
import { checkFullName, isRealName } from "@/lib/name";
import type { Profile, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  /**
   * Signed in, but the account is still carrying an auto-generated name (older
   * accounts got the email prefix). Practice is blocked until it's a real name.
   */
  needsRealName: boolean;
  /**
   * The account's saved progress has been read (or there is no account). The
   * learning path waits for it, so a returning student never sees their
   * skills flash locked while their work is still loading.
   */
  progressLoaded: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: UserRole,
    code?: string
  ) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: (next?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncProgress: () => Promise<void>;
  switchRole: (role: UserRole, code?: string) => Promise<string | null>;
  refreshProfile: (userId: string) => Promise<void>;
  saveRealName: (fullName: string) => Promise<string | null>;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROGRESS_TABLE = "user_progress";

/**
 * Where an in-flight Google sign-in wants to land, held across the redirect.
 *
 * The OAuth round trip unloads the page, so everything handleSubmit does after
 * an email sign-in (sync the local progress, honour ?next=) is simply skipped
 * on the Google path unless it is picked up again on the way back. Its presence
 * is also the "we just came back from Google" flag: an empty string means
 * signed in with no particular destination.
 *
 * sessionStorage rather than the redirect URL, so Supabase's redirect
 * allow-list only ever needs the one exact /login entry, with no query string.
 */
export const OAUTH_PENDING_KEY = "algebridge-oauth-pending";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();
  /**
   * Whose cloud progress this browser holds. Set once that account's copy has
   * been read, and it is what lets the autosave write: a browser that has not
   * loaded an account's progress yet must never upload over it.
   */
  const loadedFor = useRef<string | null>(null);
  const loadingFor = useRef<string | null>(null);
  /** The account whose saved progress has been read, as state so pages re-render. */
  const [progressFor, setProgressFor] = useState<string | null>(null);

  async function refreshProfile(userId: string) {
    const p = await getMyProfile(userId);
    setProfile(p);
  }

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        void ensureCloudProgress(session.user.id);
        refreshProfile(session.user.id);
      }
    });

    // Supabase fires SIGNED_IN every time the tab comes back into view, and
    // TOKEN_REFRESHED about hourly. Reloading the cloud copy on each of those
    // wrote the account's older progress over this tab's newer work, so a
    // student who switched tabs mid-skill came back to find their answers
    // gone. The cloud copy is now read once per account, and kept current by
    // the autosave below.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void ensureCloudProgress(session.user.id);
        refreshProfile(session.user.id);
      } else {
        setProfile(null);
        loadedFor.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  async function loadCloudProgress(userId: string) {
    if (!configured) return;
    const supabase = createClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from(PROGRESS_TABLE)
      .select("progress_json")
      .eq("user_id", userId)
      .maybeSingle();
    // A failed read leaves loadedFor unset, which keeps the autosave from
    // writing this browser's copy over progress it never saw.
    if (error) return;

    if (data?.progress_json) {
      importProgressFromSync(JSON.stringify(data.progress_json));
    }
    loadedFor.current = userId;
  }

  /** Loads an account's cloud progress once, not on every auth event. */
  async function ensureCloudProgress(userId: string) {
    if (loadedFor.current === userId || loadingFor.current === userId) return;
    // A different account's work must never be carried into this one.
    if (loadedFor.current && loadedFor.current !== userId) clearLocalProgress();
    loadedFor.current = null;
    loadingFor.current = userId;
    try {
      await loadCloudProgress(userId);
    } finally {
      if (loadingFor.current === userId) loadingFor.current = null;
      // A failed read still ends the wait: this browser's copy is all there is.
      setProgressFor(userId);
    }
  }

  async function uploadProgress(userId: string) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from(PROGRESS_TABLE).upsert(
      {
        user_id: userId,
        progress_json: JSON.parse(exportProgressForSync()),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  }

  // Autosave. Progress used to reach the account only at sign-in, sign-out and
  // on the leaderboard page, so a practice session lived in this one browser
  // until then, and a teacher's roster showed stale work. Now every change is
  // written a moment after it happens, and straight away when the tab hides.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!configured || !userId) return;
    let timer: number | undefined;
    const flush = () => {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
      if (loadedFor.current !== userId) return;
      void uploadProgress(userId);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = -1;
        flush();
      }, 2500);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener(PROGRESS_UPDATED_EVENT, schedule);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, schedule);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, userId]);

  async function syncProgress() {
    if (!configured || !user) return;
    const supabase = createClient();
    if (!supabase) return;
    const progressJson = JSON.parse(exportProgressForSync());

    await supabase.from(PROGRESS_TABLE).upsert(
      {
        user_id: user.id,
        progress_json: progressJson,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    const snapshot = getLeaderboardSnapshot(getProgress());
    // Never fall back to the email here: the leaderboard is world-readable to
    // signed-in accounts, and an email is personal data. A missing name just
    // shows as "Anonymous Student".
    await syncLeaderboardStats(user.id, profile?.displayName ?? null, snapshot);
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = "student",
    code?: string
  ) {
    if (!configured) return "Cloud login is not configured yet. Progress is saved locally.";
    const supabase = createClient();
    if (!supabase) return "Cloud login is not configured yet. Progress is saved locally.";

    // Every AlgeBridge account is identified by a real name, so validate it
    // before creating the auth user, no half-made accounts.
    const nameCheck = checkFullName(fullName);
    if (!nameCheck.ok) return nameCheck.error;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nameCheck.formatted } },
    });
    if (error) return error.message;
    if (!data.user) return "Sign-up succeeded, but no session was returned. Try signing in.";

    // The signup trigger reads full_name from the auth metadata, but write it
    // explicitly too so the name is right even on an older database schema.
    await setDisplayName(nameCheck.formatted);

    // Upload local progress right away using the new user's id directly -
    // React's `user` state hasn't re-rendered yet at this point, so
    // syncProgress() (which reads `user` from state) would silently no-op.
    await supabase.from(PROGRESS_TABLE).upsert(
      {
        user_id: data.user.id,
        progress_json: JSON.parse(exportProgressForSync()),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    const snapshot = getLeaderboardSnapshot(getProgress());
    await syncLeaderboardStats(data.user.id, nameCheck.formatted, snapshot);

    if (role !== "student") {
      // Teacher/tutor roles are gated by an access code (checked server-side
      // in the claim_role RPC). If the code is wrong the account is still
      // created as a student and we surface the error.
      const err = await claimRole(role, code);
      await refreshProfile(data.user.id);
      if (err) return err;
    } else {
      await refreshProfile(data.user.id);
    }
    return null;
  }

  async function saveRealName(fullName: string): Promise<string | null> {
    if (!user) return "You must be signed in.";
    const err = await setDisplayName(fullName);
    if (err) return err;
    await refreshProfile(user.id);
    return null;
  }

  async function signInWithGoogle(next?: string): Promise<string | null> {
    const supabase = createClient();
    if (!supabase) return "Cloud login is not configured yet.";
    if (typeof window === "undefined") return "Google sign-in needs a browser.";

    try {
      window.sessionStorage.setItem(OAUTH_PENDING_KEY, next ?? "");
    } catch {
      // Private mode. Losing the destination is survivable, blocking the
      // sign-in over it is not.
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });

    if (error) {
      // No redirect is happening, so the flag would go stale and fire on the
      // next unrelated sign-in in this tab.
      try {
        window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
      } catch {}
      return error.message;
    }
    return null;
  }

  async function deleteAccount(): Promise<string | null> {
    const supabase = createClient();
    if (!supabase) return "Cloud accounts are not configured.";
    const { error } = await supabase.rpc("delete_user");
    if (error) return error.message;
    setUser(null);
    setProfile(null);
    clearLocalProgress();
    await supabase.auth.signOut();
    return null;
  }

  async function signIn(email: string, password: string) {
    if (!configured) return "Cloud login is not configured yet. Progress is saved locally.";
    const supabase = createClient();
    if (!supabase) return "Cloud login is not configured yet. Progress is saved locally.";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    const userId = data.user?.id;
    if (!userId) return "Sign-in succeeded, but no session was established. Please try again.";
    // Start from a clean slate so a previous user's local progress on this
    // (possibly shared) device can never be mistaken for, or synced into -
    // the account that just signed in. The account's own cloud data loads next.
    loadedFor.current = null;
    clearLocalProgress();
    loadingFor.current = userId;
    try {
      await loadCloudProgress(userId);
    } finally {
      loadingFor.current = null;
      setProgressFor(userId);
    }
    await refreshProfile(userId);
    return null;
  }

  async function signOut() {
    if (!configured) return;
    await syncProgress();
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    // Clear this device so the next person doesn't see the signed-out
    // student's progress. Their work is already safe in the cloud (synced above).
    clearLocalProgress();
  }

  async function switchRole(role: UserRole, code?: string): Promise<string | null> {
    if (!user) return "You must be signed in.";
    // Admins can switch freely; everyone else must pass the access code for
    // teacher/tutor (enforced server-side). Downgrades to student are free.
    const err = profile?.isAdmin
      ? await setMyRole(user.id, role)
      : await claimRole(role, code);
    // claim_role auto-joins tutors to the All-Tutors group; the admin path
    // (setMyRole) does not, so do it explicitly here.
    if (!err && role === "tutor" && profile?.isAdmin) {
      await ensureAllTutorsMembership();
    }
    await refreshProfile(user.id);
    return err;
  }

  // A signed-in account whose stored name is still auto-generated (or was
  // never loaded) can browse, but not practice, until it's a real name.
  const needsRealName = !!user && !!profile && !isRealName(profile.displayName);
  const progressLoaded = !configured || (!loading && !user) || (!!user && progressFor === user.id);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, configured, needsRealName, progressLoaded, signUp, signIn, signInWithGoogle, signOut, syncProgress, switchRole, refreshProfile, saveRealName, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
