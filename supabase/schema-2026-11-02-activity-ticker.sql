-- AlgeBridge: activity ticker (2026-11-02)
--
-- One running line under the header on every page: "Ava solved a problem",
-- "Shaurya earned 25 Bridgeys", "Liam finished Two-Step Equations". The
-- browser posts a student's moment with post_activity() and every signed-in
-- page reads the latest with recent_activity(), polling every 20 seconds.
--
-- Idempotent. Run AFTER schema-2026-09-22.sql (profiles with tidy "First
-- Last" names) and schema-2026-10-11-leaderboard-on.sql (leaderboard_stats
-- with leaderboard_opt_in).
--
-- Privacy: a row carries the student's FIRST NAME only, taken here from the
-- profile (the browser never names anyone), the kind of moment, a number
-- and a short title from the curriculum or the shop. Rows are only written
-- for students who are on the leaderboard (the same choice that already
-- shows "First L." to other students), only read by signed-in accounts, and
-- never hand out an account id. Rows older than two days are forgotten.

-- ---- 1. Table ---------------------------------------------------

create table if not exists public.activity_feed (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  kind       text not null,
  amount     integer,
  detail     text,
  constraint activity_feed_kind_check   check (kind in ('solved', 'bridgeys', 'skill', 'unit', 'bought', 'game')),
  constraint activity_feed_amount_check check (amount is null or (amount >= 1 and amount <= 100000)),
  constraint activity_feed_detail_check check (detail is null or length(detail) between 1 and 48),
  constraint activity_feed_name_check   check (length(first_name) between 1 and 30)
);

create index if not exists activity_feed_user_at_idx on public.activity_feed (user_id, at desc);
create index if not exists activity_feed_at_idx      on public.activity_feed (at);

alter table public.activity_feed enable row level security;
-- No policies: nothing reads or writes the table except the two functions below.
revoke all on table public.activity_feed from anon, authenticated;

-- ---- 2. Posting a moment -------------------------------------------

create or replace function public.post_activity(
  p_kind   text,
  p_amount integer default null,
  p_detail text default null
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  nm      text;
  last_at timestamptz;
  title   constant text := '^[[:alnum:] ,.''’&:()-]{1,48}$';
begin
  if uid is null then
    return;
  end if;
  if p_kind is null or p_kind not in ('solved', 'bridgeys', 'skill', 'unit', 'bought', 'game') then
    return;
  end if;

  -- What each kind carries. Anything else on the row is dropped, not stored.
  if p_kind = 'bridgeys' then
    if p_amount is null or p_amount < 1 or p_amount > 100000 then return; end if;
    p_detail := null;
  elsif p_kind = 'solved' then
    p_amount := null;
    p_detail := null;
  else
    if p_detail is null or p_detail !~ title then return; end if;
    p_amount := null;
  end if;

  -- The first name comes from the profile, never from the browser; students only.
  select split_part(btrim(coalesce(p.display_name, '')), ' ', 1)
    into nm
    from public.profiles p
   where p.id = uid and p.role = 'student';
  if nm is null or nm = '' or length(nm) > 30 or nm !~ '^[[:alpha:]''’.-]+$' then
    return;
  end if;

  -- Only students who are on the leaderboard: hiding from the board hides from the ticker too.
  if not exists (
    select 1 from public.leaderboard_stats s where s.user_id = uid and s.leaderboard_opt_in
  ) then
    return;
  end if;

  -- One row every two seconds per account; a script writing faster is dropped.
  select max(f.at) into last_at from public.activity_feed f where f.user_id = uid;
  if last_at is not null and last_at > now() - interval '2 seconds' then
    return;
  end if;

  insert into public.activity_feed (user_id, first_name, kind, amount, detail)
  values (uid, nm, p_kind, p_amount, p_detail);

  -- Housekeeping, now and then: rows older than two days are forgotten.
  if random() < 0.02 then
    delete from public.activity_feed f where f.at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function public.post_activity(text, integer, text) from public, anon;
grant execute on function public.post_activity(text, integer, text) to authenticated;

-- ---- 3. Reading the latest -----------------------------------------

create or replace function public.recent_activity(
  p_after bigint default 0,
  p_limit integer default 40
)
returns table (
  id         bigint,
  at         timestamptz,
  first_name text,
  kind       text,
  amount     integer,
  detail     text
)
language sql security definer stable
set search_path = public
as $$
  select f.id, f.at, f.first_name, f.kind, f.amount, f.detail
    from public.activity_feed f
   where auth.uid() is not null
     and f.id > coalesce(p_after, 0)
     and f.at > now() - interval '2 days'
   order by f.id desc
   limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.recent_activity(bigint, integer) from public, anon;
grant execute on function public.recent_activity(bigint, integer) to authenticated;

select count(*) as activity_rows from public.activity_feed;
