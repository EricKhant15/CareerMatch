-- CareerMatch internship workflow extension
-- Run once in the Supabase SQL Editor after the existing CareerMatch schema.

create extension if not exists pgcrypto;

alter table public.internship_listings
  add column if not exists learning_outcomes text,
  add column if not exists internship_benefits text,
  add column if not exists completion_documents text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

alter table public.applications
  add column if not exists cv_path text,
  add column if not exists cv_filename text;

alter table public.internship_listings
  drop constraint if exists internship_listings_status_check;

alter table public.internship_listings
  add constraint internship_listings_status_check
  check (status in ('Draft', 'Open', 'Closed', 'Filled', 'Cancelled', 'Archived'));

create table if not exists public.listing_updates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.internship_listings(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.internship_listings(id) on delete set null,
  notification_type text not null default 'listing_update',
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.listing_updates enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Companies can read own listing updates" on public.listing_updates;
create policy "Companies can read own listing updates"
on public.listing_updates for select to authenticated
using (
  exists (
    select 1 from public.companies company
    where company.id = listing_updates.company_id
      and company.profile_id = auth.uid()
  )
);

drop policy if exists "Students can read relevant listing updates" on public.listing_updates;
create policy "Students can read relevant listing updates"
on public.listing_updates for select to authenticated
using (
  exists (
    select 1
    from public.applications application
    join public.students student on student.id = application.student_id
    where application.listing_id = listing_updates.listing_id
      and student.profile_id = auth.uid()
  )
);

drop policy if exists "Students can read own notifications" on public.notifications;
create policy "Students can read own notifications"
on public.notifications for select to authenticated
using (recipient_profile_id = auth.uid());

drop policy if exists "Students can update own notifications" on public.notifications;
create policy "Students can update own notifications"
on public.notifications for update to authenticated
using (recipient_profile_id = auth.uid())
with check (recipient_profile_id = auth.uid());

create or replace function public.company_owns_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.internship_listings listing
    join public.companies company on company.id = listing.company_id
    where listing.id = p_listing_id
      and company.profile_id = auth.uid()
  );
$$;

grant execute on function public.company_owns_listing(uuid) to authenticated;

drop policy if exists "Companies can update own internship listings" on public.internship_listings;
create policy "Companies can update own internship listings"
on public.internship_listings for update to authenticated
using (public.company_owns_listing(id))
with check (public.company_owns_listing(id));

drop policy if exists "Companies can delete own listing skills" on public.listing_skills;
create policy "Companies can delete own listing skills"
on public.listing_skills for delete to authenticated
using (public.company_owns_listing(listing_id));

create or replace function public.notify_listing_applicants(
  p_listing_id uuid,
  p_summary text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_record public.internship_listings%rowtype;
  company_record public.companies%rowtype;
  notified_count integer;
begin
  select * into listing_record
  from public.internship_listings
  where id = p_listing_id;

  if listing_record.id is null then
    raise exception 'Listing not found';
  end if;

  select * into company_record
  from public.companies
  where id = listing_record.company_id
    and profile_id = auth.uid();

  if company_record.id is null then
    raise exception 'You cannot update notifications for this listing';
  end if;

  insert into public.listing_updates (listing_id, company_id, summary)
  values (listing_record.id, company_record.id, p_summary);

  insert into public.notifications (
    recipient_profile_id,
    listing_id,
    notification_type,
    title,
    message
  )
  select distinct
    student.profile_id,
    listing_record.id,
    'listing_update',
    listing_record.title || ' was updated',
    company_record.company_name || ' updated the ' || listing_record.title ||
      ' listing. ' || p_summary
  from public.applications application
  join public.students student on student.id = application.student_id
  where application.listing_id = listing_record.id;

  get diagnostics notified_count = row_count;
  return notified_count;
end;
$$;

grant execute on function public.notify_listing_applicants(uuid, text) to authenticated;

create or replace function public.student_has_applied_to_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.applications application
    join public.students student on student.id = application.student_id
    where application.listing_id = p_listing_id
      and student.profile_id = auth.uid()
  );
$$;

grant execute on function public.student_has_applied_to_listing(uuid) to authenticated;

drop policy if exists "Students can read listings they applied to" on public.internship_listings;
create policy "Students can read listings they applied to"
on public.internship_listings for select to authenticated
using (public.student_has_applied_to_listing(id));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'application-cvs',
  'application-cvs',
  false,
  5242880,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.company_can_read_cv(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
    from public.applications application
    join public.internship_listings listing on listing.id = application.listing_id
    join public.companies company on company.id = listing.company_id
    where application.cv_path = p_object_name
      and company.profile_id = auth.uid()
  );
$$;

grant execute on function public.company_can_read_cv(text) to authenticated;

drop policy if exists "Students can upload own CV" on storage.objects;
create policy "Students can upload own CV"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'application-cvs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Students can read own CV" on storage.objects;
create policy "Students can read own CV"
on storage.objects for select to authenticated
using (
  bucket_id = 'application-cvs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.company_can_read_cv(name)
  )
);

drop policy if exists "Students can remove own CV" on storage.objects;
create policy "Students can remove own CV"
on storage.objects for delete to authenticated
using (
  bucket_id = 'application-cvs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

select 'CareerMatch internship workflow is ready' as result;
