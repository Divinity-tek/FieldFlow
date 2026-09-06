-- Fix: safely add the unique constraint that the previous migration's
-- "ADD CONSTRAINT IF NOT EXISTS" line failed to create (invalid Postgres syntax).
-- This is what submit_engineer_application's ON CONFLICT (user_id) needs to work.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'engineers_user_id_key'
      and conrelid = 'public.engineers'::regclass
  ) then
    alter table public.engineers
      add constraint engineers_user_id_key unique (user_id);
  end if;
end $$;

-- Sanity check: confirm the constraint now exists
select conname, contype
from pg_constraint
where conrelid = 'public.engineers'::regclass
  and conname = 'engineers_user_id_key';
