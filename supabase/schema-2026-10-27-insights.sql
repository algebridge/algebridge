-- AlgeBridge: learning insights (2026-10-27)
--
-- What students actually do on the platform, so the team can see which
-- units take the most time, how long one problem takes, how long a skill
-- takes, how much Archie is used, how much the games are played, and how
-- students say they feel while using the site.
--
-- Idempotent. Run AFTER schema-admin-console.sql (public.is_admin()) and
-- schema-2026-10-05-console.sql (public.traffic_today()).
--
-- Privacy: a row carries the same daily random visitor id the page-view
-- counts use (src/lib/traffic.ts), never an account id, name, email or IP
-- address. The browser makes a new id every day, so nothing here can follow
-- one student from one day to the next. Admins' own activity is left out by
-- the browser. Each row is one small fact: which skill, how many seconds,
-- right or wrong, a mood from 1 to 5. No free text is stored.

-- ---- 1. Table ---------------------------------------------------

create table if not exists public.learning_events (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  day       date not null,
  visitor   uuid not null,
  role      text not null default 'guest',
  name      text not null,
  course    text,
  unit      text,
  skill     text,
  label     text,
  value     numeric,
  ok        boolean,
  first     boolean,
  n         integer,
  constraint learning_events_role_check  check (role in ('student', 'teacher', 'tutor', 'guest')),
  constraint learning_events_name_check  check (name in (
    'problem_attempt', 'problem_skip', 'skill_time', 'archie_open', 'archie_message',
    'game_start', 'game_end', 'mood', 'mood_dismiss'
  )),
  constraint learning_events_value_check check (value is null or (value >= 0 and value <= 100000))
);

create index if not exists learning_events_day_idx         on public.learning_events (day);
create index if not exists learning_events_name_day_idx    on public.learning_events (name, day);
create index if not exists learning_events_day_visitor_idx on public.learning_events (day, visitor);

alter table public.learning_events enable row level security;
-- No policies: nothing reads or writes the table except the two functions below.
revoke all on table public.learning_events from anon, authenticated;

-- ---- 2. Recording ------------------------------------------------

create or replace function public.record_learning_event(
  p_visitor uuid,
  p_role    text,
  p_name    text,
  p_course  text default null,
  p_unit    text default null,
  p_skill   text default null,
  p_label   text default null,
  p_value   numeric default null,
  p_ok      boolean default null,
  p_first   boolean default null,
  p_n       integer default null
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  d     date := public.traffic_today();
  slug  constant text := '^[a-z0-9_-]{1,60}$';
  today_rows integer;
begin
  if p_visitor is null
     or p_name is null or p_name not in (
       'problem_attempt', 'problem_skip', 'skill_time', 'archie_open', 'archie_message',
       'game_start', 'game_end', 'mood', 'mood_dismiss')
     or (p_course is not null and p_course !~ slug)
     or (p_unit   is not null and p_unit   !~ slug)
     or (p_skill  is not null and p_skill  !~ slug)
     or (p_label  is not null and p_label  !~ slug)
     or (p_value  is not null and (p_value < 0 or p_value > 100000))
     or (p_n      is not null and (p_n < 0 or p_n > 100000)) then
    return;
  end if;

  -- One browser writes at most 3000 facts a day; a script writing more is dropped.
  select count(*) into today_rows from public.learning_events where day = d and visitor = p_visitor;
  if today_rows >= 3000 then
    return;
  end if;

  insert into public.learning_events (day, visitor, role, name, course, unit, skill, label, value, ok, first, n)
  values (
    d, p_visitor,
    case when p_role in ('student', 'teacher', 'tutor') then p_role else 'guest' end,
    p_name, p_course, p_unit, p_skill, p_label, p_value, p_ok, p_first, p_n
  );

  -- Keep about 13 months.
  if random() < 0.002 then
    delete from public.learning_events where day < d - 400;
  end if;
end;
$$;

revoke all on function public.record_learning_event(uuid, text, text, text, text, text, text, numeric, boolean, boolean, integer) from public, anon, authenticated;
grant execute on function public.record_learning_event(uuid, text, text, text, text, text, text, numeric, boolean, boolean, integer) to anon, authenticated;

-- ---- 3. admin_insights() ----------------------------------------

create or replace function public.admin_insights(p_days integer default 30)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  d_end   date := public.traffic_today();
  span    integer := least(greatest(coalesce(p_days, 30), 7), 120);
  d_start date := d_end - (span - 1);
  result  jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  with e as (
    select * from public.learning_events where day between d_start and d_end
  ),
  -- Every browser-day that did at least one thing here.
  active as (
    select day, visitor from e group by day, visitor
  ),
  -- Seconds on one skill by one browser on one day.
  skill_visits as (
    select day, visitor, course, unit, skill, sum(value) as seconds, sum(coalesce(n, 0)) as answered
    from e where name = 'skill_time' and value is not null and skill is not null
    group by day, visitor, course, unit, skill
  ),
  -- Seconds to the right answer, per problem: the attempt that was right.
  solved as (
    select course, unit, skill, label, value as seconds, first
    from e where name = 'problem_attempt' and ok and value is not null
  ),
  attempts as (
    select course, unit, skill, label, ok, first, value as seconds
    from e where name = 'problem_attempt'
  ),
  archie as (
    select day, visitor, label as mode, value as chars, skill
    from e where name = 'archie_message'
  ),
  games_started as (
    select day, visitor, label as game, n as players from e where name = 'game_start'
  ),
  games_ended as (
    select day, visitor, label as game, value as seconds, n as answered from e where name = 'game_end'
  ),
  moods as (
    select day, visitor, label as context, value::int as mood, at from e where name = 'mood' and value between 1 and 5
  )
  select jsonb_build_object(
    'today', d_end,
    'from', d_start,
    'first_day', (select min(day) from public.learning_events),
    'totals', jsonb_build_object(
      'active_days',     (select count(*) from active),
      'events',          (select count(*) from e),
      'problems_solved', (select count(*) from solved),
      'attempts',        (select count(*) from attempts),
      'first_try_rate',  (select round(avg(case when first then 1 else 0 end)::numeric, 3) from solved),
      'skill_seconds',   (select coalesce(sum(seconds), 0) from skill_visits)
    ),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', g.day,
               'active',   coalesce(a.n, 0),
               'solved',   coalesce(s.n, 0),
               'archie',   coalesce(ar.n, 0),
               'games',    coalesce(gm.n, 0),
               'mood',     m.avg_mood,
               'seconds',  coalesce(sv.seconds, 0)
             ) order by g.day), '[]'::jsonb)
      from (select generate_series(d_start::timestamp, d_end::timestamp, interval '1 day')::date as day) g
      left join (select day, count(*) as n from active group by day) a on a.day = g.day
      left join (select day, count(*) as n from e where name = 'problem_attempt' and ok group by day) s on s.day = g.day
      left join (select day, count(*) as n from archie group by day) ar on ar.day = g.day
      left join (select day, count(*) as n from games_started group by day) gm on gm.day = g.day
      left join (select day, round(avg(mood)::numeric, 2) as avg_mood from moods group by day) m on m.day = g.day
      left join (select day, sum(seconds) as seconds from skill_visits group by day) sv on sv.day = g.day
    ),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'course', u.course, 'unit', u.unit,
               'seconds', u.seconds, 'visits', u.visits, 'browsers', u.browsers,
               'solved', coalesce(s.solved, 0),
               'first_try_rate', s.first_try_rate,
               'median_problem_seconds', s.median_seconds
             ) order by u.seconds desc, u.unit), '[]'::jsonb)
      from (
        select course, unit, sum(seconds) as seconds, count(*) as visits, count(distinct (day, visitor)) as browsers
        from skill_visits where unit is not null group by course, unit
      ) u
      left join (
        select unit, count(*) as solved,
               round(avg(case when first then 1 else 0 end)::numeric, 3) as first_try_rate,
               round(percentile_cont(0.5) within group (order by seconds)::numeric, 1) as median_seconds
        from solved group by unit
      ) s on s.unit = u.unit
    ),
    'skills', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'course', k.course, 'unit', k.unit, 'skill', k.skill,
               'seconds', k.seconds, 'visits', k.visits,
               'median_visit_seconds', k.median_visit_seconds,
               'solved', coalesce(s.solved, 0),
               'first_try_rate', s.first_try_rate,
               'median_problem_seconds', s.median_seconds,
               'skips', coalesce(sk.n, 0)
             ) order by k.seconds desc, k.skill), '[]'::jsonb)
      from (
        select course, unit, skill, sum(seconds) as seconds, count(*) as visits,
               round(percentile_cont(0.5) within group (order by seconds)::numeric, 0) as median_visit_seconds,
               row_number() over (order by sum(seconds) desc, skill) as rk
        from skill_visits group by course, unit, skill
      ) k
      left join (
        select skill, count(*) as solved,
               round(avg(case when first then 1 else 0 end)::numeric, 3) as first_try_rate,
               round(percentile_cont(0.5) within group (order by seconds)::numeric, 1) as median_seconds
        from solved group by skill
      ) s on s.skill = k.skill
      left join (select skill, count(*) as n from e where name = 'problem_skip' group by skill) sk on sk.skill = k.skill
      where k.rk <= 40
    ),
    'hardest', (
      -- Skills with the lowest first-try rate, among those with enough answers to mean something.
      select coalesce(jsonb_agg(jsonb_build_object(
               'skill', h.skill, 'unit', h.unit, 'solved', h.solved, 'first_try_rate', h.first_try_rate,
               'median_problem_seconds', h.median_seconds
             ) order by h.first_try_rate, h.skill), '[]'::jsonb)
      from (
        select skill, min(unit) as unit, count(*) as solved,
               round(avg(case when first then 1 else 0 end)::numeric, 3) as first_try_rate,
               round(percentile_cont(0.5) within group (order by seconds)::numeric, 1) as median_seconds,
               row_number() over (order by avg(case when first then 1 else 0 end), skill) as rk
        from solved where skill is not null group by skill having count(*) >= 10
      ) h where h.rk <= 10
    ),
    'problem', jsonb_build_object(
      'median_seconds', (select round(percentile_cont(0.5)  within group (order by seconds)::numeric, 1) from solved),
      'p25_seconds',    (select round(percentile_cont(0.25) within group (order by seconds)::numeric, 1) from solved),
      'p75_seconds',    (select round(percentile_cont(0.75) within group (order by seconds)::numeric, 1) from solved),
      'skips',          (select count(*) from e where name = 'problem_skip'),
      'reveals',        (select count(*) from e where name = 'problem_skip' and label = 'revealed'),
      'by_type', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'type', t.type, 'solved', t.solved, 'median_seconds', t.median_seconds, 'first_try_rate', t.first_try_rate
               ) order by t.solved desc), '[]'::jsonb)
        from (
          select coalesce(label, 'other') as type, count(*) as solved,
                 round(percentile_cont(0.5) within group (order by seconds)::numeric, 1) as median_seconds,
                 round(avg(case when first then 1 else 0 end)::numeric, 3) as first_try_rate
          from solved group by coalesce(label, 'other')
        ) t
      )
    ),
    'skill_visit', jsonb_build_object(
      'median_seconds', (select round(percentile_cont(0.5) within group (order by seconds)::numeric, 0) from skill_visits),
      'mean_seconds',   (select round(avg(seconds)::numeric, 0) from skill_visits),
      'visits',         (select count(*) from skill_visits)
    ),
    'archie', jsonb_build_object(
      'messages',      (select count(*) from archie),
      'opens',         (select count(*) from e where name = 'archie_open'),
      'talking_days',  (select count(distinct (day, visitor)) from archie),
      'active_days',   (select count(*) from active),
      'median_per_talking_day', (
        select round(percentile_cont(0.5) within group (order by n)::numeric, 1)
        from (select count(*) as n from archie group by day, visitor) x
      ),
      'median_chars',  (select round(percentile_cont(0.5) within group (order by chars)::numeric, 0) from archie where chars is not null),
      'by_mode', (
        select coalesce(jsonb_agg(jsonb_build_object('mode', m.mode, 'n', m.n) order by m.n desc), '[]'::jsonb)
        from (select coalesce(mode, 'tutor') as mode, count(*) as n from archie group by coalesce(mode, 'tutor')) m
      ),
      'top_skills', (
        select coalesce(jsonb_agg(jsonb_build_object('skill', s.skill, 'n', s.n) order by s.n desc, s.skill), '[]'::jsonb)
        from (
          select skill, count(*) as n, row_number() over (order by count(*) desc, skill) as rk
          from archie where skill is not null group by skill
        ) s where s.rk <= 12
      )
    ),
    'games', jsonb_build_object(
      'starts',       (select count(*) from games_started),
      'ends',         (select count(*) from games_ended),
      'playing_days', (select count(distinct (day, visitor)) from games_started),
      'active_days',  (select count(*) from active),
      'matches',      (select count(*) from games_started where players = 2),
      'median_seconds', (select round(percentile_cont(0.5) within group (order by seconds)::numeric, 0) from games_ended where seconds is not null),
      'total_seconds',  (select coalesce(sum(seconds), 0) from games_ended),
      'answered',       (select coalesce(sum(answered), 0) from games_ended),
      'by_game', (
        select coalesce(jsonb_agg(jsonb_build_object('game', g.game, 'starts', g.starts, 'seconds', coalesce(x.seconds, 0)) order by g.starts desc), '[]'::jsonb)
        from (select coalesce(game, 'unknown') as game, count(*) as starts from games_started group by coalesce(game, 'unknown')) g
        left join (select coalesce(game, 'unknown') as game, sum(seconds) as seconds from games_ended group by coalesce(game, 'unknown')) x on x.game = g.game
      )
    ),
    'mood', jsonb_build_object(
      'answered',  (select count(*) from moods),
      'dismissed', (select count(*) from e where name = 'mood_dismiss'),
      'mean',      (select round(avg(mood)::numeric, 2) from moods),
      'counts', (
        select coalesce(jsonb_agg(jsonb_build_object('mood', c.mood, 'n', coalesce(m.n, 0)) order by c.mood), '[]'::jsonb)
        from (select generate_series(1, 5) as mood) c
        left join (select mood, count(*) as n from moods group by mood) m on m.mood = c.mood
      ),
      'by_context', (
        select coalesce(jsonb_agg(jsonb_build_object('context', x.context, 'n', x.n, 'mean', x.mean) order by x.n desc), '[]'::jsonb)
        from (
          select coalesce(context, 'other') as context, count(*) as n, round(avg(mood)::numeric, 2) as mean
          from moods group by coalesce(context, 'other')
        ) x
      ),
      'by_hour', (
        select coalesce(jsonb_agg(jsonb_build_object('hour', x.hour, 'n', x.n, 'mean', x.mean) order by x.hour), '[]'::jsonb)
        from (
          select extract(hour from (at at time zone 'America/New_York'))::int as hour, count(*) as n, round(avg(mood)::numeric, 2) as mean
          from moods group by 1
        ) x
      )
    ),
    'roles', (
      select coalesce(jsonb_agg(jsonb_build_object('role', r.role, 'active_days', r.n) order by r.n desc), '[]'::jsonb)
      from (select role, count(distinct (day, visitor)) as n from e group by role) r
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_insights(integer) from public, anon, authenticated;
grant execute on function public.admin_insights(integer) to authenticated;
