-- Add the missing application-tracking columns to engineers
alter table public.engineers
  add column if not exists application_status text not null default 'pending'
    check (application_status in ('pending', 'approved', 'rejected')),
  add column if not exists application_review_note text,
  add column if not exists application_reviewed_by uuid references auth.users(id),
  add column if not exists application_reviewed_at timestamptz,
  add column if not exists application_submitted_at timestamptz not null default now();