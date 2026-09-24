-- CareerMatch internship-offer workflow
-- Run in Supabase SQL Editor after supabase-interview-workflow.sql.

alter table public.applications
  add column if not exists offer_status text,
  add column if not exists offer_sent_at timestamptz,
  add column if not exists offer_responded_at timestamptz,
  add column if not exists offer_decline_reason text;

alter table public.applications
  drop constraint if exists applications_offer_status_check;

alter table public.applications
  add constraint applications_offer_status_check
  check (
    offer_status is null
    or offer_status in ('Pending', 'Accepted', 'Declined', 'Withdrawn')
  );

update public.applications
set
  offer_status = 'Pending',
  offer_sent_at = coalesce(interview_updated_at, now())
where status = 'Accepted'
  and interview_status = 'Completed'
  and offer_status is null;

create unique index if not exists applications_one_accepted_offer_per_student
on public.applications (student_id)
where offer_status = 'Accepted';

create or replace function public.respond_to_internship_offer(
  p_application_id uuid,
  p_response text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  application_record public.applications%rowtype;
  student_record public.students%rowtype;
  student_profile public.profiles%rowtype;
  listing_record public.internship_listings%rowtype;
  company_record public.companies%rowtype;
  other_offer record;
  accepted_count integer;
  normalized_response text;
begin
  normalized_response := initcap(lower(trim(p_response)));
  if normalized_response not in ('Accepted', 'Declined') then
    raise exception 'Offer response must be Accepted or Declined';
  end if;

  select * into application_record
  from public.applications
  where id = p_application_id;

  if application_record.id is null then
    raise exception 'Application not found';
  end if;

  select * into student_record
  from public.students
  where id = application_record.student_id
    and profile_id = auth.uid();

  if student_record.id is null then
    raise exception 'You cannot respond to this offer';
  end if;

  if application_record.offer_status <> 'Pending' then
    raise exception 'This offer is no longer waiting for a response';
  end if;

  select * into student_profile from public.profiles where id = student_record.profile_id;
  select * into listing_record from public.internship_listings where id = application_record.listing_id;
  select * into company_record from public.companies where id = listing_record.company_id;

  if normalized_response = 'Accepted' then
    if listing_record.status in ('Filled', 'Cancelled', 'Archived') then
      raise exception 'This internship is no longer accepting offer responses';
    end if;

    if exists (
      select 1 from public.applications
      where student_id = student_record.id
        and id <> application_record.id
        and offer_status = 'Accepted'
    ) then
      raise exception 'You have already accepted another internship offer';
    end if;

    select count(*) into accepted_count
    from public.applications
    where listing_id = listing_record.id
      and offer_status = 'Accepted';
    if accepted_count >= greatest(coalesce(listing_record.openings, 1), 1) then
      raise exception 'All positions for this internship have already been filled';
    end if;
  end if;

  update public.applications
  set
    offer_status = normalized_response,
    offer_responded_at = now(),
    offer_decline_reason = case when normalized_response = 'Declined' then trim(p_reason) else null end
  where id = application_record.id;

  insert into public.notifications (
    recipient_profile_id, listing_id, notification_type, title, message
  ) values (
    company_record.profile_id,
    listing_record.id,
    'offer_response',
    coalesce(student_profile.full_name, 'Student') || ' responded to an offer',
    case
      when normalized_response = 'Accepted' then
        coalesce(student_profile.full_name, 'Student') || ' accepted the internship offer for ' || listing_record.title || '.'
      else
        coalesce(student_profile.full_name, 'Student') || ' declined the internship offer for ' || listing_record.title ||
          case when nullif(trim(p_reason), '') is not null then '. Reason: ' || trim(p_reason) else '.' end
    end
  );

  if normalized_response = 'Accepted' then
    for other_offer in
      select application.id, internship.id as listing_id, internship.title,
             other_company.profile_id as company_profile_id
      from public.applications application
      join public.internship_listings internship on internship.id = application.listing_id
      join public.companies other_company on other_company.id = internship.company_id
      where application.student_id = student_record.id
        and application.id <> application_record.id
        and application.offer_status = 'Pending'
    loop
      update public.applications
      set
        offer_status = 'Declined',
        offer_responded_at = now(),
        offer_decline_reason = 'Accepted another internship offer'
      where id = other_offer.id;

      insert into public.notifications (
        recipient_profile_id, listing_id, notification_type, title, message
      ) values (
        other_offer.company_profile_id,
        other_offer.listing_id,
        'offer_response',
        coalesce(student_profile.full_name, 'Student') || ' declined an offer',
        coalesce(student_profile.full_name, 'Student') || ' accepted another internship offer and declined the offer for ' || other_offer.title || '.'
      );
    end loop;

    select count(*) into accepted_count
    from public.applications
    where listing_id = listing_record.id
      and offer_status = 'Accepted';

    if accepted_count >= greatest(coalesce(listing_record.openings, 1), 1) then
      update public.internship_listings
      set status = 'Filled', updated_at = now()
      where id = listing_record.id;

      update public.applications
      set
        offer_status = 'Withdrawn',
        offer_responded_at = now(),
        offer_decline_reason = 'All internship positions were filled'
      where listing_id = listing_record.id
        and id <> application_record.id
        and offer_status = 'Pending';

      insert into public.notifications (
        recipient_profile_id, listing_id, notification_type, title, message
      )
      select distinct
        applicant_student.profile_id,
        listing_record.id,
        'listing_filled',
        listing_record.title || ' positions filled',
        company_record.company_name || ' has filled all available positions for ' || listing_record.title ||
          '. Your application will not continue.'
      from public.applications other_application
      join public.students applicant_student on applicant_student.id = other_application.student_id
      where other_application.listing_id = listing_record.id
        and other_application.id <> application_record.id
        and other_application.status <> 'Rejected'
        and coalesce(other_application.offer_status, '') <> 'Accepted';
    end if;
  end if;

  return jsonb_build_object(
    'application_id', application_record.id,
    'offer_status', normalized_response,
    'listing_status', case
      when normalized_response = 'Accepted' and accepted_count >= greatest(coalesce(listing_record.openings, 1), 1)
        then 'Filled'
      else listing_record.status
    end
  );
end;
$$;

grant execute on function public.respond_to_internship_offer(uuid, text, text)
to authenticated;

select 'CareerMatch offer workflow is ready' as result;
