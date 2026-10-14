-- One student, one place on the board, Oct 14 2026.
--
-- Some students made more than one account (Ivan asked: "combine every
-- account that has the same name ... and their bridgeys"). The board now
-- shows one row per person instead of one per account. Nothing about the
-- accounts themselves changes: their progress, sign-ins and leaderboard_stats
-- rows stay as they are, and dropping this view's grouping undoes it.
--
-- Who is the same person:
--   - accounts whose profile carries the same full name (case and spacing
--     ignored), and
--   - accounts linked by hand in public.leaderboard_links, for spellings that
--     differ (Zack Balan and Zach Balan).
--
-- How a person's row is built from their opted-in accounts:
--   bridgeys              the sum (lifetime Bridgeys of each account)
--   completed_skills      skills done on ANY of the accounts, each counted once
--   best_furniture_*      the best piece across them
--   name, title, house,   from the account used most recently
--   character, plots
--   is_me                 true when any of the accounts is the viewer's
--
-- This view is also no longer writable. The old one was a plain view of the
-- table, and signed-in users held write grants on it; a write through a view
-- runs with the view owner's rights, which skip the table's row policies.

create table if not exists public.leaderboard_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  person_key text not null check (person_key = lower(person_key) and length(person_key) between 1 and 120),
  note text,
  created_at timestamptz not null default now()
);
alter table public.leaderboard_links enable row level security;
drop policy if exists "Admins manage leaderboard links" on public.leaderboard_links;
create policy "Admins manage leaderboard links" on public.leaderboard_links
  for all using (public.is_admin()) with check (public.is_admin());
revoke all on public.leaderboard_links from anon;

-- Zack Balan's account joins Zach Balan's. Zachary Balan is a tutor account
-- with no board row; linked too, so it joins if it ever gets one.
insert into public.leaderboard_links (user_id, person_key, note) values
  ('050afd88-3df3-4d26-9d02-a8b82f0dbb3f', 'zach balan', 'Zack Balan, same student'),
  ('097395a1-a4f5-4b96-ba52-bd35263cfe6d', 'zach balan', 'Zachary Balan, same student')
on conflict (user_id) do update set person_key = excluded.person_key, note = excluded.note;

drop view if exists public.leaderboard_public;
create view public.leaderboard_public with (security_barrier = true) as
with accts as (
  select ls.*,
         coalesce(
           lk.person_key,
           nullif(lower(regexp_replace(trim(p.display_name), '\s+', ' ', 'g')), ''),
           ls.user_id::text
         ) as person
    from public.leaderboard_stats ls
    left join public.leaderboard_links lk on lk.user_id = ls.user_id
    left join public.profiles p on p.id = ls.user_id
   where ls.leaderboard_opt_in
     and auth.uid() is not null
     and not public.profile_is_managed(ls.user_id)
),
latest as (
  select distinct on (person) person, display_name, equipped_title, house_style, avatar, city_plots
    from accts
   order by person, updated_at desc
),
best as (
  select distinct on (person) person, best_furniture_value, best_furniture_name
    from accts
   order by person, best_furniture_value desc, updated_at desc
),
skills as (
  select a.person, count(distinct s.key)::int as done
    from accts a
    join public.user_progress up on up.user_id = a.user_id
    cross join lateral jsonb_each(case when jsonb_typeof(up.progress_json -> 'skills') = 'object' then up.progress_json -> 'skills' else '{}'::jsonb end) s
   where s.value ->> 'level' in ('proficient', 'mastered')
   group by a.person
),
totals as (
  select person,
         sum(bridgeys)::int as bridgeys,
         max(completed_skills)::int as most_skills,
         max(updated_at) as updated_at,
         bool_or(user_id = auth.uid()) as is_me
    from accts
   group by person
)
select l.display_name,
       t.bridgeys,
       greatest(coalesce(sk.done, 0), t.most_skills) as completed_skills,
       b.best_furniture_value,
       b.best_furniture_name,
       l.equipped_title,
       true as leaderboard_opt_in,
       t.updated_at,
       t.is_me,
       l.house_style,
       l.avatar,
       l.city_plots
  from totals t
  join latest l using (person)
  join best b using (person)
  left join skills sk using (person);

revoke all on public.leaderboard_public from public, anon, authenticated;
grant select on public.leaderboard_public to authenticated;

-- Check: one row per person, and who was combined.
select count(*) as rows_on_board from public.leaderboard_public;
