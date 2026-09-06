-- ============================================================================
-- Fix: assign a role on signup (server-side) and backfill role-less users.
--
-- Background:
--   Migration 20260414145859 added a "Users can insert own role" policy so the
--   client (Login.tsx) could self-assign a role. Migration 20260417043912
--   ("prevent privilege escalation") correctly DROPPED that policy — but nothing
--   replaced the role-assignment path. Since then, handle_new_user() only created
--   a profile, so every new signup ended up with NO row in user_roles. The
--   client-side insert is now blocked by RLS (and was a privilege-escalation hole
--   anyway), so users were left role-less → broken dashboards / login confusion.
--
-- This migration:
--   1. Rewrites handle_new_user() to also assign a role from signup metadata,
--      CLAMPED to a safe, non-privileged allow-list (client / engineer / partner).
--   2. Backfills a default 'client' role for any existing user that has none.
--
-- It deliberately does NOT re-add a client-writable INSERT policy on user_roles.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text := NEW.raw_user_meta_data->>'requested_role';
  safe_role public.app_role;
BEGIN
  -- Always create the profile.
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  -- Demo-seed rows assign their own role explicitly; don't add a default.
  IF COALESCE((NEW.raw_user_meta_data->>'demo_seed')::boolean, false) THEN
    RETURN NEW;
  END IF;

  -- Clamp the self-selected role. Privileged roles (admin, team_lead,
  -- service_desk, associate_coordinator) must be granted by an admin.
  safe_role := CASE
    WHEN requested IN ('client', 'engineer', 'partner') THEN requested::public.app_role
    ELSE 'client'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, safe_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: give every existing user without any role a default 'client' role,
-- so they are not locked out by RoleGuard (and don't silently bypass it).
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'client'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- ── Bootstrap your first admin (run once, manually, with your real email) ─────
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin'::public.app_role FROM auth.users WHERE email = 'you@yourcompany.com'
-- ON CONFLICT (user_id, role) DO NOTHING;
