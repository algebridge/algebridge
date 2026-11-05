-- Announcements: a tutor (or an admin) posts one message that every signed-in
-- person on AlgeBridge sees as a banner on the course page.
-- Needs schema-tutors.sql (is_tutor) and schema-admin-console.sql (is_admin).
--
-- Guard rails, enforced here and not only in the app:
--   * only tutors and admins can post, and only as themselves
--   * title up to 80 characters, body up to 600
--   * at most 3 per author in any 24 hours
--   * no phone numbers, emails or outside links: everyone reading is a minor
--   * the author or an admin can take one down

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 600),
  created_at timestamptz not null default now()
);

create index if not exists announcements_created_idx on public.announcements (created_at desc);
create index if not exists announcements_author_idx on public.announcements (author_id, created_at desc);

alter table public.announcements enable row level security;

drop policy if exists "Signed-in people read announcements" on public.announcements;
create policy "Signed-in people read announcements"
  on public.announcements for select to authenticated using (true);

drop policy if exists "Tutors and admins post announcements" on public.announcements;
create policy "Tutors and admins post announcements"
  on public.announcements for insert to authenticated
  with check (author_id = auth.uid() and (public.is_tutor() or public.is_admin()));

drop policy if exists "Author or admin removes an announcement" on public.announcements;
create policy "Author or admin removes an announcement"
  on public.announcements for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

create or replace function public.guard_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  txt text := new.title || ' ' || new.body;
begin
  if not public.is_admin() and (
    select count(*) from public.announcements a
    where a.author_id = new.author_id and a.created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'announcement_limit' using hint = 'At most 3 announcements a day.';
  end if;
  if txt ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
     or txt ~* '(https?://|www\.)'
     or txt ~ '\d[\d\s().-]{8,}\d'
     or txt ~* '\m(snap(chat)?|insta(gram)?|discord|whats ?app|telegram|tiktok|kik)\M' then
    raise exception 'announcement_contact' using hint = 'Announcements cannot share contact details or other apps.';
  end if;
  new.title := btrim(new.title);
  new.body := btrim(new.body);
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists announcements_guard on public.announcements;
create trigger announcements_guard before insert on public.announcements
  for each row execute function public.guard_announcement();
