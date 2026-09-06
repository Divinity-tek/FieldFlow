// Maps each route path to the roles permitted to view it (mirrors RoleGuard usage in src/App.tsx).
// Used to filter contextual help docs so users only see guidance relevant to their permissions.

export type HelpRole =
  | "admin"
  | "team_lead"
  | "engineer"
  | "client"
  | "partner"
  | "associate_coordinator";

export const ALL_ROLES: HelpRole[] = [
  "admin",
  "team_lead",
  "engineer",
  "client",
  "partner",
  "associate_coordinator",
];

const PUBLIC: HelpRole[] = ALL_ROLES; // no role restriction
const AUTHED: HelpRole[] = ALL_ROLES; // any signed-in user

export const ROUTE_ROLES: Record<string, HelpRole[]> = {
  // Public
  "/": PUBLIC,
  "/landing": PUBLIC,
  "/login": PUBLIC,
  "/forgot-password": PUBLIC,
  "/reset-password": PUBLIC,
  "/shared/:token": PUBLIC,
  "/book": PUBLIC,

  // Admin-only
  "/dashboard": ["admin"],
  "/financials": ["admin"],
  "/regions": ["admin"],
  "/global-operations": ["admin"],
  "/analytics": ["admin"],
  "/org-structure": ["admin"],
  "/dispatch-model": ["admin"],
  "/rate-cards": ["admin"],
  "/recurring-billing": ["admin", "team_lead"],
  "/audit-logs": ["admin"],
  "/customer-portal": ["admin"],
  "/invoices": ["admin"],
  "/invoices/preview": ["admin"],
  "/invoices/preview/:idOrNumber": ["admin"],
  "/receipts": ["admin"],
  "/settings": ["admin"],
  "/partners": ["admin"],

  // Admin + Team Lead
  "/compliance": ["admin", "team_lead"],
  "/talent-pool": ["admin", "team_lead"],
  "/vendors": ["admin", "team_lead"],
  "/csat-surveys": ["admin", "team_lead"],
  "/route-optimizer": ["admin", "team_lead"],
  "/sla-escalation": ["admin", "team_lead"],
  "/scheduling": ["admin", "team_lead"],
  "/live-tracking": ["admin", "team_lead"],
  "/wallet": ["admin", "team_lead"],
  "/inventory": ["admin", "team_lead"],
  "/site-surveys": ["admin", "team_lead"],
  "/recurring-jobs": ["admin", "team_lead"],
  "/timesheets": ["admin", "team_lead"],
  "/purchase-orders": ["admin", "team_lead"],
  "/reports": ["admin", "team_lead"],
  
  "/external-chat": ["admin", "team_lead"],

  // Admin + Team Lead + Associate Coordinator
  "/auto-dispatch": ["admin", "team_lead", "associate_coordinator"],
  "/scheduler-board": ["admin", "team_lead", "associate_coordinator"],
  "/projects": ["admin", "team_lead", "associate_coordinator"],
  "/jobs": ["admin", "team_lead", "associate_coordinator"],
  "/engineers": ["admin", "team_lead", "associate_coordinator"],
  "/dispatch": ["admin", "team_lead", "associate_coordinator"],
  "/crm": ["admin", "team_lead", "associate_coordinator"],
  "/estimates": ["admin", "team_lead", "associate_coordinator"],
  "/estimate-templates": ["admin", "team_lead", "associate_coordinator"],
  "/sla": ["admin", "team_lead", "associate_coordinator"],
  "/helpdesk": ["admin", "team_lead", "associate_coordinator"],
  "/marketplace-admin": ["admin", "team_lead", "associate_coordinator"],

  // Engineer + admin/team-lead
  "/remote-assist": ["admin", "team_lead", "engineer"],
  "/custom-forms": ["admin", "team_lead", "engineer"],
  "/dispatch-tickets": ["admin", "team_lead", "engineer", "associate_coordinator"],
  "/marketplace": ["admin", "team_lead", "engineer", "associate_coordinator"],

  // Coordinator
  "/coordinator": ["admin", "associate_coordinator"],

  // Authed (any signed-in user)
  "/internal-chat": AUTHED,
  "/knowledge-base": AUTHED,
  "/notifications": AUTHED,

  // Team lead
  "/teamlead": ["admin", "team_lead"],
  "/teamlead/engineers": ["admin", "team_lead"],
  "/teamlead/jobs": ["admin", "team_lead"],
  "/teamlead/performance": ["admin", "team_lead"],

  // Engineer
  "/engineer": ["admin", "engineer"],
  "/engineer/onboarding": ["admin", "engineer"],
  "/engineer/jobs": ["admin", "engineer"],
  "/engineer/smart-match": ["admin", "engineer"],
  "/engineer/profile": ["admin", "engineer"],

  // Client
  "/client": ["admin", "client"],
  "/client/new-request": ["admin", "client"],
  "/client/tracking": ["admin", "client"],
  "/client/history": ["admin", "client"],
  "/client/settings": ["admin", "client"],
  "/client/estimates": ["admin", "client"],
  "/client/invoices": ["admin", "client"],

  // Partner
  "/partner": ["admin", "partner"],
  "/partner/clients": ["admin", "partner"],
  "/partner/jobs": ["admin", "partner"],
  "/partner/revenue": ["admin", "partner"],
};

/** Resolve allowed roles for a path. Falls back to longest prefix match, then to all roles. */
export function rolesForPath(path?: string): HelpRole[] {
  if (!path) return ALL_ROLES;
  if (ROUTE_ROLES[path]) return ROUTE_ROLES[path];
  const candidates = Object.keys(ROUTE_ROLES)
    .filter((p) => p !== "/" && path.startsWith(p))
    .sort((a, b) => b.length - a.length);
  return candidates.length ? ROUTE_ROLES[candidates[0]] : ALL_ROLES;
}

/** True when the role can access this path (admin always wins). */
export function roleCanAccess(role: HelpRole | null | undefined, path?: string): boolean {
  if (!role) return true; // unauthenticated previews of public docs
  if (role === "admin") return true;
  return rolesForPath(path).includes(role);
}
