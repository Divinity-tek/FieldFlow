-- Align the engineer signup RPC / table contract with the UI contract.
-- The client now sends nda_signed and certifications as multi-select evidence.
-- The DB must keep those values durable on the application record and let the
-- admin review page set document-review evidence before approval.

alter table public.engineers
  add column if not exists nda_signed boolean not null default false,
  add column if not exists nda_signed_at timestamptz,
  add column if not exists documents_reviewed boolean not null default false,
  add column if not exists documents_reviewed_at timestamptz,
  add column if not exists documents_reviewed_by uuid,
  add column if not exists certifications text[] not null default '{}';

-- Recreate the application submission RPC with the actual request contract.
drop function if exists public.submit_engineer_application(
  uuid, text, text, text, text, text, text, text, text, text,
  text[], text, text, text, text, text, text, boolean, timestamptz, uuid, text
);

do $$ 
declare 
    r record;
begin
    for r in (
        select oid::regprocedure as func_signature
        from pg_proc
        where proname = 'submit_engineer_application'
          and pronamespace = 'public'::regnamespace
    ) loop
        execute 'drop function ' || r.func_signature || ' cascade;';
    end loop;
end $$;

create or replace function public.submit_engineer_application(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_residential_address text,
  p_specialty text,
  p_city text,
  p_state text,
  p_postcode text,
  p_country text,
  p_skills text[],
  p_certification text default null,
  p_certifications text[] default '{}',
  p_id_type text default null,
  p_id_document_front_name text default null,
  p_id_document_front_data text default null,
  p_id_document_back_name text default null,
  p_id_document_back_data text default null,
  p_nda_signed boolean default false,
  p_nda_signed_at timestamptz default null,
  p_assigned_admin_id uuid default null,
  p_assigned_admin_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location text;
  v_certification_summary text;
begin
  if p_nda_signed is not true then
    raise exception 'NDA must be signed to submit an engineer application';
  end if;

  if p_certifications is null then
    p_certifications := '{}'::text[];
  end if;

  v_certification_summary := coalesce(p_certification, array_to_string(p_certifications, ' | '));

  v_location := trim(both ', ' from
    concat_ws(', ', nullif(p_city, ''), nullif(p_state, ''), nullif(p_country, ''))
  );

  insert into public.engineers (
    user_id, full_name, email, phone, residential_address,
    specialty, location, city, state, postcode, country, skills,
    certification, certifications, id_type,
    id_document_front_name, id_document_front_data,
    id_document_back_name, id_document_back_data,
    nda_signed, nda_signed_at,
    application_status, application_submitted_at, is_available
  ) values (
    p_user_id, p_full_name, p_email, p_phone, p_residential_address,
    p_specialty, v_location, p_city, p_state, p_postcode, p_country, p_skills,
    v_certification_summary, p_certifications, p_id_type,
    p_id_document_front_name, p_id_document_front_data,
    p_id_document_back_name, p_id_document_back_data,
    p_nda_signed, coalesce(p_nda_signed_at, now()),
    'pending', now(), false
  )
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        residential_address = excluded.residential_address,
        specialty = excluded.specialty,
        location = excluded.location,
        city = excluded.city,
        state = excluded.state,
        postcode = excluded.postcode,
        country = excluded.country,
        skills = excluded.skills,
        certification = excluded.certification,
        certifications = excluded.certifications,
        id_type = excluded.id_type,
        id_document_front_name = excluded.id_document_front_name,
        id_document_front_data = excluded.id_document_front_data,
        id_document_back_name = excluded.id_document_back_name,
        id_document_back_data = excluded.id_document_back_data,
        nda_signed = excluded.nda_signed,
        nda_signed_at = excluded.nda_signed_at,
        application_status = 'pending',
        application_submitted_at = now();

  insert into public.pending_engineer_approvals (
    user_id, full_name, email, phone, residential_address,
    certification, id_type, id_document_front_name, id_document_front_data,
    id_document_back_name, id_document_back_data,
    assigned_admin_id, assigned_admin_email, status, created_at
  ) values (
    p_user_id, p_full_name, p_email, p_phone, p_residential_address,
    v_certification_summary, p_id_type,
    p_id_document_front_name, p_id_document_front_data,
    p_id_document_back_name, p_id_document_back_data,
    p_assigned_admin_id, p_assigned_admin_email, 'pending', now()
  );
end;
$$;

grant execute on function public.submit_engineer_application to anon, authenticated;

-- grant execute on function public.submit_engineer_application(
--   uuid, text, text, text, text, text, text, text, text, text,
--   text[], text, text[], text, text, text, text, text,
--   boolean, timestamptz, uuid, text
-- ) to anon, authenticated;
