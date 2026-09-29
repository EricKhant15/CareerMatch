-- Align the live analytics policies with the hardened 006 definition.

begin;

drop policy if exists "Students create own listing events" on public.listing_events;
create policy "Students create own listing events"
on public.listing_events for insert to authenticated
with check (
  exists (
    select 1 from public.students
    where students.id = listing_events.student_id
      and students.profile_id = auth.uid()
  )
);

grant select, insert, update, delete on public.saved_internships to authenticated;

commit;

select 'CareerMatch analytics policies are hardened' as result;
