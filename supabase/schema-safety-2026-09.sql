-- ============================================================
-- AlgeBridge student-safety hardening (2026-09). Idempotent.
-- Run AFTER schema.sql, schema-tutors.sql, schema-admin-groups.sql,
-- schema-hardening.sql, schema-admin-console.sql.
--
-- Closes the gaps found in the 2026-09-15 safety audit:
--   1. Any account could DM any student (recipient was never checked).
--   2. Video-call and ring channels were public, so anyone could join a
--      call room or eavesdrop on its signalling, captions and whiteboard.
--   3. Making someone a tutor needed a shared code; there was no admin
--      "promote this account" path enforced at the database.
--   4. The leaderboard broadcast every student's full real name.
--
-- These are enforced in the database, so the app's own screens are no
-- longer the only thing standing between a stranger and a 12-year-old.
-- ============================================================

-- ---- 0. Staff test used by the message policy -----------------
-- SECURITY DEFINER so it reads profiles/admins without tripping RLS
-- (and without the recursion that plain policy sub-selects cause).
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
-- A message is allowed only if a tutor/teacher/admin is on one end of it.
-- That lets students message tutors (and tutors message students), while
-- blocking student-to-student DMs entirely, so no one can pick a child off
-- the leaderboard and message them directly.
drop policy if exists "Send as self" on public.direct_messages;
drop policy if exists "Send as self to staff or as staff" on public.direct_messages;
create policy "Send as self to staff or as staff"
  on public.direct_messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and (public.profile_is_staff(auth.uid()) or public.profile_is_staff(recipient_id))
  );

-- ---- 2. Realtime authorization for calls and ringing ----------
-- realtime.messages has RLS on by default and denies everything, so a
-- PRIVATE channel is unreachable until a policy allows it. The app marks
-- the room and ring channels private (see the client changes); public
-- channels (group chat, DM inbox) never consult this table, so they are
-- unaffected.
--
-- A room topic is 'room-<uuidA>--<uuidB>' (roomIdFor joins the two ids with
-- '--'; uuids themselves use single hyphens, so '--' splits cleanly). Only
-- the two people named in the topic may join, send, or read presence, so a
-- guessed or forged room id gets a stranger nowhere.

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

-- Ringing: you may only LISTEN on your own ring channel ('ring-<your id>'),
-- so no one can watch who is being called. Sending is allowed to any signed
-- in user, because a call needs a ring out and a decline back; the caller's
-- claimed identity is verified separately when the room actually connects.
drop policy if exists "Ring listen own"        on realtime.messages;
drop policy if exists "Ring send authenticated" on realtime.messages;
create policy "Ring listen own"
  on realtime.messages for select to authenticated
  using (realtime.topic() = 'ring-' || auth.uid()::text);
create policy "Ring send authenticated"
  on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'ring-%');

-- ---- 3. Admins promote accounts (no shared code needed) --------
-- setMyRole() only ever changed the caller's own row (and self-promotion is
-- guarded by an access code). This lets an admin turn any existing account
-- into a tutor/teacher/student directly, so tutoring staff no longer depend
-- on a code that everyone who was ever given it still knows.
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
    -- Mirror claim_role: a new tutor joins the All-Tutors group.
    insert into public.group_members (group_id, user_id)
    select g.id, target from public.groups g where g.kind = 'all_tutors'
    on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- ---- 4. Shorten the names already on the leaderboard ----------
-- New syncs write "First L." (see src/lib/leaderboard.ts). Bring existing
-- rows in line now rather than waiting for each student's next login, so a
-- minor's full name is not sitting in a table every signed-in user can read.
update public.leaderboard_stats
set display_name =
      split_part(display_name, ' ', 1)
      || ' '
      || left(split_part(display_name, ' ',
               array_length(string_to_array(display_name, ' '), 1)), 1)
      || '.'
where display_name is not null
  and display_name like '% %'
  and display_name <> 'Anonymous Student';
