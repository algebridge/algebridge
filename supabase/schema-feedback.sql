-- Feedback from students, teachers and visitors, left on /feedback or from a
-- problem card. Anyone can leave one; only the dashboard reads them.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'other',
  message text not null check (char_length(message) between 3 and 2000),
  contact text,
  page text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Anyone can leave feedback" on public.feedback;
create policy "Anyone can leave feedback"
  on public.feedback for insert to anon, authenticated
  with check (true);

-- Nobody reads through the API; read it in the Supabase dashboard (Table
-- Editor) or grant a select policy to admins later.
