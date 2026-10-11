-- ============================================================
-- Plots in real cities (2026-10-11): the plots a student bought with
-- Bridgeys (lib/world.ts), so their house shows on those plots for other
-- students visiting the city.
--
-- leaderboard_stats gains `city_plots` (jsonb): a short list of
-- {city, plot} pairs from a fixed list of famous cities, never a real
-- address. Seen only by signed-in students, only when the student is on the
-- board; the app checks every pair against its own lists. Safe to run twice
-- and before or after the safety file; the app works before it runs.
-- ============================================================

alter table public.leaderboard_stats add column if not exists city_plots jsonb;

alter table public.leaderboard_stats drop constraint if exists leaderboard_stats_city_plots_check;
alter table public.leaderboard_stats
  add constraint leaderboard_stats_city_plots_check
  check (city_plots is null or (jsonb_typeof(city_plots) = 'array' and pg_column_size(city_plots) < 4096));

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
               ls.house_style,
               ls.avatar,
               ls.city_plots
        from public.leaderboard_stats ls
        where ls.leaderboard_opt_in
          and auth.uid() is not null
          and not public.profile_is_managed(ls.user_id)
    $v$;
    revoke all on public.leaderboard_public from public, anon;
    grant select on public.leaderboard_public to authenticated;
  end if;
end $$;
