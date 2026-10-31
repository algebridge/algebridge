-- Alge Carts leaderboard (2026-10-31). Run AFTER schema-2026-10-14-leaderboard-merge.sql. Safe to run twice.
--
-- One row per racer. Students write their own row (their device's kart totals);
-- the tab hosting a lobby writes the bots' rows after each match, so the bots
-- have real careers and fill the board until enough students are on it.
-- The key is 'u:<user id>' for a student and 'b:<name>' for a bot.

create table if not exists public.carts_leaderboard (
  key text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  is_bot boolean not null default false,
  smashes integer not null default 0,
  wins integer not null default 0,
  matches integer not null default 0,
  best_streak integer not null default 0,
  xp integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint carts_leaderboard_kind check ((is_bot and user_id is null) or (not is_bot and user_id is not null)),
  constraint carts_leaderboard_sane check (smashes >= 0 and wins >= 0 and matches >= 0 and best_streak >= 0 and xp >= 0 and wins <= matches)
);

create index if not exists carts_leaderboard_smashes on public.carts_leaderboard (smashes desc, wins desc);

alter table public.carts_leaderboard enable row level security;

drop policy if exists "Signed-in students read the carts board" on public.carts_leaderboard;
create policy "Signed-in students read the carts board"
  on public.carts_leaderboard for select to authenticated
  using (true);

drop policy if exists "Students write their own carts row" on public.carts_leaderboard;
create policy "Students write their own carts row"
  on public.carts_leaderboard for all to authenticated
  using (user_id = auth.uid() and not is_bot)
  with check (user_id = auth.uid() and not is_bot and key = 'u:' || auth.uid()::text);

drop policy if exists "A lobby host writes the bots' rows" on public.carts_leaderboard;
create policy "A lobby host writes the bots' rows"
  on public.carts_leaderboard for all to authenticated
  using (is_bot)
  with check (is_bot and user_id is null and key = 'b:' || name);

revoke all on public.carts_leaderboard from anon;
grant select, insert, update on public.carts_leaderboard to authenticated;

select count(*) as carts_rows from public.carts_leaderboard;
