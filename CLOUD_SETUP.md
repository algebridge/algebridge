# Turning on Cloud Accounts (5 minutes)

AlgeBridge works fully offline (progress saved in the browser), but you can turn
on **real, password-protected accounts** that sync across devices. Security is
handled by Supabase Auth (email + password) plus Postgres **Row-Level Security**,
so a student can only ever read or write *their own* data — knowing another
person's name or email is not enough to see or change their account.

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project (free tier is fine).
2. In the project, open **SQL Editor** → paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. This creates the
   `user_progress`, `profiles`, `classes`, `class_members`, and
   `leaderboard_stats` tables **with the security policies already enabled**.

## 2. Copy your keys

In Supabase → **Project Settings → API**, copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The anon key is safe to expose in the browser — RLS is what protects the data,
not the key.

## 3. Add the keys

**Local dev:** create `app/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

**Vercel:** Project → Settings → Environment Variables → add the same two, then
redeploy.

## 4. (Recommended) Require email confirmation

In Supabase → **Authentication → Providers → Email**, keep **Confirm email**
on. This stops someone from signing up as an address they don't control.

That's it — the **Sign in** page now creates and authenticates real accounts,
and progress syncs to the cloud automatically.

## How the "layer of defense" works

| Threat | What stops it |
|--------|---------------|
| Typing someone's name/email to open their account | Sign-in requires their **password**; there is no name-only login. |
| Guessing a user id and reading their progress | RLS policy `auth.uid() = user_id` — the database refuses rows that aren't yours. |
| Writing to another student's progress | RLS `with check (auth.uid() = user_id)` on insert/update. |
| A shared classroom device leaking the last student's work | On sign-out (and on the next sign-in) the browser's local progress is wiped; the cloud copy stays safe. |
| A student probing which emails are registered | The `find_student_by_email` lookup is restricted to **teacher** accounts. |
| Reading another teacher's classes/rosters | RLS scopes classes and members to `teacher_id = auth.uid()`. |
