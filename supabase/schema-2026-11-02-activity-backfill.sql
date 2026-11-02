-- AlgeBridge: activity ticker, the week before (2026-11-02, later the same day)
--
-- The ticker went live with an empty feed. This puts the last seven days of
-- real moments on it from what the accounts already saved: every skill
-- finished and every unit finished (the certificate's date), under the
-- student's first name, and widens the ticker's window from two days to
-- seven so they show.
--
-- Idempotent. Run AFTER schema-2026-11-02-activity-ticker.sql. A moment
-- already on the feed (same student, kind and title) is not added twice.
--
-- What is NOT here: problems solved and Bridgeys earned carry no dates in
-- the saved progress, so nothing is invented for them.

-- ---- 1. A seven-day window --------------------------------------

create or replace function public.recent_activity(
  p_after bigint default 0,
  p_limit integer default 40
)
returns table (
  id         bigint,
  at         timestamptz,
  first_name text,
  kind       text,
  amount     integer,
  detail     text
)
language sql security definer stable
set search_path = public
as $$
  select f.id, f.at, f.first_name, f.kind, f.amount, f.detail
    from public.activity_feed f
   where auth.uid() is not null
     and f.id > coalesce(p_after, 0)
     and f.at > now() - interval '7 days'
   order by f.id desc
   limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.recent_activity(bigint, integer) from public, anon;
grant execute on function public.recent_activity(bigint, integer) to authenticated;

create or replace function public.post_activity(
  p_kind   text,
  p_amount integer default null,
  p_detail text default null
)
returns void
language plpgsql security definer volatile
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  nm      text;
  last_at timestamptz;
  title   constant text := '^[[:alnum:] ,.''’&:()-]{1,48}$';
begin
  if uid is null then
    return;
  end if;
  if p_kind is null or p_kind not in ('solved', 'bridgeys', 'skill', 'unit', 'bought', 'game') then
    return;
  end if;

  if p_kind = 'bridgeys' then
    if p_amount is null or p_amount < 1 or p_amount > 100000 then return; end if;
    p_detail := null;
  elsif p_kind = 'solved' then
    p_amount := null;
    p_detail := null;
  else
    if p_detail is null or p_detail !~ title then return; end if;
    p_amount := null;
  end if;

  select split_part(btrim(coalesce(p.display_name, '')), ' ', 1)
    into nm
    from public.profiles p
   where p.id = uid and p.role = 'student';
  if nm is null or nm = '' or length(nm) > 30 or nm !~ '^[[:alpha:]''’.-]+$' then
    return;
  end if;

  if not exists (
    select 1 from public.leaderboard_stats s where s.user_id = uid and s.leaderboard_opt_in
  ) then
    return;
  end if;

  select max(f.at) into last_at from public.activity_feed f where f.user_id = uid;
  if last_at is not null and last_at > now() - interval '2 seconds' then
    return;
  end if;

  insert into public.activity_feed (user_id, first_name, kind, amount, detail)
  values (uid, nm, p_kind, p_amount, p_detail);

  -- Housekeeping, now and then: rows older than seven days are forgotten.
  if random() < 0.02 then
    delete from public.activity_feed f where f.at < now() - interval '7 days';
  end if;
end;
$$;

revoke all on function public.post_activity(text, integer, text) from public, anon;
grant execute on function public.post_activity(text, integer, text) to authenticated;

-- ---- 2. The week before, from saved progress -----------------------

-- An ISO time out of saved JSON, or null when it is not one.
create or replace function public.ticker_backfill_ts(p text)
returns timestamptz
language plpgsql immutable
as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}T' then return null; end if;
  return p::timestamptz;
exception when others then
  return null;
end;
$$;

create temp table ticker_titles (id text primary key, kind text not null, title text not null);
insert into ticker_titles (id, kind, title) values
  ('working-with-units', 'unit', 'Unit 1: Working with Units'),
  ('solving-equations', 'unit', 'Unit 2: Solving Equations & Inequalities'),
  ('linear-equations-graphs', 'unit', 'Unit 3: Linear Equations & Graphs'),
  ('forms-linear-equations', 'unit', 'Unit 4: Forms of Linear Equations'),
  ('systems-equations', 'unit', 'Unit 5: Systems of Equations'),
  ('inequalities-systems', 'unit', 'Unit 6: Inequalities (Systems & Graphs)'),
  ('functions', 'unit', 'Unit 7: Functions'),
  ('sequences', 'unit', 'Unit 8: Sequences'),
  ('exponents-radicals', 'unit', 'Unit 9: Exponents & Radicals'),
  ('exponential-growth-decay', 'unit', 'Unit 10: Exponential Growth & Decay'),
  ('quadratics-factoring', 'unit', 'Unit 11: Quadratics: Multiplying & Factoring'),
  ('quadratic-functions', 'unit', 'Unit 12: Quadratic Functions & Equations'),
  ('absolute-value-piecewise', 'unit', 'Unit 13: Absolute Value & Piecewise Functions'),
  ('data-statistics', 'unit', 'Unit 14: Data & Statistics'),
  ('modeling-functions', 'unit', 'Unit 15: Modeling with Functions'),
  ('a2-exponents-radicals', 'unit', 'Unit 1: Square Roots & Exponent Rules'),
  ('square-roots-to-i', 'unit', 'Unit 2: Square Roots, up to i'),
  ('complex-numbers', 'unit', 'Unit 3: Complex Numbers'),
  ('polynomial-functions', 'unit', 'Unit 4: Polynomial Functions'),
  ('quadratics-revisited', 'unit', 'Unit 5: Quadratics Revisited'),
  ('rational-expressions', 'unit', 'Unit 6: Rational Expressions & Equations'),
  ('radicals-rational-exponents', 'unit', 'Unit 7: Radicals & Rational Exponents'),
  ('exponential-logarithmic', 'unit', 'Unit 8: Exponential & Logarithmic Functions'),
  ('sequences-series', 'unit', 'Unit 9: Sequences & Series'),
  ('trigonometry', 'unit', 'Unit 10: Trigonometry'),
  ('unit-basics', 'skill', 'Unit Conversion Basics'),
  ('dimensional-analysis', 'skill', 'Dimensional Analysis'),
  ('unit-word-problems', 'skill', 'Unit Word Problems'),
  ('one-step-equations', 'skill', 'One-Step Equations'),
  ('two-step-equations', 'skill', 'Two-Step Equations'),
  ('multi-step-equations', 'skill', 'Multi-Step Equations'),
  ('equations-with-fractions', 'skill', 'Equations with Fractions'),
  ('linear-inequalities', 'skill', 'Linear Inequalities'),
  ('coordinate-plane', 'skill', 'The Coordinate Plane'),
  ('slope', 'skill', 'Slope'),
  ('graphing-lines', 'skill', 'Graphing Linear Equations'),
  ('intercepts', 'skill', 'X and Y Intercepts'),
  ('slope-intercept', 'skill', 'Slope-Intercept Form'),
  ('point-slope', 'skill', 'Point-Slope Form'),
  ('standard-form', 'skill', 'Standard Form'),
  ('parallel-perpendicular', 'skill', 'Parallel & Perpendicular Lines'),
  ('graphing-systems', 'skill', 'Graphing Systems'),
  ('substitution', 'skill', 'Substitution Method'),
  ('elimination', 'skill', 'Elimination Method'),
  ('systems-word-problems', 'skill', 'Systems Word Problems'),
  ('graphing-inequalities', 'skill', 'Graphing Inequalities'),
  ('compound-inequalities', 'skill', 'Compound Inequalities'),
  ('systems-inequalities', 'skill', 'Systems of Inequalities'),
  ('function-notation', 'skill', 'Function Notation'),
  ('domain-range', 'skill', 'Domain and Range'),
  ('function-graphs', 'skill', 'Interpreting Function Graphs'),
  ('arithmetic-sequences', 'skill', 'Arithmetic Sequences'),
  ('geometric-sequences', 'skill', 'Geometric Sequences'),
  ('exponent-rules', 'skill', 'Exponent Rules'),
  ('negative-fractional-exponents', 'skill', 'Negative & Fractional Exponents'),
  ('scientific-notation', 'skill', 'Scientific Notation'),
  ('simplifying-radicals', 'skill', 'Simplifying Radicals'),
  ('exponential-functions', 'skill', 'Exponential Functions'),
  ('exponential-growth', 'skill', 'Exponential Growth'),
  ('exponential-decay', 'skill', 'Exponential Decay'),
  ('multiplying-binomials', 'skill', 'Multiplying Binomials'),
  ('special-products', 'skill', 'Special Products'),
  ('factoring-trinomials', 'skill', 'Factoring Trinomials'),
  ('factoring-special', 'skill', 'Factoring Special Cases'),
  ('graphing-parabolas', 'skill', 'Graphing Parabolas'),
  ('solving-by-factoring', 'skill', 'Solving by Factoring'),
  ('completing-square', 'skill', 'Completing the Square'),
  ('quadratic-formula', 'skill', 'The Quadratic Formula'),
  ('absolute-value', 'skill', 'Absolute Value Equations'),
  ('absolute-value-inequalities', 'skill', 'Absolute Value Inequalities'),
  ('piecewise-functions', 'skill', 'Piecewise Functions'),
  ('center-spread', 'skill', 'Center & Spread'),
  ('trend-lines', 'skill', 'Trend Lines & Correlation'),
  ('two-way-tables', 'skill', 'Two-Way Tables'),
  ('literal-equations', 'skill', 'Literal Equations'),
  ('function-transformations', 'skill', 'Transforming Functions'),
  ('linear-vs-exponential', 'skill', 'Linear vs. Exponential Models'),
  ('a2-simplifying-radicals', 'skill', 'Simplifying Radicals'),
  ('a2-exponent-rules', 'skill', 'Exponent Rules'),
  ('square-roots', 'skill', 'Square Roots'),
  ('negative-square-roots', 'skill', 'Negative Square Roots'),
  ('simplify-square-roots', 'skill', 'Simplifying Square Roots'),
  ('operations-square-roots', 'skill', 'Adding and Multiplying Roots'),
  ('imaginary-unit', 'skill', 'The Imaginary Unit'),
  ('complex-arithmetic', 'skill', 'Complex Arithmetic'),
  ('complex-roots', 'skill', 'Complex Roots of Quadratics'),
  ('polynomial-end-behavior', 'skill', 'Degree and End Behavior'),
  ('polynomial-division', 'skill', 'Synthetic Division'),
  ('remainder-factor-theorem', 'skill', 'Remainder and Factor Theorems'),
  ('vertex-form', 'skill', 'Vertex Form'),
  ('discriminant', 'skill', 'The Discriminant'),
  ('linear-quadratic-systems', 'skill', 'Linear-Quadratic Systems'),
  ('simplify-rational', 'skill', 'Simplify Rational Expressions'),
  ('multiply-divide-rational', 'skill', 'Multiply & Divide Rational Expressions'),
  ('rational-equations', 'skill', 'Rational Equations'),
  ('nth-roots', 'skill', 'Cube Roots and nth Roots'),
  ('rational-exponents-evaluate', 'skill', 'Rational Exponents'),
  ('radical-equations', 'skill', 'Radical Equations'),
  ('log-basics', 'skill', 'What a Logarithm Is'),
  ('log-properties', 'skill', 'Properties of Logarithms'),
  ('solve-exponential-equations', 'skill', 'Solving Exponential Equations'),
  ('arithmetic-series', 'skill', 'Arithmetic Series'),
  ('geometric-series', 'skill', 'Geometric Series'),
  ('sigma-notation', 'skill', 'Sigma Notation'),
  ('radians-degrees', 'skill', 'Radians and Degrees'),
  ('unit-circle-values', 'skill', 'Unit Circle Values'),
  ('reference-angles', 'skill', 'Reference Angles');

with students as (
  select p.id as user_id, split_part(btrim(p.display_name), ' ', 1) as nm
    from public.profiles p
    join public.leaderboard_stats s on s.user_id = p.id and s.leaderboard_opt_in
   where p.role = 'student'
     and split_part(btrim(coalesce(p.display_name, '')), ' ', 1) ~ '^[[:alpha:]''’.-]+$'
     and length(split_part(btrim(p.display_name), ' ', 1)) <= 30
),
skills as (
  select up.user_id,
         sk.key as skill_id,
         sk.value->>'level' as level,
         public.ticker_backfill_ts(coalesce(sk.value->>'completedAt', sk.value->>'lastPracticed')) as at
    from public.user_progress up
   cross join lateral jsonb_each(
     case when jsonb_typeof(up.progress_json->'skills') = 'object' then up.progress_json->'skills' else '{}'::jsonb end
   ) sk
   where jsonb_typeof(sk.value) = 'object'
),
units as (
  select up.user_id,
         c.key as unit_id,
         public.ticker_backfill_ts(c.value) as at
    from public.user_progress up
   cross join lateral jsonb_each_text(
     case when jsonb_typeof(up.progress_json->'certificates') = 'object' then up.progress_json->'certificates' else '{}'::jsonb end
   ) c
),
moments as (
  select st.user_id, st.nm, 'skill'::text as kind, t.title as detail, s.at
    from skills s
    join students st on st.user_id = s.user_id
    join ticker_titles t on t.kind = 'skill' and t.id = s.skill_id
   where s.level in ('proficient', 'mastered')
  union all
  select st.user_id, st.nm, 'unit'::text, t.title, u.at
    from units u
    join students st on st.user_id = u.user_id
    join ticker_titles t on t.kind = 'unit' and t.id = u.unit_id
)
insert into public.activity_feed (at, user_id, first_name, kind, detail)
select m.at, m.user_id, m.nm, m.kind, m.detail
  from moments m
 where m.at is not null
   and m.at > now() - interval '7 days'
   and m.at <= now()
   and not exists (
     select 1 from public.activity_feed f
      where f.user_id = m.user_id and f.kind = m.kind and f.detail = m.detail
   )
 order by m.at;

drop table ticker_titles;
drop function public.ticker_backfill_ts(text);

select kind, count(*) as rows_added, min(at) as earliest, max(at) as latest
  from public.activity_feed
 group by kind order by kind;
