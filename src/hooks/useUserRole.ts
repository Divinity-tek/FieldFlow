import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { pickPrimaryRole, homeRouteForRole, type AppRole } from "@/lib/roles";

export function useUserRole() {
  const { user } = useAuth();

  const { data: role = null, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async (): Promise<AppRole | null> => {
      // Fetch ALL roles and resolve the highest-privilege one deterministically.
      // (The old `.limit(1)` returned an arbitrary role for multi-role users.)
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return pickPrimaryRole((data ?? []).map((r) => r.role as AppRole));
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin = role === "admin";
  const isTeamLead = role === "team_lead";
  const isEngineer = role === "engineer";
  const isClient = role === "client";
  const isPartner = role === "partner";
  const isAssociateCoordinator = role === "associate_coordinator";
  const isServiceDesk = role === "service_desk";
  const isRecruiter = role === "recruiter";

  const hasAccess = (allowedRoles: AppRole[]) => (role ? allowedRoles.includes(role) : false);

  const getDefaultRoute = () => homeRouteForRole(role);

  return {
    role,
    isLoading,
    isAdmin,
    isTeamLead,
    isEngineer,
    isClient,
    isPartner,
    isAssociateCoordinator,
    isServiceDesk,
    isRecruiter,
    hasAccess,
    getDefaultRoute,
  };
}
