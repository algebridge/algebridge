-- ============================================================
-- AlgeBridge, 3 October 2026: student safety, part 2.
--
-- NOT APPLIED. Ivan must approve applying this file to the live database.
-- Nobody runs it on his behalf. It was written and tested end to end in
-- PGlite (Postgres 18) on top of every earlier schema file, twice in a row
-- to prove it is idempotent; it has never touched production.
--
-- ONE FILE TO RUN, in the Supabase SQL editor. Every statement is
-- idempotent, so running it twice is safe.
-- Run AFTER: schema.sql, schema-tutors.sql, schema-admin-groups.sql,
-- schema-hardening.sql, schema-admin-console.sql, schema-helper.sql,
-- schema-2026-09-22.sql (all live) and schema-2026-10-01-reviews.sql
-- (written, not yet run). If the reviews file is run AFTER this one, run
-- this one again: both redefine the feedback insert policy, and this
-- file's version is the stricter one.
--
-- What it does:
--   1. Contact rules. A tutor or teacher can message or ring a student only
--      when the student is on that TEACHER's class roster, asked for help and
--      that tutor took the request (or named that tutor on a request in the
--      last 14 days), or wrote to them first, and never after the student
--      blocked them. A student can still write to any tutor or teacher,
--      except a school-managed student (rule 11). Staff can reach each other.
--      Admins can reach anyone.
--   2. Blocks. public.user_blocks. A blocked person cannot message or ring
--      the one who blocked them, cannot put them in a new group chat, no
--      longer sees them in the student directory or their help requests,
--      and their direct and group messages are hidden from that person on
--      every device. A video call room only opens for two people who may talk.
--   3. A student's message that holds a phone number or an email address is
--      refused by the database itself (a trigger), whatever app sent it.
--      Invisible characters are taken out and Arabic-Indic and Persian
--      digits read as 0 to 9 first, and the sender's last three messages in
--      that conversation from the last ten minutes are read joined to the new
--      one, so a number sent in pieces is refused too.
--   4. Messages kept for safety review. When an account is deleted, every
--      direct message it sent or received and every group message it sent
--      is copied to public.message_archive first, readable only by admins,
--      and purged after 90 days. The live tables still lose them, as now.
--   5. Tutors no longer read student email addresses. The policy that let
--      every tutor read every student's row is dropped. Staff read students
--      through public.student_directory: id, name, photo and role, never an
--      email, and for a tutor only the students in rule 1 or in their own
--      group chats. Teachers keep reading their own rostered students'
--      rows, email included, as before.
--   6. The avatars bucket is no longer public. A photo is readable by its
--      owner, admins, anyone signed in for a tutor's or teacher's photo,
--      and for a student's photo by the staff in rule 5.
--   7. Reports. The feedback table gets report columns (reason, where, the
--      reported account, the reported message's id); a report can only be
--      sent by a signed-in account, as itself, at most 30 an hour per
--      account; the database quotes the reported message itself and refuses
--      a report about a message the reporter could not see or that the
--      reported person did not send; admin_reports() lists them for admins.
--      Nobody else can read feedback through the API, and feedback only
--      takes the kinds the app sends.
--   8. The leaderboard is opt-in. New rows default to off, and every row
--      whose student has not chosen to be shown since the 3 October app
--      update is taken off the board.
--   9. Students can leave an AlgeGroup, and a tutor can only add students
--      they may reach (rule 1) to a new one.
--  10. Classes belong to teachers. Only a teacher (or admin) account creates
--      a class, and "teaches this student" needs a teacher account. Nobody is
--      put on a roster unasked: a student joins with the class code or by
--      accepting a teacher's invite (invite_student_to_class,
--      my_class_invites, answer_class_invite). Before this, any account, a
--      student included, could make a class, add any student and read their
--      name, email and progress.
--  11. School-managed accounts. profiles.managed is set when a student joins
--      a class (and now, for every student already on a teacher's roster).
--      Only their teacher and admins may then message, ring or group them,
--      their help requests are hidden from tutors, and they leave the
--      leaderboard. The app turns school mode on for them wherever they sign
--      in. Only an admin clears it (set_managed).
--  12. Help requests. A tutor may take an open request, update one they took,
--      or close one; nobody but an admin changes a request's student, words
--      or time. A student may close their own.
--  13. Bios hold no contact details (a trigger), and students read tutors
--      through public.tutor_directory, without email; tutors' profile rows
--      are readable by staff only.
--  14. The leaderboard without ids. Students read public.leaderboard_public:
--      names, scores and an is_me flag, no user ids; the table shows each
--      student only their own row.
--
-- The app must ship BEFORE (or with) this file:
--   * Already changed (3 Oct), and safe before and after this file:
--     src/lib/social.ts reads students from student_directory and tutors
--     from tutor_directory, signs photo links, and reads profiles.managed;
--     src/lib/leaderboard.ts reads leaderboard_public; the report dialog
--     sends a message id; each falls back cleanly while this file is not run.
--   * NOT YET CHANGED, and needed, or the people named see blanks or errors:
--       - src/lib/sessions.ts, src/lib/calendar.ts and src/lib/groups.ts read
--         names from public.profiles; they need the same student_directory
--         and tutor_directory fallback as social.ts (tutors would see
--         "Member" or a blank name; a student would see "Member" for a tutor
--         in a group chat until the thread fills names in itself).
--       - src/components/Avatar.tsx and src/lib/auth.tsx show a stored
--         public photo link; they need signAvatarUrls() from social.ts, or
--         every photo breaks when the bucket goes private (step 6), a
--         student's own included.
--       - src/lib/teacher.ts adds students by inserting into class_members,
--         which step 10 refuses (with words a teacher can act on). It should
--         call invite_student_to_class and say "Invited"; and a student page
--         should list my_class_invites with Join and No thanks buttons
--         (answer_class_invite). Until then, students join with the code.
--   * The admin console has no Reports section yet; admin_reports() is
--     ready for it. Until then, read reports in the Table Editor (feedback,
--     kind = 'report').
--   * Nothing alerts anyone when a report arrives. Ivan picks the channel:
--     for example a Supabase Database Webhook on INSERT into public.feedback
--     (filter kind = 'report') that emails support@algebridge.org. That is
--     set up in the dashboard, not in this file.
-- ============================================================


-- ============================================================
-- 0. Steps that must run only once
-- ============================================================

create table if not exists public.safety_migration_steps (
  step    text primary key,
  done_at timestamptz not null default now()
);
alter table public.safety_migration_steps enable row level security;
-- No policies: nothing reads it through the API.


-- ============================================================
-- 1 and 2. Who may reach whom, and blocks
-- ============================================================

-- Blocks first: the contact rules read them.
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;

-- A student manages their own list. The person blocked is never told and
-- cannot read it.
drop policy if exists "Block list: read own" on public.user_blocks;
create policy "Block list: read own" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "Block list: add own" on public.user_blocks;
create policy "Block list: add own" on public.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "Block list: remove own" on public.user_blocks;
create policy "Block list: remove own" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- Has `blocker` blocked `blocked`? Only answered for a question about the
-- caller, so nobody can probe other people's lists.
create or replace function public.has_blocked(blocker uuid, blocked uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select (blocker = auth.uid() or blocked = auth.uid())
     and exists (select 1 from public.user_blocks b where b.blocker_id = blocker and b.blocked_id = blocked);
$$;
revoke all on function public.has_blocked(uuid, uuid) from public;
grant execute on function public.has_blocked(uuid, uuid) to authenticated;

-- School-managed accounts (rule 11). A student who joins a teacher's class
-- becomes managed: from then on only that teacher (and admins) may message,
-- ring or group them, wherever they sign in. Defined here because the contact
-- rules below read it.
alter table public.profiles add column if not exists managed boolean not null default false;

create or replace function public.profile_is_managed(uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select p.managed from public.profiles p where p.id = uid), false)
     and not exists (select 1 from public.admins a where a.user_id = uid);
$$;
revoke all on function public.profile_is_managed(uuid) from public;
grant execute on function public.profile_is_managed(uuid) to authenticated;

-- Is the caller a teacher (or an admin)? A class, a roster and a teacher's
-- reach all need it (rule 10). SECURITY DEFINER, so the classes policies can
-- ask it without reading profiles through RLS.
create or replace function public.caller_is_teacher()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
      or public.is_admin();
$$;
revoke all on function public.caller_is_teacher() from public;
grant execute on function public.caller_is_teacher() to authenticated;

-- May this staff account reach this student? Only answered when the caller is
-- one of the two (or an admin), and never when the student blocked them.
--   * an admin;
--   * their teacher: a TEACHER account with the student on a class roster;
--   * for a student who is not school-managed: a tutor who took (claimed or
--     scheduled) the student's request for help, or the tutor the student
--     named on a request in the last 14 days; or someone the student wrote
--     to first.
-- An open request with nobody named reaches nobody: any tutor may take it
-- (the request policy below), and taking it is what opens the conversation.
create or replace function public.staff_can_reach(staff uuid, student uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select staff is not null and student is not null and staff <> student
     and (staff = auth.uid() or student = auth.uid() or public.is_admin())
     and not exists (
       select 1 from public.user_blocks b where b.blocker_id = student and b.blocked_id = staff
     )
     and (
       (staff = auth.uid() and public.is_admin())
       or exists (select 1 from public.admins a where a.user_id = staff)
       or exists (
         select 1 from public.class_members cm
         join public.classes c on c.id = cm.class_id
         join public.profiles tp on tp.id = c.teacher_id and tp.role = 'teacher'
         where c.teacher_id = staff and cm.student_id = student
       )
       or (
         not public.profile_is_managed(student)
         and exists (select 1 from public.profiles p where p.id = staff and p.role = 'tutor')
         and exists (
           select 1 from public.session_requests sr
           where sr.student_id = student
             and (
               (sr.status in ('claimed', 'scheduled') and sr.claimed_by = staff)
               or (sr.status = 'open' and sr.preferred_tutor_id = staff
                   and sr.created_at > now() - interval '14 days')
             )
         )
       )
       or (
         not public.profile_is_managed(student)
         and exists (
           select 1 from public.direct_messages dm
           where dm.sender_id = student and dm.recipient_id = staff
         )
       )
     );
$$;
revoke all on function public.staff_can_reach(uuid, uuid) from public;
grant execute on function public.staff_can_reach(uuid, uuid) to authenticated;

-- May `sender` start or continue a conversation with `recipient`?
--   staff -> staff: yes. staff -> student: rule 1. student -> staff: yes,
--   except a school-managed student, who reaches only staff who may reach
--   them (their teacher, an admin). student -> student: never. A block on
--   either side: never.
create or replace function public.may_contact(sender uuid, recipient uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select sender = auth.uid() and recipient is not null and sender <> recipient
     and not public.has_blocked(recipient, sender)
     and not public.has_blocked(sender, recipient)
     and (
       (public.profile_is_staff(sender)
         and (public.profile_is_staff(recipient) or public.staff_can_reach(sender, recipient)))
       or (not public.profile_is_staff(sender) and public.profile_is_staff(recipient)
           and (not public.profile_is_managed(sender) or public.staff_can_reach(recipient, sender)))
     );
$$;
revoke all on function public.may_contact(uuid, uuid) from public;
grant execute on function public.may_contact(uuid, uuid) to authenticated;

-- Rings are stricter for students: a student's client only sends on a
-- staff member's ring channel to decline that person's call, so it may
-- only do so for staff who may reach them.
create or replace function public.may_ring(caller uuid, target uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select caller = auth.uid() and target is not null and caller <> target
     and not public.has_blocked(target, caller)
     and not public.has_blocked(caller, target)
     and (
       (public.profile_is_staff(caller)
         and (public.profile_is_staff(target) or public.staff_can_reach(caller, target)))
       or (not public.profile_is_staff(caller)
         and public.profile_is_staff(target)
         and public.staff_can_reach(target, caller))
     );
$$;
revoke all on function public.may_ring(uuid, uuid) from public;
grant execute on function public.may_ring(uuid, uuid) to authenticated;

-- May these two be in one call room? Neither has blocked the other, and one
-- of them may reach the other.
create or replace function public.pair_may_talk(a uuid, b uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select a is not null and b is not null and a <> b
     and (a = auth.uid() or b = auth.uid())
     and not exists (
       select 1 from public.user_blocks x
       where (x.blocker_id = a and x.blocked_id = b) or (x.blocker_id = b and x.blocked_id = a)
     )
     and (
       (public.profile_is_staff(a) and public.profile_is_staff(b))
       or (public.profile_is_staff(a) and public.staff_can_reach(a, b))
       or (public.profile_is_staff(b) and public.staff_can_reach(b, a))
     );
$$;
revoke all on function public.pair_may_talk(uuid, uuid) from public;
grant execute on function public.pair_may_talk(uuid, uuid) to authenticated;

-- ---- Direct messages -------------------------------------------
drop policy if exists "Send as self" on public.direct_messages;
drop policy if exists "Send as self to staff or as staff" on public.direct_messages;
drop policy if exists "Send within the contact rules" on public.direct_messages;
create policy "Send within the contact rules"
  on public.direct_messages for insert to authenticated
  with check (auth.uid() = sender_id and public.may_contact(sender_id, recipient_id));

-- Your own messages, and messages to you from anyone you have not blocked.
drop policy if exists "Read own conversations" on public.direct_messages;
create policy "Read own conversations"
  on public.direct_messages for select to authenticated
  using (
    auth.uid() = sender_id
    or (auth.uid() = recipient_id and not public.has_blocked(auth.uid(), sender_id))
  );

-- ---- Group messages: hidden from whoever blocked the sender -----
drop policy if exists "Members read group messages" on public.group_messages;
create policy "Members read group messages" on public.group_messages for select to authenticated
  using (public.is_group_member(group_id) and not public.has_blocked(auth.uid(), sender_id));

-- ---- Rings and call rooms -----------------------------------------
drop policy if exists "Ring send authenticated" on realtime.messages;
drop policy if exists "Ring send to staff or as staff" on realtime.messages;
drop policy if exists "Ring send within the contact rules" on realtime.messages;
create policy "Ring send within the contact rules"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'ring-%'
    and substring(realtime.topic() from 6) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.may_ring(auth.uid(), (substring(realtime.topic() from 6))::uuid)
  );

-- A room topic is 'room-<uuidA>--<uuidB>'. Only those two, and only when
-- they may talk.
create or replace function public.room_topic_allowed(topic text)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare
  ids text[];
begin
  if topic is null or topic not like 'room-%' then return false; end if;
  ids := string_to_array(substring(topic from 6), '--');
  if array_length(ids, 1) <> 2
     or ids[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or ids[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if auth.uid()::text <> all(ids) then return false; end if;
  return public.pair_may_talk(ids[1]::uuid, ids[2]::uuid);
end;
$$;
revoke all on function public.room_topic_allowed(text) from public;
grant execute on function public.room_topic_allowed(text) to authenticated;

drop policy if exists "Room participants read"  on realtime.messages;
drop policy if exists "Room participants write" on realtime.messages;
create policy "Room participants read"
  on realtime.messages for select to authenticated
  using (realtime.topic() like 'room-%' and public.room_topic_allowed(realtime.topic()));
create policy "Room participants write"
  on realtime.messages for insert to authenticated
  with check (realtime.topic() like 'room-%' and public.room_topic_allowed(realtime.topic()));


-- ============================================================
-- 3. No phone numbers or emails in a student's message
-- ============================================================

-- The app's own guard (src/lib/safety.ts) is broader and runs first; this is
-- the floor the database holds whatever client sends the row.
--
-- The text is read the way it looks on screen: full-width and other
-- compatibility digits folded (NFKC), Arabic-Indic and Persian digits read as
-- 0 to 9, and characters that print as nothing (soft hyphen, zero-width
-- spaces and joiners, direction marks, word joiner, byte order mark) taken
-- out, so "302<zero-width space>555<zero-width space>0142" is a phone number.
create or replace function public.contact_text(body text)
returns text
language sql immutable
as $$
  select regexp_replace(
    translate(normalize(coalesce(body, ''), NFKC), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
    E'[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]', '', 'g');
$$;

create or replace function public.text_has_contact_info(body text)
returns boolean
language sql immutable
as $$
  select coalesce(
    public.contact_text(body) ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}'
    -- 302-555-0142, (302) 555 0142, +1 302.555.0142, 3025550142
    or public.contact_text(body) ~ '(^|[^0-9.])(\+?1[ ._/-]*)?\(?[2-9][0-9]{2}\)?[ ._/-]*[0-9]{3}[ ._/-]*[0-9]{4}([^0-9]|$)'
    -- 302 555 01 42
    or public.contact_text(body) ~ '(^|[^0-9.])[2-9][0-9]{2}[ ._-][0-9]{3}[ ._-][0-9]{2}[ ._-][0-9]{2}([^0-9]|$)',
    false);
$$;

-- A student's message with contact details is refused, and so is one that
-- completes them: the sender's last three messages in the same conversation
-- from the last ten minutes are read joined to the new one, so "302", "555",
-- "0142" sent one at a time is refused at the third.
create or replace function public.guard_student_contact_info()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  recent text;
begin
  if public.profile_is_staff(new.sender_id) then
    return new;
  end if;
  if public.text_has_contact_info(new.body) then
    raise exception 'Messages from students cannot include phone numbers or email addresses.'
      using errcode = '22023';
  end if;
  if tg_table_name = 'direct_messages' then
    select string_agg(r.body, ' ' order by r.created_at) into recent
    from (
      select dm.body, dm.created_at from public.direct_messages dm
      where dm.sender_id = new.sender_id and dm.recipient_id = new.recipient_id
        and dm.created_at > now() - interval '10 minutes'
      order by dm.created_at desc
      limit 3
    ) r;
  else
    select string_agg(r.body, ' ' order by r.created_at) into recent
    from (
      select gm.body, gm.created_at from public.group_messages gm
      where gm.sender_id = new.sender_id and gm.group_id = new.group_id
        and gm.created_at > now() - interval '10 minutes'
      order by gm.created_at desc
      limit 3
    ) r;
  end if;
  if recent is not null
     and not public.text_has_contact_info(recent)
     and public.text_has_contact_info(recent || ' ' || new.body) then
    raise exception 'Messages from students cannot include phone numbers or email addresses.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_student_contact_info on public.direct_messages;
create trigger guard_student_contact_info before insert on public.direct_messages
  for each row execute function public.guard_student_contact_info();
drop trigger if exists guard_student_contact_info on public.group_messages;
create trigger guard_student_contact_info before insert on public.group_messages
  for each row execute function public.guard_student_contact_info();


-- ============================================================
-- 4. Messages kept for 90 days when an account is deleted
-- ============================================================

create table if not exists public.message_archive (
  id              uuid primary key default gen_random_uuid(),
  source          text not null check (source in ('direct', 'group')),
  message_id      uuid not null,
  sender_id       uuid,
  recipient_id    uuid,
  group_id        uuid,
  sender_name     text,
  sender_email    text,
  body            text not null,
  sent_at         timestamptz not null,
  deleted_user_id uuid not null,
  archived_at     timestamptz not null default now(),
  purge_after     timestamptz not null default (now() + interval '90 days'),
  unique (source, message_id)
);
create index if not exists message_archive_purge_idx on public.message_archive (purge_after);
create index if not exists message_archive_user_idx on public.message_archive (deleted_user_id, sent_at);
alter table public.message_archive enable row level security;
-- No policies: only admins read it, through admin_message_archive().

create or replace function public.archive_messages_before_user_delete()
returns trigger
language plpgsql security definer
set search_path = public, auth
as $$
begin
  insert into public.message_archive
    (source, message_id, sender_id, recipient_id, sender_name, sender_email, body, sent_at, deleted_user_id)
  select 'direct', dm.id, dm.sender_id, dm.recipient_id, p.display_name, u.email, dm.body, dm.created_at, old.id
  from public.direct_messages dm
  left join public.profiles p on p.id = dm.sender_id
  left join auth.users u on u.id = dm.sender_id
  where dm.sender_id = old.id or dm.recipient_id = old.id
  on conflict (source, message_id) do nothing;

  insert into public.message_archive
    (source, message_id, sender_id, group_id, sender_name, sender_email, body, sent_at, deleted_user_id)
  select 'group', gm.id, gm.sender_id, gm.group_id, p.display_name, u.email, gm.body, gm.created_at, old.id
  from public.group_messages gm
  left join public.profiles p on p.id = gm.sender_id
  left join auth.users u on u.id = gm.sender_id
  where gm.sender_id = old.id
  on conflict (source, message_id) do nothing;

  return old;
end;
$$;

drop trigger if exists archive_messages_before_user_delete on auth.users;
create trigger archive_messages_before_user_delete before delete on auth.users
  for each row execute function public.archive_messages_before_user_delete();

-- Admins only: what a deleted account said, for a safety review.
create or replace function public.admin_message_archive(p_user uuid default null)
returns setof public.message_archive
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select * from public.message_archive a
    where (p_user is null or a.deleted_user_id = p_user or a.sender_id = p_user or a.recipient_id = p_user)
      and a.purge_after > now()
    order by a.sent_at desc
    limit 1000;
end;
$$;
revoke all on function public.admin_message_archive(uuid) from public;
grant execute on function public.admin_message_archive(uuid) to authenticated;

-- Deletes what is past its 90 days. Runs daily when pg_cron is enabled
-- (below); an admin can also run it by hand.
create or replace function public.purge_message_archive()
returns integer
language plpgsql security definer
set search_path = public
as $$
declare n integer;
begin
  -- From the API every caller has a session (auth.uid()), and must be an
  -- admin. pg_cron and the SQL editor run with none. (current_user is no
  -- test here: inside a SECURITY DEFINER function it is always the owner.)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.message_archive where purge_after <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_message_archive() from public;
grant execute on function public.purge_message_archive() to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'purge-message-archive') then
      perform cron.schedule('purge-message-archive', '17 4 * * *', 'select public.purge_message_archive()');
    end if;
  else
    raise notice 'pg_cron is not enabled: run select public.purge_message_archive(); daily, or enable pg_cron and run this file again.';
  end if;
end;
$$;


-- ============================================================
-- 5. Tutors no longer read student emails
-- ============================================================

drop policy if exists "Tutors can read student profiles" on public.profiles;

-- Does the caller (staff) share a group chat with this person?
create or replace function public.shares_group_with(other uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;
revoke all on function public.shares_group_with(uuid) from public;
grant execute on function public.shares_group_with(uuid) to authenticated;

-- Names and photos of the students a staff account may see. No email column.
-- The view runs as its owner, so the WHERE clause is the whole rule.
create or replace view public.student_directory
with (security_barrier = true)
as
  select p.id, p.display_name, p.avatar_url, p.role
  from public.profiles p
  where p.role = 'student'
    and auth.uid() is not null
    and (
      public.is_admin()
      or (
        not exists (select 1 from public.user_blocks b where b.blocker_id = p.id and b.blocked_id = auth.uid())
        and (
          public.teaches_student(p.id)
          or (public.profile_is_staff(auth.uid())
              and (public.staff_can_reach(auth.uid(), p.id)
                   or (public.shares_group_with(p.id) and not public.profile_is_managed(p.id))))
        )
      )
    );
revoke all on public.student_directory from public, anon;
grant select on public.student_directory to authenticated;


-- ============================================================
-- 6. Photos are private
-- ============================================================

create or replace function public.can_see_avatar(object_name text)
returns boolean
language plpgsql security definer stable
set search_path = public, storage
as $$
declare
  folder text := (storage.foldername(object_name))[1];
  owner_id uuid;
begin
  if auth.uid() is null or folder is null
     or folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  owner_id := folder::uuid;
  return owner_id = auth.uid()
      or public.is_admin()
      or public.profile_is_staff(owner_id)
      or public.teaches_student(owner_id)
      or (public.profile_is_staff(auth.uid())
          and (public.staff_can_reach(auth.uid(), owner_id) or public.shares_group_with(owner_id)));
end;
$$;
revoke all on function public.can_see_avatar(text) from public;
grant execute on function public.can_see_avatar(text) to authenticated;

update storage.buckets set public = false where id = 'avatars';

drop policy if exists "Public avatar read" on storage.objects;
drop policy if exists "Avatar read by people who can see the profile" on storage.objects;
create policy "Avatar read by people who can see the profile"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_see_avatar(name));


-- ============================================================
-- 7. Reports
-- ============================================================

alter table public.feedback add column if not exists report_reason text;
alter table public.feedback add column if not exists report_where text;
alter table public.feedback add column if not exists reported_user_id uuid;
alter table public.feedback add column if not exists report_excerpt text;
-- The reported message itself (direct_messages for "dm:", group_messages for
-- "group:"), and when it was sent. With an id, the excerpt is the database's
-- own copy of that message, never the reporter's typing.
alter table public.feedback add column if not exists report_message_id uuid;
alter table public.feedback add column if not exists report_message_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_report_fields' and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback add constraint feedback_report_fields check (
      kind <> 'report'
      or (
        report_reason in ('bullying', 'personal-info', 'inappropriate', 'uncomfortable', 'other')
        and report_where is not null and char_length(report_where) <= 130
        and (report_excerpt is null or char_length(report_excerpt) <= 500)
      )
    ) not valid;
  end if;
end;
$$;

-- Only the kinds the app sends. A row of kind "Report " (with a space) would
-- read like a report to a person in the Table Editor and never reach
-- admin_reports(). NOT VALID: rows already stored are left alone.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_kind_known' and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback add constraint feedback_kind_known check (
      kind in ('review', 'broken', 'confusing', 'idea', 'problem', 'love', 'other', 'report')
    ) not valid;
  end if;
end;
$$;

create index if not exists feedback_reports_created_at_idx
  on public.feedback (created_at desc)
  where kind = 'report';

-- Who sent it comes from the session (the reviews file sets the same default).
alter table public.feedback alter column user_id set default auth.uid();

drop policy if exists "Anyone can leave feedback" on public.feedback;
create policy "Anyone can leave feedback"
  on public.feedback for insert to anon, authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and (kind <> 'report' or (auth.uid() is not null and user_id = auth.uid()))
  );
-- Still no select policy: nobody reads feedback through the API.

-- A report is checked as it arrives:
--   * one reporter, their own limit: 30 reports an hour (a school shares one
--     address, so this is per account, not per network);
--   * the excerpt is never the reporter's typing. With a message id, the
--     database looks the message up, refuses it unless the reporter could see
--     it (a side of the direct message, or a member of the group) and the
--     reported person sent it, and keeps its real words and time. Without
--     one, there is no excerpt.
-- The SQL editor and the service role (no session) are not checked.
create or replace function public.check_report()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  m_sender uuid;
  m_body text;
  m_at timestamptz;
  sent_lately integer;
begin
  if new.kind is distinct from 'report' or auth.uid() is null then
    return new;
  end if;
  select count(*) into sent_lately from public.feedback f
  where f.kind = 'report' and f.user_id = auth.uid() and f.created_at > now() - interval '1 hour';
  if sent_lately >= 30 then
    raise exception 'Too many reports in one hour. If you are in danger, call 911.' using errcode = '54000';
  end if;
  new.report_excerpt := null;
  new.report_message_sent_at := null;
  if new.report_message_id is not null then
    if new.report_where like 'dm:%' then
      select dm.sender_id, dm.body, dm.created_at into m_sender, m_body, m_at
      from public.direct_messages dm
      where dm.id = new.report_message_id and (dm.sender_id = auth.uid() or dm.recipient_id = auth.uid());
    elsif new.report_where like 'group:%' then
      select gm.sender_id, gm.body, gm.created_at into m_sender, m_body, m_at
      from public.group_messages gm
      where gm.id = new.report_message_id
        and exists (select 1 from public.group_members m where m.group_id = gm.group_id and m.user_id = auth.uid());
    end if;
    if m_sender is null then
      raise exception 'The reported message was not found in a conversation you are part of.' using errcode = '22023';
    end if;
    if new.reported_user_id is not null and new.reported_user_id <> m_sender then
      raise exception 'The reported message was sent by someone else.' using errcode = '22023';
    end if;
    new.reported_user_id := m_sender;
    new.report_excerpt := left(m_body, 500);
    new.report_message_sent_at := m_at;
  end if;
  return new;
end;
$$;

drop trigger if exists check_report on public.feedback;
create trigger check_report before insert on public.feedback
  for each row execute function public.check_report();

-- (Dropped first: an earlier draft of this file returned fewer columns.)
drop function if exists public.admin_reports(integer);
create or replace function public.admin_reports(p_limit integer default 100)
returns table (
  id uuid,
  created_at timestamptz,
  reason text,
  report_where text,
  excerpt text,
  message text,
  page text,
  reporter_id uuid,
  reporter_name text,
  reported_user_id uuid,
  reported_name text,
  reported_role text,
  message_id uuid,
  message_sent_at timestamptz
)
language plpgsql security definer stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    select f.id, f.created_at, f.report_reason, f.report_where, f.report_excerpt, f.message, f.page,
           f.user_id, rp.display_name, f.reported_user_id, tp.display_name, tp.role,
           f.report_message_id, f.report_message_sent_at
    from public.feedback f
    left join public.profiles rp on rp.id = f.user_id
    left join public.profiles tp on tp.id = f.reported_user_id
    where f.kind = 'report'
    order by f.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;
revoke all on function public.admin_reports(integer) from public;
grant execute on function public.admin_reports(integer) to authenticated;


-- ============================================================
-- 8. The leaderboard is opt-in
-- ============================================================

alter table public.leaderboard_stats alter column leaderboard_opt_in set default false;

-- Off the board unless the student's saved progress shows they chose to be
-- on it after the 3 October app update (which writes leaderboardOffByDefault
-- into every save, and leaderboardOptIn only when the student ticks the box).
update public.leaderboard_stats ls
set leaderboard_opt_in = false
where ls.leaderboard_opt_in
  and not exists (
    select 1 from public.user_progress up
    where up.user_id = ls.user_id
      and (up.progress_json ->> 'leaderboardOffByDefault') = 'true'
      and (up.progress_json ->> 'leaderboardOptIn') = 'true'
  );


-- ============================================================
-- 9. Group chats
-- ============================================================

-- A student can leave an AlgeGroup. (The All Tutors room is staff only.)
drop policy if exists "Members leave an AlgeGroup" on public.group_members;
create policy "Members leave an AlgeGroup" on public.group_members for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.groups g where g.id = group_id and g.kind = 'algegroup')
  );

-- A tutor makes a group only with students they may reach (rule 1).
create or replace function public.create_algegroup(group_name text, student_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid; sid uuid;
begin
  if not public.is_tutor() and not public.is_admin() then
    raise exception 'Only tutors can create AlgeGroups';
  end if;
  insert into public.groups (name, kind, created_by)
    values (coalesce(nullif(trim(group_name), ''), 'AlgeGroup'), 'algegroup', auth.uid())
    returning id into gid;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  if student_ids is not null then
    foreach sid in array student_ids loop
      if public.is_admin() or public.staff_can_reach(auth.uid(), sid) then
        insert into public.group_members (group_id, user_id) values (gid, sid) on conflict do nothing;
      end if;
    end loop;
  end if;
  return gid;
end $$;
revoke all on function public.create_algegroup(text, uuid[]) from public;
grant execute on function public.create_algegroup(text, uuid[]) to authenticated;


-- ============================================================
-- 10. Classes belong to teachers, and nobody is put in one unasked
-- ============================================================

-- Before this, any signed-in account (a student included) could create a
-- class, add any student id to it, and then read that student's name, email
-- and full progress through the teacher policies. Now:
--   * only a teacher (or an admin) creates or manages a class;
--   * "teaches this student" and "teaches this class" need a teacher account;
--   * a roster is only joined by the student: with the class code
--     (join_class_by_code) or by accepting an invite (answer_class_invite).
--     A teacher reads and removes their roster, and invites by email.

drop policy if exists "Teachers manage their own classes" on public.classes;
create policy "Teachers manage their own classes"
  on public.classes for all to authenticated
  using (auth.uid() = teacher_id and public.caller_is_teacher())
  with check (auth.uid() = teacher_id and public.caller_is_teacher());

create or replace function public.is_class_teacher(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.caller_is_teacher()
     and exists (select 1 from public.classes c where c.id = cid and c.teacher_id = auth.uid());
$$;

create or replace function public.teaches_student(sid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.caller_is_teacher()
     and exists (
       select 1
       from public.class_members cm
       join public.classes c on c.id = cm.class_id
       where c.teacher_id = auth.uid() and cm.student_id = sid
     );
$$;

drop policy if exists "Teachers manage members of their own classes" on public.class_members;
drop policy if exists "Teachers read their rosters" on public.class_members;
drop policy if exists "Teachers remove students from their classes" on public.class_members;
create policy "Teachers read their rosters"
  on public.class_members for select to authenticated
  using (public.is_class_teacher(class_id));
create policy "Teachers remove students from their classes"
  on public.class_members for delete to authenticated
  using (public.is_class_teacher(class_id));
-- No insert policy: rows arrive through the two functions below, which run
-- as their owner. (The student's own read and leave policies stay.)

-- Invites: a teacher adds a student by email, and the student says yes.
create table if not exists public.class_invites (
  class_id   uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
alter table public.class_invites enable row level security;
drop policy if exists "Invites: the student and the teacher read them" on public.class_invites;
create policy "Invites: the student and the teacher read them"
  on public.class_invites for select to authenticated
  using (student_id = auth.uid() or public.is_class_teacher(class_id));
drop policy if exists "Invites: the teacher withdraws, the student declines" on public.class_invites;
create policy "Invites: the teacher withdraws, the student declines"
  on public.class_invites for delete to authenticated
  using (student_id = auth.uid() or public.is_class_teacher(class_id));

-- A teacher invites a student account by email. Returns the student's name,
-- or raises when there is no such student. The student is not on the roster
-- until they accept.
create or replace function public.invite_student_to_class(p_class uuid, p_email text)
returns table (student_id uuid, display_name text)
language plpgsql security definer
set search_path = public
as $$
declare
  sid uuid;
  sname text;
begin
  if not public.is_class_teacher(p_class) then
    raise exception 'Only this class''s teacher can invite students' using errcode = '42501';
  end if;
  select p.id, p.display_name into sid, sname
  from public.profiles p
  where lower(p.email) = lower(trim(p_email)) and p.role = 'student'
  limit 1;
  if sid is null then
    raise exception 'No student account uses that email' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.class_members m where m.class_id = p_class and m.student_id = sid) then
    insert into public.class_invites (class_id, student_id, invited_by)
    values (p_class, sid, auth.uid())
    on conflict do nothing;
  end if;
  return query select sid, sname;
end;
$$;
revoke all on function public.invite_student_to_class(uuid, text) from public;
grant execute on function public.invite_student_to_class(uuid, text) to authenticated;

-- The student's open invites, with the class and teacher names.
create or replace function public.my_class_invites()
returns table (class_id uuid, class_name text, teacher_name text, invited_at timestamptz)
language sql security definer stable
set search_path = public
as $$
  select i.class_id, c.name, tp.display_name, i.created_at
  from public.class_invites i
  join public.classes c on c.id = i.class_id
  left join public.profiles tp on tp.id = c.teacher_id
  where i.student_id = auth.uid()
  order by i.created_at desc;
$$;
revoke all on function public.my_class_invites() from public;
grant execute on function public.my_class_invites() to authenticated;

-- A student joins a class they were invited to, or declines it.
create or replace function public.answer_class_invite(p_class uuid, p_accept boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.class_invites i where i.class_id = p_class and i.student_id = auth.uid()) then
    raise exception 'No invite to that class' using errcode = 'P0002';
  end if;
  delete from public.class_invites i where i.class_id = p_class and i.student_id = auth.uid();
  if p_accept then
    insert into public.class_members (class_id, student_id) values (p_class, auth.uid())
    on conflict do nothing;
    update public.profiles set managed = true
    where id = auth.uid() and role = 'student';
  end if;
end;
$$;
revoke all on function public.answer_class_invite(uuid, boolean) from public;
grant execute on function public.answer_class_invite(uuid, boolean) to authenticated;

-- Joining with the code, as before, now also makes the account school-managed.
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

  select c.id, c.name into v_class_id, v_class_name
  from public.classes c
  where c.join_code = upper(trim(p_code));

  if v_class_id is null then
    raise exception 'No class found with that code';
  end if;

  insert into public.class_members (class_id, student_id)
  values (v_class_id, auth.uid())
  on conflict on constraint class_members_pkey do nothing;
  delete from public.class_invites i where i.class_id = v_class_id and i.student_id = auth.uid();
  update public.profiles set managed = true
  where id = auth.uid() and role = 'student';

  return query select v_class_id, v_class_name;
end;
$$;
revoke all on function public.join_class_by_code(text) from public;
grant execute on function public.join_class_by_code(text) to authenticated;

-- A direct insert into a roster (the old "add by email") is refused with
-- words a teacher can act on. It runs before row security, so the teacher
-- reads this instead of "violates row-level security policy".
create or replace function public.guard_class_member_insert()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    raise exception 'Students now join a class themselves, so nobody is added without knowing. Share your class code with them.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_class_member_insert on public.class_members;
create trigger guard_class_member_insert before insert on public.class_members
  for each row execute function public.guard_class_member_insert();


-- ============================================================
-- 11. School-managed accounts
-- ============================================================

-- profiles.managed (added in section 1) is set by joining a class, and only
-- an admin can clear it. The account's owner cannot: a direct update from the
-- app keeps the old value. (This trigger runs as the caller, so current_user
-- is 'authenticated' for the app and the function owner inside the class
-- functions above.)
create or replace function public.guard_profile_managed()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.managed := false;
    else
      new.managed := old.managed;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_managed on public.profiles;
create trigger guard_profile_managed before insert or update on public.profiles
  for each row execute function public.guard_profile_managed();

-- Every student already on a roster is school-managed from today.
update public.profiles p set managed = true
where p.role = 'student' and not p.managed
  and exists (
    select 1 from public.class_members cm
    join public.classes c on c.id = cm.class_id
    join public.profiles tp on tp.id = c.teacher_id and tp.role = 'teacher'
    where cm.student_id = p.id
  );

-- An admin clears it (a student who joined a class by mistake).
create or replace function public.set_managed(target uuid, on_or_off boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.profiles set managed = on_or_off where id = target;
end;
$$;
revoke all on function public.set_managed(uuid, boolean) from public;
grant execute on function public.set_managed(uuid, boolean) to authenticated;


-- ============================================================
-- 12. Help requests: a tutor takes one, and cannot move it
-- ============================================================

-- Before this, any tutor could rewrite any request (student_id included) and
-- so make any student reachable. Now a tutor may take an open request, update
-- one they took, or close an open one; the student, the words and the time
-- of a request never change except by an admin; and a student may close
-- their own. Tutors no longer see requests from a student who blocked them,
-- or from a school-managed student.
drop policy if exists "Staff claim a request" on public.session_requests;
create policy "Staff claim a request" on public.session_requests
  for update to authenticated
  using ((public.is_tutor() and (status = 'open' or claimed_by = auth.uid())) or public.is_admin())
  with check (
    (public.is_tutor() and (claimed_by = auth.uid() or (status = 'closed' and claimed_by is null)))
    or public.is_admin()
  );

drop policy if exists "Students close their own requests" on public.session_requests;
create policy "Students close their own requests" on public.session_requests
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and status = 'closed');

-- May the calling tutor see this student's requests? Not when the student is
-- school-managed or blocked them. SECURITY DEFINER because a block row is
-- invisible to the person blocked; one answer covers both reasons, so it does
-- not tell a tutor which one applies.
create or replace function public.tutor_sees_requests_of(student uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.is_tutor()
     and not public.profile_is_managed(student)
     and not exists (select 1 from public.user_blocks b where b.blocker_id = student and b.blocked_id = auth.uid());
$$;
revoke all on function public.tutor_sees_requests_of(uuid) from public;
grant execute on function public.tutor_sees_requests_of(uuid) to authenticated;

drop policy if exists "Staff read every request" on public.session_requests;
create policy "Staff read every request" on public.session_requests
  for select to authenticated
  using (public.is_admin() or public.tutor_sees_requests_of(student_id));

create or replace function public.guard_session_request_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.student_id is distinct from old.student_id
     or new.availability is distinct from old.availability
     or new.preferred_tutor is distinct from old.preferred_tutor
     or new.preferred_tutor_id is distinct from old.preferred_tutor_id
     or new.topic is distinct from old.topic
     or new.created_at is distinct from old.created_at then
    raise exception 'A help request''s student, words and time cannot be changed.' using errcode = '42501';
  end if;
  -- The student who asked only closes it: they never take it themselves.
  if old.student_id = auth.uid() and not public.is_tutor()
     and (new.claimed_by is distinct from old.claimed_by or new.event_id is distinct from old.event_id) then
    raise exception 'You can close your request, not take it.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_session_request_update on public.session_requests;
create trigger guard_session_request_update before update on public.session_requests
  for each row execute function public.guard_session_request_update();


-- ============================================================
-- 13. Bios and tutor emails
-- ============================================================

-- A bio is shown to every student on a tutor's card: no phone number, email
-- address or social media username in it, whoever writes it.
create or replace function public.guard_profile_bio()
returns trigger
language plpgsql
as $$
begin
  if new.bio is not null
     and (tg_op = 'INSERT' or new.bio is distinct from old.bio)
     and (
       public.text_has_contact_info(new.bio)
       or public.contact_text(new.bio) ~* '(^|[^a-z0-9._%+-])@[a-z0-9_.]{3,}'
       or public.contact_text(new.bio) ~* '(snap(chat)?|insta(gram)?|discord|tik ?tok|whats ?app|telegram|kik)[[:space:]]*[:=@]'
     ) then
    raise exception 'A bio cannot include contact details.' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_bio on public.profiles;
create trigger guard_profile_bio before insert or update on public.profiles
  for each row execute function public.guard_profile_bio();

-- Students read tutors (and their own teachers) through this view: name,
-- photo, bio and role, never an email. The profile rows of tutors are now
-- readable by staff only.
drop policy if exists "Anyone can read tutor profiles" on public.profiles;
drop policy if exists "Staff read tutor profiles" on public.profiles;
create policy "Staff read tutor profiles"
  on public.profiles for select to authenticated
  using (role = 'tutor' and (public.profile_is_staff(auth.uid()) or public.is_admin()));

create or replace view public.tutor_directory
with (security_barrier = true)
as
  select p.id, p.display_name, p.avatar_url, p.bio, p.role
  from public.profiles p
  where auth.uid() is not null
    and (
      p.role = 'tutor'
      or (p.role = 'teacher' and exists (
        select 1 from public.class_members cm
        join public.classes c on c.id = cm.class_id
        where c.teacher_id = p.id and cm.student_id = auth.uid()
      ))
    );
revoke all on public.tutor_directory from public, anon;
grant select on public.tutor_directory to authenticated;


-- ============================================================
-- 14. The leaderboard without account ids
-- ============================================================

-- The board's rows held each student's user id, which is what let anyone
-- signed in message, ring or look a student up. Students now read the board
-- through this view: names, scores and an is_me flag, no ids, and nobody
-- school-managed. The table itself shows each student only their own row.
create or replace view public.leaderboard_public
with (security_barrier = true)
as
  select ls.display_name, ls.bridgeys, ls.completed_skills, ls.best_furniture_value,
         ls.best_furniture_name, ls.equipped_title, ls.leaderboard_opt_in, ls.updated_at,
         (ls.user_id = auth.uid()) as is_me
  from public.leaderboard_stats ls
  where ls.leaderboard_opt_in
    and auth.uid() is not null
    and not public.profile_is_managed(ls.user_id);
revoke all on public.leaderboard_public from public, anon;
grant select on public.leaderboard_public to authenticated;

drop policy if exists "Authenticated users can read opt-in leaderboard" on public.leaderboard_stats;
drop policy if exists "Read own leaderboard row" on public.leaderboard_stats;
create policy "Read own leaderboard row"
  on public.leaderboard_stats for select to authenticated
  using (auth.uid() = user_id or public.is_admin());


-- ============================================================
-- What happened
-- ============================================================
select 'leaderboard rows still shown' as what, count(*)::text as n
  from public.leaderboard_stats where leaderboard_opt_in
union all
select 'avatars bucket public', coalesce((select public::text from storage.buckets where id = 'avatars'), 'no bucket')
union all
select 'messages held for review', count(*)::text from public.message_archive
union all
select 'reports', count(*)::text from public.feedback where kind = 'report'
union all
select 'school-managed students', count(*)::text from public.profiles where managed
union all
select 'classes owned by an account that is not a teacher (their rosters now grant nothing)', count(*)::text
  from public.classes c
  where not exists (select 1 from public.profiles p where p.id = c.teacher_id and p.role = 'teacher')
    and not exists (select 1 from public.admins a where a.user_id = c.teacher_id);
