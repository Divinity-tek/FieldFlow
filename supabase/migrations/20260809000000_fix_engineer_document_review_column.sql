-- Ensure the engineer approval UI can persist document-review evidence without failing.
-- This guards the database schema and makes the app contract consistent with the code.

alter table public.engineers
  add column if not exists documents_reviewed boolean not null default false,
  add column if not exists documents_reviewed_at timestamptz,
  add column if not exists documents_reviewed_by uuid;

update public.engineers
set documents_reviewed = false
where documents_reviewed is null;
