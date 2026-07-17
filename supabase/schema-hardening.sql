-- ============================================================
-- AlgeBridge security hardening (2026-07). Idempotent.
-- NOTE: role access codes are intentionally NOT in any committed file.
-- They are set out-of-band (SQL/dashboard) so they can't leak via the repo.
-- ============================================================

-- ---- 1. Role guard now covers INSERT as well as UPDATE -------
-- Previously only UPDATE was guarded; a profiles INSERT with role!='student'
-- (only possible if a row were ever missing) could self-grant tutor/teacher.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security invoker as $$
begin
  if new.role is distinct from (case when tg_op = 'UPDATE' then old.role else 'student' end)
     and new.role <> 'student'
     and current_user <> 'postgres'
     and not public.is_admin() then
    raise exception 'The teacher/tutor role must be claimed with a valid access code';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- Belt-and-suspenders: RLS also pins a client-inserted profile to 'student'.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert
  with check (auth.uid() = id and role = 'student');

-- ---- 2. Direct messages are immutable except read_at ---------
-- The "recipient marks read" UPDATE policy had no column restriction, so a
-- recipient could rewrite a message body. Only read_at may change now.
create or replace function public.guard_dm_immutable()
returns trigger language plpgsql security invoker as $$
begin
  if new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Messages are immutable; only read status may change';
  end if;
  return new;
end $$;
drop trigger if exists guard_dm_immutable on public.direct_messages;
create trigger guard_dm_immutable before update on public.direct_messages
  for each row execute function public.guard_dm_immutable();

-- ---- 3. Fix privilege hole in join_all_tutors_group -----------
-- The old join_all_tutors_group(uid uuid) was granted to `authenticated` and
-- took an ARBITRARY uid, so any user could add THEMSELVES to the All-Tutors
-- group and read every tutor's messages. Replace with a no-arg version that
-- only ever joins the CALLER and only if they are actually a tutor/admin.
create or replace function public.join_all_tutors_group()
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not (public.is_tutor() or public.is_admin()) then return; end if;
  select id into gid from public.groups where kind = 'all_tutors' limit 1;
  if gid is not null then
    insert into public.group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  end if;
end $$;
revoke all on function public.join_all_tutors_group() from public;
grant execute on function public.join_all_tutors_group() to authenticated;

-- claim_role now calls the safe no-arg version.
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
  if target_role = 'tutor' then perform public.join_all_tutors_group(); end if;
  return target_role;
end $$;

-- Remove the dangerous arbitrary-uid version.
drop function if exists public.join_all_tutors_group(uuid);
