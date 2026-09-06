CREATE OR REPLACE FUNCTION public.set_bank_details_verified(
  _bank_details_id UUID,
  _verified BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can verify bank details';
  END IF;

  UPDATE engineer_bank_details
  SET verified = _verified,
      verified_by = CASE WHEN _verified THEN auth.uid() ELSE NULL END,
      verified_at = CASE WHEN _verified THEN now() ELSE NULL END
  WHERE id = _bank_details_id;
END;
$$;