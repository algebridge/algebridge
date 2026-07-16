-- ============================================================
-- AlgeBridge tutor platform (2026-07)
-- Human tutors, avatars, direct messaging, per-student notebook,
-- and tutor video-call records. Run AFTER schema.sql.
-- Safe to re-run (idempotent).
-- ============================================================

-- ---- 1. profiles: allow the 'tutor' role + avatar + bio ------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'teacher', 'tutor'));
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;

-- Any signed-in user can read TUTOR profiles (so students browse tutors).
drop policy if exists "Anyone can read tutor profiles" on public.profiles;
create policy "Anyone can read tutor profiles"
  on public.profiles for select
  to authenticated
  using (role = 'tutor');

-- SECURITY DEFINER helper (bypasses RLS, so no recursion).
create or replace function public.is_tutor()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'tutor');
$$;
revoke all on function public.is_tutor() from public;
grant execute on function public.is_tutor() to authenticated;

-- Tutors can read ALL student profiles (the "database of all students").
drop policy if exists "Tutors can read student profiles" on public.profiles;
create policy "Tutors can read student profiles"
  on public.profiles for select
  to authenticated
  using (public.is_tutor() and role = 'student');

-- Let tutors (not just teachers) look a student up by email too.
create or replace function public.find_student_by_email(p_email text)
returns table (id uuid, email text, display_name text)
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to search for students';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('teacher', 'tutor')
  ) then
    raise exception 'Only teacher or tutor accounts can search for students';
  end if;
  return query
    select p.id, p.email, p.display_name
    from public.profiles p
    where lower(p.email) = lower(trim(p_email))
      and p.role = 'student'
    limit 1;
end;
$$;
revoke all on function public.find_student_by_email(text) from public;
grant execute on function public.find_student_by_email(text) to authenticated;

-- ---- 2. direct_messages (student <-> tutor DMs) -------------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists direct_messages_pair_idx
  on public.direct_messages (sender_id, recipient_id, created_at);
create index if not exists direct_messages_recipient_idx
  on public.direct_messages (recipient_id, created_at);

alter table public.direct_messages enable row level security;

drop policy if exists "Read own conversations" on public.direct_messages;
create policy "Read own conversations"
  on public.direct_messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Send as self" on public.direct_messages;
create policy "Send as self"
  on public.direct_messages for insert to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "Recipient marks read" on public.direct_messages;
create policy "Recipient marks read"
  on public.direct_messages for update to authenticated
  using (auth.uid() = recipient_id);

-- ---- 3. notebooks (one private notebook per user) -----------
create table if not exists public.notebooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.notebooks enable row level security;
drop policy if exists "Own notebook" on public.notebooks;
create policy "Own notebook"
  on public.notebooks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- 4. call_sessions (video-call records + AI summary) -----
create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  student_id uuid references auth.users(id) on delete set null,
  tutor_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text,
  bridgeys_awarded boolean not null default false
);
create index if not exists call_sessions_participant_idx
  on public.call_sessions (student_id, tutor_id, started_at);
alter table public.call_sessions enable row level security;

drop policy if exists "Participants read calls" on public.call_sessions;
create policy "Participants read calls"
  on public.call_sessions for select to authenticated
  using (auth.uid() = student_id or auth.uid() = tutor_id);

drop policy if exists "Participants create calls" on public.call_sessions;
create policy "Participants create calls"
  on public.call_sessions for insert to authenticated
  with check (auth.uid() = student_id or auth.uid() = tutor_id);

drop policy if exists "Participants update calls" on public.call_sessions;
create policy "Participants update calls"
  on public.call_sessions for update to authenticated
  using (auth.uid() = student_id or auth.uid() = tutor_id);

-- ---- 5. Realtime publication (messages + calls) -------------
do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.call_sessions;
exception when duplicate_object then null; end $$;

-- ---- 6. Avatars storage bucket (public read, owner write) ---
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Public avatar read" on storage.objects;
create policy "Public avatar read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
