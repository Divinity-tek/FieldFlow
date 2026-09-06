import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  changes?: Record<string, any> | null;
}

/**
 * Records an audit log entry for the currently signed-in user.
 * Silently no-ops when there is no session (RLS would reject anyway).
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      changes: entry.changes ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // Never break the calling flow because of audit logging
  }
}

/**
 * Detects RLS / policy errors from a Supabase error object and logs them.
 * Returns true if the error looked like a policy/RLS error.
 */
export async function logPolicyErrorIfAny(
  context: { entity_type: string; action: string; entity_id?: string | null; extra?: Record<string, any> },
  error: any
): Promise<boolean> {
  if (!error) return false;
  const code: string | undefined = error?.code;
  const message: string = String(error?.message ?? "");

  // Postgres codes: 42501 = insufficient_privilege (RLS denies),
  // 42P17 = infinite recursion in policy. Also catch generic RLS messages.
  const isPolicyError =
    code === "42501" ||
    code === "42P17" ||
    /row-level security|policy|infinite recursion/i.test(message);

  if (!isPolicyError) return false;

  await logAudit({
    action: `policy_error.${context.action}`,
    entity_type: context.entity_type,
    entity_id: context.entity_id ?? null,
    changes: {
      error_code: code ?? null,
      error_message: message,
      details: error?.details ?? null,
      hint: error?.hint ?? null,
      ...(context.extra ?? {}),
    },
  });
  return true;
}
