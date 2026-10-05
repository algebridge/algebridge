-- ============================================================
-- AlgeBridge, 5 October 2026: what the admin console can see.
--
-- ONE FILE TO RUN. Every statement is idempotent, so running it twice is
-- safe. Run AFTER schema-admin-console.sql (public.is_admin()) and
-- schema-2026-09-22.sql (public.feedback), both live. It stands on its own
-- next to schema-2026-10-01-reviews.sql and schema-2026-10-03-safety.sql:
-- it reads the columns they add when they are there and works without them.
--
-- What it does:
--   1. Visit counts for algebridge.org ('site') and learn.algebridge.org
--      ('app'), kept as daily totals. A visitor is a random id the browser
--      makes fresh each day, so no row links one day to the next, and no row
--      holds a name, email, account or IP address. Pages are stored with ids
--      taken out (/messages/:id).
--   2. record_visit() and record_event(), which /api/traffic calls with the
--      public key. They check every value and stop counting one visitor at
--      300 page views and 100 clicks a day, so a script cannot run the
--      numbers up far.
--   3. admin_traffic(): visitors and page views by day for both sites, where
--      visitors came from, the top pages, button clicks and devices. Admins
--      only.
--   4. admin_feedback(): everything sent from /feedback (problems, bugs,
--      ideas, reviews and reports), newest first. Admins only. The feedback
--      table has no read policy, so until now only the Supabase dashboard
--      showed any of it.
-- ============================================================


-- ---- 1. The counts ---------------------------------------------

create table if not exists public.traffic_visitors (
  day        date    not null,
  site       text    not null check (site in ('site', 'app')),
  visitor    uuid    not null,
  views      integer not null default 1,
  clicks     integer not null default 0,
  entry_path text,
  referrer   text,
  device     text check (device in ('phone', 'tablet', 'computer')),
  primary key (day, site, visitor)
);

create table if not exists public.traffic_pages (
  day   date    not null,
  site  text    not null check (site in ('site', 'app')),
  path  text    not null,
  views integer not null default 0,
  primary key (day, site, path)
);

create table if not exists public.traffic_events (
  day   date    not null,
  site  text    not null check (site in ('site', 'app')),
  name  text    not null,
  label text    not null,
  n     integer not null default 0,
  primary key (day, site, name, label)
);

-- No policies: nothing reaches these tables through the API except the
-- functions below.
alter table public.traffic_visitors enable row level security;
alter table public.traffic_pages    enable row level security;
alter table public.traffic_events   enable row level security;
revoke all on table public.traffic_visitors, public.traffic_pages, public.traffic_events from anon, authenticated;

-- Days run on New York time, the same as the Google Analytics property.
create or replace function public.traffic_today()
returns date
language sql stable
as $$ select (now() at time zone 'America/New_York')::date $$;

-- A page as the counts keep it: a path with ids already taken out by the
-- server, or (other) when it is anything else.
create or replace function public.traffic_clean_path(p text)
returns text
language sql immutable
as $$
  select case
    when p is null or p = '' then '/'
    when p ~ '^/[A-Za-z0-9/_.:-]{0,119}$' then p
    else '(other)'
  end
$$;


-- ---- 2. Counting -----------------------------------------------

create or replace function public.record_visit(
  p_site     text,
  p_visitor  uuid,
  p_path     text default '/',
  p_referrer text default null,
  p_device   text default null
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  d     date := public.traffic_today();
  page  text := public.traffic_clean_path(p_path);
  ref   text := case when p_referrer ~ '^[a-z0-9.-]{1,100}$' then p_referrer end;
  dev   text := case when p_device in ('phone', 'tablet', 'computer') then p_device end;
  seen  integer;
begin
  if p_site is null or p_site not in ('site', 'app') or p_visitor is null then
    return;
  end if;

  insert into public.traffic_visitors as t (day, site, visitor, views, entry_path, referrer, device)
  values (d, p_site, p_visitor, 1, page, ref, dev)
  on conflict (day, site, visitor) do update
    set views = t.views + 1
    where t.views < 300
  returning t.views into seen;

  if seen is null then
    return;  -- this visitor is past today's cap
  end if;

  -- A day keeps at most 500 different pages per site; the rest count as (other).
  if not exists (select 1 from public.traffic_pages where day = d and site = p_site and path = page)
     and (select count(*) from public.traffic_pages where day = d and site = p_site) >= 500 then
    page := '(other)';
  end if;

  insert into public.traffic_pages as tp (day, site, path, views)
  values (d, p_site, page, 1)
  on conflict (day, site, path) do update set views = tp.views + 1;

  -- Keep about 13 months.
  if random() < 0.01 then
    delete from public.traffic_visitors where day < d - 400;
    delete from public.traffic_pages    where day < d - 400;
    delete from public.traffic_events   where day < d - 400;
  end if;
end;
$$;

create or replace function public.record_event(
  p_site    text,
  p_visitor uuid,
  p_name    text,
  p_label   text
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  d        date := public.traffic_today();
  n_clicks integer;
begin
  if p_site is null or p_site not in ('site', 'app') or p_visitor is null
     or p_name is null or p_name not in ('cta_click')
     or p_label is null or p_label !~ '^[a-z0-9-]{1,40}$' then
    return;
  end if;

  -- Only a visitor who opened a page today can click, at most 100 times.
  update public.traffic_visitors as t
  set clicks = t.clicks + 1
  where t.day = d and t.site = p_site and t.visitor = p_visitor and t.clicks < 100
  returning t.clicks into n_clicks;

  if n_clicks is null then
    return;
  end if;

  insert into public.traffic_events as e (day, site, name, label, n)
  values (d, p_site, p_name, p_label, 1)
  on conflict (day, site, name, label) do update set n = e.n + 1;
end;
$$;

-- Supabase lets anon and authenticated run every new function in public by
-- default, so each grant here is spelled out after revoking all three.
revoke all on function public.traffic_today() from public, anon, authenticated;
revoke all on function public.traffic_clean_path(text) from public, anon, authenticated;
revoke all on function public.record_visit(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_event(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_visit(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.record_event(text, uuid, text, text) to anon, authenticated;


-- ---- 3. admin_traffic() ------------------------------------------

create or replace function public.admin_traffic(p_days integer default 30)
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

  with v as (
    select * from public.traffic_visitors where day between d_start and d_end
  )
  select jsonb_build_object(
    'today', d_end,
    'from', d_start,
    'first_day', (select min(day) from public.traffic_visitors),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', g.day,
               'site_visitors', coalesce(s.visitors, 0),
               'site_views',    coalesce(s.views, 0),
               'app_visitors',  coalesce(a.visitors, 0),
               'app_views',     coalesce(a.views, 0)
             ) order by g.day), '[]'::jsonb)
      from (select generate_series(d_start::timestamp, d_end::timestamp, interval '1 day')::date as day) g
      left join (select day, count(*) as visitors, sum(views) as views from v where site = 'site' group by day) s on s.day = g.day
      left join (select day, count(*) as visitors, sum(views) as views from v where site = 'app'  group by day) a on a.day = g.day
    ),
    'referrers', (
      select coalesce(jsonb_agg(jsonb_build_object('site', r.site, 'referrer', r.referrer, 'visitors', r.visitors)
               order by r.site, r.visitors desc, r.referrer), '[]'::jsonb)
      from (
        select site, coalesce(referrer, '(direct)') as referrer, count(*) as visitors,
               row_number() over (partition by site order by count(*) desc, coalesce(referrer, '(direct)')) as rk
        from v
        group by site, coalesce(referrer, '(direct)')
      ) r
      where r.rk <= 10
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('site', p.site, 'path', p.path, 'views', p.views)
               order by p.site, p.views desc, p.path), '[]'::jsonb)
      from (
        select site, path, sum(views) as views,
               row_number() over (partition by site order by sum(views) desc, path) as rk
        from public.traffic_pages
        where day between d_start and d_end
        group by site, path
      ) p
      where p.rk <= 12
    ),
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object('site', e.site, 'name', e.name, 'label', e.label, 'n', e.n)
               order by e.n desc, e.label), '[]'::jsonb)
      from (
        select site, name, label, sum(n) as n
        from public.traffic_events
        where day between d_start and d_end
        group by site, name, label
      ) e
    ),
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object('site', x.site, 'device', x.device, 'visitors', x.visitors)
               order by x.site, x.visitors desc), '[]'::jsonb)
      from (
        select site, coalesce(device, 'unknown') as device, count(*) as visitors
        from v
        group by site, coalesce(device, 'unknown')
      ) x
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_traffic(integer) from public, anon, authenticated;
grant execute on function public.admin_traffic(integer) to authenticated;


-- ---- 4. admin_feedback() -----------------------------------------

create or replace function public.admin_feedback(p_limit integer default 300)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', (select count(*) from public.feedback),
    'by_kind', (
      select coalesce(jsonb_object_agg(k.kind, k.n), '{}'::jsonb)
      from (select coalesce(kind, 'other') as kind, count(*) as n from public.feedback group by 1) k
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',          x.id,
               'kind',        x.kind,
               'message',     x.message,
               'contact',     x.contact,
               'page',        x.page,
               'created_at',  x.created_at,
               -- The column arrives with the reviews update; read it only when it is there.
               'rating',      x.raw ->> 'rating',
               'sender_id',   x.user_id,
               'sender_name', x.display_name,
               'sender_role', x.role
             ) order by x.created_at desc)
      from (
        select f.id, f.kind, f.message, f.contact, f.page, f.created_at, f.user_id,
               to_jsonb(f) as raw, p.display_name, p.role
        from public.feedback f
        left join public.profiles p on p.id = f.user_id
        order by f.created_at desc
        limit least(greatest(coalesce(p_limit, 300), 1), 1000)
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_feedback(integer) from public, anon, authenticated;
grant execute on function public.admin_feedback(integer) to authenticated;
