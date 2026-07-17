"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  exportProgressForSync,
  importProgressFromSync,
  clearLocalProgress,
  getProgress,
} from "@/lib/progress";
import { getLeaderboardSnapshot } from "@/lib/bridgeys";
import { syncLeaderboardStats } from "@/lib/leaderboard";
import { getMyProfile, setMyRole } from "@/lib/teacher";
import { claimRole, ensureAllTutorsMembership } from "@/lib/social";
import type { Profile, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, role?: UserRole, code?: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  syncProgress: () => Promise<void>;
  switchRole: (role: UserRole, code?: string) => Promise<string | null>;
  refreshProfile: (userId: string) => Promise<void>;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROGRESS_TABLE = "user_progress";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

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
        loadCloudProgress(session.user.id);
        refreshProfile(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCloudProgress(session.user.id);
        refreshProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  async function loadCloudProgress(userId: string) {
    if (!configured) return;
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from(PROGRESS_TABLE)
      .select("progress_json")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.progress_json) {
      importProgressFromSync(JSON.stringify(data.progress_json));
    }
  }

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
    await syncLeaderboardStats(
      user.id,
      profile?.displayName ?? user.email ?? null,
      snapshot
    );
  }

  async function signUp(email: string, password: string, role: UserRole = "student", code?: string) {
    if (!configured) return "Cloud login is not configured yet. Progress is saved locally.";
    const supabase = createClient();
    if (!supabase) return "Cloud login is not configured yet. Progress is saved locally.";
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    if (!data.user) return "Sign-up succeeded, but no session was returned. Try signing in.";

    // Upload local progress right away using the new user's id directly —
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
    await syncLeaderboardStats(
      data.user.id,
      email.split("@")[0],
      snapshot
    );

    if (role !== "student") {
      // Teacher/tutor roles are gated by an access code (checked server-side
      // in the claim_role RPC). If the code is wrong the account is still
      // created as a student and we surface the error.
      const err = await claimRole(role, code);
      await refreshProfile(data.user.id);
      if (err) return err;
    }
    return null;
  }

  async function signInWithGoogle(): Promise<string | null> {
    const supabase = createClient();
    if (!supabase) return "Cloud login is not configured yet.";
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return error?.message ?? null;
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
    // (possibly shared) device can never be mistaken for — or synced into —
    // the account that just signed in. The account's own cloud data loads next.
    clearLocalProgress();
    await loadCloudProgress(userId);
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

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, configured, signUp, signIn, signInWithGoogle, signOut, syncProgress, switchRole, refreshProfile, deleteAccount }}
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
