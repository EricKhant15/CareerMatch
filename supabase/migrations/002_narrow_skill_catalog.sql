-- CareerMatch academic MVP skill catalog
-- This hides unused skills without deleting them or breaking existing records.

begin;

update public.skills
set is_active = lower(trim(name)) in (
  'c',
  'java',
  'python',
  'javascript',
  'html',
  'css',
  'sql',
  'git',
  'linux',
  'excel',
  'pandas',
  'figma'
);

commit;

-- This result should contain exactly 12 active rows.
select name, skill_key, fields
from public.skills
where is_active = true
order by name;
