-- A teacher gives a student in their class a new password.
--
-- The email link on /login/reset is useless where a district blocks outside
-- mail (Christina School District does), and username accounts have no inbox
-- at all. The teacher is in the room, so the teacher is the way back in.
--
-- The new password is made in the browser and shown to the teacher once, the
-- same way Make accounts shows them. Only its bcrypt hash is stored, in the
-- format Supabase Auth checks at sign-in.
--
-- Rules:
--   - the caller teaches a class the student is in (teaches_student), or is an admin
--   - the account is a student, so a teacher can never take over another teacher
--   - the account signs in with a password; a Google-only account is left alone,
--     since giving it a password would open a second way in nobody asked for
--
-- Paste into the Supabase SQL editor and run. Safe to run twice.

create or replace function public.teacher_reset_password(p_student uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_password is null or length(p_password) < 8 then
    raise exception 'The new password needs at least 8 characters.';
  end if;

  if not (public.teaches_student(p_student) or public.is_admin()) then
    raise exception 'You can only reset passwords for students in your classes.';
  end if;

  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'Only student passwords can be reset here.';
  end if;

  if not exists (select 1 from auth.identities where user_id = p_student and provider = 'email') then
    raise exception 'This student signs in with Google, so there is no password to reset.';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_student;
end;
$$;

revoke all on function public.teacher_reset_password(uuid, text) from public, anon;
grant execute on function public.teacher_reset_password(uuid, text) to authenticated;

-- Tell the API about the new function right away.
notify pgrst, 'reload schema';
