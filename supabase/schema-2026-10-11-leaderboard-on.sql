-- ============================================================
-- The leaderboard is on by default again (2026-10-11, Ivan).
--
-- Every student agrees at sign-up (Terms of Use and Privacy Policy) to be
-- shown as "First L." with their Bridgeys, skills finished and best house
-- piece, to signed-in accounts only, unless they hide themselves with the
-- checkbox on the leaderboard page. School accounts stay off: the app writes
-- leaderboard_opt_in = false in school mode, and leaderboard_public leaves
-- out managed profiles whatever the column says.
--
-- Apply together with the app release that sets leaderboardDefaultV3
-- (src/lib/bridgeys.ts). Applied alone, the older app's next autosave writes
-- each student's old opt-in (false since 3 Oct) back over this.
--
-- Idempotent: safe to run more than once.
-- ============================================================

alter table public.leaderboard_stats alter column leaderboard_opt_in set default true;

update public.leaderboard_stats
set leaderboard_opt_in = true
where not leaderboard_opt_in;

do $$
declare
  r record;
begin
  select count(*) filter (where leaderboard_opt_in) as shown,
         count(*) filter (where not leaderboard_opt_in) as hidden
    into r from public.leaderboard_stats;
  raise notice 'board rows after: % shown, % hidden', r.shown, r.hidden;
end $$;
