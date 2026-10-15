-- Class controls (Oct 15 2026): a teacher decides what their class sees.
--
-- One row per class. Everything is additive: a class with no row has no
-- controls, and the app treats a missing table the same way.
--
--   blocked_units     units the class cannot open (curriculum unit ids)
--   blocked_skills    single skills the class cannot open
--   blocked_features  parts of the app turned off for the class:
--                     games, leaderboard, house, archie, messages, groups,
--                     calls, tutors, booking
--   assigned_only     only skills the teacher assigned open (plus work the
--                     student already finished, so nothing they did vanishes)
--   allow_leave       when false, a student cannot leave the class themself
--
-- A student in several classes gets the strictest mix: a block in any class
-- applies.

create table if not exists public.class_controls (
  class_id uuid primary key references public.classes(id) on delete cascade,
  blocked_units text[] not null default '{}',
  blocked_skills text[] not null default '{}',
  blocked_features text[] not null default '{}',
  assigned_only boolean not null default false,
  allow_leave boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.class_controls enable row level security;

drop policy if exists "Teachers manage their class controls" on public.class_controls;
create policy "Teachers manage their class controls"
  on public.class_controls for all to authenticated
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

drop policy if exists "Students read their class controls" on public.class_controls;
create policy "Students read their class controls"
  on public.class_controls for select to authenticated
  using (public.is_class_member(class_id));

-- Leaving a class: only where the teacher allows it.
create or replace function public.class_allows_leave(cid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select allow_leave from public.class_controls where class_id = cid), true);
$$;

drop policy if exists "Students can leave a class" on public.class_members;
create policy "Students can leave a class"
  on public.class_members for delete
  using (auth.uid() = student_id and public.class_allows_leave(class_id));
