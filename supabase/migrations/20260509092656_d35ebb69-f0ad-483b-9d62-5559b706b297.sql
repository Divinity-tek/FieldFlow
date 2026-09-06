
REVOKE EXECUTE ON FUNCTION public.resolve_service_desk_team(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_service_desk_team(TEXT, TEXT, TEXT, TEXT) TO authenticated;
