--Create the pending_engineer_approvals table for the extra signup fields
create table if not exists public.pending_engineer_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  residential_address text,
  certification text,
  id_type text,
  id_document_front_name text,
  id_document_front_data text,
  id_document_back_name text,
  id_document_back_data text,
  assigned_admin_id uuid,
  assigned_admin_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.pending_engineer_approvals enable row level security;

-- engineer can see their own application
create policy "user can view own application"
  on public.pending_engineer_approvals for select
  using (auth.uid() = user_id);

-- admins can see/manage everything (adjust to your actual admin-role check)
create policy "admins manage applications"
  on public.pending_engineer_approvals for all
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ));

-- 3. The RPC the signup flow calls
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
  p_certification text,
  p_id_type text,
  p_id_document_front_name text,
  p_id_document_front_data text,
  p_id_document_back_name text,
  p_id_document_back_data text,
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
begin
  v_location := trim(both ', ' from
    concat_ws(', ', nullif(p_city, ''), nullif(p_state, ''), nullif(p_country, ''))
  );

  insert into public.engineers (
    user_id, specialty, location, skills,
    application_status, application_submitted_at, is_available
  ) values (
    p_user_id, p_specialty, v_location, p_skills,
    'pending', now(), false
  )
  on conflict (user_id) do update
    set specialty = excluded.specialty,
        location = excluded.location,
        skills = excluded.skills,
        application_status = 'pending',
        application_submitted_at = now();

  insert into public.pending_engineer_approvals (
    user_id, full_name, email, phone, residential_address,
    certification, id_type, id_document_front_name, id_document_front_data,
    id_document_back_name, id_document_back_data,
    assigned_admin_id, assigned_admin_email, status, created_at
  ) values (
    p_user_id, p_full_name, p_email, p_phone, p_residential_address,
    p_certification, p_id_type, p_id_document_front_name, p_id_document_front_data,
    p_id_document_back_name, p_id_document_back_data,
    p_assigned_admin_id, p_assigned_admin_email, 'pending', now()
  );
end;
$$;

grant execute on function public.submit_engineer_application(
  uuid, text, text, text, text, text, text, text, text, text,
  text[], text, text, text, text, text, text, uuid, text
) to anon, authenticated;