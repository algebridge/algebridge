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
import type { Profile, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signUp: (email: string, password: string, role?: UserRole) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncProgress: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  refreshProfile: (userId: string) => Promise<void>;
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

  async function signUp(email: string, password: string, role: UserRole = "student") {
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
      await setMyRole(data.user.id, role);
      await refreshProfile(data.user.id);
    }
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

  async function switchRole(role: UserRole) {
    if (!user) return;
    await setMyRole(user.id, role);
    await refreshProfile(user.id);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, configured, signUp, signIn, signOut, syncProgress, switchRole, refreshProfile }}
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
