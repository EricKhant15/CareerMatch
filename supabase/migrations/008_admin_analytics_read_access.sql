-- Give approved administrators read-only access to the source tables used by analytics.

begin;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.companies enable row level security;
alter table public.internship_listings enable row level security;
alter table public.applications enable row level security;
alter table public.student_skills enable row level security;
alter table public.listing_skills enable row level security;
alter table public.skills enable row level security;

drop policy if exists "Admins read profiles for analytics" on public.profiles;
create policy "Admins read profiles for analytics" on public.profiles
for select to authenticated using (public.careermatch_is_admin());

drop policy if exists "Admins read students for analytics" on public.students;
create policy "Admins read students for analytics" on public.students
for select to authenticated using (public.careermatch_is_admin());

drop policy if exists "Admins read companies for analytics" on public.companies;
create policy "Admins read companies for analytics" on public.companies
for select to authenticated using (public.careermatch_is_admin());

drop policy if exists "Admins read listings for analytics" on public.internship_listings;
create policy "Admins read listings for analytics" on public.internship_listings
for select to authenticated using (public.careermatch_is_admin());

drop policy if exists "Admins read applications for analytics" on public.applications;
create policy "Admins read applications for analytics" on public.applications
for select to authenticated using (public.careermatch_is_admin());

drop policy if exists "Admins read student skills for analytics" on public.student_skills;
create policy "Admins read student skills for analytics" on public.student_skills
for select to authenticated using (public.careermatch_is_admin());

drop policy if exists "Admins read listing skills for analytics" on public.listing_skills;
create policy "Admins read listing skills for analytics" on public.listing_skills
for select to authenticated using (public.careermatch_is_admin());

drop policy if exists "Admins read skill catalog for analytics" on public.skills;
create policy "Admins read skill catalog for analytics" on public.skills
for select to authenticated using (public.careermatch_is_admin());

grant select on public.profiles, public.students, public.companies,
  public.internship_listings, public.applications, public.student_skills,
  public.listing_skills, public.skills to authenticated;

commit;

select 'CareerMatch admin analytics read access is ready' as result;
