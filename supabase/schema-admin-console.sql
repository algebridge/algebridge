-- ============================================================
-- AlgeBridge admin console + tutor calendar (2026-08)
-- Run AFTER schema.sql, schema-tutors.sql, schema-admin-groups.sql.
-- Safe to re-run (idempotent).
-- ============================================================

-- ---- 1. Admins are rows, not one hardcoded address ----------
-- The old is_admin() matched a single literal email, so a second admin was
-- impossible without a code change and a deploy. Admins are now a table.

create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Deliberately NO policies. Only SECURITY DEFINER functions read this table,
-- so no client can ever enumerate who the admins are.

-- Seed the founding admin so this migration can never lock anybody out.
insert into public.admins (user_id)
select id from auth.users where lower(email) = 'ivan.malchugan@gmail.com'
on conflict (user_id) do nothing;

-- The founding address stays a hardcoded fallback on purpose: if the seed
-- above ever matches nothing, the owner still gets in. It is already public
-- in this repo, so nothing new is disclosed by keeping it here.
create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public, auth
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
      or exists (
        select 1 from auth.users u
        where u.id = auth.uid() and lower(u.email) = 'ivan.malchugan@gmail.com'
      );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Promote an existing account by email. Admin-only, so the first admin has to
-- come from the seed above (or the fallback), never from a client call.
create or replace function public.grant_admin(p_email text)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare target uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can grant admin' using errcode = '42501';
  end if;
  select u.id into target from auth.users u where lower(u.email) = lower(trim(p_email));
  if target is null then
    raise exception 'No account exists for %. Have them sign up first.', p_email;
  end if;
  insert into public.admins (user_id) values (target) on conflict (user_id) do nothing;
end;
$$;
revoke all on function public.grant_admin(text) from public;
grant execute on function public.grant_admin(text) to authenticated;

-- ---- 2. A real "last active" signal -------------------------
-- user_progress.updated_at only moves when progress syncs (the leaderboard,
-- the login page, or the manual Sync button), so it is NOT a usable activity
-- metric. profiles.last_seen_at is bumped by the app itself instead.

alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Backfill once, from the best signal that already exists per account. This is
-- "last known contact", not a history: user_progress keeps one row per user
-- with a rolling updated_at, so earlier visits were never recorded anywhere.
update public.profiles p
set last_seen_at = greatest(
      p.created_at,
      coalesce((select up.updated_at from public.user_progress up where up.user_id = p.id), p.created_at)
    )
where p.last_seen_at is null;

create index if not exists profiles_last_seen_at_idx on public.profiles (last_seen_at desc);

-- Heartbeat. The client calls this at most once every 5 minutes per session.
create or replace function public.touch_last_seen()
returns void
language sql security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;
revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

-- ---- 3. Tutor calendar --------------------------------------

create table if not exists public.tutor_events (
  id         uuid primary key default gen_random_uuid(),
  tutor_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null check (char_length(trim(title)) between 1 and 120),
  kind       text not null default 'session' check (kind in ('session', 'event')),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  student_id uuid references auth.users(id) on delete set null,
  location   text check (location is null or char_length(location) <= 200),
  notes      text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint tutor_events_ends_after_start check (ends_at > starts_at)
);
create index if not exists tutor_events_starts_at_idx on public.tutor_events (starts_at);
create index if not exists tutor_events_tutor_idx on public.tutor_events (tutor_id, starts_at);

alter table public.tutor_events enable row level security;

-- Tutors and admins see the whole calendar, so two tutors can spot a clash.
drop policy if exists "Staff read the calendar" on public.tutor_events;
create policy "Staff read the calendar" on public.tutor_events
  for select to authenticated
  using (public.is_tutor() or public.is_admin());

-- A student can see the sessions they are booked into. No student-facing UI
-- ships with this migration; the policy is here so the data model is right
-- when that view is built.
drop policy if exists "Students read their own sessions" on public.tutor_events;
create policy "Students read their own sessions" on public.tutor_events
  for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "Tutors add to the calendar" on public.tutor_events;
create policy "Tutors add to the calendar" on public.tutor_events
  for insert to authenticated
  with check (tutor_id = auth.uid() and (public.is_tutor() or public.is_admin()));

drop policy if exists "Owner or admin edits an entry" on public.tutor_events;
create policy "Owner or admin edits an entry" on public.tutor_events
  for update to authenticated
  using (tutor_id = auth.uid() or public.is_admin())
  with check (tutor_id = auth.uid() or public.is_admin());

drop policy if exists "Owner or admin removes an entry" on public.tutor_events;
create policy "Owner or admin removes an entry" on public.tutor_events
  for delete to authenticated
  using (tutor_id = auth.uid() or public.is_admin());

-- ---- 4. Admin overview numbers ------------------------------
-- profiles and user_progress are both behind RLS, so the counts have to come
-- from a SECURITY DEFINER function that checks is_admin() itself.

create or replace function public.admin_overview()
returns jsonb
language plpgsql security definer stable
set search_path = public, auth
as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total',      (select count(*) from public.profiles),
    'students',   (select count(*) from public.profiles where role = 'student'),
    'tutors',     (select count(*) from public.profiles where role = 'tutor'),
    'teachers',   (select count(*) from public.profiles where role = 'teacher'),
    'active_1d',  (select count(*) from public.profiles where last_seen_at > now() - interval '24 hours'),
    'active_7d',  (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'active_30d', (select count(*) from public.profiles where last_seen_at > now() - interval '30 days'),
    'new_1d',     (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'new_7d',     (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new_30d',    (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'dormant',    (select count(*) from public.profiles
                    where last_seen_at is null or last_seen_at <= now() - interval '30 days'),
    'sessions_7d',   (select count(*) from public.tutor_events
                       where starts_at >= now() - interval '7 days' and starts_at < now()),
    'sessions_next7',(select count(*) from public.tutor_events
                       where starts_at >= now() and starts_at < now() + interval '7 days'),
    -- NOTE: this is a LAST-SEEN histogram, not daily actives. Each account is
    -- counted once, on the day it was last seen. The UI must say so.
    'seen_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
      from (
        select g::date as d,
               (select count(*) from public.profiles p
                 where p.last_seen_at >= g and p.last_seen_at < g + interval '1 day') as n
        from generate_series(
               (date_trunc('day', now()) - interval '29 days')::timestamptz,
               date_trunc('day', now())::timestamptz,
               interval '1 day') g
      ) s
    )
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

-- Admin-only account list, with the activity columns the console shows.
-- (The "Admin reads all profiles" policy covers the plain table read, but the
-- console also wants last_seen_at ordering across every role in one query.)
create or replace function public.admin_user_rows()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  avatar_url text,
  created_at timestamptz,
  last_seen_at timestamptz,
  is_admin boolean
)
language plpgsql security definer stable
set search_path = public, auth
as $$
-- The RETURNS TABLE column names double as plpgsql variables, so an unqualified
-- reference below would raise "column reference is ambiguous". Prefer columns.
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.display_name, p.role, p.avatar_url,
           p.created_at, p.last_seen_at,
           exists (select 1 from public.admins a where a.user_id = p.id) as is_admin
    from public.profiles p
    order by p.last_seen_at desc nulls last;
end;
$$;
revoke all on function public.admin_user_rows() from public;
grant execute on function public.admin_user_rows() to authenticated;
