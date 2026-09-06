// Auth state is provided by a single <AuthProvider> (see src/contexts/AuthContext).
// Re-exported here so the many existing `@/hooks/useAuth` import sites keep working
// while sharing ONE Supabase auth subscription instead of one per component.
export { useAuth, AuthProvider } from "@/contexts/AuthContext";
