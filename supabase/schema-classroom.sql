-- ============================================================
-- AlgeBridge classroom upgrade (2026-08)
--
--   1. Classes teachers can actually organize: period, grade level,
--      color, manual ordering, archiving.
--   2. Assignments: a teacher points a class at specific units/skills
--      with a due date, and students see them on their dashboard.
--   3. Real names: every account stores an actual first + last name.
--
-- Purely additive and safe to re-run. Run AFTER schema.sql,
-- schema-tutors.sql and schema-hardening.sql.
-- ============================================================

-- ---- 1. Classes teachers can arrange -------------------------
-- NOTE: the ordering column is sort_order, not "position" — POSITION is a SQL
-- keyword and an unquoted column of that name is asking for trouble.
alter table public.classes add column if not exists period text;
alter table public.classes add column if not exists grade_level text;
alter table public.classes add column if not exists color text not null default 'blue';
alter table public.classes add column if not exists sort_order int not null default 0;
alter table public.classes add column if not exists archived boolean not null default false;

-- Give existing classes a stable order (oldest first) instead of all-zero.
update public.classes c
set sort_order = ordered.rn
from (
  select id, row_number() over (partition by teacher_id order by created_at) as rn
  from public.classes
) ordered
where ordered.id = c.id and c.sort_order = 0;

create index if not exists classes_teacher_sort_order_idx
  on public.classes (teacher_id, sort_order);

-- ---- 2. Class assignments ------------------------------------
-- One row = "this class should work on this unit (or one skill in it) by
-- this date". skill_id null means the whole unit.
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

-- is_class_teacher / is_class_member are SECURITY DEFINER helpers from
-- schema.sql — using them here keeps these policies non-recursive.
drop policy if exists "Teachers manage assignments for their classes" on public.class_assignments;
create policy "Teachers manage assignments for their classes"
  on public.class_assignments for all to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

drop policy if exists "Students read assignments for their classes" on public.class_assignments;
create policy "Students read assignments for their classes"
  on public.class_assignments for select to authenticated
  using (public.is_class_member(class_id));

-- ---- 3. Real names -------------------------------------------
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
-- directly. The client does the friendlier, more precise checking.
create or replace function public.set_display_name(p_name text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then
    raise exception 'You must be signed in';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 60 then
    raise exception 'Enter your first and last name (3-60 characters).';
  end if;
  if v_name ~ '[0-9_@/\\|<>]' then
    raise exception 'Names cannot contain numbers, usernames or email addresses.';
  end if;
  if array_length(string_to_array(v_name, ' '), 1) < 2 then
    raise exception 'Please enter both your first and last name.';
  end if;

  update public.profiles set display_name = v_name where id = auth.uid();
  -- Keep the leaderboard label in step with the profile name.
  update public.leaderboard_stats set display_name = v_name where user_id = auth.uid();
  return v_name;
end;
$$;

revoke all on function public.set_display_name(text) from public;
grant execute on function public.set_display_name(text) to authenticated;
