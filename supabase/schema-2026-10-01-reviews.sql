-- ============================================================
-- AlgeBridge, 1 October 2026: star reviews.
--
-- ONE FILE TO RUN. Paste it into the Supabase SQL editor and run it once;
-- every statement is idempotent, so running it twice is safe.
-- Run AFTER schema-2026-09-22.sql (which created public.feedback) and
-- schema-admin-console.sql (public.is_admin()), both live.
--
-- What it does:
--   1. feedback.rating, a nullable 1 to 5 star count. A review is a feedback
--      row with kind 'review' and a rating; every other kind leaves it null.
--   2. Reviews sent before this file ran kept their stars in the first line
--      of the message ("Rating: 4 of 5 stars"); those are read back into the
--      column, and the line is taken off the message.
--   3. feedback.user_id fills itself from the signed-in session, so a review
--      can show who left it. The insert policy still lets anyone leave
--      feedback, signed in or not, and now refuses a row that claims to be
--      somebody else.
--   4. admin_reviews(): the average, the count and the latest 50 reviews,
--      for admins only. Reviews are never readable through the API otherwise.
-- ============================================================


-- ---- 1. The rating column ------------------------------------

alter table public.feedback add column if not exists rating smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_rating_range' and conrelid = 'public.feedback'::regclass
  ) then
    alter table public.feedback
      add constraint feedback_rating_range check (rating is null or rating between 1 and 5);
  end if;
end;
$$;

-- The console reads reviews newest first.
create index if not exists feedback_reviews_created_at_idx
  on public.feedback (created_at desc)
  where kind = 'review';


-- ---- 2. Reviews sent before the column existed ---------------
-- /api/feedback wrote "Rating: N of 5 stars", a blank line, then the
-- explanation. Take the stars back out into the column. The line is removed
-- only when what is left still meets the 3 character minimum.

update public.feedback
set rating = substring(message from '^Rating: ([1-5]) of 5 stars')::smallint,
    message = case
      when char_length(regexp_replace(message, '^Rating: [1-5] of 5 stars\s*', '')) >= 3
        then regexp_replace(message, '^Rating: [1-5] of 5 stars\s*', '')
      else message
    end
where kind = 'review'
  and rating is null
  and message ~ '^Rating: [1-5] of 5 stars';


-- ---- 3. Who left it ------------------------------------------
-- The API never sends user_id; the database takes it from the session
-- (auth.uid() is null for the anonymous key, so signed-out rows stay null).

alter table public.feedback alter column user_id set default auth.uid();

drop policy if exists "Anyone can leave feedback" on public.feedback;
create policy "Anyone can leave feedback"
  on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
-- Still no select policy: nobody reads feedback through the API. Admins read
-- reviews through admin_reviews() below, everything else in the dashboard.


-- ---- 4. admin_reviews() --------------------------------------

create or replace function public.admin_reviews()
returns jsonb
language plpgsql security definer stable
set search_path = public, auth
as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'average', (select round(avg(f.rating)::numeric, 2)
                from public.feedback f
                where f.kind = 'review' and f.rating is not null),
    'count',   (select count(*)
                from public.feedback f
                where f.kind = 'review' and f.rating is not null),
    'reviews', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', r.id,
                 'rating', r.rating,
                 'message', r.message,
                 'created_at', r.created_at,
                 'display_name', r.display_name
               )
               order by r.created_at desc)
      from (
        select f.id, f.rating, f.message, f.created_at, p.display_name
        from public.feedback f
        left join public.profiles p on p.id = f.user_id
        where f.kind = 'review'
        order by f.created_at desc
        limit 50
      ) r
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;
revoke all on function public.admin_reviews() from public, anon;
grant execute on function public.admin_reviews() to authenticated;

-- PostgREST picks up the new column and function on its own after DDL; this
-- makes sure it does straight away.
notify pgrst, 'reload schema';
