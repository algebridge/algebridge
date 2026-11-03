-- Leaderboard backfill, Oct 14 2026.
-- Before the Oct 11 fix (schema-2026-10-11-leaderboard-own-row.sql) the
-- board refused every save from a student whose board was off, so 12 rows
-- froze at late-September numbers and 25 students never got a row. A row
-- only refreshes at the student's next save, and these 37 have not saved
-- since. This writes each one from their saved progress, computed with the
-- app's own getLeaderboardSnapshot. A row the student has saved since this
-- file was made is left alone (the updated_at guard).

-- The one-off insert that ran here on Oct 14 2026 carried the 37 students'
-- account ids, names and stats as a literal. It has been applied and is
-- removed from the repository, which is public: student data never lives
-- in a file.

-- Check: every student with progress has a row, and no row is behind.
select count(*) filter (where ls.user_id is null) as missing,
       count(*) filter (where up.updated_at > ls.updated_at + interval '1 hour') as stale
from public.user_progress up left join public.leaderboard_stats ls using (user_id);
