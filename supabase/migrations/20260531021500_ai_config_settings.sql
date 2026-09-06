-- AI provider configuration, editable by admins from the in-app Integrations page.
-- Non-secret config lives in ai_settings (admin-readable). The API key lives in
-- ai_secrets, which has NO select/write policies — so the browser can NEVER read
-- it back. Only service_role (edge functions) bypasses RLS, and writes go through
-- the SECURITY DEFINER set_ai_config() function.

-- Singleton config table (non-secret)
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id boolean PRIMARY KEY DEFAULT true,
  provider text NOT NULL DEFAULT 'ollama',
  model text,
  vision_model text,
  base_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT ai_settings_singleton CHECK (id)
);

-- Singleton secret table (write-only via RPC; never selectable by clients)
CREATE TABLE IF NOT EXISTS public.ai_secrets (
  id boolean PRIMARY KEY DEFAULT true,
  api_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_secrets_singleton CHECK (id)
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_secrets  ENABLE ROW LEVEL SECURITY;

-- Admins may read non-secret config. (Writes happen via set_ai_config only.)
DROP POLICY IF EXISTS "Admins read ai_settings" ON public.ai_settings;
CREATE POLICY "Admins read ai_settings" ON public.ai_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ai_secrets: intentionally NO policies => no client (even admin) can select or
-- write it directly. service_role bypasses RLS; SECURITY DEFINER functions too.

-- Write config (admins only). API key only updated when a non-empty value is passed,
-- so admins can change provider/model without re-entering the key.
CREATE OR REPLACE FUNCTION public.set_ai_config(
  p_provider text,
  p_model text,
  p_vision_model text,
  p_base_url text,
  p_api_key text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  INSERT INTO public.ai_settings (id, provider, model, vision_model, base_url, updated_at, updated_by)
  VALUES (true, p_provider, NULLIF(p_model,''), NULLIF(p_vision_model,''), NULLIF(p_base_url,''), now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET provider = EXCLUDED.provider,
        model = EXCLUDED.model,
        vision_model = EXCLUDED.vision_model,
        base_url = EXCLUDED.base_url,
        updated_at = now(),
        updated_by = auth.uid();

  IF p_api_key IS NOT NULL AND length(p_api_key) > 0 THEN
    INSERT INTO public.ai_secrets (id, api_key, updated_at)
    VALUES (true, p_api_key, now())
    ON CONFLICT (id) DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = now();
  END IF;
END;
$$;

-- Read current config + whether a key is set (boolean only). Admins only.
CREATE OR REPLACE FUNCTION public.get_ai_config()
RETURNS TABLE(provider text, model text, vision_model text, base_url text, has_api_key boolean, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  RETURN QUERY
  SELECT s.provider, s.model, s.vision_model, s.base_url,
         EXISTS (SELECT 1 FROM public.ai_secrets x WHERE x.api_key IS NOT NULL AND length(x.api_key) > 0),
         s.updated_at
  FROM public.ai_settings s
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.set_ai_config(text,text,text,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_ai_config() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_ai_config(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_config() TO authenticated;
