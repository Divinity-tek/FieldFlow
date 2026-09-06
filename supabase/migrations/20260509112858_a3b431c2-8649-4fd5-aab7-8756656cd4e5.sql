CREATE OR REPLACE FUNCTION public._payout_changed(old_val numeric, new_val numeric)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(old_val, 0) IS DISTINCT FROM COALESCE(new_val, 0);
$$;