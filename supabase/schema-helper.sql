-- ============================================================
-- AlgeBridge study helper: session requests (2026-08)
-- Run AFTER schema-admin-console.sql. Safe to re-run.
-- ============================================================

-- When the helper decides a student needs a person rather than a hint, it
-- collects when they are free and who they want, and drops a row here. A
-- tutor picks it up from the workspace and turns it into a calendar entry.

create table if not exists public.session_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references auth.users(id) on delete cascade,
  -- Free text on purpose. "Tuesday after 4" is more useful to a tutor than a
  -- timestamp the student had to fight a date picker to produce.
  availability  text not null check (char_length(trim(availability)) between 1 and 400),
  -- What the student typed, kept even when it matches nobody on the roster.
  preferred_tutor      text check (preferred_tutor is null or char_length(preferred_tutor) <= 120),
  preferred_tutor_id   uuid references auth.users(id) on delete set null,
  topic         text check (topic is null or char_length(topic) <= 200),
  status        text not null default 'open' check (status in ('open', 'claimed', 'scheduled', 'closed')),
  claimed_by    uuid references auth.users(id) on delete set null,
  event_id      uuid references public.tutor_events(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists session_requests_status_idx on public.session_requests (status, created_at desc);
create index if not exists session_requests_student_idx on public.session_requests (student_id, created_at desc);

alter table public.session_requests enable row level security;

drop policy if exists "Students create their own requests" on public.session_requests;
create policy "Students create their own requests" on public.session_requests
  for insert to authenticated with check (student_id = auth.uid());

drop policy if exists "Students read their own requests" on public.session_requests;
create policy "Students read their own requests" on public.session_requests
  for select to authenticated using (student_id = auth.uid());

drop policy if exists "Staff read every request" on public.session_requests;
create policy "Staff read every request" on public.session_requests
  for select to authenticated using (public.is_tutor() or public.is_admin());

drop policy if exists "Staff claim a request" on public.session_requests;
create policy "Staff claim a request" on public.session_requests
  for update to authenticated
  using (public.is_tutor() or public.is_admin())
  with check (public.is_tutor() or public.is_admin());

-- Counts for the workspace. Behind a definer function because a tutor should
-- see the queue depth without the table being readable to everyone.
create or replace function public.workspace_counts()
returns jsonb
language plpgsql security definer stable
set search_path = public, auth
as $$
declare result jsonb;
begin
  if not (public.is_tutor() or public.is_admin()) then
    raise exception 'Staff only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'open_requests',    (select count(*) from public.session_requests where status = 'open'),
    'claimed_requests', (select count(*) from public.session_requests where status = 'claimed'),
    'sessions_next7',   (select count(*) from public.tutor_events
                          where starts_at >= now() and starts_at < now() + interval '7 days'),
    'sessions_today',   (select count(*) from public.tutor_events
                          where starts_at >= date_trunc('day', now())
                            and starts_at < date_trunc('day', now()) + interval '1 day')
  ) into result;
  return result;
end;
$$;
revoke all on function public.workspace_counts() from public;
grant execute on function public.workspace_counts() to authenticated;
