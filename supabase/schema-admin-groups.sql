-- ============================================================
-- AlgeBridge admin, role-gating, account deletion, group chats (2026-07)
-- Idempotent. Apply AFTER schema.sql + schema-tutors.sql.
-- ============================================================

-- ---- Admin: ivan.malchugan@gmail.com is a superuser ----------
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and lower(u.email) = 'ivan.malchugan@gmail.com'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admin reads all profiles" on public.profiles;
create policy "Admin reads all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

-- ---- Role access codes (gate teacher/tutor signups) ----------
create table if not exists public.role_codes (role text primary key, code text not null);
alter table public.role_codes enable row level security;
-- No SELECT policy => the client can never read the codes; they are only ever
-- checked inside claim_role() (SECURITY DEFINER).
--
-- IMPORTANT: real access codes are NEVER committed to this repo (it is public).
-- These are placeholder rows only. Set the real codes out-of-band, e.g.:
--   update public.role_codes set code = '<strong-random>' where role = 'tutor';
--   update public.role_codes set code = '<strong-random>' where role = 'teacher';
-- Until you do, teacher/tutor signup is closed (no code matches) — fail-safe.
insert into public.role_codes (role, code) values
  ('teacher', 'CHANGE-ME-teacher'),
  ('tutor',   'CHANGE-ME-tutor')
on conflict (role) do nothing;

-- ---- Guard: block self-escalation of role via a direct update
-- Client updates run as current_user='authenticated'; the SECURITY DEFINER
-- claim_role() runs as 'postgres'. Downgrades to 'student' are always allowed.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security invoker as $$
begin
  if new.role is distinct from old.role
     and new.role <> 'student'
     and current_user <> 'postgres'
     and not public.is_admin() then
    raise exception 'The teacher/tutor role must be claimed with a valid access code';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---- claim_role: set role, checking the code for teacher/tutor
create or replace function public.claim_role(target_role text, code text default null)
returns text language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'You must be signed in'; end if;
  if target_role not in ('student','teacher','tutor') then raise exception 'Unknown role'; end if;
  if target_role in ('teacher','tutor') and not public.is_admin() then
    if not exists (select 1 from public.role_codes rc where rc.role = target_role and rc.code = coalesce(code,'')) then
      raise exception 'That access code is not valid for the % role.', target_role;
    end if;
  end if;
  update public.profiles set role = target_role where id = me;
  if target_role = 'tutor' then perform public.join_all_tutors_group(me); end if;
  return target_role;
end $$;
revoke all on function public.claim_role(text,text) from public;
grant execute on function public.claim_role(text,text) to authenticated;

-- ---- delete_user: self-delete, or admin deletes anyone -------
create or replace function public.delete_user(target uuid default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); victim uuid;
begin
  if me is null then raise exception 'You must be signed in'; end if;
  victim := coalesce(target, me);
  if victim <> me and not public.is_admin() then
    raise exception 'Only an admin can delete another account';
  end if;
  -- Cascades to profiles, progress, messages, notebook, groups, etc.
  delete from auth.users where id = victim;
end $$;
revoke all on function public.delete_user(uuid) from public;
grant execute on function public.delete_user(uuid) to authenticated;

-- ============================================================
-- Group chats: the all-tutors group + AlgeGroups
-- ============================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('all_tutors','algegroup')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_idx on public.group_messages (group_id, created_at);
create index if not exists group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.group_members m where m.group_id = gid and m.user_id = auth.uid());
$$;
revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

drop policy if exists "Members read groups" on public.groups;
create policy "Members read groups" on public.groups for select to authenticated
  using (public.is_group_member(id) or public.is_admin());

drop policy if exists "Members read roster" on public.group_members;
create policy "Members read roster" on public.group_members for select to authenticated
  using (public.is_group_member(group_id) or user_id = auth.uid() or public.is_admin());

drop policy if exists "Members read group messages" on public.group_messages;
create policy "Members read group messages" on public.group_messages for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "Members post group messages" on public.group_messages;
create policy "Members post group messages" on public.group_messages for insert to authenticated
  with check (public.is_group_member(group_id) and sender_id = auth.uid());

do $$ begin alter publication supabase_realtime add table public.group_messages; exception when duplicate_object then null; end $$;

-- The single all-tutors group (create if missing).
insert into public.groups (id, name, kind)
select gen_random_uuid(), 'All Tutors', 'all_tutors'
where not exists (select 1 from public.groups where kind = 'all_tutors');

create or replace function public.join_all_tutors_group(uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select id into gid from public.groups where kind = 'all_tutors' limit 1;
  if gid is not null then
    insert into public.group_members (group_id, user_id) values (gid, uid) on conflict do nothing;
  end if;
end $$;
revoke all on function public.join_all_tutors_group(uuid) from public;
grant execute on function public.join_all_tutors_group(uuid) to authenticated;

-- Backfill: every existing tutor joins the all-tutors group.
insert into public.group_members (group_id, user_id)
select g.id, p.id from public.groups g join public.profiles p on p.role = 'tutor'
where g.kind = 'all_tutors'
on conflict do nothing;

-- create_algegroup: a tutor makes a group with chosen students.
create or replace function public.create_algegroup(group_name text, student_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; sid uuid;
begin
  if not public.is_tutor() and not public.is_admin() then
    raise exception 'Only tutors can create AlgeGroups';
  end if;
  insert into public.groups (name, kind, created_by)
    values (coalesce(nullif(trim(group_name),''),'AlgeGroup'), 'algegroup', auth.uid())
    returning id into gid;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  if student_ids is not null then
    foreach sid in array student_ids loop
      insert into public.group_members (group_id, user_id) values (gid, sid) on conflict do nothing;
    end loop;
  end if;
  return gid;
end $$;
revoke all on function public.create_algegroup(text, uuid[]) from public;
grant execute on function public.create_algegroup(text, uuid[]) to authenticated;
