-- ============================================================================
-- MANUAL SQL — run from the Supabase Dashboard → SQL Editor.
-- This file is NOT a migration (it lives outside supabase/migrations on purpose)
-- so it never runs automatically. Read each block before running it.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Bootstrap your first ADMIN.
--    There is no admin account by default, and the app can't create one
--    (self-assigning admin is blocked by RLS — by design). Promote an existing
--    user (sign that user up through the app first), then run this with their email.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'you@yourcompany.com'   -- <-- CHANGE THIS
ON CONFLICT (user_id, role) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) (Optional) Fix demo accounts that can't sign in with "Invalid login
--    credentials". The demo seed (migration 20260502181557) inserts directly
--    into auth.users but does NOT create matching auth.identities rows. Modern
--    GoTrue requires an email identity to authenticate with a password, so those
--    seeded users fail to log in. This backfills the missing identity rows.
--
--    Demo credentials (from the seed): password = DemoEngineer!2026
--    e.g. demo.engineer.us@example.com / DemoEngineer!2026
--
--    NOTE: auth.identities gained a NOT NULL `provider_id` column in 2024. This
--    statement targets that (current) schema. If your project predates it,
--    remove the provider_id column/value.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  u.id::text,
  now(), now(), now()
FROM auth.users u
WHERE COALESCE((u.raw_user_meta_data->>'demo_seed')::boolean, false) = true
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) (Diagnostic) See who has which role.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT u.email, r.role
-- FROM auth.users u
-- LEFT JOIN public.user_roles r ON r.user_id = u.id
-- ORDER BY u.created_at DESC;
