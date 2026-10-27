-- ============================================================
-- AlgeBridge: what students say they are into (26 Oct 2026)
--
-- admin_interests(): the interest chips students tapped, tallied, and what
-- they wrote in their own words (the note under the chips, and the specifics
-- per chip), newest first. Admins only. No ids, names or emails come back:
-- the point is to see which interests to add to the pool, not who wrote what.
--
-- Reads progress_json -> 'interests' on user_progress, where the picker
-- saves the profile (src/lib/interests.ts, InterestProfile).
-- ============================================================

create or replace function public.admin_interests(p_limit integer default 500)
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
    'students', (select count(*) from public.user_progress where progress_json ? 'interests'),
    'picks', (
      select coalesce(jsonb_object_agg(t.pick, t.n), '{}'::jsonb)
      from (
        select p.pick, count(*) as n
        from public.user_progress u,
             jsonb_array_elements_text(coalesce(u.progress_json -> 'interests' -> 'picks', '[]'::jsonb)) as p(pick)
        group by p.pick
      ) t
    ),
    'notes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'note', n.note,
        'specifics', n.specifics,
        'picks', n.picks,
        'updated_at', n.updated_at
      ) order by n.updated_at desc nulls last), '[]'::jsonb)
      from (
        select
          nullif(trim(u.progress_json -> 'interests' ->> 'note'), '') as note,
          coalesce(u.progress_json -> 'interests' -> 'specifics', '{}'::jsonb) as specifics,
          coalesce(u.progress_json -> 'interests' -> 'picks', '[]'::jsonb) as picks,
          u.progress_json -> 'interests' ->> 'updatedAt' as updated_at
        from public.user_progress u
        where u.progress_json ? 'interests'
          and (
            nullif(trim(u.progress_json -> 'interests' ->> 'note'), '') is not null
            or jsonb_typeof(u.progress_json -> 'interests' -> 'specifics') = 'object'
               and u.progress_json -> 'interests' -> 'specifics' <> '{}'::jsonb
          )
        limit greatest(1, least(p_limit, 2000))
      ) n
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_interests(integer) from public;
grant execute on function public.admin_interests(integer) to authenticated;
