-- Add every field collected by the "Add Engineer" form (manual entry + file
-- import, src/pages/Engineers.tsx) to public.engineers, so both flows can
-- write straight to Supabase instead of localStorage.
--
-- Also relaxes two constraints that don't hold for admin-created engineers:
--   • user_id: engineers added by an admin (manual or bulk import) don't
--     necessarily have a matching auth.users account yet, so this can be null.
--   • specialty: was NOT NULL; the form allows it to be blank.

alter table public.engineers
  alter column user_id drop not null,
  alter column specialty drop not null;

alter table public.engineers
  -- Identity / contact (previously only lived on `profiles`, which requires
  -- a real auth user; admin-added engineers may not have one yet)
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists residential_address text,

  -- Address breakdown (used for postcode -> city/state autofill)
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postcode text,
  add column if not exists country text,

  -- Rates (form supports multiple rate rows; primary one mirrors into the
  -- existing rate_type/rate_amount/rate_currency/hourly_rate columns)
  add column if not exists rate_type text not null default 'Hourly',
  add column if not exists rate_amount numeric,
  add column if not exists rate_currency text not null default 'USD',
  add column if not exists rates jsonb not null default '[]'::jsonb,

  -- Engagement / sourcing
  add column if not exists vendor_partner text,
  add column if not exists engineer_type text not null default 'FreeLancer',
  add column if not exists source_recruiter text,

  -- Certification & ID verification (mirrors pending_engineer_approvals)
  add column if not exists certification text,
  add column if not exists id_type text,
  add column if not exists id_document_front_name text,
  add column if not exists id_document_front_data text,
  add column if not exists id_document_back_name text,
  add column if not exists id_document_back_data text;

comment on column public.engineers.rates is
  'Array of {rate_type, rate_amount, rate_currency} objects from the Add Engineer form.';
comment on column public.engineers.id_document_front_data is
  'Base64 data URL of the uploaded front-side ID image/PDF.';
comment on column public.engineers.id_document_back_data is
  'Base64 data URL of the uploaded back-side ID image/PDF.';

-- Team leads and associate coordinators can also add/manage engineers from
-- this screen — the existing "Admins can manage engineers" ALL policy only
-- covers admins.
drop policy if exists "Staff can insert engineers" on public.engineers;
create policy "Staff can insert engineers"
  on public.engineers for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'team_lead')
    or public.has_role(auth.uid(), 'associate_coordinator')
  );

drop policy if exists "Staff can update engineers" on public.engineers;
create policy "Staff can update engineers"
  on public.engineers for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'team_lead')
    or public.has_role(auth.uid(), 'associate_coordinator')
  );
