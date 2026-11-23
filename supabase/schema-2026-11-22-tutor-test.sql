-- Tutor check: every finished attempt at the Algebra 1 tutor test
-- (src/lib/tutor-test.ts, page /tutor-test).
-- Needs schema-tutors.sql (is_tutor) and schema-admin-console.sql (is_admin).
--
--   * tutors and admins save their own attempts, as themselves
--   * a tutor reads only their own attempts; admins read everyone's
--   * attempts are never edited; an admin can delete one

create table if not exists public.tutor_test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  score int not null check (score >= 0),
  total int not null check (total > 0 and score <= total),
  passed boolean not null,
  sections jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tutor_test_results_user_idx on public.tutor_test_results (user_id, created_at desc);
create index if not exists tutor_test_results_created_idx on public.tutor_test_results (created_at desc);

alter table public.tutor_test_results enable row level security;

drop policy if exists "Tutors save their own tutor check" on public.tutor_test_results;
create policy "Tutors save their own tutor check"
  on public.tutor_test_results for insert to authenticated
  with check (user_id = auth.uid() and (public.is_tutor() or public.is_admin()));

drop policy if exists "Own tutor checks, or all for admins" on public.tutor_test_results;
create policy "Own tutor checks, or all for admins"
  on public.tutor_test_results for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins delete tutor checks" on public.tutor_test_results;
create policy "Admins delete tutor checks"
  on public.tutor_test_results for delete to authenticated
  using (public.is_admin());

-- At most 5 attempts per person per day, so the test is not brute-forced.
create or replace function public.guard_tutor_test()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (
    select count(*) from public.tutor_test_results r
    where r.user_id = new.user_id and r.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'tutor_test_limit' using hint = 'At most 5 tutor checks a day.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_tutor_test on public.tutor_test_results;
create trigger guard_tutor_test before insert on public.tutor_test_results
  for each row execute function public.guard_tutor_test();
