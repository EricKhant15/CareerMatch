-- CareerMatch admin analytics and synthetic demonstration support.

begin;

alter table public.profiles
  add column if not exists is_demo boolean not null default false;

create or replace function public.careermatch_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and account_status = 'approved'
  );
$$;

grant execute on function public.careermatch_is_admin() to authenticated;

create table if not exists public.saved_internships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  listing_id uuid not null references public.internship_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, listing_id)
);

create table if not exists public.listing_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  listing_id uuid not null references public.internship_listings(id) on delete cascade,
  event_type text not null check (event_type in ('detail_view', 'recommendation_view')),
  created_at timestamptz not null default now()
);

create table if not exists public.recommender_test_runs (
  id uuid primary key default gen_random_uuid(),
  run_label text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  expected_listing_ids uuid[] not null default '{}',
  actual_listing_ids uuid[] not null default '{}',
  top_1_pass boolean not null default false,
  top_3_pass boolean not null default false,
  rule_filter_pass boolean not null default false,
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists saved_internships_listing_idx
  on public.saved_internships (listing_id);
create index if not exists listing_events_listing_type_idx
  on public.listing_events (listing_id, event_type);
create index if not exists listing_events_created_idx
  on public.listing_events (created_at desc);
create index if not exists recommender_test_runs_created_idx
  on public.recommender_test_runs (created_at desc);
create index if not exists profiles_is_demo_idx
  on public.profiles (is_demo, role);

alter table public.saved_internships enable row level security;
alter table public.listing_events enable row level security;
alter table public.recommender_test_runs enable row level security;

drop policy if exists "Students manage own saved internships" on public.saved_internships;
create policy "Students manage own saved internships"
on public.saved_internships for all to authenticated
using (
  exists (
    select 1 from public.students
    where students.id = saved_internships.student_id
      and students.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.students
    where students.id = saved_internships.student_id
      and students.profile_id = auth.uid()
  )
);

drop policy if exists "Admins read saved internship analytics" on public.saved_internships;
create policy "Admins read saved internship analytics"
on public.saved_internships for select to authenticated
using (public.careermatch_is_admin());

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

drop policy if exists "Admins read listing analytics" on public.listing_events;
create policy "Admins read listing analytics"
on public.listing_events for select to authenticated
using (public.careermatch_is_admin());

drop policy if exists "Admins read recommender evaluations" on public.recommender_test_runs;
create policy "Admins read recommender evaluations"
on public.recommender_test_runs for select to authenticated
using (public.careermatch_is_admin());

grant select, insert, update, delete on public.saved_internships to authenticated;
grant select, insert on public.listing_events to authenticated;
grant select on public.recommender_test_runs to authenticated;

commit;

select 'CareerMatch analytics schema is ready' as result;
