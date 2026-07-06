-- Run this in Supabase SQL Editor to enable cloud progress sync

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress_json jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

create policy "Users can read own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

create policy "Users can upsert own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.user_progress for update
  using (auth.uid() = user_id);

-- ============================================================
-- Teacher controls: profiles, classes, rosters
-- Run this section too if you want the Teacher Dashboard to work.
-- ============================================================

create extension if not exists pgcrypto;

-- ---- Profiles (role: student | teacher) ----------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Automatically create a profile row for every new signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, 'student'), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Classes ---------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  join_code text not null unique
    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_at timestamptz not null default now()
);

alter table public.classes enable row level security;

create policy "Teachers manage their own classes"
  on public.classes for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- ---- Class members (roster) ------------------------------------
create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

alter table public.class_members enable row level security;

create policy "Teachers manage members of their own classes"
  on public.class_members for all
  using (
    exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = auth.uid())
  )
  with check (
    exists (select 1 from public.classes c where c.id = class_members.class_id and c.teacher_id = auth.uid())
  );

create policy "Students can read their own memberships"
  on public.class_members for select
  using (auth.uid() = student_id);

create policy "Students can leave a class"
  on public.class_members for delete
  using (auth.uid() = student_id);

-- Students can read classes they belong to (needed after joining by code).
create policy "Students can read classes they belong to"
  on public.classes for select
  using (
    exists (
      select 1 from public.class_members cm
      where cm.class_id = classes.id and cm.student_id = auth.uid()
    )
  );

-- Teachers can read the profile (name/email) of students in their classes.
create policy "Teachers can read profiles of their students"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where c.teacher_id = auth.uid() and cm.student_id = profiles.id
    )
  );

-- Teachers can read the practice progress of students in their classes.
create policy "Teachers can read progress of their students"
  on public.user_progress for select
  using (
    exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where c.teacher_id = auth.uid() and cm.student_id = user_progress.user_id
    )
  );

-- ---- RPC: student joins a class using a 6-character code -------
create or replace function public.join_class_by_code(p_code text)
returns table (class_id uuid, class_name text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_class_id uuid;
  v_class_name text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a class';
  end if;

  select id, name into v_class_id, v_class_name
  from public.classes
  where join_code = upper(trim(p_code));

  if v_class_id is null then
    raise exception 'No class found with that code';
  end if;

  insert into public.class_members (class_id, student_id)
  values (v_class_id, auth.uid())
  on conflict (class_id, student_id) do nothing;

  return query select v_class_id, v_class_name;
end;
$$;

revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;

-- ---- RPC: teacher finds a student by email to add to a class ---
-- Returns only minimal, non-sensitive fields, and only matches
-- accounts with role = 'student' (never exposes teacher accounts).
create or replace function public.find_student_by_email(p_email text)
returns table (id uuid, email text, display_name text)
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to search for students';
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

-- ============================================================
-- Nationwide leaderboard (Bridgeys, lessons, house prestige)
-- Run this section for the student leaderboard to work.
-- ============================================================

create table if not exists public.leaderboard_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bridgeys int not null default 0,
  completed_skills int not null default 0,
  best_furniture_value int not null default 0,
  best_furniture_name text,
  equipped_title text,
  leaderboard_opt_in boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard_stats enable row level security;

create policy "Authenticated users can read opt-in leaderboard"
  on public.leaderboard_stats for select
  to authenticated
  using (leaderboard_opt_in = true);

create policy "Users can insert own leaderboard stats"
  on public.leaderboard_stats for insert
  with check (auth.uid() = user_id);

create policy "Users can update own leaderboard stats"
  on public.leaderboard_stats for update
  using (auth.uid() = user_id);
