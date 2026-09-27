-- CareerMatch hybrid recommender
-- Run after 004_offer_workflow.sql.

create extension if not exists vector with schema extensions;

alter table public.students
  add column if not exists semantic_text text,
  add column if not exists semantic_embedding extensions.vector(384),
  add column if not exists embedding_updated_at timestamptz;

alter table public.internship_listings
  add column if not exists semantic_text text,
  add column if not exists semantic_embedding extensions.vector(384),
  add column if not exists embedding_updated_at timestamptz;

comment on column public.students.semantic_embedding is
  'Normalized gte-small embedding generated from non-sensitive matching fields.';

comment on column public.internship_listings.semantic_embedding is
  'Normalized gte-small embedding generated from the internship content.';

select 'CareerMatch hybrid recommender storage is ready' as result;
