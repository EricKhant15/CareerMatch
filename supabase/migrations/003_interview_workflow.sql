-- CareerMatch interview workflow extension
-- Run once in the Supabase SQL Editor after supabase-internship-workflow.sql.

alter table public.applications
  add column if not exists interview_round text,
  add column if not exists interview_date date,
  add column if not exists interview_time time,
  add column if not exists interview_type text,
  add column if not exists interviewer text,
  add column if not exists meeting_link text,
  add column if not exists interview_location text,
  add column if not exists interview_message text,
  add column if not exists interview_status text,
  add column if not exists interview_updated_at timestamptz;

alter table public.applications
  drop constraint if exists applications_interview_status_check;

alter table public.applications
  add constraint applications_interview_status_check
  check (
    interview_status is null
    or interview_status in ('Draft', 'Sent', 'Completed', 'Cancelled')
  );

create or replace function public.notify_application_student(
  p_application_id uuid,
  p_title text,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  application_record public.applications%rowtype;
  listing_record public.internship_listings%rowtype;
  company_record public.companies%rowtype;
  student_profile_id uuid;
begin
  select * into application_record
  from public.applications
  where id = p_application_id;

  if application_record.id is null then
    raise exception 'Application not found';
  end if;

  select * into listing_record
  from public.internship_listings
  where id = application_record.listing_id;

  select * into company_record
  from public.companies
  where id = listing_record.company_id
    and profile_id = auth.uid();

  if company_record.id is null then
    raise exception 'You cannot notify this applicant';
  end if;

  select profile_id into student_profile_id
  from public.students
  where id = application_record.student_id;

  insert into public.notifications (
    recipient_profile_id,
    listing_id,
    notification_type,
    title,
    message
  ) values (
    student_profile_id,
    listing_record.id,
    'application_update',
    p_title,
    company_record.company_name || ' — ' || listing_record.title || ': ' || p_message
  );

  return true;
end;
$$;

grant execute on function public.notify_application_student(uuid, text, text)
to authenticated;

select 'CareerMatch interview workflow is ready' as result;
