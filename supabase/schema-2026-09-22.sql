-- ============================================================
-- AlgeBridge, 22 September 2026: names, safety, the founder's allowance.
--
-- ONE FILE TO RUN. Paste the whole thing into the Supabase SQL editor and
-- run it once; every statement is idempotent, so running it twice is safe.
-- It bundles three earlier files that were written but never applied to the
-- live database (checked 2026-09-22 with an anonymous probe: the functions
-- they create did not exist), plus what is new today. In order:
--
--   1. schema-classroom.sql   classes teachers can arrange, assignments,
--                             real names on signup
--   2. schema-safety-2026-09  students can only DM staff; call and ring
--                             channels are private; admins promote accounts;
--                             the leaderboard shows "First L." only
--   3. schema-feedback.sql    the feedback table behind /feedback
--   4. NEW  "First Last"      every display name tidied into First Last, in
--                             the database, on every write and once now;
--                             a last initial is refused
--   5. NEW  unlimited Bridgeys  a profile flag only an admin can set, seeded
--                             for the founder's accounts
--   6. NEW  hardening         nobody can change the email on their profile
--                             (teachers find students by it); rings only
--                             reach staff, or come from staff
--
-- Run AFTER schema.sql, schema-tutors.sql, schema-admin-groups.sql,
-- schema-hardening.sql and schema-admin-console.sql, which are live.
-- ============================================================


-- ============================================================
-- 1. Classroom (from schema-classroom.sql, 2026-08)
-- ============================================================

alter table public.classes add column if not exists period text;
alter table public.classes add column if not exists grade_level text;
alter table public.classes add column if not exists color text not null default 'blue';
alter table public.classes add column if not exists sort_order int not null default 0;
alter table public.classes add column if not exists archived boolean not null default false;

update public.classes c
set sort_order = ordered.rn
from (
  select id, row_number() over (partition by teacher_id order by created_at) as rn
  from public.classes
) ordered
where ordered.id = c.id and c.sort_order = 0;

create index if not exists classes_teacher_sort_order_idx
  on public.classes (teacher_id, sort_order);

create table if not exists public.class_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  unit_id text not null,
  skill_id text,
  title text,
  note text,
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists class_assignments_class_idx
  on public.class_assignments (class_id, sort_order);

alter table public.class_assignments enable row level security;

drop policy if exists "Teachers manage assignments for their classes" on public.class_assignments;
create policy "Teachers manage assignments for their classes"
  on public.class_assignments for all to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

drop policy if exists "Students read assignments for their classes" on public.class_assignments;
create policy "Students read assignments for their classes"
  on public.class_assignments for select to authenticated
  using (public.is_class_member(class_id));


-- ============================================================
-- 4. "First Last": one shape for every name, kept by the database
-- ============================================================

-- The tidying itself, the same rules as src/lib/name.ts formatName:
-- "alvarez, maria" turns round; words typed in one case (all lower, ALL
-- CAPS) are capitalized, words with their own capitals (McKay, O'Brien) are
-- kept; lowercase particles inside a surname stay lowercase; stray
-- punctuation at the ends of words goes; spaces collapse.
create or replace function public.format_display_name(p_name text)
returns text
language plpgsql immutable
as $$
declare
  v text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  parts text[];
  out_parts text[] := '{}';
  w text;
  i int;
  n int;
  particles text[] := array['van','von','der','den','de','del','della','di','da','dos','du','la','le','bin','ibn','af','av','ter','ten','zu'];
begin
  if v like '%,%' and array_length(string_to_array(v, ','), 1) = 2
     and btrim(split_part(v, ',', 1)) <> '' and btrim(split_part(v, ',', 2)) <> '' then
    v := btrim(split_part(v, ',', 2)) || ' ' || btrim(split_part(v, ',', 1));
  end if;
  v := btrim(regexp_replace(replace(v, ',', ' '), '\s+', ' ', 'g'));
  parts := string_to_array(v, ' ');
  n := coalesce(array_length(parts, 1), 0);
  for i in 1..n loop
    w := regexp_replace(parts[i], '^[^[:alpha:]]+|[^[:alpha:]]+$', '', 'g');
    if w = '' then continue; end if;
    if w = lower(w) or w = upper(w) then
      if i > 1 and i < n and lower(w) = any(particles) then
        w := lower(w);
      else
        w := initcap(lower(w));
      end if;
    end if;
    out_parts := out_parts || w;
  end loop;
  return array_to_string(out_parts, ' ');
end;
$$;

-- Every write to a display name goes through the tidying, whichever path
-- wrote it: the signup trigger, the RPC, or a direct profile update.
create or replace function public.tidy_display_name()
returns trigger
language plpgsql
as $$
begin
  if new.display_name is not null then
    new.display_name := nullif(public.format_display_name(new.display_name), '');
  end if;
  return new;
end;
$$;
drop trigger if exists tidy_display_name on public.profiles;
create trigger tidy_display_name
  before insert or update of display_name on public.profiles
  for each row execute function public.tidy_display_name();

-- New signups pass their real name as auth metadata (full_name); use it for
-- the profile instead of the email prefix that older accounts got.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name',
                                       new.raw_user_meta_data->>'name', '')), '');
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(v_name, split_part(coalesce(new.email, 'student'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Server-side guard so a real name can't be bypassed by calling the API
-- directly. The client does the friendlier, field-by-field checking; this
-- is the rule of last resort, and it refuses a last initial.
create or replace function public.set_display_name(p_name text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.format_display_name(p_name);
  v_parts text[];
  v_last text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  -- Checked on what was typed: the tidying drops stray characters at the
  -- ends of words, and "sam d2011" should be told about the digits.
  if coalesce(p_name, '') ~ '[0-9_@/\\|<>]' then
    raise exception 'Names cannot contain numbers, usernames or email addresses.';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 60 then
    raise exception 'Enter your first and last name (3-60 characters).';
  end if;
  v_parts := string_to_array(v_name, ' ');
  if array_length(v_parts, 1) < 2 then
    raise exception 'Please enter both your first and last name.';
  end if;
  v_last := regexp_replace(v_parts[array_length(v_parts, 1)], '[^[:alpha:]]', '', 'g');
  if char_length(v_last) < 2 then
    raise exception 'Please enter your full last name, not just the initial.';
  end if;

  update public.profiles set display_name = v_name where id = auth.uid();
  -- The leaderboard is readable by every signed-in account, so it only ever
  -- carries "First L." (see src/lib/leaderboard.ts).
  update public.leaderboard_stats
     set display_name = split_part(v_name, ' ', 1) || ' ' || left(v_last, 1) || '.'
   where user_id = auth.uid();
  return v_name;
end;
$$;

revoke all on function public.set_display_name(text) from public;
grant execute on function public.set_display_name(text) to authenticated;

-- Existing names, tidied once now. Accounts still carrying an email prefix
-- or a last initial are asked for the full name the next time they sign in
-- (the app checks isRealName); nothing here invents a name for them.
update public.profiles
   set display_name = public.format_display_name(display_name)
 where display_name is not null
   and display_name is distinct from public.format_display_name(display_name);


-- ============================================================
-- 2. Student safety (from schema-safety-2026-09.sql)
-- ============================================================

-- ---- 0. Staff test used by the message policy -----------------
create or replace function public.profile_is_staff(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from public.profiles p
                 where p.id = uid and p.role in ('tutor', 'teacher'))
      or exists (select 1 from public.admins a where a.user_id = uid);
$$;
revoke all on function public.profile_is_staff(uuid) from public;
grant execute on function public.profile_is_staff(uuid) to authenticated;

-- ---- 1. Direct messages: a student can only reach staff --------
drop policy if exists "Send as self" on public.direct_messages;
drop policy if exists "Send as self to staff or as staff" on public.direct_messages;
create policy "Send as self to staff or as staff"
  on public.direct_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and (public.profile_is_staff(auth.uid()) or public.profile_is_staff(recipient_id))
  );

-- ---- 2. Realtime authorization for calls and ringing ----------
-- A room topic is 'room-<uuidA>--<uuidB>'. Only the two people named in the
-- topic may join, send, or read presence.
drop policy if exists "Room participants read"  on realtime.messages;
drop policy if exists "Room participants write" on realtime.messages;
create policy "Room participants read"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'room-%'
    and auth.uid()::text = any(string_to_array(substring(realtime.topic() from 6), '--'))
  );
create policy "Room participants write"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'room-%'
    and auth.uid()::text = any(string_to_array(substring(realtime.topic() from 6), '--'))
  );

-- Ringing: you may only LISTEN on your own ring channel ('ring-<your id>').
-- (6. below) A ring may only be SENT by staff, or to staff: a student can
-- call a tutor and a tutor can call a student, and nobody can ring a
-- classmate.
drop policy if exists "Ring listen own"        on realtime.messages;
drop policy if exists "Ring send authenticated" on realtime.messages;
drop policy if exists "Ring send to staff or as staff" on realtime.messages;
create policy "Ring listen own"
  on realtime.messages for select to authenticated
  using (realtime.topic() = 'ring-' || auth.uid()::text);
create policy "Ring send to staff or as staff"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'ring-%'
    and substring(realtime.topic() from 6) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      public.profile_is_staff(auth.uid())
      or public.profile_is_staff((substring(realtime.topic() from 6))::uuid)
    )
  );

-- ---- 3. Admins promote accounts (no shared code needed) --------
create or replace function public.set_user_role(target uuid, new_role text)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if new_role not in ('student', 'teacher', 'tutor') then
    raise exception 'Unknown role %', new_role;
  end if;
  update public.profiles set role = new_role where id = target;
  if new_role = 'tutor' then
    insert into public.group_members (group_id, user_id)
    select g.id, target from public.groups g where g.kind = 'all_tutors'
    on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ---- 4. Shorten the names already on the leaderboard ----------
update public.leaderboard_stats
set display_name =
      split_part(display_name, ' ', 1)
      || ' '
      || left(split_part(display_name, ' ',
               array_length(string_to_array(display_name, ' '), 1)), 1)
      || '.'
where display_name is not null
  and display_name like '% %'
  and display_name <> 'Anonymous Student'
  and display_name !~ '^\S+ \S\.$';


-- ============================================================
-- 3. Feedback (from schema-feedback.sql)
-- ============================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'other',
  message text not null check (char_length(message) between 3 and 2000),
  contact text,
  page text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Anyone can leave feedback" on public.feedback;
create policy "Anyone can leave feedback"
  on public.feedback for insert to anon, authenticated
  with check (true);
-- Nobody reads through the API; read it in the Supabase dashboard.


-- ============================================================
-- 5. Unlimited Bridgeys: an allowance only an admin can grant
-- ============================================================

alter table public.profiles add column if not exists unlimited_bridgeys boolean not null default false;

-- The "Users can update own profile" policy covers every column, so a
-- student could set this on themselves with one API call. This trigger is
-- what stops that: only a SECURITY DEFINER function (running as postgres)
-- or an admin may change it.
create or replace function public.guard_profile_allowance()
returns trigger
language plpgsql security invoker
as $$
begin
  if new.unlimited_bridgeys is distinct from (case when tg_op = 'UPDATE' then old.unlimited_bridgeys else false end)
     and current_user <> 'postgres'
     and not public.is_admin() then
    raise exception 'Unlimited Bridgeys can only be granted by an admin' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_allowance on public.profiles;
create trigger guard_profile_allowance before insert or update on public.profiles
  for each row execute function public.guard_profile_allowance();

-- Admin-only switch, used by the admin console.
create or replace function public.set_unlimited_bridgeys(target uuid, enabled boolean)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.profiles set unlimited_bridgeys = coalesce(enabled, false) where id = target;
end;
$$;
revoke all on function public.set_unlimited_bridgeys(uuid, boolean) from public;
grant execute on function public.set_unlimited_bridgeys(uuid, boolean) to authenticated;

-- The founder's accounts: every admin account (the founding address is the
-- one schema-admin-console.sql already names), and every account that
-- already carries his name (checked once, now, before anyone could take the
-- name to get the allowance; afterwards only the switch above changes it).
update public.profiles p
   set unlimited_bridgeys = true
 where p.unlimited_bridgeys = false
   and (
     exists (select 1 from public.admins a where a.user_id = p.id)
     or exists (select 1 from auth.users u where u.id = p.id and lower(u.email) = 'ivan.malchugan@gmail.com')
     or lower(public.format_display_name(p.display_name)) = 'ivan dubovyi'
   );

-- The admin console's account list, now with the allowance.
drop function if exists public.admin_user_rows();
create or replace function public.admin_user_rows()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  avatar_url text,
  created_at timestamptz,
  last_seen_at timestamptz,
  is_admin boolean,
  unlimited_bridgeys boolean
)
language plpgsql security definer stable
set search_path = public, auth
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.display_name, p.role, p.avatar_url,
           p.created_at, p.last_seen_at,
           exists (select 1 from public.admins a where a.user_id = p.id) as is_admin,
           p.unlimited_bridgeys
    from public.profiles p
    order by p.last_seen_at desc nulls last;
end;
$$;
revoke all on function public.admin_user_rows() from public;
grant execute on function public.admin_user_rows() to authenticated;


-- ============================================================
-- 6. Hardening: the email on a profile is not the student's to change
-- ============================================================

-- find_student_by_email matches profiles.email, and the update policy let a
-- student write any address into their own row, so a student could take a
-- classmate's address and be added to a class in their place.
create or replace function public.guard_profile_email()
returns trigger
language plpgsql security invoker
as $$
begin
  if tg_op = 'UPDATE'
     and new.email is distinct from old.email
     and current_user <> 'postgres'
     and not public.is_admin() then
    raise exception 'The email on a profile cannot be changed here' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_email on public.profiles;
create trigger guard_profile_email before update on public.profiles
  for each row execute function public.guard_profile_email();


-- ============================================================
-- What happened: the accounts that now have the allowance, and how many
-- names were still not in "First Last" shape (they are asked on sign-in).
-- ============================================================
select 'unlimited bridgeys' as what, p.email, p.display_name
  from public.profiles p
 where p.unlimited_bridgeys
union all
select 'name still needs the full last name', p.email, p.display_name
  from public.profiles p
 where p.display_name is null
    or array_length(string_to_array(p.display_name, ' '), 1) < 2
    or char_length(regexp_replace(split_part(p.display_name, ' ', array_length(string_to_array(p.display_name, ' '), 1)), '[^[:alpha:]]', '', 'g')) < 2
    or p.display_name ~ '[0-9_@/\\|<>]'
 order by 1, 2;
