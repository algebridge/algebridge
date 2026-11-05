-- Tutors see every student in the Tutor Hub (Ivan, 4 Nov 2026).
-- Needs schema-2026-10-03-safety.sql (live since 11 Oct).
--
-- Widens SEEING only, never contact:
--   * A tutor's student_directory now lists every student: id, name, photo
--     link, role. Still never an email.
--   * Still hidden from a tutor: school-managed students (a class's teacher
--     is the only adult for them) and any student who blocked that tutor.
--   * New column `reachable`: may this caller message or ring the student
--     today (staff_can_reach, rule 1 of the safety file). Message and call
--     rules are unchanged: a tutor still reaches only students who asked
--     them for help or wrote to them first.
--   * Teachers and admins see exactly what they saw before.
-- Student photos stay private: the avatars bucket policy is not touched, so
-- a tutor sees a photo only for a student they can reach, initials otherwise.

create or replace view public.student_directory
with (security_barrier = true)
as
  select p.id, p.display_name, p.avatar_url, p.role,
         (public.is_admin() or public.staff_can_reach(auth.uid(), p.id)) as reachable
  from public.profiles p
  where p.role = 'student'
    and auth.uid() is not null
    and (
      public.is_admin()
      or (
        not exists (select 1 from public.user_blocks b where b.blocker_id = p.id and b.blocked_id = auth.uid())
        and (
          public.teaches_student(p.id)
          or (public.profile_is_staff(auth.uid())
              and (public.staff_can_reach(auth.uid(), p.id)
                   or (public.shares_group_with(p.id) and not public.profile_is_managed(p.id))))
          or (public.is_tutor() and not public.profile_is_managed(p.id))
        )
      )
    );
revoke all on public.student_directory from public, anon;
grant select on public.student_directory to authenticated;
