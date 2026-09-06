-- ============================================================================
-- VERIFY + REPAIR the four test accounts. Run in Supabase → SQL Editor.
-- Password for all (set by you): NET@admin9876
-- ============================================================================

-- ── 1) DIAGNOSE: why might these logins fail? ────────────────────────────────
-- email_confirmed = false  → login returns "Invalid login credentials" until
--                            confirmed (or until "Confirm email" is turned off).
-- has_email_identity = false → GoTrue can't authenticate the password → fails.
-- roles = {}                → login succeeds but lands on /access-pending.
SELECT
  u.email,
  (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
  EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  ) AS has_email_identity,
  COALESCE(array_agg(r.role::text) FILTER (WHERE r.role IS NOT NULL), '{}') AS roles
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE u.email IN (
  'admin@FieldFlow.local',
  'engineer@FieldFlow.local',
  'client@FieldFlow.local',
  'teamlead@FieldFlow.local'
)
GROUP BY u.email, u.email_confirmed_at, u.id
ORDER BY u.email;


-- ── 2) REPAIR: confirm emails + assign the intended roles ────────────────────
-- (a) Mark the four accounts as email-confirmed (so login works even if the
--     "Confirm email" setting is on).
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email IN (
  'admin@FieldFlow.local',
  'engineer@FieldFlow.local',
  'client@FieldFlow.local',
  'teamlead@FieldFlow.local'
);

-- (b) Assign each account its intended role.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
  (CASE u.email
     WHEN 'admin@FieldFlow.local'    THEN 'admin'
     WHEN 'engineer@FieldFlow.local' THEN 'engineer'
     WHEN 'client@FieldFlow.local'   THEN 'client'
     WHEN 'teamlead@FieldFlow.local' THEN 'team_lead'
   END)::public.app_role
FROM auth.users u
WHERE u.email IN (
  'admin@FieldFlow.local',
  'engineer@FieldFlow.local',
  'client@FieldFlow.local',
  'teamlead@FieldFlow.local'
)
ON CONFLICT (user_id, role) DO NOTHING;


-- ── 3) (Only if has_email_identity was false above) create email identities ──
-- Required for password login when accounts were inserted directly into
-- auth.users. Safe no-op if identities already exist.
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', u.id::text, now(), now(), now()
FROM auth.users u
WHERE u.email IN (
  'admin@FieldFlow.local',
  'engineer@FieldFlow.local',
  'client@FieldFlow.local',
  'teamlead@FieldFlow.local'
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
);


-- ── 4) Re-run block (1) to confirm: all should now show
--       email_confirmed = true, has_email_identity = true, and the right role.
