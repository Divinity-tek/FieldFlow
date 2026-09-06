CREATE OR REPLACE FUNCTION public.can_engineer_view_client(_client_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.engineers e ON e.id = j.engineer_id
    WHERE j.client_id = _client_id
      AND e.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_partner_access_client(_client_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.partners p ON p.id = c.partner_id
    WHERE c.id = _client_id
      AND p.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_client_view_engineer(_engineer_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.clients c ON c.id = j.client_id
    WHERE j.engineer_id = _engineer_id
      AND c.user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Engineers view clients of their assigned jobs" ON public.clients;
CREATE POLICY "Engineers view clients of their assigned jobs"
ON public.clients
FOR SELECT
TO authenticated
USING (public.can_engineer_view_client(id, auth.uid()));

DROP POLICY IF EXISTS "Clients can view own jobs" ON public.jobs;
CREATE POLICY "Clients can view own jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (public.is_client_member(client_id, auth.uid()));

DROP POLICY IF EXISTS "Partners can view client jobs" ON public.jobs;
CREATE POLICY "Partners can view client jobs"
ON public.jobs
FOR SELECT
TO authenticated
USING (public.can_partner_access_client(client_id, auth.uid()));

DROP POLICY IF EXISTS "Clients view engineers assigned to their jobs" ON public.engineers;
CREATE POLICY "Clients view engineers assigned to their jobs"
ON public.engineers
FOR SELECT
TO authenticated
USING (public.can_client_view_engineer(id, auth.uid()));