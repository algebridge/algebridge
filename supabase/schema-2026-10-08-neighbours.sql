-- ============================================================
-- Neighbours (2026-10-08): the street outside a student's Bridgey House
-- shows other students' houses, in each one's own house style.
--
-- Only what the leaderboard already shows anyone signed in: a student on the
-- board (leaderboard_opt_in) is seen by "First L." with their house style
-- beside it. A student who hides from the board is off the street too.
-- No furniture, no ids, nothing from inside the house.
--
-- Safe before or after supabase/schema-2026-10-03-safety.sql, and safe to
-- run twice. The app (src/lib/leaderboard.ts) works before this runs: it
-- writes the row without house_style and shows an empty street.
-- ============================================================

alter table public.leaderboard_stats add column if not exists house_style text;

-- Only the five house styles, or nothing.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leaderboard_stats_house_style_check') then
    alter table public.leaderboard_stats
      add constraint leaderboard_stats_house_style_check
      check (house_style is null or house_style in ('cottage', 'treehouse', 'loft', 'beach', 'castle'));
  end if;
end $$;

-- After the safety file, students read the board through leaderboard_public:
-- the same view, with house_style added at the end.
do $$
begin
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'leaderboard_public') then
    execute $v$
      create or replace view public.leaderboard_public
      with (security_barrier = true)
      as
        select ls.display_name, ls.bridgeys, ls.completed_skills, ls.best_furniture_value,
               ls.best_furniture_name, ls.equipped_title, ls.leaderboard_opt_in, ls.updated_at,
               (ls.user_id = auth.uid()) as is_me,
               ls.house_style
        from public.leaderboard_stats ls
        where ls.leaderboard_opt_in
          and auth.uid() is not null
          and not public.profile_is_managed(ls.user_id)
    $v$;
    revoke all on public.leaderboard_public from public, anon;
    grant select on public.leaderboard_public to authenticated;
  end if;
end $$;

select 'rows with a house style' as what, count(*)::text as n from public.leaderboard_stats where house_style is not null;
