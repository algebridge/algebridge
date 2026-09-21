-- Story templates for personalized practice problems.
--
-- Each row is a story the AI wrote once for one shape of problem and one
-- interest ("Solve for x: {1}x + {2} = {3}" set in Minecraft), approved by
-- the checks in src/lib/personalize.ts, and reused for every student with
-- that interest. Only the server reads and writes this table, using the
-- service role key: row level security is on with no policies, so the anon
-- key students' browsers hold cannot touch it.
--
-- To enable: run this in the Supabase SQL editor, then add
-- SUPABASE_SERVICE_ROLE_KEY to the Vercel project's environment variables.
-- Without it the app keeps templates in server memory instead.

create table if not exists public.story_templates (
  key        text        not null,  -- sha256 of "<shape>::<interest>", first 40 hex chars
  signature  text        not null,  -- the shape, e.g. Solve for x: {1}x + {2} = {3}
  topic      text        not null,  -- the interest, e.g. Minecraft
  template   text        not null,  -- the story, with {1}, {2} ... for the numbers
  created_at timestamptz not null default now(),
  primary key (key, template)
);

alter table public.story_templates enable row level security;
-- Deliberately no policies.
