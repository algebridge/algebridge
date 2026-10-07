-- ============================================================
-- Notifications on a phone or computer, even with AlgeBridge closed
-- (Web Push). Apply after schema-2026-09-22.sql. Safe to run twice.
--
-- A browser that turns notifications on gets a push "subscription": an
-- endpoint at its push service (Google, Mozilla, Apple) and two keys. Only
-- AlgeBridge's server can send to it (it signs with VAPID_PRIVATE_KEY), and
-- the server only learns a subscription through the functions below, which
-- hand it over only when the signed-in sender may reach that person:
--   * a message: the sender wrote that very message, in the last 2 minutes;
--   * a call: the caller and the person rung are both in the call room, and
--     one of them is staff (the same rule as the live ring channel policy).
-- Nothing here reads a message for anyone but its sender.
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint like 'https://%' and char_length(endpoint) < 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) < 200),
  auth text not null check (char_length(auth) < 100),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

-- People see and remove only their own devices. Saving goes through
-- save_push_subscription, so one browser belongs to whoever signed in last
-- (a shared Chromebook never keeps pinging the previous student).
drop policy if exists "Own devices read" on public.push_subscriptions;
create policy "Own devices read" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Own devices delete" on public.push_subscriptions;
create policy "Own devices delete" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  -- At most 10 devices a person.
  if (select count(*) from public.push_subscriptions where user_id = auth.uid() and endpoint <> p_endpoint) >= 10 then
    delete from public.push_subscriptions
    where endpoint = (select endpoint from public.push_subscriptions where user_id = auth.uid()
                      order by coalesce(last_sent_at, created_at) asc limit 1);
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- A push service said a device is gone (404/410): forget it. Knowing the
-- endpoint is proof enough; it is a long random URL only its device and
-- this server hold.
create or replace function public.forget_push_endpoint(p_endpoint text)
returns void
language sql security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;
revoke all on function public.forget_push_endpoint(text) from public;
grant execute on function public.forget_push_endpoint(text) to authenticated;

-- Has one of these two blocked the other? The block table arrives with
-- schema-2026-10-03-safety.sql; before then, nobody has.
create or replace function public.push_blocked(a uuid, b uuid)
returns boolean
language plpgsql security definer stable
set search_path = public
as $$
declare hit boolean := false;
begin
  if to_regclass('public.user_blocks') is null then return false; end if;
  execute 'select exists (select 1 from public.user_blocks x
             where (x.blocker_id = $1 and x.blocked_id = $2) or (x.blocker_id = $2 and x.blocked_id = $1))'
    into hit using a, b;
  return hit;
end;
$$;
revoke all on function public.push_blocked(uuid, uuid) from public;

-- The recipient's devices for a message the caller just sent.
create or replace function public.push_targets_for_message(p_message uuid)
returns table (endpoint text, p256dh text, auth text, sender_id uuid, sender_name text, body text)
language plpgsql security definer
set search_path = public
as $$
declare m record;
begin
  select dm.sender_id, dm.recipient_id, dm.body into m
  from public.direct_messages dm
  where dm.id = p_message and dm.sender_id = auth.uid() and dm.created_at > now() - interval '2 minutes';
  if not found or public.push_blocked(m.sender_id, m.recipient_id) then return; end if;
  update public.push_subscriptions s set last_sent_at = now() where s.user_id = m.recipient_id;
  return query
    select s.endpoint, s.p256dh, s.auth, m.sender_id,
           coalesce(nullif(trim(p.display_name), ''), 'Your tutor'), m.body
    from public.push_subscriptions s
    left join public.profiles p on p.id = m.sender_id
    where s.user_id = m.recipient_id;
end;
$$;
revoke all on function public.push_targets_for_message(uuid) from public;
grant execute on function public.push_targets_for_message(uuid) to authenticated;

-- The devices of someone being rung into a call room. The room is the topic
-- the call uses: 'room-' and the member ids, sorted, joined by '--'.
create or replace function public.push_targets_for_ring(p_target uuid, p_room text)
returns table (endpoint text, p256dh text, auth text, caller_name text, members int)
language plpgsql security definer
set search_path = public
as $$
declare ids text[];
begin
  if auth.uid() is null or p_target is null or p_target = auth.uid() then return; end if;
  ids := string_to_array(p_room, '--');
  if array_length(ids, 1) is null or array_length(ids, 1) < 2 or array_length(ids, 1) > 8 then return; end if;
  if not (auth.uid()::text = any(ids) and p_target::text = any(ids)) then return; end if;
  if not (public.profile_is_staff(auth.uid()) or public.profile_is_staff(p_target)) then return; end if;
  if public.push_blocked(auth.uid(), p_target) then return; end if;
  update public.push_subscriptions s set last_sent_at = now() where s.user_id = p_target;
  return query
    select s.endpoint, s.p256dh, s.auth,
           coalesce(nullif(trim(p.display_name), ''), 'Your tutor'), array_length(ids, 1)
    from public.push_subscriptions s
    left join public.profiles p on p.id = auth.uid()
    where s.user_id = p_target;
end;
$$;
revoke all on function public.push_targets_for_ring(uuid, text) from public;
grant execute on function public.push_targets_for_ring(uuid, text) to authenticated;
