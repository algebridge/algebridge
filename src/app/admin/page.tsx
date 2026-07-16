"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { adminDeleteUser, adminListUsers, type AdminUser } from "@/lib/social";

const ROLE_EMOJI: Record<string, string> = {
  student: "🎓",
  teacher: "🧑‍🏫",
  tutor: "👩‍🏫",
};

export default function AdminPage() {
  const { user, profile, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const isAdmin = profile?.isAdmin ?? false;

  async function refresh() {
    setUsers(await adminListUsers());
    setLoadingList(false);
  }

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  if (loading) return <p className="text-center text-slate-500">Loading…</p>;

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="font-display text-2xl text-slate-900">Admin</h1>
        <p className="text-slate-600">This area is for administrators only.</p>
        <Link href="/" className="btn-primary inline-block">Back to Course</Link>
      </div>
    );
  }

  async function handleDelete(u: AdminUser) {
    if (u.id === user!.id) {
      if (!window.confirm("This is YOUR account. Delete it permanently?")) return;
    } else if (
      !window.confirm(`Permanently delete ${u.displayName ?? u.email}? This cannot be undone.`)
    ) {
      return;
    }
    setBusy(u.id);
    setMsg("");
    const err = await adminDeleteUser(u.id);
    setBusy(null);
    if (err) setMsg(err);
    else {
      setMsg(`Deleted ${u.displayName ?? u.email}.`);
      await refresh();
    }
  }

  const filtered = users.filter(
    (u) =>
      (u.displayName ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (u.email ?? "").toLowerCase().includes(query.toLowerCase()) ||
      u.role.includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl tracking-wide text-slate-900">⭐ Admin Panel</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every account. You can message anyone or delete any account.
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, email, or role…"
        aria-label="Search users"
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-bridge-500 focus:outline-none focus:ring-2 focus:ring-bridge-200"
      />

      {msg && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{msg}</p>}

      {loadingList ? (
        <p className="text-center text-slate-400">Loading users…</p>
      ) : (
        <>
          <p className="text-xs text-slate-400">{filtered.length} of {users.length} users</p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {filtered.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={u.displayName} url={u.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {ROLE_EMOJI[u.role] ?? "🎓"} {u.displayName ?? "(no name)"}
                    {u.id === user.id && (
                      <span className="ml-1 text-xs text-slate-400">(you)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">{u.email} · {u.role}</p>
                </div>
                <Link href={`/messages/${u.id}`} className="btn-secondary text-sm" title="Message">
                  💬
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(u)}
                  disabled={busy === u.id}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  title="Delete account"
                >
                  {busy === u.id ? "…" : "🗑️"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
