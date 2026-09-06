
REVOKE EXECUTE ON FUNCTION public.find_best_engineer_for_job(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reassign_delayed_job(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_reassign_scan() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_best_engineer_for_job(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reassign_delayed_job(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_reassign_scan() TO service_role;
