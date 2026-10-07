"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { forgetThisDevice } from "@/lib/push";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  PROGRESS_UPDATED_EVENT,
  clearLocalProgress,
  exportProgressForSync,
  getProgress,
  importProgressFromSync,
  newerCopy,
  normalizeProgress,
  takeOtherDevicesCopy,
} from "@/lib/progress";
import { getLeaderboardSnapshot, setUnlimitedBridgeys } from "@/lib/bridgeys";
import { syncLeaderboardStats } from "@/lib/leaderboard";
import { getMyProfile, setMyRole } from "@/lib/teacher";
import { claimRole, ensureAllTutorsMembership, signAvatarUrls } from "@/lib/social";
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
  signInWithGoogleIdToken: (token: string, nonce: string, next?: string) => Promise<string | null>;
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

/**
 * Shared computers. When a student signs out, everything of theirs on this
 * device goes with them, so the next student at the same Chromebook finds
 * nothing of it:
 *   - their progress copy (clearLocalProgress);
 *   - what they typed into the calculators (kept in this browser between
 *     visits, whoever is signed in);
 *   - this tab's sign-in leftovers in sessionStorage;
 *   - everything held in memory (Archie's conversations and a crisis card
 *     among them, messages, the inbox, a managed-account flag), because
 *     signing out ends with a full page load of the home page.
 * Kept, because they are not anyone's work: device settings (sound, the
 * sidebar's width, the calculator's size, the school mode preview), the
 * signed-out notebook, and each account's own block list
 * ("algebridge:blocked:<id>"), which until the October 3 database update is
 * the only copy of a block and must still be there when that student signs
 * back in.
 */
const PERSONAL_KEYS = [
  "algebridge-calc-graphing",
  "algebridge-calc-scientific",
  "algebridge-desmos-state-graphing",
  "algebridge-desmos-state-scientific",
];

/**
 * Written when someone signs out on this device. Another open tab, or a page
 * the browser brings back from its back-forward cache, sees it and reloads,
 * so the signed-out student's screens do not come back with the Back button.
 */
export const SIGNED_OUT_KEY = "algebridge:signed-out-at";

/** When this page was loaded, to compare with SIGNED_OUT_KEY. */
const PAGE_LOADED_AT = Date.now();

/** The names typed onto certificates, one key per account (CertificateView). */
const CERTIFICATE_NAME_PREFIX = "ab-certificate-name";

function clearPersonalDeviceData(): void {
  clearLocalProgress();
  try {
    for (const key of PERSONAL_KEYS) window.localStorage.removeItem(key);
    // A student's full name, typed for a certificate, never waits for the next student.
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(CERTIFICATE_NAME_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    /* storage blocked: nothing was kept there either */
  }
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith("algebridge")) window.sessionStorage.removeItem(key);
    }
  } catch {
    /* no session storage */
  }
  try {
    window.localStorage.setItem(SIGNED_OUT_KEY, String(Date.now()));
  } catch {
    /* the other tabs will catch up on their next sign-in check */
  }
}

/** Gives up waiting after `ms`, so a dead network never traps a student signed in. */
function within<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([work, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

/**
 * Removes the Supabase session from this device without asking the server:
 * cookies and storage entries whose names start with "sb-". Used on sign-out
 * so a failed network call can never leave a student signed in on a shared
 * computer.
 */
export function forgetSessionOnDevice(): void {
  if (typeof document === "undefined") return;
  try {
    for (const part of document.cookie.split(";")) {
      const name = part.split("=")[0]?.trim();
      if (!name || !name.startsWith("sb-")) continue;
      const expire = `${name}=; Max-Age=0; path=/`;
      document.cookie = expire;
      document.cookie = `${expire}; domain=${location.hostname}`;
      const parent = location.hostname.split(".").slice(-2).join(".");
      if (parent && parent !== location.hostname) document.cookie = `${expire}; domain=.${parent}`;
    }
  } catch {
    /* cookies unavailable */
  }
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of Object.keys(store)) if (key.startsWith("sb-")) store.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();
  /** The current display name, for the autosave below, which outlives any one render. */
  const nameRef = useRef<string | null>(null);
  useEffect(() => {
    nameRef.current = profile?.displayName ?? null;
  }, [profile]);
  /**
   * Whose cloud progress this browser holds. Set once that account's copy has
   * been read, and it is what lets the autosave write: a browser that has not
   * loaded an account's progress yet must never upload over it.
   */
  const loadedFor = useRef<string | null>(null);
  const loadingFor = useRef<string | null>(null);
  /** The session's token, kept where a closing tab can reach it without waiting. */
  const tokenRef = useRef<string | null>(null);
  /** Progress changed since the last upload that succeeded. */
  const dirtyRef = useRef(false);
  /**
   * The cloud copy's updated_at as this tab last read or wrote it, and when it
   * last looked. A tab left open since yesterday still holds yesterday's copy,
   * and its next save used to go up over everything done on another device
   * since; a different updated_at in the cloud means another device saved.
   */
  const cloudSeenRef = useRef<string | null>(null);
  const cloudCheckedRef = useRef(0);
  /** The account whose saved progress has been read, as state so pages re-render. */
  const [progressFor, setProgressFor] = useState<string | null>(null);

  async function refreshProfile(userId: string) {
    const p = await getMyProfile(userId);
    // The photo as a signed link, which still opens once the avatars bucket
    // is private (supabase/schema-2026-10-03-safety.sql). A photo that cannot
    // be signed is dropped and initials show; a failed signing call keeps the
    // stored link, which works while the bucket is public.
    if (p?.avatarUrl) {
      const [shown] = await signAvatarUrls([p.avatarUrl]);
      p.avatarUrl = shown;
    }
    setProfile(p);
  }

  // A sign-out in another tab, or this page coming back from the browser's
  // back-forward cache after a sign-out: load the home page fresh rather than
  // show the signed-out student's screens.
  useEffect(() => {
    const signedOutSinceLoad = () => {
      try {
        return Number(window.localStorage.getItem(SIGNED_OUT_KEY)) > PAGE_LOADED_AT;
      } catch {
        return false;
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && signedOutSinceLoad()) window.location.reload();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIGNED_OUT_KEY && e.newValue && tokenRef.current) window.location.assign("/");
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

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
      tokenRef.current = session?.access_token ?? null;
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
      tokenRef.current = session?.access_token ?? null;
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

  /**
   * Reads the account's cloud copy, trying three times, and keeps whichever
   * of it and this browser's copy is newer. Returns false only when the read
   * failed every time, in which case the autosave stays off until a later
   * read succeeds: this browser must never write over progress it has not
   * seen.
   */
  async function loadCloudProgress(userId: string): Promise<boolean> {
    if (!configured) return false;
    const supabase = createClient();
    if (!supabase) return false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt) await new Promise((r) => setTimeout(r, 600 * attempt));
      const { data, error } = await supabase
        .from(PROGRESS_TABLE)
        .select("progress_json, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) continue;
      const local = getProgress();
      const cloudAt = data?.updated_at ? String(data.updated_at) : null;
      cloudSeenRef.current = cloudAt;
      cloudCheckedRef.current = Date.now();
      if (data?.progress_json && newerCopy(local, cloudAt) === "cloud") {
        importProgressFromSync(JSON.stringify(data.progress_json), cloudAt ?? undefined);
      } else if (local.updatedAt) {
        // This browser is ahead of the cloud (an earlier upload failed, or
        // there is no row yet): send it up rather than let it drift.
        dirtyRef.current = true;
      }
      loadedFor.current = userId;
      return true;
    }
    return false;
  }

  /** Loads an account's cloud progress once, not on every auth event. */
  async function ensureCloudProgress(userId: string) {
    if (loadedFor.current === userId || loadingFor.current === userId) return;
    // A different account's work must never be carried into this one.
    if (loadedFor.current && loadedFor.current !== userId) clearLocalProgress();
    loadedFor.current = null;
    loadingFor.current = userId;
    let ok = false;
    try {
      ok = await loadCloudProgress(userId);
    } finally {
      if (loadingFor.current === userId) loadingFor.current = null;
      // A failed read still ends the wait: this browser's copy is all there is.
      setProgressFor(userId);
    }
    // Try the read again later, so a blip at load never disables saving for the session.
    if (!ok) window.setTimeout(() => void ensureCloudProgress(userId), 30_000);
  }

  /**
   * Writes this browser's copy to the account. A plain request, and marked
   * keepalive, so the browser finishes it even when the tab is closing; the
   * upsert that the client library made was dropped on close, which is how a
   * skill finished just before leaving went unsaved.
   */
  async function uploadProgress(userId: string): Promise<boolean> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const token = tokenRef.current;
    if (!url || !anon || !token) return false;
    const writtenAt = new Date().toISOString();
    try {
      const res = await fetch(`${url}/rest/v1/${PROGRESS_TABLE}?on_conflict=user_id`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: anon,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          progress_json: JSON.parse(exportProgressForSync()),
          updated_at: writtenAt,
        }),
      });
      if (res.ok) cloudSeenRef.current = writtenAt;
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Whether another device saved this account since this tab last read or
   * wrote it, and if so, taking its copy when it holds at least as much work
   * as this one (workDone). The case it is for: a tab left open overnight,
   * the next day's practice done on a school Chromebook, then one answer in
   * the old tab, which uploaded yesterday's copy over the whole day. True
   * when the cloud copy was taken, so the caller skips its upload.
   */
  async function pullIfOtherDeviceSaved(userId: string): Promise<boolean> {
    cloudCheckedRef.current = Date.now();
    const supabase = createClient();
    if (!supabase || loadedFor.current !== userId) return false;
    const head = await supabase.from(PROGRESS_TABLE).select("updated_at").eq("user_id", userId).maybeSingle();
    if (head.error) return false;
    const at = head.data?.updated_at ? String(head.data.updated_at) : null;
    const seen = cloudSeenRef.current;
    if (!at || (seen && Date.parse(at) === Date.parse(seen))) return false;
    const { data, error } = await supabase.from(PROGRESS_TABLE).select("progress_json, updated_at").eq("user_id", userId).maybeSingle();
    if (error || !data?.progress_json || loadedFor.current !== userId) return false;
    const cloudAt = String(data.updated_at);
    cloudSeenRef.current = cloudAt;
    if (!takeOtherDevicesCopy(getProgress(), normalizeProgress(data.progress_json as never))) return false;
    importProgressFromSync(JSON.stringify(data.progress_json), cloudAt);
    dirtyRef.current = false;
    return true;
  }

  // Autosave. Progress used to reach the account only at sign-in, sign-out and
  // on the leaderboard page, so a practice session lived in this one browser
  // until then, and a teacher's roster showed stale work. Now every change is
  // written a moment after it happens, and straight away when the tab hides.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!configured || !userId) return;
    let timer: number | undefined;
    let retry: number | undefined;
    let inFlight = false;
    const upload = () => {
      if (!dirtyRef.current || inFlight || loadedFor.current !== userId) return;
      inFlight = true;
      dirtyRef.current = false;
      void uploadProgress(userId).then((ok) => {
        inFlight = false;
        if (ok) {
          // The leaderboard row rides along with every save, so rankings
          // follow what students do rather than waiting for a sync button.
          void syncLeaderboardStats(userId, nameRef.current, getLeaderboardSnapshot(getProgress()));
          return;
        }
        // Kept as unsaved, and tried again shortly (and on the next change).
        dirtyRef.current = true;
        window.clearTimeout(retry);
        retry = window.setTimeout(flush, 8_000);
      });
    };
    // A tab that has not compared with the cloud for a minute does so before
    // its upload. A closing tab (pagehide, hidden) cannot wait for that, and
    // sends at once: the check on its return (below) covers what it missed.
    const flush = () => {
      window.clearTimeout(timer);
      timer = undefined;
      if (!dirtyRef.current || inFlight || loadedFor.current !== userId) return;
      if (Date.now() - cloudCheckedRef.current < 60_000) return upload();
      inFlight = true;
      void pullIfOtherDeviceSaved(userId)
        .catch(() => false)
        .then((took) => {
          inFlight = false;
          if (!took) upload();
        });
    };
    const schedule = () => {
      dirtyRef.current = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, 2500);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        window.clearTimeout(timer);
        timer = undefined;
        upload();
      } else if (!inFlight) {
        // Back to this tab: before the student answers anything here, take
        // what another device saved in the meantime.
        inFlight = true;
        void pullIfOtherDeviceSaved(userId)
          .catch(() => false)
          .then(() => {
            inFlight = false;
            if (dirtyRef.current) schedule();
          });
      }
    };
    // Anything that arrived before the cloud copy was read goes up once it has been.
    const catchUp = window.setInterval(flush, 20_000);
    window.addEventListener(PROGRESS_UPDATED_EVENT, schedule);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", upload);
    window.addEventListener("online", flush);
    return () => {
      window.removeEventListener(PROGRESS_UPDATED_EVENT, schedule);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", upload);
      window.removeEventListener("online", flush);
      window.clearInterval(catchUp);
      window.clearTimeout(retry);
      // Leaving (or signing out) sends what is pending as it is: no cloud
      // read that could land after the student has gone.
      window.clearTimeout(timer);
      upload();
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
    // The cloud now holds exactly this copy, so the autosave can start.
    loadedFor.current = data.user.id;

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

  /**
   * Google's own button hands back a signed ID token; Supabase turns it into a
   * session. The popup runs on learn.algebridge.org, so Google says "to
   * continue to learn.algebridge.org" instead of the Supabase address.
   */
  async function signInWithGoogleIdToken(token: string, nonce: string, next?: string): Promise<string | null> {
    const supabase = createClient();
    if (!supabase) return "Cloud login is not configured yet.";
    try {
      window.sessionStorage.setItem(OAUTH_PENDING_KEY, next ?? "");
    } catch {}
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token, nonce });
    if (error) {
      try {
        window.sessionStorage.removeItem(OAUTH_PENDING_KEY);
      } catch {}
      return error.message;
    }
    if (data.session) {
      tokenRef.current = data.session.access_token;
      setUser(data.session.user);
      void ensureCloudProgress(data.session.user.id);
      await refreshProfile(data.session.user.id);
    }
    return null;
  }

  async function deleteAccount(): Promise<string | null> {
    const supabase = createClient();
    if (!supabase) return "Cloud accounts are not configured.";
    const { error } = await supabase.rpc("delete_user");
    if (error) return error.message;
    tokenRef.current = null;
    loadedFor.current = null;
    setUser(null);
    setProfile(null);
    clearPersonalDeviceData();
    await supabase.auth.signOut({ scope: "local" });
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
    // Their work goes to the cloud first, then nothing of theirs stays here
    // (clearPersonalDeviceData). A slow network gets a few seconds, never a
    // student stuck signed in on a shared computer.
    try {
      await within(syncProgress(), 5000);
    } catch {
      /* not saved now; the autosave already sent everything but the last moments */
    }
    // This device stops getting their messages and calls (a shared computer).
    await within(forgetThisDevice(), 3000).catch(() => undefined);
    const supabase = createClient();
    if (supabase) {
      try {
        // The server-side sign-out can fail offline, and then supabase-js keeps
        // the session; the local sign-out always ends it on this device.
        const result = await within(supabase.auth.signOut(), 5000);
        if (!result || result.error) await supabase.auth.signOut({ scope: "local" });
      } catch {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
    }
    // Even the "local" sign-out in supabase-js calls the server and keeps the
    // session when that call fails (auth-js 2.110), so the session itself is
    // removed from this device by hand: every sb-* cookie (the SSR client keeps
    // the token there, sometimes in chunks) and every sb-* storage key.
    forgetSessionOnDevice();
    tokenRef.current = null;
    loadedFor.current = null;
    setUser(null);
    setProfile(null);
    clearPersonalDeviceData();
    // A full load of the home page: no screen, cache or conversation of the
    // signed-out student survives in memory for the next person.
    window.location.assign("/");
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

  // The shop's allowance follows the profile the database handed back, so it
  // is on for every one of the founder's accounts and off the moment anyone
  // else signs in on the same browser.
  // Admin accounts count too (the database vouches for admin through
  // is_admin()), so the founder's accounts have it before the migration that
  // adds the column has been run, and any account he names gets it after.
  useEffect(() => {
    setUnlimitedBridgeys(!!user && !!profile && (profile.unlimitedBridgeys || profile.isAdmin));
  }, [user, profile]);

  // A signed-in account whose stored name is still auto-generated (or was
  // never loaded) can browse, but not practice, until it's a real name.
  const needsRealName = !!user && !!profile && !isRealName(profile.displayName);
  const progressLoaded = !configured || (!loading && !user) || (!!user && progressFor === user.id);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, configured, needsRealName, progressLoaded, signUp, signIn, signInWithGoogle, signInWithGoogleIdToken, signOut, syncProgress, switchRole, refreshProfile, saveRealName, deleteAccount }}
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
