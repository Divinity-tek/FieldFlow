// Frontend mirror of the database role rules in
// public.enforce_job_payout_role / enforce_listing_payout_role.
// The DB always has the final say — this just keeps the UI honest.

type Role = "admin" | "team_lead" | "partner" | "engineer" | "client" | "associate_coordinator" | "service_desk" | "recruiter" | null | undefined;

export type PayoutPermissions = {
  canEditAllowances: boolean;       // transport / food / convenience
  canEditPartnerSplit: boolean;     // partner_split_percent
  canEditPlatformFee: boolean;      // platform_split_percent (admin only)
  readOnlyReason: string | null;    // why the user can't edit, if applicable
};

export function getPayoutPermissions(role: Role, isOwner = false): PayoutPermissions {
  if (role === "admin") {
    return { canEditAllowances: true, canEditPartnerSplit: true, canEditPlatformFee: true, readOnlyReason: null };
  }
  if (role === "team_lead") {
    return { canEditAllowances: true, canEditPartnerSplit: true, canEditPlatformFee: false, readOnlyReason: null };
  }
  if (role === "partner") {
    if (!isOwner) {
      return {
        canEditAllowances: false,
        canEditPartnerSplit: false,
        canEditPlatformFee: false,
        readOnlyReason: "Partners can only edit payout fields on jobs they created.",
      };
    }
    return { canEditAllowances: true, canEditPartnerSplit: true, canEditPlatformFee: false, readOnlyReason: null };
  }
  if (role === "engineer") {
    return {
      canEditAllowances: false,
      canEditPartnerSplit: false,
      canEditPlatformFee: false,
      readOnlyReason: "Engineers can't edit payout amounts. Submit an expense claim instead.",
    };
  }
  return {
    canEditAllowances: false,
    canEditPartnerSplit: false,
    canEditPlatformFee: false,
    readOnlyReason: "You don't have permission to edit payout fields.",
  };
}
