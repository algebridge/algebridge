-- ============================================================
-- The street, second part (2026-10-09): ten house styles, and each
-- student's character standing on their porch for the neighbours to see.
--
-- leaderboard_stats gains `avatar` (jsonb): the character spec a student
-- made (colours and a few picks from lib/avatar.ts, nothing else), shown
-- beside their house on other students' streets. Like house_style it is
-- seen only by signed-in students, only when the student is on the board,
-- and the app checks every value against its own lists before building
-- anything from it. The house_style check grows to the ten houses in the
-- shop.
--
-- Safe before or after supabase/schema-2026-10-03-safety.sql and
-- schema-2026-10-08-neighbours.sql, and safe to run twice. The app works
-- before this runs: a row the database refuses (an unknown house style, a
-- missing column) goes up again without that column.
-- ============================================================

alter table public.leaderboard_stats add column if not exists house_style text;
alter table public.leaderboard_stats add column if not exists avatar jsonb;

-- The ten house styles, or nothing.
alter table public.leaderboard_stats drop constraint if exists leaderboard_stats_house_style_check;
alter table public.leaderboard_stats
  add constraint leaderboard_stats_house_style_check
  check (house_style is null or house_style in ('cottage', 'treehouse', 'loft', 'beach', 'castle', 'barn', 'adobe', 'chalet', 'modern', 'victorian'));

-- A character is a small object of short strings: nothing bigger goes in.
alter table public.leaderboard_stats drop constraint if exists leaderboard_stats_avatar_check;
alter table public.leaderboard_stats
  add constraint leaderboard_stats_avatar_check
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 2048));

-- After the safety file, students read the board through leaderboard_public:
-- the same view, with the street's columns at the end.
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
               ls.avatar
        from public.leaderboard_stats ls
        where ls.leaderboard_opt_in
          and auth.uid() is not null
          and not public.profile_is_managed(ls.user_id)
    $v$;
    revoke all on public.leaderboard_public from public, anon;
    grant select on public.leaderboard_public to authenticated;
  end if;
end $$;

select 'rows with a character' as what, count(*)::text as n from public.leaderboard_stats where avatar is not null;
