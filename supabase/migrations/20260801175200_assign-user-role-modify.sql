CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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
    WHEN requested IN ('client', 'engineer', 'partner', 'recruiter') THEN requested::public.app_role
    ELSE 'client'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, safe_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;