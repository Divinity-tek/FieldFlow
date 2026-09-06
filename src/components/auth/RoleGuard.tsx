import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
}

const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { role, isLoading: roleLoading, getDefaultRoute } = useUserRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // No role assigned yet → send to a safe public page. This prevents a
  // role-less user from silently passing the guard, and avoids a redirect
  // loop through getDefaultRoute() (which would otherwise point back here).
  if (!role) {
    return <Navigate to="/access-pending" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={getDefaultRoute()} replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
