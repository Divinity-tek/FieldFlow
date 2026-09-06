import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Highest-privilege first. Used to deterministically resolve a single
 * "primary" role when a user holds more than one, and to drive the
 * default landing route after sign-in.
 */
const ROLE_PRIORITY: AppRole[] = [
  "admin",
  "team_lead",
  "service_desk",
  "associate_coordinator",
  "partner",
  "engineer",
  "client",
  "recruiter",
];

/** Pick the highest-privilege role from a list (or null if empty). */
export function pickPrimaryRole(roles: Array<AppRole | null | undefined>): AppRole | null {
  const present = new Set(roles.filter(Boolean) as AppRole[]);
  for (const role of ROLE_PRIORITY) {
    if (present.has(role)) return role;
  }
  return null;
}

/** Home route for a given role. Returns "/" for an unknown/absent role. */
export function homeRouteForRole(role: AppRole | null | undefined): string {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "team_lead":
      return "/teamlead";
    case "engineer":
      return "/engineer/dashboard";
    case "client":
      return "/client";
    case "partner":
      return "/partner";
    case "associate_coordinator":
      return "/coordinator";
    case "service_desk":
      return "/service-desk";
    case "recruiter":
      return "/recruiter";  
    default:
      return "/";
  }
}

/**
 * Roles a user is allowed to self-assign at signup. Privileged roles
 * (admin, team_lead, service_desk, associate_coordinator) must be granted by
 * an administrator and are enforced server-side by the handle_new_user trigger.
 */
export const SELF_SIGNUP_ROLES: AppRole[] = ["client", "engineer", "partner", "recruiter"];