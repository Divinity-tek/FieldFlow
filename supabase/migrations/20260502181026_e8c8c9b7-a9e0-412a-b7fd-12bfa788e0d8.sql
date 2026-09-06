CREATE OR REPLACE FUNCTION public.enforce_single_default_client_address()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.client_addresses
       SET is_default = false, updated_at = now()
     WHERE client_id = NEW.client_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_addresses_single_default ON public.client_addresses;
CREATE TRIGGER trg_client_addresses_single_default
AFTER INSERT OR UPDATE OF is_default ON public.client_addresses
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.enforce_single_default_client_address();